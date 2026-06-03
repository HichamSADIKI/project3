import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { PropertyGallery } from "@/components/property-gallery";
import { ContactForm } from "@/components/contact-form";
import { PropertyCard } from "@/components/property-card";
import { apiServerPublic } from "@/lib/api-server";
import {
  type PublicEnvelope,
  type PublicListingDetail,
  formatAed,
  formatNumber,
  formatSqft,
  waMeLink,
} from "@/lib/realestate";

async function fetchListing(slug: string): Promise<PublicListingDetail | null> {
  const res = await apiServerPublic<PublicEnvelope<PublicListingDetail>>(
    `/api/v1/public/listings/${encodeURIComponent(slug)}`,
  );
  return res?.data ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const listing = await fetchListing(slug);
  if (!listing) {
    return { title: makeT("realestate", lc)("empty.title") };
  }
  const title = listing.title ?? makeT("realestate", lc)("nav.properties");
  const photo = listing.photos?.[0];
  return {
    title,
    description: (listing.description ?? "").slice(0, 200) || undefined,
    openGraph: {
      title,
      description: (listing.description ?? "").slice(0, 200) || undefined,
      images: photo ? [{ url: photo }] : undefined,
      type: "website",
    },
  };
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.125rem", padding: "0.5rem 0" }}>
      <span style={{ fontSize: "0.72rem", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: "0.9rem", color: "var(--ink)", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();
  const lc: Locale = locale;
  const t = makeT("realestate", lc);

  const listing = await fetchListing(slug);
  if (!listing) notFound();

  const isRent = listing.deal === "rent";
  const price = formatAed(listing.price);
  const period =
    listing.price_period === "month" ? t("card.perMonth") : isRent ? t("card.perYear") : "";
  const sqft = formatSqft(listing.area_sqm);
  const yn = (v: boolean | null | undefined) => (v == null ? t("detail.notAvailable") : v ? t("detail.yes") : t("detail.no"));

  const agent = listing.agent;
  const wa = waMeLink(agent?.whatsapp);

  // Caractéristiques (20+ champs) — n'affiche que celles renseignées.
  const specs: Array<[string, string | null]> = [
    [t("detail.reference"), listing.reference ?? null],
    [t("detail.deal"), isRent ? t("badges.rent") : t("badges.sale")],
    [t("detail.type"), listing.unit_type ?? null],
    [t("detail.bedrooms"), listing.bedrooms != null ? formatNumber(listing.bedrooms) : null],
    [t("detail.bathrooms"), listing.bathrooms != null ? formatNumber(listing.bathrooms) : null],
    [t("detail.area"), sqft ? `${sqft} ${t("detail.areaUnit")}` : null],
    [t("detail.parking"), listing.parking != null ? t("detail.spots", { count: formatNumber(listing.parking) }) : null],
    [t("detail.furnished"), listing.furnished != null ? yn(listing.furnished) : null],
    [t("detail.floor"), listing.floor != null ? formatNumber(listing.floor) : null],
    [t("detail.view"), listing.view ?? null],
    [t("detail.balcony"), listing.balcony != null ? yn(listing.balcony) : null],
    [t("detail.maidRoom"), listing.maid_room != null ? yn(listing.maid_room) : null],
    [t("detail.studyRoom"), listing.study_room != null ? yn(listing.study_room) : null],
    [t("detail.petsAllowed"), listing.pets_allowed != null ? yn(listing.pets_allowed) : null],
    [t("detail.completion"), listing.completion ?? null],
    [t("detail.yearBuilt"), listing.year_built != null ? formatNumber(listing.year_built) : null],
    [t("detail.developer"), listing.developer ?? null],
    [t("detail.availableFrom"), listing.available_from ?? null],
    [t("detail.city"), listing.city ?? null],
    [t("detail.district"), listing.district ?? null],
    [t("detail.emirate"), listing.emirate ?? null],
  ];
  const filledSpecs = specs.filter(([, v]) => v != null) as Array<[string, string]>;
  const similar = listing.similar ?? [];

  return (
    <PublicShell locale={lc}>
      <section className="sgi-container" style={{ paddingBlock: "var(--page-py)", display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
        <Link href={`/${lc}/properties`} style={{ fontSize: "0.85rem", color: "var(--ink-3)" }}>
          {t("detail.backToList")}
        </Link>

        <div
          style={{
            display: "grid",
            gap: "var(--section-gap)",
            gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          }}
          className="re-detail-grid"
        >
          {/* Colonne principale */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--section-gap)", minWidth: 0 }}>
            <PropertyGallery photos={listing.photos ?? []} title={listing.title ?? ""} />

            <div>
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBlockEnd: "0.5rem" }}>
                <span className="sgi-badge" style={{ background: isRent ? "var(--azure-soft)" : "var(--gold-soft)", color: isRent ? "var(--azure)" : "var(--gold-deep)" }}>
                  {isRent ? t("badges.rent") : t("badges.sale")}
                </span>
                {listing.is_urgent ? <span className="sgi-badge sgi-badge-rejected">{t("badges.urgent")}</span> : null}
                {listing.is_featured ? <span className="sgi-badge sgi-badge-pending">{t("badges.featured")}</span> : null}
              </div>
              <h1 style={{ margin: "0 0 0.375rem", fontSize: "var(--h1-size)", color: "var(--ink)", lineHeight: 1.2 }}>
                {listing.title ?? "—"}
              </h1>
              <div style={{ fontSize: "0.9rem", color: "var(--ink-3)" }}>
                {[listing.district, listing.city, listing.emirate].filter(Boolean).join(" · ") || "—"}
              </div>
              <div style={{ marginBlockStart: "0.75rem", fontSize: "1.5rem", fontWeight: 700, color: "var(--gold-deep)" }}>
                {price ? (
                  <>
                    {price}
                    <span style={{ fontSize: "0.95rem", color: "var(--ink-3)", fontWeight: 500 }}>{period}</span>
                  </>
                ) : (
                  <span style={{ fontSize: "1rem", color: "var(--ink-3)" }}>{t("card.priceOnRequest")}</span>
                )}
              </div>
            </div>

            <div className="sgi-card">
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem", color: "var(--ink)" }}>{t("detail.features")}</h2>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 150px), 1fr))",
                  gap: "0.25rem 1.25rem",
                }}
              >
                {filledSpecs.map(([label, value]) => (
                  <Spec key={label} label={label} value={value} />
                ))}
              </div>
            </div>

            {listing.amenities?.length ? (
              <div className="sgi-card">
                <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem", color: "var(--ink)" }}>{t("detail.amenities")}</h2>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {listing.amenities.map((a, i) => (
                    <span key={i} className="sgi-badge sgi-badge-info">{a}</span>
                  ))}
                </div>
              </div>
            ) : null}

            {listing.description ? (
              <div className="sgi-card">
                <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.1rem", color: "var(--ink)" }}>{t("detail.description")}</h2>
                <p style={{ margin: 0, color: "var(--ink-2)", lineHeight: 1.7, fontSize: "0.92rem", whiteSpace: "pre-line" }}>
                  {listing.description}
                </p>
              </div>
            ) : null}
          </div>

          {/* Colonne latérale : agent + contact */}
          <aside style={{ display: "flex", flexDirection: "column", gap: "var(--section-gap)", minWidth: 0 }}>
            {agent?.name ? (
              <div className="sgi-card" style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {t("contact.agent")}
                </span>
                <strong style={{ fontSize: "1.05rem", color: "var(--ink)" }}>{agent.name}</strong>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {agent.phone ? (
                    <a href={`tel:${agent.phone.replace(/[^\d+]/g, "")}`} className="sgi-button sgi-button-secondary" style={{ width: "100%" }}>
                      {t("contact.call")}
                    </a>
                  ) : null}
                  {wa ? (
                    <a href={wa} target="_blank" rel="noopener noreferrer" className="sgi-button sgi-button-primary" style={{ width: "100%" }}>
                      {t("contact.whatsapp")}
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            <ContactForm
              listingSlug={listing.slug}
              labels={{
                title: t("contact.title"),
                subtitle: t("contact.subtitle"),
                name: t("contact.name"),
                namePlaceholder: t("contact.namePlaceholder"),
                email: t("contact.email"),
                emailPlaceholder: t("contact.emailPlaceholder"),
                phone: t("contact.phone"),
                phonePlaceholder: t("contact.phonePlaceholder"),
                message: t("contact.message"),
                messagePlaceholder: t("contact.messagePlaceholder"),
                submit: t("contact.submit"),
                submitting: t("contact.submitting"),
                success: t("contact.success"),
                error: t("contact.error"),
                validation: t("contact.validation"),
              }}
            />
          </aside>
        </div>

        {similar.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBlockStart: "0.5rem" }}>
            <h2 style={{ margin: 0, fontSize: "var(--h2-size)", color: "var(--ink)" }}>{t("detail.similar")}</h2>
            <div style={{ display: "grid", gap: "var(--section-gap)", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 260px), 1fr))" }}>
              {similar.map((s, i) => (
                <PropertyCard key={s.slug ?? i} listing={s} locale={lc} />
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </PublicShell>
  );
}
