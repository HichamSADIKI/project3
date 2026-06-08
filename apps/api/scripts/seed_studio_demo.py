"""Seed démo — Studio de Modules (catégorie « Développement »).

Peuple les écrans du Studio avec des modules conçus dans des états variés (draft,
audited, pr_open, integrated, failed), leurs schémas de feuille (lite), des demandes
d'intégration 4-eyes (une active, une expirée), des jobs d'orchestrateur (un réussi
avec PR, un échoué), et quelques `audit_logs` sécu pour peupler le superviseur.

Tables PLATEFORME (sans company_id) → pas de RLS. Idempotent (clé = `studio_modules.key` ;
marqueur audit `user_email='studio-demo@seed'`).

Lancer : docker compose exec -e PYTHONPATH=/app api uv run python scripts/seed_studio_demo.py
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.database import async_session_maker
from app.models.audit_log import AuditLog
from app.models.company import Company
from app.models.studio import StudioIntegrationRequest, StudioModule, StudioOrchestratorJob

AUDIT_SENTINEL = "studio-demo@seed"


def _field(fid: str, ftype: str, en: str, fr: str, ar: str, **extra: object) -> dict[str, object]:
    return {"id": fid, "type": ftype, "label_en": en, "label_fr": fr, "label_ar": ar, **extra}


def _schema(title_en: str, elements: list[dict[str, object]]) -> dict[str, object]:
    return {
        "schema_version": 1,
        "sheets": [
            {
                "id": "main",
                "title_ar": title_en,
                "title_en": title_en,
                "title_fr": title_en,
                "elements": elements,
            }
        ],
    }


# (key, title_en/fr/ar, flavor, mode, state, schema, is_integrated)
_MODULES: list[tuple[str, tuple[str, str, str], str, str, str, dict[str, object], bool]] = [
    (
        "studio.complaints",
        ("Tenant complaints", "Plaintes locataires", "شكاوى المستأجرين"),
        "lite",
        "ai",
        "integrated",
        _schema(
            "Complaint",
            [
                _field("subject", "text", "Subject", "Objet", "الموضوع", required=True),
                _field(
                    "severity",
                    "select",
                    "Severity",
                    "Gravité",
                    "الخطورة",
                    options=[
                        {
                            "value": "low",
                            "label_en": "Low",
                            "label_fr": "Faible",
                            "label_ar": "منخفض",
                        },
                        {
                            "value": "high",
                            "label_en": "High",
                            "label_fr": "Élevée",
                            "label_ar": "عالٍ",
                        },
                    ],
                ),
                _field("details", "textarea", "Details", "Détails", "تفاصيل"),
                _field("resolved", "checkbox", "Resolved", "Résolu", "تم الحل"),
                _field("submit", "button", "Submit", "Envoyer", "إرسال", action="submit"),
            ],
        ),
        True,
    ),
    (
        "studio.visitors",
        ("Visitor log", "Registre visiteurs", "سجل الزوار"),
        "lite",
        "manual",
        "audited",
        _schema(
            "Visitor",
            [
                _field("name", "text", "Name", "Nom", "الاسم", required=True),
                _field("visit_date", "date", "Visit date", "Date de visite", "تاريخ الزيارة"),
                _field("badge", "text", "Badge #", "Badge n°", "رقم الشارة"),
            ],
        ),
        False,
    ),
    (
        "studio.signage",
        ("Signage requests", "Demandes de signalétique", "طلبات اللافتات"),
        "lite",
        "manual",
        "audited",
        _schema(
            "Signage",
            [_field("location", "text", "Location", "Emplacement", "الموقع", required=True)],
        ),
        False,
    ),
    (
        "studio.feedback",
        ("Customer feedback", "Retours clients", "ملاحظات العملاء"),
        "lite",
        "ai",
        "draft",
        _schema(
            "Feedback",
            [
                _field("rating", "number", "Rating", "Note", "التقييم"),
                _field("comment", "textarea", "Comment", "Commentaire", "تعليق"),
            ],
        ),
        False,
    ),
    (
        "studio.inventory",
        ("Equipment inventory", "Inventaire matériel", "جرد المعدات"),
        "code",
        "manual",
        "pr_open",
        _schema(
            "Inventory",
            [
                _field("name", "text", "Name", "Nom", "الاسم", required=True),
                _field("quantity", "number", "Quantity", "Quantité", "الكمية"),
                _field("acquired", "date", "Acquired", "Acquis le", "تاريخ الاقتناء"),
            ],
        ),
        False,
    ),
    (
        "studio.assets",
        ("Asset tracking", "Suivi des actifs", "تتبّع الأصول"),
        "code",
        "manual",
        "failed",
        _schema("Asset", [_field("tag", "text", "Tag", "Étiquette", "الوسم", required=True)]),
        False,
    ),
]


async def main() -> None:
    async with async_session_maker() as s:
        created_keys: set[str] = set()
        by_key: dict[str, StudioModule] = {}

        for key, (ten, tfr, tar), flavor, mode, state, schema, integrated in _MODULES:
            existing = (
                await s.execute(select(StudioModule).where(StudioModule.key == key))
            ).scalar_one_or_none()
            if existing is not None:
                by_key[key] = existing
                continue
            m = StudioModule(
                key=key,
                title_en=ten,
                title_fr=tfr,
                title_ar=tar,
                flavor=flavor,
                mode=mode,
                state=state,
                schema_json=schema,
                is_integrated=integrated,
            )
            if flavor == "code":
                m.pr_url = "https://github.com/HichamSADIKI/project3/pull/0"
            s.add(m)
            await s.flush()
            by_key[key] = m
            created_keys.add(key)

        now = datetime.now(UTC)

        # ── Demandes d'intégration 4-eyes (active + expirée) ──
        if "studio.visitors" in created_keys:
            s.add(
                StudioIntegrationRequest(
                    module_id=by_key["studio.visitors"].id,
                    requested_by=uuid.uuid4(),
                    reason="Mise en service du registre visiteurs",
                    ticket_ref="JIRA-1042",
                    status="pending",
                    expires_at=now + timedelta(minutes=45),
                )
            )
        if "studio.signage" in created_keys:
            s.add(
                StudioIntegrationRequest(
                    module_id=by_key["studio.signage"].id,
                    requested_by=uuid.uuid4(),
                    reason="Demande expirée (démo)",
                    ticket_ref="JIRA-1009",
                    status="pending",
                    expires_at=now - timedelta(hours=2),  # expirée
                )
            )

        # ── Jobs d'orchestrateur (réussi avec PR + échoué) ──
        if "studio.inventory" in created_keys:
            s.add(
                StudioOrchestratorJob(
                    module_id=by_key["studio.inventory"].id,
                    status="done",
                    phase="done",
                    branch_name="studio/gen-studio_inventory",
                    pr_url="https://github.com/HichamSADIKI/project3/pull/0",
                    pr_number=0,
                    detail="pr_open",
                )
            )
        if "studio.assets" in created_keys:
            s.add(
                StudioOrchestratorJob(
                    module_id=by_key["studio.assets"].id,
                    status="failed",
                    phase="radar",
                    branch_name="studio/gen-studio_assets",
                    detail="ruff_failed",
                    radar_report={"ruff_check_ok": False},
                )
            )

        # ── Événements sécu (pour le superviseur) — idempotent via sentinelle ──
        already = (
            await s.execute(
                select(AuditLog.id).where(AuditLog.user_email == AUDIT_SENTINEL).limit(1)
            )
        ).scalar_one_or_none()
        if already is None:
            demo_company = (await s.execute(select(Company).limit(1))).scalar_one_or_none()
            cid = demo_company.id if demo_company is not None else uuid.uuid4()
            for action, res, ip in [
                ("self_defense:code_fail", "self_defense", "203.0.113.7"),
                ("self_defense:locked", "self_defense", "203.0.113.7"),
                ("honeytoken:access", "honeytokens", "198.51.100.23"),
                ("honeytoken:access", "honeytokens", "198.51.100.99"),
                ("studio:build_dry_run", "studio_module", "10.0.0.5"),
                ("studio:integration.requested", "studio_module", "10.0.0.5"),
            ]:
                s.add(
                    AuditLog(
                        company_id=cid,
                        user_email=AUDIT_SENTINEL,
                        action=action,
                        resource=res,
                        changes={},
                        ip_address=ip,
                    )
                )

        await s.commit()
        print(
            f"✓ Studio demo : {len(created_keys)} module(s) créé(s) "
            f"({', '.join(sorted(created_keys)) or 'aucun (déjà présents)'})."
        )


if __name__ == "__main__":
    asyncio.run(main())
