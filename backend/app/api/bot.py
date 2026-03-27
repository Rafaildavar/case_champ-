from __future__ import annotations

from datetime import datetime, timedelta, timezone
from enum import Enum
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter()


class MessageType(str, Enum):
    service = "service"
    motivational = "motivational"
    educational = "educational"
    reactivation = "reactivation"


class BotEvent(str, Enum):
    stage_opened = "stage_opened"
    test_passed = "test_passed"
    next_day_opened = "next_day_opened"
    lives_low = "lives_low"
    deadline_soon = "deadline_soon"
    life_burned = "life_burned"
    stage_completed = "stage_completed"
    final_reward = "final_reward"


class BotStatePayload(BaseModel):
    user_id: str
    current_stage: int = Field(ge=1)
    total_stages: int = Field(default=7, ge=1)
    lives: int = Field(default=3, ge=0)
    deadline_at_iso: str
    last_activity_at_iso: str
    days_to_reward: int = Field(default=0, ge=0)


class EventRequest(BotStatePayload):
    event: BotEvent


class TickRequest(BotStatePayload):
    pass


class OutboundMessage(BaseModel):
    id: str
    message_type: MessageType
    text: str
    reason: str


class BotResponse(BaseModel):
    sent: int
    skipped_by_limit: int
    messages: list[OutboundMessage]


DAILY_LIMIT = 4
SOFT_INACTIVITY_HOURS = 6
DEADLINE_WARNING_HOURS = 3

SENT_LOG_BY_USER: dict[str, list[datetime]] = {}
SENT_KEYS_BY_USER: dict[str, set[str]] = {}


def parse_iso(raw: str) -> datetime:
    normalized = raw.replace("Z", "+00:00")
    return datetime.fromisoformat(normalized).astimezone(timezone.utc)


def _today_count(user_id: str, now: datetime) -> int:
    sent = SENT_LOG_BY_USER.get(user_id, [])
    start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return sum(1 for timestamp in sent if timestamp >= start_of_day)


def _can_send(user_id: str, now: datetime) -> bool:
    return _today_count(user_id, now) < DAILY_LIMIT


def _mark_sent(user_id: str, now: datetime) -> None:
    SENT_LOG_BY_USER.setdefault(user_id, []).append(now)


def _already_sent(user_id: str, key: str) -> bool:
    return key in SENT_KEYS_BY_USER.get(user_id, set())


def _mark_sent_key(user_id: str, key: str) -> None:
    SENT_KEYS_BY_USER.setdefault(user_id, set()).add(key)


