"""Tests du sous-routeur Studio de Modules (`/admin/platform/studio/*`).

Couvre :
- Helpers PURS de la machine à états + TTL + flag codegen (pas d'I/O).
- Frontière de sécurité plateforme : 401 anonyme, 403 admin SANS `is_platform_admin`.
- Cycle de vie : create (draft) → build dry-run (audited) → gouvernance 4-eyes.
- **4-eyes** : même acteur → 403, demande expirée → 409, approbateur DISTINCT → 200
  + module `integrated` + 2 lignes d'audit (demande + approbation).
- Garde-fous : `key` invalide → 422, `key` dupliqué → 409, build hors `draft` → 409,
  codegen activé → 501 (orchestrateur Phase 3 absent).

Périmètre cross-tenant (hors Loi 1) : `studio_modules` n'a pas de company_id ; le test
d'isolation Loi 1 ne s'applique pas — la garde est `require_platform_admin` (403 testé).
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.audit_log import AuditLog
from app.models.company import Company
from app.models.studio import StudioIntegrationRequest
from app.models.user import User, UserRole, UserStatus
from app.routers.admin.studio import (
    can_transition,
    codegen_enabled,
    integration_ttl_minutes,
    is_expired,
)
from app.routers.admin.studio_schema import MAX_SHEETS, SheetSchema

AUTH = "Authorization"
BASE = "/api/v1/admin/platform/studio"


# ── Helpers purs (pas d'I/O) ──────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("src", "dst", "ok"),
    [
        ("draft", "built", True),
        ("built", "tested", True),
        ("tested", "audited", True),
        ("audited", "approved", True),
        ("audited", "pr_open", True),
        ("approved", "integrated", True),
        ("failed", "draft", True),
        # interdits
        ("draft", "integrated", False),
        ("draft", "audited", False),
        ("integrated", "draft", False),
        ("rejected", "approved", False),
        ("audited", "integrated", False),
    ],
)
def test_can_transition(src: str, dst: str, ok: bool) -> None:
    assert can_transition(src, dst) is ok


def test_integration_ttl_minutes_default_and_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("STUDIO_INTEGRATION_TTL_MINUTES", raising=False)
    assert integration_ttl_minutes() == 60
    monkeypatch.setenv("STUDIO_INTEGRATION_TTL_MINUTES", "15")
    assert integration_ttl_minutes() == 15
    # Valeurs invalides / non positives → repli sur 60.
    monkeypatch.setenv("STUDIO_INTEGRATION_TTL_MINUTES", "0")
    assert integration_ttl_minutes() == 60
    monkeypatch.setenv("STUDIO_INTEGRATION_TTL_MINUTES", "abc")
    assert integration_ttl_minutes() == 60


def test_codegen_enabled_default_false(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("STUDIO_CODEGEN_ENABLED", raising=False)
    assert codegen_enabled() is False
    monkeypatch.setenv("STUDIO_CODEGEN_ENABLED", "true")
    assert codegen_enabled() is True
    monkeypatch.setenv("STUDIO_CODEGEN_ENABLED", "false")
    assert codegen_enabled() is False


def test_is_expired() -> None:
    now = datetime(2026, 6, 8, 12, 0, 0, tzinfo=UTC)
    assert is_expired(now - timedelta(seconds=1), now) is True
    assert is_expired(now + timedelta(minutes=10), now) is False


# ── Helpers de fixtures locales ────────────────────────────────────────────────


async def _seed_platform_admin(db: AsyncSession) -> tuple[User, str]:
    """Crée un 2ᵉ (ou Nᵉ) super-admin plateforme + son JWT (test 4-eyes).

    Crée d'abord une vraie société (FK `users.company_id`) — le périmètre est
    plateforme mais l'utilisateur reste rattaché à une société existante.
    """
    company = Company(
        id=uuid.uuid4(),
        name="Platform Co",
        slug=f"plat-co-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db.add(company)
    admin = User(
        id=uuid.uuid4(),
        company_id=company.id,
        email=f"plat-{uuid.uuid4().hex[:8]}@sgi.test",
        hashed_password=hash_password("AdminPass!23"),
        full_name="Platform Admin 2",
        role=UserRole.ADMIN.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
        is_platform_admin=True,
    )
    db.add(admin)
    await db.commit()
    await db.refresh(admin)
    token = encode_jwt(
        {
            "sub": str(admin.id),
            "company_id": str(admin.company_id),
            "role": admin.role,
            "status": admin.status,
            "email": admin.email,
        }
    )
    return admin, token


def _module_payload(**over: object) -> dict[str, object]:
    base = {
        "key": f"studio.mod_{uuid.uuid4().hex[:8]}",
        "title_ar": "وحدة",
        "title_en": "Module",
        "title_fr": "Module",
        "flavor": "lite",
        "mode": "manual",
    }
    base.update(over)
    return base


async def _create_audited_module(client: AsyncClient, headers: dict[str, str]) -> str:
    """Crée un module et le fait passer en `audited` via le build dry-run. Renvoie l'id."""
    resp = await client.post(f"{BASE}/modules", json=_module_payload(), headers=headers)
    assert resp.status_code == 201
    module_id = resp.json()["data"]["id"]
    built = await client.post(f"{BASE}/modules/{module_id}/build", headers=headers)
    assert built.status_code == 200
    assert built.json()["data"]["state"] == "audited"
    return module_id


