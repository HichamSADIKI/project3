"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Ic, Svg } from "./icons";
import { BookButton } from "./book-button";
import { FavoriteButton } from "./favorite-button";
import {
  type PublicListing,
  formatAed,
  formatSqft,
  formatNumber,
} from "@/lib/realestate";

export interface PortfolioLabels {
  all: string;
  villa: string;
  apartment: string;
  office: string;
  land: string;
  any: string;
  buy: string;
  rent: string;
  badgeSale: string;
  badgeRent: string;
  perYear: string;
  priceOnRequest: string;
  details: string;
  book: string;
  favorite: string;
  /** Map clé unit_type (villa/apartment/…) → libellé localisé, pour le tag. */
  typeLabels: Record<string, string>;
}

type DealFilter = "any" | "sale" | "rent";

/**
 * Section portfolio filtrable (template « ZOI Signature ») — Client Component.
 * Filtre instantanément par type et par transaction. Réutilise les cartes luxe.
 * RTL : CSS logique uniquement (Loi 3).
 */
export function Portfolio({
  locale,
  listings,
  labels,
}: {
  locale: string;
  listings: PublicListing[];
  labels: PortfolioLabels;
}) {
  const [type, setType] = useState<string>("all");
  const [deal, setDeal] = useState<DealFilter>("any");

  const typeChips: Array<[string, string]> = [
    ["all", labels.all],
    ["villa", labels.villa],
    ["apartment", labels.apartment],
    ["office", labels.office],
    ["land", labels.land],
  ];

  const filtered = useMemo(
    () =>
      listings.filter(
        (p) =>
          (deal === "any" || p.deal === deal) &&
          (type === "all" || p.unit_type === type),
      ),
    [listings, type, deal],
  );

  return (
    <div className="z-container">
      <div
        style={{
          display: "flex",
          gap: 18,
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 32,
        }}
      >
        <div className="z-chips">
          {typeChips.map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={`z-chip ${type === k ? "on" : ""}`}
              onClick={() => setType(k)}
            >
              {l}
            </button>
          ))}
        </div>
        <div
          className="z-seg"
          style={{ width: 300, marginBottom: 0, background: "var(--z-sand)" }}
        >
          {(
            [
              ["any", labels.any],
              ["sale", labels.buy],
              ["rent", labels.rent],
            ] as Array<[DealFilter, string]>
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              className={deal === k ? "on" : ""}
              style={deal !== k ? { color: "var(--z-muted)" } : undefined}
              onClick={() => setDeal(k)}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="z-cards">
        {filtered.map((listing, i) => (
          <PortfolioCard
            key={listing.slug ?? i}
            locale={locale}
            listing={listing}
            labels={labels}
          />
        ))}
      </div>
    </div>
  );
}

function PortfolioCard({
  locale,
  listing,
  labels,
}: {
  locale: string;
  listing: PublicListing;
  labels: PortfolioLabels;
}) {
  const detailHref = `/${locale}/property/${listing.slug ?? ""}`;
  const photo = listing.photos?.[0];
  const isRent = listing.deal === "rent";
  const price = formatAed(listing.price);
  const sqft = formatSqft(listing.area_sqm);
  const typeLabel = listing.unit_type
    ? (labels.typeLabels[listing.unit_type] ?? listing.unit_type)
    : "";
  const loc =
    [listing.district, listing.city, listing.emirate]
      .filter(Boolean)
      .join(" · ") || "—";

  return (
    <article className="z-pcard">
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
            {isRent ? labels.badgeRent : labels.badgeSale}
          </span>
          {typeLabel ? (
            <span className="z-tag z-tag-type">{typeLabel}</span>
          ) : null}
        </div>
        <div className="z-pcard-price">
          {price ? (
            <>
              {price}
              {isRent ? <span> {labels.perYear}</span> : null}
            </>
          ) : (
            labels.priceOnRequest
          )}
        </div>
      </Link>

      <FavoriteButton label={labels.favorite} />

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
            {labels.details}
          </Link>
          <BookButton
            listing={listing}
            label={labels.book}
            variant="green"
            withIcon={false}
          />
        </div>
      </div>
    </article>
  );
}
