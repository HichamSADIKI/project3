"""Tests — sous-routeur Admin · Utilisateurs (app-admin, tenant, Loi 1).

Couvre : 403 sans rôle, liste paginée + filtres, détail 200/404, PATCH role/status/
is_active, refus 403 du PATCH pour un non-admin (manager), validation 422, et surtout
l'ISOLATION multi-tenant (Loi 1) : `second_admin` ne voit ni n'altère les users de
`seed_admin` → 404/vide.

Tests d'intégration : requièrent PostgreSQL → `docker compose exec api uv run pytest`.
"""

import uuid

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import encode_jwt, hash_password
from app.models.user import User, UserRole, UserStatus

BASE = "/api/v1/admin/users"


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _make_user(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    role: str = UserRole.AGENT.value,
    status: str = UserStatus.ACTIVE.value,
    full_name: str = "Member",
) -> User:
    user = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=f"member-{uuid.uuid4().hex[:10]}@sgi.test",
        hashed_password=hash_password("MemberPass!23"),
        full_name=full_name,
        role=role,
        status=status,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@pytest_asyncio.fixture
async def manager_token(db_session: AsyncSession, seed_admin) -> str:
    """JWT d'un manager du même tenant que seed_admin (pour tester require_admin_write)."""
    admin, _ = seed_admin
    manager = await _make_user(
        db_session, admin.company_id, role=UserRole.MANAGER.value, full_name="A Manager"
    )
    return encode_jwt(
        {
            "sub": str(manager.id),
            "company_id": str(manager.company_id),
            "role": manager.role,
            "status": manager.status,
            "email": manager.email,
        }
    )


# ── Garde de rôle ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_requires_role(client: AsyncClient) -> None:
    """Sans JWT (non authentifié) → 401 (garde require_admin)."""
    resp = await client.get(BASE)
    assert resp.status_code == 401


