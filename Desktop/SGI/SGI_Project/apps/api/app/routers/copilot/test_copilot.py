"""Tests AI Copilot (Ph0-1) — helpers purs + orchestration `assist` (service)."""

from __future__ import annotations

import uuid

from app.routers.copilot import service
from app.routers.inbox import service as inbox_service
from app.routers.ticketing import service as ticketing_service

# ── Helpers purs ──────────────────────────────────────────────────────────


def test_detect_sentiment() -> None:
    assert service.detect_sentiment("Merci, c'est parfait !") == "positive"
    assert service.detect_sentiment("C'est un scandale, panne inacceptable") == "negative"
    assert service.detect_sentiment("Je cherche un appartement") == "neutral"
    # Multilingue
    assert service.detect_sentiment("شكرا جزيلا") == "positive"
    assert service.detect_sentiment("thanks, great service") == "positive"


def test_detect_sentiment_no_substring_false_positive() -> None:
    """Régression : « content » ⊂ « mécontent », « satisfait » ⊂ « insatisfait »
    ne doivent PAS annuler/inverser le sentiment (matching par mot, pas sous-chaîne)."""
    assert service.detect_sentiment("je suis mécontent") == "negative"
    assert service.detect_sentiment("client insatisfait du service") == "negative"
    assert service.detect_sentiment("I am dissatisfied") == "negative"


def test_detect_intent() -> None:
    assert service.detect_intent("Je veux acheter une villa") == "buy"
    assert service.detect_intent("Je cherche une location") == "rent"
    assert service.detect_intent("Puis-je organiser une visite ?") == "visit"
    assert service.detect_intent("J'ai un problème, je fais une réclamation") == "complaint"
    assert service.detect_intent("Question sur mon paiement / facture") == "payment"
    assert service.detect_intent("Bonjour") == "info"


def test_detect_intent_rent_not_payment_multilang() -> None:
    """Régression : une demande de location EN/AR ne doit pas être classée `payment`
    (les mots « rent »/« إيجار » ne sont plus dans le set payment)."""
    assert service.detect_intent("I want to rent an apartment") == "rent"
    assert service.detect_intent("أريد إيجار شقة") == "rent"


def test_next_best_actions() -> None:
    # buy → listing + visite + relance
    assert service.next_best_actions("buy", "neutral") == [
        "send_listing",
        "schedule_visit",
        "follow_up",
    ]
    # sentiment négatif → escalade forcée en tête, sans doublon
    nba = service.next_best_actions("complaint", "negative")
    assert nba[0] == "escalate"
    assert len(nba) == len(set(nba))


def test_heuristic_reply_locale() -> None:
    fr = service.heuristic_reply("buy", "neutral", "fr")
    assert "achat" in fr.lower()
    en = service.heuristic_reply("visit", "neutral", "en")
    assert "viewing" in en.lower()
    # négatif → excuse
    neg = service.heuristic_reply("complaint", "negative", "fr")
    assert "navrés" in neg.lower()


def test_heuristic_summary() -> None:
    s = service.heuristic_summary("Client: bonjour\nAgent: bonjour", 2)
    assert "2 message" in s
    assert service.heuristic_summary("", 0).startswith("0 message")


# ── Orchestration assist (service, DB) ──────────────────────────────────────


async def test_assist_ticket_fallback(db_session, seed_company) -> None:
    """Sans clé Gemini → repli déterministe (engine=fallback) ; intention déduite."""
    cid = seed_company.id
    t = await ticketing_service.create_ticket(
        db_session, cid, subject="Problème de climatisation, réclamation urgente", priority="high"
    )
    out = await service.assist(
        db_session,
        cid,
        context_type="ticket",
        context_id=t.id,
        agent_id=uuid.uuid4(),
        role="admin",
    )
    assert out is not None
    assert out["intent"] == "complaint"
    assert out["sentiment"] == "negative"
    assert "escalate" in out["next_best_actions"]
    assert out["suggested_reply"]  # non vide (repli heuristique)
    assert out["summary"]


async def test_assist_inbox_intent(db_session, seed_company) -> None:
    cid = seed_company.id
    conv, _ = await inbox_service.get_or_create_conversation(
        db_session, cid, channel="whatsapp", external_thread_id=f"wa-{uuid.uuid4().hex[:8]}"
    )
    await inbox_service.add_message(
        db_session, cid, conv, direction="inbound", body="Bonjour, je veux acheter un appartement"
    )
    await db_session.commit()
    out = await service.assist(
        db_session,
        cid,
        context_type="inbox",
        context_id=conv.id,
        agent_id=uuid.uuid4(),
        role="admin",
    )
    assert out is not None
    assert out["intent"] == "buy"
    assert out["channel"] == "whatsapp"


async def test_assist_unknown_returns_none(db_session, seed_company) -> None:
    out = await service.assist(
        db_session,
        seed_company.id,
        context_type="ticket",
        context_id=uuid.uuid4(),
        agent_id=uuid.uuid4(),
        role="admin",
    )
    assert out is None


