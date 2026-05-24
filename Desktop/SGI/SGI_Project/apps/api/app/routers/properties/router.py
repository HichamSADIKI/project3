from fastapi import APIRouter

router = APIRouter(prefix="/properties", tags=["properties"])


@router.get("/health")
async def health():
    return {"module": "properties", "status": "ok"}
