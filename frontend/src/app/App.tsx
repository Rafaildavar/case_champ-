import { useEffect, useState } from "react";
import bridge from "@vkontakte/vk-bridge";
import { Button, Div, Group, Header, Panel, PanelHeader, View } from "@vkontakte/vkui";
import "./App.css";

type Card = {
  id: string;
  title: string;
  text?: string;
  type: "info" | "choice" | "calc";
  options?: string[];
  helperText?: string;
};

type Topic = {
  id: string;
  name: string;
  description: string;
  accentClass: string;
  cards: Card[];
};

const TOPICS: Topic[] = [
  {
    id: "t1",
    name: "Тема 1",
    description: "Что такое ЗПИФ простыми словами",
    accentClass: "topic-card-blue",
    cards: [
      {
        id: "t1c1",
        type: "info",
        title: "Тема 1",
        text: "ЗПИФ - это фонд, который объединяет деньги инвесторов и вкладывает их в активы, например в недвижимость. Ты покупаешь не квартиру целиком, а долю фонда."
      },
      {
        id: "t1c2",
        type: "choice",
        title: "Сопоставь: что подходит новичку",
        helperText: "Выбери 2 правильных варианта.",
        options: ["Регулярные маленькие шаги", "Импульсивная покупка на весь капитал", "Смотреть на горизонт 1-3 года", "Покупать из-за FOMO"]
      },
      {
        id: "t1c3",
        type: "calc",
        title: "Мини-калькулятор доходности",
        helperText: "Выбери сумму и период, мы покажем примерный результат."
      }
    ]
  },
  {
    id: "t2",
    name: "Тема 2",
    description: "Риски и как их понимать",
    accentClass: "topic-card-purple",
    cards: [
      {
        id: "t2c1",
        type: "info",
        title: "Тема 2",
        text: "Риск - это не плохо. Это просто вероятность, что результат будет отличаться от ожиданий. Важно, чтобы риск соответствовал твоей цели и сроку."
      }
    ]
  },
  {
    id: "t3",
    name: "Тема 3",
    description: "Доходность и горизонт",
    accentClass: "topic-card-cyan",
    cards: [
      {
        id: "t3c1",
        type: "info",
        title: "Тема 3",
        text: "Чем длиннее горизонт, тем выше шанс спокойно переживать колебания рынка. Регулярность часто важнее попыток угадать лучший момент входа."
      }
    ]
  }
];

export default function App() {
  const [vkReady, setVkReady] = useState(false);
  const [vkError, setVkError] = useState<string | null>(null);
  const [vkUserName, setVkUserName] = useState<string>("");
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [calcAmount, setCalcAmount] = useState(50000);
  const [calcYears, setCalcYears] = useState(3);

  const activeTopic = TOPICS.find((topic) => topic.id === activeTopicId) ?? null;
  const activeCard = activeTopic ? activeTopic.cards[activeCardIndex] : null;

  function openTopic(topicId: string) {
    setActiveTopicId(topicId);
    setActiveCardIndex(0);
    setSelectedOptions([]);
    setCalcAmount(50000);
    setCalcYears(3);
  }

  function backToTopics() {
    setActiveTopicId(null);
    setActiveCardIndex(0);
    setSelectedOptions([]);
    setCalcAmount(50000);
    setCalcYears(3);
  }

  function nextCard() {
    if (!activeTopic) return;
    if (activeCardIndex < activeTopic.cards.length - 1) {
      setActiveCardIndex((prev) => prev + 1);
      setSelectedOptions([]);
      setCalcAmount(50000);
      setCalcYears(3);
      return;
    }
    backToTopics();
  }

  function toggleOption(option: string) {
    setSelectedOptions((prev) => (prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]));
  }

  const estimatedResult = Math.round(calcAmount * Math.pow(1.12, calcYears));
  const estimatedProfit = estimatedResult - calcAmount;

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
        <PanelHeader className="story-topbar">{activeTopic ? activeTopic.name : "ЗПИФ Навигатор"}</PanelHeader>

        {!activeTopic ? (
          <>
            <Group>
              <Div className="vk-user-chip">VK: {vkUserName}</Div>
            </Group>
            <Group header={<Header className="story-group-title">Выбери тему</Header>}>
              <Div className="topic-list">
                {TOPICS.map((topic) => (
                  <button key={topic.id} type="button" className={`topic-card ${topic.accentClass}`} onClick={() => openTopic(topic.id)}>
                    <div className="topic-card-title">{topic.name}</div>
                    <div className="topic-card-subtitle">{topic.description}</div>
                  </button>
                ))}
              </Div>
            </Group>
          </>
        ) : (
          <Group header={<Header className="story-group-title">Карточки темы</Header>}>
            <Div className="topic-content-card">
              <div className="topic-content-meta">
                Карточка {activeCardIndex + 1} из {activeTopic.cards.length}
              </div>

              <h3 className="topic-content-title">{activeCard?.title}</h3>
              {activeCard?.helperText ? <p className="topic-content-helper">{activeCard.helperText}</p> : null}

              {activeCard?.type === "info" ? (
                <p className="topic-content-text">{activeCard.text}</p>
              ) : activeCard?.type === "choice" ? (
                <div className="topic-match-grid">
                  {activeCard?.options?.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`topic-match-pill ${selectedOptions.includes(option) ? "topic-match-pill-active" : ""}`}
                      onClick={() => toggleOption(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="calc-wrap">
                  <div className="calc-block">
                    <div className="calc-label">Сумма вложения</div>
                    <div className="calc-chip-row">
                      {[10000, 50000, 100000].map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          className={`calc-chip ${calcAmount === amount ? "calc-chip-active" : ""}`}
                          onClick={() => setCalcAmount(amount)}
                        >
                          {amount.toLocaleString("ru-RU")} ₽
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="calc-block">
                    <div className="calc-label">Период</div>
                    <div className="calc-chip-row">
                      {[1, 3, 5].map((years) => (
                        <button
                          key={years}
                          type="button"
                          className={`calc-chip ${calcYears === years ? "calc-chip-active" : ""}`}
                          onClick={() => setCalcYears(years)}
                        >
                          {years} {years === 1 ? "год" : years < 5 ? "года" : "лет"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="calc-result">
                    <div className="calc-result-line">Было вложено: {calcAmount.toLocaleString("ru-RU")} ₽</div>
                    <div className="calc-result-line">Примерный итог: {estimatedResult.toLocaleString("ru-RU")} ₽</div>
                    <div className="calc-result-profit">Потенциальная разница: +{estimatedProfit.toLocaleString("ru-RU")} ₽</div>
                    <div className="calc-note">Примерный расчет, не инвестиционная рекомендация.</div>
                  </div>
                </div>
              )}

              <div className="topic-actions">
                <Button mode="secondary" className="topic-secondary-btn" onClick={backToTopics}>
                  К темам
                </Button>
                <Button className="topic-primary-btn" onClick={nextCard}>
                  {activeCardIndex < activeTopic.cards.length - 1 ? "Далее" : "Завершить"}
                </Button>
              </div>
            </Div>
          </Group>
        )}
      </Panel>
    </View>
  );
}
