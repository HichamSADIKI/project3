"""Niveaux d'assurance d'identité — socle « UAE PASS Infinity ».

Solution **maison** d'Infinity, *inspirée du modèle UAE PASS* (échelle SOP1/2/3)
mais **distincte** du UAE PASS gouvernemental : Infinity opère son propre IdP.
Ce module définit le **cœur du principe** :

1. l'échelle d'assurance d'une identité selon ce qui est **vérifié chez nous**
   (e‑mail, mobile, Emirates ID, contrôle renforcé) ;
2. la matrice **« action → niveau minimum requis »** (ex. signer ⇒ L2, comme un
   compte SOP2 chez UAE PASS).

Pur (sans DB), réutilisable par ``auth`` (step‑up), ``tenant_kyc`` (montée de
niveau), ``document_signature`` (gating de la signature). Câblage : phases
ultérieures (cf. docs/architecture/infinity-id.md).
"""

from __future__ import annotations

from pydantic import BaseModel

# Échelle d'assurance, ordonnée du plus faible au plus fort. Calquée sur SOP1/2/3.
ASSURANCE_LEVELS: tuple[str, ...] = ("L0", "L1", "L2", "L3")
_ORDER: dict[str, int] = {level: rank for rank, level in enumerate(ASSURANCE_LEVELS)}


class VerificationState(BaseModel):
    """Ce qui est vérifié pour une identité (alimenté par l'auth + le KYC)."""

    email_verified: bool = False
    mobile_verified: bool = False
    emirates_id_verified: bool = False
    # Contrôle renforcé : biométrie / liveness / vérification documentaire forte.
    strong_auth_verified: bool = False


def assurance_level(state: VerificationState) -> str:
    """Niveau d'assurance dérivé de l'état de vérification.

    - ``L3`` : e‑mail + mobile + Emirates ID + contrôle renforcé (≈ SOP3, signature qualifiée) ;
    - ``L2`` : e‑mail + mobile + Emirates ID (≈ SOP2, signature avancée) ;
    - ``L1`` : e‑mail + mobile (≈ SOP1, pas de signature) ;
    - ``L0`` : identité non encore prouvée.
    """
    if (
        state.email_verified
        and state.mobile_verified
        and state.emirates_id_verified
        and state.strong_auth_verified
    ):
        return "L3"
    if state.email_verified and state.mobile_verified and state.emirates_id_verified:
        return "L2"
    if state.email_verified and state.mobile_verified:
        return "L1"
    return "L0"


# Matrice « action → niveau minimum requis ». Centralise la politique d'accès par
# assurance (≠ RBAC : le RBAC dit le *rôle*, ceci dit le *niveau de preuve d'identité*).
ACTION_MIN_LEVEL: dict[str, str] = {
    "login": "L1",
    "view_portal": "L1",
    "submit_golden_visa": "L2",
    "sign_document": "L2",  # signature avancée (≈ SOP2)
    "sign_qualified": "L3",  # signature qualifiée (≈ SOP3)
    "change_owner_iban": "L3",
    "approve_payment": "L3",
}
# Niveau requis par défaut pour une action non listée (fail‑safe : au moins L1).
_DEFAULT_MIN_LEVEL = "L1"


def level_at_least(level: str, minimum: str) -> bool:
    """True si ``level`` est au moins ``minimum`` dans l'échelle d'assurance.

    Un niveau inconnu est traité comme le plus faible possible (fail‑safe) ; un
    minimum inconnu comme le plus exigeant (on n'autorise pas par défaut)."""
    return _ORDER.get(level, -1) >= _ORDER.get(minimum, len(ASSURANCE_LEVELS))


def min_level_for(action: str) -> str:
    """Niveau d'assurance minimum requis pour ``action``."""
    return ACTION_MIN_LEVEL.get(action, _DEFAULT_MIN_LEVEL)


def can_perform(level: str, action: str) -> bool:
    """True si une identité de niveau ``level`` peut effectuer ``action``."""
    return level_at_least(level, min_level_for(action))


def can_sign(level: str, *, qualified: bool = False) -> bool:
    """True si le niveau autorise la signature (avancée par défaut, ou qualifiée)."""
    return can_perform(level, "sign_qualified" if qualified else "sign_document")


def capabilities(level: str) -> dict[str, dict[str, object]]:
    """Pour un niveau donné, l'autorisation de chaque action connue + son seuil.

    Destiné au **soft-gating côté UI** (afficher/masquer un bouton) : il n'impose
    rien côté API. Forme : ``{action: {allowed: bool, required_level: str}}``."""
    return {
        action: {"allowed": level_at_least(level, required), "required_level": required}
        for action, required in ACTION_MIN_LEVEL.items()
    }
