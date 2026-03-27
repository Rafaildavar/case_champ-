from __future__ import annotations

import json
import os
from urllib.parse import urlencode
from urllib.request import urlopen

from fastapi import APIRouter, Request, Response, status
from fastapi.responses import PlainTextResponse

router = APIRouter()

VK_API_VERSION = os.getenv("VK_API_VERSION", "5.199")
VK_GROUP_TOKEN = os.getenv("VK_GROUP_TOKEN", "")
VK_CONFIRMATION_CODE = os.getenv("VK_CONFIRMATION_CODE", "")
VK_SECRET = os.getenv("VK_SECRET", "")


def _vk_send_message(user_id: int, text: str) -> None:
    if not VK_GROUP_TOKEN:
        return

    payload = urlencode(
        {
            "user_id": user_id,
            "random_id": 0,
            "message": text,
            "access_token": VK_GROUP_TOKEN,
            "v": VK_API_VERSION,
        }
    ).encode("utf-8")

    with urlopen("https://api.vk.com/method/messages.send", data=payload, timeout=10) as response:
        raw = response.read().decode("utf-8")
        parsed = json.loads(raw)
        if parsed.get("error"):
            raise RuntimeError(f"VK API error: {parsed['error']}")


@router.post("/callback")
async def vk_callback(request: Request) -> Response:
    body = await request.json()
    event_type = body.get("type")

    if event_type == "confirmation":
        return PlainTextResponse(VK_CONFIRMATION_CODE or "missing_confirmation_code")

    if VK_SECRET:
        incoming_secret = body.get("secret")
        if incoming_secret != VK_SECRET:
            return PlainTextResponse("forbidden", status_code=status.HTTP_403_FORBIDDEN)

    if event_type == "message_new":
        message = body.get("object", {}).get("message", {})
        user_id = message.get("from_id")
        text = str(message.get("text", "")).strip().lower()
        if isinstance(user_id, int) and user_id > 0:
            if text in {"start", "старт", "/start"}:
                _vk_send_message(
                    user_id,
                    "Привет! 👋\n\n"
                    "Хочешь разобраться в инвестициях в недвижимость легко, быстро и без скучных лекций? Тогда ты точно по адресу! 🚀\n\n"
                    "Добро пожаловать в интенсив по ЗПИФ недвижимости. Это короткий челлендж, в котором ты шаг за шагом поймешь, как работает этот инструмент, почему он интересен инвесторам и как сделать свой первый осознанный шаг в теме.\n\n"
                    "Что тебя ждет:\n"
                    "— 7 коротких этапов;\n"
                    "— обучающие видео 🎥;\n"
                    "— полезные материалы 📚;\n"
                    "— тесты после каждого этапа ✅;\n"
                    "— награда за прохождение до конца 🎁\n\n"
                    "Но есть важное правило: пройти интенсив можно только последовательно, а на весь путь у тебя будет 3 жизни ❤️❤️❤️\n"
                    "Поэтому лучше сразу понять правила, чтобы не терять прогресс!\n\n"
                    "Сейчас посмотри короткое стартовое видео — в нем мы быстро и понятно расскажем:\n"
                    "зачем нужен этот интенсив, как он устроен, по каким правилам проходит и что ты получишь в финале.\n\n"
                    "Жми и начинай! 🔥",
                )
            elif text in {"правила", "/rules"}:
                _vk_send_message(
                    user_id,
                    "Правила: 7 этапов, каждый открывается по графику, дедлайн 24 часа, при пропуске можно потерять жизнь.",
                )
            else:
                _vk_send_message(
                    user_id,
                    "Команды: Старт, Правила. Дальше подключим персональные пуши по прогрессу.",
                )

    return PlainTextResponse("ok")
