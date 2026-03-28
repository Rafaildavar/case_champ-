from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()

# In-memory storage for MVP. Replace with PostgreSQL when needed.
MARATHONS: dict[str, dict] = {}


class MarathonTopicIn(BaseModel):
    title: str
    task_types: list[str] | None = None


class CreateMarathonRequest(BaseModel):
    title: str
    description: str = ""
    status: str = Field(default="open", pattern="^(open|closed)$")
    mode: str = Field(default="regular", pattern="^(regular|test)$")
    start_at_iso: str
    topic_titles: list[str] = Field(min_length=1)
    unlock_interval_hours: float = Field(default=24, gt=0)
    topic_window_hours: float = Field(default=24, gt=0)


class MarathonTopicOut(BaseModel):
    id: str
    title: str
    task_types: list[str] | None = None


class MarathonOut(BaseModel):
    id: str
    title: str
    description: str
    status: str
    mode: str
    start_at_iso: str
    unlock_interval_hours: float
    topic_window_hours: float
    topics: list[MarathonTopicOut]


def _topic_id(marathon_id: str, index: int) -> str:
    return f"{marathon_id}-t{index + 1}"


def _to_out(row: dict) -> MarathonOut:
    return MarathonOut(
        id=row["id"],
        title=row["title"],
        description=row["description"],
        status=row["status"],
        mode=row["mode"],
        start_at_iso=row["start_at_iso"],
        unlock_interval_hours=row["unlock_interval_hours"],
        topic_window_hours=row["topic_window_hours"],
        topics=[
            MarathonTopicOut(
                id=t["id"],
                title=t["title"],
                task_types=t.get("task_types"),
            )
            for t in row["topics"]
        ],
    )


def _seed_one_day_marathon() -> None:
    mid = "m-one-day"
    if mid in MARATHONS:
        return
    MARATHONS[mid] = {
        "id": mid,
        "title": "MVP: один день марафона",
        "description": (
            "Интенсив ЗПИФ: один учебный день, 4 этапа подряд, 3 жизни, тест от 65%, "
            "24 ч на этап с момента открытия. В конце — награда (паи после условий), клуб, сертификат. Демо: даты условные."
        ),
        "status": "open",
        "mode": "regular",
        "start_at_iso": "2026-03-28T06:00:00.000Z",
        "unlock_interval_hours": 2.0,
        "topic_window_hours": 8.0,
        "topics": [
            {"id": _topic_id(mid, 0), "title": "День 1 · Утро: что такое ЗПИФ", "task_types": None},
            {"id": _topic_id(mid, 1), "title": "День 1 · День: риски и горизонт", "task_types": None},
            {"id": _topic_id(mid, 2), "title": "День 1 · Вечер: дисциплина и план", "task_types": None},
            {"id": _topic_id(mid, 3), "title": "День 1 · Финиш: мини-кейс", "task_types": None},
        ],
    }


_seed_one_day_marathon()


@router.get("", response_model=list[MarathonOut])
def list_marathons() -> list[MarathonOut]:
    return [_to_out(row) for row in MARATHONS.values()]


@router.post("", response_model=MarathonOut)
def create_marathon(payload: CreateMarathonRequest) -> MarathonOut:
    mid = f"m-{uuid4().hex[:12]}"
    topics: list[dict] = []
    for i, title in enumerate(payload.topic_titles):
        topics.append({"id": _topic_id(mid, i), "title": title.strip(), "task_types": None})

    row = {
        "id": mid,
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "status": payload.status,
        "mode": payload.mode,
        "start_at_iso": payload.start_at_iso,
        "unlock_interval_hours": float(payload.unlock_interval_hours),
        "topic_window_hours": float(payload.topic_window_hours),
        "topics": topics,
    }
    MARATHONS[mid] = row
    return _to_out(row)
