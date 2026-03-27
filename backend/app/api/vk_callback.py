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
                    "Привет! Это бот интенсива по инвестициям. Я помогу пройти этапы и дойти до финальной награды.",
                )
                _vk_send_message(
                    user_id,
                    "Правила: каждый этап доступен 24 часа, новая тема раз в сутки, у тебя 3 жизни.",
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
