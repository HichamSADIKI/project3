from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.core.config import settings
from app.core.database import create_db_pool
from app.middleware.tenant import TenantMiddleware
from app.middleware.audit import AuditMiddleware
from app.routers import auth, properties, crm, contracts, golden_visa, rentals, finance, reporting


@asynccontextmanager
async def lifespan(app: FastAPI):
    await create_db_pool()
    yield


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
app.include_router(auth.router, prefix="/api/v1")
app.include_router(properties.router, prefix="/api/v1")
app.include_router(crm.router, prefix="/api/v1")
app.include_router(contracts.router, prefix="/api/v1")
app.include_router(golden_visa.router, prefix="/api/v1")
app.include_router(rentals.router, prefix="/api/v1")
app.include_router(finance.router, prefix="/api/v1")
app.include_router(reporting.router, prefix="/api/v1")


@app.get("/health", tags=["System"])
async def health():
    return {"status": "ok", "version": "0.1.0"}
