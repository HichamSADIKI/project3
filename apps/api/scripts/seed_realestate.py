"""Seed démo — rubrique Immobilier (Real Estate).

Étend le seed principal (`scripts/seed.py`) avec un jeu de données cohérent
Dubai / Abu Dhabi couvrant toute la rubrique Immobilier du back-office :
paramètres, succursales, propriétaires, bâtiments, étages, unités, locataires,
contrats + baux, chèques post-datés (PDC), paiements et maintenance.

Idempotent : chaque entité a un UUID figé ; relancer `make seed` ne duplique
rien (upsert par identifiant). Tout porte `company_id` (Loi 1).
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import Decimal

from geoalchemy2.elements import WKTElement
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import Branch
from app.models.building import Building
from app.models.client import Client
from app.models.company_settings import CompanySettings
from app.models.contract import Contract
from app.models.floor import Floor
from app.models.maintenance import MaintenanceTicket
from app.models.party_owner import Owner
from app.models.party_tenant import TenantProfile
from app.models.payment import PaymentRequest, PaymentTransaction
from app.models.pdc_cheque import PdcCheque
from app.models.property import Property
from app.models.rental import Rental
from app.models.unit import Unit
from app.routers.sales.models import (
    SaleListing,
    SaleMandate,
    SaleOffer,
    SaleTransaction,
)


def _uid(tag: int, n: int) -> uuid.UUID:
    """UUID stable et lisible pour l'idempotence : tag (type d'entité) + n."""
    return uuid.UUID(f"{tag:08x}-0000-4000-8000-{n:012d}")


# Tags par type d'entité (pour des UUID figés distincts).
T_OWNER, T_TENANT = 0xA1, 0xC1
T_BUILDING, T_FLOOR, T_UNIT = 0xB1, 0xB2, 0xB3
T_PROPERTY, T_CONTRACT, T_RENTAL = 0xD1, 0xD2, 0xD3
T_PDC, T_PAYREQ, T_PAYTX, T_MAINT = 0xE1, 0xE2, 0xE3, 0xF1
T_BRANCH, T_SETTINGS = 0xF2, 0xF3
# Ventes (Sales) : mandat / annonce / offre / transaction.
T_SALE_MANDATE, T_SALE_LISTING, T_SALE_OFFER, T_SALE_TX = 0xD4, 0xD5, 0xD6, 0xD7


def _pt(lng: float, lat: float) -> WKTElement:
    return WKTElement(f"POINT({lng} {lat})", srid=4326)


async def _ensure(session: AsyncSession, model, where, build):
    """Upsert idempotent : renvoie (objet, créé?)."""
    existing = (await session.execute(select(model).where(where))).scalar_one_or_none()
    if existing is not None:
        return existing, False
    obj = build()
    session.add(obj)
    await session.flush()
    return obj, True


async def seed_realestate(
    session: AsyncSession, company_id: uuid.UUID, admin_user_id: uuid.UUID
) -> None:
    print("→ Seed Immobilier (Real Estate)")
    n_created = 0

    def mark(created: bool) -> None:
        nonlocal n_created
        if created:
            n_created += 1

    # ── Paramètres société (singleton) ────────────────────────────────────────
    _, c = await _ensure(
        session,
        CompanySettings,
        CompanySettings.company_id == company_id,
        lambda: CompanySettings(
            id=_uid(T_SETTINGS, 1),
            company_id=company_id,
            currency="AED",
            vat_enabled=True,
            vat_rate=Decimal("5.00"),
            default_emirate="DXB",
            timezone="Asia/Dubai",
            ejari_enabled=True,
            dld_enabled=True,
            invoice_prefix="INV",
            contract_prefix="CTR",
        ),
    )
    mark(c)

    # ── Succursales ────────────────────────────────────────────────────────────
    branches = [
        (
            1,
            "BR-001",
            "Dubai Marina HQ",
            "DXB",
            "Marina Plaza, Dubai Marina, Dubai",
            55.1404,
            25.0805,
            "+971 4 555 0100",
            "marina@infinity-uae.com",
        ),
        (
            2,
            "BR-002",
            "Abu Dhabi Corniche",
            "AUH",
            "Corniche Road, Abu Dhabi",
            54.3552,
            24.4731,
            "+971 2 555 0200",
            "auh@infinity-uae.com",
        ),
    ]
    for n, code, name, emirate, addr, lng, lat, phone, email in branches:
        _, c = await _ensure(
            session,
            Branch,
            (Branch.company_id == company_id) & (Branch.code == code),
            lambda n=n, code=code, name=name, emirate=emirate, addr=addr, lng=lng, lat=lat, phone=phone, email=email: (  # noqa: E501
                Branch(
                    id=_uid(T_BRANCH, n),
                    company_id=company_id,
                    code=code,
                    name=name,
                    name_en=name,
                    emirate=emirate,
                    address=addr,
                    location=_pt(lng, lat),
                    phone=phone,
                    email=email,
                    manager_user_id=admin_user_id,
                    is_active=True,
                )
            ),
        )
        mark(c)

    # ── Propriétaires (clients + profils owner) ───────────────────────────────
    # Owner 1 : société. Owner 2 : individu résident UAE.
    owners = [
        dict(
            n=1,
            ctype="company",
            company_name="Falcon Holdings LLC",
            email="contact@falcon-holdings.ae",
            phone="+971 4 333 0001",
            nationality="UAE",
            mandate_ref="MND-2026-001",
            iban="AE070331234567890123456",
            bank="Emirates NBD",
            commission=Decimal("5.00"),
        ),
        dict(
            n=2,
            ctype="individual",
            first_name="Mariam",
            last_name="Al Suwaidi",
            email="mariam.alsuwaidi@example.com",
            phone="+971 50 333 0002",
            nationality="UAE",
            mandate_ref="MND-2026-002",
            iban="AE980331111122223333444",
            bank="ADCB",
            commission=Decimal("4.50"),
        ),
    ]
    owner_pids: list[uuid.UUID] = []
    for o in owners:
        pid = _uid(T_OWNER, o["n"])
        owner_pids.append(pid)
        _, c = await _ensure(
            session,
            Client,
            Client.id == pid,
            lambda o=o, pid=pid: Client(
                id=pid,
                company_id=company_id,
                type=o["ctype"],
                first_name=o.get("first_name"),
                last_name=o.get("last_name"),
                company_name=o.get("company_name"),
                email=o["email"],
                phone=o["phone"],
                nationality=o["nationality"],
                country_of_residence="UAE",
                source="referral",
                notes="Démo — propriétaire bailleur.",
            ),
        )
        mark(c)
        _, c = await _ensure(
            session,
            Owner,
            Owner.party_id == pid,
            lambda o=o, pid=pid: Owner(
                party_id=pid,
                company_id=company_id,
                residency_uae=True,
                mandate_reference=o["mandate_ref"],
                mandate_start_date=date(2026, 1, 1),
                mandate_end_date=date(2027, 12, 31),
                mandate_signed_at=datetime(2026, 1, 1, tzinfo=UTC),
                mandate_commission_rate=o["commission"],
                bank_iban=o["iban"],
                bank_name=o["bank"],
                preferred_payout_method="bank_transfer",
                monthly_statement_enabled=True,
            ),
        )
        mark(c)

    # ── Bâtiments ──────────────────────────────────────────────────────────────
    buildings = [
        dict(
            n=1,
            ref="BLD-DXB-MARINA-A",
            owner=owner_pids[0],
            name="Marina Heights Tower A",
            btype="residential_tower",
            emirate="DXB",
            district="Dubai Marina",
            addr="Marina Walk, Dubai Marina, Dubai",
            lng=55.1390,
            lat=25.0790,
            floors=25,
            units=6,
            year=2019,
            developer="Emaar Properties",
            dld="DLD-DXB-882201",
            value=Decimal("180000000.00"),
        ),
        dict(
            n=2,
            ref="BLD-AUH-CORNICHE-1",
            owner=owner_pids[1],
            name="Corniche Residences",
            btype="mixed_use",
            emirate="AUH",
            district="Corniche",
            addr="Corniche Road, Abu Dhabi",
            lng=54.3500,
            lat=24.4750,
            floors=18,
            units=3,
            year=2021,
            developer="Aldar Properties",
            dld="DLD-AUH-114520",
            value=Decimal("95000000.00"),
        ),
    ]
    building_ids: list[uuid.UUID] = []
    for b in buildings:
        bid = _uid(T_BUILDING, b["n"])
        building_ids.append(bid)
        _, c = await _ensure(
            session,
            Building,
            (Building.company_id == company_id) & (Building.reference == b["ref"]),
            lambda b=b, bid=bid: Building(
                id=bid,
                company_id=company_id,
                reference=b["ref"],
                owner_party_id=b["owner"],
                name_en=b["name"],
                building_type=b["btype"],
                location=_pt(b["lng"], b["lat"]),
                emirate=b["emirate"],
                district=b["district"],
                address_en=b["addr"],
                total_floors=b["floors"],
                total_units=b["units"],
                year_built=b["year"],
                developer=b["developer"],
                status="operational",
                dld_property_number=b["dld"],
                dld_tenure="freehold",
                estimated_value_aed=b["value"],
                has_active_security_contract=True,
                has_active_cleaning_contract=True,
            ),
        )
        mark(c)

    # Étages (bâtiment 1 uniquement, pour la démo de hiérarchie).
    floor_ids: dict[int, uuid.UUID] = {}
    for fn in (12, 15, 18, 20):
        fid = _uid(T_FLOOR, fn)
        floor_ids[fn] = fid
        _, c = await _ensure(
            session,
            Floor,
            Floor.id == fid,
            lambda fn=fn, fid=fid: Floor(
                id=fid,
                company_id=company_id,
                building_id=building_ids[0],
                floor_number=fn,
                label=f"Niveau {fn}",
                planned_units=4,
            ),
        )
        mark(c)

    # ── Unités ─────────────────────────────────────────────────────────────────
    # (n, building_idx, floor_number|None, unit_number, type, status, area, bed, bath,
    #  rent_annuel, sale, ejari, dewa)
    units = [
        (
            1,
            0,
            12,
            "1201",
            "apartment_2br",
            "occupied",
            110,
            2,
            2,
            140000,
            2100000,
            "EJ-1201-26",
            "DEWA-220112",
        ),
        (
            2,
            0,
            12,
            "1202",
            "apartment_1br",
            "vacant",
            75,
            1,
            1,
            95000,
            1350000,
            None,
            "DEWA-220113",
        ),
        (
            3,
            0,
            15,
            "1503",
            "apartment_3br",
            "reserved",
            155,
            3,
            3,
            195000,
            3200000,
            None,
            "DEWA-220150",
        ),
        (
            4,
            0,
            20,
            "2001",
            "penthouse",
            "occupied",
            320,
            4,
            5,
            480000,
            9500000,
            "EJ-2001-26",
            "DEWA-220200",
        ),
        (5, 0, None, "G01", "shop", "vacant", 60, None, 1, 180000, None, None, "DEWA-220001"),
        (
            6,
            0,
            18,
            "1804",
            "apartment_2br",
            "maintenance",
            108,
            2,
            2,
            138000,
            2050000,
            None,
            "DEWA-220180",
        ),
        (
            7,
            1,
            None,
            "101",
            "apartment_1br",
            "vacant",
            80,
            1,
            1,
            110000,
            1500000,
            None,
            "ADDC-110101",
        ),
        (
            8,
            1,
            None,
            "102",
            "studio",
            "occupied",
            45,
            0,
            1,
            70000,
            900000,
            "EJ-102-26",
            "ADDC-110102",
        ),
        (9, 1, None, "201", "office", "vacant", 120, None, 2, 220000, None, None, "ADDC-110201"),
    ]
    unit_ids: list[uuid.UUID] = []
    for n, bidx, fnum, unum, utype, status, area, bed, bath, rent, sale, ejari, dewa in units:
        uid_ = _uid(T_UNIT, n)
        unit_ids.append(uid_)
        _, c = await _ensure(
            session,
            Unit,
            Unit.id == uid_,
            lambda n=n, bidx=bidx, fnum=fnum, unum=unum, utype=utype, status=status, area=area, bed=bed, bath=bath, rent=rent, sale=sale, ejari=ejari, dewa=dewa, uid_=uid_: (  # noqa: E501
                Unit(
                    id=uid_,
                    company_id=company_id,
                    building_id=building_ids[bidx],
                    floor_id=floor_ids.get(fnum) if fnum else None,
                    unit_number=unum,
                    unit_type=utype,
                    status=status,
                    area_sqm=Decimal(str(area)),
                    bedrooms=bed,
                    bathrooms=bath,
                    parking_spaces=1 if bed else 0,
                    furnished=status == "occupied",
                    list_rent_aed=Decimal(str(rent)),
                    list_sale_aed=Decimal(str(sale)) if sale else None,
                    ejari_number=ejari,
                    dewa_account_number=dewa,
                )
            ),
        )
        mark(c)

    # ── Locataires (clients + profils tenant) ─────────────────────────────────
    tenants = [
        dict(
            n=1,
            first="John",
            last="Smith",
            email="john.smith@example.com",
            phone="+971 55 444 0001",
            nat="GB",
            lifecycle="active",
            kyc="verified",
            income=Decimal("45000.00"),
            employer="DP World",
            loyalty=78,
            visa="employment",
            verified=True,
        ),
        dict(
            n=2,
            first="Priya",
            last="Nair",
            email="priya.nair@example.com",
            phone="+971 56 444 0002",
            nat="IN",
            lifecycle="active",
            kyc="pending",
            income=Decimal("28000.00"),
            employer="Emirates Group",
            loyalty=62,
            visa="employment",
            verified=False,
        ),
        dict(
            n=3,
            first="Omar",
            last="Haddad",
            email="omar.haddad@example.com",
            phone="+971 52 444 0003",
            nat="LB",
            lifecycle="candidate",
            kyc="not_started",
            income=Decimal("32000.00"),
            employer="Majid Al Futtaim",
            loyalty=50,
            visa="employment",
            verified=False,
        ),
    ]
    tenant_pids: list[uuid.UUID] = []
    for t in tenants:
        pid = _uid(T_TENANT, t["n"])
        tenant_pids.append(pid)
        _, c = await _ensure(
            session,
            Client,
            Client.id == pid,
            lambda t=t, pid=pid: Client(
                id=pid,
                company_id=company_id,
                type="individual",
                first_name=t["first"],
                last_name=t["last"],
                email=t["email"],
                phone=t["phone"],
                nationality=t["nat"],
                country_of_residence="UAE",
                source="portal_text",
                notes="Démo — locataire.",
            ),
        )
        mark(c)
        _, c = await _ensure(
            session,
            TenantProfile,
            TenantProfile.party_id == pid,
            lambda t=t, pid=pid: TenantProfile(
                party_id=pid,
                company_id=company_id,
                lifecycle_status=t["lifecycle"],
                kyc_status=t["kyc"],
                visa_type=t["visa"],
                monthly_income_aed=t["income"],
                employer_name=t["employer"],
                loyalty_score=t["loyalty"],
                kyc_verified_at=datetime(2026, 2, 1, tzinfo=UTC) if t["verified"] else None,
                kyc_verified_by_user_id=admin_user_id if t["verified"] else None,
                activated_at=datetime(2026, 2, 1, tzinfo=UTC)
                if t["lifecycle"] == "active"
                else None,
            ),
        )
        mark(c)

    # ── Properties legacy (support des contrats / baux / PDC) ─────────────────
    # 2 biens reflétant les unités occupées 1201 (Marina) et 102 (Corniche).
    props = [
        dict(
            n=1,
            ref="PROP-DEMO-0001",
            title="Marina Heights — Apt 1201",
            ptype="apartment",
            price=Decimal("2100000.00"),
            area=Decimal("110.00"),
            bed=2,
            bath=2,
            lng=55.1390,
            lat=25.0790,
            district="Dubai Marina",
            city="Dubai",
        ),
        dict(
            n=2,
            ref="PROP-DEMO-0002",
            title="Corniche Residences — Studio 102",
            ptype="apartment",
            price=Decimal("900000.00"),
            area=Decimal("45.00"),
            bed=0,
            bath=1,
            lng=54.3500,
            lat=24.4750,
            district="Corniche",
            city="Abu Dhabi",
        ),
    ]
    property_ids: list[uuid.UUID] = []
    for p in props:
        pid = _uid(T_PROPERTY, p["n"])
        property_ids.append(pid)
        _, c = await _ensure(
            session,
            Property,
            (Property.company_id == company_id) & (Property.reference == p["ref"]),
            lambda p=p, pid=pid: Property(
                id=pid,
                company_id=company_id,
                reference=p["ref"],
                type=p["ptype"],
                title_en=p["title"],
                price=p["price"],
                area_sqm=p["area"],
                bedrooms=p["bed"],
                bathrooms=p["bath"],
                status="rented",
                location=_pt(p["lng"], p["lat"]),
                district=p["district"],
                city=p["city"],
                agent_id=admin_user_id,
            ),
        )
        mark(c)

    # ── Contrats (rental) + baux ──────────────────────────────────────────────
    # Bail 1 : John Smith @ Marina 1201. Bail 2 : Priya Nair @ Corniche 102.
    leases = [
        dict(
            n=1,
            tenant=tenant_pids[0],
            prop=property_ids[0],
            ref="CNT-2026-9001",
            annual=Decimal("140000.00"),
            monthly=Decimal("11666.67"),
            deposit=Decimal("14000.00"),
            start=date(2026, 1, 15),
            end=date(2027, 1, 14),
            unit_idx=0,
        ),
        dict(
            n=2,
            tenant=tenant_pids[1],
            prop=property_ids[1],
            ref="CNT-2026-9002",
            annual=Decimal("70000.00"),
            monthly=Decimal("5833.33"),
            deposit=Decimal("7000.00"),
            start=date(2026, 3, 1),
            end=date(2027, 2, 28),
            unit_idx=7,
        ),
    ]
    contract_ids: list[uuid.UUID] = []
    rental_ids: list[uuid.UUID] = []
    for ls in leases:
        cid = _uid(T_CONTRACT, ls["n"])
        contract_ids.append(cid)
        commission = (ls["annual"] * Decimal("2.0") / Decimal("100")).quantize(Decimal("0.01"))
        _, c = await _ensure(
            session,
            Contract,
            (Contract.company_id == company_id) & (Contract.reference == ls["ref"]),
            lambda ls=ls, cid=cid, commission=commission: Contract(
                id=cid,
                company_id=company_id,
                reference=ls["ref"],
                type="rental",
                client_id=ls["tenant"],
                property_id=ls["prop"],
                agent_id=admin_user_id,
                amount=ls["annual"],
                commission_rate=Decimal("2.0"),
                commission_amount=commission,
                status="signed",
                signed_at=datetime.combine(ls["start"], datetime.min.time(), tzinfo=UTC),
                start_date=ls["start"],
                end_date=ls["end"],
            ),
        )
        mark(c)
        rid = _uid(T_RENTAL, ls["n"])
        rental_ids.append(rid)
        _, c = await _ensure(
            session,
            Rental,
            Rental.id == rid,
            lambda ls=ls, rid=rid, cid=cid: Rental(
                id=rid,
                company_id=company_id,
                contract_id=cid,
                client_id=ls["tenant"],
                property_id=ls["prop"],
                monthly_rent=ls["monthly"],
                annual_rent=ls["annual"],
                deposit=ls["deposit"],
                payment_frequency="quarterly",
                status="active",
                start_date=ls["start"],
                end_date=ls["end"],
            ),
        )
        mark(c)

    # ── Chèques post-datés (PDC) — bail 1, 4 chèques trimestriels ─────────────
    pdc_rows = [
        (1, "000111", date(2026, 1, 15), "cleared", datetime(2026, 1, 16, tzinfo=UTC)),
        (2, "000112", date(2026, 4, 15), "deposited", None),
        (3, "000113", date(2026, 7, 15), "pending", None),
        (4, "000114", date(2026, 10, 15), "pending", None),
    ]
    quarter = (leases[0]["annual"] / Decimal("4")).quantize(Decimal("0.01"))
    for n, chq_no, due, status, cleared_at in pdc_rows:
        ref = f"PDC-2026-{900000 + n:06d}"
        _, c = await _ensure(
            session,
            PdcCheque,
            (PdcCheque.company_id == company_id) & (PdcCheque.reference == ref),
            lambda n=n, ref=ref, chq_no=chq_no, due=due, status=status, cleared_at=cleared_at: (
                PdcCheque(
                    id=_uid(T_PDC, n),
                    company_id=company_id,
                    reference=ref,
                    rental_id=rental_ids[0],
                    drawer_party_id=tenant_pids[0],
                    cheque_number=chq_no,
                    bank_name="Emirates NBD",
                    bank_branch="Dubai Marina",
                    account_holder_name="John Smith",
                    amount_aed=quarter,
                    due_date=due,
                    deposit_date=due if status in ("deposited", "cleared") else None,
                    cleared_at=cleared_at,
                    status=status,
                    notes="Démo — loyer trimestriel bail CNT-2026-0001.",
                )
            ),
        )
        mark(c)

    # ── Paiements (requests + 1 transaction réglée) ───────────────────────────
    pay_rows = [
        (
            1,
            "rent",
            "paid",
            Decimal("11666.67"),
            date(2026, 1, 15),
            datetime(2026, 1, 15, tzinfo=UTC),
        ),
        (2, "rent", "pending", Decimal("11666.67"), date(2026, 6, 15), None),
        (3, "charges", "overdue", Decimal("2500.00"), date(2026, 4, 1), None),
    ]
    payreq_ids: dict[int, uuid.UUID] = {}
    for n, ptype, status, amount, due, paid_at in pay_rows:
        rid = _uid(T_PAYREQ, n)
        payreq_ids[n] = rid
        ref = f"PAY-2026-{900000 + n:06d}"
        _, c = await _ensure(
            session,
            PaymentRequest,
            (PaymentRequest.company_id == company_id) & (PaymentRequest.reference == ref),
            lambda n=n, rid=rid, ref=ref, ptype=ptype, status=status, amount=amount, due=due, paid_at=paid_at: (  # noqa: E501
                PaymentRequest(
                    id=rid,
                    company_id=company_id,
                    reference=ref,
                    tenant_client_id=tenant_pids[0],
                    owner_client_id=owner_pids[0],
                    unit_id=unit_ids[0],
                    rental_id=rental_ids[0],
                    payment_type=ptype,
                    status=status,
                    amount_aed=amount,
                    due_date=due,
                    paid_at=paid_at,
                    description=f"Démo — {ptype} unité 1201.",
                )
            ),
        )
        mark(c)
    # Transaction réglée pour la requête payée (#1).
    _, c = await _ensure(
        session,
        PaymentTransaction,
        PaymentTransaction.id == _uid(T_PAYTX, 1),
        lambda: PaymentTransaction(
            id=_uid(T_PAYTX, 1),
            company_id=company_id,
            request_id=payreq_ids[1],
            status="settled",
            method="bank_transfer",
            amount_aed=Decimal("11666.67"),
            external_ref="TXN-ENBD-26011500123",
            settled_at=datetime(2026, 1, 15, 10, 30, tzinfo=UTC),
        ),
    )
    mark(c)

    # ── Maintenance (tickets) ──────────────────────────────────────────────────
    maint_rows = [
        dict(
            n=1,
            unit=5,
            building=None,
            cat="plumbing",
            prio="high",
            status="in_progress",
            title="Fuite d'eau salle de bain — Apt 1804",
            desc="Infiltration sous le lavabo signalée par le locataire.",
        ),
        dict(
            n=2,
            unit=None,
            building=0,
            cat="electrical",
            prio="medium",
            status="new",
            title="Panne éclairage hall — Marina Heights",
            desc="Plusieurs spots du hall d'entrée hors service.",
        ),
        dict(
            n=3,
            unit=6,
            building=None,
            cat="hvac",
            prio="urgent",
            status="assigned",
            title="Climatisation HS — Apt 101 Corniche",
            desc="Unité de climatisation ne refroidit plus, locataire à reloger si non résolu.",
        ),
    ]
    for m in maint_rows:
        ref = f"MNT-2026-{900000 + m['n']:06d}"
        _, c = await _ensure(
            session,
            MaintenanceTicket,
            (MaintenanceTicket.company_id == company_id) & (MaintenanceTicket.reference == ref),
            lambda m=m, ref=ref: MaintenanceTicket(
                id=_uid(T_MAINT, m["n"]),
                company_id=company_id,
                reference=ref,
                unit_id=unit_ids[m["unit"]] if m["unit"] is not None else None,
                building_id=building_ids[m["building"]] if m["building"] is not None else None,
                reported_by_user_id=admin_user_id,
                reporter_role="agent",
                category=m["cat"],
                priority=m["prio"],
                status=m["status"],
                title=m["title"],
                description=m["desc"],
            ),
        )
        mark(c)

    # ── Ventes (Sales) — mandat → annonce → offre → transaction ───────────────
    # Chaîne de démo pour la sous-rubrique Ventes. Vendeurs = propriétaires
    # existants (owner_pids), biens = propriétés existantes (property_ids),
    # acheteurs = client démo Ahmed + locataires existants (tenant_pids).
    demo_buyer_id = uuid.UUID("11111111-1111-1111-1111-111111111111")  # Ahmed Al Demo

    sale_mandates = [
        dict(n=1, ref="SAL-MND-2026-001", seller=owner_pids[0], prop=property_ids[0],
             mtype="exclusive", commission=Decimal("2.00"), asking=Decimal("2150000.00")),
        dict(n=2, ref="SAL-MND-2026-002", seller=owner_pids[1], prop=property_ids[1],
             mtype="simple", commission=Decimal("2.00"), asking=Decimal("950000.00")),
    ]
    for m in sale_mandates:
        _, c = await _ensure(
            session,
            SaleMandate,
            (SaleMandate.company_id == company_id) & (SaleMandate.reference == m["ref"]),
            lambda m=m: SaleMandate(
                id=_uid(T_SALE_MANDATE, m["n"]),
                company_id=company_id,
                reference=m["ref"],
                seller_client_id=m["seller"],
                property_id=m["prop"],
                mandate_type=m["mtype"],
                commission_rate=m["commission"],
                asking_price=m["asking"],
                status="active",
                signed_at=datetime(2026, 1, 15, tzinfo=UTC),
                expires_at=datetime(2026, 12, 31, tzinfo=UTC),
            ),
        )
        mark(c)

    sale_listings = [
        dict(n=1, ref="SAL-LST-2026-001", mandate=1,
             title="Marina Heights — Apt 1201 à vendre",
             price=Decimal("2150000.00"), status="under_offer", featured=True),
        dict(n=2, ref="SAL-LST-2026-002", mandate=2,
             title="Corniche Residences — Studio 102 à vendre",
             price=Decimal("950000.00"), status="sold", featured=False),
    ]
    for ls in sale_listings:
        _, c = await _ensure(
            session,
            SaleListing,
            (SaleListing.company_id == company_id) & (SaleListing.reference == ls["ref"]),
            lambda ls=ls: SaleListing(
                id=_uid(T_SALE_LISTING, ls["n"]),
                company_id=company_id,
                reference=ls["ref"],
                mandate_id=_uid(T_SALE_MANDATE, ls["mandate"]),
                title_en=ls["title"],
                title_fr=ls["title"],
                list_price=ls["price"],
                status=ls["status"],
                published_at=datetime(2026, 2, 1, tzinfo=UTC),
                slug=f"vente-{ls['n']}",
                is_featured=ls["featured"],
                is_urgent=False,
            ),
        )
        mark(c)

    sale_offers = [
        dict(n=1, ref="SAL-OFR-2026-001", listing=1, buyer=demo_buyer_id,
             amount=Decimal("2050000.00"), status="submitted", decided=False),
        dict(n=2, ref="SAL-OFR-2026-002", listing=1, buyer=tenant_pids[0],
             amount=Decimal("2120000.00"), status="rejected", decided=True),
        dict(n=3, ref="SAL-OFR-2026-003", listing=2, buyer=tenant_pids[1],
             amount=Decimal("940000.00"), status="accepted", decided=True),
    ]
    for of in sale_offers:
        _, c = await _ensure(
            session,
            SaleOffer,
            (SaleOffer.company_id == company_id) & (SaleOffer.reference == of["ref"]),
            lambda of=of: SaleOffer(
                id=_uid(T_SALE_OFFER, of["n"]),
                company_id=company_id,
                reference=of["ref"],
                listing_id=_uid(T_SALE_LISTING, of["listing"]),
                buyer_client_id=of["buyer"],
                amount=of["amount"],
                status=of["status"],
                decided_at=datetime(2026, 3, 1, tzinfo=UTC) if of["decided"] else None,
            ),
        )
        mark(c)

    # Transaction clôturée : annonce 2 (vendue) via l'offre acceptée n°3.
    _, c = await _ensure(
        session,
        SaleTransaction,
        (SaleTransaction.company_id == company_id) & (SaleTransaction.reference == "SAL-TXN-2026-001"),
        lambda: SaleTransaction(
            id=_uid(T_SALE_TX, 1),
            company_id=company_id,
            reference="SAL-TXN-2026-001",
            listing_id=_uid(T_SALE_LISTING, 2),
            offer_id=_uid(T_SALE_OFFER, 3),
            final_price=Decimal("940000.00"),
            commission_amount=Decimal("18800.00"),
            status="completed",
            closed_at=datetime(2026, 3, 15, tzinfo=UTC),
        ),
    )
    mark(c)

    print(f"  Immobilier : {n_created} entité(s) créée(s) (re-run = idempotent).")
