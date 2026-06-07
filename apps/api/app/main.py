import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.config import settings
from app.core.database import create_db_pool
from app.middleware.audit import AuditMiddleware
from app.middleware.tenant import TenantMiddleware
from app.routers import (
    accounting,
    acquisitions,
    admin,
    agenda,
    ai_services,
    auth,
    bank,
    buildings,
    client_portal,
    clients,
    comms,
    contracts,
    copilot,
    crm,
    developers,
    documents,
    finance,
    golden_visa,
    honeytokens,
    iam,
    inbox,
    inspections,
    leasing,
    maintenance,
    marketing,
    notifications,
    owner_portal,
    owner_statements,
    owners,
    partner,
    payments,
    pdc,
    properties,
    public_site,
    realestate_core,
    rentals,
    reporting,
    sales,
    scenarios,
    scraping,
    search,
    self_defense,
    social,
    sources,
    technicians,
    telephony,
    tenant_portal,
    tenants,
    ticketing,
    units,
    vendors,
    workflows,
)
from app.routers.scraping.service import start_browser, stop_browser
from app.routers.telephony.ami import start_ami_listener, stop_ami_listener

logger = logging.getLogger("app.startup")


def _enforce_rls_or_fail() -> None:
    """Garde-fou multi-tenant (Loi 1) au démarrage.

    Si l'API tourne avec le rôle privilégié (APP_DB_PASSWORD absent), la RLS est
    inerte. C'était jusqu'ici un fail-open **silencieux**. Désormais :
    - prod (`DEBUG=false`)  → on **refuse de démarrer** (fail-closed) ;
    - dev  (`DEBUG=true`)   → simple WARNING (pratique en local) ;
    - tests (pytest chargé) → on n'interrompt pas la suite (la CI tourne sans
      rôle restreint et `test_rls_isolation` se skip déjà dans ce cas).
    """
    if settings.RLS_ENFORCED:
        return
    if "pytest" in sys.modules:
        return
    message = (
        "APP_DB_PASSWORD absent : l'API utilise le rôle privilégié et la RLS "
        "multi-tenant est INERTE (isolation déléguée au seul filtrage applicatif). "
        "Définissez APP_DB_PASSWORD (rôle sgi_app) en production."
    )
    if settings.DEBUG:
        logger.warning("RLS non appliquée — %s", message)
        return
    raise RuntimeError(message)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _enforce_rls_or_fail()
    await create_db_pool()
    await start_browser()
    # Pont AMI → WebSocket (gardé : si Asterisk est down, l'API reste up).
    start_ami_listener()
    yield
    await stop_ami_listener()
    await stop_browser()


