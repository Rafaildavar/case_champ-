import { useMemo, useState } from "react";
import { Button, Div, Group, Header, Panel, PanelHeader, View } from "@vkontakte/vkui";
import "./App.css";

const CARD_OPTIONS = [
  "Регулярные взносы",
  "Оценка горизонта",
  "Случайный импульсивный вход",
  "Игнорировать риски",
  "Покупка на весь капитал сразу"
];
const CORRECT_OPTIONS = new Set(["Регулярные взносы", "Оценка горизонта"]);

export default function App() {
  const [selected, setSelected] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const isPerfect = useMemo(() => {
    if (selected.length !== CORRECT_OPTIONS.size) return false;
    return selected.every((item) => CORRECT_OPTIONS.has(item));
  }, [selected]);

  function toggleOption(option: string) {
    if (submitted) return;
    setSelected((prev) => (prev.includes(option) ? prev.filter((item) => item !== option) : [...prev, option]));
  }

  function resetCard() {
    setSelected([]);
    setSubmitted(false);
  }

  function getOptionClass(option: string): string {
    if (!submitted) return "quiz-option";
    if (CORRECT_OPTIONS.has(option)) return "quiz-option quiz-option-correct";
    if (selected.includes(option) && !CORRECT_OPTIONS.has(option)) return "quiz-option quiz-option-wrong";
    return "quiz-option quiz-option-muted";
  }

  return (
    <View activePanel="main">
      <Panel id="main" className="story-panel">
        <PanelHeader className="story-topbar">ЗПИФ Навигатор</PanelHeader>
        <Group header={<Header className="story-group-title">Карточка дня</Header>}>
          <Div className="duo-card">
            <div className="duo-head">
              <button className="duo-close" type="button" aria-label="Закрыть">
                ×
              </button>
              <div className="duo-progress-track">
                <div className="duo-progress-value" style={{ width: "60%" }} />
              </div>
              <div className="duo-xp">20</div>
            </div>

            <h3 className="duo-title">Выбери 2 действия, которые подходят новичку</h3>
            <p className="duo-subtitle">Формат как в Duolingo: быстрый выбор и понятная обратная связь.</p>

            {CARD_OPTIONS.map((option) => (
              <div key={option} className="duo-option-row">
                <button type="button" className={`${getOptionClass(option)} ${selected.includes(option) ? "quiz-option-selected" : ""}`} onClick={() => toggleOption(option)}>
                  {option}
                </button>
              </div>
            ))}

            <div className="duo-footer">
              {!submitted ? (
                <Button stretched size="l" className="duo-cta duo-cta-neutral" disabled={selected.length === 0} onClick={() => setSubmitted(true)}>
                  Проверить
                </Button>
              ) : (
                <Button stretched size="l" className={`duo-cta ${isPerfect ? "duo-cta-success" : "duo-cta-danger"}`} onClick={resetCard}>
                  {isPerfect ? "Продолжить" : "Понятно"}
                </Button>
              )}
            </div>

            {submitted ? (
              <div className={`duo-feedback ${isPerfect ? "duo-feedback-ok" : "duo-feedback-bad"}`}>
                <div className="duo-feedback-title">{isPerfect ? "Отлично!" : "Продолжай практиковаться"}</div>
                <div className="duo-feedback-text">
                  {isPerfect
                    ? "Ты выбрала правильную базовую стратегию для старта."
                    : "Верные варианты: регулярные взносы и оценка горизонта."}
                </div>
              </div>
            ) : (
              <div className="duo-feedback duo-feedback-placeholder">
                Отметь варианты и нажми «Проверить».
              </div>
            )}

            <div className="story-footer-row">
              <Button stretched size="l" className="story-primary-btn">
                Следующая карточка в ленте
              </Button>
            </div>
          </Div>
        </Group>
      </Panel>
    </View>
  );
}
