from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.lessons import router as lessons_router
from app.api.users import router as users_router

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
