"""IdentityAssurance — état de vérification + niveau d'assurance d'une identité.

Socle « UAE Infinity PASS » (Brique 2). Persiste, par identité (un User interne
ou un Client/party externe), ce qui est vérifié (e‑mail, mobile, Emirates ID,
contrôle renforcé) et le **niveau d'assurance** calculé (L0–L3, cf.
``app.core.assurance``). Loi 1 : ``company_id`` + RLS. Unicité par
``(company_id, subject_type, subject_id)``.
"""

import uuid

from sqlalchemy import Boolean, Index, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TenantMixin, TimestampMixin


class IdentityAssurance(Base, TimestampMixin, TenantMixin):
    """Niveau d'assurance d'une identité (Infinity ID). Loi 1 (RLS)."""

    __tablename__ = "identity_assurance"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Type d'identité : "user" (compte interne) | "client" (partie externe / portail).
    subject_type: Mapped[str] = mapped_column(String(20), nullable=False)
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mobile_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    emirates_id_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    strong_auth_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Niveau calculé (cache) : L0 | L1 | L2 | L3.
    level: Mapped[str] = mapped_column(String(2), nullable=False, default="L0")

    __table_args__ = (
        UniqueConstraint(
            "company_id", "subject_type", "subject_id", name="uq_identity_assurance_subject"
        ),
        Index("idx_identity_assurance_company", "company_id"),
    )
