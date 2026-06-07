"""Seed idempotent — données de démo SGI.

Exécuté par `make seed` (cf. Makefile : `docker compose exec api uv run python scripts/seed.py`).

Garanties d'idempotence : chaque entité est upsert par identifiant stable
(slug pour la company, UUID figé pour Ahmed Al Demo, email pour les users).
Relancer ce script n'altère jamais les données existantes — il complète.

Démo couverte :
- Company `infinity-uae` (tenant par défaut référencé dans apps/portal et apps/web)
- Client Ahmed Al Demo (UUID 11111111-…1111) — c'est la même fiche que celle
  affichée par défaut dans le mock back-office, désormais persistée en base.
"""

from __future__ import annotations

import asyncio
import uuid
from decimal import Decimal

from sqlalchemy import select

from app.core.auth import hash_password
from app.core.database import async_session_maker
from app.models.client import Client
from app.models.company import Company
from app.models.crm import CRMLead
from app.models.user import User, UserRole, UserStatus
from app.routers.crm.service import _next_reference, calculate_score
from scripts.seed_realestate import seed_realestate

DEMO_COMPANY_SLUG = "infinity-uae"
DEMO_COMPANY_NAME = "Infinity International Facilities Management UAE"
DEMO_CLIENT_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
DEMO_CLIENT_EMAIL = "ahmed.demo@infinity-uae.com"

# Comptes connectables de démo (email + mot de passe).
# - admin  → back-office (apps/web, port 5001) : rôle admin/manager/agent
# - client → portail public (apps/portal, port 3001) : rôle client, statut active
DEMO_ADMIN_EMAIL = "admin@infinity-uae.com"
DEMO_ADMIN_PASSWORD = "Admin123!"
DEMO_PORTAL_CLIENT_PASSWORD = "Client123!"
# Compte fournisseur (apps/portal, profil « Fournisseur », rôle PARTNER).
# Valeurs alignées sur le prefill du LoginForm portail (demo-partner@example.com).
DEMO_FOURNISSEUR_EMAIL = "demo-partner@example.com"
DEMO_FOURNISSEUR_PASSWORD = "DemoPass!23"


async def upsert_company(session) -> Company:
    existing = (
        await session.execute(select(Company).where(Company.slug == DEMO_COMPANY_SLUG))
    ).scalar_one_or_none()
    if existing:
        print(f"  company '{DEMO_COMPANY_SLUG}' déjà présente (id={existing.id})")
        return existing
    company = Company(
        id=uuid.uuid4(),
        slug=DEMO_COMPANY_SLUG,
        name=DEMO_COMPANY_NAME,
        plan="pro",
        is_active=True,
    )
    session.add(company)
    await session.flush()
    print(f"  company '{DEMO_COMPANY_SLUG}' créée (id={company.id})")
    return company


async def upsert_demo_client(session, company_id: uuid.UUID) -> Client:
    existing = (
        await session.execute(select(Client).where(Client.id == DEMO_CLIENT_ID))
    ).scalar_one_or_none()
    if existing:
        print(f"  client Ahmed Al Demo déjà présent (id={existing.id})")
        return existing
    client = Client(
        id=DEMO_CLIENT_ID,
        company_id=company_id,
        type="individual",
        first_name="Ahmed",
        last_name="Al Demo",
        email=DEMO_CLIENT_EMAIL,
        phone="+971 50 000 0001",
        nationality="UAE",
        country_of_residence="UAE",
        source="crm",
        budget_min=10_000_000,
        budget_max=12_000_000,
        preferred_property_type="villa",
        preferred_location="Palm Jumeirah, Dubai",
        notes="Démo — fiche de référence (Yasmine K., trilingue ar/en/fr).",
    )
    session.add(client)
    await session.flush()
    print(f"  client Ahmed Al Demo créé (id={client.id})")
    return client


# Leads CRM de démo — multi-secteurs, chacun avec une référence métier stable
# (CRM-2026-NNNNNN). UUID figés pour l'idempotence. Tous rattachés à la fiche
# Ahmed Al Demo. (seq, status, category, source, budget, property_type,
# preferred_location, golden_visa_eligible, response_rate)
DEMO_LEADS: list[
    tuple[int, str, str, str | None, int | None, str | None, str | None, bool, float]
] = [
    (1, "qualified", "realestate", "crm", 12_000_000, "villa", "Palm Jumeirah, Dubai", True, 0.80),
    (
        2,
        "proposal_sent",
        "realestate",
        "portal_text",
        2_500_000,
        "apartment",
        "Downtown Dubai",
        True,
        0.60,
    ),
    (3, "won", "realestate", "crm", 5_000_000, "villa", "Emirates Hills, Dubai", True, 0.90),
    (4, "contacted", "tourisme", "portal_voice", 45_000, "tour", "Abu Dhabi", False, 0.40),
    (5, "new", "assurance", "crm", 18_000, None, "Dubai Marina", False, 0.00),
    (
        6,
        "negotiation",
        "banques",
        "portal_text",
        1_200_000,
        None,
        "Business Bay, Dubai",
        False,
        0.70,
    ),
]


