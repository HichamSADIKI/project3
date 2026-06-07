import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { PropertyGrid } from "@/components/property-grid";
import { ZoiSearchBox } from "@/components/zoi/zoi-search";
import { Portfolio } from "@/components/zoi/portfolio";
import { Ic, Svg } from "@/components/zoi/icons";
import { BookButton } from "@/components/zoi/book-button";
import { apiServerPublic } from "@/lib/api-server";
import {
  type PublicEnvelope,
  type PublicListing,
  type PublicStats,
  formatNumber,
} from "@/lib/realestate";

const HERO_IMG =
  "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1900&q=80";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const tre = makeT("realestate", lc);
  return {
    title: tre("home.heroTitle"),
    description: tre("home.heroSubtitle"),
  };
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const lc: Locale = locale;
  const t = makeT("common", lc);
  const tre = makeT("realestate", lc);

  // Vitrine immobilière — données publiques (fail-safe : null si backend KO).
  const [featuredRes, urgentRes, statsRes, poolRes] = await Promise.all([
    apiServerPublic<PublicEnvelope<PublicListing[]>>(
      "/api/v1/public/listings?is_featured=true&limit=3",
    ),
    apiServerPublic<PublicEnvelope<PublicListing[]>>(
      "/api/v1/public/listings?is_urgent=true&limit=3",
    ),
    apiServerPublic<PublicEnvelope<PublicStats>>("/api/v1/public/stats"),
    apiServerPublic<PublicEnvelope<PublicListing[]>>(
      "/api/v1/public/listings?limit=9",
    ),
  ]);

  const featured = featuredRes?.data ?? [];
  const urgent = urgentRes?.data ?? [];
  const stats = statsRes?.data ?? null;
  const pool = poolRes?.data ?? [];

  const UNIT_TYPE_KEYS = [
    "villa",
    "apartment",
    "townhouse",
    "penthouse",
    "office",
    "studio",
    "land",
  ];
  const typeLabels: Record<string, string> = Object.fromEntries(
    UNIT_TYPE_KEYS.map((k) => {
      const v = tre(`portfolio.${k}`);
      return [k, v === `portfolio.${k}` ? k : v];
    }),
  );
  const portfolioLabels = {
    all: tre("portfolio.all"),
    villa: tre("portfolio.villa"),
    apartment: tre("portfolio.apartment"),
    office: tre("portfolio.office"),
    land: tre("portfolio.land"),
    any: tre("search.dealAny"),
    buy: tre("search.dealSale"),
    rent: tre("search.dealRent"),
    badgeSale: tre("badges.sale"),
    badgeRent: tre("badges.rent"),
    perYear: tre("card.perYear"),
    priceOnRequest: tre("card.priceOnRequest"),
    details: tre("card.viewDetails"),
    book: tre("book.short"),
    favorite: tre("badges.featured"),
    typeLabels,
  };

  const overlayDeg = lc === "ar" ? "280deg" : "80deg";

  const statItems: Array<[string, string]> = [
    [formatNumber(stats?.listings), tre("home.stats.listings")],
    [formatNumber(stats?.for_sale), tre("home.stats.forSale")],
    [formatNumber(stats?.for_rent), tre("home.stats.forRent")],
    [formatNumber(stats?.cities), tre("home.stats.cities")],
  ];

  const whyIcons = [Ic.shield, Ic.award, Ic.handshake];
  const whyItems: Array<[string, string]> = [
    [tre("why.items.0.title"), tre("why.items.0.text")],
    [tre("why.items.1.title"), tre("why.items.1.text")],
    [tre("why.items.2.title"), tre("why.items.2.text")],
  ];

  // Annonce générique pour le CTA de réservation du bandeau.
  const ctaListing: PublicListing = { title: t("brand.name"), slug: undefined };

  return (
    <PublicShell locale={lc}>
      {/* ── Hero Signature : photo plein cadre + voile vert directionnel ──── */}
      <section
        className="z-hero"
        style={{
          background: `linear-gradient(${overlayDeg},rgba(8,34,28,.92) 0%,rgba(9,38,31,.74) 42%,rgba(11,44,36,.4) 100%), url(${HERO_IMG}) center/cover`,
        }}
      >
        <div className="z-container z-hero-split">
          <div style={{ color: "#fff", maxWidth: 600 }}>
            <span className="z-eyebrow" style={{ color: "var(--z-gold-300)" }}>
              {tre("hero.eyebrow")}
            </span>
            <h1>
              <span>{tre("hero.line1")}</span>
              <span className="z-italic">{tre("hero.line2")}</span>
            </h1>
            <p
              style={{
                fontSize: 18,
                color: "rgba(255,255,255,.88)",
                maxWidth: 500,
                marginBottom: 34,
              }}
            >
              {tre("home.heroSubtitle")}
            </p>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Link
                href={`/${lc}/properties`}
                className="z-btn z-btn-gold z-btn-lg"
              >
                {tre("hero.explore")} <Svg d={Ic.arrow} w={18} />
              </Link>
              <a
                href="#featured"
                className="z-btn z-btn-lg"
                style={{
                  color: "#fff",
                  border: "1.5px solid rgba(255,255,255,.4)",
                }}
              >
                <Svg d={Ic.play} w={16} fill /> {tre("hero.watch")}
              </a>
            </div>
          </div>

          <ZoiSearchBox
            locale={lc}
            labels={{
              title: tre("search.find"),
              any: tre("search.dealAny"),
              buy: tre("search.dealSale"),
              rent: tre("search.dealRent"),
              location: tre("search.keywordPlaceholder"),
              type: tre("search.unitType"),
              price: tre("search.priceRange"),
              bedrooms: tre("search.bedrooms"),
              search: tre("search.submit"),
            }}
          />
        </div>
      </section>

      {/* ── Stats strip ──────────────────────────────────────────────────── */}
      {stats ? (
        <section
          style={{
            padding: "70px 0",
            background: "var(--z-paper)",
            borderBottom: "1px solid var(--z-line)",
          }}
        >
          <div className="z-container">
            <div className="z-stats">
              {statItems.map(([n, l], i) => (
                <div className="z-stat z-reveal in" key={i}>
                  <div className="z-n">{n}</div>
                  <div className="z-l">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Featured ─────────────────────────────────────────────────────── */}
      {featured.length ? (
        <section
          id="featured"
          style={{ padding: "100px 0 60px", background: "var(--z-cream)" }}
        >
          <div className="z-container">
            <div className="z-sec-head">
              <span className="z-eyebrow">{tre("home.featuredEyebrow")}</span>
              <h2 className="z-sec-title" style={{ marginTop: 14 }}>
                {tre("home.featuredTitle")}
              </h2>
              <p className="z-sec-sub">{tre("home.featuredSubtitle")}</p>
            </div>
            <PropertyGrid listings={featured} locale={lc} />
          </div>
        </section>
      ) : null}

      {/* ── Urgent ───────────────────────────────────────────────────────── */}
      {urgent.length ? (
        <section
          style={{ padding: "40px 0 80px", background: "var(--z-cream)" }}
        >
          <div className="z-container">
            <div className="z-sec-head">
              <span className="z-eyebrow">{tre("home.urgentTitle")}</span>
              <h2 className="z-sec-title" style={{ marginTop: 14 }}>
                {tre("home.urgentTitle")}
              </h2>
              <p className="z-sec-sub">{tre("home.urgentSubtitle")}</p>
            </div>
            <PropertyGrid listings={urgent} locale={lc} />
          </div>
        </section>
      ) : null}

      {/* ── Portfolio filtrable ──────────────────────────────────────────── */}
      {pool.length ? (
        <section
          style={{ padding: "60px 0 40px", background: "var(--z-cream)" }}
        >
          <div className="z-container">
            <div className="z-sec-head">
              <span className="z-eyebrow">{tre("home.featuredEyebrow")}</span>
              <h2 className="z-sec-title" style={{ marginTop: 14 }}>
                {tre("portfolio.title")}
              </h2>
              <p className="z-sec-sub">{tre("portfolio.subtitle")}</p>
            </div>
          </div>
          <Portfolio locale={lc} listings={pool} labels={portfolioLabels} />
        </section>
      ) : null}

      {/* ── View all CTA ─────────────────────────────────────────────────── */}
      <section
        style={{
          padding: "10px 0 40px",
          background: "var(--z-cream)",
          textAlign: "center",
        }}
      >
        <Link href={`/${lc}/properties`} className="z-btn z-btn-ghost z-btn-lg">
          {tre("home.viewAll")} <Svg d={Ic.arrow} w={17} />
        </Link>
      </section>

      {/* ── Why SGI ──────────────────────────────────────────────────────── */}
      <section style={{ padding: "90px 0", background: "var(--z-paper)" }}>
        <div className="z-container">
          <div
            className="z-sec-head"
            style={{
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <span className="z-eyebrow">{tre("why.eyebrow")}</span>
            <h2 className="z-sec-title" style={{ marginTop: 14 }}>
              {tre("why.title")}
            </h2>
          </div>
          <div className="z-why-grid">
            {whyItems.map(([title, text], i) => (
              <div className="z-why-card" key={i}>
                <div className="z-why-ic">
                  <Svg d={whyIcons[i]} w={32} />
                </div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Reserve CTA band ─────────────────────────────────────────────── */}
      <section style={{ padding: "40px 0 90px", background: "var(--z-paper)" }}>
        <div className="z-container">
          <div className="z-cta-band">
            <div className="z-glow" />
            <div style={{ maxWidth: 560, position: "relative" }}>
              <h2>{tre("ctaBand.title")}</h2>
              <p>{tre("ctaBand.subtitle")}</p>
            </div>
            <BookButton
              listing={ctaListing}
              label={tre("book.cta")}
              variant="gold"
              large
            />
          </div>
        </div>
      </section>

      {/* ── Accès portails existants (préservé) ──────────────────────────── */}
      <section style={{ padding: "0 0 90px", background: "var(--z-paper)" }}>
        <div className="z-container">
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 300px), 1fr))",
              gap: "clamp(0.875rem, 2.5vw, 1.5rem)",
            }}
          >
            {(["client", "fournisseur"] as const).map((kind) => (
              <Link
                key={kind}
                href={`/${lc}/register/${kind}`}
                style={{
                  display: "block",
                  background: "var(--z-cream)",
                  border: "1px solid var(--z-line)",
                  borderRadius: "var(--z-rlg)",
                  padding: "32px 30px",
                  textAlign: "start",
                }}
              >
                <div className="z-eyebrow">{t(`home.${kind}Card.kicker`)}</div>
                <h3
                  className="z-serif"
                  style={{
                    margin: "16px 0 10px",
                    fontSize: 28,
                    color: "var(--z-green-900)",
                  }}
                >
                  {t(`home.${kind}Card.title`)}
                </h3>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.95rem",
                    color: "var(--z-muted)",
                    lineHeight: 1.6,
                  }}
                >
                  {t(`home.${kind}Card.description`)}
                </p>
                <div className="z-btn z-btn-green" style={{ marginTop: 22 }}>
                  {t(`home.${kind}Card.cta`)} <Svg d={Ic.arrow} w={17} />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
