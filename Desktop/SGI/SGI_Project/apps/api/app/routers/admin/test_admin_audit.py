"""Tests du sous-routeur app-admin « audit » (`/admin/audit`, tenant, Loi 1).

Couvre :
- Frontière : 403 sans rôle admin/manager (anonyme), 200 pour seed_admin.
- ISOLATION Loi 1 : les logs d'un tenant sont invisibles avec le token d'un autre
  tenant (via second_admin) — vérification machine du risque n°1.
- Filtres (action) + pagination.
- Export CSV avec neutralisation d'injection de formule (OWASP).
- Helper pur `csv_safe`.
"""

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog
from app.routers.admin.audit import csv_safe

AUTH = "Authorization"


def _log(company_id: uuid.UUID, action: str, resource: str = "user") -> AuditLog:
    return AuditLog(
        id=uuid.uuid4(),
        company_id=company_id,
        user_id=uuid.uuid4(),
        user_email="actor@sgi.test",
        action=action,
        resource=resource,
        changes={},
    )


# ── Helper pur ─────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("=SUM(1)", "'=SUM(1)"),
        ("+1", "'+1"),
        ("-1", "'-1"),
        ("@x", "'@x"),
        ("login", "login"),
        (None, ""),
    ],
)
def test_csv_safe(raw: object, expected: str) -> None:
    assert csv_safe(raw) == expected


# ── Frontière de sécurité ─────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_requires_role(client: AsyncClient) -> None:
    """Anonyme (non authentifié) → 401 (garde require_admin)."""
    resp = await client.get("/api/v1/admin/audit")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_audit_list_ok(client: AsyncClient, db_session: AsyncSession, seed_admin) -> None:
    admin, token = seed_admin
    db_session.add(_log(admin.company_id, "user.login"))
    await db_session.commit()
    resp = await client.get("/api/v1/admin/audit", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["meta"]["total"] >= 1


# ── Isolation Loi 1 (cross-tenant) ─────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_tenant_isolation(
    client: AsyncClient, db_session: AsyncSession, seed_admin, second_admin
) -> None:
    """Les logs d'un tenant ne fuient pas vers un autre tenant."""
    admin, token_a = seed_admin
    other_company, token_b = second_admin

    action_a = f"a-{uuid.uuid4().hex[:8]}"
    action_b = f"b-{uuid.uuid4().hex[:8]}"
    db_session.add_all([_log(admin.company_id, action_a), _log(other_company.id, action_b)])
    await db_session.commit()

    # Tenant A ne voit QUE son action.
    resp_a = await client.get("/api/v1/admin/audit", headers={AUTH: f"Bearer {token_a}"})
    actions_a = {item["action"] for item in resp_a.json()["data"]}
    assert action_a in actions_a
    assert action_b not in actions_a

    # Tenant B ne voit QUE la sienne.
    resp_b = await client.get("/api/v1/admin/audit", headers={AUTH: f"Bearer {token_b}"})
    actions_b = {item["action"] for item in resp_b.json()["data"]}
    assert action_b in actions_b
    assert action_a not in actions_b


# ── Filtre ───────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_audit_filter_action(
    client: AsyncClient, db_session: AsyncSession, seed_admin
) -> None:
    admin, token = seed_admin
    unique = f"act-{uuid.uuid4().hex[:8]}"
    db_session.add_all([_log(admin.company_id, unique), _log(admin.company_id, "other.thing")])
    await db_session.commit()
    resp = await client.get(
        f"/api/v1/admin/audit?action={unique}", headers={AUTH: f"Bearer {token}"}
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert len(data) >= 1
    assert all(item["action"] == unique for item in data)


# ── Export CSV (neutralisation d'injection de formule) ─────────────────────────


@pytest.mark.asyncio
async def test_audit_export_csv_neutralizes_formula(
    client: AsyncClient, db_session: AsyncSession, seed_admin
) -> None:
    admin, token = seed_admin
    db_session.add(_log(admin.company_id, "=cmd|'/C calc'!A1", resource="x"))
    await db_session.commit()
    resp = await client.get("/api/v1/admin/audit/export.csv", headers={AUTH: f"Bearer {token}"})
    assert resp.status_code == 200
    assert "text/csv" in resp.headers.get("content-type", "")
    text = resp.text
    # La cellule malveillante est neutralisée (apostrophe en tête) ...
    assert "'=cmd" in text
    # ... et aucune ligne ne démarre par '=' (sinon formule active dans le tableur).
    for line in text.splitlines():
        assert not line.startswith("=")
