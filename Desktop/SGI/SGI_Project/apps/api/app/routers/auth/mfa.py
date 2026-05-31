"""Service MFA TOTP — helpers purs + CRUD.

Sécurité :
- Le secret TOTP est chiffré en base via Fernet (clé dérivée de SECRET_KEY).
  Un attaquant ayant accès à la DB ne peut pas reconstituer les codes TOTP.
- Le QR code URI est retourné UNE seule fois (setup). Après activation, le
  secret n'est jamais renvoyé en clair.
- `tmp_token` : JWT court-vécu (5 min), claim `mfa_pending=true` — ne donne
  accès à aucune ressource protégée jusqu'à la validation du code TOTP.
"""

from __future__ import annotations

import base64

import pyotp
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.core.config import settings

# Domaine de dérivation : isole la clé de chiffrement MFA des autres usages
# éventuels de SECRET_KEY (signature JWT, etc.).
_MFA_HKDF_INFO = b"sgi-mfa-totp-encryption-v1"


# ── Chiffrement du secret TOTP ────────────────────────────────────────────


def _fernet() -> Fernet:
    """Instancie Fernet avec une clé dérivée de SECRET_KEY via HKDF-SHA256.

    `settings.SECRET_KEY` est un champ obligatoire (aucun défaut) : l'absence
    de secret empêche le démarrage de l'application — pas de clé codée en dur.
    La dérivation est déterministe → un secret TOTP chiffré reste déchiffrable.
    """
    derived = HKDF(
        algorithm=hashes.SHA256(),
        length=32,
        salt=None,
        info=_MFA_HKDF_INFO,
    ).derive(settings.SECRET_KEY.encode())
    return Fernet(base64.urlsafe_b64encode(derived))


def encrypt_secret(plain: str) -> str:
    """Chiffre le secret TOTP pour stockage en base."""
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_secret(encrypted: str) -> str:
    """Déchiffre le secret TOTP depuis la base."""
    return _fernet().decrypt(encrypted.encode()).decode()


# ── Génération & vérification TOTP ───────────────────────────────────────


def generate_totp_secret() -> str:
    """Génère un secret TOTP aléatoire (base32, 32 chars)."""
    return pyotp.random_base32()


def generate_provisioning_uri(secret: str, email: str, issuer: str = "SGI ERP") -> str:
    """Génère l'URI otpauth:// pour le QR code."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)


def verify_totp(secret: str, code: str, valid_window: int = 1) -> bool:
    """Vérifie un code TOTP (fenêtre ±1 intervalle pour la dérive d'horloge).

    valid_window=1 tolère ±30 s de dérive (1 intervalle avant/après).
    """
    if not secret or not code:
        return False
    totp = pyotp.TOTP(secret)
    return totp.verify(code, valid_window=valid_window)
