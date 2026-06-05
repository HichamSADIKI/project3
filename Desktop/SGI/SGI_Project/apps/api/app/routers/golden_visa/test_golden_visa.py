"""Tests Golden Visa — CRUD, isolation tenant, alertes d'expiration.

Le service lit le `company_id` via le GUC `app.current_company_id` (posé en prod
par TenantMiddleware sur une connexion épinglée). Dans le harness de test
(NullPool), chaque `commit()` libère la connexion ; on (re)pose donc le GUC en
`is_local` SANS commit, juste avant chaque appel de service, dans la même
transaction que sa lecture.

⚠️ Tests d'intégration : requièrent PostgreSQL via `DATABASE_URL`.
Lancer avec : `docker compose exec api uv run pytest app/routers/golden_visa/test_golden_visa.py`.
"""

from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy import text

from app.models.client import Client
from app.models.company import Company
from app.routers.golden_visa.schemas import GoldenVisaCreate, GoldenVisaUpdate
from app.routers.golden_visa.service import (
    VALID_STATUSES,
    create_application,
    delete_application,
    get_application,
    get_expiring_visas,
    list_applications,
    update_application,
    visa_alert_level,
)


async def _set_tenant(db, company_id: uuid.UUID) -> None:
    """Pose le GUC tenant SANS commit (is_local) → lu par le service dans la
    même transaction. Doit être appelé juste avant chaque appel de service."""
    await db.execute(
        text("SELECT set_config('app.current_company_id', :cid, true)"),
        {"cid": str(company_id)},
    )


async def _seed_client(db, company: Company) -> uuid.UUID:
    client = Client(
        id=uuid.uuid4(),
        company_id=company.id,
        type="individual",
        first_name="Investisseur",
        last_name="Test",
    )
    db.add(client)
    await db.commit()
    return client.id


async def _other_company(db) -> Company:
    c = Company(
        id=uuid.uuid4(),
        name="Autre",
        slug=f"co-{uuid.uuid4().hex[:8]}",
        plan="pro",
        is_active=True,
    )
    db.add(c)
    await db.commit()
    return c


# ── Constante de statuts (pur) ───────────────────────────────────────────────


def test_valid_statuses_contain_lifecycle() -> None:
    assert {"pending", "approved", "rejected", "expired"} <= VALID_STATUSES


# ── visa_alert_level (pur) ────────────────────────────────────────────────────


class TestVisaAlertLevel:
    _TODAY = date(2026, 6, 1)

    def test_none_when_no_expiry(self) -> None:
        assert visa_alert_level(self._TODAY, None, False, False) is None

    def test_none_when_already_expired(self) -> None:
        past = self._TODAY - timedelta(days=1)
        assert visa_alert_level(self._TODAY, past, False, False) is None

    def test_none_when_beyond_90_days(self) -> None:
        far = self._TODAY + timedelta(days=120)
        assert visa_alert_level(self._TODAY, far, False, False) is None

    def test_level_90_in_window(self) -> None:
        exp = self._TODAY + timedelta(days=60)
        assert visa_alert_level(self._TODAY, exp, False, False) == "90"

    def test_level_30_takes_precedence(self) -> None:
        exp = self._TODAY + timedelta(days=20)
        # Dans la fenêtre 30 ET 90, mais le seuil proche prime.
        assert visa_alert_level(self._TODAY, exp, False, False) == "30"

    def test_level_90_skipped_when_already_sent(self) -> None:
        exp = self._TODAY + timedelta(days=60)
        assert visa_alert_level(self._TODAY, exp, True, False) is None

    def test_level_30_skipped_when_already_sent(self) -> None:
        exp = self._TODAY + timedelta(days=20)
        # J-30 déjà envoyé → plus rien (J-90 est dépassé conceptuellement).
        assert visa_alert_level(self._TODAY, exp, True, True) is None

    def test_boundary_exactly_30(self) -> None:
        exp = self._TODAY + timedelta(days=30)
        assert visa_alert_level(self._TODAY, exp, False, False) == "30"

    def test_boundary_exactly_90(self) -> None:
        exp = self._TODAY + timedelta(days=90)
        assert visa_alert_level(self._TODAY, exp, False, False) == "90"


# ── create / get ─────────────────────────────────────────────────────────────


async def test_create_and_get(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)

    await _set_tenant(db_session, seed_company.id)
    app = await create_application(
        db_session, GoldenVisaCreate(client_id=client_id, status="pending")
    )
    assert app.company_id == seed_company.id
    assert app.client_id == client_id

    await _set_tenant(db_session, seed_company.id)
    fetched = await get_application(db_session, app.id)
    assert fetched is not None and fetched.id == app.id


