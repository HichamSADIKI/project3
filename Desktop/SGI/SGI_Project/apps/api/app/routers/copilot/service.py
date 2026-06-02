"""Service AI Copilot — assistance agent.

- **Helpers purs** (sans DB ni I/O, multilingue AR/EN/FR) : sentiment, intention,
  next-best-actions, brouillon de repli heuristique, résumé heuristique. Ils
  servent AUSSI de repli quand Gemini est indisponible.
- **Context gatherers** (DB) : agrègent le fil d'une conversation inbox ou d'un
  ticket, filtrés par `company_id` (Loi 1) + visibilité agent (anti-BOLA).
- **Orchestration** : `assist()` combine contexte + Gemini (repli helpers purs).
"""

from __future__ import annotations

import uuid
from typing import Any, Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.gemini import Locale, generate_text
from app.routers.inbox.models import InboxConversation, InboxMessage
from app.routers.ticketing.models import ServiceTicket, ServiceTicketEvent

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs (sans DB) — repli déterministe sans IA
# ─────────────────────────────────────────────────────────────────────────

Sentiment = Literal["positive", "neutral", "negative"]
ContextType = Literal["inbox", "ticket"]

INTENTS: tuple[str, ...] = ("buy", "rent", "complaint", "visit", "payment", "info")

# Codes d'action (le front mappe vers un libellé i18n `copilot_action_{code}`).
ACTIONS: tuple[str, ...] = (
    "schedule_visit",
    "send_listing",
    "escalate",
    "request_payment",
    "share_info",
    "follow_up",
)

# Mots-clés multilingues (AR/EN/FR) — minuscules, recherche par sous-chaîne.
_NEGATIVE_WORDS: frozenset[str] = frozenset(
    {
        # FR
        "problème",
        "panne",
        "retard",
        "mécontent",
        "inacceptable",
        "scandaleux",
        "jamais",
        "nul",
        "arnaque",
        "plainte",
        "réclamation",
        "urgent",
        "fuite",
        # EN
        "problem",
        "broken",
        "delay",
        "unhappy",
        "unacceptable",
        "terrible",
        "never",
        "scam",
        "complaint",
        "leak",
        "angry",
        "refund",
        # AR
        "مشكلة",
        "عطل",
        "تأخير",
        "غاضب",
        "سيئ",
        "شكوى",
        "عاجل",
        "تسريب",
    }
)
_POSITIVE_WORDS: frozenset[str] = frozenset(
    {
        # FR
        "merci",
        "parfait",
        "excellent",
        "super",
        "content",
        "satisfait",
        "génial",
        # EN
        "thanks",
        "thank you",
        "perfect",
        "great",
        "happy",
        "satisfied",
        # AR
        "شكرا",
        "ممتاز",
        "رائع",
        "سعيد",
        "راضٍ",
        "جميل",
    }
)

# Intention → mots déclencheurs (ordre = priorité de désambiguïsation).
_INTENT_KEYWORDS: dict[str, frozenset[str]] = {
    "complaint": frozenset(
        {
            "problème",
            "panne",
            "réclamation",
            "plainte",
            "problem",
            "complaint",
            "broken",
            "refund",
            "مشكلة",
            "شكوى",
            "عطل",
        }
    ),
    "payment": frozenset(
        {
            "paiement",
            "payer",
            "facture",
            "loyer",
            "chèque",
            "virement",
            "payment",
            "invoice",
            "rent",
            "cheque",
            "transfer",
            "دفع",
            "فاتورة",
            "إيجار",
            "شيك",
        }
    ),
    "visit": frozenset(
        {
            "visite",
            "visiter",
            "rendez-vous",
            "rdv",
            "voir",
            "visit",
            "viewing",
            "appointment",
            "زيارة",
            "موعد",
            "معاينة",
        }
    ),
    "rent": frozenset({"location", "louer", "bail", "rent", "rental", "lease", "إيجار", "تأجير"}),
    "buy": frozenset(
        {"acheter", "achat", "vente", "vendre", "buy", "purchase", "sale", "شراء", "بيع"}
    ),
}