def _build_event_messages(payload: EventRequest) -> list[tuple[MessageType, str, str]]:
    stage = payload.current_stage
    total = payload.total_stages
    to_reward = payload.days_to_reward

    if payload.event == BotEvent.stage_opened:
        return [
            (
                MessageType.service,
                f"Этап {stage} открыт. У тебя 24 часа на прохождение.",
                f"stage_opened:{stage}",
            ),
            (
                MessageType.educational,
                "Следующий этап дает практический навык: ты поймешь, как оценивать решения ближе к реальному инвестированию.",
                f"educational_stage:{stage}",
            ),
            (
                MessageType.motivational,
                f"Ты уже прошел {max(stage - 1, 0)} из {total}. До награды осталось {to_reward} дн.",
                f"progress_stage:{stage}",
            ),
        ]

    if payload.event == BotEvent.test_passed:
        return [
            (
                MessageType.service,
                "Тест пройден. Отличная работа, прогресс сохранен.",
                f"test_passed:{stage}",
            )
        ]

    if payload.event == BotEvent.next_day_opened:
        return [
            (
                MessageType.service,
                "Доступен следующий день интенсива. Можно продолжать.",
                f"next_day:{stage}",
            ),
            (
                MessageType.motivational,
                "Ты держишь темп лучше, чем большинство участников.",
                f"pace:{stage}",
            ),
        ]

    if payload.event == BotEvent.lives_low:
        return [
            (
                MessageType.service,
                f"Осталось {payload.lives} {'жизнь' if payload.lives == 1 else 'жизни'}.",
                f"lives_low:{payload.lives}:{stage}",
            )
        ]

    if payload.event == BotEvent.deadline_soon:
        return [
            (
                MessageType.service,
                "Время до дедлайна истекает. Заверши этап, чтобы не потерять жизнь.",
                f"deadline_soon:{stage}",
            ),
            (
                MessageType.reactivation,
                "До потери жизни осталось немного времени. Вернись, чтобы сохранить прогресс.",
                f"reactivation_deadline:{stage}",
            ),
        ]

    if payload.event == BotEvent.life_burned:
        return [
            (
                MessageType.service,
                "Одна жизнь сгорела. Продолжай, чтобы не прервать интенсив.",
                f"life_burned:{stage}",
            ),
            (
                MessageType.reactivation,
                "Интенсив почти прерван. Вернись и закрой этап, чтобы сохранить прогресс.",
                f"reactivation_life_burned:{stage}",
            ),
        ]

    if payload.event == BotEvent.stage_completed:
        return [
            (
                MessageType.service,
                f"Поздравляем! Этап {stage} успешно пройден.",
                f"stage_completed:{stage}",
            ),
            (
                MessageType.motivational,
                f"До финальной награды осталось {to_reward} дн. Ты на верном пути.",
                f"reward_distance:{stage}",
            ),
        ]

    if payload.event == BotEvent.final_reward:
        return [
            (
                MessageType.service,
                "Финальная награда достигнута. Ты прошел весь интенсив!",
                "final_reward",
            ),
            (
                MessageType.motivational,
                "Поздравляем! Ты довел обучение до результата.",
                "final_reward_motivation",
            ),
        ]

    return []


def _build_time_messages(payload: TickRequest, now: datetime) -> list[tuple[MessageType, str, str]]:
    messages: list[tuple[MessageType, str, str]] = []
    last_activity = parse_iso(payload.last_activity_at_iso)
    deadline_at = parse_iso(payload.deadline_at_iso)
    inactive_for = now - last_activity
    until_deadline = deadline_at - now

    if inactive_for >= timedelta(hours=SOFT_INACTIVITY_HOURS):
        messages.append(
            (
                MessageType.reactivation,
                "Мы сохранили твой прогресс. Вернись и продолжи этап в удобный момент.",
                f"soft_inactivity:{payload.current_stage}",
            )
        )

    if timedelta(0) < until_deadline <= timedelta(hours=DEADLINE_WARNING_HOURS):
        messages.append(
            (
                MessageType.service,
                "До конца 24-часового окна осталось мало времени.",
                f"deadline_warning:{payload.current_stage}",
            )
        )

    return messages


def _dispatch(
    user_id: str, now: datetime, drafts: list[tuple[MessageType, str, str]]
) -> BotResponse:
    sent: list[OutboundMessage] = []
    skipped = 0

    for message_type, text, reason_key in drafts:
        if _already_sent(user_id, reason_key):
            continue
        if not _can_send(user_id, now):
            skipped += 1
            continue
        sent.append(
            OutboundMessage(
                id=str(uuid4()),
                message_type=message_type,
                text=text,
                reason=reason_key,
            )
        )
        _mark_sent(user_id, now)
        _mark_sent_key(user_id, reason_key)

    return BotResponse(sent=len(sent), skipped_by_limit=skipped, messages=sent)


@router.post("/event", response_model=BotResponse)
def push_by_event(payload: EventRequest) -> BotResponse:
    now = datetime.now(timezone.utc)
    drafts = _build_event_messages(payload)
    return _dispatch(payload.user_id, now, drafts)


@router.post("/tick", response_model=BotResponse)
def push_by_time(payload: TickRequest) -> BotResponse:
    now = datetime.now(timezone.utc)
    drafts = _build_time_messages(payload, now)
    return _dispatch(payload.user_id, now, drafts)
