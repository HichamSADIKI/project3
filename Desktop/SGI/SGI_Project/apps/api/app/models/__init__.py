"""
SGI — Modèles SQLAlchemy 2 async.
Tous les modèles sont importés ici pour qu'Alembic les détecte
lors de la génération des migrations (autogenerate).
"""

from app.models.accounting import ChartAccount, JournalEntry, JournalLine
from app.models.admin import (
    AlertEvent,
    AlertRule,
    BackupRun,
    InfraAction,
    InfraService,
)
from app.models.agenda import AgendaEvent
from app.models.audit_log import AuditLog
from app.models.bank import BankAccount, BankStatementLine
from app.models.base import Base
from app.models.branch import Branch
from app.models.building import Building
from app.models.client import Client
from app.models.company import Company
from app.models.company_settings import CompanySettings
from app.models.contract import Contract
from app.models.crm import CRMActivity, CRMLead
from app.models.device_token import DeviceToken
from app.models.document import Document
from app.models.document_signature import DocumentSignature
from app.models.document_version import DocumentVersion
from app.models.favorite import Favorite
from app.models.finance import FinanceTransaction
from app.models.floor import Floor
from app.models.golden_visa import GoldenVisaApplication
from app.models.message import Message
from app.models.notification import Notification
from app.models.owner_statement import OwnerStatement
from app.models.partner_commission import PartnerCommissionEntry
from app.models.partner_lead import PartnerLead
from app.models.partner_service import PartnerService
from app.models.party_owner import Owner
from app.models.party_technician import Technician
from app.models.party_tenant import TenantProfile
from app.models.party_vendor import Vendor
from app.models.pdc_cheque import PdcCheque
from app.models.property import Property
from app.models.property_submission import PropertySubmission
from app.models.refresh_token import RefreshToken
from app.models.rental import Rental
from app.models.unit import Unit
from app.models.user import User
from app.models.visit_request import VisitRequest

__all__ = [
    "Base",
    "AgendaEvent",
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
    "Owner",
    "TenantProfile",
    "Vendor",
    "Technician",
    "Building",
    "Floor",
    "Unit",
    "PdcCheque",
    "Favorite",
    "VisitRequest",
    "Message",
    "PropertySubmission",
    "PartnerLead",
    "PartnerCommissionEntry",
    "PartnerService",
    "Branch",
    "CompanySettings",
    "Document",
    "DocumentVersion",
    "DocumentSignature",
    "OwnerStatement",
    "Notification",
    "RefreshToken",
    "BankAccount",
    "BankStatementLine",
    "ChartAccount",
    "JournalEntry",
    "JournalLine",
    "AlertRule",
    "AlertEvent",
    "InfraService",
    "InfraAction",
    "BackupRun",
    "DeviceToken",
]
