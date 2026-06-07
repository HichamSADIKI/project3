"""Vérification OAuth/OIDC des providers sociaux (Google · Apple).

Frontière réseau ISOLÉE : la fonction publique `resolve_identity` est le seul
point d'entrée appelé par le router. Les tests la monkeypatchent pour fournir une
identité contrôlée sans dépendre de Google/Apple (la logique sensible — matching
du compte interne, scoping société — est testée côté `service.social_authenticate`).

Sécurité :
- `id_token` vérifié par signature JWKS du provider + `aud` (notre client id) +
  `iss` attendu + `exp`. Jamais de confiance dans un token non signé.
- Seuls les providers réellement configurés (`provider_enabled`) sont acceptés.
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

import httpx
from jose import jwt  # type: ignore[import-untyped]

from app.core.config import settings

# ── Endpoints providers ──────────────────────────────────────────────────────
_GOOGLE_TOKEN = "https://oauth2.googleapis.com/token"  # noqa: S105  URL, pas un secret
_GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs"
_GOOGLE_ISSUERS = ("https://accounts.google.com", "accounts.google.com")

_APPLE_TOKEN = "https://appleid.apple.com/auth/token"  # noqa: S105  URL, pas un secret
_APPLE_JWKS = "https://appleid.apple.com/auth/keys"
_APPLE_ISSUER = "https://appleid.apple.com"

_HTTP_TIMEOUT = 10.0


class OAuthError(Exception):
    """Échec de vérification OAuth (token invalide, provider injoignable…)."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


@dataclass(frozen=True)
class Identity:
    """Identité vérifiée renvoyée par un provider."""

    email: str
    subject: str
    email_verified: bool


def provider_enabled(provider: str) -> bool:
    """True si les credentials du provider sont configurés côté settings."""
    if provider == "google":
        return bool(settings.GOOGLE_OAUTH_CLIENT_ID and settings.GOOGLE_OAUTH_CLIENT_SECRET)
    if provider == "apple":
        return bool(
            settings.APPLE_OAUTH_CLIENT_ID
            and settings.APPLE_OAUTH_TEAM_ID
            and settings.APPLE_OAUTH_KEY_ID
            and settings.APPLE_OAUTH_PRIVATE_KEY
        )
    return False


def _as_bool(value: object) -> bool:
    return value is True or value in ("true", "True", "1", 1)


async def _fetch_jwks(url: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as http:
        resp = await http.get(url)
    if resp.status_code != 200:
        raise OAuthError("jwks_unavailable")
    data: dict[str, Any] = resp.json()
    return data


def _verify_id_token(
    id_token: str, jwks: dict[str, Any], *, audience: str, issuers: tuple[str, ...]
) -> dict[str, Any]:
    """Vérifie signature (JWKS) + aud + exp ; valide l'iss manuellement."""
    try:
        header = jwt.get_unverified_header(id_token)
        key = next((k for k in jwks.get("keys", []) if k.get("kid") == header.get("kid")), None)
        if key is None:
            raise OAuthError("jwks_kid_unknown")
        claims: dict[str, Any] = jwt.decode(
            id_token,
            key,
            algorithms=[key.get("alg", "RS256")],
            audience=audience,
            options={"verify_at_hash": False},
        )
    except OAuthError:
        raise
    except Exception as exc:  # signature/exp/aud invalides
        raise OAuthError("id_token_invalid") from exc
    if claims.get("iss") not in issuers:
        raise OAuthError("id_token_bad_issuer")
    return claims


async def _exchange_code(
    token_url: str, *, code: str, client_id: str, client_secret: str, redirect_uri: str
) -> str:
    """Échange un code d'autorisation contre l'id_token (grant authorization_code)."""
    data = {
        "code": code,
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as http:
        resp = await http.post(token_url, data=data)
    if resp.status_code != 200:
        raise OAuthError("code_exchange_failed")
    id_token = resp.json().get("id_token")
    if not id_token:
        raise OAuthError("id_token_missing")
    return str(id_token)


def _apple_client_secret() -> str:
    """Génère le client_secret Apple : JWT ES256 signé avec la clé .p8."""
    now = int(time.time())
    secret: str = jwt.encode(
        {
            "iss": settings.APPLE_OAUTH_TEAM_ID,
            "iat": now,
            "exp": now + 300,
            "aud": _APPLE_ISSUER,
            "sub": settings.APPLE_OAUTH_CLIENT_ID,
        },
        settings.APPLE_OAUTH_PRIVATE_KEY,
        algorithm="ES256",
        headers={"kid": settings.APPLE_OAUTH_KEY_ID, "alg": "ES256"},
    )
    return secret


async def _identity_from_claims(claims: dict[str, Any]) -> Identity:
    email = (claims.get("email") or "").strip().lower()
    subject = claims.get("sub") or ""
    if not email:
        raise OAuthError("email_unavailable")
    if not subject:
        raise OAuthError("subject_missing")
    return Identity(
        email=email, subject=subject, email_verified=_as_bool(claims.get("email_verified"))
    )


async def resolve_identity(
    provider: str,
    *,
    code: str | None = None,
    id_token: str | None = None,
    redirect_uri: str | None = None,
) -> Identity:
    """Point d'entrée unique : retourne l'identité vérifiée du provider.

    Accepte soit un `code` d'autorisation (échangé côté serveur), soit un
    `id_token` déjà obtenu côté client. Lève `OAuthError` si non vérifiable.
    """
    if not provider_enabled(provider):
        raise OAuthError("provider_not_configured")

    if provider == "google":
        if id_token is None:
            if not code or not redirect_uri:
                raise OAuthError("missing_code")
            id_token = await _exchange_code(
                _GOOGLE_TOKEN,
                code=code,
                client_id=settings.GOOGLE_OAUTH_CLIENT_ID,
                client_secret=settings.GOOGLE_OAUTH_CLIENT_SECRET,
                redirect_uri=redirect_uri,
            )
        jwks = await _fetch_jwks(_GOOGLE_JWKS)
        claims = _verify_id_token(
            id_token, jwks, audience=settings.GOOGLE_OAUTH_CLIENT_ID, issuers=_GOOGLE_ISSUERS
        )
        return await _identity_from_claims(claims)

    if provider == "apple":
        if id_token is None:
            if not code or not redirect_uri:
                raise OAuthError("missing_code")
            id_token = await _exchange_code(
                _APPLE_TOKEN,
                code=code,
                client_id=settings.APPLE_OAUTH_CLIENT_ID,
                client_secret=_apple_client_secret(),
                redirect_uri=redirect_uri,
            )
        jwks = await _fetch_jwks(_APPLE_JWKS)
        claims = _verify_id_token(
            id_token, jwks, audience=settings.APPLE_OAUTH_CLIENT_ID, issuers=(_APPLE_ISSUER,)
        )
        return await _identity_from_claims(claims)

    raise OAuthError("provider_unsupported")
