import type { Locale } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";
import type { PublicListing } from "@/lib/realestate";
import { PropertyCard } from "./property-card";

/**
 * Grille responsive de cartes d'annonces — Server Component.
 * Affiche un état vide explicite si aucune annonce.
 */
export function PropertyGrid({
  listings,
  locale,
}: {
  listings: PublicListing[];
  locale: Locale;
}) {
  const t = makeT("realestate", locale);

  if (!listings.length) {
    return (
      <div
        className="sgi-card"
        style={{ textAlign: "center", padding: "clamp(2rem, 6vw, 3.5rem)" }}
      >
        <h3 style={{ margin: "0 0 0.5rem", color: "var(--ink)", fontSize: "1.1rem" }}>
          {t("empty.title")}
        </h3>
        <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "0.9rem" }}>
          {t("empty.subtitle")}
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gap: "var(--section-gap)",
        gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))",
      }}
    >
      {listings.map((listing, i) => (
        <PropertyCard key={listing.slug ?? i} listing={listing} locale={locale} />
      ))}
    </div>
  );
}
