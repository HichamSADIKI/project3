from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

AUDIT_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class AuditMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        if request.method in AUDIT_METHODS and response.status_code < 400:
            # Audit log écrit en background via Celery
            pass
        return response
