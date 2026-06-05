"""Service — Échéancier & relances d'impayés (finance / dunning). Loi 1 partout.

Liste les factures impayées en retard (échéancier âgé, détail par facture) et
envoie des relances e-mail/WhatsApp au client (lié au CRM via
`related_client_id`). Chaque relance est journalisée (`DunningEvent`) avec un
niveau d'escalade calculé sur le retard :

  J+1   → niveau 1
  J+7   → niveau 2
  J+15  → niveau 3

Réutilise l'infrastructure de notification existante (`Notification`, livraison
Celery `app.tasks.notifications`).
"""

import uuid
from datetime import UTC, date, datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.dunning import DunningEvent
from app.models.finance import FinanceTransaction
from app.models.notification import Notification

# Seuils de retard (jours) → niveau d'escalade. Trié croissant.
DUNNING_THRESHOLDS: tuple[tuple[int, int], ...] = ((15, 3), (7, 2), (1, 1))

VALID_CHANNELS = ("email", "whatsapp", "in_app")


class DunningError(ValueError):
    """Erreur métier de relance (code lisible pour l'API)."""

    def __init__(self, code: str) -> None:
        self.code = code
        super().__init__(code)


# ── Helpers purs (sans DB) ─────────────────────────────────────────────────


def days_overdue(due_date: date | None, today: date) -> int:
    """Nombre de jours de retard (0 si pas d'échéance ou pas encore échu)."""
    if due_date is None:
        return 0
    delta = (today - due_date).days
    return delta if delta > 0 else 0


def dunning_level(days: int) -> int:
    """Niveau d'escalade (0 si pas en retard, sinon 1/2/3 selon les seuils)."""
    for threshold, level in DUNNING_THRESHOLDS:
        if days >= threshold:
            return level
    return 0


def should_escalate(current_level: int, last_sent_level: int) -> bool:
    """Vrai si une nouvelle relance automatique est due (niveau monté)."""
    return current_level > 0 and current_level > last_sent_level


def _client_name(client: Client | None) -> str | None:
    """Nom affichable d'un client (société ou prénom+nom)."""
    if client is None:
        return None
    if client.company_name:
        return client.company_name
    parts = [p for p in (client.first_name, client.last_name) if p]
    return " ".join(parts) if parts else None


def _reminder_message(reference: str, level: int, amount: object, currency: str) -> str:
    """Corps FR de la relance selon le niveau d'escalade."""
    tone = {
        1: "Rappel : votre facture {ref} ({amt} {cur}) est arrivée à échéance.",
        2: "Relance : votre facture {ref} ({amt} {cur}) reste impayée. Merci de régulariser.",
        3: "Dernière relance : la facture {ref} ({amt} {cur}) est en retard important.",
    }.get(level, "Rappel : facture {ref} ({amt} {cur}) impayée.")
    return tone.format(ref=reference, amt=amount, cur=currency)


# ── Échéancier détaillé (liste des impayés) ────────────────────────────────


async def list_overdue(
    db: AsyncSession, company_id: uuid.UUID, today: date | None = None
) -> list[dict[str, object]]:
    """Détail des factures impayées du tenant avec retard + résumé des relances."""
    today = today or datetime.now(UTC).date()

    rows = (
        await db.execute(
            select(FinanceTransaction, Client)
            .outerjoin(Client, FinanceTransaction.related_client_id == Client.id)
            .where(
                FinanceTransaction.company_id == company_id,
                FinanceTransaction.deleted_at.is_(None),
                FinanceTransaction.type == "invoice",
                FinanceTransaction.status.in_(("pending", "overdue")),
            )
            .order_by(FinanceTransaction.due_date.asc().nulls_last())
        )
    ).all()

    # Résumé des relances déjà envoyées par transaction (1 requête agrégée).
    txn_ids = [t.id for t, _ in rows]
    summary: dict[uuid.UUID, tuple[int, int, datetime | None]] = {}
    if txn_ids:
        agg = (
            await db.execute(
                select(
                    DunningEvent.transaction_id,
                    func.count(DunningEvent.id),
                    func.max(DunningEvent.level),
                    func.max(DunningEvent.created_at),
                )
                .where(
                    DunningEvent.company_id == company_id,
                    DunningEvent.transaction_id.in_(txn_ids),
                )
                .group_by(DunningEvent.transaction_id)
            )
        ).all()
        summary = {tid: (cnt, lvl or 0, last) for tid, cnt, lvl, last in agg}

    result: list[dict[str, object]] = []
    for txn, client in rows:
        days = days_overdue(txn.due_date, today)
        cnt, last_level, last_at = summary.get(txn.id, (0, 0, None))
        result.append(
            {
                "id": txn.id,
                "reference": txn.reference,
                "amount": txn.amount,
                "currency": txn.currency,
                "due_date": txn.due_date,
                "status": txn.status,
                "client_id": txn.related_client_id,
                "client_name": _client_name(client),
                "client_email": client.email if client else None,
                "client_phone": client.phone if client else None,
                "days_overdue": days,
                "level": dunning_level(days),
                "reminders_sent": cnt,
                "last_reminder_level": last_level,
                "last_reminder_at": last_at,
            }
        )
    return result


# ── Envoi d'une relance (manuel) ───────────────────────────────────────────


async def send_reminder(
    db: AsyncSession,
    company_id: uuid.UUID,
    txn_id: uuid.UUID,
    channel: str,
    today: date | None = None,
) -> DunningEvent:
    """Envoie une relance pour une facture impayée et la journalise (Loi 1)."""
    if channel not in VALID_CHANNELS:
        raise DunningError("invalid_channel")

    today = today or datetime.now(UTC).date()

    txn = (
        await db.execute(
            select(FinanceTransaction).where(
                FinanceTransaction.id == txn_id,
                FinanceTransaction.company_id == company_id,
                FinanceTransaction.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if txn is None:
        raise DunningError("transaction_not_found")
    if txn.type != "invoice":
        raise DunningError("not_an_invoice")
    if txn.status not in ("pending", "overdue"):
        raise DunningError("not_unpaid")

    days = days_overdue(txn.due_date, today)
    if days <= 0:
        raise DunningError("not_overdue")
    level = dunning_level(days)

    client: Client | None = None
    if txn.related_client_id is not None:
        client = (
            await db.execute(
                select(Client).where(
                    Client.id == txn.related_client_id,
                    Client.company_id == company_id,
                    Client.deleted_at.is_(None),
                )
            )
        ).scalar_one_or_none()

    recipient = None
    if client is not None:
        recipient = client.email if channel == "email" else (client.phone or client.email)

    message = _reminder_message(txn.reference, level, txn.amount, txn.currency)

    # Notification (canal demandé) — livrée par l'infra existante.
    notif = Notification(
        company_id=company_id,
        recipient_party_id=txn.related_client_id,
        type="invoice_overdue",
        channel=channel,
        title=f"Relance facture {txn.reference}",
        body=message,
        payload={"transaction_id": str(txn.id), "level": level},
        status="pending",
    )
    db.add(notif)

    event = DunningEvent(
        company_id=company_id,
        transaction_id=txn.id,
        channel=channel,
        level=level,
        recipient=recipient,
        message=message,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return event
