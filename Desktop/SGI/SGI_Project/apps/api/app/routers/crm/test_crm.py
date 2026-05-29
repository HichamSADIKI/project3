from app.routers.crm.service import generate_reference


# TODO: tests pytest-asyncio pour crm (CRUD + transitions pipeline)
# Coverage minimum requis : 80%


def test_generate_reference_format() -> None:
    """Format CRM-YYYY-NNNNNN, séquence sur 6 chiffres triable."""
    assert generate_reference(2026, 1) == "CRM-2026-000001"
    assert generate_reference(2026, 1847) == "CRM-2026-001847"


def test_generate_reference_is_lexicographically_sortable() -> None:
    refs = [generate_reference(2026, n) for n in (3, 1, 2, 100)]
    assert sorted(refs) == [
        generate_reference(2026, 1),
        generate_reference(2026, 2),
        generate_reference(2026, 3),
        generate_reference(2026, 100),
    ]
