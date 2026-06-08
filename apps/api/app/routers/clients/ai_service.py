"""Service — Agent AI Clients.

Deux couches :
- **Helpers purs** (`score_client`, `portfolio_insights`, `draft_message`, …) :
  logique métier déterministe, sans DB ni réseau — testable partout, base du
  repli quand Gemini est indisponible.
- **Orchestration async** (`client_score`, `client_insights`, `client_message`,
  `client_chat`) : lit la donnée du tenant (Loi 1 : toujours scopée
  `company_id`) puis enrichit via Gemini (`app.core.gemini`) en best-effort,
  avec repli systématique sur les helpers purs.

Aucun secret en dur : Gemini lit `GEMINI_API_KEY` via `os.getenv` (cf.
`app/core/gemini.py`). En l'absence de clé, tout fonctionne en mode heuristique.
"""

import uuid
from decimal import Decimal
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core import gemini
from app.models.client import Client
from app.models.notification import Notification
from app.routers.clients.ai_schemas import Locale
from app.routers.clients.service import (
    GOLDEN_VISA_BUDGET_THRESHOLD,
    clients_segmentation,
    get_client,
)
from app.tasks.notifications import send_email

# ── Garde PDPL : ne jamais transmettre de champ sensible à un LLM tiers ────
# Emirates ID, IBAN, chèques post-datés (PDC), passeport, etc. ne doivent
# JAMAIS quitter la plateforme vers Gemini (conformité PDPL UAE). Tout dict
# sérialisé dans un prompt passe par `pdpl_safe`.
PDPL_SENSITIVE_KEYS = frozenset(
    {
        "emirates_id",
        "emiratesid",
        "eid",
        "iban",
        "pdc",
        "passport",
        "passport_number",
        "national_id",
        "account_number",
        "card_number",
        "cvv",
        "tax_id",
    }
)


def pdpl_safe(data: dict[str, Any]) -> dict[str, Any]:
    """Retire les clés sensibles (PDPL) d'un dict avant envoi à Gemini."""
    return {k: v for k, v in data.items() if str(k).lower() not in PDPL_SENSITIVE_KEYS}


# Seuil secondaire (clients « haut budget » sous le seuil Golden Visa).
HIGH_BUDGET_THRESHOLD = Decimal("500000")

# Bandes de score (bornes basses incluses).
HOT_BAND = 70
WARM_BAND = 40

# Sources entrantes considérées comme un signal d'engagement.
_INBOUND_SOURCES = ("referral", "website", "portal")


# ── Helpers purs : scoring / qualification ────────────────────────────────


def _client_display_name(client: Client) -> str:
    """Nom lisible d'un client (individu ou société), repli neutre."""
    if client.type == "company" and client.company_name:
        return client.company_name
    parts = [p for p in (client.first_name, client.last_name) if p]
    return " ".join(parts) if parts else "client"


def _channel_count(client: Client) -> int:
    """Nombre de canaux de contact renseignés (téléphone, 2ᵉ tél., email)."""
    return sum(1 for v in (client.phone, client.phone2, client.email) if v)


def _budget_decimal(client: Client) -> Decimal | None:
    return Decimal(str(client.budget_max)) if client.budget_max is not None else None


