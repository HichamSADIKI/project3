"""Service — Agent AI Fournisseurs.

Symétrique de l'agent AI Clients : helpers purs déterministes (testables sans
DB) + orchestration async scopée `company_id` (Loi 1) avec enrichissement
Gemini best-effort et repli heuristique systématique.

Réutilise la logique métier vendors existante (`cancellation_rate`,
`is_eligible_for_marketplace`) pour rester cohérent avec le marketplace.
"""

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core import gemini
from app.core.pdpl import pdpl_safe  # garde PDPL mutualisée (source unique)
from app.models.client import Client
from app.models.notification import Notification
from app.models.party_vendor import Vendor
from app.routers.vendors.ai_schemas import Locale
from app.routers.vendors.service import cancellation_rate, get_vendor, vendors_summary
from app.tasks.notifications import send_email

# Bandes de fiabilité (score haut = fournisseur fiable).
LOW_RISK_BAND = 70
MEDIUM_RISK_BAND = 40

# Fenêtre d'alerte avant expiration d'un document (jours).
EXPIRY_WARN_DAYS = 30


# ── Helpers purs : score de fiabilité / risque ────────────────────────────


def _days_until(target: date | None, today: date) -> int | None:
    return (target - today).days if target is not None else None


def assess_vendor_risk(vendor: Vendor, today: date) -> dict[str, Any]:
    """Score de fiabilité 0-100 d'un fournisseur (helper pur, déterministe).

    Part d'une base neutre (50) puis ajuste selon la note moyenne, le taux
    d'annulation, la ponctualité, le statut de vérification, l'activité et la
    validité des documents (licence, assurance). `risk_band` est l'inverse du
    score : un score élevé = risque faible.
    """
    score = 50
    flags: list[str] = []

    # Notation (5★). Centrée sur 3 : +20 à 5★, -30 à 0★.
    if vendor.rating_count > 0:
        score += int((Decimal(str(vendor.rating_avg)) - Decimal("3")) * 10)
    else:
        flags.append("no_ratings")

    # Taux d'annulation (réutilise la logique métier vendors).
    cancel = cancellation_rate(vendor.jobs_completed, vendor.jobs_cancelled)
    if cancel > Decimal("20"):
        score -= 20
        flags.append("high_cancellation")
    elif cancel > Decimal("10"):
        score -= 10
        flags.append("elevated_cancellation")

    # Ponctualité (centrée sur 80 %).
    if vendor.on_time_rate is not None:
        score += int((Decimal(str(vendor.on_time_rate)) - Decimal("80")) / 2)

    if vendor.verification_status != "verified":
        score -= 25
        flags.append("not_verified")
    if not vendor.is_active:
        score -= 15
        flags.append("inactive")

    licence_days = _days_until(vendor.trade_licence_expiry, today)
    if licence_days is not None and licence_days < 0:
        score -= 20
        flags.append("licence_expired")
    elif licence_days is not None and licence_days <= EXPIRY_WARN_DAYS:
        score -= 5
        flags.append("licence_expiring")
    elif vendor.trade_licence_expiry is None:
        flags.append("licence_missing")

    insurance_days = _days_until(vendor.insurance_expiry, today)
    if insurance_days is not None and insurance_days < 0:
        score -= 15
        flags.append("insurance_expired")

    score = max(0, min(score, 100))
    if score >= LOW_RISK_BAND:
        risk_band = "low"
    elif score >= MEDIUM_RISK_BAND:
        risk_band = "medium"
    else:
        risk_band = "high"
    return {"score": score, "risk_band": risk_band, "flags": flags}


def risk_actions(risk_result: dict[str, Any]) -> list[str]:
    """Actions déterministes selon les drapeaux de risque détectés."""
    actions: list[str] = []
    flags = set(risk_result["flags"])
    if "not_verified" in flags:
        actions.append("complete_verification")
    if flags & {"licence_expired", "licence_expiring", "licence_missing"}:
        actions.append("request_trade_licence")
    if "insurance_expired" in flags:
        actions.append("request_insurance")
    if flags & {"high_cancellation", "elevated_cancellation"}:
        actions.append("review_performance")
    if "no_ratings" in flags:
        actions.append("collect_first_rating")
    if risk_result["risk_band"] == "low" and not actions:
        actions.append("eligible_for_jobs")
    return list(dict.fromkeys(actions))


