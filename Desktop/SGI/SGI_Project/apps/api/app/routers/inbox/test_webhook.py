"""Tests du webhook WhatsApp inbound (Ph3).

- **Parsing pur** : `extract_whatsapp_messages` sur payloads valides, partiels,
  statuts, types non-texte, interactif/bouton — sans réseau.
- **Résolution tenant** : `resolve_company_id` via le mapping env.
- **Signature Meta** : `verify_meta_signature` (best-effort + HMAC).
- **HTTP** : challenge GET, ingestion POST + dédup, tenant inconnu ignoré.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid

from httpx import AsyncClient

from app.routers.inbox import service, webhook

# ─────────────────────────────────────────────────────────────────────────
# Helper pur — extract_whatsapp_messages
# ─────────────────────────────────────────────────────────────────────────


def _text_payload(msg_id: str = "wamid.AAA", sender: str = "971500000000") -> dict:
    return {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messaging_product": "whatsapp",
                            "metadata": {"phone_number_id": "PNID-1"},
                            "contacts": [{"wa_id": sender, "profile": {"name": "Ali"}}],
                            "messages": [
                                {
                                    "id": msg_id,
                                    "from": sender,
                                    "timestamp": "1717322400",
                                    "type": "text",
                                    "text": {"body": "Salam"},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }


def test_extract_text_message() -> None:
    out = webhook.extract_whatsapp_messages(_text_payload())
    assert len(out) == 1
    m = out[0]
    assert m["external_message_id"] == "wamid.AAA"
    assert m["from"] == "971500000000"
    assert m["text"] == "Salam"
    assert m["timestamp"] == "1717322400"
    assert m["phone_number_id"] == "PNID-1"
    assert m["contact_name"] == "Ali"


def test_extract_multiple_messages_and_changes() -> None:
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {"phone_number_id": "PNID-1"},
                            "messages": [
                                {"id": "m1", "from": "111", "text": {"body": "A"}},
                                {"id": "m2", "from": "222", "text": {"body": "B"}},
                            ],
                        }
                    }
                ]
            }
        ]
    }
    out = webhook.extract_whatsapp_messages(payload)
    assert [m["external_message_id"] for m in out] == ["m1", "m2"]


def test_extract_status_event_yields_nothing() -> None:
    # Event de statut (delivered/read) : pas de clé `messages`.
    payload = {"entry": [{"changes": [{"value": {"statuses": [{"id": "m1", "status": "read"}]}}]}]}
    assert webhook.extract_whatsapp_messages(payload) == []


def test_extract_non_text_message_keeps_message_with_null_text() -> None:
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "metadata": {"phone_number_id": "PNID-1"},
                            "messages": [
                                {
                                    "id": "img-1",
                                    "from": "333",
                                    "type": "image",
                                    "image": {"id": "media-1"},
                                }
                            ],
                        }
                    }
                ]
            }
        ]
    }
    out = webhook.extract_whatsapp_messages(payload)
    assert len(out) == 1 and out[0]["text"] is None


def test_extract_interactive_and_button() -> None:
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {
                                    "id": "b1",
                                    "from": "1",
                                    "type": "button",
                                    "button": {"text": "Oui"},
                                },
                                {
                                    "id": "i1",
                                    "from": "2",
                                    "type": "interactive",
                                    "interactive": {"button_reply": {"id": "x", "title": "Voir"}},
                                },
                            ]
                        }
                    }
                ]
            }
        ]
    }
    out = webhook.extract_whatsapp_messages(payload)
    assert out[0]["text"] == "Oui"
    assert out[1]["text"] == "Voir"


def test_extract_skips_message_without_id_or_from() -> None:
    payload = {
        "entry": [
            {
                "changes": [
                    {
                        "value": {
                            "messages": [
                                {"from": "1", "text": {"body": "no id"}},
                                {"id": "m1", "text": {"body": "no from"}},
                            ]
                        }
                    }
                ]
            }
        ]
    }
    assert webhook.extract_whatsapp_messages(payload) == []


def test_extract_robust_to_garbage() -> None:
    assert webhook.extract_whatsapp_messages({}) == []
    assert webhook.extract_whatsapp_messages({"entry": "nope"}) == []  # type: ignore[arg-type]
    assert webhook.extract_whatsapp_messages({"entry": [None]}) == []  # type: ignore[list-item]
    assert webhook.extract_whatsapp_messages([]) == []  # type: ignore[arg-type]


# ─────────────────────────────────────────────────────────────────────────
# resolve_company_id
# ─────────────────────────────────────────────────────────────────────────


def test_resolve_company_id_from_env(monkeypatch) -> None:
    cid = uuid.uuid4()
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_MAP", json.dumps({"PNID-1": str(cid)}))
    assert webhook.resolve_company_id("PNID-1") == cid
    assert webhook.resolve_company_id("UNKNOWN") is None
    assert webhook.resolve_company_id(None) is None


def test_resolve_company_id_invalid_configs(monkeypatch) -> None:
    monkeypatch.delenv("WHATSAPP_PHONE_NUMBER_MAP", raising=False)
    assert webhook.resolve_company_id("PNID-1") is None  # non configuré
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_MAP", "{not-json")
    assert webhook.resolve_company_id("PNID-1") is None  # JSON invalide
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_MAP", json.dumps({"PNID-1": "not-a-uuid"}))
    assert webhook.resolve_company_id("PNID-1") is None  # UUID invalide


# ─────────────────────────────────────────────────────────────────────────
# verify_meta_signature
# ─────────────────────────────────────────────────────────────────────────


def test_verify_signature_best_effort_when_no_secret(monkeypatch) -> None:
    # Dev (REQUIRE non posé) + pas de secret → best-effort : accepte.
    monkeypatch.delenv("WHATSAPP_APP_SECRET", raising=False)
    monkeypatch.delenv("WHATSAPP_REQUIRE_SIGNATURE", raising=False)
    assert webhook.verify_meta_signature(b"{}", None) is True


def test_verify_signature_required_no_secret_rejects(monkeypatch) -> None:
    # Prod (REQUIRE=true) SANS secret → fail-closed : on refuse (jamais True).
    monkeypatch.delenv("WHATSAPP_APP_SECRET", raising=False)
    monkeypatch.setenv("WHATSAPP_REQUIRE_SIGNATURE", "true")
    assert webhook.verify_meta_signature(b"{}", None) is False
    assert webhook.verify_meta_signature(b"{}", "sha256=whatever") is False


def test_verify_signature_required_with_valid_sig(monkeypatch) -> None:
    # Prod (REQUIRE=true) AVEC secret + signature valide → accepte.
    monkeypatch.setenv("WHATSAPP_REQUIRE_SIGNATURE", "true")
    monkeypatch.setenv("WHATSAPP_APP_SECRET", "topsecret")
    body = b'{"hello":"world"}'
    good = "sha256=" + hmac.new(b"topsecret", body, hashlib.sha256).hexdigest()
    assert webhook.verify_meta_signature(body, good) is True
    assert webhook.verify_meta_signature(body, "sha256=deadbeef") is False


def test_verify_signature_hmac(monkeypatch) -> None:
    monkeypatch.delenv("WHATSAPP_REQUIRE_SIGNATURE", raising=False)
    monkeypatch.setenv("WHATSAPP_APP_SECRET", "topsecret")
    body = b'{"hello":"world"}'
    good = "sha256=" + hmac.new(b"topsecret", body, hashlib.sha256).hexdigest()
    assert webhook.verify_meta_signature(body, good) is True
    assert webhook.verify_meta_signature(body, "sha256=deadbeef") is False
    assert webhook.verify_meta_signature(body, None) is False


# ─────────────────────────────────────────────────────────────────────────
# HTTP — GET challenge
# ─────────────────────────────────────────────────────────────────────────


async def test_get_challenge_ok(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "verif-123")
    resp = await client.get(
        "/api/v1/inbox/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "verif-123",
            "hub.challenge": "CHAL-42",
        },
    )
    assert resp.status_code == 200
    assert resp.text == "CHAL-42"


async def test_get_challenge_wrong_token(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.setenv("WHATSAPP_VERIFY_TOKEN", "verif-123")
    resp = await client.get(
        "/api/v1/inbox/webhook/whatsapp",
        params={
            "hub.mode": "subscribe",
            "hub.verify_token": "WRONG",
            "hub.challenge": "CHAL-42",
        },
    )
    assert resp.status_code == 403


# ─────────────────────────────────────────────────────────────────────────
# HTTP — POST ingestion + dédup + tenant inconnu
# ─────────────────────────────────────────────────────────────────────────


async def test_post_unknown_tenant_is_ignored(client: AsyncClient, monkeypatch) -> None:
    monkeypatch.delenv("WHATSAPP_PHONE_NUMBER_MAP", raising=False)
    monkeypatch.delenv("WHATSAPP_APP_SECRET", raising=False)
    resp = await client.post("/api/v1/inbox/webhook/whatsapp", json=_text_payload())
    assert resp.status_code == 200
    assert resp.json()["data"]["skipped_no_tenant"] == 1


async def test_post_ingests_and_dedupes(
    client: AsyncClient, db_session, seed_company, monkeypatch
) -> None:
    cid = seed_company.id
    monkeypatch.setenv("WHATSAPP_PHONE_NUMBER_MAP", json.dumps({"PNID-1": str(cid)}))
    monkeypatch.delenv("WHATSAPP_APP_SECRET", raising=False)
    # Neutralise la dédup Valkey (pas de broker en test) : l'idempotence DB suffit.
    monkeypatch.setattr(webhook, "_already_processed", _never_processed)

    payload = _text_payload(msg_id="wamid.DEDUP", sender="971599999999")

    r1 = await client.post("/api/v1/inbox/webhook/whatsapp", json=payload)
    assert r1.status_code == 200
    assert r1.json()["data"]["ingested"] == 1

    # Rejeu du MÊME payload : dédup via external_message_id (add_message idempotent).
    r2 = await client.post("/api/v1/inbox/webhook/whatsapp", json=payload)
    assert r2.json()["data"]["ingested"] == 0
    assert r2.json()["data"]["deduped"] == 1

    # Vérifie côté DB : une seule conversation, un seul message pour ce tenant.
    rows, total = await service.list_conversations(db_session, cid)
    assert total == 1
    conv = rows[0]
    assert conv.channel == "whatsapp"
    assert conv.external_thread_id == "971599999999"
    assert conv.contact_display == "Ali"


async def _never_processed(external_message_id: str) -> bool:
    """Stub : court-circuite la dédup Valkey pour les tests d'intégration HTTP."""
    return False


async def test_post_required_signature_rejects_unsigned(client: AsyncClient, monkeypatch) -> None:
    """Prod (REQUIRE=true) sans secret/signature → payload ignoré (fail-closed)."""
    monkeypatch.delenv("WHATSAPP_APP_SECRET", raising=False)
    monkeypatch.setenv("WHATSAPP_REQUIRE_SIGNATURE", "true")
    resp = await client.post("/api/v1/inbox/webhook/whatsapp", json=_text_payload())
    assert resp.status_code == 200  # Meta ne doit jamais recevoir d'erreur.
    assert resp.json()["data"] == {"ignored": "invalid_signature"}
