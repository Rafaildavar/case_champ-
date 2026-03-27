import { useState } from "react";
import { Button, Div, Group, Header, Panel, PanelHeader, View } from "@vkontakte/vkui";
import "./App.css";

const CARD_OPTIONS = [
  "Откладывать регулярно и оценивать горизонт",
  "Войти сразу на всю сумму из-за FOMO",
  "Не начинать, потому что слишком сложно"
];

export default function App() {
  const [selected, setSelected] = useState<string | null>(null);
  const isCorrect = selected === CARD_OPTIONS[0];

  return (
    <View activePanel="main">
      <Panel id="main" className="story-panel">
        <PanelHeader className="story-topbar">ЗПИФ Навигатор</PanelHeader>
        <Group header={<Header className="story-group-title">Карточка дня</Header>}>
          <Div className="story-card">
            <div className="story-chip-row">
              <span className="story-chip">~45 секунд</span>
              <span className="story-chip story-chip-ghost">+3 XP</span>
            </div>

            <h3 className="story-title">Какой старт лучше для новичка в фондах недвижимости?</h3>
            <p className="story-subtitle">
              Выбери действие. Формат как в Duolingo: один быстрый выбор и короткая обратная связь.
            </p>

            {CARD_OPTIONS.map((option) => (
              <div key={option} className="story-option-row">
                <Button
                  stretched
                  size="l"
                  mode="secondary"
                  className={`story-option-btn ${selected === option ? "story-option-btn-active" : ""}`}
                  onClick={() => setSelected(option)}
                >
                  {option}
                </Button>
              </div>
            ))}

            {selected ? (
              <div className={`story-feedback ${isCorrect ? "story-feedback-ok" : "story-feedback-warn"}`}>
                {isCorrect
                  ? "Отлично! Регулярность + горизонт обычно лучше импульсивных решений."
                  : "Неплохая попытка. Подумай о регулярности и долгосрочном подходе."}
              </div>
            ) : null}

            <div className="story-footer-row">
              <Button stretched size="l" className="story-primary-btn">
                Следующая карточка
              </Button>
            </div>
          </Div>
        </Group>
      </Panel>
    </View>
  );
}