# ── Frontière de sécurité ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_modules_requires_auth(client: AsyncClient) -> None:
    assert (await client.get(f"{BASE}/modules")).status_code == 401
    assert (await client.post(f"{BASE}/modules", json=_module_payload())).status_code == 401


@pytest.mark.asyncio
async def test_modules_forbidden_for_plain_admin(client: AsyncClient, seed_admin) -> None:
    """Admin de société SANS is_platform_admin → 403 (garde plateforme)."""
    _admin, token = seed_admin
    h = {AUTH: f"Bearer {token}"}
    assert (await client.get(f"{BASE}/modules", headers=h)).status_code == 403
    r = await client.post(f"{BASE}/modules", json=_module_payload(), headers=h)
    assert r.status_code == 403
    assert r.json()["detail"] == "platform_admin_required"


@pytest.mark.asyncio
async def test_request_and_approve_forbidden_for_plain_admin(
    client: AsyncClient, seed_admin
) -> None:
    _admin, token = seed_admin
    h = {AUTH: f"Bearer {token}"}
    mid = uuid.uuid4()
    assert (
        await client.post(
            f"{BASE}/modules/{mid}/request-integration", json={"reason": "x"}, headers=h
        )
    ).status_code == 403
    assert (
        await client.post(f"{BASE}/modules/{mid}/approve-integration", headers=h)
    ).status_code == 403


# ── Cycle de vie : create / build ──────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_module_draft(client: AsyncClient, seed_platform_admin) -> None:
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    resp = await client.post(f"{BASE}/modules", json=_module_payload(), headers=h)
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["state"] == "draft"
    assert data["is_integrated"] is False


@pytest.mark.asyncio
async def test_create_module_invalid_key(client: AsyncClient, seed_platform_admin) -> None:
    """`key` hors charset `^[a-z0-9_.]+$` → 422 (anti-injection au niveau schéma)."""
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    for bad in ("Studio Mod", "studio/mod", "studio;DROP", "../evil"):
        resp = await client.post(f"{BASE}/modules", json=_module_payload(key=bad), headers=h)
        assert resp.status_code == 422, bad


@pytest.mark.asyncio
async def test_create_module_duplicate_key(client: AsyncClient, seed_platform_admin) -> None:
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    payload = _module_payload()
    assert (await client.post(f"{BASE}/modules", json=payload, headers=h)).status_code == 201
    dup = await client.post(f"{BASE}/modules", json=payload, headers=h)
    assert dup.status_code == 409
    assert dup.json()["detail"] == "module_key_taken"


