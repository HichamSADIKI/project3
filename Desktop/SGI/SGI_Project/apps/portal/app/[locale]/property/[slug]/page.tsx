import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { PropertyGallery } from "@/components/property-gallery";
import { ContactForm } from "@/components/contact-form";
import { PropertyCard } from "@/components/property-card";
import { Ic, Svg } from "@/components/zoi/icons";
import { BookButton } from "@/components/zoi/book-button";
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
    listing.price_period === "month"
      ? t("card.perMonth")
      : isRent
        ? t("card.perYear")
        : "";
  const sqft = formatSqft(listing.area_sqm);
  const yn = (v: boolean | null | undefined) =>
    v == null ? t("detail.notAvailable") : v ? t("detail.yes") : t("detail.no");

  const agent = listing.agent;
  const wa = waMeLink(agent?.whatsapp);
  const loc =
    [listing.district, listing.city, listing.emirate]
      .filter(Boolean)
      .join(" · ") || "—";
  const typeKey = listing.unit_type ?? "";
  const typeLabel =
    typeKey && t(`portfolio.${typeKey}`) !== `portfolio.${typeKey}`
      ? t(`portfolio.${typeKey}`)
      : typeKey;

  // Tuiles « highlight » — uniquement celles renseignées.
  const highlights: Array<[ReactNode, string, string]> = [];
  if (listing.bedrooms != null)
    highlights.push([
      <Svg d={Ic.bed} w={26} />,
      formatNumber(listing.bedrooms),
      t("detail.bedrooms"),
    ]);
  if (listing.bathrooms != null)
    highlights.push([
      <Svg d={Ic.bath} w={26} />,
      formatNumber(listing.bathrooms),
      t("detail.bathrooms"),
    ]);
  if (sqft)
    highlights.push([<Svg d={Ic.area} w={26} />, sqft, t("detail.areaUnit")]);
  if (typeLabel)
    highlights.push([
      <Svg d={Ic.building} w={26} />,
      typeLabel,
      t("detail.type"),
    ]);

  // Caractéristiques complètes — n'affiche que celles renseignées.
  const specs: Array<[string, string | null]> = [
    [t("detail.reference"), listing.reference ?? null],
    [t("detail.deal"), isRent ? t("badges.rent") : t("badges.sale")],
    [
      t("detail.parking"),
      listing.parking != null
        ? t("detail.spots", { count: formatNumber(listing.parking) })
        : null,
    ],
    [
      t("detail.furnished"),
      listing.furnished != null ? yn(listing.furnished) : null,
    ],
    [
      t("detail.floor"),
      listing.floor != null ? formatNumber(listing.floor) : null,
    ],
    [t("detail.view"), listing.view ?? null],
    [t("detail.balcony"), listing.balcony != null ? yn(listing.balcony) : null],
    [
      t("detail.maidRoom"),
      listing.maid_room != null ? yn(listing.maid_room) : null,
    ],
    [
      t("detail.studyRoom"),
      listing.study_room != null ? yn(listing.study_room) : null,
    ],
    [
      t("detail.petsAllowed"),
      listing.pets_allowed != null ? yn(listing.pets_allowed) : null,
    ],
    [t("detail.completion"), listing.completion ?? null],
    [
      t("detail.yearBuilt"),
      listing.year_built != null ? formatNumber(listing.year_built) : null,
    ],
    [t("detail.developer"), listing.developer ?? null],
    [t("detail.availableFrom"), listing.available_from ?? null],
    [t("detail.city"), listing.city ?? null],
    [t("detail.district"), listing.district ?? null],
    [t("detail.emirate"), listing.emirate ?? null],
  ];
  const filledSpecs = specs.filter(([, v]) => v != null) as Array<
    [string, string]
  >;
  const similar = listing.similar ?? [];

  return (
    <PublicShell locale={lc}>
      <section
        className="z-container"
        style={{
          paddingBlock: "40px",
          display: "flex",
          flexDirection: "column",
          gap: 28,
        }}
      >
        <Link href={`/${lc}/properties`} className="z-back">
          {t("detail.backToList")}
        </Link>

        <div className="z-detail-grid">
          {/* Colonne principale */}
          <div className="z-detail-main">
            <PropertyGallery
              photos={listing.photos ?? []}
              title={listing.title ?? ""}
            />

            <div>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                  marginBottom: 14,
                }}
              >
                <span
                  className={`z-tag ${isRent ? "z-tag-rent" : "z-tag-sale"}`}
                >
                  {isRent ? t("badges.rent") : t("badges.sale")}
                </span>
                {typeLabel ? (
                  <span className="z-tag z-tag-type">{typeLabel}</span>
                ) : null}
                {listing.is_urgent ? (
                  <span
                    className="z-tag"
                    style={{ background: "#d6453d", color: "#fff" }}
                  >
                    {t("badges.urgent")}
                  </span>
                ) : null}
                {listing.is_featured ? (
                  <span
                    className="z-tag"
                    style={{
                      background: "var(--z-sand)",
                      color: "var(--z-green-800)",
                    }}
                  >
                    {t("badges.featured")}
                  </span>
                ) : null}
              </div>
              <h1 className="z-detail-title">{listing.title ?? "—"}</h1>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  color: "var(--z-muted)",
                  fontSize: 15,
                }}
              >
                <Svg d={Ic.pin} w={16} /> {loc}
              </div>
            </div>

            {highlights.length ? (
              <div className="z-highlights">
                {highlights.map(([icon, value, label], i) => (
                  <div className="z-hl" key={i}>
                    <span className="z-hl-ic">{icon}</span>
                    <span className="z-hl-v">{value}</span>
                    <span className="z-hl-l">{label}</span>
                  </div>
                ))}
              </div>
            ) : null}

            {filledSpecs.length ? (
              <div className="z-panel">
                <h2>{t("detail.features")}</h2>
                <div className="z-spec-grid">
                  {filledSpecs.map(([label, value]) => (
                    <div className="z-spec-row" key={label}>
                      <span className="z-sk">{label}</span>
                      <span className="z-sv">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {listing.amenities?.length ? (
              <div className="z-panel">
                <h2>{t("detail.amenities")}</h2>
                <div className="z-chips">
                  {listing.amenities.map((a, i) => (
                    <span
                      key={i}
                      className="z-chip"
                      style={{ cursor: "default" }}
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {listing.description ? (
              <div className="z-panel">
                <h2>{t("detail.description")}</h2>
                <p>{listing.description}</p>
              </div>
            ) : null}
          </div>

          {/* Colonne latérale : prix + réservation + agent + contact */}
          <aside className="z-detail-aside">
            <div
              className="z-panel"
              style={{ display: "flex", flexDirection: "column", gap: 18 }}
            >
              <div className="z-detail-price">
                {price ? (
                  <>
                    {price}
                    <span>{period}</span>
                  </>
                ) : (
                  <span
                    style={{
                      fontFamily: "var(--z-sans)",
                      fontSize: 18,
                      color: "var(--z-muted)",
                    }}
                  >
                    {t("card.priceOnRequest")}
                  </span>
                )}
              </div>
              <BookButton
                listing={listing}
                label={t("book.cta")}
                variant="gold"
                large
              />
            </div>

            {agent?.name ? (
              <div className="z-agent">
                <span className="z-agent-k">{t("contact.agent")}</span>
                <div className="z-agent-n">{agent.name}</div>
                <div className="z-agent-btns">
                  {wa ? (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="z-btn z-btn-wa"
                    >
                      <Svg d={Ic.phone} w={16} /> {t("contact.whatsapp")}
                    </a>
                  ) : null}
                  {agent.phone ? (
                    <a
                      href={`tel:${agent.phone.replace(/[^\d+]/g, "")}`}
                      className="z-btn z-btn-call"
                    >
                      <Svg d={Ic.phone} w={16} /> {t("contact.call")}
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 24,
              marginTop: 24,
            }}
          >
            <div className="z-sec-head" style={{ marginBottom: 0 }}>
              <span className="z-eyebrow">{t("home.featuredEyebrow")}</span>
              <h2
                className="z-sec-title"
                style={{ marginTop: 12, fontSize: "clamp(28px,3vw,40px)" }}
              >
                {t("detail.similar")}
              </h2>
            </div>
            <div className="z-cards">
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