async def test_get_cross_tenant_returns_none(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)
    other = await _other_company(db_session)

    await _set_tenant(db_session, seed_company.id)
    app = await create_application(db_session, GoldenVisaCreate(client_id=client_id))

    # Bascule de contexte tenant → l'application n'est plus visible.
    await _set_tenant(db_session, other.id)
    assert await get_application(db_session, app.id) is None


# ── list (filtres + meta) ────────────────────────────────────────────────────


async def test_list_filters_by_status(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)

    await _set_tenant(db_session, seed_company.id)
    await create_application(db_session, GoldenVisaCreate(client_id=client_id, status="pending"))
    await _set_tenant(db_session, seed_company.id)
    await create_application(db_session, GoldenVisaCreate(client_id=client_id, status="approved"))

    await _set_tenant(db_session, seed_company.id)
    res_all = await list_applications(db_session)
    assert res_all["meta"]["total"] == 2
    assert res_all["meta"]["page"] == 1

    await _set_tenant(db_session, seed_company.id)
    res_approved = await list_applications(db_session, status="approved")
    assert res_approved["meta"]["total"] == 1
    assert res_approved["data"][0].status == "approved"


async def test_list_filters_by_client(db_session, seed_company: Company) -> None:
    c1 = await _seed_client(db_session, seed_company)
    c2 = await _seed_client(db_session, seed_company)

    await _set_tenant(db_session, seed_company.id)
    await create_application(db_session, GoldenVisaCreate(client_id=c1))
    await _set_tenant(db_session, seed_company.id)
    await create_application(db_session, GoldenVisaCreate(client_id=c2))

    await _set_tenant(db_session, seed_company.id)
    res = await list_applications(db_session, client_id=c1)
    assert res["meta"]["total"] == 1
    assert res["data"][0].client_id == c1


# ── update / delete ──────────────────────────────────────────────────────────


async def test_update_status(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)
    await _set_tenant(db_session, seed_company.id)
    app = await create_application(db_session, GoldenVisaCreate(client_id=client_id))

    await _set_tenant(db_session, seed_company.id)
    updated = await update_application(db_session, app.id, GoldenVisaUpdate(status="submitted"))
    assert updated is not None and updated.status == "submitted"


async def test_update_unknown_returns_none(db_session, seed_company: Company) -> None:
    await _set_tenant(db_session, seed_company.id)
    assert (
        await update_application(db_session, uuid.uuid4(), GoldenVisaUpdate(status="approved"))
        is None
    )


async def test_delete_is_soft(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)
    await _set_tenant(db_session, seed_company.id)
    app = await create_application(db_session, GoldenVisaCreate(client_id=client_id))

    await _set_tenant(db_session, seed_company.id)
    assert await delete_application(db_session, app.id) is True

    await _set_tenant(db_session, seed_company.id)
    assert await get_application(db_session, app.id) is None  # exclu (deleted_at)


async def test_delete_unknown_returns_false(db_session, seed_company: Company) -> None:
    await _set_tenant(db_session, seed_company.id)
    assert await delete_application(db_session, uuid.uuid4()) is False


# ── alertes d'expiration ─────────────────────────────────────────────────────


async def test_get_expiring_visas(db_session, seed_company: Company) -> None:
    client_id = await _seed_client(db_session, seed_company)
    soon = date.today() + timedelta(days=30)
    far = date.today() + timedelta(days=300)

    await _set_tenant(db_session, seed_company.id)
    near = await create_application(
        db_session,
        GoldenVisaCreate(client_id=client_id, status="approved", visa_expiry_date=soon),
    )
    # Approuvé mais lointain → hors fenêtre 90 j
    await _set_tenant(db_session, seed_company.id)
    await create_application(
        db_session,
        GoldenVisaCreate(client_id=client_id, status="approved", visa_expiry_date=far),
    )
    # Fenêtre proche mais pas approuvé → exclu
    await _set_tenant(db_session, seed_company.id)
    await create_application(
        db_session,
        GoldenVisaCreate(client_id=client_id, status="submitted", visa_expiry_date=soon),
    )

    await _set_tenant(db_session, seed_company.id)
    expiring = await get_expiring_visas(db_session, days=90)
    ids = {a.id for a in expiring}
    assert near.id in ids
    assert all(a.status == "approved" for a in expiring)


# ── Complétude documentaire (pur) ────────────────────────────────────────────


from app.models.golden_visa import GoldenVisaApplication as _GVApp  # noqa: E402
from app.routers.golden_visa.service import (  # noqa: E402
    REQUIRED_DOCUMENTS,
    documents_readiness_pct,
    missing_documents,
    present_documents,
)


