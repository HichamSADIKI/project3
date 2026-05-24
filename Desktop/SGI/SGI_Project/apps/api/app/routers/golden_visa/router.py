from fastapi import APIRouter

router = APIRouter(prefix="/golden-visa", tags=["golden_visa"])


@router.get("/health")
async def health():
    return {"module": "golden_visa", "status": "ok"}
