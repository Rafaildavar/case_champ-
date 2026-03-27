import { useState } from "react";
import { Button, Div, Group, Header, Panel, PanelHeader, SimpleCell, View } from "@vkontakte/vkui";
import "./App.css";

type StoryStep = {
  id: string;
  title: string;
  subtitle: string;
  options?: string[];
};

const STORY_STEPS: StoryStep[] = [
  {
    id: "hook",
    title: "Инвестиции в недвижимость без покупки квартиры",
    subtitle: "Пройди мини-квест за 2-3 минуты и получи свой инвест-профиль.",
    options: ["Погнали"]
  },
  {
    id: "goal",
    title: "Зачем тебе инвестировать?",
    subtitle: "Выбери то, что ближе прямо сейчас.",
    options: ["Сохранить", "Приумножить", "Пассивный доход"]
  },
  {
    id: "horizon",
    title: "На какой срок смотришь?",
    subtitle: "Это влияет на подход к риску.",
    options: ["до 1 года", "1-3 года", "3+ года"]
  },
  {
    id: "myth",
    title: "Миф или факт?",
    subtitle: "«В фонды недвижимости можно зайти только с миллионами».",
    options: ["Миф", "Факт"]
  },
  {
    id: "scenario",
    title: "Ситуация",
    subtitle: "Рынок просел на 8%. Что ты сделаешь?",
    options: ["Выйду сразу", "Сверю цель и горизонт"]
  }
];

function getProfile(answers: Record<string, string>): string {
  const goal = answers.goal;
  const horizon = answers.horizon;
  const scenario = answers.scenario;

  if (goal === "Сохранить" || horizon === "до 1 года") return "Осторожный";
  if (scenario === "Выйду сразу") return "Импульсивный";
  return "Сбалансированный";
}

export default function App() {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const isFinished = stepIndex >= STORY_STEPS.length;
  const currentStep = STORY_STEPS[stepIndex];
  const progress = Math.round((Math.min(stepIndex + 1, STORY_STEPS.length) / STORY_STEPS.length) * 100);

  function handleAnswer(value: string) {
    if (!currentStep) return;

    setAnswers((prev) => ({ ...prev, [currentStep.id]: value }));
    setStepIndex((prev) => prev + 1);
  }

  function handleRestart() {
    setAnswers({});
    setStepIndex(0);
  }

  return (
    <View activePanel="main">
      <Panel id="main" className="story-panel">
        <PanelHeader className="story-topbar">ЗПИФ Навигатор</PanelHeader>
        <Group header={<Header className="story-group-title">Инвест-сторис</Header>}>
          {!isFinished ? (
            <Div className="story-card">
              <p className="story-progress-label">Шаг {stepIndex + 1} из {STORY_STEPS.length} · {progress}%</p>
              <div className="story-progress-track">
                <div className="story-progress-value" style={{ width: `${progress}%` }} />
              </div>

              <h3 className="story-title">{currentStep.title}</h3>
              <p className="story-subtitle">{currentStep.subtitle}</p>

              {currentStep.options?.map((option) => (
                <div key={option} className="story-option-row">
                  <Button stretched size="l" mode="secondary" className="story-option-btn" onClick={() => handleAnswer(option)}>
                    {option}
                  </Button>
                </div>
              ))}
            </Div>
          ) : (
            <Div className="story-card story-result-card">
              <h3 className="story-title">Готово! Твой профиль: {getProfile(answers)}</h3>
              <p className="story-subtitle">
                Ты прошла быстрый квест и получила базовый профиль. Дальше можем сделать персональный мини-план.
              </p>
              <SimpleCell subtitle="Награда" className="story-reward">
                +10 XP · Бейдж «Первые шаги»
              </SimpleCell>
              <div className="story-option-row">
                <Button stretched size="l" className="story-primary-btn" onClick={handleRestart}>
                  Пройти еще раз
                </Button>
              </div>
            </Div>
          )}
        </Group>
      </Panel>
    </View>
  );
}
