"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ic, Svg } from "./icons";

export interface ZoiSearchLabels {
  title: string;
  any: string;
  buy: string;
  rent: string;
  location: string;
  type: string;
  price: string;
  bedrooms: string;
  search: string;
}

const UNIT_TYPES = [
  "apartment",
  "villa",
  "townhouse",
  "penthouse",
  "office",
  "studio",
  "land",
] as const;
const PRICE_RANGES: Array<[string, string, string]> = [
  // [label-suffix, min, max]
  ["< 1M", "", "1000000"],
  ["1M – 2M", "1000000", "2000000"],
  ["2M – 5M", "2000000", "5000000"],
  ["5M+", "5000000", ""],
];

/**
 * Panneau de recherche luxe (hero template 01). Pousse les filtres dans l'URL
 * `/properties` (mêmes paramètres que SearchFilters) → re-fetch SSR.
 */
export function ZoiSearchBox({
  locale,
  labels,
}: {
  locale: string;
  labels: ZoiSearchLabels;
}) {
  const router = useRouter();
  const [deal, setDeal] = useState<"" | "sale" | "rent">("");
  const [q, setQ] = useState("");
  const [unitType, setUnitType] = useState("");
  const [priceIdx, setPriceIdx] = useState("");
  const [bedrooms, setBedrooms] = useState("");

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (deal) params.set("deal", deal);
    if (unitType) params.set("unit_type", unitType);
    if (bedrooms) params.set("bedrooms", bedrooms);
    if (priceIdx !== "") {
      const [, min, max] = PRICE_RANGES[Number(priceIdx)];
      if (min) params.set("price_min", min);
      if (max) params.set("price_max", max);
    }
    const qs = params.toString();
    router.push(`/${locale}/properties${qs ? `?${qs}` : ""}`);
  }

  return (
    <form className="z-searchbox" onSubmit={onSubmit}>
      <h3>{labels.title}</h3>
      <div className="z-seg">
        {(
          [
            ["", labels.any],
            ["sale", labels.buy],
            ["rent", labels.rent],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k || "any"}
            type="button"
            className={deal === k ? "on" : ""}
            onClick={() => setDeal(k)}
          >
            {l}
          </button>
        ))}
      </div>

      <div className="z-field">
        <input
          value={q}
          placeholder={labels.location}
          onChange={(e) => setQ(e.target.value)}
          aria-label={labels.location}
        />
      </div>

      <div className="z-field">
        <select
          value={unitType}
          onChange={(e) => setUnitType(e.target.value)}
          aria-label={labels.type}
        >
          <option value="">{labels.type}</option>
          {UNIT_TYPES.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <span className="z-chev">
          <Svg d={Ic.chev} w={18} />
        </span>
      </div>

      <div className="z-field">
        <select
          value={priceIdx}
          onChange={(e) => setPriceIdx(e.target.value)}
          aria-label={labels.price}
        >
          <option value="">{labels.price}</option>
          {PRICE_RANGES.map(([lbl], i) => (
            <option key={lbl} value={String(i)}>
              AED {lbl}
            </option>
          ))}
        </select>
        <span className="z-chev">
          <Svg d={Ic.chev} w={18} />
        </span>
      </div>

      <div className="z-field">
        <select
          value={bedrooms}
          onChange={(e) => setBedrooms(e.target.value)}
          aria-label={labels.bedrooms}
        >
          <option value="">{labels.bedrooms}</option>
          {[0, 1, 2, 3, 4, 5].map((b) => (
            <option key={b} value={String(b)}>
              {b === 5 ? "5+" : b}
            </option>
          ))}
        </select>
        <span className="z-chev">
          <Svg d={Ic.chev} w={18} />
        </span>
      </div>

      <button type="submit" className="z-btn z-btn-gold z-btn-lg">
        <Svg d={Ic.arrow} w={17} /> {labels.search}
      </button>
    </form>
  );
}
