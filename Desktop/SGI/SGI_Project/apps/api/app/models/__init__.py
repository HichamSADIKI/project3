"""
SGI — Modèles SQLAlchemy 2 async.
Tous les modèles sont importés ici pour qu'Alembic les détecte
lors de la génération des migrations (autogenerate).
"""

from app.models.base import Base
from app.models.user import User
from app.models.company import Company
from app.models.client import Client
from app.models.property import Property
from app.models.crm import CRMLead, CRMActivity
from app.models.contract import Contract
from app.models.rental import Rental
from app.models.golden_visa import GoldenVisaApplication
from app.models.finance import FinanceTransaction
from app.models.audit_log import AuditLog

__all__ = [
    "Base",
    "User",
    "Company",
    "Client",
    "Property",
    "CRMLead",
    "CRMActivity",
    "Contract",
    "Rental",
    "GoldenVisaApplication",
    "FinanceTransaction",
    "AuditLog",
]