def score_client(client: Client) -> dict[str, Any]:
    """Score de qualification 0-100 d'un client (helper pur, déterministe).

    Pondérations : budget (le plus discriminant), précision du besoin
    (type de bien + localisation), accessibilité (canaux de contact), source
    entrante, présence de notes. Retourne score, bande, éligibilité Golden Visa
    (budget ≥ 2 000 000 AED) et la liste des critères ayant contribué.
    """
    score = 0
    reasons: list[str] = []
    budget = _budget_decimal(client)
    gv_eligible = budget is not None and budget >= GOLDEN_VISA_BUDGET_THRESHOLD

    if budget is not None:
        if budget >= GOLDEN_VISA_BUDGET_THRESHOLD:
            score += 35
            reasons.append("budget_golden_visa")
        elif budget >= HIGH_BUDGET_THRESHOLD:
            score += 20
            reasons.append("budget_high")
        elif budget > 0:
            score += 8
            reasons.append("budget_set")

    if client.preferred_property_type:
        score += 15
        reasons.append("property_type_specified")
    if client.preferred_location:
        score += 10
        reasons.append("location_specified")

    channels = _channel_count(client)
    if channels >= 2:
        score += 15
        reasons.append("multi_channel")
    elif channels == 1:
        score += 6
        reasons.append("single_channel")

    if client.source in _INBOUND_SOURCES:
        score += 15
        reasons.append("inbound_source")
    if client.notes:
        score += 10
        reasons.append("notes_present")

    score = min(score, 100)
    band = "hot" if score >= HOT_BAND else "warm" if score >= WARM_BAND else "cold"
    return {
        "score": score,
        "band": band,
        "golden_visa_eligible": gv_eligible,
        "reasons": reasons,
    }


def recommended_actions(score_result: dict[str, Any], client: Client) -> list[str]:
    """Prochaines actions déterministes selon la bande de score et les manques."""
    actions: list[str] = []
    band = score_result["band"]
    if score_result["golden_visa_eligible"]:
        actions.append("propose_golden_visa")
    if band == "hot":
        actions.extend(["schedule_visit", "send_proposal"])
    elif band == "warm":
        actions.append("follow_up_call")
    else:
        actions.append("nurture_sequence")
    if _channel_count(client) == 0:
        actions.append("collect_contact")
    if not client.preferred_property_type and not client.preferred_location:
        actions.append("qualify_needs")
    # Déduplication en conservant l'ordre.
    return list(dict.fromkeys(actions))


def score_narrative(score_result: dict[str, Any], client: Client, locale: Locale) -> str:
    """Phrase de synthèse heuristique du score (repli sans IA), localisée."""
    name = _client_display_name(client)
    band = score_result["band"]
    score = score_result["score"]
    gv = score_result["golden_visa_eligible"]
    if locale == "ar":
        base = f"العميل {name}: درجة التأهيل {score}/100 (التصنيف: {band})."
        if gv:
            base += " مؤهّل محتمل للإقامة الذهبية."
        return base
    if locale == "en":
        base = f"Client {name}: qualification score {score}/100 (band: {band})."
        if gv:
            base += " Potentially Golden Visa eligible."
        return base
    base = f"Client {name} : score de qualification {score}/100 (bande : {band})."
    if gv:
        base += " Potentiellement éligible au Golden Visa."
    return base


# ── Helpers purs : insights portefeuille ──────────────────────────────────


def portfolio_insights(summary: dict[str, Any], locale: Locale = "fr") -> dict[str, Any]:
    """Transforme la segmentation portefeuille en synthèse à puces (helper pur).

    `summary` = sortie de `clients_segmentation` (by_type, by_source,
    golden_visa_budget_count, total).
    """
    total = int(summary.get("total", 0))
    by_type: dict[str, int] = dict(summary.get("by_type", {}))
    by_source: dict[str, int] = dict(summary.get("by_source", {}))
    gv = int(summary.get("golden_visa_budget_count", 0))

    bullets: list[str] = []
    if locale == "ar":
        headline = f"محفظة من {total} عميل."
        if by_type:
            bullets.append("التوزيع حسب النوع: " + _fmt_counts(by_type))
        if gv:
            bullets.append(f"{gv} عميل بميزانية مؤهّلة للإقامة الذهبية.")
        if by_source:
            bullets.append("أهم المصادر: " + _fmt_counts(by_source, top=3))
    elif locale == "en":
        headline = f"Portfolio of {total} clients."
        if by_type:
            bullets.append("Breakdown by type: " + _fmt_counts(by_type))
        if gv:
            bullets.append(f"{gv} clients with a Golden-Visa-eligible budget.")
        if by_source:
            bullets.append("Top sources: " + _fmt_counts(by_source, top=3))
    else:
        headline = f"Portefeuille de {total} clients."
        if by_type:
            bullets.append("Répartition par type : " + _fmt_counts(by_type))
        if gv:
            bullets.append(f"{gv} clients au budget éligible Golden Visa.")
        if by_source:
            bullets.append("Principales sources : " + _fmt_counts(by_source, top=3))

    return {
        "total": total,
        "headline": headline,
        "bullets": bullets,
        "golden_visa_budget_count": gv,
        "by_type": by_type,
        "by_source": by_source,
    }


