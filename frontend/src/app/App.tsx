import { useEffect, useMemo, useState } from "react";
import bridge from "@vkontakte/vk-bridge";
import { Button, Div, Group, Header, Panel, PanelHeader, View } from "@vkontakte/vkui";
import "./App.css";

type TabId = "marathons" | "profile";

type MarathonTopic = {
  id: string;
  title: string;
};

type Marathon = {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed";
  startAtIso: string;
  topics: MarathonTopic[];
};

const MARATHONS: Marathon[] = [
  {
    id: "m1",
    title: "Марафон: Старт в ЗПИФ",
    description: "Для новичков. База + практика + мини-квиз.",
    status: "open",
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
    startAtIso: "2026-04-15T10:00:00.000Z",
    topics: [
      { id: "m2t1", title: "Тема 1. Анализ фонда" },
      { id: "m2t2", title: "Тема 2. Ошибки новичка" },
      { id: "m2t3", title: "Тема 3. Сборка портфеля" }
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

export default function App() {
  const [vkReady, setVkReady] = useState(false);
  const [vkError, setVkError] = useState<string | null>(null);
  const [vkUserName, setVkUserName] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>("marathons");
  const [selectedMarathonId, setSelectedMarathonId] = useState<string | null>(null);
  const [registeredMarathonIds, setRegisteredMarathonIds] = useState<string[]>([]);
  const [progressByMarathon, setProgressByMarathon] = useState<Record<string, MarathonProgress>>({});

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
              <p className="topic-content-helper">
                Новая тема открывается каждые 24 часа и только после прохождения предыдущей. Всего 3 жизни.
              </p>
              <p className="topic-content-text">Дата старта: {formatDate(selectedMarathon.startAtIso)}</p>

              <div className="topic-list">
                {selectedMarathon.topics.map((topic, index) => {
                  const progress = getProgress(selectedMarathon.id);
                  const state = getTopicState(selectedMarathon, index, progress);

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
                      <div className="marathon-topic-sub">Откроется: {new Date(state.unlockMs).toLocaleString("ru-RU")}</div>
                      <div className="marathon-topic-sub">Окно прохождения: до {new Date(state.windowEndsMs).toLocaleString("ru-RU")}</div>

                      <div className="topic-actions">
                        <Button className="topic-primary-btn" disabled={state.isLocked || state.isCompleted} onClick={() => completeTopic(topic.id)}>
                          Пройти тему
                        </Button>
                        <Button
                          mode="secondary"
                          className="topic-secondary-btn"
                          disabled={state.isLocked || progress.lives <= 0}
                          onClick={() => loseLifeByTest(topic.id)}
                        >
                          Не прошел тест (-1 жизнь)
                        </Button>
                      </div>

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
        ) : (
          <Group header={<Header className="story-group-title">Доступные марафоны</Header>}>
            <Div className="topic-list">
              {MARATHONS.map((marathon) => {
                const isRegistered = registeredMarathonIds.includes(marathon.id);
                const progress = getProgress(marathon.id);
                const isBlocked = progress.lives <= 0;

                return (
                  <div
                    key={marathon.id}
                    className={`topic-card ${marathon.status === "open" ? "topic-card-blue" : "topic-card-neutral"}`}
                  >
                    <div className="topic-card-title">{marathon.title}</div>
                    <div className="topic-card-subtitle">{marathon.description}</div>
                    <div className="marathon-badges-row">
                      <span className={`status-badge ${marathon.status === "open" ? "status-open" : "status-closed"}`}>
                        {marathon.status === "open" ? "Открытый" : "Закрытый"}
                      </span>
                      <span className="date-badge">Старт: {formatDate(marathon.startAtIso)}</span>
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
                        {isBlocked ? "Жизни закончились" : "Открыть марафон"}
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