def detect_sentiment(text: str) -> Sentiment:
    """Sentiment grossier par mots-clés (repli sans IA). Négatif l'emporte."""
    low = (text or "").lower()
    neg = sum(1 for w in _NEGATIVE_WORDS if w in low)
    pos = sum(1 for w in _POSITIVE_WORDS if w in low)
    if neg > pos:
        return "negative"
    if pos > neg:
        return "positive"
    return "neutral"


def detect_intent(text: str) -> str:
    """Intention dominante par mots-clés. Défaut `info` si rien ne matche."""
    low = (text or "").lower()
    for intent, words in _INTENT_KEYWORDS.items():
        if any(w in low for w in words):
            return intent
    return "info"


def next_best_actions(intent: str, sentiment: Sentiment) -> list[str]:
    """Actions suggérées (codes) selon intention + sentiment. Sans doublon, ordonné.

    Un sentiment négatif force l'escalade en tête (priorité de désamorçage).
    """
    by_intent: dict[str, list[str]] = {
        "buy": ["send_listing", "schedule_visit", "follow_up"],
        "rent": ["send_listing", "schedule_visit", "follow_up"],
        "visit": ["schedule_visit", "follow_up"],
        "complaint": ["escalate", "follow_up"],
        "payment": ["request_payment", "share_info"],
        "info": ["share_info", "follow_up"],
    }
    actions = list(by_intent.get(intent, ["share_info", "follow_up"]))
    if sentiment == "negative" and "escalate" not in actions:
        actions.insert(0, "escalate")
    # Dédoublonnage en conservant l'ordre.
    seen: set[str] = set()
    ordered: list[str] = []
    for a in actions:
        if a not in seen:
            seen.add(a)
            ordered.append(a)
    return ordered


def heuristic_reply(intent: str, sentiment: Sentiment, locale: Locale = "fr") -> str:
    """Brouillon de réponse poli, déterministe (repli quand Gemini est absent)."""
    apologize = sentiment == "negative"
    templates: dict[Locale, dict[str, str]] = {
        "fr": {
            "open": "Nous sommes navrés pour la gêne occasionnée. "
            if apologize
            else "Bonjour, merci de votre message. ",
            "buy": "Nous avons bien noté votre projet d'achat ; je vous propose une "
            "sélection de biens adaptés et reste à votre disposition.",
            "rent": "Nous avons bien noté votre demande de location ; je vous transmets "
            "des biens correspondant à vos critères.",
            "visit": "Je peux organiser une visite : indiquez-moi vos disponibilités et "
            "je confirme un créneau.",
            "complaint": "Votre réclamation est prise en charge en priorité ; un "
            "responsable revient vers vous très vite.",
            "payment": "Concernant votre paiement, je vous transmets les modalités et "
            "l'échéancier détaillés.",
            "info": "Je reste à votre disposition pour toute information complémentaire.",
        },
        "en": {
            "open": "We're sorry for the inconvenience. "
            if apologize
            else "Hello, thank you for your message. ",
            "buy": "We've noted your purchase plans; I'll share a tailored selection of "
            "properties and remain at your disposal.",
            "rent": "We've noted your rental request; I'm sending you listings matching "
            "your criteria.",
            "visit": "I can arrange a viewing — let me know your availability and I'll "
            "confirm a slot.",
            "complaint": "Your complaint is being handled as a priority; a manager will "
            "get back to you shortly.",
            "payment": "Regarding your payment, I'm sending you the detailed terms and schedule.",
            "info": "I remain at your disposal for any further information.",
        },
        "ar": {
            "open": "نعتذر عن الإزعاج. " if apologize else "مرحباً، شكراً لرسالتك. ",
            "buy": "سجّلنا رغبتك في الشراء؛ سأرسل لك مجموعة عقارات مناسبة وأبقى في خدمتك.",
            "rent": "سجّلنا طلب الإيجار؛ سأرسل لك عقارات مطابقة لمعاييرك.",
            "visit": "يمكنني ترتيب زيارة — أخبرني بأوقات تواجدك لأؤكد الموعد.",
            "complaint": "نتعامل مع شكواك كأولوية؛ سيتواصل معك المسؤول قريباً.",
            "payment": "بخصوص الدفع، سأرسل لك التفاصيل والجدول الزمني.",
            "info": "أبقى في خدمتك لأي معلومات إضافية.",
        },
    }
    block = templates.get(locale, templates["fr"])
    body = block.get(intent, block["info"])
    return f"{block['open']}{body}"


