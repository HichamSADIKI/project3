from app.routers.auth import router as auth
from app.routers.properties import router as properties
from app.routers.crm import router as crm
from app.routers.contracts import router as contracts
from app.routers.golden_visa import router as golden_visa
from app.routers.rentals import router as rentals
from app.routers.finance import router as finance
from app.routers.reporting import router as reporting
from app.routers.scraping import router as scraping

__all__ = ["auth", "properties", "crm", "contracts", "golden_visa", "rentals", "finance", "reporting", "scraping"]
