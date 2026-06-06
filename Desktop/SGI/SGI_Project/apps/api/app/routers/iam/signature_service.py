"""Service — preuves de signature qualifiée (Infinity ID).

Couche DB au-dessus du cœur pur ``app.core.infinity_signature`` : crée, récupère
et vérifie des preuves persistées. Loi 1 : toujours scopé ``company_id``.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.infinity_signature import SignatureProof, sign_document, verify_proof
from app.models.signature_proof import SignatureProofRecord


async def create_signature(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    signer_subject_type: str,
    signer_subject_id: uuid.UUID,
    content_sha256: str,
    signer_level: str,
    signed_at: datetime,
    qualified: bool = False,
) -> SignatureProofRecord:
    """Produit (cœur pur) puis persiste une preuve de signature.

    Lève ``ValueError`` (via ``sign_document``) si le niveau n'autorise pas ce type
    de signature — le caller doit garder l'action en amont (assert_assurance)."""
    # Tronque à la seconde : l'aller-retour DB (timestamptz) est alors déterministe,
    # donc la re-vérification (HMAC sur signed_at.isoformat()) reste valide.
    signed_at = signed_at.replace(microsecond=0)
    proof = sign_document(
        content_sha256=content_sha256,
        signer_uuid=str(signer_subject_id),
        signer_level=signer_level,
        signed_at=signed_at,
        qualified=qualified,
    )
    record = SignatureProofRecord(
        company_id=company_id,
        signer_subject_type=signer_subject_type,
        signer_subject_id=signer_subject_id,
        document_sha256=proof.document_sha256,
        qualified=proof.qualified,
        signer_level=proof.signer_level,
        signed_at=signed_at,
        signature=proof.signature,
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return record


async def get_signature(
    db: AsyncSession, company_id: uuid.UUID, signature_id: uuid.UUID
) -> SignatureProofRecord | None:
    """Preuve persistée par id, ou ``None``. Scopé company_id (Loi 1)."""
    result = await db.execute(
        select(SignatureProofRecord).where(
            SignatureProofRecord.id == signature_id,
            SignatureProofRecord.company_id == company_id,
        )
    )
    return result.scalar_one_or_none()


def verify_record(record: SignatureProofRecord, *, content_sha256: str | None = None) -> bool:
    """Revérifie l'authenticité/intégrité d'une preuve persistée."""
    proof = SignatureProof(
        document_sha256=record.document_sha256,
        signer_uuid=str(record.signer_subject_id),
        signer_level=record.signer_level,
        qualified=record.qualified,
        signed_at=record.signed_at.isoformat(),
        signature=record.signature,
    )
    return verify_proof(proof, content_sha256=content_sha256)
