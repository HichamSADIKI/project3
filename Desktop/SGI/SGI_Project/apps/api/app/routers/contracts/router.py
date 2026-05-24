from fastapi import APIRouter

router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.get("/health")
async def health():
    return {"module": "contracts", "status": "ok"}
