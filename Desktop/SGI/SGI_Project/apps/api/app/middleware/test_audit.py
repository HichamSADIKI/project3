"""Tests unitaires du parsing d'audit (helpers purs, sans DB)."""

import uuid

from app.middleware.audit import _is_uuid, _parse_target

UID = str(uuid.uuid4())


def test_parse_create_on_collection():
    assert _parse_target("/api/v1/properties", "POST") == ("properties", None, "create")


def test_parse_update_with_id():
    assert _parse_target(f"/api/v1/properties/{UID}", "PATCH") == (
        "properties",
        UID,
        "update",
    )


def test_parse_put_with_id():
    assert _parse_target(f"/api/v1/units/{UID}", "PUT") == ("units", UID, "update")


def test_parse_delete_with_id():
    assert _parse_target(f"/api/v1/units/{UID}", "DELETE") == ("units", UID, "delete")


def test_parse_post_subaction_takes_precedence():
    # POST /pdc/{id}/deposit → l'action métier prime sur 'create'
    assert _parse_target(f"/api/v1/pdc/{UID}/deposit", "POST") == ("pdc", UID, "deposit")


def test_parse_patch_subaction_is_concatenated():
    assert _parse_target(f"/api/v1/tenants/{UID}/status", "PATCH") == (
        "tenants",
        UID,
        "update:status",
    )


def test_parse_collection_subroute():
    # POST /properties/search → sous-route non-UUID, pas d'id
    assert _parse_target("/api/v1/properties/search", "POST") == (
        "properties",
        None,
        "search",
    )


def test_parse_handles_missing_v1_prefix():
    resource, rid, action = _parse_target("/properties", "POST")
    assert resource == "properties" and rid is None and action == "create"


def test_is_uuid():
    assert _is_uuid(UID) is True
    assert _is_uuid("deposit") is False
    assert _is_uuid("123") is False
