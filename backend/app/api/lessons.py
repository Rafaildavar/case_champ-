from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class LessonSummary(BaseModel):
    id: str
    title: str
    order: int
    is_completed: bool


class ContentBlock(BaseModel):
    type: str
    value: str


class LessonDetail(BaseModel):
    id: str
    title: str
    content_blocks: list[ContentBlock]


LESSONS = [
    {
        "id": "l1",
        "title": "Фонды недвижимости: база",
        "order": 1,
        "content_blocks": [
            {"type": "text", "value": "Фонд недвижимости объединяет капитал инвесторов в объекты."},
            {"type": "note", "value": "Доходность может меняться, гарантий нет."},
        ],
    },
    {
        "id": "l2",
        "title": "Что такое ЗПИФ",
        "order": 2,
        "content_blocks": [
            {"type": "text", "value": "ЗПИФ - закрытый паевой инвестиционный фонд с ограничениями выхода."},
            {"type": "note", "value": "Важно учитывать ликвидность и правила фонда."},
        ],
    },
    {
        "id": "l3",
        "title": "Риск, комиссии, ликвидность",
        "order": 3,
        "content_blocks": [
            {"type": "text", "value": "Комиссии и ликвидность влияют на итоговый результат."},
            {"type": "note", "value": "Сравнивайте условия перед выбором инструмента."},
        ],
    },
]


@router.get("", response_model=list[LessonSummary])
def list_lessons() -> list[LessonSummary]:
    return [
        LessonSummary(id=lesson["id"], title=lesson["title"], order=lesson["order"], is_completed=False)
        for lesson in LESSONS
    ]


@router.get("/{lesson_id}", response_model=LessonDetail)
def get_lesson(lesson_id: str) -> LessonDetail:
    lesson = next((item for item in LESSONS if item["id"] == lesson_id), None)
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found")
    return LessonDetail(
        id=lesson["id"],
        title=lesson["title"],
        content_blocks=[ContentBlock(**block) for block in lesson["content_blocks"]],
    )
