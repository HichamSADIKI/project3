from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from app.core.config import settings

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def encode_jwt(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    payload = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(hours=settings.JWT_ACCESS_EXPIRE_HOURS)
    )
    payload["exp"] = expire
    payload["iat"] = datetime.now(timezone.utc)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def decode_jwt(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise ValueError("invalid_token") from exc
