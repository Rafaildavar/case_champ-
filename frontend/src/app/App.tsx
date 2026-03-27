import { useEffect, useMemo, useState } from "react";
import bridge from "@vkontakte/vk-bridge";
import { Button, Div, Group, Header, Panel, PanelHeader, View } from "@vkontakte/vkui";
import "./App.css";

type TabId = "marathons" | "profile";

type MarathonTopic = {
  id: string;
  title: string;
  taskTypes?: TaskType[];
};

type TaskType = "video" | "test" | "practice" | "matching" | "calculator";

type Marathon = {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed";
  mode?: "regular" | "test";
  startAtIso: string;
  topics: MarathonTopic[];
};

const MARATHONS: Marathon[] = [
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
    title: "Тестовый марафон",
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
  }
];

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

  const selectedMarathon = MARATHONS.find((m) => m.id === selectedMarathonId) ?? null;

  const registeredMarathons = useMemo(
    () => MARATHONS.filter((m) => registeredMarathonIds.includes(m.id)),
    [registeredMarathonIds]
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
  }

  function openTestTask(topicId: string, taskType: TaskType) {
    setActiveTestTask({ topicId, taskType });
    resetTaskInteractionState();
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
    const unlockMs = startMs + topicIndex * 24 * 60 * 60 * 1000;
    const windowEndsMs = unlockMs + 24 * 60 * 60 * 1000;
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
    <View activePanel="main">
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
          <Group header={<Header className="story-group-title">{selectedMarathon.title}</Header>}>
            <Div className="topic-content-card">
              {isTestMarathon(selectedMarathon) ? (
                <p className="topic-content-helper">Тестовый режим: все темы доступны сразу, без ограничений по времени и жизням.</p>
              ) : (
                <>
                  <p className="topic-content-helper">
                    Новая тема открывается каждые 24 часа и только после прохождения предыдущей. Всего 3 жизни.
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

              {isTestMarathon(selectedMarathon) && activeTestTask && activeTestTopic ? (
                <div className="test-task-screen">
                  <div className="test-task-head">
                    <div className="test-task-kicker">
                      {activeTestTopic.title} · {getTaskTypeLabel(activeTestTask.taskType)}
                    </div>
                    <button type="button" className="test-task-close" onClick={() => setActiveTestTask(null)}>
                      Закрыть
                    </button>
                  </div>

                  {activeTestTask.taskType === "video" ? (
                    <div className="test-task-body">
                      <div className="test-task-video">Видео-превью</div>
                      <p className="test-task-text">
                        Посмотри вводный ролик по теме и отметь выполнение. Для теста считаем, что видео просмотрено.
                      </p>
                      <Button className="topic-primary-btn" onClick={() => markTestTaskCompleted(activeTestTopic.id, "video")}>
                        Отметить «Видео просмотрено»
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
                          <Button className="topic-primary-btn" onClick={() => markTestTaskCompleted(activeTestTopic.id, "test")}>
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
                      <div className="test-task-question">Практика: опиши свою мини-стратегию на 2-3 предложения.</div>
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
                          <Button className="topic-primary-btn" onClick={() => markTestTaskCompleted(activeTestTopic.id, "practice")}>
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
                          <Button className="topic-primary-btn" onClick={() => markTestTaskCompleted(activeTestTopic.id, "matching")}>
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
                      <Button className="topic-primary-btn" onClick={() => markTestTaskCompleted(activeTestTopic.id, "calculator")}>
                        Завершить калькулятор
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className="topic-actions">
                <Button mode="secondary" className="topic-secondary-btn" onClick={() => setSelectedMarathonId(null)}>
                  Назад к списку марафонов
                </Button>
              </div>
            </Div>
          </Group>
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
              {MARATHONS.map((marathon) => {
                const isRegistered = registeredMarathonIds.includes(marathon.id);
                const progress = getProgress(marathon.id);
                const isBlocked = !isTestMarathon(marathon) && progress.lives <= 0;

                return (
                  <div
                    key={marathon.id}
                    className={`topic-card ${marathon.status === "open" ? "topic-card-blue" : "topic-card-neutral"}`}
                  >
                    <div className="topic-card-title">{marathon.title}</div>
                    <div className="topic-card-subtitle">{marathon.description}</div>
                    <div className="marathon-badges-row">
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
                        {isTestMarathon(marathon) ? "Открыть без ограничений" : isBlocked ? "Жизни закончились" : "Открыть марафон"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </Div>
          </Group>
        )}
      </Panel>
    </View>
  );
}
