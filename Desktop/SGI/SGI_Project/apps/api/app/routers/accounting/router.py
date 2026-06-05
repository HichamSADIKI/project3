"""Router FastAPI — Comptabilité (plan comptable + grand-livre)."""

import uuid
from collections.abc import Awaitable, Callable
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.accounting.schemas import (
    AccountCreate,
    AccountDetailOut,
    AccountListOut,
    AccountOut,
    JournalEntryCreate,
    JournalEntryDetailOut,
    JournalEntryListItem,
    JournalEntryListOut,
    JournalEntryOut,
    TrialBalanceOut,
)
from app.routers.accounting.service import (
    AccountingError,
    create_account,
    create_journal_entry,
    get_journal_entry,
    list_accounts,
    list_journal_entries,
    post_journal_entry,
    trial_balance,
    void_journal_entry,
)

router = APIRouter(prefix="/accounting", tags=["accounting"])


async def _get_company_id(db: AsyncSession) -> uuid.UUID:
    """Récupère le company_id depuis la session PostgreSQL (injecté par le middleware JWT)."""
    result = await db.execute(sql_text("SELECT current_setting('app.current_company_id', true)"))
    raw = result.scalar()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="tenant_context_missing",
        )
    return uuid.UUID(raw)


def _require_roles(*allowed_roles: str) -> Callable[[Request], Awaitable[None]]:
    """Dépendance FastAPI vérifiant le rôle de l'utilisateur."""

    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="insufficient_permissions",
            )

    return _check


_WRITE_ROLES = _require_roles("admin", "manager", "accounting")


def _bad_request(err: AccountingError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err.code)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "accounting", "status": "ok"}


# ── Plan comptable ──────────────────────────────────────────────────────────


@router.get("/accounts", response_model=AccountListOut)
async def list_accounts_endpoint(
    type_filter: str | None = Query(
        None, alias="type", pattern="^(asset|liability|equity|revenue|expense)$"
    ),
    is_active: bool | None = Query(None),
    parent_id: uuid.UUID | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> AccountListOut:
    company_id = await _get_company_id(db)
    accounts, total = await list_accounts(
        db,
        company_id,
        type_=type_filter,
        is_active=is_active,
        parent_id=parent_id,
        page=page,
        limit=limit,
    )
    return AccountListOut(
        data=[AccountOut.model_validate(a) for a in accounts],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/accounts",
    response_model=AccountDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_WRITE_ROLES)],
)
async def create_account_endpoint(
    body: AccountCreate,
    db: AsyncSession = Depends(get_db_session),
) -> AccountDetailOut:
    company_id = await _get_company_id(db)
    try:
        account = await create_account(db, company_id, body)
    except AccountingError as err:
        raise _bad_request(err) from err
    return AccountDetailOut(data=AccountOut.model_validate(account))


# ── Écritures de journal ────────────────────────────────────────────────────


# Déclaré AVANT /entries/{entry_id} pour que « trial-balance » et autres routes
# statiques ne soient pas capturées comme {entry_id}.
@router.get("/trial-balance", response_model=TrialBalanceOut)
async def trial_balance_endpoint(
    db: AsyncSession = Depends(get_db_session),
) -> TrialBalanceOut:
    company_id = await _get_company_id(db)
    return TrialBalanceOut(data=await trial_balance(db, company_id))


@router.get("/entries", response_model=JournalEntryListOut)
async def list_entries_endpoint(
    status_filter: str | None = Query(None, alias="status", pattern="^(draft|posted|void)$"),
    date_from: date | None = Query(None),
    date_to: date | None = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> JournalEntryListOut:
    company_id = await _get_company_id(db)
    entries, total = await list_journal_entries(
        db,
        company_id,
        status=status_filter,
        date_from=date_from,
        date_to=date_to,
        page=page,
        limit=limit,
    )
    return JournalEntryListOut(
        data=[JournalEntryListItem.model_validate(e) for e in entries],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/entries",
    response_model=JournalEntryDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_WRITE_ROLES)],
)
async def create_entry_endpoint(
    body: JournalEntryCreate,
    db: AsyncSession = Depends(get_db_session),
) -> JournalEntryDetailOut:
    company_id = await _get_company_id(db)
    try:
        entry = await create_journal_entry(db, company_id, body)
    except AccountingError as err:
        raise _bad_request(err) from err
    return JournalEntryDetailOut(data=JournalEntryOut.model_validate(entry))


@router.get("/entries/{entry_id}", response_model=JournalEntryDetailOut)
async def get_entry_endpoint(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> JournalEntryDetailOut:
    company_id = await _get_company_id(db)
    entry = await get_journal_entry(db, company_id, entry_id)
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="entry_not_found")
    return JournalEntryDetailOut(data=JournalEntryOut.model_validate(entry))


@router.post(
    "/entries/{entry_id}/post",
    response_model=JournalEntryDetailOut,
    dependencies=[Depends(_WRITE_ROLES)],
)
async def post_entry_endpoint(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> JournalEntryDetailOut:
    company_id = await _get_company_id(db)
    try:
        entry = await post_journal_entry(db, company_id, entry_id)
    except AccountingError as err:
        raise _bad_request(err) from err
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="entry_not_found")
    return JournalEntryDetailOut(data=JournalEntryOut.model_validate(entry))


@router.post(
    "/entries/{entry_id}/void",
    response_model=JournalEntryDetailOut,
    dependencies=[Depends(_WRITE_ROLES)],
)
async def void_entry_endpoint(
    entry_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> JournalEntryDetailOut:
    """Annule une écriture (draft|posted → void)."""
    company_id = await _get_company_id(db)
    try:
        entry = await void_journal_entry(db, company_id, entry_id)
    except AccountingError as err:
        raise _bad_request(err) from err
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="entry_not_found")
    return JournalEntryDetailOut(data=JournalEntryOut.model_validate(entry))
