import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";
import {
  type PublicListing,
  formatAed,
  formatSqft,
  formatNumber,
} from "@/lib/realestate";
import { Ic, Svg } from "./zoi/icons";
import { BookButton } from "./zoi/book-button";
import { FavoriteButton } from "./zoi/favorite-button";

/**
 * Carte d'annonce — direction luxe (design « ZOI Signature »).
 * Server Component ; les actions interactives (favori, réservation) sont des
 * sous-composants client. RTL strict : CSS logique uniquement (Loi 3).
 * Prix en AED chiffres latins, surface en sqft.
 */
export function PropertyCard({
  listing,
  locale,
}: {
  listing: PublicListing;
  locale: Locale;
}) {
  const t = makeT("realestate", locale);
  const slug = listing.slug ?? "";
  const detailHref = `/${locale}/property/${slug}`;
  const photo = listing.photos?.[0];
  const isRent = listing.deal === "rent";
  const price = formatAed(listing.price);
  const sqft = formatSqft(listing.area_sqm);
  const typeKey = listing.unit_type ?? "";
  const typeLabel =
    typeKey && t(`portfolio.${typeKey}`) !== `portfolio.${typeKey}`
      ? t(`portfolio.${typeKey}`)
      : typeKey;
  const loc =
    [listing.district, listing.city, listing.emirate]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <article className="z-pcard z-reveal">
      <Link
        href={detailHref}
        className="z-pcard-img"
        aria-label={listing.title ?? ""}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt={listing.title ?? ""} loading="lazy" />
        ) : null}
        <div className="z-pcard-tags">
          <span className={`z-tag ${isRent ? "z-tag-rent" : "z-tag-sale"}`}>
            {isRent ? t("badges.rent") : t("badges.sale")}
          </span>
          {typeLabel ? (
            <span className="z-tag z-tag-type">{typeLabel}</span>
          ) : null}
        </div>
        <div className="z-pcard-price">
          {price ? (
            <>
              {price}
              {isRent ? <span> {t("card.perYear")}</span> : null}
            </>
          ) : (
            t("card.priceOnRequest")
          )}
        </div>
      </Link>

      <FavoriteButton label={t("badges.featured")} />

      <div className="z-pcard-body">
        <Link href={detailHref}>
          <h3 className="z-pcard-title">{listing.title ?? "—"}</h3>
        </Link>
        <div className="z-pcard-loc">
          <Svg d={Ic.pin} w={15} /> {loc}
        </div>
        <div className="z-pcard-specs">
          {listing.bedrooms != null ? (
            <span className="z-spec">
              <Svg d={Ic.bed} w={16} /> {formatNumber(listing.bedrooms)}
            </span>
          ) : null}
          {listing.bathrooms != null ? (
            <span className="z-spec">
              <Svg d={Ic.bath} w={16} /> {formatNumber(listing.bathrooms)}
            </span>
          ) : null}
          {sqft ? (
            <span className="z-spec">
              <Svg d={Ic.area} w={16} /> {sqft} sqft
            </span>
          ) : null}
        </div>
        <div className="z-pcard-foot">
          <Link
            href={detailHref}
            className="z-btn z-btn-ghost"
            style={{ flex: 1, fontSize: 13, padding: 11 }}
          >
            {t("card.viewDetails")}
          </Link>
          <BookButton
            listing={listing}
            label={t("book.short")}
            variant="green"
            withIcon={false}
          />
        </div>
      </div>
    </article>
  );
}
