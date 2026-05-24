import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt
from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.routers.auth.schemas import LoginRequest, TokenResponse, UserMe
from app.routers.auth.service import authenticate

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    user = await authenticate(db, body.email, body.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid_credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = encode_jwt(
        {
            "sub": str(user.id),
            "company_id": str(user.company_id),
            "role": user.role,
            "email": user.email,
        }
    )
    return TokenResponse(
        access_token=token,
        expires_in=settings.JWT_ACCESS_EXPIRE_HOURS * 3600,
    )


@router.get("/me", response_model=UserMe)
async def me(request: Request, db: AsyncSession = Depends(get_db)) -> UserMe:
    user_id = getattr(request.state, "user_id", None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="not_authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id), User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="user_not_found")
    return UserMe.model_validate(user)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "auth", "status": "ok"}
