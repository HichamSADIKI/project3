# Skill : fastapi-patterns
# FastAPI — Patterns & Architecture Backend SGI

## Quand charger ce skill

- Création d'un nouveau module API
- Écriture d'un endpoint, middleware ou dépendance
- Debug d'un problème async ou de performance
- Implémentation d'un background task Celery

---

## Structure d'un module (pattern uniforme)

```
apps/api/app/routers/{module}/
  __init__.py
  router.py        # Endpoints · auth + tenant pre-handlers
  schemas.py       # Pydantic v2 input/output
  service.py       # Logique métier · toujours filtrer company_id
  models.py        # SQLAlchemy models si spécifiques au module
  test_{module}.py # pytest-asyncio · fixtures multi-tenant
  CLAUDE.md        # Règles métier du module
```

---

## Router — pattern de référence

```python
# app/routers/{module}/router.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, get_company_id, require_role
from app.routers.{module} import schemas, service

router = APIRouter(prefix="/{module}s", tags=["{Module}"])


@router.get("/", response_model=schemas.PaginatedResponse)
async def list_items(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
    company_id: str = Depends(get_company_id),
):
    items, total = await service.list_items(db, company_id, page, limit)
    return {
        "success": True,
        "data": items,
        "meta": {"total": total, "page": page, "limit": limit},
    }


@router.post("/", response_model=schemas.ItemResponse, status_code=201)
async def create_item(
    payload: schemas.ItemCreate,
    db: AsyncSession = Depends(get_db_session),
    company_id: str = Depends(get_company_id),
    _: None = Depends(require_role("agent", "manager")),
):
    item = await service.create_item(db, company_id, payload)
    return {"success": True, "data": item}


@router.get("/{item_id}", response_model=schemas.ItemResponse)
async def get_item(
    item_id: str,
    db: AsyncSession = Depends(get_db_session),
    company_id: str = Depends(get_company_id),
):
    item = await service.get_item(db, company_id, item_id)
    return {"success": True, "data": item}


@router.patch("/{item_id}", response_model=schemas.ItemResponse)
async def update_item(
    item_id: str,
    payload: schemas.ItemUpdate,
    db: AsyncSession = Depends(get_db_session),
    company_id: str = Depends(get_company_id),
):
    item = await service.update_item(db, company_id, item_id, payload)
    return {"success": True, "data": item}


@router.delete("/{item_id}", status_code=204)
async def delete_item(
    item_id: str,
    db: AsyncSession = Depends(get_db_session),
    company_id: str = Depends(get_company_id),
    _: None = Depends(require_role("manager", "admin")),
):
    await service.soft_delete_item(db, company_id, item_id)
```

---

## Schemas Pydantic v2

```python
# app/routers/{module}/schemas.py
from pydantic import BaseModel, UUID4, Field
from datetime import datetime
from typing import Generic, TypeVar, Any

T = TypeVar("T")

class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: list[T]
    meta: dict[str, int]

class ErrorResponse(BaseModel):
    success: bool = False
    error: dict[str, str]  # {code, message}

class ItemCreate(BaseModel):
    title_ar: str = Field(..., min_length=1, max_length=255)
    title_en: str = Field(..., min_length=1, max_length=255)
    title_fr: str | None = None

class ItemUpdate(BaseModel):
    title_ar: str | None = None
    title_en: str | None = None
    title_fr: str | None = None

class ItemOut(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID4
    title_ar: str
    title_en: str
    title_fr: str | None
    company_id: UUID4
    created_at: datetime
    updated_at: datetime

class ItemResponse(BaseModel):
    success: bool = True
    data: ItemOut
```

---

## SQLAlchemy Model — base commune

```python
# app/models/base.py
import uuid
from datetime import datetime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import DateTime, func

class Base(DeclarativeBase):
    pass

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(),
        onupdate=func.now(), nullable=False
    )

class TenantMixin:
    company_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )

class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
```

---

## Dépendances core

```python
# app/core/deps.py
from fastapi import Depends, Request, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.core.database import async_session_maker
from app.core.auth import decode_jwt

async def get_db() -> AsyncSession:
    async with async_session_maker() as session:
        yield session

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
    async def checker(request: Request):
        user_role = getattr(request.state, "role", None)
        if user_role not in roles:
            raise HTTPException(status_code=403, detail="forbidden")
    return checker
```

---

## Gestion d'erreurs globale

```python
# app/main.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

app = FastAPI()

@app.exception_handler(IntegrityError)
async def integrity_error_handler(request: Request, exc: IntegrityError):
    return JSONResponse(
        status_code=409,
        content={"success": False, "error": {"code": "conflict", "message": str(exc.orig)}},
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "error": {"code": "http_error", "message": exc.detail}},
    )
```

---

## Background tasks Celery (> 500ms)

```python
# app/tasks/notifications.py
from app.worker import celery_app

@celery_app.task(bind=True, max_retries=3, default_retry_delay=60)
def send_whatsapp_message(self, phone: str, template: str, params: dict):
    try:
        # appel API WhatsApp Business
        pass
    except Exception as exc:
        raise self.retry(exc=exc)

# Depuis un endpoint — ne pas awaiter, déléguer à Celery
@router.post("/{lead_id}/notify")
async def notify_lead(lead_id: str, ...):
    send_whatsapp_message.delay(phone, template, params)
    return {"success": True}
```

---

## Anti-patterns

```python
# ❌ Endpoint synchrone avec I/O
@router.get("/items")
def list_items():  # sync = bloque le thread pool
    return db.query(Item).all()

# ❌ await dans une boucle (N+1)
for item_id in ids:
    item = await db.get(Item, item_id)

# ❌ Logique métier dans le router
@router.post("/")
async def create(payload, db):
    item = Item(**payload.dict())  # ← validation métier absente
    db.add(item)
    await db.commit()

# ❌ Traitement lourd dans l'endpoint
@router.post("/export")
async def export_pdf(db, company_id):
    pdf = generate_pdf(...)  # bloque 3s → utiliser Celery
    return pdf
```
