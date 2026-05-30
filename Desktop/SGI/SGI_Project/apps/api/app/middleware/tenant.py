from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        token = request.headers.get("Authorization", "").removeprefix("Bearer ")
        if token:
            try:
                from app.core.auth import decode_jwt
                payload = decode_jwt(token)
                # Sécurité MFA : un tmp_token (claim mfa_pending) n'authentifie
                # PAS — il ne sert qu'à /auth/mfa/validate (qui lit le token
                # dans le corps de la requête, pas via request.state). On laisse
                # donc la requête anonyme pour bloquer tout contournement du 2FA.
                if not payload.get("mfa_pending"):
                    request.state.company_id = payload.get("company_id")
                    request.state.user_id = payload.get("sub")
                    request.state.role = payload.get("role")
                    request.state.email = payload.get("email")
                    request.state.language = payload.get("language")
            except Exception:  # noqa: S110  JWT invalide → requête anonyme (pas d'auth posée)
                pass
        return await call_next(request)
