from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

# In-memory storage for MVP bootstrap. Replace with PostgreSQL in next step.
USERS_BY_VK_ID: dict[str, dict] = {}


class UpsertUserRequest(BaseModel):
    vk_id: str
    first_name: str | None = None
    last_name: str | None = None


class UpsertUserResponse(BaseModel):
    user_id: str
    vk_id: str
    consent_accepted: bool


@router.post("/upsert", response_model=UpsertUserResponse)
def upsert_user(payload: UpsertUserRequest) -> UpsertUserResponse:
    existing = USERS_BY_VK_ID.get(payload.vk_id)

    if existing:
        return UpsertUserResponse(
            user_id=existing["user_id"],
            vk_id=payload.vk_id,
            consent_accepted=existing["consent_accepted"],
        )

    new_user = {
        "user_id": str(uuid4()),
        "vk_id": payload.vk_id,
        "first_name": payload.first_name,
        "last_name": payload.last_name,
        "consent_accepted": False,
    }
    USERS_BY_VK_ID[payload.vk_id] = new_user
    return UpsertUserResponse(
        user_id=new_user["user_id"],
        vk_id=new_user["vk_id"],
        consent_accepted=new_user["consent_accepted"],
    )


class ConsentRequest(BaseModel):
    user_id: str
    accepted: bool


@router.post("/consent")
def save_consent(payload: ConsentRequest) -> dict[str, bool]:
    for user in USERS_BY_VK_ID.values():
        if user["user_id"] == payload.user_id:
            user["consent_accepted"] = payload.accepted
            return {"ok": True}
    return {"ok": False}


class OnboardingRequest(BaseModel):
    user_id: str
    experience: str
    goal: str
    horizon: str


@router.post("/onboarding")
def save_onboarding(payload: OnboardingRequest) -> dict[str, bool]:
    for user in USERS_BY_VK_ID.values():
        if user["user_id"] == payload.user_id:
            user["onboarding"] = {
                "experience": payload.experience,
                "goal": payload.goal,
                "horizon": payload.horizon,
            }
            return {"ok": True}
    return {"ok": False}
