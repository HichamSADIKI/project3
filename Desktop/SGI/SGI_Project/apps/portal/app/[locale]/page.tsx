import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { SearchFilters } from "@/components/search-filters";
import { PropertyGrid } from "@/components/property-grid";
import { apiServerPublic } from "@/lib/api-server";
import {
  type PublicEnvelope,
  type PublicListing,
  type PublicStats,
  formatNumber,
} from "@/lib/realestate";

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
  const [featuredRes, urgentRes, statsRes] = await Promise.all([
    apiServerPublic<PublicEnvelope<PublicListing[]>>(
      "/api/v1/public/listings?is_featured=true&limit=4",
    ),
    apiServerPublic<PublicEnvelope<PublicListing[]>>(
      "/api/v1/public/listings?is_urgent=true&limit=4",
    ),
    apiServerPublic<PublicEnvelope<PublicStats>>("/api/v1/public/stats"),
  ]);

  const featured = featuredRes?.data ?? [];
  const urgent = urgentRes?.data ?? [];
  const stats = statsRes?.data ?? null;

  return (
    <PublicShell locale={lc}>
      {/* ── Hero vitrine + recherche ─────────────────────────────────── */}
      <section
        style={{
          background: "linear-gradient(135deg, var(--surface-3), var(--bg-paper))",
          borderBottom: "1px solid var(--line-soft)",
        }}
      >
        <div
          className="sgi-container"
          style={{
            paddingBlock: "clamp(2.25rem, 7vw, 4.5rem)",
            display: "flex",
            flexDirection: "column",
            gap: "1.5rem",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <h1
              style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: "var(--hero-size)",
                margin: 0,
                color: "var(--ink)",
                letterSpacing: "-0.02em",
                lineHeight: 1.15,
              }}
            >
              {tre("home.heroTitle")}
            </h1>
            <p
              style={{
                fontSize: "clamp(1rem, 2.2vw, 1.125rem)",
                color: "var(--ink-3)",
                maxWidth: 640,
                margin: "1rem auto 0",
                lineHeight: 1.6,
              }}
            >
              {tre("home.heroSubtitle")}
            </p>
          </div>

          <SearchFilters
            locale={lc}
            targetPath={`/${lc}/properties`}
            labels={{
              keyword: tre("search.keyword"),
              keywordPlaceholder: tre("search.keywordPlaceholder"),
              deal: tre("search.deal"),
              dealAny: tre("search.dealAny"),
              dealSale: tre("search.dealSale"),
              dealRent: tre("search.dealRent"),
              unitType: tre("search.unitType"),
              unitTypeAny: tre("search.unitTypeAny"),
              bedrooms: tre("search.bedrooms"),
              bedroomsAny: tre("search.bedroomsAny"),
              priceMin: tre("search.priceMin"),
              priceMax: tre("search.priceMax"),
              submit: tre("search.submit"),
              reset: tre("search.reset"),
              sort: tre("search.sort"),
              sortNewest: tre("search.sortNewest"),
              sortPriceAsc: tre("search.sortPriceAsc"),
              sortPriceDesc: tre("search.sortPriceDesc"),
            }}
          />

          {stats ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))",
                gap: "0.75rem",
              }}
            >
              {[
                [tre("home.stats.forSale"), stats.for_sale],
                [tre("home.stats.forRent"), stats.for_rent],
                [tre("home.stats.cities"), stats.cities],
                [tre("home.stats.listings"), stats.listings],
              ].map(([label, value]) => (
                <div key={String(label)} className="sgi-card" style={{ textAlign: "center", padding: "0.875rem" }}>
                  <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--gold-deep)" }}>
                    {formatNumber(value as number | null | undefined)}
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--ink-3)" }}>{label}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      {/* ── Featured ─────────────────────────────────────────────────── */}
      {featured.length ? (
        <section className="sgi-container" style={{ paddingBlock: "var(--page-py)", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "var(--h2-size)", color: "var(--ink)" }}>{tre("home.featuredTitle")}</h2>
            <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "0.88rem" }}>{tre("home.featuredSubtitle")}</p>
          </div>
          <PropertyGrid listings={featured} locale={lc} />
        </section>
      ) : null}

      {/* ── Urgent ───────────────────────────────────────────────────── */}
      {urgent.length ? (
        <section className="sgi-container" style={{ paddingBlock: "var(--page-py)", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <div>
            <h2 style={{ margin: "0 0 0.25rem", fontSize: "var(--h2-size)", color: "var(--ink)" }}>{tre("home.urgentTitle")}</h2>
            <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "0.88rem" }}>{tre("home.urgentSubtitle")}</p>
          </div>
          <PropertyGrid listings={urgent} locale={lc} />
        </section>
      ) : null}

      {/* ── CTA voir tout ────────────────────────────────────────────── */}
      <section className="sgi-container" style={{ paddingBlock: "var(--page-py)", textAlign: "center" }}>
        <Link href={`/${lc}/properties`} className="sgi-button sgi-button-primary">
          {tre("home.viewAll")}
        </Link>
      </section>

      {/* ── Accès portails existants (préservé) ──────────────────────── */}
      <section
        className="sgi-container"
        style={{ paddingBlock: "var(--page-py)" }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: "clamp(0.875rem, 2.5vw, 1.25rem)",
          }}
        >
          <Link href={`/${lc}/register/client`} className="sgi-card" style={{ textAlign: "start" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gold-deep)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("home.clientCard.kicker")}
            </div>
            <h3 style={{ margin: "0.75rem 0 0.5rem", fontSize: "clamp(1.1rem, 2vw, 1.25rem)", color: "var(--ink)" }}>
              {t("home.clientCard.title")}
            </h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-3)", lineHeight: 1.55 }}>
              {t("home.clientCard.description")}
            </p>
            <div className="sgi-button sgi-button-primary" style={{ marginTop: "1.25rem", width: "100%" }}>
              {t("home.clientCard.cta")}
            </div>
          </Link>

          <Link href={`/${lc}/register/fournisseur`} className="sgi-card" style={{ textAlign: "start" }}>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--gold-deep)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {t("home.fournisseurCard.kicker")}
            </div>
            <h3 style={{ margin: "0.75rem 0 0.5rem", fontSize: "clamp(1.1rem, 2vw, 1.25rem)", color: "var(--ink)" }}>
              {t("home.fournisseurCard.title")}
            </h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-3)", lineHeight: 1.55 }}>
              {t("home.fournisseurCard.description")}
            </p>
            <div className="sgi-button sgi-button-primary" style={{ marginTop: "1.25rem", width: "100%" }}>
              {t("home.fournisseurCard.cta")}
            </div>
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
