"""Tests unitaires — helpers métier purs du module realestate_core."""
from decimal import Decimal

import pytest

from app.routers.realestate_core.service import (
    UAE_EMIRATES,
    compute_vat,
    default_settings,
    generate_branch_code,
    is_valid_emirate,
    is_valid_fiscal_month,
)


class TestIsValidEmirate:
    @pytest.mark.parametrize("code", ["DXB", "AUH", "SHJ", "AJM", "RAK", "FUJ", "UAQ"])
    def test_all_seven_emirates_valid(self, code: str) -> None:
        assert is_valid_emirate(code) is True

    def test_seven_emirates_total(self) -> None:
        assert len(UAE_EMIRATES) == 7

    @pytest.mark.parametrize("code", ["", "dxb", "DUBAI", "XYZ", "DX"])
    def test_invalid_values(self, code: str) -> None:
        assert is_valid_emirate(code) is False


class TestGenerateBranchCode:
    def test_empty_starts_at_001(self) -> None:
        assert generate_branch_code([]) == "BR-001"

    def test_increments_from_max(self) -> None:
        assert generate_branch_code(["BR-001", "BR-002"]) == "BR-003"

    def test_uses_max_not_count(self) -> None:
        # Trou dans la séquence : on repart du max + 1, pas du nombre d'éléments.
        assert generate_branch_code(["BR-001", "BR-005"]) == "BR-006"

    def test_ignores_malformed_codes(self) -> None:
        assert generate_branch_code(["FOO", "BR-X", "BR-002", "xx"]) == "BR-003"

    def test_pads_to_three_digits(self) -> None:
        assert generate_branch_code(["BR-008"]) == "BR-009"

    def test_extends_beyond_999(self) -> None:
        assert generate_branch_code(["BR-999"]) == "BR-1000"

    def test_only_malformed_starts_at_001(self) -> None:
        assert generate_branch_code(["nope", "still-no"]) == "BR-001"


class TestComputeVat:
    def test_uae_standard_5pct(self) -> None:
        assert compute_vat(Decimal("1000"), Decimal("5")) == Decimal("50.00")

    def test_zero_rate(self) -> None:
        assert compute_vat(Decimal("1000"), Decimal("0")) == Decimal("0.00")

    def test_rounds_half_up_to_two_decimals(self) -> None:
        # 333.33 * 5% = 16.6665 → 16.67
        assert compute_vat(Decimal("333.33"), Decimal("5")) == Decimal("16.67")

    def test_quantized_to_two_decimals(self) -> None:
        result = compute_vat(Decimal("123.45"), Decimal("5"))
        assert result.as_tuple().exponent == -2


class TestIsValidFiscalMonth:
    @pytest.mark.parametrize("month", [1, 6, 12])
    def test_valid_months(self, month: int) -> None:
        assert is_valid_fiscal_month(month) is True

    @pytest.mark.parametrize("month", [0, 13, -1, 100])
    def test_invalid_months(self, month: int) -> None:
        assert is_valid_fiscal_month(month) is False


class TestDefaultSettings:
    def test_uae_defaults(self) -> None:
        s = default_settings()
        assert s["currency"] == "AED"
        assert s["vat_rate"] == Decimal("5.00")
        assert s["vat_enabled"] is True
        assert s["timezone"] == "Asia/Dubai"
        assert s["default_emirate"] == "DXB"

    def test_extra_is_fresh_dict(self) -> None:
        # Pas de mutable partagé entre deux appels.
        a = default_settings()
        a["extra"]["x"] = 1
        b = default_settings()
        assert b["extra"] == {}


# ─── Tests d'intégration endpoints (auth + multi-tenant) ────────────────────
# Requièrent PostgreSQL — lancer via : docker compose exec api uv run pytest

import uuid as _uuid

import pytest_asyncio
from httpx import AsyncClient

from app.core.auth import encode_jwt, hash_password
from app.models.company import Company
from app.models.user import User, UserRole, UserStatus

# asyncio_mode = "auto" (pyproject) → les tests async sont détectés sans marqueur.


@pytest_asyncio.fixture
async def second_admin(db_session) -> tuple[Company, str]:  # type: ignore[no-untyped-def]
    """Une 2ᵉ société + admin + token (pour tester l'isolation multi-tenant)."""
    company = Company(id=_uuid.uuid4(), name="Other Co",
                      slug=f"other-{_uuid.uuid4().hex[:8]}", plan="pro", is_active=True)
    db_session.add(company)
    admin = User(id=_uuid.uuid4(), company_id=company.id,
                 email=f"admin2-{_uuid.uuid4().hex[:8]}@sgi.test",
                 hashed_password=hash_password("Pass!234"), full_name="Admin 2",
                 role=UserRole.ADMIN.value, status=UserStatus.ACTIVE.value, is_active=True)
    db_session.add(admin)
    await db_session.commit()
    token = encode_jwt({"sub": str(admin.id), "company_id": str(company.id),
                        "role": admin.role, "status": admin.status, "email": admin.email})
    return company, token


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def test_branches_requires_auth(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/branches")
    assert resp.status_code == 401


async def test_create_then_list_branch(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    create = await client.post("/api/v1/branches", headers=_auth(token),
                               json={"name": "Marina", "emirate": "DXB"})
    assert create.status_code == 201, create.text
    body = create.json()["data"]
    assert body["name"] == "Marina"
    assert body["code"].startswith("BR-")  # code auto-généré

    listed = await client.get("/api/v1/branches", headers=_auth(token))
    assert listed.status_code == 200
    names = [b["name"] for b in listed.json()["data"]]
    assert "Marina" in names


async def test_branch_tenant_isolation(
    client: AsyncClient, seed_admin: tuple[User, str], second_admin: tuple[Company, str]
) -> None:
    """Une succursale de la société A n'est pas visible par la société B (Loi 1)."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin

    created = await client.post("/api/v1/branches", headers=_auth(token_a),
                                json={"name": "Secret DXB", "emirate": "DXB"})
    assert created.status_code == 201

    list_b = await client.get("/api/v1/branches", headers=_auth(token_b))
    assert list_b.status_code == 200
    names_b = [b["name"] for b in list_b.json()["data"]]
    assert "Secret DXB" not in names_b
