"""Tests Acquisitions — helpers purs + intégration HTTP (mandats + offres + matching).

- Couche 1 : helpers purs (référence, machines à états, score). Sans DB → partout.
- Couche 2 : endpoints HTTP via le harness partagé (client / seed_admin /
  second_admin / unique_email). Requiert PostgreSQL → lancer dans le conteneur.
"""

import uuid
from decimal import Decimal

from httpx import AsyncClient

from app.models.company import Company
from app.models.user import User
from app.routers.acquisitions import service

# ════════════════════════════════════════════════════════════════════════════
# Couche 1 — Helpers purs (sans DB)
# ════════════════════════════════════════════════════════════════════════════


def test_generate_reference() -> None:
    assert service.generate_reference(2026, 42) == "ACQ-2026-000042"
    assert service.generate_reference(2026, 1) == "ACQ-2026-000001"
    # Triable lexicographiquement.
    assert service.generate_reference(2026, 5) < service.generate_reference(2026, 50)


def test_is_valid_offer_transition_valid() -> None:
    assert service.is_valid_offer_transition("draft", "submitted")
    assert service.is_valid_offer_transition("submitted", "accepted")
    assert service.is_valid_offer_transition("submitted", "rejected")
    assert service.is_valid_offer_transition("submitted", "withdrawn")


def test_is_valid_offer_transition_invalid_and_terminal() -> None:
    # Sauts interdits.
    assert not service.is_valid_offer_transition("draft", "accepted")
    assert not service.is_valid_offer_transition("draft", "withdrawn")
    # Identité interdite.
    assert not service.is_valid_offer_transition("draft", "draft")
    # États terminaux : aucune sortie.
    for terminal in ("accepted", "rejected", "withdrawn"):
        for target in service.OFFER_STATUSES:
            assert not service.is_valid_offer_transition(terminal, target)
    # Statuts inconnus.
    assert not service.is_valid_offer_transition("zzz", "submitted")
    assert not service.is_valid_offer_transition("draft", "zzz")


def test_is_valid_mandate_transition_valid() -> None:
    assert service.is_valid_mandate_transition("active", "fulfilled")
    assert service.is_valid_mandate_transition("active", "expired")
    assert service.is_valid_mandate_transition("active", "cancelled")


def test_is_valid_mandate_transition_invalid_and_terminal() -> None:
    assert not service.is_valid_mandate_transition("active", "active")
    for terminal in ("fulfilled", "expired", "cancelled"):
        for target in service.MANDATE_STATUSES:
            assert not service.is_valid_mandate_transition(terminal, target)
    assert not service.is_valid_mandate_transition("zzz", "fulfilled")
    assert not service.is_valid_mandate_transition("active", "zzz")


def test_match_score_perfect_in_range() -> None:
    # Prix dans la fourchette + type ok + chambres ok → 100.
    score = service.match_score(
        Decimal("1000000"), Decimal("2000000"), "apartment", 2,
        Decimal("1500000"), "apartment", 3,
    )
    assert score == 100


def test_match_score_no_criteria_is_neutral_max() -> None:
    # Aucun critère exprimé → tous neutres → 100.
    assert service.match_score(None, None, None, None, Decimal("999"), "villa", 5) == 100


def test_match_score_type_mismatch_loses_25() -> None:
    score = service.match_score(
        Decimal("1000000"), Decimal("2000000"), "villa", None,
        Decimal("1500000"), "apartment", None,
    )
    # 60 (prix ok) + 0 (type ko) + 15 (chambres neutres) = 75.
    assert score == 75


def test_match_score_bedrooms_insufficient_loses_15() -> None:
    score = service.match_score(
        None, None, None, 3,
        Decimal("1000000"), None, 1,
    )
    # 60 (prix neutre) + 25 (type neutre) + 0 (chambres ko) = 85.
    assert score == 85
    # bedrooms exactement égal → suffisant.
    score_eq = service.match_score(None, None, None, 3, Decimal("1"), None, 3)
    assert score_eq == 100


def test_match_score_price_out_of_range_degrades() -> None:
    # Prix au-dessus du max : pénalité dégressive, pas de division par zéro.
    over = service.match_score(
        None, Decimal("1000000"), None, None,
        Decimal("1500000"), None, None,
    )
    # gap=500k / ref=1M = 0.5 → price_score = 60*0.5 = 30 ; +25 +15 = 70.
    assert over == 70
    # Très au-dessus → composante prix nulle, mais score borné >= 0.
    far = service.match_score(
        None, Decimal("1000000"), None, None,
        Decimal("5000000"), None, None,
    )
    # gap=4M/1M=4 → price_score=0 ; +25 +15 = 40.
    assert far == 40
    # Sous le minimum.
    under = service.match_score(
        Decimal("1000000"), None, None, None,
        Decimal("500000"), None, None,
    )
    # gap=500k/1M=0.5 → 30 ; +25 +15 = 70.
    assert under == 70


