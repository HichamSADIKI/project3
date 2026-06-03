import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { PropertyGrid } from "@/components/property-grid";
import { SearchFilters } from "@/components/search-filters";
import { PropertyMap, type PropertyMarker } from "@/components/property-map";
import { apiServerPublic } from "@/lib/api-server";
import { formatAed, type PublicEnvelope, type PublicListing } from "@/lib/realestate";

const LIMIT = 12;

type RawParams = Record<string, string | string[] | undefined>;

function one(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("realestate", lc);
  return {
    title: t("nav.properties"),
    description: t("home.heroSubtitle"),
  };
}

function buildBackendQuery(sp: RawParams, page: number): string {
  const p = new URLSearchParams();
  const q = one(sp.q);
  const deal = one(sp.deal);
  const unitType = one(sp.unit_type);
  const bedrooms = one(sp.bedrooms);
  const priceMin = one(sp.price_min);
  const priceMax = one(sp.price_max);
  const sort = one(sp.sort);
  if (q) p.set("q", q);
  if (deal === "sale" || deal === "rent") p.set("deal", deal);
  if (unitType) p.set("unit_type", unitType);
  if (bedrooms && /^\d+$/.test(bedrooms)) p.set("bedrooms", bedrooms);
  if (priceMin && /^\d+(\.\d+)?$/.test(priceMin)) p.set("price_min", priceMin);
  if (priceMax && /^\d+(\.\d+)?$/.test(priceMax)) p.set("price_max", priceMax);
  if (sort) p.set("sort", sort);
  p.set("page", String(page));
  p.set("limit", String(LIMIT));
  return p.toString();
}

export default async function PropertiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<RawParams>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const lc: Locale = locale;
  const t = makeT("realestate", lc);
  const sp = await searchParams;

  const pageRaw = one(sp.page);
  const page = pageRaw && /^\d+$/.test(pageRaw) ? Math.max(1, Number(pageRaw)) : 1;

  const query = buildBackendQuery(sp, page);
  const res = await apiServerPublic<PublicEnvelope<PublicListing[]>>(
    `/api/v1/public/listings?${query}`,
  );

  const listings = res?.data ?? [];
  const total = res?.meta?.total ?? listings.length;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  // Préserve les filtres dans les liens de pagination.
  function pageHref(p: number): string {
    const filtered = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const val = one(v);
      if (val && k !== "page") filtered.set(k, val);
    }
    filtered.set("page", String(p));
    return `/${lc}/properties?${filtered.toString()}`;
  }

  // Vue Liste ↔ Carte (préserve les filtres, repart page 1).
  const view = one(sp.view) === "map" ? "map" : "list";
  function viewHref(v: "list" | "map"): string {
    const filtered = new URLSearchParams();
    for (const [k, val] of Object.entries(sp)) {
      const s = one(val);
      if (s && k !== "page" && k !== "view") filtered.set(k, s);
    }
    if (v === "map") filtered.set("view", "map");
    return `/${lc}/properties?${filtered.toString()}`;
  }

  // Marqueurs (uniquement les annonces géolocalisées).
  const markers: PropertyMarker[] = listings
    .filter((l) => !!l.slug && typeof l.lat === "number" && typeof l.lng === "number")
    .map((l) => ({
      slug: l.slug as string,
      lat: l.lat as number,
      lng: l.lng as number,
      title: l.title ?? (l.slug as string),
      priceLabel: formatAed(Number(l.price)) + (l.deal === "rent" ? " /yr" : ""),
      dealLabel: l.deal === "sale" ? t("search.dealSale") : t("search.dealRent"),
      href: `/${lc}/property/${l.slug}`,
    }));

  return (
    <PublicShell locale={lc}>
      <section className="sgi-container" style={{ paddingBlock: "var(--page-py)", display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
        <div>
          <h1 style={{ margin: "0 0 0.25rem", fontSize: "var(--h1-size)", color: "var(--ink)" }}>
            {t("nav.properties")}
          </h1>
          <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "0.9rem" }}>
            {t("filters.results", { count: total })}
          </p>
        </div>

        <SearchFilters
          locale={lc}
          labels={{
            keyword: t("search.keyword"),
            keywordPlaceholder: t("search.keywordPlaceholder"),
            deal: t("search.deal"),
            dealAny: t("search.dealAny"),
            dealSale: t("search.dealSale"),
            dealRent: t("search.dealRent"),
            unitType: t("search.unitType"),
            unitTypeAny: t("search.unitTypeAny"),
            bedrooms: t("search.bedrooms"),
            bedroomsAny: t("search.bedroomsAny"),
            priceMin: t("search.priceMin"),
            priceMax: t("search.priceMax"),
            submit: t("search.submit"),
            reset: t("search.reset"),
            sort: t("search.sort"),
            sortNewest: t("search.sortNewest"),
            sortPriceAsc: t("search.sortPriceAsc"),
            sortPriceDesc: t("search.sortPriceDesc"),
          }}
          initial={{
            q: one(sp.q),
            deal: one(sp.deal),
            unit_type: one(sp.unit_type),
            bedrooms: one(sp.bedrooms),
            price_min: one(sp.price_min),
            price_max: one(sp.price_max),
            sort: one(sp.sort),
          }}
        />

        {/* Bascule Liste / Carte (CSS logique, RTL-safe) */}
        <div style={{ display: "inline-flex", gap: 2, padding: 3, background: "var(--bg-cream)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", alignSelf: "flex-start" }}>
          <Link href={viewHref("list")} className={view === "list" ? "sgi-button sgi-button-primary" : "sgi-button sgi-button-ghost"} style={{ fontSize: "0.8rem", padding: "0.4rem 0.9rem" }}>
            {t("view.list")}
          </Link>
          <Link href={viewHref("map")} className={view === "map" ? "sgi-button sgi-button-primary" : "sgi-button sgi-button-ghost"} style={{ fontSize: "0.8rem", padding: "0.4rem 0.9rem" }}>
            {t("view.map")}
          </Link>
        </div>

        {view === "map" ? (
          <PropertyMap markers={markers} />
        ) : (
          <PropertyGrid listings={listings} locale={lc} />
        )}

        {view === "list" && totalPages > 1 ? (
          <nav style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem" }}>
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="sgi-button sgi-button-secondary">
                {t("pagination.previous")}
              </Link>
            ) : null}
            <span style={{ fontSize: "0.85rem", color: "var(--ink-3)" }}>
              {t("pagination.page", { page })} / {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="sgi-button sgi-button-secondary">
                {t("pagination.next")}
              </Link>
            ) : null}
          </nav>
        ) : null}
      </section>
    </PublicShell>
  );
}
