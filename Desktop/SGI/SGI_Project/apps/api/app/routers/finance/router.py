from fastapi import APIRouter

router = APIRouter(prefix="/finance", tags=["finance"])


@router.get("/health")
async def health():
    return {"module": "finance", "status": "ok"}
