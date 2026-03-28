import { useCallback, useEffect, useMemo, useState } from "react";
import bridge from "@vkontakte/vk-bridge";
import { Button, Div, Group, Header, Input, Panel, PanelHeader, Textarea, View } from "@vkontakte/vkui";
import { apiClient, type ApiMarathon } from "../api/client";
import {
  defaultIntensiveState,
  getIntensiveStatusLabel,
  IntensiveMarathonFlow,
  INTENSIVE_MVP_MARATHON_ID,
  isIntensiveMvpMarathon,
  type IntensiveMarathonState
} from "./IntensiveMarathonFlow";
import "./App.css";

type TabId = "marathons" | "profile";

type MarathonTopic = {
  id: string;
  title: string;
  taskTypes?: TaskType[];
};

type TaskType = "video" | "test" | "practice" | "matching" | "calculator";

type TaskFlowStep = "intro" | "material" | "homework";

type LessonBlock =
  | { type: "text"; text: string }
  | { type: "video"; caption: string }
  | { type: "reels"; caption: string }
  | { type: "image"; caption: string; alt: string };

type TestLessonBundle = {
  intro: { title: string; lead: string; bullets: string[] };
  material: { title: string; blocks: LessonBlock[] };
};

type Marathon = {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed";
  mode?: "regular" | "test";
  startAtIso: string;
  /** Часов между открытием соседних тем (по умолчанию 24). */
  unlockIntervalHours?: number;
  /** Часов на прохождение темы после открытия (по умолчанию 24). */
  topicWindowHours?: number;
  topics: MarathonTopic[];
};

function normalizeMarathonFromApi(raw: ApiMarathon): Marathon {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description,
    status: raw.status,
    mode: raw.mode,
    startAtIso: raw.start_at_iso,
    unlockIntervalHours: raw.unlock_interval_hours,
    topicWindowHours: raw.topic_window_hours,
    topics: raw.topics.map((t) => ({
      id: t.id,
      title: t.title,
      taskTypes: t.task_types ?? undefined
    }))
  };
}

const FALLBACK_MARATHONS: Marathon[] = [
  {
    id: "m1",
    title: "Марафон: Старт в ЗПИФ",
    description: "Для новичков. База + практика + мини-квиз.",
    status: "open",
    mode: "regular",
    startAtIso: "2026-03-28T10:00:00.000Z",
    topics: [
      { id: "m1t1", title: "Тема 1. Что такое ЗПИФ" },
      { id: "m1t2", title: "Тема 2. Риски и горизонт" },
      { id: "m1t3", title: "Тема 3. Доходность и дисциплина" },
      { id: "m1t4", title: "Тема 4. Мини-стратегия" },
      { id: "m1t5", title: "Тема 5. Финальный кейс" }
    ]
  },
  {
    id: "m2",
    title: "Марафон: Продвинутый трек",
    description: "Откроется позже. Для тех, кто прошел базовый поток.",
    status: "closed",
    mode: "regular",
    startAtIso: "2026-04-15T10:00:00.000Z",
    topics: [
      { id: "m2t1", title: "Тема 1. Анализ фонда" },
      { id: "m2t2", title: "Тема 2. Ошибки новичка" },
      { id: "m2t3", title: "Тема 3. Сборка портфеля" }
    ]
  },
  {
    id: "m-test",
    title: "ЗПИФ сравнение фондов",
    description: "Без ограничений по времени и жизням. Для полного тестирования потока.",
    status: "open",
    mode: "test",
    startAtIso: "2026-03-01T10:00:00.000Z",
    topics: [
      {
        id: "mtt1",
        title: "Тема 1. Базовый блок",
        taskTypes: ["video", "test", "practice", "matching", "calculator"]
      },
      {
        id: "mtt2",
        title: "Тема 2. Практический блок",
        taskTypes: ["video", "test", "practice", "matching", "calculator"]
      }
    ]
  },
  {
    id: INTENSIVE_MVP_MARATHON_ID,
    title: "MVP: один день марафона",
    description:
      "Интенсив ЗПИФ: 4 этапа за день, жизни и тест 65%, награда и клуб на финише. Запишись и открой — демо без привязки к календарю потока.",
    status: "open",
    mode: "regular",
    startAtIso: "2026-03-28T06:00:00.000Z",
    unlockIntervalHours: 2,
    topicWindowHours: 8,
    topics: [
      { id: "m-one-day-t1", title: "День 1 · Утро: что такое ЗПИФ" },
      { id: "m-one-day-t2", title: "День 1 · День: риски и горизонт" },
      { id: "m-one-day-t3", title: "День 1 · Вечер: дисциплина и план" },
      { id: "m-one-day-t4", title: "День 1 · Финиш: мини-кейс" }
    ]
  }
];

/** Верный ответ в мини-проверке для видео-задания (тестовый марафон). */
const VIDEO_HOMEWORK_ANSWER = "Это паевой инвестиционный фонд: ты владеешь долей в портфеле активов";

