"""Tests — signature qualifiée maison (UAE PASS Infinity, Brique 4). Purs."""

from __future__ import annotations

from datetime import UTC, datetime

import pytest

from app.core import infinity_signature as sig

_NOW = datetime(2026, 6, 6, 12, 0, tzinfo=UTC)


def test_document_sha256_stable() -> None:
    assert sig.document_sha256(b"hello") == sig.document_sha256(b"hello")
    assert sig.document_sha256(b"hello") != sig.document_sha256(b"world")


def test_sign_then_verify_roundtrip() -> None:
    doc = sig.document_sha256(b"contrat de bail")
    proof = sig.sign_document(
        content_sha256=doc, signer_uuid="u-1", signer_level="L2", signed_at=_NOW
    )
    assert proof.qualified is False
    assert proof.signer_level == "L2"
    assert sig.verify_proof(proof) is True
    assert sig.verify_proof(proof, content_sha256=doc) is True


def test_qualified_requires_l3() -> None:
    doc = sig.document_sha256(b"x")
    # L2 ne peut pas produire une signature QUALIFIÉE (L3 requis).
    with pytest.raises(ValueError, match="assurance_level_insufficient"):
        sig.sign_document(
            content_sha256=doc, signer_uuid="u", signer_level="L2", signed_at=_NOW, qualified=True
        )
    # L3 le peut.
    proof = sig.sign_document(
        content_sha256=doc, signer_uuid="u", signer_level="L3", signed_at=_NOW, qualified=True
    )
    assert proof.qualified is True
    assert sig.verify_proof(proof) is True


def test_l1_cannot_sign() -> None:
    with pytest.raises(ValueError, match="assurance_level_insufficient"):
        sig.sign_document(
            content_sha256=sig.document_sha256(b"x"),
            signer_uuid="u",
            signer_level="L1",
            signed_at=_NOW,
        )


def test_verify_fails_on_tampered_document() -> None:
    proof = sig.sign_document(
        content_sha256=sig.document_sha256(b"original"),
        signer_uuid="u-1",
        signer_level="L2",
        signed_at=_NOW,
    )
    # Document modifié → l'empreinte fournie ne correspond plus.
    assert sig.verify_proof(proof, content_sha256=sig.document_sha256(b"tampered")) is False


def test_verify_fails_on_tampered_proof() -> None:
    proof = sig.sign_document(
        content_sha256=sig.document_sha256(b"d"),
        signer_uuid="u-1",
        signer_level="L2",
        signed_at=_NOW,
    )
    # Falsification d'un champ scellé (l'identité) sans re‑signer → invalide.
    forged = proof.model_copy(update={"signer_uuid": "attacker"})
    assert sig.verify_proof(forged) is False

    # Signature trafiquée → invalide.
    forged2 = proof.model_copy(update={"signature": "0" * 64})
    assert sig.verify_proof(forged2) is False