# Ordre des catégories dans la doc OpenAPI/Swagger.
# Les tags listés ici apparaissent dans cet ordre ; ceux absents suivent dans
# l'ordre de montage des routers. La catégorie Fournisseur (fournisseur +
# vendors) est volontairement placée AVANT Clients — miroir du menu back-office.
TAGS_METADATA = [
    {"name": "System", "description": "Santé & supervision."},
    {"name": "auth", "description": "Authentification, MFA, sessions."},
    {
        "name": "fournisseur",
        "description": "Espace fournisseur (self-service prestataires : KYC, missions).",
    },
    {"name": "vendors", "description": "Fiches fournisseurs / prestataires (party-role)."},
    {"name": "clients", "description": "Parties (particuliers / sociétés) — table umbrella."},
    {"name": "owners", "description": "Propriétaires (mandats, IBAN, payouts)."},
    {"name": "tenants", "description": "Locataires / candidats (cycle de vie, loyauté)."},
    {"name": "technicians", "description": "Techniciens internes (salariés)."},
    {"name": "properties", "description": "Catalogue legacy (PostGIS)."},
    {"name": "buildings", "description": "Bâtiments (PostGIS, DLD)."},
    {"name": "units", "description": "Unités louables / vendables."},
    {"name": "crm", "description": "Leads, scoring, pipeline, relances."},
    {"name": "contracts", "description": "Contrats."},
    {"name": "golden_visa", "description": "Golden Visa UAE."},
    {"name": "agenda", "description": "Agenda (RDV, visites, tâches, appels)."},
    {"name": "rentals", "description": "Locations."},
    {"name": "pdc", "description": "Chèques post-datés (UAE)."},
    {"name": "payments", "description": "Demandes de paiement & transactions."},
    {"name": "finance", "description": "Finance & comptabilité."},
    {"name": "accounting", "description": "Plan comptable + grand-livre (double entrée)."},
    {"name": "bank", "description": "Rapprochement bancaire (comptes, relevés, matching)."},
    {"name": "admin", "description": "Console admin : users/permissions, audit, supervision."},
    {
        "name": "admin-platform",
        "description": "Infra-admin PLATEFORME (cross-tenant) : serveurs, réseau, backups.",
    },
    {"name": "maintenance", "description": "Tickets, devis, plans préventifs."},
    {"name": "inspections", "description": "États des lieux (check-in/out)."},
    {"name": "workflows", "description": "Moteur de workflows générique."},
    {"name": "communication", "description": "Conversations + WebSocket."},
    {"name": "telephony", "description": "Centre de contact Asterisk WebRTC : appels, agents."},
    {"name": "inbox", "description": "Inbox omnicanal (WhatsApp/email/webchat)."},
    {"name": "ticketing", "description": "Service desk : tickets, SLA, escalade."},
    {"name": "copilot", "description": "AI Copilot : assistance agent (inbox + tickets)."},
    {"name": "client_portal", "description": "Portail client (self-service)."},
    {"name": "owner_portal", "description": "Portail propriétaire (payouts, relevés)."},
    {"name": "tenant_portal", "description": "Portail locataire (paiement, tickets, chat)."},
    {"name": "ai_services", "description": "Services IA (Gemini)."},
    {"name": "reporting", "description": "Rapports & exports."},
    {"name": "search", "description": "Recherche globale (biens, clients, contrats)."},
    {"name": "scraping", "description": "Scraping (Playwright)."},
]

app = FastAPI(
    title="SGI API",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    openapi_tags=TAGS_METADATA,
    lifespan=lifespan,
)

# Middlewares (ordre important : dernier ajouté = premier exécuté)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(AuditMiddleware)
app.add_middleware(TenantMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
)

