from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.bot import router as bot_router
from app.api.lessons import router as lessons_router
from app.api.users import router as users_router
from app.api.vk_callback import router as vk_callback_router

app = FastAPI(title="VK RealEstate Learn API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(users_router, prefix="/api/v1/users", tags=["users"])
app.include_router(lessons_router, prefix="/api/v1/lessons", tags=["lessons"])
app.include_router(bot_router, prefix="/api/v1/bot", tags=["bot"])
app.include_router(vk_callback_router, prefix="/api/v1/vk", tags=["vk"])
