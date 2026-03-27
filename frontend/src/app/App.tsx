import { useState } from "react";
import { Button, Div, Group, Header, Panel, PanelHeader, View } from "@vkontakte/vkui";
import "./App.css";

type Card = {
  id: string;
  title: string;
  text?: string;
  type: "info" | "choice";
  options?: string[];
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
        title: "Сопоставь: что лучше для старта",
        options: ["Регулярные маленькие шаги", "Импульсивная покупка на весь капитал", "Смотреть на горизонт 1-3 года", "Покупать из-за FOMO"]
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
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);

  const activeTopic = TOPICS.find((topic) => topic.id === activeTopicId) ?? null;
  const activeCard = activeTopic ? activeTopic.cards[activeCardIndex] : null;

  function openTopic(topicId: string) {
    setActiveTopicId(topicId);
    setActiveCardIndex(0);
    setSelectedOptions([]);
  }

  function backToTopics() {
    setActiveTopicId(null);
    setActiveCardIndex(0);
    setSelectedOptions([]);
  }

  function nextCard() {
    if (!activeTopic) return;
    if (activeCardIndex < activeTopic.cards.length - 1) {
      setActiveCardIndex((prev) => prev + 1);
      setSelectedOptions([]);
      return;
    }
    backToTopics();
  }

  function toggleOption(option: string) {
    setSelectedOptions((prev) => (prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]));
  }

  return (
    <View activePanel="main">
      <Panel id="main" className="story-panel">
        <PanelHeader className="story-topbar">{activeTopic ? activeTopic.name : "ЗПИФ Навигатор"}</PanelHeader>

        {!activeTopic ? (
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
        ) : (
          <Group header={<Header className="story-group-title">Карточки темы</Header>}>
            <Div className="topic-content-card">
              <div className="topic-content-meta">
                Карточка {activeCardIndex + 1} из {activeTopic.cards.length}
              </div>

              <h3 className="topic-content-title">{activeCard?.title}</h3>

              {activeCard?.type === "info" ? (
                <p className="topic-content-text">{activeCard.text}</p>
              ) : (
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