def heuristic_summary(thread_text: str, message_count: int) -> str:
    """Résumé déterministe (repli) : volume + dernier extrait."""
    snippet = (thread_text or "").strip().replace("\n", " ")
    if len(snippet) > 200:
        snippet = snippet[:200].rstrip() + "…"
    plural = "s" if message_count > 1 else ""
    return (
        f"{message_count} message{plural} — {snippet}"
        if snippet
        else f"{message_count} message{plural}."
    )


# ─────────────────────────────────────────────────────────────────────────
# Context gatherers (DB) — filtrés par company_id (Loi 1) + visibilité agent
# ─────────────────────────────────────────────────────────────────────────

_MAX_MESSAGES = 20
_MAX_CONTEXT_CHARS = 4000


def _agent_blocked(
    role: str | None, assigned_agent_id: uuid.UUID | None, agent_id: uuid.UUID
) -> bool:
    """Anti-BOLA : un simple agent n'accède qu'aux items qui LUI sont assignés."""
    return role == "agent" and assigned_agent_id != agent_id


async def gather_inbox_context(
    db: AsyncSession,
    company_id: uuid.UUID,
    conversation_id: uuid.UUID,
    *,
    agent_id: uuid.UUID,
    role: str | None,
) -> dict[str, Any] | None:
    """Agrège le fil d'une conversation inbox. None si introuvable/invisible."""
    conv = (
        await db.execute(
            select(InboxConversation).where(
                InboxConversation.id == conversation_id,
                InboxConversation.company_id == company_id,
                InboxConversation.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if conv is None or _agent_blocked(role, conv.assigned_agent_id, agent_id):
        return None

    rows = (
        (
            await db.execute(
                select(InboxMessage)
                .where(
                    InboxMessage.company_id == company_id,
                    InboxMessage.conversation_id == conversation_id,
                )
                .order_by(InboxMessage.created_at.desc())
                .limit(_MAX_MESSAGES)
            )
        )
        .scalars()
        .all()
    )
    messages = list(reversed(rows))
    lines: list[str] = []
    last_client_text = ""
    for m in messages:
        who = "Client" if m.direction == "inbound" else "Agent"
        body = (m.body or "").strip()
        if body:
            lines.append(f"{who}: {body}")
            if m.direction == "inbound":
                last_client_text = body
    thread_text = "\n".join(lines)[:_MAX_CONTEXT_CHARS]
    return {
        "channel": conv.channel,
        "subject": conv.subject,
        "thread_text": thread_text,
        "last_client_text": last_client_text,
        "message_count": len(messages),
    }


async def gather_ticket_context(
    db: AsyncSession,
    company_id: uuid.UUID,
    ticket_id: uuid.UUID,
    *,
    agent_id: uuid.UUID,
    role: str | None,
) -> dict[str, Any] | None:
    """Agrège un ticket + sa timeline de commentaires. None si introuvable/invisible."""
    ticket = (
        await db.execute(
            select(ServiceTicket).where(
                ServiceTicket.id == ticket_id,
                ServiceTicket.company_id == company_id,
                ServiceTicket.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if ticket is None or _agent_blocked(role, ticket.assigned_agent_id, agent_id):
        return None

    rows = (
        (
            await db.execute(
                select(ServiceTicketEvent)
                .where(
                    ServiceTicketEvent.company_id == company_id,
                    ServiceTicketEvent.ticket_id == ticket_id,
                    ServiceTicketEvent.event_type == "commented",
                )
                .order_by(ServiceTicketEvent.created_at.asc())
                .limit(_MAX_MESSAGES)
            )
        )
        .scalars()
        .all()
    )
    lines: list[str] = [f"Sujet: {ticket.subject}"]
    if ticket.description:
        lines.append(f"Description: {ticket.description}")
    for ev in rows:
        if ev.body:
            lines.append(f"Commentaire: {ev.body.strip()}")
    thread_text = "\n".join(lines)[:_MAX_CONTEXT_CHARS]
    # Le « dernier message client » d'un ticket = sa description (point de départ).
    last_client_text = (ticket.description or ticket.subject or "").strip()
    return {
        "channel": "ticket",
        "subject": ticket.subject,
        "thread_text": thread_text,
        "last_client_text": last_client_text,
        "message_count": len(rows) + 1,
        "priority": ticket.priority,
        "status": ticket.status,
    }


# ─────────────────────────────────────────────────────────────────────────
# Orchestration — Gemini + repli helpers purs
# ─────────────────────────────────────────────────────────────────────────

_REPLY_SYSTEM = (
    "You are a professional UAE real-estate contact-center agent assistant. "
    "Draft a concise, polite, ready-to-send reply to the client in the SAME "
    "language as the conversation. No markdown, no preamble — only the reply text."
)
_SUMMARY_SYSTEM = (
    "Summarize the following customer conversation in 2-3 neutral sentences, "
    "in the SAME language as the conversation. Output only the summary."
)


async def assist(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    context_type: ContextType,
    context_id: uuid.UUID,
    agent_id: uuid.UUID,
    role: str | None,
    locale: Locale = "fr",
) -> dict[str, Any] | None:
    """Assemble l'assistance agent. None si l'item est introuvable/invisible.

    Sentiment/intention/NBA sont toujours calculés par les helpers purs
    (déterministes). Le brouillon et le résumé tentent Gemini, avec repli
    heuristique pur si la clé est absente ou l'API échoue.
    """
    if context_type == "inbox":
        ctx = await gather_inbox_context(db, company_id, context_id, agent_id=agent_id, role=role)
    else:
        ctx = await gather_ticket_context(db, company_id, context_id, agent_id=agent_id, role=role)
    if ctx is None:
        return None

    last_client = ctx["last_client_text"]
    sentiment = detect_sentiment(last_client)
    intent = detect_intent(last_client)
    actions = next_best_actions(intent, sentiment)

    # Brouillon de réponse — Gemini sinon repli.
    reply_gen = await generate_text(
        f"Conversation ({ctx['channel']}):\n{ctx['thread_text']}\n\nDraft the next agent reply.",
        system_instruction=_REPLY_SYSTEM,
        locale=locale,
        temperature=0.4,
    )
    if reply_gen["text"]:
        suggested_reply, reply_engine = reply_gen["text"], reply_gen["engine"]
    else:
        suggested_reply, reply_engine = heuristic_reply(intent, sentiment, locale), "fallback"

    # Résumé — Gemini sinon repli.
    summary_gen = await generate_text(
        f"Conversation ({ctx['channel']}):\n{ctx['thread_text']}",
        system_instruction=_SUMMARY_SYSTEM,
        locale=locale,
        temperature=0.2,
    )
    summary = summary_gen["text"] or heuristic_summary(ctx["thread_text"], ctx["message_count"])

    return {
        "context_type": context_type,
        "context_id": context_id,
        "channel": ctx["channel"],
        "summary": summary,
        "suggested_reply": suggested_reply,
        "sentiment": sentiment,
        "intent": intent,
        "next_best_actions": actions,
        "engine": reply_engine,
    }
