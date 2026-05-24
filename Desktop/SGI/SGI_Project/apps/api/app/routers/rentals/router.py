from fastapi import APIRouter

router = APIRouter(prefix="/rentals", tags=["rentals"])


@router.get("/health")
async def health():
    return {"module": "rentals", "status": "ok"}
