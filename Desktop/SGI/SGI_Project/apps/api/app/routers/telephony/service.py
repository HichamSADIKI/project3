"""Service Téléphonie.

Deux couches :
- **Helpers purs** (sans DB) : machines à états appel/agent, génération de
  référence, calculs de durée, mapping des events AMI. Testables partout.
- **Fonctions DB** : toujours filtrées par company_id (Loi 1).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.routers.telephony.models import AgentState, Call

# ─────────────────────────────────────────────────────────────────────────
# Helpers purs — machine à états APPEL
# ─────────────────────────────────────────────────────────────────────────

CALL_STATUSES: frozenset[str] = frozenset(
    {"ringing", "answered", "completed", "missed", "busy",
     "no_answer", "failed", "cancelled"}
)

TERMINAL_CALL_STATUSES: frozenset[str] = frozenset(
    {"completed", "missed", "busy", "no_answer", "failed", "cancelled"}
)

# Transitions autorisées. Un appel naît `ringing`, est décroché (`answered`)
# puis se termine (`completed`), ou échoue depuis la sonnerie.
_CALL_TRANSITIONS: dict[str, frozenset[str]] = {
    "ringing": frozenset(
        {"answered", "missed", "busy", "no_answer", "failed", "cancelled"}
    ),
    "answered": frozenset({"completed", "failed"}),
    # États terminaux : aucune sortie.
    "completed": frozenset(),
    "missed": frozenset(),
    "busy": frozenset(),
    "no_answer": frozenset(),
    "failed": frozenset(),
    "cancelled": frozenset(),
}


def is_terminal_call_status(status: str) -> bool:
    return status in TERMINAL_CALL_STATUSES


def is_valid_call_transition(current: str, target: str) -> bool:
    """True si `current → target` est une transition d'appel autorisée."""
    if current not in CALL_STATUSES or target not in CALL_STATUSES:
        return False
    return target in _CALL_TRANSITIONS.get(current, frozenset())


# ─────────────────────────────────────────────────────────────────────────
# Helpers purs — machine à états AGENT
# ─────────────────────────────────────────────────────────────────────────

AGENT_STATUSES: frozenset[str] = frozenset(
    {"offline", "available", "busy", "wrap_up", "paused"}
)

_AGENT_TRANSITIONS: dict[str, frozenset[str]] = {
    "offline": frozenset({"available"}),
    "available": frozenset({"busy", "paused", "offline"}),
    "busy": frozenset({"wrap_up", "available", "offline"}),
    "wrap_up": frozenset({"available", "paused", "offline"}),
    "paused": frozenset({"available", "offline"}),
}


def is_valid_agent_transition(current: str, target: str) -> bool:
    """True si `current → target` est une transition d'état agent autorisée."""
    if current not in AGENT_STATUSES or target not in AGENT_STATUSES:
        return False
    if current == target:
        return False
    return target in _AGENT_TRANSITIONS.get(current, frozenset())


# ─────────────────────────────────────────────────────────────────────────
# Helpers purs — référence & durées
# ─────────────────────────────────────────────────────────────────────────


def generate_reference(year: int, sequence: int) -> str:
    """Référence lexicographiquement triable : `CALL-2026-000042`."""
    return f"CALL-{year:04d}-{sequence:06d}"


def compute_wait(started_at: datetime | None, answered_at: datetime | None) -> int | None:
    """Secondes d'attente (sonnerie/file) avant décroché. None si incomplet."""
    if started_at is None or answered_at is None:
        return None
    return max(0, int((answered_at - started_at).total_seconds()))


def compute_duration(
    answered_at: datetime | None, ended_at: datetime | None
) -> int | None:
    """Durée de conversation (talk time) en secondes. None si non décroché."""
    if answered_at is None or ended_at is None:
        return None
    return max(0, int((ended_at - answered_at).total_seconds()))