def risk_narrative(risk_result: dict[str, Any], locale: Locale) -> str:
    """Phrase de synthèse heuristique du risque (repli sans IA), localisée."""
    score = risk_result["score"]
    band = risk_result["risk_band"]
    n_flags = len(risk_result["flags"])
    if locale == "ar":
        return f"درجة الموثوقية {score}/100 (المخاطرة: {band})، {n_flags} ملاحظة."
    if locale == "en":
        return f"Reliability score {score}/100 (risk: {band}), {n_flags} flag(s)."
    return f"Score de fiabilité {score}/100 (risque : {band}), {n_flags} signal(aux)."


# ── Helpers purs : aide à la validation d'inscription ─────────────────────


def validation_assessment(vendor: Vendor, today: date) -> dict[str, Any]:
    """Recommande une décision de validation pour une inscription portail (pur).

    Distingue les blocages (documents manquants/expirés → impossible d'approuver
    en l'état) des avertissements (signaux de performance). Un dossier complet
    et propre → `approve` ; documents manquants → `request_documents` ; signaux
    de performance négatifs → `review`.
    """
    if vendor.verification_status == "verified":
        return {
            "recommendation": "approve",
            "blocking_issues": [],
            "warnings": ["already_verified"],
        }
    if vendor.verification_status == "rejected":
        return {
            "recommendation": "reject",
            "blocking_issues": ["previously_rejected"],
            "warnings": [],
        }

    blocking: list[str] = []
    warnings: list[str] = []

    if not vendor.trade_licence_number:
        blocking.append("missing_trade_licence_number")
    licence_days = _days_until(vendor.trade_licence_expiry, today)
    if vendor.trade_licence_expiry is None:
        blocking.append("missing_trade_licence_expiry")
    elif licence_days is not None and licence_days < 0:
        blocking.append("trade_licence_expired")
    if not vendor.categories:
        blocking.append("no_categories")

    cancel = cancellation_rate(vendor.jobs_completed, vendor.jobs_cancelled)
    if cancel > Decimal("20"):
        warnings.append("high_cancellation")
    if vendor.rating_count > 0 and Decimal(str(vendor.rating_avg)) < Decimal("3"):
        warnings.append("low_rating")

    if blocking:
        recommendation = "request_documents"
    elif warnings:
        recommendation = "review"
    else:
        recommendation = "approve"
    return {
        "recommendation": recommendation,
        "blocking_issues": blocking,
        "warnings": warnings,
    }


def validation_narrative(assessment: dict[str, Any], locale: Locale) -> str:
    rec = assessment["recommendation"]
    nb = len(assessment["blocking_issues"])
    if locale == "ar":
        return f"التوصية: {rec} ({nb} عائق)."
    if locale == "en":
        return f"Recommendation: {rec} ({nb} blocking issue(s))."
    return f"Recommandation : {rec} ({nb} blocage(s))."


# ── Helpers purs : insights parc ──────────────────────────────────────────