def _fmt_counts(counts: dict[str, int], top: int | None = None) -> str:
    """« k1 (n1), k2 (n2) » trié par effectif décroissant, éventuellement borné."""
    items = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    if top is not None:
        items = items[:top]
    return ", ".join(f"{k} ({v})" for k, v in items)


# ── Helpers purs : brouillon de message ───────────────────────────────────

_MESSAGE_TEMPLATES: dict[str, dict[str, str]] = {
    "fr": {
        "follow_up": (
            "Bonjour {name}, je reviens vers vous concernant votre projet. "
            "Êtes-vous disponible pour en discuter ?"
        ),
        "proposal": (
            "Bonjour {name}, j'ai sélectionné des biens correspondant à votre "
            "budget. Puis-je vous envoyer la proposition ?"
        ),
        "welcome": (
            "Bonjour {name}, bienvenue chez Infinity. Je suis votre conseiller "
            "dédié, à votre écoute."
        ),
        "visit": (
            "Bonjour {name}, souhaitez-vous planifier une visite cette semaine ? "
            "Je m'adapte à vos disponibilités."
        ),
    },
    "en": {
        "follow_up": (
            "Hello {name}, following up on your project. Are you available for a quick chat?"
        ),
        "proposal": (
            "Hello {name}, I've shortlisted properties matching your budget. "
            "May I send you the proposal?"
        ),
        "welcome": ("Hello {name}, welcome to Infinity. I'm your dedicated advisor, here to help."),
        "visit": (
            "Hello {name}, would you like to schedule a viewing this week? "
            "Happy to fit your availability."
        ),
    },
    "ar": {
        "follow_up": "مرحبًا {name}، أتابع معك بخصوص مشروعك. هل لديك وقت لمناقشته؟",
        "proposal": "مرحبًا {name}، اخترت عقارات تناسب ميزانيتك. هل أرسل لك العرض؟",
        "welcome": "مرحبًا {name}، أهلًا بك في إنفينيتي. أنا مستشارك المخصّص لخدمتك.",
        "visit": "مرحبًا {name}، هل ترغب بتحديد موعد لزيارة هذا الأسبوع؟ سأراعي توفّرك.",
    },
}


def draft_message(
    client: Client,
    channel: str = "whatsapp",
    locale: Locale = "fr",
    purpose: str = "follow_up",
) -> str:
    """Brouillon de message déterministe (repli sans IA), localisé AR/EN/FR.

    `channel` n'altère pas le texte ici (l'envoi réel diffère) mais reste exposé
    pour cohérence d'API et enrichissement Gemini ultérieur.
    """
    name = _client_display_name(client)
    templates = _MESSAGE_TEMPLATES.get(locale, _MESSAGE_TEMPLATES["fr"])
    template = templates.get(purpose, templates["follow_up"])
    return template.format(name=name)


# ── Orchestration async (DB + Gemini, scopée company_id) ──────────────────