type MarathonProgress = {
  lives: number;
  completedTopicIds: string[];
  testFailedTopicIds: string[];
  taskFailedTopicIds: string[];
  windowMissedTopicIds: string[];
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function isTestMarathon(marathon: Marathon): boolean {
  return marathon.mode === "test";
}

function getTaskTypeLabel(taskType: TaskType): string {
  if (taskType === "video") return "Видео";
  if (taskType === "test") return "Тест";
  if (taskType === "practice") return "Практика";
  if (taskType === "matching") return "Сопоставление";
  return "Калькулятор";
}

function getTestLessonBundle(topicId: string, taskType: TaskType): TestLessonBundle {
  const isTopic1 = topicId === "mtt1";
  const topicWord = isTopic1 ? "базовом блоке" : "практическом блоке";

  const baseIntro = (title: string, bullets: string[]): TestLessonBundle["intro"] => ({
    title,
    lead: `Сейчас ты в ${topicWord}. Сначала коротко поймём цель, потом разберём материал, и только после этого — задание. Как в Duolingo: шаг за шагом, без скачков.`,
    bullets
  });

  switch (taskType) {
    case "video":
      return {
        intro: baseIntro("Видео-урок", [
          "Поймёшь, о чём блок и что важно удержать в голове",
          "Посмотришь форматы: длинное видео и вертикальный «рилс»",
          "В конце — мини-проверка на внимательность"
        ]),
        material: {
          title: "Материал: видео и заметки",
          blocks: [
            {
              type: "text",
              text: `ЗПИФ — это паевой фонд: ты покупаешь долю в имуществе, а управляющая компания ведёт актив. В этом ${topicWord} мы смотрим, как это объясняется простым языком.`
            },
            {
              type: "video",
              caption: "Основное объяснение (2–4 мин.) — тестовый плеер"
            },
            {
              type: "reels",
              caption: "Вертикальный формат «как в соцсетях» — быстрый тезис"
            },
            {
              type: "image",
              caption: "Схема: инвестор → паи → фонд → недвижимость",
              alt: "Схема ЗПИФ"
            },
            {
              type: "text",
              text: "Запомни: горизонт и дисциплина важнее «идеальной точки входа»."
            }
          ]
        }
      };
    case "test":
      return {
        intro: baseIntro("Тест по пройденному", [
          "Напомним ключевые тезисы из блока",
          "Закрепим текстом и визуалом",
          "Потом ответишь на вопрос с вариантами"
        ]),
        material: {
          title: "Материал: конспект перед тестом",
          blocks: [
            {
              type: "text",
              text: "Перед тестом полезно повторить три опоры: что такое пай, кто управляет фондом, зачем нужна диверсификация."
            },
            {
              type: "image",
              caption: "Иллюстрация: распределение рисков",
              alt: "Диверсификация"
            },
            {
              type: "reels",
              caption: "60 секунд: «главное перед квизом»"
            },
            {
              type: "text",
              text: "Когда будешь готов, нажми «Далее» — откроется сам тест."
            }
          ]
        }
      };
    case "practice":
      return {
        intro: baseIntro("Практика: своя формулировка", [
          "Коротко вспомним рамку темы",
          "Посмотришь подсказки в картинках",
          "Затем сформулируешь ответ своими словами"
        ]),
        material: {
          title: "Материал: подсказки к заданию",
          blocks: [
            {
              type: "text",
              text: "Практика — это не «угадайка», а закрепление: напиши мини-план или правило, которое ты возьмёшь в реальность."
            },
            {
              type: "image",
              caption: "Чек-лист: горизонт, сумма, пересмотр",
              alt: "Чек-лист"
            },
            {
              type: "image",
              caption: "Пример формулировки цели на квартал",
              alt: "Пример цели"
            },
            {
              type: "text",
              text: "Дальше откроется поле ввода: достаточно 2–3 предложений."
            }
          ]
        }
      };
    case "matching":
      return {
        intro: baseIntro("Сопоставление понятий", [
          "Введём пары «термин — смысл»",
          "Закрепим визуально",
          "Потом выберешь верное соответствие в задании"
        ]),
        material: {
          title: "Материал: пары и примеры",
          blocks: [
            {
              type: "text",
              text: "Сопоставление помогает перевести абстрактные слова в жизненные ситуации: пай, ликвидность, горизонт."
            },
            {
              type: "image",
              caption: "Таблица: термин / простыми словами",
              alt: "Таблица терминов"
            },
            {
              type: "reels",
              caption: "Быстрый разбор: «что с чем путают чаще всего»"
            },
            {
              type: "text",
              text: "Когда прочитаешь — переходи к заданию и выбери один верный вариант."
            }
          ]
        }
      };
    default:
      return {
        intro: baseIntro("Калькулятор доходности", [
          "Напомним формулу изменения позиции",
          "Покажем пример на цифрах",
          "Потом введёшь свои значения"
        ]),
        material: {
          title: "Материал: как считать результат",
          blocks: [
            {
              type: "text",
              text: "Упрощённо: результат сделки по позиции ≈ (текущая цена − цена входа) × количество. Это учебный пример, не индивидуальная рекомендация."
            },
            {
              type: "image",
              caption: "Формула на «стикере»",
              alt: "Формула PnL"
            },
            {
              type: "video",
              caption: "Мини-разбор: откуда берутся цифры в примере"
            },
            {
              type: "text",
              text: "Дальше откроется калькулятор — введи числа и сверься с подсказкой."
            }
          ]
        }
      };
  }
}

export default function App() {
  const [vkReady, setVkReady] = useState(false);
  const [vkError, setVkError] = useState<string | null>(null);
  const [vkUserName, setVkUserName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>("marathons");
  const [selectedMarathonId, setSelectedMarathonId] = useState<string | null>(null);
  const [registeredMarathonIds, setRegisteredMarathonIds] = useState<string[]>([]);
  const [progressByMarathon, setProgressByMarathon] = useState<Record<string, MarathonProgress>>({});
  const [activeTestTask, setActiveTestTask] = useState<{ topicId: string; taskType: TaskType } | null>(null);
  const [completedTestTasksByTopic, setCompletedTestTasksByTopic] = useState<Record<string, TaskType[]>>({});
  const [quizAnswer, setQuizAnswer] = useState<string | null>(null);
  const [quizChecked, setQuizChecked] = useState(false);
  const [practiceDraft, setPracticeDraft] = useState("");
  const [practiceSubmitted, setPracticeSubmitted] = useState(false);
  const [matchingChoice, setMatchingChoice] = useState<string | null>(null);
  const [matchingChecked, setMatchingChecked] = useState(false);
  const [calcUnits, setCalcUnits] = useState("10");
  const [calcBuyPrice, setCalcBuyPrice] = useState("110");
  const [calcCurrentPrice, setCalcCurrentPrice] = useState("112");
  const [activePanel, setActivePanel] = useState<"main" | "task">("main");
  const [taskFlowStep, setTaskFlowStep] = useState<TaskFlowStep>("intro");
  const [showTaskSuccess, setShowTaskSuccess] = useState(false);
  const [videoHomeworkChoice, setVideoHomeworkChoice] = useState<string | null>(null);

  const [remoteMarathons, setRemoteMarathons] = useState<Marathon[] | null>(null);
  const [marathonsLoadError, setMarathonsLoadError] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createTopicsText, setCreateTopicsText] = useState("Тема 1\nТема 2\nТема 3");
  const [createStartLocal, setCreateStartLocal] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [createUnlockHours, setCreateUnlockHours] = useState("2");
  const [createWindowHours, setCreateWindowHours] = useState("8");
  const [createBusy, setCreateBusy] = useState(false);
  const [createMessage, setCreateMessage] = useState<string | null>(null);
  const [intensiveByMarathon, setIntensiveByMarathon] = useState<Record<string, IntensiveMarathonState>>({});

  const loadMarathons = useCallback(async () => {
    try {
      const raw = await apiClient.listMarathons();
      setRemoteMarathons(raw.map(normalizeMarathonFromApi));
      setMarathonsLoadError(null);
    } catch {
      setRemoteMarathons(null);
      setMarathonsLoadError("Не удалось загрузить марафоны с сервера — показаны только локальные.");
    }
  }, []);

  useEffect(() => {
    void loadMarathons();
  }, [loadMarathons]);

  async function submitCreateMarathon() {
    const titles = createTopicsText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!createTitle.trim() || titles.length === 0) {
      setCreateMessage("Укажи название и хотя бы одну тему (каждая с новой строки).");
      return;
    }
    setCreateBusy(true);
    setCreateMessage(null);
    try {
      const startIso = new Date(createStartLocal).toISOString();
      await apiClient.createMarathon({
        title: createTitle.trim(),
        description: createDescription.trim(),
        start_at_iso: startIso,
        topic_titles: titles,
        unlock_interval_hours: Math.max(0.25, Number(createUnlockHours) || 2),
        topic_window_hours: Math.max(0.25, Number(createWindowHours) || 8),
        status: "open",
        mode: "regular"
      });
      setCreateMessage("Марафон создан и появился в списке.");
      await loadMarathons();
    } catch {
      setCreateMessage("Не удалось создать: проверь, что API запущен и VITE_API_URL верный.");
    } finally {
      setCreateBusy(false);
    }
  }

  const marathons = useMemo(() => {
    const map = new Map<string, Marathon>();
    for (const m of FALLBACK_MARATHONS) map.set(m.id, m);
    if (remoteMarathons) for (const m of remoteMarathons) map.set(m.id, m);
    return Array.from(map.values());
  }, [remoteMarathons]);

  const selectedMarathon = marathons.find((m) => m.id === selectedMarathonId) ?? null;

  const registeredMarathons = useMemo(
    () => marathons.filter((m) => registeredMarathonIds.includes(m.id)),
    [marathons, registeredMarathonIds]
  );
  const totalCompletedTopics = useMemo(
    () =>
      registeredMarathons.reduce((acc, marathon) => {
        const progress = progressByMarathon[marathon.id];
        return acc + (progress?.completedTopicIds.length ?? 0);
      }, 0),
    [registeredMarathons, progressByMarathon]
  );
  const totalAvailableTopics = useMemo(
    () => registeredMarathons.reduce((acc, marathon) => acc + marathon.topics.length, 0),
    [registeredMarathons]
  );

  const activeTestTopic =
    selectedMarathon && activeTestTask ? selectedMarathon.topics.find((topic) => topic.id === activeTestTask.topicId) ?? null : null;

  const taskFlowLesson = useMemo(() => {
    if (!activeTestTask) return null;
    return getTestLessonBundle(activeTestTask.topicId, activeTestTask.taskType);
  }, [activeTestTask]);

  function getProgress(marathonId: string): MarathonProgress {
    return (
      progressByMarathon[marathonId] ?? {
        lives: 3,
        completedTopicIds: [],
        testFailedTopicIds: [],
        taskFailedTopicIds: [],
        windowMissedTopicIds: []
      }
    );
  }

  function resetTaskInteractionState() {
    setQuizAnswer(null);
    setQuizChecked(false);
    setPracticeDraft("");
    setPracticeSubmitted(false);
    setMatchingChoice(null);
    setMatchingChecked(false);
    setCalcUnits("10");
    setCalcBuyPrice("110");
    setCalcCurrentPrice("112");
    setVideoHomeworkChoice(null);
  }

  function closeTaskFlow() {
    setActivePanel("main");
    setActiveTestTask(null);
    setTaskFlowStep("intro");
    setShowTaskSuccess(false);
    resetTaskInteractionState();
  }

  function openTestTask(topicId: string, taskType: TaskType) {
    setActiveTestTask({ topicId, taskType });
    setTaskFlowStep("intro");
    setShowTaskSuccess(false);
    resetTaskInteractionState();
    setActivePanel("task");
  }

  function taskFlowBack() {
    if (showTaskSuccess) {
      closeTaskFlow();
      return;
    }
    if (taskFlowStep === "homework") setTaskFlowStep("material");
    else if (taskFlowStep === "material") setTaskFlowStep("intro");
    else closeTaskFlow();
  }

  function taskFlowNext() {
    if (taskFlowStep === "intro") setTaskFlowStep("material");
    else if (taskFlowStep === "material") setTaskFlowStep("homework");
  }

  function finishHomework(topicId: string, taskType: TaskType) {
    markTestTaskCompleted(topicId, taskType);
    setShowTaskSuccess(true);
  }

  function markTestTaskCompleted(topicId: string, taskType: TaskType) {
    setCompletedTestTasksByTopic((prev) => {
      const current = prev[topicId] ?? [];
      if (current.includes(taskType)) return prev;
      return { ...prev, [topicId]: [...current, taskType] };
    });
  }

  function isTestTaskCompleted(topicId: string, taskType: TaskType): boolean {
    return (completedTestTasksByTopic[topicId] ?? []).includes(taskType);
  }

  function registerToMarathon(marathonId: string) {
    setRegisteredMarathonIds((prev) => (prev.includes(marathonId) ? prev : [...prev, marathonId]));
    setProgressByMarathon((prev) => ({ ...prev, [marathonId]: getProgress(marathonId) }));
    if (marathonId === INTENSIVE_MVP_MARATHON_ID) {
      setIntensiveByMarathon((prev) => (prev[marathonId] ? prev : { ...prev, [marathonId]: defaultIntensiveState() }));
    }
  }

  function mergeIntensiveState(marathonId: string, fn: (s: IntensiveMarathonState) => IntensiveMarathonState) {
    setIntensiveByMarathon((prev) => {
      const cur = prev[marathonId] ?? defaultIntensiveState();
      return { ...prev, [marathonId]: fn(cur) };
    });
  }

  function resetIntensiveMarathonAttempt(marathonId: string) {
    setProgressByMarathon((prev) => ({
      ...prev,
      [marathonId]: {
        lives: 3,
        completedTopicIds: [],
        testFailedTopicIds: [],
        taskFailedTopicIds: [],
        windowMissedTopicIds: []
      }
    }));
    setIntensiveByMarathon((prev) => ({ ...prev, [marathonId]: defaultIntensiveState() }));
  }

  function updateProgress(marathonId: string, updater: (current: MarathonProgress) => MarathonProgress) {
    setProgressByMarathon((prev) => {
      const current = prev[marathonId] ?? getProgress(marathonId);
      return { ...prev, [marathonId]: updater(current) };
    });
  }

  function completeTopic(topicId: string) {
    if (!selectedMarathon) return;
    updateProgress(selectedMarathon.id, (current) => {
      if (current.completedTopicIds.includes(topicId)) return current;
      return { ...current, completedTopicIds: [...current.completedTopicIds, topicId] };
    });
  }

  function loseLifeByTest(topicId: string) {
    if (!selectedMarathon) return;
    updateProgress(selectedMarathon.id, (current) => {
      if (current.testFailedTopicIds.includes(topicId) || current.lives <= 0) return current;
      return {
        ...current,
        lives: Math.max(0, current.lives - 1),
        testFailedTopicIds: [...current.testFailedTopicIds, topicId]
      };
    });
  }

  function loseLifeByTask(topicId: string) {
    if (!selectedMarathon) return;
    updateProgress(selectedMarathon.id, (current) => {
      if (current.taskFailedTopicIds.includes(topicId) || current.lives <= 0) return current;
      return {
        ...current,
        lives: Math.max(0, current.lives - 1),
        taskFailedTopicIds: [...current.taskFailedTopicIds, topicId]
      };
    });
  }

  function applyDeadlinePenalty(topicId: string) {
    if (!selectedMarathon) return;
    updateProgress(selectedMarathon.id, (current) => {
      if (current.windowMissedTopicIds.includes(topicId) || current.lives <= 0) return current;
      return {
        ...current,
        lives: Math.max(0, current.lives - 1),
        windowMissedTopicIds: [...current.windowMissedTopicIds, topicId]
      };
    });
  }

  function getTopicState(marathon: Marathon, topicIndex: number, progress: MarathonProgress) {
    const topic = marathon.topics[topicIndex];
    if (isTestMarathon(marathon)) {
      const now = Date.now();
      return {
        isLocked: false,
        isCompleted: progress.completedTopicIds.includes(topic.id),
        isMissedByTime: false,
        unlockMs: now,
        windowEndsMs: now
      };
    }

    const now = Date.now();
    const startMs = new Date(marathon.startAtIso).getTime();
    const intervalH = marathon.unlockIntervalHours ?? 24;
    const windowH = marathon.topicWindowHours ?? 24;
    const intervalMs = intervalH * 60 * 60 * 1000;
    const windowMs = windowH * 60 * 60 * 1000;
    const unlockMs = startMs + topicIndex * intervalMs;
    const windowEndsMs = unlockMs + windowMs;
    const isCompleted = progress.completedTopicIds.includes(topic.id);
    const previousCompleted = topicIndex === 0 || progress.completedTopicIds.includes(marathon.topics[topicIndex - 1].id);
    const openedByTime = now >= unlockMs;
    const isLocked = !openedByTime || !previousCompleted || progress.lives <= 0;
    const isMissedByTime = !isCompleted && now > windowEndsMs;
    return { isLocked, isCompleted, isMissedByTime, unlockMs, windowEndsMs };
  }

  async function initVk() {
    try {
      setVkError(null);
      await bridge.send("VKWebAppInit");
      const user = await bridge.send("VKWebAppGetUserInfo");
      const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
      setVkUserName(fullName || "Пользователь VK");
      setVkReady(true);
    } catch (error) {
      console.error("VK bridge init failed", error);
      setVkReady(false);
      setVkError("Мини-апп должен открываться внутри VK. Нажми «Повторить подключение».");
    }
  }

  useEffect(() => {
    void initVk();
  }, []);

  useEffect(() => {
    setActiveTestTask(null);
    setActivePanel("main");
    setTaskFlowStep("intro");
    setShowTaskSuccess(false);
  }, [activeTab, selectedMarathonId]);

  if (!vkReady) {
    return (
      <View activePanel="main">
        <Panel id="main" className="story-panel">
          <PanelHeader className="story-topbar">ЗПИФ Навигатор</PanelHeader>
          <Group header={<Header className="story-group-title">Подключение VK</Header>}>
            <Div className="topic-content-card">
              <h3 className="topic-content-title">Требуется запуск через VK</h3>
              <p className="topic-content-text">
                {vkError ?? "Подключаем VK Bridge и данные пользователя..."}
              </p>
              <div className="topic-actions">
                <Button className="topic-primary-btn" onClick={() => void initVk()}>
                  Повторить подключение
                </Button>
              </div>
            </Div>
          </Group>
        </Panel>
      </View>
    );
  }

  return (
    <View activePanel={activePanel}>
      <Panel id="main" className="story-panel">
        <PanelHeader className="story-topbar">{selectedMarathon ? selectedMarathon.title : "ЗПИФ Навигатор"}</PanelHeader>
        <Group>
          <Div className="vk-user-chip">VK: {vkUserName}</Div>
        </Group>

        <Group>
          <Div className="tabs-row">
            <button type="button" className={`tab-pill ${activeTab === "marathons" ? "tab-pill-active" : ""}`} onClick={() => setActiveTab("marathons")}>
              Марафоны
            </button>
            <button type="button" className={`tab-pill ${activeTab === "profile" ? "tab-pill-active" : ""}`} onClick={() => setActiveTab("profile")}>
              Профиль
            </button>
          </Div>
        </Group>

        {activeTab === "marathons" && !selectedMarathon ? (
          <Group>
            <Div className="landing-screen-head">
              <button type="button" className="landing-screen-link">
                Закрыть
              </button>
              <div className="landing-screen-progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={44}>
                <span className="landing-screen-progress-fill" />
              </div>
              <button type="button" className="landing-screen-link landing-screen-link-share" aria-label="Поделиться">
                ⤴
              </button>
            </Div>
          </Group>
        ) : null}

        {activeTab === "profile" ? (
          <Group header={<Header className="story-group-title">Личный кабинет</Header>}>
            <Div className="profile-shell">
              <div className="profile-hero-card">
                <div className="profile-hero-left">
                  <div className="profile-avatar">{vkUserName.slice(0, 1).toUpperCase()}</div>
                  <div>
                    <div className="profile-hero-title">Привет, {vkUserName}</div>
                    <div className="profile-hero-subtitle">
                      Развивай навыки и отслеживай прогресс в марафонах
                    </div>
                  </div>
                </div>
                <div className="profile-date-badge">
                  Сегодня:{" "}
                  {new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" })}
                </div>
              </div>

              <div className="profile-stats-grid">
                <div className="profile-stat-card">
                  <div className="profile-stat-label">Марафоны</div>
                  <div className="profile-stat-value">{registeredMarathons.length}</div>
                </div>
                <div className="profile-stat-card">
                  <div className="profile-stat-label">Пройдено тем</div>
                  <div className="profile-stat-value">{totalCompletedTopics}</div>
                </div>
                <div className="profile-stat-card">
                  <div className="profile-stat-label">Всего тем</div>
                  <div className="profile-stat-value">{totalAvailableTopics}</div>
                </div>
              </div>

              {registeredMarathons.length === 0 ? (
                <div className="profile-empty-card">
                  <div className="profile-empty-title">Пока нет активных регистраций</div>
                  <p className="profile-empty-text">
                    Перейди во вкладку «Марафоны», выбери интересный поток и начни обучение.
                  </p>
                </div>
              ) : (
                <div className="profile-progress-list">
                  {registeredMarathons.map((marathon) => {
                    const progress = getProgress(marathon.id);
                    const completion = Math.round((progress.completedTopicIds.length / marathon.topics.length) * 100);

                    return (
                      <div key={marathon.id} className="profile-progress-card">
                        <div className="profile-progress-head">
                          <div className="profile-item-title">{marathon.title}</div>
                          <span className="profile-progress-percent">{completion}%</span>
                        </div>
                        <div className="profile-progress-sub">
                          Пройдено: {progress.completedTopicIds.length}/{marathon.topics.length} · Жизни: {progress.lives}/3
                        </div>
                        {isIntensiveMvpMarathon(marathon) ? (
                          <div className="profile-intensive-pill">
                            {getIntensiveStatusLabel(
                              (intensiveByMarathon[marathon.id] ?? defaultIntensiveState()).phase,
                              { lives: progress.lives, completedTopicIds: progress.completedTopicIds },
                              marathon.topics.length,
                              null
                            )}
                          </div>
                        ) : null}
                        <div className="profile-progress-track">
                          <div className="profile-progress-fill" style={{ width: `${completion}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Div>
          </Group>
        ) : selectedMarathon ? (
          isIntensiveMvpMarathon(selectedMarathon) ? (
            <IntensiveMarathonFlow
              marathon={selectedMarathon}
              userName={vkUserName}
              progress={{
                lives: getProgress(selectedMarathon.id).lives,
                completedTopicIds: getProgress(selectedMarathon.id).completedTopicIds
              }}
              updateProgress={(fn) => {
                updateProgress(selectedMarathon.id, (p) => {
                  const next = fn({ lives: p.lives, completedTopicIds: p.completedTopicIds });
                  return { ...p, lives: next.lives, completedTopicIds: next.completedTopicIds };
                });
              }}
              intensive={intensiveByMarathon[selectedMarathon.id] ?? defaultIntensiveState()}
              setIntensive={(fn) => mergeIntensiveState(selectedMarathon.id, fn)}
              onReentryReset={() => resetIntensiveMarathonAttempt(selectedMarathon.id)}
              onBack={() => setSelectedMarathonId(null)}
            />
          ) : (
            <Group header={<Header className="story-group-title">{selectedMarathon.title}</Header>}>
              <Div className="topic-content-card">
                {isTestMarathon(selectedMarathon) ? (
                  <p className="topic-content-helper">Тестовый режим: все темы доступны сразу, без ограничений по времени и жизням.</p>
                ) : (
                  <>
                    <p className="topic-content-helper">
                      Новая тема открывается каждые {selectedMarathon.unlockIntervalHours ?? 24} ч после предыдущей (или от
                      старта для первой) и только после прохождения предыдущей. Окно прохождения:{" "}
                      {selectedMarathon.topicWindowHours ?? 24} ч. Жизней: 3.
                    </p>
                    <p className="topic-content-text">Дата старта: {formatDate(selectedMarathon.startAtIso)}</p>
                  </>
                )}

                <div className="topic-list">
                  {selectedMarathon.topics.map((topic, index) => {
                    const progress = getProgress(selectedMarathon.id);
                    const state = getTopicState(selectedMarathon, index, progress);
                    const testMode = isTestMarathon(selectedMarathon);
                    const taskTypes = topic.taskTypes ?? [];
                    const allTaskTypesCompleted = taskTypes.every((taskType) => isTestTaskCompleted(topic.id, taskType));
                    const canCompleteTopic = testMode ? allTaskTypesCompleted : !state.isLocked;
                    const completeTopicButtonLabel = testMode
                      ? state.isCompleted
                        ? "Тема пройдена"
                        : allTaskTypesCompleted
                          ? "Завершить тему"
                          : "Сначала пройди задания"
                      : "Пройти тему";

                    return (
                      <div key={topic.id} className="marathon-topic-item">
                        <div className="marathon-topic-title">{topic.title}</div>
                        <div className="marathon-topic-sub">
                          {state.isCompleted
                            ? "Статус: пройдено"
                            : state.isLocked
                              ? "Статус: закрыто"
                              : "Статус: доступно"}
                        </div>
                        {testMode ? (
                          <>
                            <div className="marathon-topic-sub">Режим доступа: без ограничений</div>
                            {taskTypes.length > 0 ? (
                              <div className="topic-task-types-wrap">
                                <div className="topic-task-types-title">Задания в теме:</div>
                                <div className="topic-task-types-list">
                                  {taskTypes.map((taskType) => (
                                    <button
                                      key={`${topic.id}-${taskType}`}
                                      type="button"
                                      className={`topic-task-type-chip ${isTestTaskCompleted(topic.id, taskType) ? "topic-task-type-chip-done" : ""}`}
                                      onClick={() => openTestTask(topic.id, taskType)}
                                    >
                                      {getTaskTypeLabel(taskType)}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <div className="marathon-topic-sub">Откроется: {new Date(state.unlockMs).toLocaleString("ru-RU")}</div>
                            <div className="marathon-topic-sub">Окно прохождения: до {new Date(state.windowEndsMs).toLocaleString("ru-RU")}</div>
                          </>
                        )}

                        <div className="topic-actions">
                          <Button className="topic-primary-btn" disabled={!canCompleteTopic || state.isCompleted} onClick={() => completeTopic(topic.id)}>
                            {completeTopicButtonLabel}
                          </Button>
                          {testMode ? (
                            <Button
                              mode="secondary"
                              className="topic-secondary-btn"
                              disabled={taskTypes.length === 0}
                              onClick={() => openTestTask(topic.id, taskTypes[0] ?? "video")}
                            >
                              Открыть задания
                            </Button>
                          ) : null}
                          {!testMode ? (
                            <Button
                              mode="secondary"
                              className="topic-secondary-btn"
                              disabled={state.isLocked || progress.lives <= 0}
                              onClick={() => loseLifeByTest(topic.id)}
                            >
                              Не прошел тест (-1 жизнь)
                            </Button>
                          ) : null}
                        </div>

                        {!testMode ? (
                          <div className="topic-actions">
                            <Button
                              mode="secondary"
                              className="topic-secondary-btn"
                              disabled={state.isLocked || progress.lives <= 0}
                              onClick={() => loseLifeByTask(topic.id)}
                            >
                              Не выполнил задание (-1 жизнь)
                            </Button>
                            <Button
                              mode="secondary"
                              className="topic-secondary-btn"
                              disabled={state.isLocked || !state.isMissedByTime || progress.lives <= 0}
                              onClick={() => applyDeadlinePenalty(topic.id)}
                            >
                              Пропустил 24ч окно (-1 жизнь)
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>

                <div className="topic-actions">
                  <Button mode="secondary" className="topic-secondary-btn" onClick={() => setSelectedMarathonId(null)}>
                    Назад к списку марафонов
                  </Button>
                </div>
              </Div>
            </Group>
          )
        ) : (
          <Group header={<Header className="story-group-title">Доступные марафоны</Header>}>
            <Div className="topic-list">
              <div className="landing-hero-card">
                <div className="landing-hero-kicker">ПРОВЕРЬ СЕБЯ</div>
                <h2 className="landing-hero-title">Прокачай инвестиционное мышление</h2>
                <p className="landing-hero-text">
                  Стартуй с базового марафона, проходи темы по шагам и фиксируй прогресс без перегруза.
                </p>
              </div>
              {marathonsLoadError ? (
                <Div className="topic-content-card marathon-api-hint">
                  <p className="topic-content-text">{marathonsLoadError}</p>
                  <Button mode="secondary" className="topic-secondary-btn" onClick={() => void loadMarathons()}>
                    Повторить загрузку
                  </Button>
                </Div>
              ) : null}
              {marathons.map((marathon) => {
                const isRegistered = registeredMarathonIds.includes(marathon.id);
                const progress = getProgress(marathon.id);
                const isBlocked =
                  !isTestMarathon(marathon) && !isIntensiveMvpMarathon(marathon) && progress.lives <= 0;

                return (
                  <div
                    key={marathon.id}
                    className={`topic-card ${marathon.status === "open" ? "topic-card-blue" : "topic-card-neutral"}`}
                  >
                    <div className="topic-card-title">{marathon.title}</div>
                    <div className="topic-card-subtitle">{marathon.description}</div>
                    <div className="marathon-badges-row">
                      {isIntensiveMvpMarathon(marathon) ? (
                        <span className="status-badge status-intensive">Интенсив MVP</span>
                      ) : null}
                      {isTestMarathon(marathon) ? (
                        <span className="status-badge status-test">Тестовый</span>
                      ) : null}
                      <span className={`status-badge ${marathon.status === "open" ? "status-open" : "status-closed"}`}>
                        {marathon.status === "open" ? "Открытый" : "Закрытый"}
                      </span>
                      {!isTestMarathon(marathon) ? <span className="date-badge">Старт: {formatDate(marathon.startAtIso)}</span> : null}
                    </div>
                    <div className="topic-actions">
                      <Button
                        className="topic-primary-btn"
                        disabled={marathon.status !== "open" || isRegistered}
                        onClick={() => registerToMarathon(marathon.id)}
                      >
                        {isRegistered ? "Ты зарегистрирована" : "Записаться"}
                      </Button>
                      <Button
                        mode="secondary"
                        className="topic-secondary-btn"
                        disabled={!isRegistered || isBlocked}
                        onClick={() => setSelectedMarathonId(marathon.id)}
                      >
                        {isTestMarathon(marathon)
                          ? "Открыть без ограничений"
                          : isBlocked
                            ? "Жизни закончились"
                            : isIntensiveMvpMarathon(marathon)
                              ? "Открыть интенсив"
                              : "Открыть марафон"}
                      </Button>
                    </div>
                  </div>
                );
              })}
              <div className="topic-card topic-card-neutral marathon-create-card">
                <div className="topic-card-title">Создать марафон (демо)</div>
                <p className="topic-card-subtitle">
                  Черновик уходит на бэкенд: темы по одной строке, интервал открытия и окно прохождения — как в MVP «один день».
                </p>
                <div className="marathon-create-fields">
                  <label className="marathon-create-label">
                    Название
                    <Input value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Например: Интенсив выходного дня" />
                  </label>
                  <label className="marathon-create-label">
                    Описание
                    <Input value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} placeholder="Коротко о потоке" />
                  </label>
                  <label className="marathon-create-label">
                    Старт (локальное время)
                    <input
                      type="datetime-local"
                      className="marathon-create-datetime"
                      value={createStartLocal}
                      onChange={(e) => setCreateStartLocal(e.target.value)}
                    />
                  </label>
                  <label className="marathon-create-label">
                    Темы (каждая с новой строки)
                    <Textarea value={createTopicsText} onChange={(e) => setCreateTopicsText(e.target.value)} rows={4} />
                  </label>
                  <div className="marathon-create-row">
                    <label className="marathon-create-label marathon-create-label-inline">
                      Интервал открытия, ч
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={createUnlockHours}
                        onChange={(e) => setCreateUnlockHours(e.target.value)}
                      />
                    </label>
                    <label className="marathon-create-label marathon-create-label-inline">
                      Окно темы, ч
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={createWindowHours}
                        onChange={(e) => setCreateWindowHours(e.target.value)}
                      />
                    </label>
                  </div>
                </div>
                {createMessage ? <p className="topic-content-text marathon-create-message">{createMessage}</p> : null}
                <div className="topic-actions">
                  <Button className="topic-primary-btn" disabled={createBusy} onClick={() => void submitCreateMarathon()}>
                    {createBusy ? "Создаём…" : "Создать марафон"}
                  </Button>
                </div>
              </div>
            </Div>
          </Group>
        )}
      </Panel>

      <Panel id="task" className="story-panel duo-task-panel">
        <PanelHeader className="story-topbar duo-task-panel-header">
          <div className="duo-task-header-row">
            <button type="button" className="duo-task-back" onClick={taskFlowBack} aria-label="Назад">
              ←
            </button>
            <div className="duo-task-header-title">
              {activeTestTopic && activeTestTask ? `${activeTestTopic.title} · ${getTaskTypeLabel(activeTestTask.taskType)}` : "Задание"}
            </div>
            <div className="duo-task-step-badge">
              {taskFlowStep === "intro" ? "1/3" : taskFlowStep === "material" ? "2/3" : "3/3"}
            </div>
          </div>
        </PanelHeader>
        <Group>
          <Div className="duo-task-inner">
            {!activeTestTask || !activeTestTopic || !taskFlowLesson ? (
              <p className="topic-content-text">Загрузка…</p>
            ) : showTaskSuccess ? (
              <div className="duo-task-success">
                <div className="duo-task-success-title">Отлично!</div>
                <p className="duo-task-success-text">Задание «{getTaskTypeLabel(activeTestTask.taskType)}» выполнено.</p>
                <Button className="topic-primary-btn" onClick={closeTaskFlow}>
                  Вернуться к теме
                </Button>
              </div>
            ) : (
              <>
                <div className="duo-flow-progress" aria-hidden>
                  <div className="duo-flow-progress-track">
                    <div
                      className="duo-flow-progress-fill"
                      style={{
                        width: taskFlowStep === "intro" ? "33%" : taskFlowStep === "material" ? "66%" : "100%"
                      }}
                    />
                  </div>
                  <div className="duo-flow-progress-labels">
                    <span className={taskFlowStep === "intro" ? "duo-flow-active" : ""}>Введение</span>
                    <span className={taskFlowStep === "material" ? "duo-flow-active" : ""}>Материал</span>
                    <span className={taskFlowStep === "homework" ? "duo-flow-active" : ""}>Задание</span>
                  </div>
                </div>

                {taskFlowStep === "intro" ? (
                  <div className="duo-step-body">
                    <div className="duo-step-kicker">Шаг 1</div>
                    <h2 className="duo-intro-title">{taskFlowLesson.intro.title}</h2>
                    <p className="duo-intro-lead">{taskFlowLesson.intro.lead}</p>
                    <ul className="duo-intro-list">
                      {taskFlowLesson.intro.bullets.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                    <Button className="topic-primary-btn" onClick={taskFlowNext}>
                      Далее
                    </Button>
                  </div>
                ) : null}

                {taskFlowStep === "material" ? (
                  <div className="duo-step-body">
                    <div className="duo-step-kicker">Шаг 2 · Материал</div>
                    <h2 className="duo-intro-title">{taskFlowLesson.material.title}</h2>
                    <div className="duo-material-stack">
                      {taskFlowLesson.material.blocks.map((block, idx) => {
                        if (block.type === "text") {
                          return (
                            <p key={idx} className="duo-material-text">
                              {block.text}
                            </p>
                          );
                        }
                        if (block.type === "video") {
                          return (
                            <div key={idx} className="duo-material-block">
                              <div className="duo-video-placeholder">▶</div>
                              <div className="duo-video-caption">{block.caption}</div>
                            </div>
                          );
                        }
                        if (block.type === "reels") {
                          return (
                            <div key={idx} className="duo-material-block">
                              <div className="duo-reels-placeholder">{block.caption}</div>
                            </div>
                          );
                        }
                        return (
                          <div key={idx} className="duo-material-block">
                            <div className="duo-image-placeholder" role="img" aria-label={block.alt}>
                              <span className="duo-image-placeholder-label">{block.caption}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Button className="topic-primary-btn" onClick={taskFlowNext}>
                      Далее к заданию
                    </Button>
                  </div>
                ) : null}

                {taskFlowStep === "homework" ? (
                  <div className="duo-step-body duo-homework">
                    <div className="duo-step-kicker">Шаг 3 · Домашнее задание</div>
                    <h2 className="duo-intro-title">Закрепление</h2>
                    <p className="duo-intro-lead">Сделай интерактивную часть. После успешного выполнения задание будет засчитано.</p>

                    {activeTestTask.taskType === "video" ? (
                      <div className="test-task-body">
                        <div className="test-task-question">Мини-проверка: что верно про ЗПИФ?</div>
                        <div className="test-task-options">
                          {[VIDEO_HOMEWORK_ANSWER, "Это всегда один конкретный объект в личной собственности"].map((option) => (
                            <button
                              key={option}
                              type="button"
                              className={`test-task-option ${videoHomeworkChoice === option ? "test-task-option-active" : ""}`}
                              onClick={() => setVideoHomeworkChoice(option)}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        <Button
                          className="topic-primary-btn"
                          disabled={videoHomeworkChoice !== VIDEO_HOMEWORK_ANSWER}
                          onClick={() => finishHomework(activeTestTopic.id, "video")}
                        >
                          Завершить задание
                        </Button>
                      </div>
                    ) : null}

                    {activeTestTask.taskType === "test" ? (
                      <div className="test-task-body">
                        <div className="test-task-question">Что чаще всего делает новичок перед стартом инвестиций?</div>
                        <div className="test-task-options">
                          {[
                            "Сразу покупает актив без плана",
                            "Формирует стратегию и горизонт",
                            "Инвестирует все средства в один инструмент"
                          ].map((option) => (
                            <button
                              key={option}
                              type="button"
                              className={`test-task-option ${quizAnswer === option ? "test-task-option-active" : ""}`}
                              onClick={() => {
                                setQuizAnswer(option);
                                setQuizChecked(false);
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        <div className="topic-actions">
                          <Button
                            mode="secondary"
                            className="topic-secondary-btn"
                            disabled={!quizAnswer}
                            onClick={() => setQuizChecked(true)}
                          >
                            Проверить ответ
                          </Button>
                          {quizChecked && quizAnswer === "Формирует стратегию и горизонт" ? (
                            <Button className="topic-primary-btn" onClick={() => finishHomework(activeTestTopic.id, "test")}>
                              Завершить тест
                            </Button>
                          ) : null}
                        </div>
                        {quizChecked ? (
                          <div className="test-task-hint">
                            {quizAnswer === "Формирует стратегию и горизонт"
                              ? "Верно! Такой подход снижает риск и помогает держать дисциплину."
                              : "Почти. Попробуй вариант про стратегию и горизонт."}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {activeTestTask.taskType === "practice" ? (
                      <div className="test-task-body">
                        <div className="test-task-question">Практика: опиши свою мини-стратегию на 2–3 предложения.</div>
                        <textarea
                          className="test-task-textarea"
                          value={practiceDraft}
                          onChange={(event) => {
                            setPracticeDraft(event.target.value);
                            setPracticeSubmitted(false);
                          }}
                          placeholder="Например: инвестирую регулярно, диверсифицирую, пересматриваю портфель раз в квартал."
                        />
                        <div className="topic-actions">
                          <Button
                            mode="secondary"
                            className="topic-secondary-btn"
                            disabled={practiceDraft.trim().length < 10}
                            onClick={() => setPracticeSubmitted(true)}
                          >
                            Отправить практику
                          </Button>
                          {practiceSubmitted ? (
                            <Button className="topic-primary-btn" onClick={() => finishHomework(activeTestTopic.id, "practice")}>
                              Завершить практику
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {activeTestTask.taskType === "matching" ? (
                      <div className="test-task-body">
                        <div className="test-task-question">Сопоставление: что лучше всего связано с дисциплиной инвестора?</div>
                        <div className="test-task-options">
                          {["Панические покупки", "Регулярные взносы по плану", "Полный отказ от анализа"].map((option) => (
                            <button
                              key={option}
                              type="button"
                              className={`test-task-option ${matchingChoice === option ? "test-task-option-active" : ""}`}
                              onClick={() => {
                                setMatchingChoice(option);
                                setMatchingChecked(false);
                              }}
                            >
                              {option}
                            </button>
                          ))}
                        </div>
                        <div className="topic-actions">
                          <Button
                            mode="secondary"
                            className="topic-secondary-btn"
                            disabled={!matchingChoice}
                            onClick={() => setMatchingChecked(true)}
                          >
                            Проверить сопоставление
                          </Button>
                          {matchingChecked && matchingChoice === "Регулярные взносы по плану" ? (
                            <Button className="topic-primary-btn" onClick={() => finishHomework(activeTestTopic.id, "matching")}>
                              Завершить сопоставление
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    {activeTestTask.taskType === "calculator" ? (
                      <div className="test-task-body">
                        <div className="test-task-question">Калькулятор: рассчитай финансовый результат позиции.</div>
                        <div className="test-task-calc-grid">
                          <label className="test-task-field">
                            Количество
                            <input value={calcUnits} onChange={(event) => setCalcUnits(event.target.value)} className="test-task-input" />
                          </label>
                          <label className="test-task-field">
                            Цена входа
                            <input value={calcBuyPrice} onChange={(event) => setCalcBuyPrice(event.target.value)} className="test-task-input" />
                          </label>
                          <label className="test-task-field">
                            Текущая цена
                            <input value={calcCurrentPrice} onChange={(event) => setCalcCurrentPrice(event.target.value)} className="test-task-input" />
                          </label>
                        </div>
                        <div className="test-task-result">
                          Результат:{" "}
                          {(() => {
                            const units = Number(calcUnits) || 0;
                            const buy = Number(calcBuyPrice) || 0;
                            const current = Number(calcCurrentPrice) || 0;
                            const pnl = (current - buy) * units;
                            const sign = pnl >= 0 ? "+" : "";
                            return `${sign}${pnl.toFixed(2)} руб.`;
                          })()}
                        </div>
                        <Button className="topic-primary-btn" onClick={() => finishHomework(activeTestTopic.id, "calculator")}>
                          Завершить калькулятор
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </Div>
        </Group>
      </Panel>
    </View>
  );
}