def map_hangup_to_status(answered: bool, direction: str, cause: str | None) -> str:
    """Mappe une fin d'appel Asterisk vers un statut terminal.

    `answered` : l'appel a-t-il été décroché ? `cause` : Asterisk hangup cause
    (texte ou code). Pur, utilisé par le pont AMI.
    """
    if answered:
        return "completed"
    c = (cause or "").lower()
    if "busy" in c:
        return "busy"
    if "cancel" in c:
        return "cancelled"
    if "congestion" in c or "fail" in c or "unavailable" in c:
        return "failed"
    # Non décroché : entrant = manqué, sortant/interne = pas de réponse.
    return "missed" if direction == "inbound" else "no_answer"


def infer_call_direction(
    caller_number: str | None, internal_extensions: set[str]
) -> str:
    """Classe un appel entrant AMI : `internal` si l'appelant est une extension
    connue du tenant, sinon `inbound` (appelant externe). Pur.

    (Les sortants click-to-call sont créés en `outbound` côté REST et réutilisés
    par l'AMI sans changer de direction.)
    """
    if caller_number and caller_number in internal_extensions:
        return "internal"
    return "inbound"


# ─────────────────────────────────────────────────────────────────────────
# Fonctions DB — toujours filtrées par company_id (Loi 1)
# ─────────────────────────────────────────────────────────────────────────


async def next_reference(db: AsyncSession, company_id: uuid.UUID) -> str:
    """Référence d'appel suivante pour l'année courante (par tenant)."""
    year = datetime.now(UTC).year
    result = await db.execute(
        select(func.count())
        .select_from(Call)
        .where(
            Call.company_id == company_id,
            Call.reference.like(f"CALL-{year:04d}-%"),
        )
    )
    count = result.scalar_one()
    return generate_reference(year, count + 1)


async def create_call(
    db: AsyncSession,
    company_id: uuid.UUID,
    *,
    direction: str,
    from_number: str | None = None,
    to_number: str | None = None,
    status: str = "ringing",
    agent_user_id: uuid.UUID | None = None,
    agent_extension: str | None = None,
    client_id: uuid.UUID | None = None,
    queue: str | None = None,
    channel_id: str | None = None,
    sip_call_id: str | None = None,
    recording_consent: bool = False,
    started_at: datetime | None = None,
) -> Call:
    """Crée une entrée d'appel. La référence est générée côté tenant."""
    call = Call(
        company_id=company_id,
        reference=await next_reference(db, company_id),
        direction=direction,
        status=status,
        from_number=from_number,
        to_number=to_number,
        agent_user_id=agent_user_id,
        agent_extension=agent_extension,
        client_id=client_id,
        queue=queue,
        channel_id=channel_id,
        sip_call_id=sip_call_id,
        recording_consent=recording_consent,
        started_at=started_at or datetime.now(UTC),
    )
    db.add(call)
    await db.commit()
    await db.refresh(call)
    return call


async def get_call(
    db: AsyncSession, company_id: uuid.UUID, call_id: uuid.UUID
) -> Call | None:
    result = await db.execute(
        select(Call).where(Call.id == call_id, Call.company_id == company_id)
    )
    return result.scalar_one_or_none()


async def list_calls(
    db: AsyncSession,
    company_id: uuid.UUID,
    page: int = 1,
    limit: int = 20,
    direction: str | None = None,
    status: str | None = None,
    agent_user_id: uuid.UUID | None = None,
    client_id: uuid.UUID | None = None,
) -> tuple[list[Call], int]:
    base = select(Call).where(Call.company_id == company_id)
    if direction:
        base = base.where(Call.direction == direction)
    if status:
        base = base.where(Call.status == status)
    if agent_user_id:
        base = base.where(Call.agent_user_id == agent_user_id)
    if client_id:
        base = base.where(Call.client_id == client_id)

    total = (
        await db.execute(select(func.count()).select_from(base.subquery()))
    ).scalar_one()
    offset = (page - 1) * limit
    rows = (
        await db.execute(
            base.order_by(Call.started_at.desc().nullslast()).offset(offset).limit(limit)
        )
    ).scalars().all()
    return list(rows), total


