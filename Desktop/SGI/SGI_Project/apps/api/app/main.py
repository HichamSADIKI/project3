from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.database import create_db_pool
from app.middleware.tenant import TenantMiddleware
from app.middleware.audit import AuditMiddleware
from app.routers import auth, clients, properties, crm, contracts, golden_visa, rentals, finance, reporting, scraping
from app.routers import owners, tenants, vendors, technicians
from app.routers import buildings, units, pdc
from app.routers import client_portal, partner
from app.routers import maintenance
from app.routers import comms
from app.routers import workflows
from app.routers import inspections
from app.routers import payments
from app.routers import owner_portal
from app.routers import ai_services
from app.routers.scraping.service import start_browser, stop_browser


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_pool()
    await start_browser()
    yield
    await stop_browser()


app = FastAPI(
    title="SGI API",
    version="0.1.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
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


@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "version": "0.1.0"}