def test_match_score_missing_price_is_neutral() -> None:
    # Prix du bien manquant → critère prix neutre (60).
    assert service.match_score(
        Decimal("1000000"), Decimal("2000000"), None, None, None, None, None
    ) == 100


def test_match_score_bounds() -> None:
    # Jamais hors [0, 100].
    s = service.match_score(
        Decimal("1000000"), Decimal("1000001"), "villa", 10,
        Decimal("10000000"), "apartment", 0,
    )
    assert 0 <= s <= 100


# ════════════════════════════════════════════════════════════════════════════
# Couche 2 — Intégration HTTP (requiert PostgreSQL — conteneur)
# ════════════════════════════════════════════════════════════════════════════


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


async def _create_client(client: AsyncClient, headers: dict[str, str]) -> str:
    """Crée un client (acquéreur) dans le tenant et renvoie son id."""
    resp = await client.post(
        "/api/v1/clients/",
        headers=headers,
        json={"type": "individual", "first_name": "Buyer", "last_name": "Test"},
    )
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["data"]["id"]


async def _create_property(
    client: AsyncClient, headers: dict[str, str], **overrides
) -> str:
    """Crée un bien dans le tenant et renvoie son id."""
    payload = {
        "type": "apartment",
        "title_en": "Test Property",
        "price": "1500000",
        "city": "Dubai",
    }
    payload.update(overrides)
    resp = await client.post("/api/v1/properties/", headers=headers, json=payload)
    assert resp.status_code in (200, 201), resp.text
    return resp.json()["data"]["id"]


