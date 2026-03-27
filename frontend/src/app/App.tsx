import { useEffect, useState } from "react";
import bridge from "@vkontakte/vk-bridge";
import {
  Button,
  Div,
  FormItem,
  Group,
  Header,
  Panel,
  PanelHeader,
  Select,
  SimpleCell,
  Spinner,
  View
} from "@vkontakte/vkui";
import { apiClient } from "../api/client";

type VkUser = {
  id: number;
  first_name: string;
  last_name: string;
};

export default function App() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<VkUser | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [consentAccepted, setConsentAccepted] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [experience, setExperience] = useState("none");
  const [goal, setGoal] = useState("learn");
  const [horizon, setHorizon] = useState("1_3_years");
  const [lessons, setLessons] = useState<Array<{ id: string; title: string; order: number }>>([]);

  useEffect(() => {
    async function init() {
      try {
        await bridge.send("VKWebAppInit");
        const vkUser = await bridge.send("VKWebAppGetUserInfo");
        setUser(vkUser);
        const upsert = await apiClient.upsertUser({
          vk_id: String(vkUser.id),
          first_name: vkUser.first_name,
          last_name: vkUser.last_name
        });
        setUserId(upsert.user_id);
        setConsentAccepted(upsert.consent_accepted);
      } catch (error) {
        console.error("VK init failed", error);
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, []);

  async function handleConsent() {
    if (!userId) return;
    const result = await apiClient.saveConsent({ user_id: userId, accepted: true });
    if (result.ok) setConsentAccepted(true);
  }

  async function handleOnboarding() {
    if (!userId) return;
    const result = await apiClient.saveOnboarding({ user_id: userId, experience, goal, horizon });
    if (result.ok) {
      setOnboardingDone(true);
      const lessonList = await apiClient.listLessons();
      setLessons(lessonList);
    }
  }

  return (
    <View activePanel="main">
      <Panel id="main">
        <PanelHeader>RealEstate Learn</PanelHeader>
        <Group header={<Header>Старт MVP</Header>}>
          {loading ? (
            <Div>
              <Spinner size="m" />
            </Div>
          ) : !consentAccepted ? (
            <Div>
              <p>Это образовательный продукт, не инвестиционная рекомендация.</p>
              <Button stretched size="l" onClick={() => void handleConsent()}>
                Принимаю условия
              </Button>
            </Div>
          ) : !onboardingDone ? (
            <Div>
              <FormItem top="Опыт">
                <Select
                  value={experience}
                  onChange={(event) => setExperience(event.target.value)}
                  options={[
                    { label: "Нет опыта", value: "none" },
                    { label: "Базовый", value: "basic" },
                    { label: "Есть опыт", value: "advanced" }
                  ]}
                />
              </FormItem>
              <FormItem top="Цель">
                <Select
                  value={goal}
                  onChange={(event) => setGoal(event.target.value)}
                  options={[
                    { label: "Изучить тему", value: "learn" },
                    { label: "Сохранить капитал", value: "preserve" },
                    { label: "Рост капитала", value: "grow" }
                  ]}
                />
              </FormItem>
              <FormItem top="Горизонт">
                <Select
                  value={horizon}
                  onChange={(event) => setHorizon(event.target.value)}
                  options={[
                    { label: "До 1 года", value: "lt_1_year" },
                    { label: "1-3 года", value: "1_3_years" },
                    { label: "3+ года", value: "gt_3_years" }
                  ]}
                />
              </FormItem>
              <Button stretched size="l" onClick={() => void handleOnboarding()}>
                Сохранить онбординг
              </Button>
            </Div>
          ) : (
            <>
              <SimpleCell subtitle="VK ID авторизация">Пользователь: {user ? `${user.first_name} ${user.last_name}` : "Не получен"}</SimpleCell>
              <SimpleCell subtitle="Список уроков">
                {lessons.length > 0 ? lessons.map((lesson) => `${lesson.order}. ${lesson.title}`).join(" | ") : "Уроки не загружены"}
              </SimpleCell>
            </>
          )}
        </Group>
      </Panel>
    </View>
  );
}
