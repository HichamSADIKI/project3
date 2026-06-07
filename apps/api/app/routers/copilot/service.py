"""Service AI Copilot — assistance agent.

- **Helpers purs** (sans DB ni I/O, multilingue AR/EN/FR) : sentiment, intention,
  next-best-actions, brouillon de repli heuristique, résumé heuristique. Ils
  servent AUSSI de repli quand Gemini est indisponible.
- **Context gatherers** (DB) : agrègent le fil d'une conversation inbox ou d'un
  ticket, filtrés par `company_id` (Loi 1) + visibilité agent (anti-BOLA).
- **Orchestration** : `assist()` combine contexte + Gemini (repli helpers purs).
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from collections.abc import AsyncIterator
from typing import Any, Literal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.gemini import (
    GEMINI_MODEL,
    Locale,
    generate_chat,
    generate_chat_stream,
    generate_text,
)
from app.models.crm import CRMLead
from app.models.payment import PaymentRequest
from app.models.property import Property
from app.routers.inbox.models import InboxConversation, InboxMessage
from app.routers.ticketing.models import ServiceTicket, ServiceTicketEvent

logger = logging.getLogger(__name__)

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
        "dissatisfied",
        "insatisfait",
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
    # NB : pas de « rent »/« إيجار »/« loyer » ici — ce sont des marqueurs de
    # location (intent `rent`), pas de paiement ; les y mettre faisait classer
    # toute demande de location EN/AR en `payment` (payment itéré avant rent).
    "payment": frozenset(
        {
            "paiement",
            "payer",
            "facture",
            "chèque",
            "virement",
            "payment",
            "invoice",
            "cheque",
            "transfer",
            "دفع",
            "فاتورة",
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


# Tokenisation Unicode (lettres uniquement) pour un matching par MOT et non par
# sous-chaîne — sinon « content » matcherait dans « mécontent » et « satisfait »
# dans « insatisfait », inversant le sentiment des réclamations.
_WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)


def _matches(low: str, tokens: set[str], word: str) -> bool:
    """Un mot-clé simple matche un TOKEN entier ; une locution (espace/trait
    d'union) reste cherchée en sous-chaîne (ex. « thank you », « rendez-vous »)."""
    if _WORD_RE.fullmatch(word):
        return word in tokens
    return word in low


def _count_hits(low: str, tokens: set[str], words: frozenset[str]) -> int:
    return sum(1 for w in words if _matches(low, tokens, w))


def detect_sentiment(text: str) -> Sentiment:
    """Sentiment grossier par mots-clés (repli sans IA). Négatif l'emporte."""
    low = (text or "").lower()
    tokens = set(_WORD_RE.findall(low))
    neg = _count_hits(low, tokens, _NEGATIVE_WORDS)
    pos = _count_hits(low, tokens, _POSITIVE_WORDS)
    if neg > pos:
        return "negative"
    if pos > neg:
        return "positive"
    return "neutral"


def detect_intent(text: str) -> str:
    """Intention dominante par mots-clés. Défaut `info` si rien ne matche."""
    low = (text or "").lower()
    tokens = set(_WORD_RE.findall(low))
    for intent, words in _INTENT_KEYWORDS.items():
        if any(_matches(low, tokens, w) for w in words):
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
    client_parts: list[str] = []
    for m in messages:
        who = "Client" if m.direction == "inbound" else "Agent"
        body = (m.body or "").strip()
        if body:
            lines.append(f"{who}: {body}")
            if m.direction == "inbound":
                client_parts.append(body)
    thread_text = "\n".join(lines)[:_MAX_CONTEXT_CHARS]
    # client_text = TOUT le texte client du fil (pas seulement le dernier) — le
    # sentiment/l'intention d'un fil multi-messages ne doit pas dépendre du seul
    # dernier message (souvent un « merci » ou « ok »).
    return {
        "channel": conv.channel,
        "subject": conv.subject,
        "thread_text": thread_text,
        "client_text": " ".join(client_parts)[:_MAX_CONTEXT_CHARS],
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
    # Texte client d'un ticket = sujet + description (point de départ de la demande).
    client_text = f"{ticket.subject} {ticket.description or ''}".strip()
    return {
        "channel": "ticket",
        "subject": ticket.subject,
        "thread_text": thread_text,
        "client_text": client_text,
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


def _combine_engines(reply_engine: str, summary_engine: str) -> str:
    """Provenance honnête sur les DEUX générations (brouillon + résumé).

    `fallback` si les deux sont en repli, le nom du modèle si les deux viennent
    de Gemini, `mixed` si l'un a réussi et l'autre est tombé en repli.
    """
    if reply_engine == summary_engine:
        return reply_engine
    return "mixed"


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

    client_text = ctx["client_text"]
    sentiment = detect_sentiment(client_text)
    intent = detect_intent(client_text)
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
    if summary_gen["text"]:
        summary, summary_engine = summary_gen["text"], summary_gen["engine"]
    else:
        summary, summary_engine = (
            heuristic_summary(ctx["thread_text"], ctx["message_count"]),
            "fallback",
        )

    return {
        "context_type": context_type,
        "context_id": context_id,
        "channel": ctx["channel"],
        "summary": summary,
        "suggested_reply": suggested_reply,
        "sentiment": sentiment,
        "intent": intent,
        "next_best_actions": actions,
        # engine honnête : reflète brouillon ET résumé (mixed si l'un des deux
        # est tombé en repli alors que l'autre venait de Gemini).
        "engine": _combine_engines(reply_engine, summary_engine),
    }


# ─────────────────────────────────────────────────────────────────────────
# Assistant in-app (chat) — guide d'usage + navigation guidée + KPI tenant
# ─────────────────────────────────────────────────────────────────────────

# Carte de navigation : (clé d'écran front, libellés AR/EN/FR, mots-clés
# déclencheurs minuscules). `suggest_navigation` matche par MOT entier (helper
# `_matches`, mêmes règles que la détection d'intention) et renvoie au plus 3
# écrans dans l'ordre du tuple — c'est le volet « actions guidées » (le front
# transforme chaque clé en bouton qui ouvre l'écran).
_NAV: tuple[tuple[str, dict[Locale, str], frozenset[str]], ...] = (
    (
        "crm",
        {"fr": "CRM / Prospects", "en": "CRM / Leads", "ar": "إدارة العلاقات / الفرص"},
        frozenset({"crm", "lead", "leads", "prospect", "prospects", "pipeline", "فرصة", "فرص"}),
    ),
    (
        "realestate",
        {"fr": "Biens immobiliers", "en": "Properties", "ar": "العقارات"},
        frozenset(
            {
                "bien",
                "biens",
                "annonce",
                "annonces",
                "propriété",
                "propriete",
                "property",
                "properties",
                "listing",
                "listings",
                "عقار",
                "عقارات",
            }
        ),
    ),
    (
        "realestate_achat",
        {"fr": "Acquisitions", "en": "Acquisitions", "ar": "الاستحواذ"},
        frozenset({"achat", "acquisition", "acquisitions", "acquérir", "acquerir"}),
    ),
    (
        "realestate_vente",
        {"fr": "Ventes", "en": "Sales", "ar": "المبيعات"},
        frozenset({"vente", "ventes", "vendre", "sale", "sales", "بيع", "مبيعات"}),
    ),
    (
        "realestate_location",
        {"fr": "Locations", "en": "Rentals", "ar": "الإيجارات"},
        frozenset(
            {
                "location",
                "locations",
                "louer",
                "bail",
                "rent",
                "rental",
                "rentals",
                "lease",
                "إيجار",
                "تأجير",
            }
        ),
    ),
    (
        "realestate_payments",
        {"fr": "Paiements", "en": "Payments", "ar": "المدفوعات"},
        frozenset({"paiement", "paiements", "payer", "payment", "payments", "دفع", "مدفوعات"}),
    ),
    (
        "realestate_cheques",
        {"fr": "Chèques", "en": "Cheques", "ar": "الشيكات"},
        frozenset({"chèque", "cheque", "chèques", "cheques", "pdc", "شيك", "شيكات"}),
    ),
    (
        "realestate_contracts",
        {"fr": "Contrats", "en": "Contracts", "ar": "العقود"},
        frozenset({"contrat", "contrats", "contract", "contracts", "عقد", "عقود"}),
    ),
    (
        "realestate_tickets",
        {"fr": "Tickets / SAV", "en": "Tickets", "ar": "التذاكر"},
        frozenset({"ticket", "tickets", "réclamation", "reclamation", "sav", "تذكرة", "شكوى"}),
    ),
    (
        "realestate_inbox",
        {"fr": "Messagerie", "en": "Inbox", "ar": "البريد الوارد"},
        frozenset(
            {
                "message",
                "messages",
                "inbox",
                "messagerie",
                "conversation",
                "conversations",
                "whatsapp",
                "رسالة",
                "رسائل",
                "محادثة",
            }
        ),
    ),
    (
        "realestate_maintenance",
        {"fr": "Maintenance", "en": "Maintenance", "ar": "الصيانة"},
        frozenset({"maintenance", "réparation", "reparation", "repair", "صيانة"}),
    ),
    (
        "realestate_owners",
        {"fr": "Propriétaires", "en": "Owners", "ar": "الملاك"},
        frozenset(
            {"propriétaire", "proprietaire", "propriétaires", "owner", "owners", "مالك", "ملاك"}
        ),
    ),
    (
        "realestate_tenants",
        {"fr": "Locataires", "en": "Tenants", "ar": "المستأجرون"},
        frozenset({"locataire", "locataires", "tenant", "tenants", "مستأجر", "مستأجرون"}),
    ),
    (
        "realestate_buildings",
        {"fr": "Immeubles", "en": "Buildings", "ar": "المباني"},
        frozenset({"immeuble", "immeubles", "building", "buildings", "مبنى", "مباني"}),
    ),
    (
        "realestate_units",
        {"fr": "Unités", "en": "Units", "ar": "الوحدات"},
        frozenset({"unité", "unite", "unités", "unit", "units", "appartement", "وحدة", "وحدات"}),
    ),
    (
        "finance",
        {"fr": "Finance", "en": "Finance", "ar": "المالية"},
        frozenset(
            {
                "finance",
                "facture",
                "factures",
                "comptabilité",
                "comptabilite",
                "invoice",
                "accounting",
                "مالية",
                "فاتورة",
            }
        ),
    ),
    (
        "report",
        {"fr": "Rapports", "en": "Reports", "ar": "التقارير"},
        frozenset(
            {
                "rapport",
                "rapports",
                "report",
                "reports",
                "statistique",
                "statistiques",
                "kpi",
                "تقرير",
                "تقارير",
            }
        ),
    ),
    (
        "marketing",
        {"fr": "Marketing", "en": "Marketing", "ar": "التسويق"},
        frozenset({"marketing", "campagne", "campagnes", "campaign", "تسويق", "حملة"}),
    ),
    (
        "callcenter",
        {"fr": "Centre d'appel", "en": "Call center", "ar": "مركز الاتصال"},
        frozenset({"appel", "appels", "téléphone", "telephone", "softphone", "اتصال", "مكالمة"}),
    ),
    (
        "dash",
        {"fr": "Tableau de bord", "en": "Dashboard", "ar": "لوحة التحكم"},
        frozenset({"dashboard", "accueil", "home", "لوحة"}),
    ),
    (
        "clients",
        {"fr": "Clients", "en": "Clients", "ar": "العملاء"},
        frozenset({"client", "clients", "عميل", "عملاء"}),
    ),
)

_MAX_NAV = 3


def suggest_navigation(text: str, locale: Locale = "fr") -> list[dict[str, str]]:
    """Mots-clés du message → écrans à proposer (max 3), libellés dans la locale.

    Matching par mot entier (helper `_matches`) pour éviter les faux positifs en
    sous-chaîne. L'ordre suit `_NAV` (priorité métier), pas l'ordre des mots.
    """
    low = (text or "").lower()
    tokens = set(_WORD_RE.findall(low))
    # Arabe : l'article défini « ال » se colle au mot (العقارات = « les biens »).
    # On ajoute la forme sans article pour que les mots-clés (عقارات) matchent.
    tokens |= {tok[2:] for tok in tokens if tok.startswith("ال") and len(tok) > 4}
    out: list[dict[str, str]] = []
    for screen, labels, words in _NAV:
        if any(_matches(low, tokens, w) for w in words):
            out.append({"screen": screen, "label": labels.get(locale, labels["fr"])})
        if len(out) >= _MAX_NAV:
            break
    return out


async def gather_tenant_snapshot(db: AsyncSession, company_id: uuid.UUID) -> dict[str, int]:
    """Compteurs KPI du tenant courant (Loi 1 : filtre company_id explicite).

    Chaque bloc est isolé : un échec (table absente en test minimal, etc.) ne
    casse pas le chat — il omet juste la métrique. Sert à répondre aux questions
    « combien de … » sans halluciner de chiffres.
    """
    snap: dict[str, int] = {}

    async def _count(stmt: Any) -> int:
        return int((await db.execute(stmt)).scalar() or 0)

    try:
        base = (
            select(func.count())
            .select_from(CRMLead)
            .where(CRMLead.company_id == company_id, CRMLead.deleted_at.is_(None))
        )
        snap["leads_total"] = await _count(base)
        snap["leads_active"] = await _count(base.where(CRMLead.status.notin_(("won", "lost"))))
        snap["leads_won"] = await _count(base.where(CRMLead.status == "won"))
    except Exception as exc:  # noqa: BLE001 — best-effort, le chat reste utile
        logger.warning("snapshot leads indisponible: %s", exc)

    try:
        base_p = (
            select(func.count())
            .select_from(Property)
            .where(Property.company_id == company_id, Property.deleted_at.is_(None))
        )
        snap["properties_total"] = await _count(base_p)
        snap["properties_available"] = await _count(base_p.where(Property.status == "available"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("snapshot properties indisponible: %s", exc)

    try:
        base_pay = (
            select(func.count())
            .select_from(PaymentRequest)
            .where(PaymentRequest.company_id == company_id, PaymentRequest.deleted_at.is_(None))
        )
        snap["payments_pending"] = await _count(base_pay.where(PaymentRequest.status == "pending"))
        snap["payments_overdue"] = await _count(base_pay.where(PaymentRequest.status == "overdue"))
    except Exception as exc:  # noqa: BLE001
        logger.warning("snapshot payments indisponible: %s", exc)

    return snap


_APP_GUIDE = (
    "You are 'SGI Assistant', a helpful in-app assistant embedded in the SGI real-estate "
    "management platform of Infinity International Facilities Management (UAE — Dubai, Abu Dhabi). "
    "Your job is to help agents, managers and staff USE the application: explain where features "
    "are, how to perform actions (create a lead, publish a listing, register a payment, open a "
    "ticket, schedule a visit...), answer general questions, and point the user to the right "
    "screen. "
    "The platform modules: CRM & leads, property catalogue, sales, rentals, contracts, owners, "
    "tenants, buildings & units, payments & post-dated cheques (PDC), maintenance, inbox "
    "(WhatsApp/email), tickets/SLA, marketing, reports, finance, call center (softphone), and "
    "Golden Visa UAE (eligible when a property >= 2,000,000 AED is signed). "
    "Currency is AED, always Latin numerals. Be concise (2 to 5 sentences), professional and warm. "
    "Use ONLY the 'Live data' block for tenant figures; if a figure is absent, say it is not "
    "available and suggest the relevant screen — never invent numbers. No markdown headings."
)

# Mots déclencheurs d'une question chiffrée (repli sans IA → réponse depuis le snapshot).
_DATA_WORDS: frozenset[str] = frozenset({"combien", "nombre", "count", "كم", "عدد"})
# Locutions (matchées en sous-chaîne).
_DATA_PHRASES: tuple[str, ...] = ("how many", "how much")

_METRIC_LABELS: dict[str, dict[Locale, str]] = {
    "leads_total": {"fr": "prospects au total", "en": "total leads", "ar": "إجمالي الفرص"},
    "leads_active": {"fr": "prospects actifs", "en": "active leads", "ar": "فرص نشطة"},
    "leads_won": {"fr": "prospects gagnés", "en": "won leads", "ar": "فرص رابحة"},
    "properties_total": {"fr": "biens", "en": "properties", "ar": "عقارات"},
    "properties_available": {
        "fr": "biens disponibles",
        "en": "available properties",
        "ar": "عقارات متاحة",
    },
    "payments_pending": {
        "fr": "paiements en attente",
        "en": "pending payments",
        "ar": "مدفوعات معلّقة",
    },
    "payments_overdue": {
        "fr": "paiements en retard",
        "en": "overdue payments",
        "ar": "مدفوعات متأخرة",
    },
}


def _loc(locale: Locale | str | None) -> Locale:
    return locale if locale in ("ar", "en", "fr") else "fr"


def _data_summary(locale: Locale, snapshot: dict[str, int]) -> str:
    """Résumé chiffré localisé à partir du snapshot (repli déterministe)."""
    loc = _loc(locale)
    parts = [f"{v} {_METRIC_LABELS[k][loc]}" for k, v in snapshot.items() if k in _METRIC_LABELS]
    lead = {
        "fr": "Voici vos chiffres actuels : ",
        "en": "Here are your current figures: ",
        "ar": "إليك أرقامك الحالية: ",
    }[loc]
    return lead + " · ".join(parts)


def heuristic_chat_reply(
    text: str, locale: Locale, snapshot: dict[str, int], nav: list[dict[str, str]]
) -> str:
    """Réponse déterministe quand Gemini est indisponible (sans clé/erreur API).

    Question chiffrée + snapshot disponible → résumé des KPI. Sinon message
    d'aide générique, augmenté de la section suggérée si la navigation matche.
    """
    loc = _loc(locale)
    low = (text or "").lower()
    tokens = set(_WORD_RE.findall(low))
    is_data = any(_matches(low, tokens, w) for w in _DATA_WORDS) or any(
        p in low for p in _DATA_PHRASES
    )
    if is_data and snapshot:
        return _data_summary(loc, snapshot)

    base = {
        "fr": (
            "Je suis l'assistant SGI : je vous aide à naviguer dans l'application "
            "et à répondre à vos questions. "
        ),
        "en": "I'm the SGI assistant: I help you navigate the app and answer your questions. ",
        "ar": "أنا مساعد SGI: أساعدك في التنقل داخل التطبيق والإجابة عن أسئلتك. ",
    }[loc]
    if nav:
        labels = ", ".join(n["label"] for n in nav)
        suffix = {
            "fr": f"Section suggérée : {labels}.",
            "en": f"Suggested section: {labels}.",
            "ar": f"القسم المقترح: {labels}.",
        }[loc]
        return base + suffix
    tail = {
        "fr": "Précisez votre besoin (CRM, biens, paiements, contrats, tickets…).",
        "en": "Tell me what you need (CRM, properties, payments, contracts, tickets…).",
        "ar": "أخبرني بما تحتاج (العملاء، العقارات، المدفوعات، العقود، التذاكر…).",
    }[loc]
    return base + tail


# ── Actions guidées profondes — extraction de pré-remplissage (CRM lead) ──

_CREATE_WORDS: frozenset[str] = frozenset(
    {
        "créer",
        "creer",
        "ajouter",
        "nouveau",
        "nouvelle",
        "create",
        "add",
        "new",
        "سجل",
        "أضف",
        "جديد",
    }
)
_LEAD_WORDS: frozenset[str] = frozenset(
    {"prospect", "prospects", "lead", "leads", "client", "clients", "عميل", "عملاء", "فرصة"}
)
_PROP_TYPES: dict[str, str] = {
    "villa": "villa",
    "appartement": "apartment",
    "apartment": "apartment",
    "studio": "studio",
    "penthouse": "penthouse",
    "duplex": "duplex",
    "townhouse": "townhouse",
    "bureau": "office",
    "office": "office",
    "terrain": "land",
    "land": "land",
    "شقة": "apartment",
    "فيلا": "villa",
}
_LOCATIONS: tuple[str, ...] = (
    "dubai marina",
    "marina",
    "downtown",
    "palm jumeirah",
    "palm",
    "business bay",
    "jbr",
    "jvc",
    "deira",
    "abu dhabi",
    "sharjah",
    "dubai",
)
_BUDGET_RE = re.compile(r"(\d[\d.,]*)\s*(millions?|milliards?|m|k|bn)?", re.IGNORECASE)
_BUDGET_MULT: dict[str, int] = {
    "k": 1_000,
    "m": 1_000_000,
    "million": 1_000_000,
    "millions": 1_000_000,
    "bn": 1_000_000_000,
    "milliard": 1_000_000_000,
    "milliards": 1_000_000_000,
}


def _extract_budget_aed(text: str) -> int | None:
    """Plus gros montant plausible en AED trouvé dans le texte (≥ 1000)."""
    best: int | None = None
    for m in _BUDGET_RE.finditer(text.lower()):
        raw, unit = m.group(1), (m.group(2) or "").lower()
        try:
            val = float(raw.replace(" ", "").replace(",", ""))
        except ValueError:
            continue
        amount = int(val * _BUDGET_MULT.get(unit, 1))
        if amount >= 1000:
            best = max(best or 0, amount)
    return best


def extract_lead_prefill(text: str) -> dict[str, Any] | None:
    """Si le message exprime une création de prospect, renvoie un pré-remplissage
    `{screen: "crm", fields: {...}}` (budget/type/localisation extraits). None sinon.

    Déterministe (sans IA) → testable. Les champs absents sont simplement omis ;
    le front ouvre alors le formulaire de création (éventuellement vide)."""
    low = (text or "").lower()
    tokens = set(_WORD_RE.findall(low))
    create = any(_matches(low, tokens, w) for w in _CREATE_WORDS)
    is_lead = any(_matches(low, tokens, w) for w in _LEAD_WORDS)
    if not (create and is_lead):
        return None
    fields: dict[str, Any] = {}
    budget = _extract_budget_aed(low)
    if budget:
        fields["budget"] = budget
    for kw, canonical in _PROP_TYPES.items():
        if _matches(low, tokens, kw):
            fields["prop"] = canonical
            break
    for loc in _LOCATIONS:
        if loc in low:
            fields["ctry"] = loc.title()
            break
    return {"screen": "crm", "fields": fields}


_CONTRACT_WORDS: frozenset[str] = frozenset(
    {"contrat", "contrats", "contract", "contracts", "bail", "lease", "عقد", "عقود"}
)
_RENTAL_WORDS: frozenset[str] = frozenset(
    {"location", "louer", "loyer", "bail", "rent", "rental", "lease", "إيجار", "تأجير"}
)
_SALE_WORDS: frozenset[str] = frozenset(
    {"vente", "vendre", "achat", "acheter", "sale", "buy", "purchase", "بيع", "شراء"}
)


def extract_contract_prefill(text: str) -> dict[str, Any] | None:
    """Si le message exprime une création de contrat, renvoie
    `{screen: "realestate_contracts", fields: {type, amount?}}`. None sinon.

    `type` = "sale" si vocabulaire de vente, sinon "rental" (défaut). `client_id`
    et `property_id` (des sélecteurs côté UI) ne sont pas extractibles d'un texte
    libre → omis. Déterministe (sans IA), testable."""
    low = (text or "").lower()
    tokens = set(_WORD_RE.findall(low))
    create = any(_matches(low, tokens, w) for w in _CREATE_WORDS)
    is_contract = any(_matches(low, tokens, w) for w in _CONTRACT_WORDS)
    if not (create and is_contract):
        return None
    is_sale = any(_matches(low, tokens, w) for w in _SALE_WORDS)
    fields: dict[str, Any] = {"type": "sale" if is_sale else "rental"}
    amount = _extract_budget_aed(low)
    if amount:
        fields["amount"] = amount
    return {"screen": "realestate_contracts", "fields": fields}


_PAYMENT_WORDS: frozenset[str] = frozenset(
    {"paiement", "paiements", "payment", "payments", "encaissement", "encaisser", "دفعة", "إيصال"}
)
# Mots → type de paiement (rent/charges/deposit). Défaut omis (l'UI choisit).
_PAY_TYPE_WORDS: dict[str, frozenset[str]] = {
    "rent": frozenset({"loyer", "loyers", "rent", "location", "إيجار"}),
    "charges": frozenset({"charges", "charge", "service", "رسوم"}),
    "deposit": frozenset({"caution", "dépôt", "depot", "deposit", "garantie", "تأمين"}),
}


def extract_payment_prefill(text: str) -> dict[str, Any] | None:
    """Si le message exprime une création de paiement, renvoie
    `{screen: "realestate_payments", fields: {payment_type?, amount?}}`. None sinon."""
    low = (text or "").lower()
    tokens = set(_WORD_RE.findall(low))
    # « encaisser/encaissement » implique une création de paiement (pas que créer/ajouter).
    create = any(_matches(low, tokens, w) for w in _CREATE_WORDS) or any(
        _matches(low, tokens, w) for w in ("encaisser", "encaissement")
    )
    is_payment = any(_matches(low, tokens, w) for w in _PAYMENT_WORDS)
    if not (create and is_payment):
        return None
    fields: dict[str, Any] = {}
    for ptype, words in _PAY_TYPE_WORDS.items():
        if any(_matches(low, tokens, w) for w in words):
            fields["payment_type"] = ptype
            break
    amount = _extract_budget_aed(low)
    if amount:
        fields["amount"] = amount
    return {"screen": "realestate_payments", "fields": fields}


def extract_prefill(text: str) -> dict[str, Any] | None:
    """Dispatch des actions guidées de création : paiement, contrat, prospect.

    Ordre du plus spécifique au plus général."""
    return (
        extract_payment_prefill(text)
        or extract_contract_prefill(text)
        or extract_lead_prefill(text)
    )


async def chat(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    messages: list[dict[str, str]],
    locale: Locale = "fr",
    screen: str | None = None,
) -> dict[str, Any]:
    """Tour de conversation de l'assistant in-app.

    Combine : guide d'usage de l'app + snapshot KPI du tenant (Loi 1) + écran
    courant → réponse Gemini, avec repli heuristique déterministe. La navigation
    suggérée (actions guidées) est calculée de façon déterministe sur le dernier
    message utilisateur, indépendamment de la réussite de Gemini.
    """
    loc = _loc(locale)
    last_user = next(
        (
            (m.get("content") or "").strip()
            for m in reversed(messages)
            if m.get("role") == "user" and (m.get("content") or "").strip()
        ),
        "",
    )
    snapshot = await gather_tenant_snapshot(db, company_id)
    nav = suggest_navigation(last_user, loc)

    system = _APP_GUIDE
    if snapshot:
        system += "\n\nLive data (current tenant): " + ", ".join(
            f"{k}={v}" for k, v in snapshot.items()
        )
    if screen:
        system += f"\n\nThe user is currently on the '{screen}' screen of the app."

    gen = await generate_chat(messages, system_instruction=system, locale=loc, temperature=0.4)
    if gen["text"]:
        reply, engine = gen["text"], gen["engine"]
    else:
        reply, engine = heuristic_chat_reply(last_user, loc, snapshot, nav), "fallback"

    prefill = extract_prefill(last_user)
    return {
        "reply": reply,
        "engine": engine,
        "suggested_navigation": nav,
        "prefill": prefill,
    }


def _build_chat_system(snapshot: dict[str, int], screen: str | None) -> str:
    """Instruction système commune (guide app + snapshot KPI + écran courant)."""
    system = _APP_GUIDE
    if snapshot:
        system += "\n\nLive data (current tenant): " + ", ".join(
            f"{k}={v}" for k, v in snapshot.items()
        )
    if screen:
        system += f"\n\nThe user is currently on the '{screen}' screen of the app."
    return system


def _sse(obj: dict[str, Any]) -> str:
    """Encode un événement SSE (`data: {json}\\n\\n`)."""
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


async def chat_stream(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    messages: list[dict[str, str]],
    locale: Locale = "fr",
    screen: str | None = None,
) -> AsyncIterator[str]:
    """Variante **streaming** de `chat` (Server-Sent Events).

    Émet des événements `{"delta": "..."}` au fil de la génération Gemini, puis
    un `{"done": true, "engine", "suggested_navigation", "prefill"}` final. Tout
    l'accès DB (snapshot) est fait AVANT le streaming (la session peut se fermer
    pendant l'envoi des deltas). Repli : si Gemini ne produit rien, un unique
    delta heuristique est émis (engine "fallback").
    """
    loc = _loc(locale)
    last_user = next(
        (
            (m.get("content") or "").strip()
            for m in reversed(messages)
            if m.get("role") == "user" and (m.get("content") or "").strip()
        ),
        "",
    )
    snapshot = await gather_tenant_snapshot(db, company_id)
    nav = suggest_navigation(last_user, loc)
    prefill = extract_prefill(last_user)
    system = _build_chat_system(snapshot, screen)

    got_any = False
    async for delta in generate_chat_stream(
        messages, system_instruction=system, locale=loc, temperature=0.4
    ):
        got_any = True
        yield _sse({"delta": delta})

    if not got_any:
        yield _sse({"delta": heuristic_chat_reply(last_user, loc, snapshot, nav)})
        engine = "fallback"
    else:
        engine = GEMINI_MODEL

    yield _sse(
        {
            "done": True,
            "engine": engine,
            "suggested_navigation": nav,
            "prefill": prefill,
        }
    )
