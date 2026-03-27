# VK RealEstate Learn (MVP)

Мини-приложение VK для обучения инвестициям в фонды недвижимости и ЗПИФ.

## Структура

- `frontend` - React + TypeScript + VKUI + vk-bridge
- `backend` - FastAPI

## Быстрый старт

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Если бэкенд запущен на нестандартном URL, укажи `VITE_API_URL`.

## VK-бот (API)

Добавлены эндпоинты MVP-логики коммуникаций:

- `POST /api/v1/bot/event` — отправка сообщений по событию (открытие этапа, пройден тест, сгорание жизни и т.д.).
- `POST /api/v1/bot/tick` — тайминговые пуши (мягкий реактивационный пуш при бездействии и предупреждение перед дедлайном).

Особенности:

- 4 типа сообщений: `service`, `motivational`, `educational`, `reactivation`;
- защита от спама: лимит `4` сообщения в сутки на пользователя;
- дедупликация одинаковых пушей по ключу причины (чтобы не отправлять одно и то же повторно).

### Подключение Callback API VK

1. Скопируй `backend/.env.example` в `backend/.env` и заполни значения:
   - `VK_GROUP_TOKEN`
   - `VK_CONFIRMATION_CODE`
   - `VK_SECRET`
   - `VK_API_VERSION`
2. Запусти backend:

```bash
cd backend
uvicorn app.main:app --reload --port 8000
```

3. Пробрось локальный backend наружу (например, ngrok):

```bash
ngrok http 8000
```

4. В настройках Callback API VK укажи адрес:
   - `https://<твой-ngrok-домен>/api/v1/vk/callback`

5. Нажми "Подтвердить". Сервер вернет `VK_CONFIRMATION_CODE`.

После подтверждения события `message_new` будут приходить в backend, и бот начнет отвечать на команды `Старт` и `Правила`.
