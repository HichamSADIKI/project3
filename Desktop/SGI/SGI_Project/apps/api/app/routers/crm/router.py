from fastapi import APIRouter

router = APIRouter(prefix="/crm", tags=["crm"])


@router.get("/health")
async def health():
    return {"module": "crm", "status": "ok"}
