"""Service — Documents & Signature.

Helpers métier purs (sans DB, testés isolément) en tête de fichier ; fonctions
CRUD async filtrées par `company_id` (Loi 1) ensuite.
"""
import hashlib
import uuid
from datetime import UTC, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.document_signature import DocumentSignature
from app.models.document_version import DocumentVersion
from app.routers.documents.schemas import (
    DocumentCreate,
    DocumentUpdate,
    SignatureRequest,
)

# ─── Constantes métier ─────────────────────────────────────────────────────

DOC_TYPES: frozenset[str] = frozenset(
    {
        "contract", "mandate", "id", "passport", "ejari", "dld",
        "insurance", "invoice", "statement", "other",
    }
)
DOCUMENT_STATUSES: frozenset[str] = frozenset({"draft", "active", "signed", "archived"})
SIGNER_ROLES: frozenset[str] = frozenset(
    {"owner", "tenant", "agent", "witness", "other"}
)
SIGNATURE_METHODS: frozenset[str] = frozenset(
    {"otp", "typed", "drawn", "click_to_sign"}
)

# Transitions valides d'une signature (toutes terminales depuis pending).
_SIGNATURE_TRANSITIONS: dict[str, set[str]] = {
    "pending": {"signed", "declined", "expired"},
    "signed": set(),
    "declined": set(),
    "expired": set(),
}

_DOC_EXT_BY_MIME = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}


# ─── Helpers métier purs ──────────────────────────────────────────────────


def compute_sha256(data: bytes) -> str:
    """Empreinte SHA-256 hexadécimale du contenu d'un fichier."""
    return hashlib.sha256(data).hexdigest()


def next_version_number(existing: list[int]) -> int:
    """Prochain numéro de version : max connu + 1 (commence à 1)."""
    return (max(existing) if existing else 0) + 1


def extension_for_doc_mime(content_type: str) -> str | None:
    """Extension de fichier pour un MIME documentaire, ou None si non supporté."""
    return _DOC_EXT_BY_MIME.get((content_type or "").split(";")[0].strip().lower())


def is_supported_mime(content_type: str) -> bool:
    """True si le type MIME est accepté pour un document."""
    return extension_for_doc_mime(content_type) is not None


def is_valid_doc_type(value: str) -> bool:
    return value in DOC_TYPES


def is_valid_document_status(value: str) -> bool:
    return value in DOCUMENT_STATUSES


def build_document_key(
    company_id: uuid.UUID, document_id: uuid.UUID, version: int, ext: str
) -> str:
    """Clé objet MinIO déterministe pour une version de document."""
    return f"documents/{company_id}/{document_id}/v{version}.{ext}"


def is_valid_signature_transition(current: str, target: str) -> bool:
    """Vérifie la machine à états d'une signature."""
    return target in _SIGNATURE_TRANSITIONS.get(current, set())


def compute_signature_hash(
    version_sha256: str, signer_identity: str, signed_at_iso: str
) -> str:
    """Preuve de signature = SHA256(empreinte_version | identité | horodatage).

    Lie de façon vérifiable QUI a signé QUOI (cette version précise) et QUAND.
    """
    payload = f"{version_sha256}|{signer_identity}|{signed_at_iso}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def all_signatures_complete(statuses: list[str]) -> bool:
    """True si au moins une signature existe et que toutes sont 'signed'."""
    return bool(statuses) and all(s == "signed" for s in statuses)


# ─── Documents CRUD ────────────────────────────────────────────────────────


async def list_documents(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    entity_type: str | None = None,
    entity_id: uuid.UUID | None = None,
    doc_type: str | None = None,
    status: str | None = None,
) -> tuple[list[Document], int]:
    base = select(Document).where(
        Document.company_id == company_id,
        Document.deleted_at.is_(None),
    )
    if entity_type:
        base = base.where(Document.entity_type == entity_type)
    if entity_id:
        base = base.where(Document.entity_id == entity_id)
    if doc_type:
        base = base.where(Document.doc_type == doc_type)
    if status:
        base = base.where(Document.status == status)

    total: int = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()

    offset = (page - 1) * limit
    paginated = base.order_by(Document.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(paginated)
    return list(result.scalars().all()), total


async def get_document(
    db: AsyncSession, company_id: uuid.UUID, document_id: uuid.UUID
) -> Document | None:
    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.company_id == company_id,
            Document.deleted_at.is_(None),
        )
    )
    return result.scalar_one_or_none()


