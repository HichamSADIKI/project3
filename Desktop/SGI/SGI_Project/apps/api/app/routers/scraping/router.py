from fastapi import APIRouter, HTTPException, status

from app.routers.scraping.schemas import ScrapeRequest, ScrapedProperty
from app.routers.scraping.service import scrape_property_page

router = APIRouter(prefix="/scraping", tags=["scraping"])


@router.post(
    "/property",
    response_model=ScrapedProperty,
    summary="Scrape a property listing from Bayut, PropertyFinder or Dubizzle",
)
async def scrape_property(req: ScrapeRequest) -> ScrapedProperty:
    try:
        return await scrape_property_page(str(req.url))
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Scraping service not ready",
        ) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not extract property data: {exc}",
        ) from exc
