import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Div, Group, Header } from "@vkontakte/vkui";

export const INTENSIVE_MVP_MARATHON_ID = "m-one-day";

const TEST_PASS_PERCENT = 65;
const DEADLINE_MS = 24 * 60 * 60 * 1000;

export type IntensiveTopicProgress = {
  videoWatched: boolean;
  sourcesViewed: boolean;
  testSelections: (number | null)[];
  testSubmitted: boolean;
  testScorePercent: number | null;
  resultViewed: boolean;
  testLifeLostForFail: boolean;
  deadlineLifeLost: boolean;
};

export type IntensivePhase = "overview" | "welcome_video" | "active" | "final" | "post_course" | "eliminated";

export type IntensiveMarathonState = {
  phase: IntensivePhase;
  topicUnlockedAt: Record<string, number>;
  topicSteps: Record<string, IntensiveTopicProgress>;
  /** Пользователь нажал «оформить награду» (не означает выдачу паёв). */
  rewardFlowOpened: boolean;
  clubJoined: boolean;
};

export function defaultIntensiveState(): IntensiveMarathonState {
  return {
    phase: "overview",
    topicUnlockedAt: {},
    topicSteps: {},
    rewardFlowOpened: false,
    clubJoined: false
  };
}

export function isIntensiveMvpMarathon(m: { id: string }): boolean {
  return m.id === INTENSIVE_MVP_MARATHON_ID;
}

function emptyTopicProgress(): IntensiveTopicProgress {
  return {
    videoWatched: false,
    sourcesViewed: false,
    testSelections: [null, null, null, null, null],
    testSubmitted: false,
    testScorePercent: null,
    resultViewed: false,
    testLifeLostForFail: false,
    deadlineLifeLost: false
  };
}

function getTopicSteps(state: IntensiveMarathonState, topicId: string): IntensiveTopicProgress {
  return state.topicSteps[topicId] ?? emptyTopicProgress();
}

type MarathonTopic = { id: string; title: string };

type MarathonMini = {
  id: string;
  title: string;
  topics: MarathonTopic[];
};

type ProgressSlice = {
  lives: number;
  completedTopicIds: string[];
};

type Props = {
  marathon: MarathonMini;
  userName: string;
  progress: ProgressSlice;
  updateProgress: (fn: (p: ProgressSlice) => ProgressSlice) => void;
  intensive: IntensiveMarathonState;
  setIntensive: (fn: (s: IntensiveMarathonState) => IntensiveMarathonState) => void;
  onReentryReset: () => void;
  onBack: () => void;
};

const BASE_QUIZ = [
  {
    q: "ЗПИФ в первую очередь — это…",
    options: ["Банковский вклад", "Паевой инвестиционный фонд", "Договор купли-продажи одной квартиры"],
    correct: 1
  },
  {
    q: "Кто обычно управляет портфелем ЗПИФ?",
    options: ["Случайные участники чата", "Управляющая компания", "Только нотариус"],
    correct: 1
  },
  {
    q: "Диверсификация помогает…",
    options: ["Сконцентрировать риск в одном активе", "Распределить риски между инструментами", "Исключить любые колебания рынка"],
    correct: 1
  },
  {
    q: "Горизонт инвестиций — это…",
    options: ["Только дата покупки", "Ожидаемый срок удержания позиции", "Час открытия биржи"],
    correct: 1
  },
  {
    q: "Пай — это…",
    options: ["Доля в имуществе фонда", "Страховой полис", "Гарантия дохода"],
    correct: 0
  }
];

function quizForTopic(topicIndex: number) {
  return BASE_QUIZ.map((item, i) => ({
    ...item,
    q: `День ${topicIndex + 1}, вопрос ${i + 1}. ${item.q}`
  }));
}