async def test_health_is_public(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/acquisitions/health")
    assert resp.status_code == 200
    assert resp.json()["module"] == "acquisitions"


async def test_mandate_create_get_list(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    headers = _headers(token)
    buyer_id = await _create_client(client, headers)

    created = await client.post(
        "/api/v1/acquisitions/mandates",
        headers=headers,
        json={
            "buyer_client_id": buyer_id,
            "budget_min": "1000000",
            "budget_max": "2000000",
            "property_type": "apartment",
            "bedrooms_min": 2,
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()["data"]
    assert body["reference"].startswith("ACQ-")
    assert body["status"] == "active"
    mandate_id = body["id"]

    got = await client.get(f"/api/v1/acquisitions/mandates/{mandate_id}", headers=headers)
    assert got.status_code == 200
    assert got.json()["data"]["id"] == mandate_id

    listed = await client.get("/api/v1/acquisitions/mandates", headers=headers)
    assert listed.status_code == 200
    ids = {m["id"] for m in listed.json()["data"]}
    assert mandate_id in ids


async def test_mandate_create_rejects_foreign_client(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    """Loi 1 : un buyer_client_id hors tenant → 400."""
    _admin, token = seed_admin
    headers = _headers(token)
    resp = await client.post(
        "/api/v1/acquisitions/mandates",
        headers=headers,
        json={"buyer_client_id": str(uuid.uuid4())},
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"] == "client_not_in_company"


async def test_mandate_transition_valid_and_invalid(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    headers = _headers(token)
    buyer_id = await _create_client(client, headers)
    created = await client.post(
        "/api/v1/acquisitions/mandates",
        headers=headers,
        json={"buyer_client_id": buyer_id},
    )
    mandate_id = created.json()["data"]["id"]

    ok = await client.post(
        f"/api/v1/acquisitions/mandates/{mandate_id}/transition",
        headers=headers,
        json={"status": "fulfilled"},
    )
    assert ok.status_code == 200
    assert ok.json()["data"]["status"] == "fulfilled"

    # fulfilled est terminal → 409.
    ko = await client.post(
        f"/api/v1/acquisitions/mandates/{mandate_id}/transition",
        headers=headers,
        json={"status": "cancelled"},
    )
    assert ko.status_code == 409, ko.text


async def test_offer_create_get_list_and_transition(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    headers = _headers(token)
    buyer_id = await _create_client(client, headers)
    prop_id = await _create_property(client, headers)
    mandate = await client.post(
        "/api/v1/acquisitions/mandates",
        headers=headers,
        json={"buyer_client_id": buyer_id},
    )
    mandate_id = mandate.json()["data"]["id"]

    created = await client.post(
        "/api/v1/acquisitions/offers",
        headers=headers,
        json={"mandate_id": mandate_id, "property_id": prop_id, "amount": "1450000"},
    )
    assert created.status_code == 201, created.text
    offer = created.json()["data"]
    assert offer["reference"].startswith("ACQ-")
    assert offer["status"] == "draft"
    offer_id = offer["id"]

    got = await client.get(f"/api/v1/acquisitions/offers/{offer_id}", headers=headers)
    assert got.status_code == 200

    listed = await client.get(
        f"/api/v1/acquisitions/offers?mandate_id={mandate_id}", headers=headers
    )
    assert listed.status_code == 200
    assert {o["id"] for o in listed.json()["data"]} == {offer_id}

    submitted = await client.post(
        f"/api/v1/acquisitions/offers/{offer_id}/transition",
        headers=headers,
        json={"status": "submitted"},
    )
    assert submitted.status_code == 200
    assert submitted.json()["data"]["status"] == "submitted"
    assert submitted.json()["data"]["submitted_at"] is not None


async def test_offer_invalid_transition_409(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    headers = _headers(token)
    buyer_id = await _create_client(client, headers)
    prop_id = await _create_property(client, headers)
    mandate_id = (
        await client.post(
            "/api/v1/acquisitions/mandates",
            headers=headers,
            json={"buyer_client_id": buyer_id},
        )
    ).json()["data"]["id"]
    offer_id = (
        await client.post(
            "/api/v1/acquisitions/offers",
            headers=headers,
            json={"mandate_id": mandate_id, "property_id": prop_id, "amount": "1000000"},
        )
    ).json()["data"]["id"]

    # draft → accepted est interdit (il faut passer par submitted) → 409.
    resp = await client.post(
        f"/api/v1/acquisitions/offers/{offer_id}/transition",
        headers=headers,
        json={"status": "accepted"},
    )
    assert resp.status_code == 409, resp.text


async def test_offer_create_rejects_foreign_property(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    """Loi 1 : property_id hors tenant → 400."""
    _admin, token = seed_admin
    headers = _headers(token)
    buyer_id = await _create_client(client, headers)
    mandate_id = (
        await client.post(
            "/api/v1/acquisitions/mandates",
            headers=headers,
            json={"buyer_client_id": buyer_id},
        )
    ).json()["data"]["id"]

    resp = await client.post(
        "/api/v1/acquisitions/offers",
        headers=headers,
        json={
            "mandate_id": mandate_id,
            "property_id": str(uuid.uuid4()),
            "amount": "1000000",
        },
    )
    assert resp.status_code == 400, resp.text
    assert resp.json()["detail"] == "property_not_in_company"


async def test_tenant_isolation(
    client: AsyncClient,
    seed_admin: tuple[User, str],
    second_admin: tuple[Company, str],
) -> None:
    """Loi 1 : le mandat de seed_admin est invisible/inaccessible pour second_admin."""
    _admin, token_a = seed_admin
    _company_b, token_b = second_admin
    headers_a = _headers(token_a)
    headers_b = _headers(token_b)

    buyer_id = await _create_client(client, headers_a)
    mandate_id = (
        await client.post(
            "/api/v1/acquisitions/mandates",
            headers=headers_a,
            json={"buyer_client_id": buyer_id},
        )
    ).json()["data"]["id"]

    # Tenant B ne voit pas le mandat de A dans sa liste.
    listed_b = await client.get("/api/v1/acquisitions/mandates", headers=headers_b)
    assert listed_b.status_code == 200
    assert mandate_id not in {m["id"] for m in listed_b.json()["data"]}

    # Accès direct → 404 (anti-BOLA : ne révèle pas l'existence, jamais 403).
    got_b = await client.get(
        f"/api/v1/acquisitions/mandates/{mandate_id}", headers=headers_b
    )
    assert got_b.status_code == 404, got_b.text


async def test_bola_unknown_offer_404(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    headers = _headers(token)
    resp = await client.get(
        f"/api/v1/acquisitions/offers/{uuid.uuid4()}", headers=headers
    )
    assert resp.status_code == 404, resp.text


async def test_matches_endpoint_scores_properties(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    """Le moteur de rapprochement renvoie les biens du tenant scorés."""
    _admin, token = seed_admin
    headers = _headers(token)
    buyer_id = await _create_client(client, headers)

    # Un bien dans la fourchette, un hors fourchette (prix trop élevé).
    await _create_property(client, headers, price="1500000", type="apartment")
    await _create_property(client, headers, price="9000000", type="apartment")

    mandate_id = (
        await client.post(
            "/api/v1/acquisitions/mandates",
            headers=headers,
            json={
                "buyer_client_id": buyer_id,
                "budget_min": "1000000",
                "budget_max": "2000000",
                "property_type": "apartment",
            },
        )
    ).json()["data"]["id"]

    resp = await client.get(
        f"/api/v1/acquisitions/mandates/{mandate_id}/matches", headers=headers
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()["data"]
    # Le filtre prix exclut le bien à 9M → un seul match.
    assert len(data) == 1
    assert data[0]["match_score"] == 100
    assert "location" in data[0]
    assert data[0]["location"] is None  # WKB binaire jamais sérialisé


async def test_matches_unknown_mandate_404(
    client: AsyncClient, seed_admin: tuple[User, str]
) -> None:
    _admin, token = seed_admin
    headers = _headers(token)
    resp = await client.get(
        f"/api/v1/acquisitions/mandates/{uuid.uuid4()}/matches", headers=headers
    )
    assert resp.status_code == 404, resp.text