# Routers
app.include_router(auth, prefix="/api/v1")
# Fournisseurs (prestataires) — catégorie placée AVANT clients : gestion des
# fiches fournisseurs (réutilise le module vendors / party-role fournisseur).
app.include_router(vendors, prefix="/api/v1")
app.include_router(clients, prefix="/api/v1")
app.include_router(properties, prefix="/api/v1")
app.include_router(crm, prefix="/api/v1")
app.include_router(contracts, prefix="/api/v1")
app.include_router(golden_visa, prefix="/api/v1")
app.include_router(agenda, prefix="/api/v1")
app.include_router(rentals, prefix="/api/v1")
app.include_router(finance, prefix="/api/v1")
app.include_router(accounting, prefix="/api/v1")
app.include_router(bank, prefix="/api/v1")
app.include_router(admin, prefix="/api/v1")
app.include_router(reporting, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(scraping, prefix="/api/v1")

# RealEstate — profils de rôles (party-roles, voir migration 0002)
# NB : vendors (fournisseurs) est monté plus haut, avant clients.
app.include_router(owners, prefix="/api/v1")
app.include_router(tenants, prefix="/api/v1")
app.include_router(technicians, prefix="/api/v1")

# RealEstate — hiérarchie physique + PDC UAE (voir migration 0003)
app.include_router(buildings, prefix="/api/v1")
app.include_router(units, prefix="/api/v1")
app.include_router(pdc, prefix="/api/v1")

# Phase 1 — Espaces Client + Partenaire (voir migration 0005)
app.include_router(client_portal, prefix="/api/v1")
app.include_router(partner, prefix="/api/v1")
# ERP — Maintenance (migration 0013-0014)
app.include_router(maintenance.router, prefix="/api/v1")
# ERP — Communication REST (migration 0015)
app.include_router(comms.router, prefix="/api/v1")
# ERP — Workflow Engine (migration 0016)
app.include_router(workflows.router, prefix="/api/v1")
# ERP — Inspections + Check-in/out (migration 0018)
app.include_router(inspections.router, prefix="/api/v1")
# ERP — Paiements + Portail Owner (migration 0019)
app.include_router(payments.router, prefix="/api/v1")
app.include_router(owner_portal.router, prefix="/api/v1")
app.include_router(tenant_portal.router, prefix="/api/v1")
# ERP — IA avancée (contrats + prédiction maintenance, sans table)
app.include_router(ai_services.router, prefix="/api/v1")
# Immobilier Core — succursales (multi-branch) + paramètres UAE (migration 0020)
app.include_router(realestate_core.router, prefix="/api/v1")
# Documents & Signature — versioning + e-signature UAE (migration 0021)
app.include_router(documents.router, prefix="/api/v1")
# Developers — annuaire des promoteurs immobiliers (migration 0037)
app.include_router(developers.router, prefix="/api/v1")
# Propriétaires — relevés mensuels + notifications in-app (migration 0025)
app.include_router(owner_statements.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
# Téléphonie — centre de contact Asterisk WebRTC (migration 0028)
app.include_router(telephony.router, prefix="/api/v1")
# Omnichannel Inbox — fils externes (WhatsApp/email/webchat) (migration 0031)
app.include_router(inbox.router, prefix="/api/v1")
# Ticketing SLA — service desk client (migration 0032)
app.include_router(ticketing.router, prefix="/api/v1")
# AI Copilot — assistance agent (inbox + tickets), sans persistance
app.include_router(copilot.router, prefix="/api/v1")
# Immobilier — Achat : mandats acquéreur + offres + matching PostGIS (migration 0033)
app.include_router(acquisitions.router, prefix="/api/v1")
# Immobilier — Vente : mandat → annonce → offre → transaction + commission (migration 0034)
app.include_router(sales.router, prefix="/api/v1")
# Immobilier — Location : annonces + candidatures locataires (migration 0035)
app.include_router(leasing.router, prefix="/api/v1")
# Immobilier — Marketing : campagnes multi-canal + boucle leads CRM (migration 0038)
app.include_router(marketing.router, prefix="/api/v1")
# Immobilier — Social : publication d'annonces sur les réseaux sociaux (migration 0042)
app.include_router(social.router, prefix="/api/v1")
# Immobilier — Scenarios : générateur de vidéos social media (photos + voix avatar) (migration 0043)
app.include_router(scenarios.router, prefix="/api/v1")
# Immobilier — Sources : ingestion multi-source idempotente → leads (migration 0039)
app.include_router(sources.router, prefix="/api/v1")
# Vitrine immobilière publique (sans auth JWT — site public, mono-agence) (migrations 0040/0041)
app.include_router(public_site.router, prefix="/api/v1")
app.include_router(public_site.admin_router, prefix="/api/v1")
# Honeytokens (déception) : trip public sans JWT + gestion admin (migration 0062)
app.include_router(honeytokens.router, prefix="/api/v1")
app.include_router(honeytokens.admin_router, prefix="/api/v1")
# Self-defense : trace des événements du panneau UX (radar/avion/dôme) → audit_logs
app.include_router(self_defense.router, prefix="/api/v1")
app.include_router(self_defense.admin_router, prefix="/api/v1")
app.include_router(iam.router, prefix="/api/v1")
# Webhook WhatsApp Cloud API inbound (sans auth JWT — appelé par Meta)
app.include_router(inbox.inbox_webhook_router, prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "version": "0.1.0"}


# ── Observabilité — métriques Prometheus (`GET /metrics`) ──────────────────
# Expose compteurs/latences/in-progress par (méthode · handler · status). Labels
# par TEMPLATE de route (pas de path param ni de company_id → ni explosion de
# cardinalité ni fuite Loi 1). Endpoint non authentifié (Prometheus scrape sans
# JWT ; restreindre l'accès au niveau réseau/nginx). Le déploiement du serveur
# Prometheus + Grafana (infra/) reste un chantier séparé.
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
