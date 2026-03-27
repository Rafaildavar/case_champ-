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