async def test_assist_agent_anti_bola(db_session, seed_admin) -> None:
    """Un agent ne peut pas assister un ticket qui ne lui est pas assigné → None."""
    admin, _ = seed_admin
    cid = admin.company_id
    t = await ticketing_service.create_ticket(db_session, cid, subject="Demande info")
    # Ticket non assigné, rôle agent (id quelconque) → invisible.
    out = await service.assist(
        db_session,
        cid,
        context_type="ticket",
        context_id=t.id,
        agent_id=uuid.uuid4(),
        role="agent",
    )
    assert out is None


# ── Assistant in-app (chat) — helpers purs ────────────────────────────────


def test_suggest_navigation_keyword_match() -> None:
    nav = service.suggest_navigation("Comment créer un nouveau prospect dans le CRM ?", "fr")
    screens = [n["screen"] for n in nav]
    assert "crm" in screens
    # Libellé localisé.
    assert nav[0]["label"] == "CRM / Prospects"


def test_suggest_navigation_multilingue_et_borne() -> None:
    # EN
    assert any(
        n["screen"] == "realestate_payments"
        for n in service.suggest_navigation("show overdue payments", "en")
    )
    # AR
    ar = service.suggest_navigation("أين العقارات المتاحة؟", "ar")
    assert any(n["screen"] == "realestate" for n in ar)
    assert ar[0]["label"] == "العقارات"
    # Borné à 3 même si le message déclenche plus d'écrans.
    many = service.suggest_navigation(
        "crm biens paiements contrats tickets maintenance owners tenants", "fr"
    )
    assert len(many) <= 3


def test_suggest_navigation_no_false_positive_substring() -> None:
    # « rent » ne doit pas matcher dans « parent » (matching par mot entier).
    assert service.suggest_navigation("my parent called", "en") == []


def test_data_summary_localise() -> None:
    snap = {"leads_total": 12, "properties_available": 3}
    fr = service._data_summary("fr", snap)
    assert "12 prospects au total" in fr and "3 biens disponibles" in fr
    en = service._data_summary("en", snap)
    assert "12 total leads" in en
    ar = service._data_summary("ar", snap)
    assert "12" in ar and "إجمالي الفرص" in ar


def test_heuristic_chat_reply_data_question() -> None:
    snap = {"leads_total": 5}
    out = service.heuristic_chat_reply("Combien de prospects ai-je ?", "fr", snap, [])
    assert "5 prospects au total" in out


def test_heuristic_chat_reply_data_question_how_many() -> None:
    snap = {"properties_total": 7}
    out = service.heuristic_chat_reply("how many properties do we have", "en", snap, [])
    assert "7 properties" in out


def test_heuristic_chat_reply_generic_with_nav() -> None:
    nav = [{"screen": "crm", "label": "CRM / Prospects"}]
    out = service.heuristic_chat_reply("aide moi", "fr", {}, nav)
    assert "CRM / Prospects" in out and "assistant SGI" in out


def test_heuristic_chat_reply_locale_invalide_retombe_fr() -> None:
    out = service.heuristic_chat_reply("hello", "xx", {}, [])  # type: ignore[arg-type]
    assert "assistant SGI" in out


# ── Assistant in-app (chat) — orchestration avec DB ───────────────────────


async def test_gather_tenant_snapshot_counts_keys(db_session, seed_company) -> None:
    cid = seed_company.id
    snap = await service.gather_tenant_snapshot(db_session, cid)
    # Tenant frais : les compteurs existent (la requête s'exécute) et valent 0.
    for key in ("leads_total", "properties_total", "payments_overdue"):
        assert snap.get(key) == 0


async def test_chat_uses_gemini_when_available(db_session, seed_company, monkeypatch) -> None:
    """Branche succès : si generate_chat renvoie du texte, on le relaie + engine."""

    async def _fake_chat(messages, **kwargs):  # type: ignore[no-untyped-def]
        return {"text": "Voici comment créer un prospect…", "engine": "gemini-2.5-flash"}

    monkeypatch.setattr(service, "generate_chat", _fake_chat)
    out = await service.chat(
        db_session,
        seed_company.id,
        messages=[{"role": "user", "content": "créer un prospect crm"}],
        locale="fr",
        screen="crm",
    )
    assert out["engine"] == "gemini-2.5-flash"
    assert out["reply"].startswith("Voici comment")
    # La navigation reste déterministe (indépendante de Gemini).
    assert any(n["screen"] == "crm" for n in out["suggested_navigation"])


async def test_chat_fallback_when_gemini_unavailable(db_session, seed_company, monkeypatch) -> None:
    async def _empty_chat(messages, **kwargs):  # type: ignore[no-untyped-def]
        return {"text": "", "engine": "unavailable"}

    monkeypatch.setattr(service, "generate_chat", _empty_chat)
    out = await service.chat(
        db_session,
        seed_company.id,
        messages=[{"role": "user", "content": "bonjour"}],
        locale="fr",
    )
    assert out["engine"] == "fallback"
    assert "assistant SGI" in out["reply"]