def parc_insights(summary: dict[str, Any], locale: Locale = "fr") -> dict[str, Any]:
    """Synthèse à puces du parc fournisseurs (helper pur).

    `summary` = sortie de `vendors_summary` (by_type, by_verification,
    active_count, verified_count, total).
    """
    total = int(summary.get("total", 0))
    by_type: dict[str, int] = dict(summary.get("by_type", {}))
    by_verification: dict[str, int] = dict(summary.get("by_verification", {}))
    active = int(summary.get("active_count", 0))
    verified = int(summary.get("verified_count", 0))
    pending = int(by_verification.get("pending", 0))

    bullets: list[str] = []
    if locale == "ar":
        headline = f"شبكة من {total} مورّد."
        bullets.append(f"{active} نشِط، {verified} موثَّق.")
        if pending:
            bullets.append(f"{pending} بانتظار الاعتماد.")
        if by_type:
            bullets.append("حسب النوع: " + _fmt_counts(by_type, top=4))
    elif locale == "en":
        headline = f"Network of {total} vendors."
        bullets.append(f"{active} active, {verified} verified.")
        if pending:
            bullets.append(f"{pending} pending approval.")
        if by_type:
            bullets.append("By type: " + _fmt_counts(by_type, top=4))
    else:
        headline = f"Parc de {total} fournisseurs."
        bullets.append(f"{active} actifs, {verified} vérifiés.")
        if pending:
            bullets.append(f"{pending} en attente de validation.")
        if by_type:
            bullets.append("Par type : " + _fmt_counts(by_type, top=4))

    return {
        "total": total,
        "headline": headline,
        "bullets": bullets,
        "active_count": active,
        "verified_count": verified,
        "by_type": by_type,
        "by_verification": by_verification,
    }


def _fmt_counts(counts: dict[str, int], top: int | None = None) -> str:
    items = sorted(counts.items(), key=lambda kv: kv[1], reverse=True)
    if top is not None:
        items = items[:top]
    return ", ".join(f"{k} ({v})" for k, v in items)


# ── Orchestration async (DB + Gemini, scopée company_id) ──────────────────


def _today() -> date:
    return datetime.now(UTC).date()


async def vendor_risk(
    db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID, locale: Locale = "fr"
) -> dict[str, Any] | None:
    """Score de fiabilité d'un fournisseur du tenant. None si introuvable (404)."""
    vendor = await get_vendor(db, company_id, party_id)
    if vendor is None:
        return None
    result = assess_vendor_risk(vendor, _today())
    actions = risk_actions(result)
    narrative = risk_narrative(result, locale)
    engine = "heuristic"
    gen = await gemini.generate_text(
        f"Summarise the reliability of a UAE facility-management vendor in 2 "
        f"sentences. Score {result['score']}/100, risk {result['risk_band']}, "
        f"flags {result['flags']}. Answer in locale={locale}.",
        system_instruction="You are a concise UAE vendor-risk analyst.",
        locale=locale,
        max_chars=600,
    )
    if gen.get("text"):
        narrative = gen["text"]
        engine = gen.get("engine", "gemini")
    return {
        "party_id": vendor.party_id,
        "score": result["score"],
        "risk_band": result["risk_band"],
        "flags": result["flags"],
        "recommended_actions": actions,
        "narrative": narrative,
        "engine": engine,
    }


async def vendor_validation(
    db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID, locale: Locale = "fr"
) -> dict[str, Any] | None:
    """Aide à la validation d'un fournisseur du tenant. None si introuvable (404)."""
    vendor = await get_vendor(db, company_id, party_id)
    if vendor is None:
        return None
    assessment = validation_assessment(vendor, _today())
    narrative = validation_narrative(assessment, locale)
    engine = "heuristic"
    gen = await gemini.generate_text(
        "Explain in 2 sentences the onboarding decision for a UAE vendor. "
        f"Recommendation {assessment['recommendation']}, blocking "
        f"{assessment['blocking_issues']}, warnings {assessment['warnings']}. "
        f"Answer in locale={locale}.",
        system_instruction="You are a UAE vendor-onboarding compliance officer.",
        locale=locale,
        max_chars=600,
    )
    if gen.get("text"):
        narrative = gen["text"]
        engine = gen.get("engine", "gemini")
    return {
        "party_id": vendor.party_id,
        "recommendation": assessment["recommendation"],
        "blocking_issues": assessment["blocking_issues"],
        "warnings": assessment["warnings"],
        "narrative": narrative,
        "engine": engine,
    }