async def upsert_demo_leads(session, company_id: uuid.UUID, client_id: uuid.UUID) -> None:
    """Crée les leads CRM de démo (idempotent par UUID figé)."""
    for (
        seq,
        status,
        category,
        source,
        budget,
        property_type,
        location,
        gv_eligible,
        response_rate,
    ) in DEMO_LEADS:
        lead_id = uuid.UUID(f"22222222-2222-2222-2222-{seq:012d}")
        existing = (
            await session.execute(select(CRMLead).where(CRMLead.id == lead_id))
        ).scalar_one_or_none()
        if existing:
            print(f"  lead CRM {existing.reference} déjà présent (id={existing.id})")
            continue
        score = calculate_score(
            budget=Decimal(budget) if budget is not None else None,
            golden_visa_eligible=gv_eligible,
            property_type=property_type,
            response_rate=response_rate,
            last_contact_at=None,
        )
        # Référence allouée dynamiquement (même logique que create_lead) pour
        # ne pas entrer en collision avec les leads déjà présents du tenant.
        reference = await _next_reference(session, company_id)
        lead = CRMLead(
            id=lead_id,
            company_id=company_id,
            reference=reference,
            client_id=client_id,
            status=status,
            category=category,
            source=source,
            budget=Decimal(budget) if budget is not None else None,
            property_type=property_type,
            preferred_location=location,
            golden_visa_eligible=gv_eligible,
            score=score,
            response_rate=Decimal(str(response_rate)),
            contact_attempts=0,
            won_amount=Decimal(budget) if (status == "won" and budget) else None,
        )
        session.add(lead)
        await session.flush()
        print(f"  lead CRM {lead.reference} créé ({category}/{status}, id={lead.id})")


async def upsert_user(
    session,
    *,
    email: str,
    password: str,
    full_name: str,
    role: UserRole,
    company_id: uuid.UUID,
    language: str = "en",
) -> User:
    """Upsert idempotent d'un compte connectable (clé = email)."""
    existing = (await session.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if existing:
        print(f"  user '{email}' déjà présent (id={existing.id}, role={existing.role})")
        return existing
    user = User(
        id=uuid.uuid4(),
        company_id=company_id,
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        role=role.value,
        status=UserStatus.ACTIVE.value,
        is_active=True,
        preferred_language=language,
    )
    session.add(user)
    await session.flush()
    print(f"  user '{email}' créé (id={user.id}, role={role.value}, mdp='{password}')")
    return user


async def main() -> None:
    print("→ Seed SGI")
    async with async_session_maker() as session:
        company = await upsert_company(session)
        await upsert_demo_client(session, company.id)
        # Leads CRM de démo (multi-secteurs, avec référence métier).
        await upsert_demo_leads(session, company.id, DEMO_CLIENT_ID)
        # Compte admin back-office (apps/web)
        admin = await upsert_user(
            session,
            email=DEMO_ADMIN_EMAIL,
            password=DEMO_ADMIN_PASSWORD,
            full_name="Hicham Sadiki",
            role=UserRole.ADMIN,
            company_id=company.id,
            language="fr",
        )
        # Compte client portail (apps/portal) — actif, donc connectable immédiatement.
        # Lié à la fiche CRM Ahmed Al Demo par email.
        await upsert_user(
            session,
            email=DEMO_CLIENT_EMAIL,
            password=DEMO_PORTAL_CLIENT_PASSWORD,
            full_name="Ahmed Al Demo",
            role=UserRole.CLIENT,
            company_id=company.id,
            language="en",
        )
        # Compte fournisseur portail (apps/portal, profil « Fournisseur », rôle PARTNER).
        await upsert_user(
            session,
            email=DEMO_FOURNISSEUR_EMAIL,
            password=DEMO_FOURNISSEUR_PASSWORD,
            full_name="Demo Fournisseur",
            role=UserRole.PARTNER,
            company_id=company.id,
            language="en",
        )
        # Données démo de la rubrique Immobilier (Real Estate).
        await seed_realestate(session, company.id, admin.id)
        await session.commit()
    print("✓ Seed terminé.")
    print(
        f"  → Back-office : {DEMO_ADMIN_EMAIL} / {DEMO_ADMIN_PASSWORD}\n"
        f"  → Portail client : {DEMO_CLIENT_EMAIL} / {DEMO_PORTAL_CLIENT_PASSWORD}\n"
        f"  → Portail fournisseur : {DEMO_FOURNISSEUR_EMAIL} / {DEMO_FOURNISSEUR_PASSWORD} (slug infinity-uae)"
    )


if __name__ == "__main__":
    asyncio.run(main())