async def transition_call(
    db: AsyncSession,
    company_id: uuid.UUID,
    call_id: uuid.UUID,
    new_status: str,
    *,
    hangup_cause: str | None = None,
) -> Call | None:
    """Applique une transition de statut validée + recalcule les durées.

    Retourne None si l'appel n'existe pas. Lève ValueError si la transition est
    invalide (mappé en 409 par le router).
    """
    call = await get_call(db, company_id, call_id)
    if call is None:
        return None
    if not is_valid_call_transition(call.status, new_status):
        raise ValueError(f"invalid_transition:{call.status}->{new_status}")

    now = datetime.now(UTC)
    if new_status == "answered" and call.answered_at is None:
        call.answered_at = now
        call.wait_seconds = compute_wait(call.started_at, call.answered_at)
    if is_terminal_call_status(new_status):
        call.ended_at = now
        call.duration_seconds = compute_duration(call.answered_at, call.ended_at)
        if hangup_cause:
            call.hangup_cause = hangup_cause

    call.status = new_status
    call.updated_at = now
    await db.commit()
    await db.refresh(call)
    return call


# ── CDR via AMI — get-or-create idempotent + cycle de vie ─────────────────


async def get_call_by_channel(
    db: AsyncSession, company_id: uuid.UUID, channel_id: str
) -> Call | None:
    result = await db.execute(
        select(Call).where(
            Call.company_id == company_id, Call.channel_id == channel_id
        )
    )
    return result.scalar_one_or_none()


async def get_or_create_call_by_channel(
    db: AsyncSession,
    company_id: uuid.UUID,
    channel_id: str,
    **defaults: Any,
) -> tuple[Call, bool]:
    """Récupère le CDR (company_id, channel_id) ou le crée. Idempotent.

    Sûr sous plusieurs réplicas (listener AMI par process) : la contrainte
    unique `uq_calls_company_channel` arbitre les races ; en cas de
    IntegrityError concurrente, on re-fetch la ligne gagnante. Retourne
    (call, created).
    """
    existing = await get_call_by_channel(db, company_id, channel_id)
    if existing is not None:
        return existing, False

    call = Call(
        company_id=company_id,
        reference=await next_reference(db, company_id),
        channel_id=channel_id,
        direction=defaults.get("direction", "inbound"),
        status=defaults.get("status", "ringing"),
        from_number=defaults.get("from_number"),
        to_number=defaults.get("to_number"),
        agent_extension=defaults.get("agent_extension"),
        recording_consent=defaults.get("recording_consent", False),
        started_at=defaults.get("started_at") or datetime.now(UTC),
    )
    db.add(call)
    try:
        await db.commit()
        await db.refresh(call)
        return call, True
    except IntegrityError:
        # Course perdue contre un autre réplica → la ligne gagnante existe.
        await db.rollback()
        winner = await get_call_by_channel(db, company_id, channel_id)
        if winner is None:  # pragma: no cover — incohérence improbable
            raise
        return winner, False


# Mapping event AMI → transition CDR (None = pas de transition).
def _ami_target_status(current: str, ami_event: str, channel_state: str | None,
                       direction: str, cause: str | None) -> str | None:
    if ami_event == "Newstate" and channel_state == "Up":
        return "answered"
    if ami_event == "Hangup":
        answered = current == "answered"
        return map_hangup_to_status(answered, direction, cause)
    return None


