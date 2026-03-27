import { useState } from "react";
import { Button, Div, Group, Header, Panel, PanelHeader, SimpleCell, View } from "@vkontakte/vkui";

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
      <Panel id="main">
        <PanelHeader>ЗПИФ Навигатор</PanelHeader>
        <Group header={<Header>Инвест-сторис</Header>}>
          {!isFinished ? (
            <Div>
              <p style={{ opacity: 0.8, marginBottom: 12 }}>Шаг {stepIndex + 1} из {STORY_STEPS.length} · {progress}%</p>
              <h3 style={{ marginTop: 0 }}>{currentStep.title}</h3>
              <p style={{ marginBottom: 16 }}>{currentStep.subtitle}</p>

              {currentStep.options?.map((option) => (
                <div key={option} style={{ marginBottom: 8 }}>
                  <Button stretched size="l" mode="secondary" onClick={() => handleAnswer(option)}>
                    {option}
                  </Button>
                </div>
              ))}
            </Div>
          ) : (
            <Div>
              <h3 style={{ marginTop: 0 }}>Готово! Твой профиль: {getProfile(answers)}</h3>
              <p style={{ marginBottom: 16 }}>
                Ты прошла быстрый квест и получила базовый профиль. Дальше можем сделать персональный мини-план.
              </p>
              <SimpleCell subtitle="Награда">+10 XP · Бейдж «Первые шаги»</SimpleCell>
              <div style={{ marginTop: 12 }}>
                <Button stretched size="l" onClick={handleRestart}>
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