async def client_score(
    db: AsyncSession, company_id: uuid.UUID, client_id: uuid.UUID, locale: Locale = "fr"
) -> dict[str, Any] | None:
    """Score un client du tenant. Retourne None si introuvable (anti-BOLA 404)."""
    client = await get_client(db, company_id, client_id)
    if client is None:
        return None
    result = score_client(client)
    actions = recommended_actions(result, client)
    narrative = score_narrative(result, client, locale)
    engine = "heuristic"
    gen = await gemini.generate_text(
        _score_prompt(client, result, locale),
        system_instruction="You are a concise UAE real-estate CRM analyst.",
        locale=locale,
        max_chars=600,
    )
    if gen.get("text"):
        narrative = gen["text"]
        engine = gen.get("engine", "gemini")
    return {
        "client_id": client.id,
        "score": result["score"],
        "band": result["band"],
        "golden_visa_eligible": result["golden_visa_eligible"],
        "reasons": result["reasons"],
        "recommended_actions": actions,
        "narrative": narrative,
        "engine": engine,
    }


def _score_prompt(client: Client, result: dict[str, Any], locale: Locale) -> str:
    return (
        "Summarise in 2 short sentences why this real-estate lead scored "
        f"{result['score']}/100 (band {result['band']}, golden_visa="
        f"{result['golden_visa_eligible']}). Budget max (AED): {client.budget_max}; "
        f"property type: {client.preferred_property_type}; location: "
        f"{client.preferred_location}; source: {client.source}. "
        f"Answer in locale={locale}."
    )


async def client_insights(
    db: AsyncSession, company_id: uuid.UUID, locale: Locale = "fr"
) -> dict[str, Any]:
    """Synthèse IA du portefeuille clients du tenant (Loi 1)."""
    summary = await clients_segmentation(db, company_id)
    insights = portfolio_insights(summary, locale)
    narrative = " ".join([insights["headline"], *insights["bullets"]])
    engine = "heuristic"
    gen = await gemini.generate_text(
        "Write a 3-sentence executive summary of this client portfolio for an "
        f"agency manager. Data: {pdpl_safe(summary)}. Answer in locale={locale}.",
        system_instruction="You are a concise UAE real-estate portfolio analyst.",
        locale=locale,
        max_chars=800,
    )
    if gen.get("text"):
        narrative = gen["text"]
        engine = gen.get("engine", "gemini")
    return {**insights, "narrative": narrative, "engine": engine}


async def client_message(
    db: AsyncSession,
    company_id: uuid.UUID,
    client_id: uuid.UUID,
    channel: str,
    locale: Locale,
    purpose: str,
) -> dict[str, Any] | None:
    """Brouillon de message pour un client du tenant. None si introuvable (404)."""
    client = await get_client(db, company_id, client_id)
    if client is None:
        return None
    message = draft_message(client, channel, locale, purpose)
    engine = "heuristic"
    gen = await gemini.generate_text(
        f"Write a short, warm {channel} message ({purpose}) to client "
        f"'{_client_display_name(client)}' for a Dubai real-estate agency. "
        f"One short paragraph. Answer in locale={locale}.",
        system_instruction="You are a UAE real-estate relationship agent.",
        locale=locale,
        max_chars=600,
    )
    if gen.get("text"):
        message = gen["text"]
        engine = gen.get("engine", "gemini")
    return {
        "client_id": client.id,
        "channel": channel,
        "locale": locale,
        "purpose": purpose,
        "message": message,
        "engine": engine,
    }


_CHAT_SYSTEM = (
    "You are the Clients AI assistant for an Infinity UAE real-estate agency. "
    "You help agents understand and act on THEIR client portfolio only. "
    "Be concise and practical. Never invent client data; rely on the provided "
    "portfolio summary."
)