async def apply_ami_cdr(
    db: AsyncSession, company_id: uuid.UUID, event: dict[str, Any]
) -> Call | None:
    """Crée/met à jour le CDR d'un appel à partir d'un event AMI normalisé.

    Identité d'appel = `Linkedid` (regroupe les deux pattes ; pour un sortant
    click-to-call, Linkedid == le ChannelId `sgi-…` déjà posé par REST → le CDR
    existant est réutilisé, pas de doublon). Consommateur de fond privilégié
    (cross-tenant) — filtré explicitement par company_id (Loi 1).
    """
    data = event.get("data", {})
    channel_id = data.get("linkedid") or data.get("uniqueid")
    extension = event.get("extension")
    if not channel_id:
        return None

    # Classe entrant vs interne d'après l'appelant (extension connue du tenant ?).
    caller = data.get("caller_number")
    internal_exts = set(
        (
            await db.execute(
                select(AgentState.extension).where(
                    AgentState.company_id == company_id,
                    AgentState.extension.isnot(None),
                )
            )
        ).scalars().all()
    )
    direction = infer_call_direction(caller, internal_exts)

    call, _created = await get_or_create_call_by_channel(
        db,
        company_id,
        channel_id,
        direction=direction,
        from_number=caller,
        to_number=extension,
        agent_extension=extension,
        # PDPL fail-closed : pas de consentement présumé sans signal explicite
        # (cf. TELEPHONY_ASSUME_RECORDING_CONSENT). Sans consentement, le worker
        # n'uploade pas l'enregistrement et l'URL n'est jamais exposée.
        recording_consent=settings.TELEPHONY_ASSUME_RECORDING_CONSENT,
    )

    target = _ami_target_status(
        call.status, data.get("ami_event", ""), data.get("channel_state"),
        call.direction, data.get("cause"),
    )
    if target and target != call.status and is_valid_call_transition(call.status, target):
        try:
            return await transition_call(
                db, company_id, call.id, target, hangup_cause=data.get("cause")
            )
        except ValueError:
            return call
    return call


# ── Présence agent ──────────────────────────────────────────────────────


async def get_agent_state(
    db: AsyncSession, company_id: uuid.UUID, user_id: uuid.UUID
) -> AgentState | None:
    result = await db.execute(
        select(AgentState).where(
            AgentState.company_id == company_id, AgentState.user_id == user_id
        )
    )
    return result.scalar_one_or_none()


async def set_agent_status(
    db: AsyncSession,
    company_id: uuid.UUID,
    user_id: uuid.UUID,
    new_status: str,
    *,
    extension: str | None = None,
) -> AgentState:
    """Crée ou met à jour l'état d'un agent (upsert). Valide la transition si
    l'agent existe déjà ; lève ValueError sinon."""
    state = await get_agent_state(db, company_id, user_id)
    now = datetime.now(UTC)
    if state is None:
        state = AgentState(
            company_id=company_id,
            user_id=user_id,
            extension=extension,
            status=new_status,
            last_changed_at=now,
        )
        db.add(state)
    else:
        if state.status != new_status and not is_valid_agent_transition(
            state.status, new_status
        ):
            raise ValueError(f"invalid_transition:{state.status}->{new_status}")
        state.status = new_status
        if extension is not None:
            state.extension = extension
        state.last_changed_at = now
        state.updated_at = now
    try:
        await db.commit()
    except IntegrityError as exc:
        # Extension déjà attribuée à un autre agent du tenant
        # (uq_agent_states_extension) → 409 plutôt que 500.
        await db.rollback()
        raise ValueError("extension_taken") from exc
    await db.refresh(state)
    return state


async def list_agent_states(
    db: AsyncSession, company_id: uuid.UUID, status: str | None = None
) -> list[AgentState]:
    base = select(AgentState).where(AgentState.company_id == company_id)
    if status:
        base = base.where(AgentState.status == status)
    rows = (await db.execute(base.order_by(AgentState.status))).scalars().all()
    return list(rows)


# ── Screen pop : résolution client par numéro ─────────────────────────────


async def find_clients_by_phone(
    db: AsyncSession, company_id: uuid.UUID, phone: str
) -> list:
    """Clients du tenant dont phone/phone2 matche (screen pop sur appel entrant).

    Matche sur les derniers chiffres pour tolérer les variations de format
    (préfixe pays, espaces). Filtre tenant + soft-delete (Loi 1).
    """
    from app.models.client import Client

    digits = "".join(c for c in phone if c.isdigit())
    # Compare les 9 derniers chiffres (numéro national UAE) pour ignorer les
    # variations de préfixe international (+971 / 00971 / 0).
    suffix = digits[-9:] if len(digits) >= 9 else digits
    if not suffix:
        return []
    pattern = f"%{suffix}"
    result = await db.execute(
        select(Client).where(
            Client.company_id == company_id,
            Client.deleted_at.is_(None),
            or_(Client.phone.like(pattern), Client.phone2.like(pattern)),
        ).limit(10)
    )
    return list(result.scalars().all())