function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return "0:00:00";
  const s = Math.floor(msLeft / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function getIntensiveStatusLabel(
  phase: IntensivePhase,
  progress: ProgressSlice,
  topicsLen: number,
  activeTopicIndex: number | null
): string {
  if (phase === "overview") return "не начал · экран интенсива";
  if (phase === "welcome_video") return "посмотрел приветствие (ролик)";
  if (phase === "eliminated") return "выбыл · re-entry";
  if (phase === "final") return "завершил интенсив";
  if (phase === "post_course") return "post-course сценарий";
  if (activeTopicIndex === null) return "в процессе";
  const done = progress.completedTopicIds.length;
  return `в процессе этапа ${activeTopicIndex + 1} из ${topicsLen} (пройдено дней: ${done})`;
}

export function IntensiveMarathonFlow({
  marathon,
  userName,
  progress,
  updateProgress,
  intensive,
  setIntensive,
  onReentryReset,
  onBack
}: Props) {
  const topics = marathon.topics;
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const isTopicUnlocked = useCallback(
    (index: number): boolean => {
      if (intensive.phase !== "active" && intensive.phase !== "final") {
        return false;
      }
      if (intensive.phase === "final") return true;
      if (index === 0) return true;
      const prevId = topics[index - 1]?.id;
      return prevId ? progress.completedTopicIds.includes(prevId) : false;
    },
    [intensive.phase, progress.completedTopicIds, topics]
  );

  useEffect(() => {
    if (intensive.phase !== "active") return;
    topics.forEach((t, i) => {
      if (!isTopicUnlocked(i)) return;
      if (progress.completedTopicIds.includes(t.id)) return;
      setIntensive((s) => {
        if (s.topicUnlockedAt[t.id]) return s;
        return { ...s, topicUnlockedAt: { ...s.topicUnlockedAt, [t.id]: Date.now() } };
      });
    });
  }, [intensive.phase, isTopicUnlocked, progress.completedTopicIds, setIntensive, topics]);

  useEffect(() => {
    if (intensive.phase !== "active") return;
    const toPenalize: string[] = [];
    topics.forEach((t, i) => {
      if (!isTopicUnlocked(i)) return;
      if (progress.completedTopicIds.includes(t.id)) return;
      const unlockedAt = intensive.topicUnlockedAt[t.id];
      if (!unlockedAt || nowTick - unlockedAt < DEADLINE_MS) return;
      const steps = getTopicSteps(intensive, t.id);
      if (steps.deadlineLifeLost) return;
      toPenalize.push(t.id);
    });
    if (toPenalize.length === 0) return;
    setIntensive((s) => {
      let next = { ...s, topicSteps: { ...s.topicSteps } };
      for (const id of toPenalize) {
        const cur = getTopicSteps(next, id);
        if (cur.deadlineLifeLost) continue;
        next = {
          ...next,
          topicSteps: { ...next.topicSteps, [id]: { ...cur, deadlineLifeLost: true } }
        };
      }
      return next;
    });
    updateProgress((p) => {
      let lives = p.lives;
      for (let k = 0; k < toPenalize.length && lives > 0; k++) {
        lives = Math.max(0, lives - 1);
      }
      return { ...p, lives };
    });
  }, [intensive.phase, intensive.topicUnlockedAt, intensive.topicSteps, isTopicUnlocked, nowTick, progress.completedTopicIds, setIntensive, topics, updateProgress]);

  useEffect(() => {
    if (intensive.phase === "active" && progress.lives <= 0) {
      setIntensive((s) => (s.phase === "eliminated" ? s : { ...s, phase: "eliminated" }));
    }
  }, [intensive.phase, progress.lives, setIntensive]);

  useEffect(() => {
    if (topics.length === 0) return;
    if (intensive.phase !== "active") return;
    if (progress.completedTopicIds.length >= topics.length) {
      setIntensive((s) => ({ ...s, phase: "final" }));
    }
  }, [intensive.phase, progress.completedTopicIds.length, setIntensive, topics.length]);

  const activeTopicIndex = useMemo(() => {
    if (intensive.phase !== "active") return null;
    for (let i = 0; i < topics.length; i++) {
      if (!isTopicUnlocked(i)) continue;
      const tid = topics[i].id;
      if (progress.completedTopicIds.includes(tid)) continue;
      return i;
    }
    return null;
  }, [intensive.phase, isTopicUnlocked, progress.completedTopicIds, topics]);

  const activeTopic = activeTopicIndex !== null ? topics[activeTopicIndex] : null;
  const steps = activeTopic ? getTopicSteps(intensive, activeTopic.id) : null;
  const quiz = activeTopicIndex !== null ? quizForTopic(activeTopicIndex) : [];

  const patchTopic = (topicId: string, patch: Partial<IntensiveTopicProgress>) => {
    setIntensive((s) => {
      const cur = getTopicSteps(s, topicId);
      return { ...s, topicSteps: { ...s.topicSteps, [topicId]: { ...cur, ...patch } } };
    });
  };

  const completeTopic = (topicId: string) => {
    updateProgress((p) => {
      if (p.completedTopicIds.includes(topicId)) return p;
      return { ...p, completedTopicIds: [...p.completedTopicIds, topicId] };
    });
  };

  const submitTest = (topicId: string) => {
    const idx = topics.findIndex((t) => t.id === topicId);
    if (idx < 0) return;
    const qz = quizForTopic(idx);
    let correct = 0;
    const sel = getTopicSteps(intensive, topicId).testSelections;
    qz.forEach((question, i) => {
      if (sel[i] === question.correct) correct += 1;
    });
    const pct = Math.round((correct / qz.length) * 100);
    const passed = pct >= TEST_PASS_PERCENT;
    if (passed) {
      patchTopic(topicId, { testSubmitted: true, testScorePercent: pct });
      return;
    }
    setIntensive((s) => {
      const cur = getTopicSteps(s, topicId);
      if (cur.testLifeLostForFail) {
        return {
          ...s,
          topicSteps: {
            ...s.topicSteps,
            [topicId]: { ...cur, testSubmitted: true, testScorePercent: pct }
          }
        };
      }
      return {
        ...s,
        topicSteps: {
          ...s.topicSteps,
          [topicId]: { ...cur, testSubmitted: true, testScorePercent: pct, testLifeLostForFail: true }
        }
      };
    });
    const alreadyLost = getTopicSteps(intensive, topicId).testLifeLostForFail;
    if (!alreadyLost) {
      updateProgress((p) => {
        if (p.lives <= 0) return p;
        return { ...p, lives: Math.max(0, p.lives - 1) };
      });
    }
  };

  const resetTestAttempt = (topicId: string) => {
    patchTopic(topicId, {
      testSelections: [null, null, null, null, null],
      testSubmitted: false,
      testScorePercent: null
    });
  };

  const reentryReset = () => {
    onReentryReset();
  };

  const unlockedDeadlineLeft = (topicId: string): number | null => {
    const at = intensive.topicUnlockedAt[topicId];
    if (!at || progress.completedTopicIds.includes(topicId)) return null;
    return DEADLINE_MS - (nowTick - at);
  };

  const statusFooter = (
    <p className="intensive-status-footer">
      Статус (MVP):{" "}
      {getIntensiveStatusLabel(intensive.phase, progress, topics.length, activeTopicIndex)}
      {progress.lives < 3 ? ` · жизней: ${progress.lives}/3` : ""}
      {intensive.rewardFlowOpened ? " · оформление награды начато" : ""}
      {intensive.clubJoined ? " · клуб: вступил" : ""}
    </p>
  );

  if (intensive.phase === "overview") {
    return (
      <Group header={<Header className="story-group-title">{marathon.title}</Header>}>
        <Div className="topic-content-card intensive-screen">
          <div className="intensive-kicker">Интенсив · MVP экраны</div>
          <h2 className="topic-content-title intensive-title">ЗПИФ: один день — полный цикл</h2>
          <p className="topic-content-text">
            Короткий интенсив про инвестиции в закрытые паевые фонды недвижимости. Даты и потоки в демо условные: таймеры
            считаются от твоего устройства, календарь старта не блокирует прохождение.
          </p>
          <ul className="intensive-bullet-list">
            <li>
              <strong>Длительность:</strong> один учебный день, {topics.length} этапа подряд (внутри каждого — фиксированный
              порядок шагов).
            </li>
            <li>
              <strong>В конце:</strong> 100 паёв в рамках наградной механики (после выполнения юридических и операционных
              условий), доступ в закрытый клуб инвесторов, именной сертификат.
            </li>
            <li>
              <strong>Порядок:</strong> только последовательно — следующий этап не откроется, пока не закрыт текущий.
            </li>
            <li>
              <strong>Ограничения:</strong> 3 жизни на весь интенсив; на каждый открытый этап — 24 часа с момента открытия,
              чтобы пройти блок (в демо таймер реальный).
            </li>
            <li>
              <strong>Жизнь сгорает,</strong> если тест набрал меньше {TEST_PASS_PERCENT}% или этап просрочен по 24‑часовому
              окну.
            </li>
          </ul>
          {statusFooter}
          <div className="topic-actions">
            <Button className="topic-primary-btn" onClick={() => setIntensive((s) => ({ ...s, phase: "welcome_video" }))}>
              Далее к приветствию
            </Button>
            <Button mode="secondary" className="topic-secondary-btn" onClick={onBack}>
              Назад к списку
            </Button>
          </div>
        </Div>
      </Group>
    );
  }

  if (intensive.phase === "welcome_video") {
    return (
      <Group header={<Header className="story-group-title">Приветствие</Header>}>
        <Div className="topic-content-card intensive-screen">
          <h2 className="topic-content-title">Приветственный ролик</h2>
          <p className="topic-content-helper">
            Здесь будет видео от организаторов. В MVP — заглушка плеера; после просмотра нажми «Начать».
          </p>
          <div className="intensive-video-placeholder" aria-hidden>
            <span className="intensive-video-play">▶</span>
            <span>Приветственный ролик (демо)</span>
          </div>
          {statusFooter}
          <div className="topic-actions">
            <Button
              className="topic-primary-btn"
              onClick={() =>
                setIntensive((s) => ({
                  ...s,
                  phase: "active",
                  topicUnlockedAt: { ...s.topicUnlockedAt, [topics[0]?.id ?? ""]: Date.now() }
                }))
              }
              disabled={!topics[0]}
            >
              Начать
            </Button>
            <Button mode="secondary" className="topic-secondary-btn" onClick={() => setIntensive((s) => ({ ...s, phase: "overview" }))}>
              Назад
            </Button>
          </div>
        </Div>
      </Group>
    );
  }

  if (intensive.phase === "eliminated") {
    return (
      <Group header={<Header className="story-group-title">Попытка завершена</Header>}>
        <Div className="topic-content-card intensive-screen">
          <h2 className="topic-content-title">Ты не проиграла — закончились жизни этой попытки</h2>
          <p className="topic-content-text">
            Интенсив в этой попытке считается незавершённым: закончились все 3 жизни (тест ниже {TEST_PASS_PERCENT}% или
            просрочен 24‑часовой этап после его открытия).
          </p>
          <p className="topic-content-text">
            Дальше можно: записаться в лист ожидания следующего потока, пройти заново демо-поток или вернуться к списку
            марафонов. Это не наказание — новая попытка всегда возможна.
          </p>
          <ul className="intensive-bullet-list">
            <li>Следующий поток (уведомление)</li>
            <li>Лист ожидания</li>
            <li>Начать демо заново</li>
          </ul>
          {statusFooter}
          <div className="topic-actions intensive-actions-stack">
            <Button className="topic-primary-btn" onClick={reentryReset}>
              Начать заново (демо)
            </Button>
            <Button mode="secondary" className="topic-secondary-btn" onClick={onBack}>
              К списку марафонов
            </Button>
          </div>
        </Div>
      </Group>
    );
  }

  if (intensive.phase === "final") {
    return (
      <Group header={<Header className="story-group-title">Поздравляем!</Header>}>
        <Div className="topic-content-card intensive-screen">
          <div className="intensive-kicker">Финиш интенсива</div>
          <h2 className="topic-content-title">Ты успешно прошла интенсив</h2>
          <p className="topic-content-text">Все этапы закрыты в правильном порядке. Ниже — что ты получаешь по правилам награды.</p>
          <div className="intensive-reward-block">
            <h3 className="intensive-subtitle">Награды</h3>
            <ul className="intensive-bullet-list">
              <li>
                <strong>100 паёв</strong> в рамках наградной механики (расчётная логика «от ~6 ₽ за пай» — для ощутимого, но
                реалистичного приза). Фактическая выдача — только после идентификации, подходящего счёта, согласия с правилами
                акции и с учётом налоговых ограничений. Не начисляется автоматически «по клику».
              </li>
              <li>
                <strong>Закрытый клуб инвесторов:</strong> эфиры и форумы, встречи с экспертами, разборы рынка, ранний доступ к
                предложениям, отдельная лента/чат, приоритет на мероприятиях.
              </li>
              <li>
                <strong>Именной сертификат</strong> о прохождении интенсива по теме ЗПИФ.
              </li>
            </ul>
          </div>
          <p className="intensive-legal-note">
            Организатор заранее публикует полные правила: без выполнения обязательных условий награда не считается
            подтверждённой.
          </p>
          {statusFooter}
          <div className="topic-actions intensive-actions-stack">
            <Button
              className="topic-primary-btn"
              onClick={() => setIntensive((s) => ({ ...s, clubJoined: true }))}
              disabled={intensive.clubJoined}
            >
              {intensive.clubJoined ? "Запрос в клуб отправлен (MVP)" : "Вступить в закрытый клуб"}
            </Button>
            <Button
              mode="secondary"
              className="topic-secondary-btn"
              onClick={() => setIntensive((s) => ({ ...s, rewardFlowOpened: true }))}
            >
              Получить паи / перейти к оформлению награды
            </Button>
            <Button mode="secondary" className="topic-secondary-btn" onClick={() => setIntensive((s) => ({ ...s, phase: "post_course" }))}>
              Что делать дальше
            </Button>
            <Button mode="secondary" className="topic-secondary-btn" onClick={onBack}>
              К списку марафонов
            </Button>
          </div>
        </Div>
      </Group>
    );
  }

  if (intensive.phase === "post_course") {
    return (
      <Group header={<Header className="story-group-title">После интенсива</Header>}>
        <Div className="topic-content-card intensive-screen">
          <h2 className="topic-content-title">Сценарий на 2–4 недели (MVP)</h2>
          <p className="topic-content-text">
            Чтобы не «проваливаться в пустоту», после финала заложена цепочка касаний — здесь как скрин-план для продукта.
          </p>
          <ol className="intensive-week-list">
            <li>
              <strong>Неделя 1:</strong> welcome-серия в закрытый клуб (3 коротких сообщения: правила, расписание, кто курирует
              чат).
            </li>
            <li>
              <strong>Неделя 1–2:</strong> напоминание о награде, если оформление не завершено; честный статус «ожидаем
              документы / счёт».
            </li>
            <li>
              <strong>Неделя 2:</strong> контент для первого самостоятельного шага (чек-лист: горизонт, сумма, где смотреть
              документы фонда).
            </li>
            <li>
              <strong>Неделя 3:</strong> приглашение на онлайн-разбор + офлайн/онлайн митап (дата TBD).
            </li>
            <li>
              <strong>Неделя 4:</strong> мягкий переход к следующему целевому действию (консультация, подбор фонда, углублённый
              курс).
            </li>
          </ol>
          {!intensive.rewardFlowOpened ? (
            <p className="topic-content-helper">Напоминание: награда в паёв — только после выполнения условий из правил акции.</p>
          ) : (
            <p className="topic-content-helper">Оформление награды начато — дождись статуса от организатора.</p>
          )}
          {statusFooter}
          <div className="topic-actions">
            <Button className="topic-primary-btn" onClick={() => setIntensive((s) => ({ ...s, phase: "final" }))}>
              Назад к экрану наград
            </Button>
            <Button mode="secondary" className="topic-secondary-btn" onClick={onBack}>
              К списку марафонов
            </Button>
          </div>
        </Div>
      </Group>
    );
  }

  /* phase === active */
  return (
    <Group header={<Header className="story-group-title">{marathon.title}</Header>}>
      <Div className="topic-content-card intensive-screen">
        <div className="intensive-top-bar">
          <span className="intensive-lives">Жизни: {progress.lives}/3</span>
          <span className="intensive-user-chip">{userName}</span>
        </div>
        <p className="topic-content-helper">
          Порядок внутри этапа: ролик → полезные источники → тест → результат → открытие следующего этапа. Следующий этап не
          откроется, пока не просмотрен ролик, не пройден тест (≥{TEST_PASS_PERCENT}%) и не получен результат.
        </p>

        <div className="intensive-topic-rail">
          {topics.map((t, i) => {
            const unlocked = isTopicUnlocked(i);
            const done = progress.completedTopicIds.includes(t.id);
            const left = unlockedDeadlineLeft(t.id);
            return (
              <div
                key={t.id}
                className={`intensive-rail-item ${done ? "intensive-rail-done" : ""} ${unlocked && !done ? "intensive-rail-active" : ""} ${!unlocked ? "intensive-rail-locked" : ""}`}
              >
                <span className="intensive-rail-num">{i + 1}</span>
                <span className="intensive-rail-title">{t.title}</span>
                {done ? <span className="intensive-rail-badge">готово</span> : null}
                {!done && unlocked && left !== null ? (
                  <span className="intensive-rail-timer">24ч: {formatCountdown(left)}</span>
                ) : null}
              </div>
            );
          })}
        </div>

        {!activeTopic || !steps ? (
          <p className="topic-content-text">Все этапы дня закрыты или загрузка…</p>
        ) : (
          <div className="intensive-day-card">
            <h3 className="intensive-subtitle">{activeTopic.title}</h3>

            <section className="intensive-step">
              <div className="intensive-step-head">
                <span className="intensive-step-num">1</span>
                <span>Просмотр ролика</span>
              </div>
              {!steps.videoWatched ? (
                <>
                  <div className="intensive-video-placeholder intensive-video-placeholder-sm">
                    <span className="intensive-video-play">▶</span>
                    <span>Ролик этапа (демо)</span>
                  </div>
                  <Button className="topic-primary-btn" onClick={() => patchTopic(activeTopic.id, { videoWatched: true })}>
                    Ролик просмотрен
                  </Button>
                </>
              ) : (
                <p className="intensive-step-done">Шаг выполнен</p>
              )}
            </section>

            <section className={`intensive-step ${!steps.videoWatched ? "intensive-step-locked" : ""}`}>
              <div className="intensive-step-head">
                <span className="intensive-step-num">2</span>
                <span>Полезные источники</span>
              </div>
              <ul className="intensive-source-list">
                <li>
                  <a href="https://www.cbr.ru/" target="_blank" rel="noreferrer">
                    Банк России — базовые материалы
                  </a>
                </li>
                <li>
                  <a href="https://www.sberbank.ru/" target="_blank" rel="noreferrer">
                    Сбер — раздел про инвестиции (демо-ссылка)
                  </a>
                </li>
                <li>
                  <span className="intensive-source-fake">Документы УК и описание ЗПИФ (заглушка)</span>
                </li>
              </ul>
              <Button
                className="topic-primary-btn"
                disabled={!steps.videoWatched || steps.sourcesViewed}
                onClick={() => patchTopic(activeTopic.id, { sourcesViewed: true })}
              >
                Ознакомился с источниками
              </Button>
            </section>

            <section className={`intensive-step ${!steps.sourcesViewed ? "intensive-step-locked" : ""}`}>
              <div className="intensive-step-head">
                <span className="intensive-step-num">3</span>
                <span>Тест этапа</span>
              </div>
              {steps.testSubmitted && steps.testScorePercent !== null ? (
                <p className="topic-content-text">
                  Набрано {steps.testScorePercent}%. Порог {TEST_PASS_PERCENT}%.{" "}
                  {steps.testScorePercent >= TEST_PASS_PERCENT ? "Тест пройден." : "Тест не пройден — жизнь списана за эту попытку."}
                </p>
              ) : (
                quiz.map((question, qi) => (
                  <div key={qi} className="intensive-quiz-q">
                    <div className="intensive-quiz-title">{question.q}</div>
                    <div className="test-task-options">
                      {question.options.map((opt, oi) => (
                        <button
                          key={opt}
                          type="button"
                          className={`test-task-option ${steps.testSelections[qi] === oi ? "test-task-option-active" : ""}`}
                          onClick={() => {
                            const next = [...steps.testSelections];
                            next[qi] = oi;
                            patchTopic(activeTopic.id, { testSelections: next });
                          }}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              )}
              {!steps.testSubmitted ? (
                <Button
                  className="topic-primary-btn"
                  disabled={!steps.sourcesViewed || steps.testSelections.some((x) => x === null)}
                  onClick={() => submitTest(activeTopic.id)}
                >
                  Отправить ответы
                </Button>
              ) : steps.testScorePercent !== null && steps.testScorePercent < TEST_PASS_PERCENT ? (
                <Button mode="secondary" className="topic-secondary-btn" onClick={() => resetTestAttempt(activeTopic.id)}>
                  Пройти тест снова
                </Button>
              ) : null}
            </section>

            <section
              className={`intensive-step ${!(steps.testSubmitted && (steps.testScorePercent ?? 0) >= TEST_PASS_PERCENT) ? "intensive-step-locked" : ""}`}
            >
              <div className="intensive-step-head">
                <span className="intensive-step-num">4</span>
                <span>Результат теста</span>
              </div>
              {steps.testSubmitted && steps.testScorePercent !== null && steps.testScorePercent >= TEST_PASS_PERCENT ? (
                <>
                  <p className="topic-content-text">
                    Отлично: {steps.testScorePercent}% правильных ответов. Этап засчитан с точки зрения теста.
                  </p>
                  {!steps.resultViewed ? (
                    <Button className="topic-primary-btn" onClick={() => patchTopic(activeTopic.id, { resultViewed: true })}>
                      Подтвердить получение результата
                    </Button>
                  ) : (
                    <p className="intensive-step-done">Результат получен</p>
                  )}
                </>
              ) : steps.testSubmitted ? (
                <p className="topic-content-text">Закрой тест с результатом не ниже {TEST_PASS_PERCENT}%, чтобы открыть этот шаг.</p>
              ) : (
                <p className="topic-content-helper">Сначала пройди тест.</p>
              )}
            </section>

            <section className={`intensive-step ${!steps.resultViewed ? "intensive-step-locked" : ""}`}>
              <div className="intensive-step-head">
                <span className="intensive-step-num">5</span>
                <span>Закрыть этап и открыть следующий</span>
              </div>
              <Button
                className="topic-primary-btn"
                disabled={!steps.resultViewed}
                onClick={() => completeTopic(activeTopic.id)}
              >
                Завершить этап
              </Button>
            </section>
          </div>
        )}

        {statusFooter}
        <div className="topic-actions">
          <Button mode="secondary" className="topic-secondary-btn" onClick={onBack}>
            Назад к списку марафонов
          </Button>
        </div>
      </Div>
    </Group>
  );
}
