"""Router FastAPI — Rapprochement bancaire."""

import uuid
from collections.abc import Awaitable, Callable

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import text as sql_text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session
from app.routers.bank.schemas import (
    AutoMatchResult,
    AutoMatchResultOut,
    BankAccountCreate,
    BankAccountDetailOut,
    BankAccountListOut,
    BankAccountOut,
    ImportLinesIn,
    ImportResult,
    ImportResultOut,
    MatchIn,
    ReconSummaryOut,
    StatementLineCreate,
    StatementLineDetailOut,
    StatementLineListOut,
    StatementLineOut,
    SuggestionsOut,
)
from app.routers.bank.service import (
    BankError,
    auto_match,
    create_bank_account,
    create_statement_line,
    get_bank_account,
    get_statement_line,
    import_statement_lines,
    list_bank_accounts,
    list_statement_lines,
    match_line,
    reconciliation_summary,
    suggest_matches,
    unmatch_line,
)

router = APIRouter(prefix="/bank", tags=["bank"])


async def _get_company_id(db: AsyncSession) -> uuid.UUID:
    result = await db.execute(sql_text("SELECT current_setting('app.current_company_id', true)"))
    raw = result.scalar()
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="tenant_context_missing"
        )
    return uuid.UUID(raw)


def _require_roles(*allowed_roles: str) -> Callable[[Request], Awaitable[None]]:
    async def _check(request: Request) -> None:
        role = getattr(request.state, "role", None)
        if role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="insufficient_permissions"
            )

    return _check


_WRITE_ROLES = _require_roles("admin", "manager", "accounting")


def _bad_request(err: BankError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=err.code)


@router.get("/health")
async def health() -> dict[str, str]:
    return {"module": "bank", "status": "ok"}


# ── Comptes bancaires ────────────────────────────────────────────────────────


@router.get("/accounts", response_model=BankAccountListOut)
async def list_accounts_endpoint(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> BankAccountListOut:
    company_id = await _get_company_id(db)
    accounts, total = await list_bank_accounts(db, company_id, page=page, limit=limit)
    return BankAccountListOut(
        data=[BankAccountOut.model_validate(a) for a in accounts],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/accounts",
    response_model=BankAccountDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_WRITE_ROLES)],
)
async def create_account_endpoint(
    body: BankAccountCreate,
    db: AsyncSession = Depends(get_db_session),
) -> BankAccountDetailOut:
    company_id = await _get_company_id(db)
    account = await create_bank_account(db, company_id, body)
    return BankAccountDetailOut(data=BankAccountOut.model_validate(account))


@router.get("/accounts/{account_id}/summary", response_model=ReconSummaryOut)
async def summary_endpoint(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> ReconSummaryOut:
    company_id = await _get_company_id(db)
    account = await get_bank_account(db, company_id, account_id)
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="bank_account_not_found")
    return ReconSummaryOut(data=await reconciliation_summary(db, company_id, account_id))


# ── Lignes de relevé ─────────────────────────────────────────────────────────


@router.post(
    "/lines/import",
    response_model=ImportResultOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_WRITE_ROLES)],
)
async def import_lines_endpoint(
    body: ImportLinesIn,
    db: AsyncSession = Depends(get_db_session),
) -> ImportResultOut:
    """Import en masse de lignes de relevé (depuis un CSV parsé côté front)."""
    company_id = await _get_company_id(db)
    try:
        created = await import_statement_lines(db, company_id, body.bank_account_id, body.lines)
    except BankError as err:
        raise _bad_request(err) from err
    return ImportResultOut(data=ImportResult(created=created))


@router.post(
    "/accounts/{account_id}/auto-match",
    response_model=AutoMatchResultOut,
    dependencies=[Depends(_WRITE_ROLES)],
)
async def auto_match_endpoint(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> AutoMatchResultOut:
    """Rapproche automatiquement les lignes ayant exactement une suggestion."""
    company_id = await _get_company_id(db)
    try:
        matched = await auto_match(db, company_id, account_id)
    except BankError as err:
        raise _bad_request(err) from err
    return AutoMatchResultOut(data=AutoMatchResult(matched=matched))


@router.get("/lines", response_model=StatementLineListOut)
async def list_lines_endpoint(
    bank_account_id: uuid.UUID | None = Query(None),
    status_filter: str | None = Query(None, alias="status", pattern="^(unreconciled|reconciled)$"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db_session),
) -> StatementLineListOut:
    company_id = await _get_company_id(db)
    lines, total = await list_statement_lines(
        db,
        company_id,
        bank_account_id=bank_account_id,
        status=status_filter,
        page=page,
        limit=limit,
    )
    return StatementLineListOut(
        data=[StatementLineOut.model_validate(line) for line in lines],
        meta={"total": total, "page": page, "limit": limit},
    )


@router.post(
    "/lines",
    response_model=StatementLineDetailOut,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(_WRITE_ROLES)],
)
async def create_line_endpoint(
    body: StatementLineCreate,
    db: AsyncSession = Depends(get_db_session),
) -> StatementLineDetailOut:
    company_id = await _get_company_id(db)
    try:
        line = await create_statement_line(db, company_id, body)
    except BankError as err:
        raise _bad_request(err) from err
    return StatementLineDetailOut(data=StatementLineOut.model_validate(line))


@router.get("/lines/{line_id}/suggestions", response_model=SuggestionsOut)
async def suggestions_endpoint(
    line_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> SuggestionsOut:
    company_id = await _get_company_id(db)
    line = await get_statement_line(db, company_id, line_id)
    if line is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="line_not_found")
    return SuggestionsOut(data=await suggest_matches(db, company_id, line))


@router.post(
    "/lines/{line_id}/match",
    response_model=StatementLineDetailOut,
    dependencies=[Depends(_WRITE_ROLES)],
)
async def match_endpoint(
    line_id: uuid.UUID,
    body: MatchIn,
    db: AsyncSession = Depends(get_db_session),
) -> StatementLineDetailOut:
    company_id = await _get_company_id(db)
    try:
        line = await match_line(db, company_id, line_id, body.transaction_id)
    except BankError as err:
        raise _bad_request(err) from err
    if line is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="line_not_found")
    return StatementLineDetailOut(data=StatementLineOut.model_validate(line))


@router.post(
    "/lines/{line_id}/unmatch",
    response_model=StatementLineDetailOut,
    dependencies=[Depends(_WRITE_ROLES)],
)
async def unmatch_endpoint(
    line_id: uuid.UUID,
    db: AsyncSession = Depends(get_db_session),
) -> StatementLineDetailOut:
    company_id = await _get_company_id(db)
    line = await unmatch_line(db, company_id, line_id)
    if line is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="line_not_found")
    return StatementLineDetailOut(data=StatementLineOut.model_validate(line))
