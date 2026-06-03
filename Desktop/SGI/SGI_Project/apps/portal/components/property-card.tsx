import Link from "next/link";
import type { Locale } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";
import {
  type PublicListing,
  formatAed,
  formatSqft,
  formatNumber,
} from "@/lib/realestate";

/**
 * Carte d'annonce — Server Component (pas d'interactivité).
 * RTL strict : CSS logique uniquement (inset-inline, ms/me, start/end).
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
  const photo = listing.photos?.[0];
  const isRent = listing.deal === "rent";
  const price = formatAed(listing.price);
  const period =
    listing.price_period === "month"
      ? t("card.perMonth")
      : isRent
        ? t("card.perYear")
        : "";
  const sqft = formatSqft(listing.area_sqm);

  return (
    <Link
      href={`/${locale}/property/${slug}`}
      className="sgi-card"
      style={{
        padding: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        textAlign: "start",
      }}
    >
      <div
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          background: "var(--bg-inset)",
          overflow: "hidden",
        }}
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt={listing.title ?? ""}
            loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-4)",
              fontSize: "0.8rem",
            }}
          >
            —
          </div>
        )}
        <div
          style={{
            position: "absolute",
            insetBlockStart: "0.625rem",
            insetInlineStart: "0.625rem",
            display: "flex",
            gap: "0.375rem",
            flexWrap: "wrap",
          }}
        >
          <span
            className="sgi-badge"
            style={{
              background: isRent ? "var(--azure-soft)" : "var(--gold-soft)",
              color: isRent ? "var(--azure)" : "var(--gold-deep)",
            }}
          >
            {isRent ? t("badges.rent") : t("badges.sale")}
          </span>
          {listing.is_urgent ? (
            <span className="sgi-badge sgi-badge-rejected">{t("badges.urgent")}</span>
          ) : null}
          {listing.is_featured ? (
            <span className="sgi-badge sgi-badge-pending">{t("badges.featured")}</span>
          ) : null}
        </div>
      </div>

      <div style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: "1.05rem", color: "var(--gold-deep)" }}>
          {price ? (
            <>
              {price}
              <span style={{ fontSize: "0.8rem", color: "var(--ink-3)", fontWeight: 500 }}>{period}</span>
            </>
          ) : (
            <span style={{ fontSize: "0.9rem", color: "var(--ink-3)" }}>{t("card.priceOnRequest")}</span>
          )}
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: "0.95rem",
            color: "var(--ink)",
            lineHeight: 1.35,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {listing.title ?? "—"}
        </h3>
        <div style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
          {[listing.district, listing.city, listing.emirate].filter(Boolean).join(" · ") || "—"}
        </div>
        <div
          style={{
            marginBlockStart: "auto",
            paddingBlockStart: "0.5rem",
            borderBlockStart: "1px solid var(--line-soft)",
            display: "flex",
            gap: "0.875rem",
            fontSize: "0.8rem",
            color: "var(--ink-2)",
            flexWrap: "wrap",
          }}
        >
          {listing.bedrooms != null ? <span>{t("card.beds", { count: formatNumber(listing.bedrooms) })}</span> : null}
          {listing.bathrooms != null ? <span>{t("card.baths", { count: formatNumber(listing.bathrooms) })}</span> : null}
          {sqft ? <span>{t("card.area", { area: sqft })}</span> : null}
        </div>
      </div>
    </Link>
  );
}
