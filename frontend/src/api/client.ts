const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

type UpsertUserPayload = {
  vk_id: string;
  first_name?: string;
  last_name?: string;
};

type ConsentPayload = {
  user_id: string;
  accepted: boolean;
};

type OnboardingPayload = {
  user_id: string;
  experience: string;
  goal: string;
  horizon: string;
};

type LessonSummary = {
  id: string;
  title: string;
  order: number;
  is_completed: boolean;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json"
    },
    ...init
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  upsertUser(payload: UpsertUserPayload) {
    return request<{ user_id: string; vk_id: string; consent_accepted: boolean }>("/users/upsert", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  saveConsent(payload: ConsentPayload) {
    return request<{ ok: boolean }>("/users/consent", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  saveOnboarding(payload: OnboardingPayload) {
    return request<{ ok: boolean }>("/users/onboarding", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  listLessons() {
    return request<LessonSummary[]>("/lessons");
  },

  listMarathons() {
    return request<ApiMarathon[]>("/marathons");
  },

  createMarathon(payload: CreateMarathonPayload) {
    return request<ApiMarathon>("/marathons", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  }
};

export type ApiMarathonTopic = {
  id: string;
  title: string;
  task_types: ApiTaskType[] | null;
};

export type ApiTaskType = "video" | "test" | "practice" | "matching" | "calculator";

export type ApiMarathon = {
  id: string;
  title: string;
  description: string;
  status: "open" | "closed";
  mode: "regular" | "test";
  start_at_iso: string;
  unlock_interval_hours: number;
  topic_window_hours: number;
  topics: ApiMarathonTopic[];
};

export type CreateMarathonPayload = {
  title: string;
  description?: string;
  status?: "open" | "closed";
  mode?: "regular" | "test";
  start_at_iso: string;
  topic_titles: string[];
  unlock_interval_hours?: number;
  topic_window_hours?: number;
};
