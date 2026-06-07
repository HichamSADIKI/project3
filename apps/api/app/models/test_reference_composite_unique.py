"""Test de la contrainte d'unicité composite `(company_id, reference)`.

Vérifie le correctif du défaut multi-tenant (audit) : deux sociétés distinctes
DOIVENT pouvoir réutiliser la même référence (`DXB-2026-0001`), alors qu'un
doublon À L'INTÉRIEUR d'une même société reste interdit.

⚠️ Test d'intégration : suppose la migration `0023_reference_composite_unique`
appliquée (la contrainte est posée au niveau base). Lancer via :
    docker compose exec api uv run pytest app/models/test_reference_composite_unique.py
"""

import uuid

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.company import Company
from app.models.property import Property


async def _company(db_session, suffix: str) -> uuid.UUID:
    cid = uuid.uuid4()
    db_session.add(
        Company(
            id=cid, name=f"Soc {suffix}", slug=f"{suffix}-{cid.hex[:8]}", plan="pro", is_active=True
        )
    )
    await db_session.flush()
    return cid


@pytest.mark.asyncio
async def test_two_companies_can_share_reference(db_session):
    """Deux sociétés différentes peuvent porter la même référence."""
    a = await _company(db_session, "a")
    b = await _company(db_session, "b")
    ref = f"REFT-{uuid.uuid4().hex[:8]}"
    db_session.add_all(
        [
            Property(
                id=uuid.uuid4(),
                company_id=a,
                reference=ref,
                type="apartment",
                price=1,
                status="available",
            ),
            Property(
                id=uuid.uuid4(),
                company_id=b,
                reference=ref,
                type="villa",
                price=2,
                status="available",
            ),
        ]
    )
    # Ne doit PAS lever : la contrainte est composite (company_id, reference).
    await db_session.flush()


@pytest.mark.asyncio
async def test_same_company_cannot_reuse_reference(db_session):
    """Doublon de référence dans la MÊME société → IntegrityError."""
    a = await _company(db_session, "a")
    ref = f"REFT-{uuid.uuid4().hex[:8]}"
    db_session.add(
        Property(
            id=uuid.uuid4(),
            company_id=a,
            reference=ref,
            type="apartment",
            price=1,
            status="available",
        )
    )
    await db_session.flush()
    db_session.add(
        Property(
            id=uuid.uuid4(), company_id=a, reference=ref, type="plot", price=3, status="available"
        )
    )
    with pytest.raises(IntegrityError):
        await db_session.flush()
