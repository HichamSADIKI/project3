"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@/lib/i18n";

export interface SearchFiltersLabels {
  keyword: string;
  keywordPlaceholder: string;
  deal: string;
  dealAny: string;
  dealSale: string;
  dealRent: string;
  unitType: string;
  unitTypeAny: string;
  bedrooms: string;
  bedroomsAny: string;
  priceMin: string;
  priceMax: string;
  submit: string;
  reset: string;
  sort: string;
  sortNewest: string;
  sortPriceAsc: string;
  sortPriceDesc: string;
}

export interface SearchFiltersInitial {
  q?: string;
  deal?: string;
  unit_type?: string;
  bedrooms?: string;
  price_min?: string;
  price_max?: string;
  sort?: string;
}

const UNIT_TYPES = ["apartment", "villa", "townhouse", "penthouse", "office", "studio", "land"] as const;

/**
 * Barre de recherche/filtres — Client Component.
 * Pousse l'état dans l'URL (searchParams) via le router → la page (Server
 * Component) re-fetch côté serveur. RTL strict (CSS logique).
 * Saisie compacte ; soumission par navigation pour rester SSR/SEO friendly.
 */
export function SearchFilters({
  locale,
  labels,
  initial,
  /** Si défini, redirige vers cette page (ex: depuis le hero de l'accueil). */
  targetPath,
}: {
  locale: Locale;
  labels: SearchFiltersLabels;
  initial?: SearchFiltersInitial;
  targetPath?: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState(initial?.q ?? "");
  const [deal, setDeal] = useState(initial?.deal ?? "");
  const [unitType, setUnitType] = useState(initial?.unit_type ?? "");
  const [bedrooms, setBedrooms] = useState(initial?.bedrooms ?? "");
  const [priceMin, setPriceMin] = useState(initial?.price_min ?? "");
  const [priceMax, setPriceMax] = useState(initial?.price_max ?? "");
  const [sort, setSort] = useState(initial?.sort ?? "newest");

  function buildQuery(): string {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (deal) params.set("deal", deal);
    if (unitType) params.set("unit_type", unitType);
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (priceMin) params.set("price_min", priceMin);
    if (priceMax) params.set("price_max", priceMax);
    if (sort && sort !== "newest") params.set("sort", sort);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const base = targetPath ?? `/${locale}/properties`;
    router.push(`${base}${buildQuery()}`);
  }

  function onReset() {
    setQ("");
    setDeal("");
    setUnitType("");
    setBedrooms("");
    setPriceMin("");
    setPriceMax("");
    setSort("newest");
    router.push(targetPath ?? `/${locale}/properties`);
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sgi-card"
      style={{
        display: "grid",
        gap: "0.75rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 160px), 1fr))",
        alignItems: "end",
      }}
    >
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="sgi-label" htmlFor="q">{labels.keyword}</label>
        <input
          id="q"
          className="sgi-input"
          value={q}
          placeholder={labels.keywordPlaceholder}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div>
        <label className="sgi-label" htmlFor="deal">{labels.deal}</label>
        <select id="deal" className="sgi-input" value={deal} onChange={(e) => setDeal(e.target.value)}>
          <option value="">{labels.dealAny}</option>
          <option value="sale">{labels.dealSale}</option>
          <option value="rent">{labels.dealRent}</option>
        </select>
      </div>

      <div>
        <label className="sgi-label" htmlFor="ut">{labels.unitType}</label>
        <select id="ut" className="sgi-input" value={unitType} onChange={(e) => setUnitType(e.target.value)}>
          <option value="">{labels.unitTypeAny}</option>
          {UNIT_TYPES.map((u) => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="sgi-label" htmlFor="bd">{labels.bedrooms}</label>
        <select id="bd" className="sgi-input" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)}>
          <option value="">{labels.bedroomsAny}</option>
          {[0, 1, 2, 3, 4, 5].map((b) => (
            <option key={b} value={String(b)}>{b === 5 ? "5+" : b}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="sgi-label" htmlFor="pmin">{labels.priceMin}</label>
        <input id="pmin" type="number" min="0" inputMode="numeric" className="sgi-input" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
      </div>

      <div>
        <label className="sgi-label" htmlFor="pmax">{labels.priceMax}</label>
        <input id="pmax" type="number" min="0" inputMode="numeric" className="sgi-input" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
      </div>

      <div>
        <label className="sgi-label" htmlFor="sort">{labels.sort}</label>
        <select id="sort" className="sgi-input" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="newest">{labels.sortNewest}</option>
          <option value="price_asc">{labels.sortPriceAsc}</option>
          <option value="price_desc">{labels.sortPriceDesc}</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: "0.5rem", gridColumn: "1 / -1" }}>
        <button type="submit" className="sgi-button sgi-button-primary" style={{ flex: 1 }}>
          {labels.submit}
        </button>
        <button type="button" onClick={onReset} className="sgi-button sgi-button-secondary">
          {labels.reset}
        </button>
      </div>
    </form>
  );
}