@pytest.mark.asyncio
async def test_get_unknown_module_404(client: AsyncClient, seed_platform_admin) -> None:
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    resp = await client.get(f"{BASE}/modules/{uuid.uuid4()}", headers=h)
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_build_dry_run_then_not_draft(client: AsyncClient, seed_platform_admin) -> None:
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    module_id = await _create_audited_module(client, h)
    # Re-build : le module n'est plus en draft → 409.
    again = await client.post(f"{BASE}/modules/{module_id}/build", headers=h)
    assert again.status_code == 409
    assert again.json()["detail"] == "module_not_draft"


@pytest.mark.asyncio
async def test_build_blocked_when_codegen_enabled(
    client: AsyncClient, seed_platform_admin, monkeypatch
) -> None:
    """Flag codegen activé mais worker Phase 3 absent → 501 (garde-fou honnête)."""
    monkeypatch.setenv("STUDIO_CODEGEN_ENABLED", "true")
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    resp = await client.post(f"{BASE}/modules", json=_module_payload(), headers=h)
    mid = resp.json()["data"]["id"]
    built = await client.post(f"{BASE}/modules/{mid}/build", headers=h)
    assert built.status_code == 501
    assert built.json()["detail"] == "codegen_orchestrator_not_implemented"


# ── Gouvernance 4-eyes ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_request_integration_requires_audited(
    client: AsyncClient, seed_platform_admin
) -> None:
    """Demander l'intégration d'un module encore `draft` → 409 module_not_ready."""
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    resp = await client.post(f"{BASE}/modules", json=_module_payload(), headers=h)
    mid = resp.json()["data"]["id"]
    r = await client.post(
        f"{BASE}/modules/{mid}/request-integration", json={"reason": "ready"}, headers=h
    )
    assert r.status_code == 409
    assert r.json()["detail"] == "module_not_ready"


@pytest.mark.asyncio
async def test_request_integration_then_duplicate(client: AsyncClient, seed_platform_admin) -> None:
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    mid = await _create_audited_module(client, h)
    r1 = await client.post(
        f"{BASE}/modules/{mid}/request-integration",
        json={"reason": "première", "ticket_ref": "JIRA-1"},
        headers=h,
    )
    assert r1.status_code == 201
    assert r1.json()["data"]["status"] == "pending"
    # 2ᵉ demande tant que la 1ʳᵉ est pending non expirée → 409.
    r2 = await client.post(
        f"{BASE}/modules/{mid}/request-integration", json={"reason": "doublon"}, headers=h
    )
    assert r2.status_code == 409
    assert r2.json()["detail"] == "integration_already_pending"


@pytest.mark.asyncio
async def test_approve_same_actor_forbidden(client: AsyncClient, seed_platform_admin) -> None:
    """L'approbateur == demandeur → 403 four_eyes_required (cœur du 4-eyes)."""
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    mid = await _create_audited_module(client, h)
    await client.post(
        f"{BASE}/modules/{mid}/request-integration", json={"reason": "ready"}, headers=h
    )
    same = await client.post(f"{BASE}/modules/{mid}/approve-integration", headers=h)
    assert same.status_code == 403
    assert same.json()["detail"] == "four_eyes_required"


@pytest.mark.asyncio
async def test_approve_distinct_actor_integrates(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin
) -> None:
    """Approbateur DISTINCT → 200, module integrated, 2 lignes d'audit écrites."""
    admin_a, token_a = seed_platform_admin
    ha = {AUTH: f"Bearer {token_a}"}
    _admin_b, token_b = await _seed_platform_admin(db_session)
    hb = {AUTH: f"Bearer {token_b}"}

    mid = await _create_audited_module(client, ha)
    req = await client.post(
        f"{BASE}/modules/{mid}/request-integration",
        json={"reason": "prod ready", "ticket_ref": "JIRA-9"},
        headers=ha,
    )
    assert req.status_code == 201

    ok = await client.post(f"{BASE}/modules/{mid}/approve-integration", headers=hb)
    assert ok.status_code == 200
    assert ok.json()["data"]["status"] == "approved"

    detail = await client.get(f"{BASE}/modules/{mid}", headers=ha)
    body = detail.json()["data"]
    assert body["state"] == "integrated"
    assert body["is_integrated"] is True  # flavor lite → nav activable

    # Audit : la demande ET l'approbation sont tracées (2 lignes pour ce module).
    rows = (
        (await db_session.execute(select(AuditLog).where(AuditLog.resource_id == uuid.UUID(mid))))
        .scalars()
        .all()
    )
    actions = {r.action for r in rows}
    assert "studio:integration.requested" in actions
    assert "studio:integration.approved" in actions


