"""Logique métier de l'espace Client.

Note d'architecture : le compte User(role=client) est lié au CRM Client (party)
via l'email (les deux tables ont un index sur email). Cette correspondance
permet de retrouver contrats/paiements/locations/GV du client.
"""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.gemini import VALID_CATEGORIES, parse_client_need
from app.models.client import Client
from app.models.contract import Contract
from app.models.crm import CRMLead
from app.models.favorite import Favorite
from app.models.finance import FinanceTransaction
from app.models.message import Message
from app.models.user import User
from app.models.visit_request import VisitRequest


async def find_linked_client_id(
    db: AsyncSession, user_email: str, company_id: uuid.UUID
) -> uuid.UUID | None:
    """Retourne l'ID du Client (party CRM) lié à un utilisateur via email."""
    result = await db.execute(
        select(Client.id).where(
            Client.email == user_email,
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def find_linked_client(
    db: AsyncSession, user_email: str, company_id: uuid.UUID
) -> Client | None:
    """Retourne le Client (party CRM) lié à un utilisateur via email."""
    result = await db.execute(
        select(Client).where(
            Client.email == user_email,
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def ensure_linked_client_id(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    user_email: str,
    company_id: uuid.UUID,
) -> uuid.UUID:
    """Garantit qu'un Client (party CRM) existe pour l'utilisateur courant.

    Si la fiche n'existe pas (compte créé avant que l'auto-link soit en place,
    inscription via canal non-standard, etc.), elle est créée à la volée à partir
    des infos du User (email, full_name). Idempotent.
    """
    existing = await find_linked_client_id(db, user_email, company_id)
    if existing:
        return existing

    user_row = (
        await db.execute(select(User.full_name).where(User.id == user_id))
    ).first()
    full_name = (user_row[0] if user_row else None) or user_email.split("@")[0]
    parts = full_name.strip().split(" ", 1)
    first_name = parts[0] or None
    last_name = parts[1] if len(parts) > 1 else None

    client = Client(
        id=uuid.uuid4(),
        company_id=company_id,
        type="individual",
        first_name=first_name,
        last_name=last_name,
        email=user_email,
        source="portal",
    )
    db.add(client)
    await db.flush()
    return client.id


async def list_my_favorites(
    db: AsyncSession, user_id: uuid.UUID, company_id: uuid.UUID
) -> list[Favorite]:
    result = await db.execute(
        select(Favorite)
        .where(Favorite.user_id == user_id, Favorite.company_id == company_id)
        .order_by(Favorite.created_at.desc())
    )
    return list(result.scalars().all())


async def add_favorite(
    db: AsyncSession, user_id: uuid.UUID, company_id: uuid.UUID, property_id: uuid.UUID
) -> Favorite:
    fav = Favorite(
        id=uuid.uuid4(),
        company_id=company_id,
        user_id=user_id,
        property_id=property_id,
    )
    db.add(fav)
    await db.flush()
    return fav


async def remove_favorite(
    db: AsyncSession, user_id: uuid.UUID, favorite_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(Favorite).where(Favorite.id == favorite_id, Favorite.user_id == user_id)
    )
    fav = result.scalar_one_or_none()
    if not fav:
        return False
    await db.delete(fav)
    return True


async def list_my_visits(
    db: AsyncSession, user_id: uuid.UUID, company_id: uuid.UUID
) -> list[VisitRequest]:
    result = await db.execute(
        select(VisitRequest)
        .where(
            VisitRequest.user_id == user_id,
            VisitRequest.company_id == company_id,
            VisitRequest.deleted_at.is_(None),
        )
        .order_by(VisitRequest.preferred_date.desc())
    )
    return list(result.scalars().all())


async def create_visit_request(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    company_id: uuid.UUID,
    property_id: uuid.UUID,
    preferred_date,
    preferred_time_slot: str | None,
    client_notes: str | None,
) -> VisitRequest:
    visit = VisitRequest(
        id=uuid.uuid4(),
        company_id=company_id,
        user_id=user_id,
        property_id=property_id,
        preferred_date=preferred_date,
        preferred_time_slot=preferred_time_slot,
        status="pending",
        client_notes=client_notes,
    )
    db.add(visit)
    await db.flush()
    return visit


async def list_my_messages(
    db: AsyncSession, user_id: uuid.UUID, company_id: uuid.UUID
) -> list[Message]:
    """Retourne les messages où l'utilisateur est sender OU recipient."""
    result = await db.execute(
        select(Message)
        .where(
            Message.company_id == company_id,
            Message.deleted_at.is_(None),
            (Message.sender_user_id == user_id)
            | (Message.recipient_user_id == user_id),
        )
        .order_by(Message.created_at.desc())
    )
    return list(result.scalars().all())


async def send_message(
    db: AsyncSession,
    *,
    sender_user_id: uuid.UUID,
    company_id: uuid.UUID,
    recipient_user_id: uuid.UUID,
    subject: str | None,
    body: str,
    related_property_id: uuid.UUID | None,
    related_contract_id: uuid.UUID | None,
) -> Message:
    msg = Message(
        id=uuid.uuid4(),
        company_id=company_id,
        sender_user_id=sender_user_id,
        recipient_user_id=recipient_user_id,
        subject=subject,
        body=body,
        related_property_id=related_property_id,
        related_contract_id=related_contract_id,
    )
    db.add(msg)
    await db.flush()
    return msg


async def mark_message_read(
    db: AsyncSession, user_id: uuid.UUID, message_id: uuid.UUID
) -> bool:
    """Marque un message comme lu (seul le destinataire peut le faire)."""
    result = await db.execute(
        select(Message).where(
            Message.id == message_id,
            Message.recipient_user_id == user_id,
            Message.deleted_at.is_(None),
        )
    )
    msg = result.scalar_one_or_none()
    if not msg:
        return False
    if msg.read_at is None:
        msg.read_at = datetime.now(timezone.utc)
        await db.flush()
    return True


async def compute_dashboard(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    user_email: str,
    company_id: uuid.UUID,
) -> dict[str, int]:
    """Agrégats légers pour le dashboard client (5 COUNT en parallèle logique)."""
    favorites_count = (
        await db.execute(
            select(func.count(Favorite.id)).where(
                Favorite.user_id == user_id, Favorite.company_id == company_id
            )
        )
    ).scalar_one() or 0

    pending_visits = (
        await db.execute(
            select(func.count(VisitRequest.id)).where(
                VisitRequest.user_id == user_id,
                VisitRequest.company_id == company_id,
                VisitRequest.status.in_(("pending", "confirmed")),
                VisitRequest.deleted_at.is_(None),
            )
        )
    ).scalar_one() or 0

    unread_messages = (
        await db.execute(
            select(func.count(Message.id)).where(
                Message.recipient_user_id == user_id,
                Message.company_id == company_id,
                Message.read_at.is_(None),
                Message.deleted_at.is_(None),
            )
        )
    ).scalar_one() or 0

    linked_client_id = await find_linked_client_id(db, user_email, company_id)
    active_contracts = 0
    upcoming_payments = 0
    if linked_client_id:
        active_contracts = (
            await db.execute(
                select(func.count(Contract.id)).where(
                    Contract.client_id == linked_client_id,
                    Contract.company_id == company_id,
                    Contract.status.in_(("active", "signed")),
                    Contract.deleted_at.is_(None),
                )
            )
        ).scalar_one() or 0

        upcoming_payments = (
            await db.execute(
                select(func.count(FinanceTransaction.id)).where(
                    FinanceTransaction.related_client_id == linked_client_id,
                    FinanceTransaction.company_id == company_id,
                    FinanceTransaction.status == "pending",
                    FinanceTransaction.deleted_at.is_(None),
                )
            )
        ).scalar_one() or 0

    return {
        "favorites_count": int(favorites_count),
        "active_contracts": int(active_contracts),
        "upcoming_payments": int(upcoming_payments),
        "pending_visits": int(pending_visits),
        "unread_messages": int(unread_messages),
    }


# ── Expression de besoin (texte / dictée vocale) ─────────────────────────


async def submit_client_need(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    user_email: str,
    company_id: uuid.UUID,
    text: str,
    locale: str,
    source: str,
    category_override: str | None = None,
) -> dict[str, Any]:
    """
    Workflow :
      1. Garantit qu'une fiche Client CRM (party) existe pour l'utilisateur —
         créée à la volée si absente (compte créé avant l'auto-link).
      2. Appel Gemini (ou fallback heuristique) pour parser le besoin.
      3. Si category_override fourni → court-circuite l'IA.
      4. Si confidence < 0.6 → catégorie 'realestate' (cœur métier SGI).
      5. Création d'un CRMLead avec status='new' et category détectée.
      6. Notes = texte original (préfixe vocal/écrit) + résumé IA.
    Renvoie {lead_id, crm_ref, category, parsed}.
    """
    linked_client_id = await ensure_linked_client_id(
        db, user_id=user_id, user_email=user_email, company_id=company_id
    )

    parsed = await parse_client_need(text, locale=locale)  # type: ignore[arg-type]

    # Override manuel du client (cas où l'IA hésite)
    if category_override and category_override in VALID_CATEGORIES:
        parsed["category"] = category_override
        parsed["engine"] = parsed.get("engine", "") + "+manual"

    # Loi : confiance basse → défaut realestate (Q&A produit)
    if float(parsed.get("confidence") or 0) < 0.6 and not category_override:
        parsed["category"] = "realestate"

    # Score initial — réutilise les règles CRM
    budget_decimal: Decimal | None = None
    if parsed.get("budget_aed"):
        try:
            budget_decimal = Decimal(str(parsed["budget_aed"]))
        except (TypeError, ValueError):
            budget_decimal = None

    golden_visa_eligible = bool(
        budget_decimal is not None and budget_decimal >= Decimal("2000000")
    )

    # Score = règles CLAUDE.md mais sans last_contact (lead frais)
    score = 0
    if budget_decimal is not None:
        if budget_decimal >= Decimal("2000000"):
            score += 25
        elif budget_decimal >= Decimal("500000"):
            score += 15
    if golden_visa_eligible:
        score += 20
    if parsed.get("property_type"):
        score += 15

    # Notes structurées — original + résumé
    source_label = "🎤 Voix" if source == "portal_voice" else "✍️ Texte"
    notes = (
        f"[{source_label} — portal client]\n"
        f"Original :\n{text.strip()}\n\n"
        f"Résumé IA :\n{parsed.get('summary') or ''}\n"
        f"(engine={parsed.get('engine')} · confidence={parsed.get('confidence')})"
    )

    lead = CRMLead(
        id=uuid.uuid4(),
        company_id=company_id,
        client_id=linked_client_id,
        agent_id=None,  # file d'attente — dispatch manager
        status="new",
        source=source,
        category=parsed["category"],
        budget=budget_decimal,
        property_type=parsed.get("property_type"),
        preferred_location=parsed.get("preferred_location"),
        golden_visa_eligible=golden_visa_eligible,
        score=min(score, 100),
        response_rate=Decimal("0.0"),
        contact_attempts=0,
        notes=notes,
    )
    db.add(lead)
    await db.flush()
    await db.refresh(lead)

    crm_ref = f"CRM-{datetime.now(timezone.utc).year}-{str(lead.id)[:8].upper()}"

    return {
        "lead_id": lead.id,
        "crm_ref": crm_ref,
        "category": lead.category,
        "parsed": parsed,
    }


# ── Profil client (« mon profil ») ───────────────────────────────────────


async def get_my_profile(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    user_email: str,
    company_id: uuid.UUID,
) -> Client:
    """Retourne la fiche Client (party CRM) du portail utilisateur courant.

    Idempotent : crée la fiche à la volée si elle manque (filet de sécurité
    pour les comptes créés avant l'auto-link au register).
    """
    client = await find_linked_client(db, user_email, company_id)
    if client:
        return client
    client_id = await ensure_linked_client_id(
        db, user_id=user_id, user_email=user_email, company_id=company_id
    )
    refreshed = await find_linked_client(db, user_email, company_id)
    assert refreshed is not None, f"client_just_created_not_found:{client_id}"
    return refreshed


async def update_my_profile(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    user_email: str,
    company_id: uuid.UUID,
    data: dict[str, Any],
) -> Client:
    """Met à jour les champs whitelistés du profil client courant.

    Le whitelist est appliqué par le schéma `ClientMeProfileUpdate` — on
    réinjecte uniquement les attributs présents dans `data` (exclude_unset).
    """
    client = await get_my_profile(
        db, user_id=user_id, user_email=user_email, company_id=company_id
    )
    for field, value in data.items():
        setattr(client, field, value)
    client.updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(client)
    return client