class TestDocumentChecklist:
    def test_all_missing(self) -> None:
        app = _GVApp(client_id=uuid.uuid4())
        assert len(missing_documents(app)) == len(REQUIRED_DOCUMENTS)
        assert present_documents(app) == []
        assert documents_readiness_pct(app) == 0

    def test_all_present(self) -> None:
        app = _GVApp(
            client_id=uuid.uuid4(),
            passport_doc="p",
            dld_doc="d",
            gdrfa_doc="g",
            insurance_doc="i",
            biometric_photo="b",
        )
        assert missing_documents(app) == []
        assert documents_readiness_pct(app) == 100

    def test_partial(self) -> None:
        app = _GVApp(client_id=uuid.uuid4(), passport_doc="p", dld_doc="d")
        assert set(missing_documents(app)) == {"gdrfa", "insurance", "biometric_photo"}
        assert set(present_documents(app)) == {"passport", "dld"}
        # 2/5 → 40 %
        assert documents_readiness_pct(app) == 40


# ── Endpoint /documents/checklist (intégration) ──────────────────────────────

from httpx import AsyncClient  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession  # noqa: E402

from app.models.user import User  # noqa: E402


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _seed_app(db, company_id: uuid.UUID, **docs) -> uuid.UUID:
    client = Client(
        id=uuid.uuid4(),
        company_id=company_id,
        type="individual",
        first_name="GV",
        last_name="Client",
    )
    db.add(client)
    app = _GVApp(
        id=uuid.uuid4(), company_id=company_id, client_id=client.id, status="pending", **docs
    )
    db.add(app)
    await db.commit()
    return app.id


