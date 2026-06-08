"use client";

/**
 * Carte interactive des biens — recherche géospatiale par rayon (PostGIS
 * ST_DWithin, Loi 2) autour d'un centre choisi. Câblé sur
 *   POST /api/admin/properties/search/radius → /api/v1/properties/search/radius.
 * Carte Leaflet via le wrapper SSR-off `ReMap`. CSS logique (Loi 3). i18n local.
 */
import React, { useCallback, useEffect, useState } from "react";

import { Topbar, IcPin } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { postJson, extractError } from "@/lib/api-client";
import { ReMap, type MapMarker } from "@/components/re-map";
import { PropertyCsvImport } from "@/components/property-csv-import";
import { PropertyUrlImport } from "@/components/property-url-import";
import {
  toMarkers,
  propertyTitle,
  formatPriceAED,
  formatDistance,
  type RadiusProperty,
} from "@/lib/properties-map";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Carte des biens", center: "Centre", radius: "Rayon", type: "Type", allTypes: "Tous types",
    minPrice: "Prix min", maxPrice: "Prix max", bedrooms: "Chambres", search: "Rechercher",
    results: "résultats", loading: "Recherche…", empty: "Aucun bien dans ce rayon",
    error: "Échec de la recherche", any: "Indifférent",
  },
  en: {
    title: "Properties map", center: "Center", radius: "Radius", type: "Type", allTypes: "All types",
    minPrice: "Min price", maxPrice: "Max price", bedrooms: "Bedrooms", search: "Search",
    results: "results", loading: "Searching…", empty: "No property in this radius",
    error: "Search failed", any: "Any",
  },
  ar: {
    title: "خريطة العقارات", center: "المركز", radius: "النطاق", type: "النوع", allTypes: "كل الأنواع",
    minPrice: "أدنى سعر", maxPrice: "أعلى سعر", bedrooms: "غرف", search: "بحث",
    results: "نتائج", loading: "جارٍ البحث…", empty: "لا عقار ضمن هذا النطاق",
    error: "فشل البحث", any: "الكل",
  },
};

// Centres prédéfinis (chiffres latins, WGS84).
const CENTERS: { key: string; label: string; lat: number; lng: number }[] = [
  { key: "dubai", label: "Dubai", lat: 25.2048, lng: 55.2708 },
  { key: "abudhabi", label: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
  { key: "sharjah", label: "Sharjah", lat: 25.3463, lng: 55.4209 },
];

const PROPERTY_TYPES = ["apartment", "villa", "townhouse", "office", "retail", "land"];
const RADII_KM = [2, 5, 10, 25, 50];

const fieldInput: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 8, border: "1px solid var(--line-soft)",
  background: "var(--bg-paper)", color: "var(--ink)", fontSize: 13, width: "auto",
};

export function ScreenRealEstatePropertiesMap(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [centerKey, setCenterKey] = useState("dubai");
  const [radiusKm, setRadiusKm] = useState(10);
  const [type, setType] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");

  const [items, setItems] = useState<RadiusProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async () => {
    const center = CENTERS.find((c) => c.key === centerKey) ?? CENTERS[0];
    setLoading(true);
    setError(null);
    try {
      const res = await postJson("/api/admin/properties/search/radius", {
        latitude: center.lat,
        longitude: center.lng,
        radius_m: radiusKm * 1000,
        type: type || undefined,
        min_price: minPrice ? Number(minPrice) : undefined,
        max_price: maxPrice ? Number(maxPrice) : undefined,
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        limit: 100,
      });
      if (!res.ok) {
        setError(await extractError(res, L("error")));
        setItems([]);
        return;
      }
      const body = (await res.json()) as { data: RadiusProperty[] };
      setItems(body.data ?? []);
    } catch {
      setError(L("error"));
      setItems([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey, radiusKm, type, minPrice, maxPrice, bedrooms]);

  useEffect(() => {
    void search();
    // recherche initiale + à chaque changement de centre/rayon
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey, radiusKm]);

  const markers: MapMarker[] = toMarkers(items);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={L("title")} />
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBlockEnd: 18, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcPin /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{L("title")}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                {loading ? L("loading") : `${markers.length} ${L("results")}`}
              </div>
            </div>
          </div>
          <PropertyUrlImport />
          <PropertyCsvImport onDone={() => void search()} />
        </div>

        {/* Barre de recherche par rayon */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end", marginBlockEnd: 16 }}>
          <label style={{ fontSize: 11.5, color: "var(--ink-4)", display: "flex", flexDirection: "column", gap: 4 }}>
            {L("center")}
            <select value={centerKey} onChange={(e) => setCenterKey(e.target.value)} style={fieldInput}>
              {CENTERS.map((c) => (<option key={c.key} value={c.key}>{c.label}</option>))}
            </select>
          </label>
          <label style={{ fontSize: 11.5, color: "var(--ink-4)", display: "flex", flexDirection: "column", gap: 4 }}>
            {L("radius")} (km)
            <select value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} style={fieldInput}>
              {RADII_KM.map((r) => (<option key={r} value={r}>{r}</option>))}
            </select>
          </label>
          <label style={{ fontSize: 11.5, color: "var(--ink-4)", display: "flex", flexDirection: "column", gap: 4 }}>
            {L("type")}
            <select value={type} onChange={(e) => setType(e.target.value)} style={fieldInput}>
              <option value="">{L("allTypes")}</option>
              {PROPERTY_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
            </select>
          </label>
          <label style={{ fontSize: 11.5, color: "var(--ink-4)", display: "flex", flexDirection: "column", gap: 4 }}>
            {L("minPrice")}
            <input type="number" value={minPrice} onChange={(e) => setMinPrice(e.target.value)} style={{ ...fieldInput, width: 120 }} />
          </label>
          <label style={{ fontSize: 11.5, color: "var(--ink-4)", display: "flex", flexDirection: "column", gap: 4 }}>
            {L("maxPrice")}
            <input type="number" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)} style={{ ...fieldInput, width: 120 }} />
          </label>
          <label style={{ fontSize: 11.5, color: "var(--ink-4)", display: "flex", flexDirection: "column", gap: 4 }}>
            {L("bedrooms")}
            <input type="number" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} style={{ ...fieldInput, width: 90 }} />
          </label>
          <button onClick={() => void search()} style={{ padding: "9px 18px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {L("search")}
          </button>
        </div>

        {error && (
          <div style={{ padding: "10px 14px", marginBlockEnd: 14, borderRadius: 8, background: "var(--rose-soft, rgba(214,69,93,0.12))", color: "var(--rose)", fontSize: 13 }}>{error}</div>
        )}

        <ReMap markers={markers} emptyLabel={L("empty")} />

        {/* Liste des résultats, triés par distance (renvoyés ainsi par le backend) */}
        <div style={{ marginBlockStart: 16, display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((p) => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink)" }}>{propertyTitle(p)}</div>
                <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                  {[p.city, p.reference].filter(Boolean).join(" · ")}
                </div>
              </div>
              <div style={{ textAlign: "end", flexShrink: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "var(--ink)" }}>{formatPriceAED(p.price)}</div>
                <div style={{ fontSize: 11.5, color: "var(--gold-deep, #8a6d2f)" }}>{formatDistance(p.dist_m)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