async def create_document(
    db: AsyncSession, company_id: uuid.UUID, data: DocumentCreate
) -> Document:
    doc = Document(
        company_id=company_id,
        title=data.title,
        doc_type=data.doc_type,
        entity_type=data.entity_type,
        entity_id=data.entity_id,
        description=data.description,
        tags=data.tags,
        status="draft",
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


async def update_document(
    db: AsyncSession,
    company_id: uuid.UUID,
    document_id: uuid.UUID,
    data: DocumentUpdate,
) -> Document | None:
    doc = await get_document(db, company_id, document_id)
    if doc is None:
        return None
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(doc, field, value)
    doc.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(doc)
    return doc


async def delete_document(
    db: AsyncSession, company_id: uuid.UUID, document_id: uuid.UUID
) -> bool:
    doc = await get_document(db, company_id, document_id)
    if doc is None:
        return False
    doc.deleted_at = datetime.now(UTC)
    await db.commit()
    return True


# ─── Versions ──────────────────────────────────────────────────────────────


async def list_versions(
    db: AsyncSession, company_id: uuid.UUID, document_id: uuid.UUID
) -> list[DocumentVersion]:
    result = await db.execute(
        select(DocumentVersion)
        .where(
            DocumentVersion.document_id == document_id,
            DocumentVersion.company_id == company_id,
        )
        .order_by(DocumentVersion.version_number)
    )
    return list(result.scalars().all())


async def get_version(
    db: AsyncSession, company_id: uuid.UUID, version_id: uuid.UUID
) -> DocumentVersion | None:
    result = await db.execute(
        select(DocumentVersion).where(
            DocumentVersion.id == version_id,
            DocumentVersion.company_id == company_id,
        )
    )
    return result.scalar_one_or_none()


async def add_version(
    db: AsyncSession,
    company_id: uuid.UUID,
    document: Document,
    *,
    file_path: str,
    sha256: str,
    original_filename: str | None,
    content_type: str | None,
    size_bytes: int,
    uploaded_by_user_id: uuid.UUID | None,
    notes: str | None = None,
) -> DocumentVersion:
    existing = [v.version_number for v in await list_versions(db, company_id, document.id)]
    version = DocumentVersion(
        company_id=company_id,
        document_id=document.id,
        version_number=next_version_number(existing),
        file_path=file_path,
        sha256=sha256,
        original_filename=original_filename,
        content_type=content_type,
        size_bytes=size_bytes,
        uploaded_by_user_id=uploaded_by_user_id,
        notes=notes,
    )
    db.add(version)
    await db.flush()
    # La nouvelle version devient la version courante ; doc passe 'active'.
    document.current_version_id = version.id
    if document.status == "draft":
        document.status = "active"
    document.updated_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(version)
    return version


# ─── Signatures ────────────────────────────────────────────────────────────


async def list_signatures(
    db: AsyncSession, company_id: uuid.UUID, document_id: uuid.UUID
) -> list[DocumentSignature]:
    result = await db.execute(
        select(DocumentSignature)
        .where(
            DocumentSignature.document_id == document_id,
            DocumentSignature.company_id == company_id,
        )
        .order_by(DocumentSignature.order_index, DocumentSignature.created_at)
    )
    return list(result.scalars().all())


async def get_signature(
    db: AsyncSession, company_id: uuid.UUID, signature_id: uuid.UUID
) -> DocumentSignature | None:
    result = await db.execute(
        select(DocumentSignature).where(
            DocumentSignature.id == signature_id,
            DocumentSignature.company_id == company_id,
        )
    )
    return result.scalar_one_or_none()


async def request_signature(
    db: AsyncSession,
    company_id: uuid.UUID,
    document: Document,
    version_id: uuid.UUID,
    data: SignatureRequest,
) -> DocumentSignature:
    sig = DocumentSignature(
        company_id=company_id,
        document_id=document.id,
        document_version_id=version_id,
        signer_party_id=data.signer_party_id,
        signer_user_id=data.signer_user_id,
        signer_name=data.signer_name,
        signer_email=data.signer_email,
        signer_role=data.signer_role,
        order_index=data.order_index,
        status="pending",
    )
    db.add(sig)
    await db.commit()
    await db.refresh(sig)
    return sig


async def _refresh_document_signed_state(
    db: AsyncSession, company_id: uuid.UUID, document: Document
) -> None:
    """Passe le document en 'signed' quand toutes ses signatures sont signées."""
    sigs = await list_signatures(db, company_id, document.id)
    if all_signatures_complete([s.status for s in sigs]):
        document.status = "signed"
        document.updated_at = datetime.now(UTC)
        await db.commit()


async def sign_signature(
    db: AsyncSession,
    company_id: uuid.UUID,
    signature: DocumentSignature,
    version_sha256: str,
    *,
    method: str,
    otp_verified: bool,
    ip_address: str | None,
    user_agent: str | None,
) -> DocumentSignature:
    signed_at = datetime.now(UTC)
    identity = signature.signer_email or signature.signer_name or str(signature.id)
    signature.status = "signed"
    signature.method = method
    signature.otp_verified = otp_verified
    signature.signed_at = signed_at
    signature.ip_address = ip_address
    signature.user_agent = user_agent
    signature.signature_hash = compute_signature_hash(
        version_sha256, identity, signed_at.isoformat()
    )
    await db.commit()
    await db.refresh(signature)

    document = await get_document(db, company_id, signature.document_id)
    if document is not None:
        await _refresh_document_signed_state(db, company_id, document)
    return signature


async def decline_signature(
    db: AsyncSession, signature: DocumentSignature
) -> DocumentSignature:
    signature.status = "declined"
    signature.declined_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(signature)
    return signature