async def test_checklist_endpoint_partial(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    app_id = await _seed_app(db_session, admin.company_id, passport_doc="p", dld_doc="d")
    r = await client.get(f"/api/v1/golden-visa/{app_id}/documents/checklist", headers=_auth(token))
    assert r.status_code == 200, r.text
    data = r.json()["data"]
    assert data["readiness_pct"] == 40
    assert data["ready"] is False
    assert set(data["missing"]) == {"gdrfa", "insurance", "biometric_photo"}
    assert len(data["required"]) == 5


async def test_checklist_endpoint_404_unknown(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    r = await client.get(
        f"/api/v1/golden-visa/{uuid.uuid4()}/documents/checklist", headers=_auth(token)
    )
    assert r.status_code == 404


async def test_checklist_endpoint_tenant_isolation(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Le dossier d'un tenant A est invisible (404) avec le token B (Loi 1)."""
    admin, _token_a = seed_admin
    _company_b, token_b = second_admin
    app_id = await _seed_app(db_session, admin.company_id, passport_doc="p")
    r = await client.get(
        f"/api/v1/golden-visa/{app_id}/documents/checklist", headers=_auth(token_b)
    )
    assert r.status_code == 404


# ── Helpers upload de documents (purs) ───────────────────────────────────────

from app.core import storage  # noqa: E402
from app.routers.golden_visa.service import (  # noqa: E402
    DOC_TYPE_TO_ATTR,
    attr_for_doc_type,
    build_gv_doc_key,
    doc_mime_allowed,
)


def test_attr_for_doc_type_maps_all_five() -> None:
    assert attr_for_doc_type("passport") == "passport_doc"
    assert attr_for_doc_type("biometric") == "biometric_photo"
    assert set(DOC_TYPE_TO_ATTR) == {"passport", "dld", "gdrfa", "insurance", "biometric"}
    assert attr_for_doc_type("unknown") is None


class TestDocMimeAllowed:
    def test_pdf_ok_for_passport(self) -> None:
        assert doc_mime_allowed("passport", "application/pdf") is True

    def test_image_ok_for_passport(self) -> None:
        assert doc_mime_allowed("passport", "image/png") is True

    def test_biometric_rejects_pdf(self) -> None:
        assert doc_mime_allowed("biometric", "application/pdf") is False

    def test_biometric_accepts_jpeg(self) -> None:
        assert doc_mime_allowed("biometric", "image/jpeg") is True

    def test_rejects_text(self) -> None:
        assert doc_mime_allowed("passport", "text/plain") is False

    def test_strips_charset_param(self) -> None:
        assert doc_mime_allowed("passport", "application/pdf; charset=binary") is True


def test_build_gv_doc_key_shape() -> None:
    cid = uuid.uuid4()
    aid = uuid.uuid4()
    key = build_gv_doc_key(cid, aid, "passport", "pdf")
    assert key == f"golden_visa/{cid}/{aid}/passport.pdf"


# ── Endpoints upload/download de documents (intégration) ─────────────────────


def _patch_storage(monkeypatch) -> None:
    """Neutralise MinIO : upload renvoie un chemin, presigned une URL signée."""

    async def _fake_upload(key: str, data: bytes, content_type: str) -> str:
        return f"minio://{key}"

    async def _fake_presigned(path: str, expires_seconds: int = 3600) -> str:
        return f"https://signed.example/{path}"

    monkeypatch.setattr(storage, "upload_bytes", _fake_upload)
    monkeypatch.setattr(storage, "presigned_url", _fake_presigned)


async def test_upload_requires_auth(client: AsyncClient) -> None:
    r = await client.post(
        f"/api/v1/golden-visa/{uuid.uuid4()}/documents/passport",
        files={"file": ("p.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code in (401, 403)


async def test_upload_unknown_doc_type_422(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    r = await client.post(
        f"/api/v1/golden-visa/{uuid.uuid4()}/documents/wat",
        headers=_auth(token),
        files={"file": ("p.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "unknown_document_type"


async def test_upload_unsupported_mime_422(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    app_id = await _seed_app(db_session, admin.company_id)
    r = await client.post(
        f"/api/v1/golden-visa/{app_id}/documents/passport",
        headers=_auth(token),
        files={"file": ("p.txt", b"hello", "text/plain")},
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "unsupported_document_type"


async def test_upload_biometric_rejects_pdf_422(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    app_id = await _seed_app(db_session, admin.company_id)
    r = await client.post(
        f"/api/v1/golden-visa/{app_id}/documents/biometric",
        headers=_auth(token),
        files={"file": ("scan.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 422


async def test_upload_empty_file_422(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str], monkeypatch
) -> None:
    admin, token = seed_admin
    app_id = await _seed_app(db_session, admin.company_id)
    _patch_storage(monkeypatch)
    r = await client.post(
        f"/api/v1/golden-visa/{app_id}/documents/passport",
        headers=_auth(token),
        files={"file": ("p.pdf", b"", "application/pdf")},
    )
    assert r.status_code == 422
    assert r.json()["detail"] == "empty_file"


async def test_upload_happy_path_sets_column_and_returns_url(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str], monkeypatch
) -> None:
    admin, token = seed_admin
    app_id = await _seed_app(db_session, admin.company_id)
    _patch_storage(monkeypatch)
    r = await client.post(
        f"/api/v1/golden-visa/{app_id}/documents/passport",
        headers=_auth(token),
        files={"file": ("passport.pdf", b"%PDF-1.4 real", "application/pdf")},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["url"].startswith("https://signed.example/")
    assert body["data"]["passport_doc"]
    # La checklist reflète le document désormais présent.
    c = await client.get(f"/api/v1/golden-visa/{app_id}/documents/checklist", headers=_auth(token))
    assert "passport" in c.json()["data"]["present"]


async def test_upload_cross_tenant_404(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
    monkeypatch,
) -> None:
    """Loi 1 : impossible d'uploader sur le dossier d'un autre tenant (404)."""
    admin, _token_a = seed_admin
    _company_b, token_b = second_admin
    app_id = await _seed_app(db_session, admin.company_id)
    _patch_storage(monkeypatch)
    r = await client.post(
        f"/api/v1/golden-visa/{app_id}/documents/passport",
        headers=_auth(token_b),
        files={"file": ("p.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert r.status_code == 404


async def test_download_missing_doc_404(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str]
) -> None:
    admin, token = seed_admin
    app_id = await _seed_app(db_session, admin.company_id)  # aucun doc
    r = await client.get(
        f"/api/v1/golden-visa/{app_id}/documents/passport/download", headers=_auth(token)
    )
    assert r.status_code == 404


async def test_download_happy_path(
    client: AsyncClient, db_session: AsyncSession, seed_admin: tuple[User, str], monkeypatch
) -> None:
    admin, token = seed_admin
    app_id = await _seed_app(db_session, admin.company_id, passport_doc="minio://golden_visa/x")
    _patch_storage(monkeypatch)
    r = await client.get(
        f"/api/v1/golden-visa/{app_id}/documents/passport/download", headers=_auth(token)
    )
    assert r.status_code == 200, r.text
    assert r.json()["url"].startswith("https://signed.example/")


async def test_download_cross_tenant_404(
    client: AsyncClient,
    db_session: AsyncSession,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Loi 1 : impossible de télécharger le document d'un autre tenant (404)."""
    admin, _token_a = seed_admin
    _company_b, token_b = second_admin
    app_id = await _seed_app(db_session, admin.company_id, passport_doc="minio://golden_visa/x")
    r = await client.get(
        f"/api/v1/golden-visa/{app_id}/documents/passport/download", headers=_auth(token_b)
    )
    assert r.status_code == 404
