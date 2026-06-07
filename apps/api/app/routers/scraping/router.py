import logging

from fastapi import APIRouter, HTTPException, Request, status

from app.routers.scraping.schemas import ScrapedProperty, ScrapeRequest
from app.routers.scraping.service import scrape_property_page

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/scraping", tags=["scraping"])


def _require_auth(request: Request) -> None:
    """Reject unauthenticated requests — scraping is an authenticated feature."""
    if not getattr(request.state, "user_id", None):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )


@router.post(
    "/property",
    response_model=ScrapedProperty,
    summary="Scrape a property listing from Bayut, PropertyFinder or Dubizzle",
)
async def scrape_property(req: ScrapeRequest, request: Request) -> ScrapedProperty:
    _require_auth(request)
    try:
        return await scrape_property_page(str(req.url))
    except RuntimeError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scraping service not ready",
        ) from None
    except Exception as exc:
        logger.warning("Scraping failed for %s: %s", req.url, exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not extract property data from this URL",
        ) from exc