async def vendors_insights(
    db: AsyncSession, company_id: uuid.UUID, locale: Locale = "fr"
) -> dict[str, Any]:
    """Synthèse IA du parc fournisseurs du tenant (Loi 1)."""
    summary = await vendors_summary(db, company_id)
    insights = parc_insights(summary, locale)
    narrative = " ".join([insights["headline"], *insights["bullets"]])
    engine = "heuristic"
    gen = await gemini.generate_text(
        "Write a 3-sentence executive summary of this vendor network for an "
        f"operations manager. Data: {pdpl_safe(summary)}. Answer in locale={locale}.",
        system_instruction="You are a concise UAE vendor-network analyst.",
        locale=locale,
        max_chars=800,
    )
    if gen.get("text"):
        narrative = gen["text"]
        engine = gen.get("engine", "gemini")
    return {**insights, "narrative": narrative, "engine": engine}


_CHAT_SYSTEM = (
    "You are the Vendors AI assistant for an Infinity UAE facility-management "
    "agency. You help operations staff understand and act on THEIR vendor "
    "network only. Be concise and practical. Never invent vendor data; rely on "
    "the provided network summary."
)


async def vendor_chat(
    db: AsyncSession,
    company_id: uuid.UUID,
    messages: list[dict[str, str]],
    locale: Locale = "fr",
) -> dict[str, Any]:
    """Chat conversationnel scopé au parc fournisseurs du tenant (Loi 1)."""
    summary = await vendors_summary(db, company_id)
    context = parc_insights(summary, locale)
    system = f"{_CHAT_SYSTEM}\n\nVendor network summary (JSON): {pdpl_safe(summary)}"
    gen = await gemini.generate_chat(messages, system_instruction=system, locale=locale)
    if gen.get("text"):
        return {
            "reply": gen["text"],
            "engine": gen.get("engine", "gemini"),
            "context": {"total": context["total"]},
        }
    reply = " ".join([context["headline"], *context["bullets"]])
    return {"reply": reply, "engine": "heuristic", "context": {"total": context["total"]}}


# ── Message d'outreach fournisseur (parité Clients) ───────────────────────

# Brouillons déterministes par intention (repli sans IA), localisés AR/EN/FR.
_VENDOR_TEMPLATES: dict[str, dict[str, str]] = {
    "fr": {
        "request_documents": (
            "Bonjour, merci de nous transmettre votre licence commerciale et votre "
            "attestation d'assurance à jour afin de finaliser votre référencement."
        ),
        "performance_review": (
            "Bonjour, nous souhaitons faire un point sur vos interventions récentes. "
            "Êtes-vous disponible cette semaine ?"
        ),
        "welcome": (
            "Bonjour, bienvenue dans le réseau de prestataires Infinity. Nous "
            "reviendrons vers vous pour les prochaines missions."
        ),
        "follow_up": (
            "Bonjour, nous revenons vers vous concernant votre collaboration avec Infinity."
        ),
    },
    "en": {
        "request_documents": (
            "Hello, please send us your up-to-date trade licence and insurance "
            "certificate so we can finalise your onboarding."
        ),
        "performance_review": (
            "Hello, we'd like to review your recent jobs. Are you available this week?"
        ),
        "welcome": (
            "Hello, welcome to the Infinity vendor network. We'll be in touch for "
            "upcoming assignments."
        ),
        "follow_up": "Hello, following up on your collaboration with Infinity.",
    },
    "ar": {
        "request_documents": (
            "مرحبًا، يرجى تزويدنا برخصتك التجارية وشهادة التأمين السارية لإتمام اعتمادك."
        ),
        "performance_review": "مرحبًا، نودّ مراجعة أعمالك الأخيرة. هل أنت متاح هذا الأسبوع؟",
        "welcome": "مرحبًا، أهلًا بك في شبكة مزوّدي إنفينيتي. سنتواصل معك للمهام القادمة.",
        "follow_up": "مرحبًا، نتابع معك بخصوص تعاونك مع إنفينيتي.",
    },
}