# ── Liste + filtres ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_users_returns_tenant_users(
    client: AsyncClient, db_session: AsyncSession, seed_admin
) -> None:
    admin, token = seed_admin
    await _make_user(db_session, admin.company_id, role=UserRole.AGENT.value)
    await _make_user(db_session, admin.company_id, role=UserRole.MANAGER.value)

    resp = await client.get(BASE, headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    # admin (seed) + 2 créés.
    assert body["meta"]["total"] >= 3
    ids = {row["id"] for row in body["data"]}
    assert str(admin.id) in ids


@pytest.mark.asyncio
async def test_list_users_filter_by_role(
    client: AsyncClient, db_session: AsyncSession, seed_admin
) -> None:
    admin, token = seed_admin
    await _make_user(db_session, admin.company_id, role=UserRole.AGENT.value)

    resp = await client.get(BASE, params={"role": "agent"}, headers=_auth(token))
    assert resp.status_code == 200
    roles = {row["role"] for row in resp.json()["data"]}
    assert roles <= {"agent"}


@pytest.mark.asyncio
async def test_list_users_search_q(
    client: AsyncClient, db_session: AsyncSession, seed_admin
) -> None:
    admin, token = seed_admin
    needle = f"Zorglub{uuid.uuid4().hex[:6]}"
    await _make_user(db_session, admin.company_id, full_name=needle)

    resp = await client.get(BASE, params={"q": needle}, headers=_auth(token))
    assert resp.status_code == 200
    names = [row["full_name"] for row in resp.json()["data"]]
    assert needle in names


# ── Détail ─────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_get_user_detail(client: AsyncClient, db_session: AsyncSession, seed_admin) -> None:
    admin, token = seed_admin
    member = await _make_user(db_session, admin.company_id)

    resp = await client.get(f"{BASE}/{member.id}", headers=_auth(token))
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == str(member.id)


@pytest.mark.asyncio
async def test_get_user_unknown_404(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    resp = await client.get(f"{BASE}/{uuid.uuid4()}", headers=_auth(token))
    assert resp.status_code == 404
    assert resp.json()["detail"] == "user_not_found"


# ── PATCH ───────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_patch_user_updates_fields(
    client: AsyncClient, db_session: AsyncSession, seed_admin
) -> None:
    admin, token = seed_admin
    member = await _make_user(db_session, admin.company_id, role=UserRole.AGENT.value)

    resp = await client.patch(
        f"{BASE}/{member.id}",
        json={"role": "manager", "status": "suspended", "is_active": False},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["role"] == "manager"
    assert data["status"] == "suspended"
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_patch_user_unknown_404(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    resp = await client.patch(
        f"{BASE}/{uuid.uuid4()}", json={"role": "agent"}, headers=_auth(token)
    )
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_patch_invalid_role_422(
    client: AsyncClient, db_session: AsyncSession, seed_admin
) -> None:
    admin, token = seed_admin
    member = await _make_user(db_session, admin.company_id)
    resp = await client.patch(
        f"{BASE}/{member.id}", json={"role": "superuser"}, headers=_auth(token)
    )
    # Rejeté par la validation Pydantic (Literal) → 422.
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_patch_ignores_platform_admin(
    client: AsyncClient, db_session: AsyncSession, seed_admin
) -> None:
    """is_platform_admin n'est pas un champ accepté : ignoré, pas d'escalade."""
    admin, token = seed_admin
    member = await _make_user(db_session, admin.company_id)
    resp = await client.patch(
        f"{BASE}/{member.id}",
        json={"role": "agent", "is_platform_admin": True},
        headers=_auth(token),
    )
    assert resp.status_code == 200
    await db_session.refresh(member)
    assert member.is_platform_admin is False


@pytest.mark.asyncio
async def test_patch_forbidden_for_manager(
    client: AsyncClient, db_session: AsyncSession, seed_admin, manager_token: str
) -> None:
    """require_admin_write : un manager (lecture OK) ne peut PAS écrire → 403."""
    admin, _ = seed_admin
    member = await _make_user(db_session, admin.company_id)
    # Le manager peut lire (require_admin = admin|manager).
    read = await client.get(f"{BASE}/{member.id}", headers=_auth(manager_token))
    assert read.status_code == 200
    # Mais pas écrire (require_admin_write = admin seul).
    resp = await client.patch(
        f"{BASE}/{member.id}", json={"role": "agent"}, headers=_auth(manager_token)
    )
    assert resp.status_code == 403


# ── Groupes IAM (best-effort) ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_groups(client: AsyncClient, seed_admin) -> None:
    _admin, token = seed_admin
    resp = await client.get(f"{BASE}/groups", headers=_auth(token))
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert isinstance(body["data"], list)


# ── ISOLATION multi-tenant (Loi 1) ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_tenant_isolation_list(
    client: AsyncClient, db_session: AsyncSession, seed_admin, second_admin
) -> None:
    """Les users de seed_admin ne doivent JAMAIS apparaître pour second_admin."""
    admin, _ = seed_admin
    other_company, other_token = second_admin
    victim = await _make_user(db_session, admin.company_id, full_name="VictimUser")

    resp = await client.get(BASE, headers=_auth(other_token))
    assert resp.status_code == 200
    ids = {row["id"] for row in resp.json()["data"]}
    assert str(victim.id) not in ids
    assert str(admin.id) not in ids


@pytest.mark.asyncio
async def test_tenant_isolation_detail_404(
    client: AsyncClient, db_session: AsyncSession, seed_admin, second_admin
) -> None:
    """Lire le détail d'un user d'un autre tenant → 404 (pas de fuite)."""
    admin, _ = seed_admin
    _other_company, other_token = second_admin
    victim = await _make_user(db_session, admin.company_id)

    resp = await client.get(f"{BASE}/{victim.id}", headers=_auth(other_token))
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_tenant_isolation_patch_404(
    client: AsyncClient, db_session: AsyncSession, seed_admin, second_admin
) -> None:
    """Modifier un user d'un autre tenant → 404, et la donnée reste intacte (Loi 1)."""
    admin, _ = seed_admin
    _other_company, other_token = second_admin
    victim = await _make_user(db_session, admin.company_id, role=UserRole.AGENT.value)

    resp = await client.patch(
        f"{BASE}/{victim.id}", json={"role": "admin"}, headers=_auth(other_token)
    )
    assert resp.status_code == 404
    await db_session.refresh(victim)
    assert victim.role == UserRole.AGENT.value
