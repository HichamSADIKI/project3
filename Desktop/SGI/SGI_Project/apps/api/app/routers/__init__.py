from app.routers.auth import router as auth
from app.routers.buildings import router as buildings
from app.routers.client_portal import router as client_portal
from app.routers.clients import router as clients
from app.routers.contracts import router as contracts
from app.routers.crm import router as crm
from app.routers.finance import router as finance
from app.routers.golden_visa import router as golden_visa
from app.routers.owners import router as owners
from app.routers.partner import router as partner
from app.routers.pdc import router as pdc
from app.routers.properties import router as properties
from app.routers.rentals import router as rentals
from app.routers.reporting import router as reporting
from app.routers.scraping import router as scraping
from app.routers.technicians import router as technicians
from app.routers.tenants import router as tenants
from app.routers.units import router as units
from app.routers.vendors import router as vendors

__all__ = [
    "auth",
    "clients",
    "properties",
    "crm",
    "contracts",
    "golden_visa",
    "rentals",
    "finance",
    "reporting",
    "scraping",
    "owners",
    "tenants",
    "vendors",
    "technicians",
    "buildings",
    "units",
    "pdc",
    "client_portal",
    "partner",
]
