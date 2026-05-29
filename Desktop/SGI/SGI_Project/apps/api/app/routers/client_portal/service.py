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

from app.core.gemini import VALID_CATEGORIES, detect_categories, parse_client_need
from app.models.client import Client
from app.models.contract import Contract
from app.models.crm import CRMLead
from app.models.favorite import Favorite
from app.models.finance import FinanceTransaction
from app.models.message import Message
from app.models.user import User
from app.models.visit_request import VisitRequest
from app.routers.crm.service import _next_reference


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
    client_type: str | None = None,
    trn: str | None = None,
    address: str | None = None,
) -> uuid.UUID:
    """Garantit qu'un Client (party CRM) existe pour l'utilisateur courant.

    Si la fiche n'existe pas (compte créé avant que l'auto-link soit en place,
    inscription via canal non-standard, etc.), elle est créée à la volée à partir
    des infos du User (email, full_name). Idempotent.

    `client_type` (person|company), `trn` et `address` proviennent du formulaire
    d'inscription portail et alimentent respectivement Client.type,
    Client.notes (préfixé "TRN: …") et Client.preferred_location. Aucun
    schéma supplémentaire — on réutilise les colonnes existantes pour que la
    fiche soit immédiatement exploitable côté back-office.
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

    is_company = client_type == "company"
    notes = f"TRN: {trn.strip()}" if (is_company and trn and trn.strip()) else None

    client = Client(
        id=uuid.uuid4(),
        company_id=company_id,
        type="company" if is_company else "individual",
        first_name=None if is_company else first_name,
        last_name=None if is_company else last_name,
        company_name=full_name.strip() if is_company else None,
        email=user_email,
        source="portal",
        preferred_location=address.strip() if address and address.strip() else None,
        notes=notes,
    )
    db.add(client)
    await db.flush()
    return client.id


async def list_my_leads(
    db: AsyncSession, *, user_email: str, company_id: uuid.UUID
) -> list[CRMLead]:
    """Tous les leads/besoins créés par le client connecté (via sa fiche party).

    Le User(role=client) est relié au Client CRM par email ; les leads sont
    rattachés à ce client_id. Aucun lien → liste vide (pas d'erreur).
    """
    client_id = await find_linked_client_id(db, user_email, company_id)
    if not client_id:
        return []
    result = await db.execute(
        select(CRMLead)
        .where(
            CRMLead.client_id == client_id,
            CRMLead.company_id == company_id,
            CRMLead.deleted_at.is_(None),
        )
        .order_by(CRMLead.created_at.desc())
    )
    return list(result.scalars().all())


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


async def preview_client_need(
    text: str,
    *,
    locale: str,
    category_override: str | None = None,
) -> dict[str, Any]:
    """Analyse un besoin et résout la catégorie SANS créer de lead.

    Étapes 2→4 de `submit_client_need` (parse IA/heuristique, override manuel
    éventuel, règle de confiance). Utilisé par l'endpoint de prévisualisation
    pour que le client valide/corrige la catégorie avant l'envoi définitif.
    """
    parsed = await parse_client_need(text, locale=locale)  # type: ignore[arg-type]

    if category_override and category_override in VALID_CATEGORIES:
        parsed["category"] = category_override
        parsed["engine"] = parsed.get("engine", "") + "+manual"

    # Loi : confiance basse → défaut realestate (cœur métier SGI)
    if float(parsed.get("confidence") or 0) < 0.6 and not category_override:
        parsed["category"] = "realestate"

    # Détection multi-catégories : un texte peut couvrir plusieurs secteurs.
    if category_override and category_override in VALID_CATEGORIES:
        parsed["categories"] = [category_override]
    else:
        parsed["categories"] = detect_categories(text)
        # Garantit que la catégorie primaire figure en tête de la liste.
        primary = parsed["category"]
        if primary in parsed["categories"]:
            parsed["categories"].remove(primary)
        parsed["categories"].insert(0, primary)

    return parsed


async def _build_lead(
    db: AsyncSession,
    *,
    company_id: uuid.UUID,
    client_id: uuid.UUID,
    category: str,
    parsed: dict[str, Any],
    text: str,
    source: str,
) -> dict[str, Any]:
    """Crée un CRMLead pour UNE catégorie à partir du besoin parsé.

    Renvoie {lead_id, crm_ref, category}. Le scoring/budget/notes sont communs
    à toutes les catégories d'un même besoin (le texte est identique).
    """
    budget_decimal: Decimal | None = None
    if parsed.get("budget_aed"):
        try:
            budget_decimal = Decimal(str(parsed["budget_aed"]))
        except (TypeError, ValueError):
            budget_decimal = None

    golden_visa_eligible = bool(
        budget_decimal is not None and budget_decimal >= Decimal("2000000")
    )

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

    source_label = "🎤 Voix" if source == "portal_voice" else "✍️ Texte"
    notes = (
        f"[{source_label} — portal client]\n"
        f"Original :\n{text.strip()}\n\n"
        f"Résumé IA :\n{parsed.get('summary') or ''}\n"
        f"(engine={parsed.get('engine')} · confidence={parsed.get('confidence')})"
    )

    lead_id = uuid.uuid4()
    # Référence métier persistée (colonne `reference`), séquentielle par tenant
    # (CRM-YYYY-NNNNNN) — même schéma que les leads créés côté back-office, pour
    # un format unique, trié et cohérent dans toute l'application.
    crm_ref = await _next_reference(db, company_id)

    lead = CRMLead(
        id=lead_id,
        company_id=company_id,
        client_id=client_id,
        reference=crm_ref,
        agent_id=None,  # file d'attente — dispatch manager
        status="new",
        source=source,
        category=category,
        budget=budget_decimal,
        # property_type n'a de sens que pour l'immobilier
        property_type=parsed.get("property_type") if category == "realestate" else None,
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

    return {"lead_id": lead.id, "crm_ref": crm_ref, "category": lead.category}


async def submit_client_needs(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    user_email: str,
    company_id: uuid.UUID,
    text: str,
    locale: str,
    source: str,
    categories: list[str],
) -> dict[str, Any]:
    """Crée UN lead CRM par catégorie validée par le client (multi-catégories).

    Le besoin est parsé une seule fois ; chaque catégorie donnée produit un
    deal distinct dans le pipeline du secteur correspondant. Renvoie
    {deals: [{lead_id, crm_ref, category}], parsed}.
    """
    linked_client_id = await ensure_linked_client_id(
        db, user_id=user_id, user_email=user_email, company_id=company_id
    )

    parsed = await preview_client_need(text, locale=locale)

    # Filtre/normalise : catégories valides, dédupliquées, ordre préservé.
    seen: set[str] = set()
    valid: list[str] = []
    for c in categories:
        if c in VALID_CATEGORIES and c not in seen:
            seen.add(c)
            valid.append(c)
    if not valid:
        valid = [parsed["category"]]

    deals = [
        await _build_lead(
            db,
            company_id=company_id,
            client_id=linked_client_id,
            category=c,
            parsed=parsed,
            text=text,
            source=source,
        )
        for c in valid
    ]

    return {"deals": deals, "categories": valid, "parsed": parsed}


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
    """Variante mono-catégorie (compat) — délègue à `submit_client_needs`."""
    parsed = await preview_client_need(
        text, locale=locale, category_override=category_override
    )
    res = await submit_client_needs(
        db,
        user_id=user_id,
        user_email=user_email,
        company_id=company_id,
        text=text,
        locale=locale,
        source=source,
        categories=[parsed["category"]],
    )
    deal = res["deals"][0]
    return {
        "lead_id": deal["lead_id"],
        "crm_ref": deal["crm_ref"],
        "category": deal["category"],
        "parsed": res["parsed"],
    }


# ── Profil client (« mon profil ») ───────────────────────────────────────


async def _attach_language(db: AsyncSession, client: Client, user_id: uuid.UUID) -> None:
    """Attache la langue préférée (portée par le compte User) sur la fiche Client.

    `preferred_language` n'est pas une colonne de Client — c'est un attribut
    dynamique lu par ClientMeProfileOut (from_attributes).
    """
    row = (
        await db.execute(select(User.preferred_language).where(User.id == user_id))
    ).first()
    client.preferred_language = (row[0] if row else "en")  # type: ignore[attr-defined]


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
    if not client:
        client_id = await ensure_linked_client_id(
            db, user_id=user_id, user_email=user_email, company_id=company_id
        )
        client = await find_linked_client(db, user_email, company_id)
        assert client is not None, f"client_just_created_not_found:{client_id}"
    await _attach_language(db, client, user_id)
    return client


async def update_my_profile(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    user_email: str,
    company_id: uuid.UUID,
    data: dict[str, Any],
) -> Client:
    """Met à jour les champs whitelistés du profil client courant.

    `preferred_language` est appliqué au compte User (pas à la fiche Client) ;
    les autres champs vont sur le Client. Whitelist garanti par le schéma.
    """
    language = data.pop("preferred_language", None)

    client = await get_my_profile(
        db, user_id=user_id, user_email=user_email, company_id=company_id
    )
    for field, value in data.items():
        setattr(client, field, value)
    client.updated_at = datetime.now(timezone.utc)

    if language:
        user = (
            await db.execute(select(User).where(User.id == user_id))
        ).scalar_one_or_none()
        if user:
            user.preferred_language = language

    await db.flush()
    await db.refresh(client)
    await _attach_language(db, client, user_id)
    return client
