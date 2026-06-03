"use client";

import React from "react";
import { Topbar, IcPin } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { ReMap, type MapMarker } from "@/components/re-map";

// Sous-catégorie « Carte » : vue géographique globale de tous les actifs
// localisés. Source actuelle = buildings (PostGIS). À enrichir avec les unités
// / annonces dès qu'elles exposent des coordonnées.

const EMIRATE_LABEL: Record<string, string> = {
  DXB: "Dubai", AUH: "Abu Dhabi", SHJ: "Sharjah", AJM: "Ajman",
  RAK: "Ras Al Khaimah", FUJ: "Fujairah", UAQ: "Umm Al Quwain",
};

type GeoBuilding = {
  id: string; reference: string; name_ar: string | null; name_en: string | null;
  name_fr: string | null; emirate: string; location: { lat: number; lng: number } | null;
};

export function ScreenRealEstateMap() {
  const t = useT();
  const { items, loading } = useApiList<GeoBuilding>("/api/admin/buildings?limit=500");

  const markers: MapMarker[] = items
    .filter((b) => b.location)
    .map((b) => ({
      id: b.id,
      lat: b.location!.lat,
      lng: b.location!.lng,
      title: b.name_en || b.name_fr || b.name_ar || b.reference,
      subtitle: b.reference,
      badge: EMIRATE_LABEL[b.emirate] ?? b.emirate,
    }));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_map} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{ color: "var(--gold)" }}><IcPin /></span>
          <div>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_map}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
              {loading ? t.loading : `${markers.length} ${t.map_assets} · ${t.map_subtitle}`}
            </div>
          </div>
        </div>
        <ReMap markers={markers} height={620} emptyLabel={t.map_empty} />
      </div>
    </div>
  );
}