_VENDOR_EMAIL_SUBJECTS: dict[str, dict[str, str]] = {
    "fr": {
        "request_documents": "Documents requis",
        "performance_review": "Revue de performance",
        "welcome": "Bienvenue — réseau prestataires Infinity",
        "follow_up": "Suivi de votre collaboration",
    },
    "en": {
        "request_documents": "Required documents",
        "performance_review": "Performance review",
        "welcome": "Welcome — Infinity vendor network",
        "follow_up": "Following up",
    },
    "ar": {
        "request_documents": "المستندات المطلوبة",
        "performance_review": "مراجعة الأداء",
        "welcome": "أهلًا بك — شبكة مزوّدي إنفينيتي",
        "follow_up": "متابعة التعاون",
    },
}


def draft_vendor_message(channel: str, locale: Locale, purpose: str) -> str:
    """Brouillon d'outreach fournisseur déterministe (repli sans IA), localisé."""
    templates = _VENDOR_TEMPLATES.get(locale, _VENDOR_TEMPLATES["fr"])
    return templates.get(purpose, templates["request_documents"])


def _vendor_email_subject(locale: Locale, purpose: str) -> str:
    subjects = _VENDOR_EMAIL_SUBJECTS.get(locale, _VENDOR_EMAIL_SUBJECTS["fr"])
    return subjects.get(purpose, subjects["request_documents"])


async def _vendor_email(db: AsyncSession, company_id: uuid.UUID, party_id: uuid.UUID) -> str | None:
    """Email de la party (Client) sous-jacente au fournisseur (scopé company_id)."""
    result = await db.execute(
        select(Client.email).where(
            Client.id == party_id,
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def vendor_message(
    db: AsyncSession,
    company_id: uuid.UUID,
    party_id: uuid.UUID,
    channel: str,
    locale: Locale,
    purpose: str,
) -> dict[str, Any] | None:
    """Brouillon de message d'outreach pour un fournisseur du tenant (404 sinon)."""
    vendor = await get_vendor(db, company_id, party_id)
    if vendor is None:
        return None
    message = draft_vendor_message(channel, locale, purpose)
    engine = "heuristic"
    gen = await gemini.generate_text(
        f"Write a short, professional {channel} message ({purpose}) to a UAE "
        "facility-management vendor for an agency. One short paragraph. "
        f"Answer in locale={locale}.",
        system_instruction="You are a UAE vendor-relations officer.",
        locale=locale,
        max_chars=600,
    )
    if gen.get("text"):
        message = gen["text"]
        engine = gen.get("engine", "gemini")
    return {
        "party_id": vendor.party_id,
        "channel": channel,
        "locale": locale,
        "purpose": purpose,
        "message": message,
        "engine": engine,
    }


async def send_vendor_message(
    db: AsyncSession,
    company_id: uuid.UUID,
    party_id: uuid.UUID,
    channel: str,
    locale: Locale,
    purpose: str,
    message: str | None = None,
) -> dict[str, Any] | None:
    """Envoie réellement un message au fournisseur (email via Celery). 404 sinon.

    Miroir de `send_client_message` : email → Notification + send_email ;
    WhatsApp → `template_required` ; pas d'email → `no_recipient`. Le destinataire
    est l'email de la party (Client) liée au fournisseur. Scoping company_id (Loi 1).
    """
    vendor = await get_vendor(db, company_id, party_id)
    if vendor is None:
        return None
    text = (message or "").strip() or draft_vendor_message(channel, locale, purpose)

    if channel == "whatsapp":
        return {
            "status": "template_required",
            "channel": "whatsapp",
            "notification_id": None,
            "detail": "WhatsApp free-text is not allowed by Meta; use an approved template.",
        }

    email = await _vendor_email(db, company_id, party_id)
    if not email:
        return {
            "status": "no_recipient",
            "channel": "email",
            "notification_id": None,
            "detail": "vendor party has no email address",
        }

    subject = _vendor_email_subject(locale, purpose)
    notif = Notification(
        id=uuid.uuid4(),
        company_id=company_id,
        recipient_party_id=party_id,
        type="ai_vendor_outreach",
        channel="email",
        title=subject[:200],
        body=text,
        payload={"purpose": purpose, "source": "agent_ai", "locale": locale},
        status="pending",
    )
    db.add(notif)
    await db.commit()
    send_email.delay(
        to=email,
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
