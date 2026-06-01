from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.database import create_db_pool
from app.middleware.audit import AuditMiddleware
from app.middleware.tenant import TenantMiddleware
from app.routers import (
    ai_services,
    auth,
    buildings,
    client_portal,
    clients,
    comms,
    contracts,
    crm,
    documents,
    finance,
    golden_visa,
    inspections,
    maintenance,
    notifications,
    owner_portal,
    owner_statements,
    owners,
    partner,
    payments,
    pdc,
    properties,
    realestate_core,
    rentals,
    reporting,
    scraping,
    technicians,
    telephony,
    tenants,
    units,
    vendors,
    workflows,
)
from app.routers.scraping.service import start_browser, stop_browser
from app.routers.telephony.ami import start_ami_listener, stop_ami_listener


@asynccontextmanager
async def lifespan(app: FastAPI):
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
    {"name": "rentals", "description": "Locations."},
    {"name": "pdc", "description": "Chèques post-datés (UAE)."},
    {"name": "payments", "description": "Demandes de paiement & transactions."},
    {"name": "finance", "description": "Finance & comptabilité."},
    {"name": "maintenance", "description": "Tickets, devis, plans préventifs."},
    {"name": "inspections", "description": "États des lieux (check-in/out)."},
    {"name": "workflows", "description": "Moteur de workflows générique."},
    {"name": "communication", "description": "Conversations + WebSocket."},
    {"name": "telephony", "description": "Centre de contact (Asterisk WebRTC) : appels, agents, screen pop."},
    {"name": "client_portal", "description": "Portail client (self-service)."},
    {"name": "owner_portal", "description": "Portail propriétaire (payouts, relevés)."},
    {"name": "ai_services", "description": "Services IA (Gemini)."},
    {"name": "reporting", "description": "Rapports & exports."},
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
app.include_router(rentals, prefix="/api/v1")
app.include_router(finance, prefix="/api/v1")
app.include_router(reporting, prefix="/api/v1")
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
# ERP — IA avancée (contrats + prédiction maintenance, sans table)
app.include_router(ai_services.router, prefix="/api/v1")
# Immobilier Core — succursales (multi-branch) + paramètres UAE (migration 0020)
app.include_router(realestate_core.router, prefix="/api/v1")
# Documents & Signature — versioning + e-signature UAE (migration 0021)
app.include_router(documents.router, prefix="/api/v1")
# Propriétaires — relevés mensuels + notifications in-app (migration 0025)
app.include_router(owner_statements.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
# Téléphonie — centre de contact Asterisk WebRTC (migration 0028)
app.include_router(telephony.router, prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "version": "0.1.0"}
