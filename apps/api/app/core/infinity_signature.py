"""Signature qualifiée « maison » — UAE Infinity PASS (Brique 4).

Cœur cryptographique de preuve, **modélisé sur le QES** d'UAE PASS mais **opéré
par Infinity** : il lie un **document** (intégrité par SHA‑256), une **identité
signataire** (uuid + niveau d'assurance) et un **horodatage**, scellés par une
**signature serveur non‑forgeable** (HMAC‑SHA256 avec ``SECRET_KEY``). C'est la
base de la non‑répudiation.

Gardé par le **niveau d'assurance** (``app.core.assurance.can_sign``) : signature
avancée ⇒ L2, qualifiée ⇒ L3. Pur (sans DB) ; la persistance et le câblage aux
contrats/documents sont des étapes ultérieures.
"""

from __future__ import annotations

import hashlib
import hmac
import json
from datetime import datetime

from pydantic import BaseModel

from app.core.assurance import can_sign
from app.core.config import settings


def document_sha256(content: bytes) -> str:
    """Empreinte SHA‑256 (hex) d'un document — garantit l'intégrité du signé."""
    return hashlib.sha256(content).hexdigest()


class SignatureProof(BaseModel):
    """Preuve de signature scellée (non‑répudiable)."""

    document_sha256: str
    signer_uuid: str
    signer_level: str
    qualified: bool
    signed_at: str  # ISO 8601
    signature: str  # HMAC‑SHA256 du payload canonique


def _canonical_payload(
    *, document_sha256: str, signer_uuid: str, signer_level: str, qualified: bool, signed_at: str
) -> str:
    """Sérialisation canonique déterministe (clés triées) du contenu à sceller."""
    return json.dumps(
        {
            "document_sha256": document_sha256,
            "signer_uuid": signer_uuid,
            "signer_level": signer_level,
            "qualified": qualified,
            "signed_at": signed_at,
        },
        sort_keys=True,
        separators=(",", ":"),
    )


def _sign(payload: str) -> str:
    return hmac.new(settings.SECRET_KEY.encode(), payload.encode(), hashlib.sha256).hexdigest()


def sign_document(
    *,
    content_sha256: str,
    signer_uuid: str,
    signer_level: str,
    signed_at: datetime,
    qualified: bool = False,
) -> SignatureProof:
    """Produit une preuve de signature pour un document déjà haché.

    Lève ``ValueError("assurance_level_insufficient")`` si le niveau du signataire
    n'autorise pas ce type de signature (avancée ⇒ L2, qualifiée ⇒ L3)."""
    if not can_sign(signer_level, qualified=qualified):
        raise ValueError("assurance_level_insufficient")
    signed_at_iso = signed_at.isoformat()
    signature = _sign(
        _canonical_payload(
            document_sha256=content_sha256,
            signer_uuid=signer_uuid,
            signer_level=signer_level,
            qualified=qualified,
            signed_at=signed_at_iso,
        )
    )
    return SignatureProof(
        document_sha256=content_sha256,
        signer_uuid=signer_uuid,
        signer_level=signer_level,
        qualified=qualified,
        signed_at=signed_at_iso,
        signature=signature,
    )


def verify_proof(proof: SignatureProof, *, content_sha256: str | None = None) -> bool:
    """Vérifie l'intégrité + l'authenticité d'une preuve.

    Si ``content_sha256`` est fourni, vérifie aussi que le document n'a pas changé.
    Comparaison à temps constant."""
    if content_sha256 is not None and not hmac.compare_digest(
        proof.document_sha256, content_sha256
    ):
        return False
    expected = _sign(
        _canonical_payload(
            document_sha256=proof.document_sha256,
            signer_uuid=proof.signer_uuid,
            signer_level=proof.signer_level,
            qualified=proof.qualified,
            signed_at=proof.signed_at,
        )
    )
    return hmac.compare_digest(expected, proof.signature)