async def client_chat(
    db: AsyncSession,
    company_id: uuid.UUID,
    messages: list[dict[str, str]],
    locale: Locale = "fr",
) -> dict[str, Any]:
    """Chat conversationnel scopé au portefeuille clients du tenant (Loi 1)."""
    summary = await clients_segmentation(db, company_id)
    context = portfolio_insights(summary, locale)
    system = f"{_CHAT_SYSTEM}\n\nPortfolio summary (JSON): {pdpl_safe(summary)}"
    gen = await gemini.generate_chat(messages, system_instruction=system, locale=locale)
    if gen.get("text"):
        return {
            "reply": gen["text"],
            "engine": gen.get("engine", "gemini"),
            "context": {"total": context["total"]},
        }
    # Repli déterministe : on renvoie la synthèse du portefeuille.
    reply = " ".join([context["headline"], *context["bullets"]])
    return {"reply": reply, "engine": "heuristic", "context": {"total": context["total"]}}


# ── Envoi réel d'un message au client (C1) ────────────────────────────────

# Sujets e-mail localisés par intention (le corps = le message rédigé/édité).
_EMAIL_SUBJECTS: dict[str, dict[str, str]] = {
    "fr": {
        "follow_up": "Suivi de votre projet",
        "proposal": "Votre proposition immobilière",
        "welcome": "Bienvenue chez Infinity",
        "visit": "Planifier une visite",
    },
    "en": {
        "follow_up": "Following up on your project",
        "proposal": "Your property proposal",
        "welcome": "Welcome to Infinity",
        "visit": "Schedule a viewing",
    },
    "ar": {
        "follow_up": "متابعة مشروعك",
        "proposal": "عرضك العقاري",
        "welcome": "أهلًا بك في إنفينيتي",
        "visit": "تحديد موعد زيارة",
    },
}


def _email_subject(locale: Locale, purpose: str) -> str:
    subjects = _EMAIL_SUBJECTS.get(locale, _EMAIL_SUBJECTS["fr"])
    return subjects.get(purpose, subjects["follow_up"])


async def send_client_message(
    db: AsyncSession,
    company_id: uuid.UUID,
    client_id: uuid.UUID,
    channel: str,
    locale: Locale,
    purpose: str,
    message: str | None = None,
) -> dict[str, Any] | None:
    """Envoie réellement un message au client (C1). None si hors tenant (404).

    - **email** : crée une `Notification` (channel=email, pending) puis enfile
      `send_email` (Celery). Le corps = `message` (édité par l'agent) ou, à
      défaut, le brouillon déterministe. Statut `queued`.
    - **whatsapp** : le texte libre n'est PAS autorisé par Meta hors fenêtre 24h
      → statut `template_required` (aucun envoi simulé).
    - pas de coordonnée → statut `no_recipient`.

    Scoping `company_id` (Loi 1) via `get_client` ; anti-BOLA (404).
    """
    client = await get_client(db, company_id, client_id)
    if client is None:
        return None
    text = (message or "").strip() or draft_message(client, channel, locale, purpose)

    if channel == "whatsapp":
        return {
            "status": "template_required",
            "channel": "whatsapp",
            "notification_id": None,
            "detail": "WhatsApp free-text is not allowed by Meta; use an approved template.",
        }

    # Canal e-mail (texte libre autorisé).
    if not client.email:
        return {
            "status": "no_recipient",
            "channel": "email",
            "notification_id": None,
            "detail": "client has no email address",
        }

    subject = _email_subject(locale, purpose)
    notif = Notification(
        id=uuid.uuid4(),
        company_id=company_id,
        recipient_party_id=client.id,
        type="ai_outreach",
        channel="email",
        title=subject[:200],
        body=text,
        payload={"purpose": purpose, "source": "agent_ai", "locale": locale},
        status="pending",
    )
    db.add(notif)
    await db.commit()
    # Enfile l'envoi après commit (ne pas enfiler si la tx échoue).
    send_email.delay(
        to=client.email,
        subject=subject,
        body=text,
        notification_id=str(notif.id),
        company_id=str(company_id),
    )
    return {
        "status": "queued",
        "channel": "email",
        "notification_id": notif.id,
        "detail": None,
    }
