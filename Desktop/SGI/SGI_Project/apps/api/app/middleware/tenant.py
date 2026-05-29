from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request


class TenantMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        token = request.headers.get("Authorization", "").removeprefix("Bearer ")
        if token:
            try:
                from app.core.auth import decode_jwt
                payload = decode_jwt(token)
                request.state.company_id = payload.get("company_id")
                request.state.user_id = payload.get("sub")
                request.state.role = payload.get("role")
                request.state.email = payload.get("email")
                request.state.language = payload.get("language")
            except Exception:
                pass
        return await call_next(request)