@pytest.mark.asyncio
async def test_approve_expired_request(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin
) -> None:
    """Demande expirée → 409 integration_request_expired (TTL respecté)."""
    admin_a, token_a = seed_platform_admin
    ha = {AUTH: f"Bearer {token_a}"}
    _admin_b, token_b = await _seed_platform_admin(db_session)
    hb = {AUTH: f"Bearer {token_b}"}

    mid = await _create_audited_module(client, ha)
    await client.post(
        f"{BASE}/modules/{mid}/request-integration", json={"reason": "ready"}, headers=ha
    )
    # Force l'expiration en base.
    intreq = (
        await db_session.execute(
            select(StudioIntegrationRequest).where(
                StudioIntegrationRequest.module_id == uuid.UUID(mid)
            )
        )
    ).scalar_one()
    intreq.expires_at = datetime.now(UTC) - timedelta(minutes=1)
    await db_session.commit()

    resp = await client.post(f"{BASE}/modules/{mid}/approve-integration", headers=hb)
    assert resp.status_code == 409
    assert resp.json()["detail"] == "integration_request_expired"


@pytest.mark.asyncio
async def test_approve_without_pending_request_404(
    client: AsyncClient, db_session: AsyncSession, seed_platform_admin
) -> None:
    admin_a, token_a = seed_platform_admin
    ha = {AUTH: f"Bearer {token_a}"}
    _admin_b, token_b = await _seed_platform_admin(db_session)
    hb = {AUTH: f"Bearer {token_b}"}
    mid = await _create_audited_module(client, ha)
    resp = await client.post(f"{BASE}/modules/{mid}/approve-integration", headers=hb)
    assert resp.status_code == 404
    assert resp.json()["detail"] == "no_pending_request"


@pytest.mark.asyncio
async def test_integration_requests_history(client: AsyncClient, seed_platform_admin) -> None:
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    mid = await _create_audited_module(client, h)
    await client.post(
        f"{BASE}/modules/{mid}/request-integration", json={"reason": "ready"}, headers=h
    )
    hist = await client.get(f"{BASE}/modules/{mid}/integration-requests", headers=h)
    assert hist.status_code == 200
    assert hist.json()["meta"]["total"] >= 1


# ── Phase 1 — SheetSchema (validation pure) ────────────────────────────────────


def _valid_schema() -> dict[str, object]:
    return {
        "schema_version": 1,
        "sheets": [
            {
                "id": "main",
                "title_ar": "الرئيسية",
                "title_en": "Main",
                "title_fr": "Principale",
                "elements": [
                    {
                        "id": "name",
                        "type": "text",
                        "label_ar": "الاسم",
                        "label_en": "Name",
                        "label_fr": "Nom",
                    },
                    {
                        "id": "go",
                        "type": "button",
                        "label_ar": "إرسال",
                        "label_en": "Submit",
                        "label_fr": "Envoyer",
                        "action": "submit",
                    },
                ],
            }
        ],
    }


def test_sheet_schema_valid() -> None:
    schema = SheetSchema.model_validate(_valid_schema())
    assert schema.schema_version == 1
    assert len(schema.sheets) == 1
    assert schema.sheets[0].elements[1].action == "submit"


