"""Service — niveaux d'assurance « UAE PASS Infinity » (Brique 2).

Persiste/recalcule le niveau d'assurance d'une identité. Le calcul délègue au
socle pur ``app.core.assurance`` ; ce module n'ajoute que la couche DB (Loi 1 :
toujours filtrer par ``company_id``). Pas d'endpoint ici — exposition (JWT/SSO)
en Brique 3.
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.assurance import VerificationState, assurance_level
from app.models.identity_assurance import IdentityAssurance

VALID_SUBJECT_TYPES: frozenset[str] = frozenset({"user", "client"})


def is_valid_subject_type(subject_type: str) -> bool:
    return subject_type in VALID_SUBJECT_TYPES


def _recompute_level(record: IdentityAssurance) -> str:
    """Recalcule le niveau d'assurance d'un enregistrement via le socle pur."""
    return assurance_level(
        VerificationState(
            email_verified=record.email_verified,
            mobile_verified=record.mobile_verified,
            emirates_id_verified=record.emirates_id_verified,
            strong_auth_verified=record.strong_auth_verified,
        )
    )


async def get_assurance(
    db: AsyncSession, company_id: uuid.UUID, subject_type: str, subject_id: uuid.UUID
) -> IdentityAssurance | None:
    """Enregistrement d'assurance d'une identité, ou ``None``. Scopé company_id (Loi 1)."""
    result = await db.execute(
        select(IdentityAssurance).where(
            IdentityAssurance.company_id == company_id,
            IdentityAssurance.subject_type == subject_type,
            IdentityAssurance.subject_id == subject_id,
        )
    )
    return result.scalar_one_or_none()


async def upsert_verification(
    db: AsyncSession,
    company_id: uuid.UUID,
    subject_type: str,
    subject_id: uuid.UUID,
    *,
    email_verified: bool | None = None,
    mobile_verified: bool | None = None,
    emirates_id_verified: bool | None = None,
    strong_auth_verified: bool | None = None,
) -> IdentityAssurance:
    """Pose/lève des preuves de vérification puis recalcule le niveau (idempotent).

    Seuls les drapeaux explicitement fournis (≠ None) sont modifiés ; les autres
    sont conservés. Crée l'enregistrement à la première preuve. Scopé company_id.
    """
    record = await get_assurance(db, company_id, subject_type, subject_id)
    if record is None:
        record = IdentityAssurance(
            company_id=company_id, subject_type=subject_type, subject_id=subject_id
        )
        db.add(record)
    if email_verified is not None:
        record.email_verified = email_verified
    if mobile_verified is not None:
        record.mobile_verified = mobile_verified
    if emirates_id_verified is not None:
        record.emirates_id_verified = emirates_id_verified
    if strong_auth_verified is not None:
        record.strong_auth_verified = strong_auth_verified
    record.level = _recompute_level(record)
    await db.commit()
    await db.refresh(record)
    return record
