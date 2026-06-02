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