def test_sheet_schema_rejects_unknown_element_type() -> None:
    bad = _valid_schema()
    bad["sheets"][0]["elements"][0]["type"] = "iframe"  # type: ignore[index]
    with pytest.raises(ValidationError):
        SheetSchema.model_validate(bad)


def test_sheet_schema_rejects_action_outside_whitelist() -> None:
    bad = _valid_schema()
    bad["sheets"][0]["elements"][1]["action"] = "exec"  # type: ignore[index]
    with pytest.raises(ValidationError):
        SheetSchema.model_validate(bad)


def test_sheet_schema_rejects_bad_slug() -> None:
    bad = _valid_schema()
    bad["sheets"][0]["elements"][0]["id"] = "Name With Space"  # type: ignore[index]
    with pytest.raises(ValidationError):
        SheetSchema.model_validate(bad)


def test_sheet_schema_rejects_extra_field() -> None:
    """extra='forbid' : un champ inattendu (injection de sortie IA) est refusé."""
    bad = _valid_schema()
    bad["sheets"][0]["elements"][0]["onclick"] = "alert(1)"  # type: ignore[index]
    with pytest.raises(ValidationError):
        SheetSchema.model_validate(bad)


def test_sheet_schema_rejects_empty_sheets() -> None:
    with pytest.raises(ValidationError):
        SheetSchema.model_validate({"schema_version": 1, "sheets": []})


def test_sheet_schema_rejects_too_many_sheets() -> None:
    one = _valid_schema()["sheets"][0]
    with pytest.raises(ValidationError):
        SheetSchema.model_validate({"schema_version": 1, "sheets": [one] * (MAX_SHEETS + 1)})


# ── Phase 1 — endpoints schema (POST/GET) ──────────────────────────────────────


@pytest.mark.asyncio
async def test_schema_requires_platform_admin(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    h = {AUTH: f"Bearer {token}"}
    mid = uuid.uuid4()
    assert (await client.get(f"{BASE}/modules/{mid}/schema", headers=h)).status_code == 403
    assert (
        await client.post(f"{BASE}/modules/{mid}/schema", json=_valid_schema(), headers=h)
    ).status_code == 403


@pytest.mark.asyncio
async def test_schema_set_and_get(client: AsyncClient, seed_platform_admin) -> None:
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    resp = await client.post(f"{BASE}/modules", json=_module_payload(), headers=h)
    mid = resp.json()["data"]["id"]

    # Pas de schéma au départ.
    empty = await client.get(f"{BASE}/modules/{mid}/schema", headers=h)
    assert empty.status_code == 200
    assert empty.json()["data"] is None

    # POST schéma valide → 200 ; GET le renvoie.
    saved = await client.post(f"{BASE}/modules/{mid}/schema", json=_valid_schema(), headers=h)
    assert saved.status_code == 200
    got = await client.get(f"{BASE}/modules/{mid}/schema", headers=h)
    assert got.status_code == 200
    assert got.json()["data"]["sheets"][0]["id"] == "main"


@pytest.mark.asyncio
async def test_schema_rejects_invalid_payload(client: AsyncClient, seed_platform_admin) -> None:
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    resp = await client.post(f"{BASE}/modules", json=_module_payload(), headers=h)
    mid = resp.json()["data"]["id"]
    bad = _valid_schema()
    bad["sheets"][0]["elements"][0]["type"] = "iframe"  # type: ignore[index]
    r = await client.post(f"{BASE}/modules/{mid}/schema", json=bad, headers=h)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_schema_not_editable_after_build(client: AsyncClient, seed_platform_admin) -> None:
    """Le schéma est gelé hors `draft` → 409 module_not_editable après build."""
    _a, token = seed_platform_admin
    h = {AUTH: f"Bearer {token}"}
    mid = await _create_audited_module(client, h)  # passe en `audited`
    r = await client.post(f"{BASE}/modules/{mid}/schema", json=_valid_schema(), headers=h)
    assert r.status_code == 409
    assert r.json()["detail"] == "module_not_editable"
