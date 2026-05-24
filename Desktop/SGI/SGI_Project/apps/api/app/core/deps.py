from fastapi import Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db


async def get_company_id(request: Request) -> str:
    company_id = getattr(request.state, "company_id", None)
    if not company_id:
        raise HTTPException(status_code=401, detail="tenant_required")
    return company_id


async def get_db_session(
    db: AsyncSession = Depends(get_db),
    company_id: str = Depends(get_company_id),
) -> AsyncSession:
    await db.execute(
        text("SELECT set_config('app.current_company_id', :cid, true)"),
        {"cid": company_id},
    )
    yield db


def require_role(*roles: str):
    async def checker(request: Request) -> None:
        user_role = getattr(request.state, "role", None)
        if user_role not in roles:
            raise HTTPException(status_code=403, detail="forbidden")
    return checker
