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
        <h3
          className="z-serif"
          style={{
            margin: "0 0 0.5rem",
            color: "var(--z-green-900)",
            fontSize: "1.6rem",
          }}
        >
          {t("empty.title")}
        </h3>
        <p style={{ margin: 0, color: "var(--z-muted)", fontSize: "0.95rem" }}>
          {t("empty.subtitle")}
        </p>
      </div>
    );
  }

  return (
    <div className="z-cards">
      {listings.map((listing, i) => (
        <PropertyCard
          key={listing.slug ?? i}
          listing={listing}
          locale={locale}
        />
      ))}
    </div>
  );
}
