from fastapi import APIRouter

router = APIRouter(prefix="/reporting", tags=["reporting"])


@router.get("/health")
async def health():
    return {"module": "reporting", "status": "ok"}
