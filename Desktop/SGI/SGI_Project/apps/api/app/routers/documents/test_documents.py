"""Tests unitaires — helpers métier purs du module documents."""
import uuid

import pytest

from app.routers.documents.service import (
    all_signatures_complete,
    build_document_key,
    compute_sha256,
    compute_signature_hash,
    extension_for_doc_mime,
    is_supported_mime,
    is_valid_doc_type,
    is_valid_document_status,
    is_valid_signature_transition,
    next_version_number,
)


class TestComputeSha256:
    def test_known_vector_empty(self) -> None:
        # SHA-256 du contenu vide (vecteur de référence).
        assert compute_sha256(b"") == (
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        )

    def test_deterministic(self) -> None:
        assert compute_sha256(b"hello") == compute_sha256(b"hello")

    def test_differs_by_content(self) -> None:
        assert compute_sha256(b"a") != compute_sha256(b"b")

    def test_length_is_64_hex(self) -> None:
        digest = compute_sha256(b"contract content")
        assert len(digest) == 64
        assert all(c in "0123456789abcdef" for c in digest)


class TestNextVersionNumber:
    def test_empty_starts_at_1(self) -> None:
        assert next_version_number([]) == 1

    def test_increments_from_max(self) -> None:
        assert next_version_number([1, 2, 3]) == 4

    def test_uses_max_not_count(self) -> None:
        assert next_version_number([1, 5]) == 6


class TestExtensionAndMime:
    @pytest.mark.parametrize("mime,ext", [
        ("application/pdf", "pdf"),
        ("image/jpeg", "jpg"),
        ("image/png", "png"),
        ("image/webp", "webp"),
        ("application/msword", "doc"),
        ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"),
    ])
    def test_supported_mimes(self, mime: str, ext: str) -> None:
        assert extension_for_doc_mime(mime) == ext
        assert is_supported_mime(mime) is True

    def test_mime_with_charset_suffix(self) -> None:
        assert extension_for_doc_mime("application/pdf; charset=binary") == "pdf"

    @pytest.mark.parametrize("mime", ["", "text/plain", "video/mp4", "application/zip"])
    def test_unsupported_mimes(self, mime: str) -> None:
        assert extension_for_doc_mime(mime) is None
        assert is_supported_mime(mime) is False


class TestBuildDocumentKey:
    def test_key_format(self) -> None:
        cid = uuid.UUID("11111111-1111-1111-1111-111111111111")
        did = uuid.UUID("22222222-2222-2222-2222-222222222222")
        key = build_document_key(cid, did, 3, "pdf")
        assert key == f"documents/{cid}/{did}/v3.pdf"


class TestSignatureTransition:
    @pytest.mark.parametrize("target", ["signed", "declined", "expired"])
    def test_pending_can_go_anywhere_terminal(self, target: str) -> None:
        assert is_valid_signature_transition("pending", target) is True

    @pytest.mark.parametrize("current", ["signed", "declined", "expired"])
    def test_terminal_states_are_locked(self, current: str) -> None:
        assert is_valid_signature_transition(current, "signed") is False
        assert is_valid_signature_transition(current, "pending") is False

    def test_unknown_state(self) -> None:
        assert is_valid_signature_transition("bogus", "signed") is False


class TestComputeSignatureHash:
    def test_deterministic_for_same_inputs(self) -> None:
        a = compute_signature_hash("abc", "john@x.ae", "2026-05-30T10:00:00+00:00")
        b = compute_signature_hash("abc", "john@x.ae", "2026-05-30T10:00:00+00:00")
        assert a == b

    def test_changes_with_version(self) -> None:
        a = compute_signature_hash("v1", "john@x.ae", "2026-05-30T10:00:00+00:00")
        b = compute_signature_hash("v2", "john@x.ae", "2026-05-30T10:00:00+00:00")
        assert a != b

    def test_changes_with_signer(self) -> None:
        a = compute_signature_hash("abc", "john@x.ae", "2026-05-30T10:00:00+00:00")
        b = compute_signature_hash("abc", "jane@x.ae", "2026-05-30T10:00:00+00:00")
        assert a != b

    def test_changes_with_timestamp(self) -> None:
        a = compute_signature_hash("abc", "john@x.ae", "2026-05-30T10:00:00+00:00")
        b = compute_signature_hash("abc", "john@x.ae", "2026-05-30T11:00:00+00:00")
        assert a != b

    def test_is_64_hex(self) -> None:
        h = compute_signature_hash("abc", "john@x.ae", "2026-05-30T10:00:00+00:00")
        assert len(h) == 64


class TestAllSignaturesComplete:
    def test_empty_is_not_complete(self) -> None:
        assert all_signatures_complete([]) is False

    def test_all_signed(self) -> None:
        assert all_signatures_complete(["signed", "signed"]) is True

    def test_one_pending_blocks(self) -> None:
        assert all_signatures_complete(["signed", "pending"]) is False

    def test_declined_blocks(self) -> None:
        assert all_signatures_complete(["signed", "declined"]) is False


class TestValidators:
    @pytest.mark.parametrize("dt", ["contract", "mandate", "ejari", "dld", "other"])
    def test_valid_doc_types(self, dt: str) -> None:
        assert is_valid_doc_type(dt) is True

    @pytest.mark.parametrize("dt", ["", "bogus", "Contract"])
    def test_invalid_doc_types(self, dt: str) -> None:
        assert is_valid_doc_type(dt) is False

    @pytest.mark.parametrize("st", ["draft", "active", "signed", "archived"])
    def test_valid_statuses(self, st: str) -> None:
        assert is_valid_document_status(st) is True

    @pytest.mark.parametrize("st", ["", "pending", "deleted"])
    def test_invalid_statuses(self, st: str) -> None:
        assert is_valid_document_status(st) is False
