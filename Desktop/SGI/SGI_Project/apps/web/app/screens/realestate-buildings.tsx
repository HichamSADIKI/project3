"use client";

import React from "react";
import { Topbar, IcProp, IcPlus, IcPin } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique. Câblage à l'API /api/v1/buildings (+ /occupancy)
// prévu lors d'une étape de wiring ultérieure.

const EMIRATE_LABEL: Record<string, string> = {
  DXB: "Dubai", AUH: "Abu Dhabi", SHJ: "Sharjah", AJM: "Ajman",
  RAK: "Ras Al Khaimah", FUJ: "Fujairah", UAQ: "Umm Al Quwain",
};

const TYPE_LABEL: Record<string, string> = {
  residential_tower: "Tour résidentielle", villa_compound: "Compound villas",
  mixed_use: "Usage mixte", commercial: "Commercial", warehouse: "Entrepôt",
};

const BUILDINGS = [
  { ref: "BLD-DXB-MARINA-A", name: "Marina Tower A", type: "residential_tower", emirate: "DXB", units: 84, occupancy: 92 },
  { ref: "BLD-DXB-BAY-01", name: "Bay Residences", type: "mixed_use", emirate: "DXB", units: 56, occupancy: 78 },
  { ref: "BLD-AUH-CORN-1", name: "Corniche Heights", type: "residential_tower", emirate: "AUH", units: 120, occupancy: 64 },
  { ref: "CMP-DXB-HILLS", name: "Emirates Hills Compound", type: "villa_compound", emirate: "DXB", units: 18, occupancy: 100 },
];

function occColor(pct: number): string {
  if (pct >= 85) return "var(--emerald)";
  if (pct >= 60) return "var(--gold)";
  return "var(--rose)";
}

export function ScreenRealEstateBuildings() {
  const t = useT();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_buildings} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcProp /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_buildings}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{BUILDINGS.length} · {BUILDINGS.reduce((s, b) => s + b.units, 0)} unités</div>
            </div>
          </div>
          <button style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 16px",
            background: "var(--gold)", color: "#1A1610", border: "none",
            borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            <IcPlus /> {t.add}
          </button>
        </div>

        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Référence</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.nav_buildings}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Emirate</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.nav_units}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Occupation</th>
              </tr>
            </thead>
            <tbody>
              {BUILDINGS.map(b => (
                <tr key={b.ref} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{b.ref}</td>
                  <td style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink)" }}>{b.name}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{TYPE_LABEL[b.type]}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-3)" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><IcPin /> {EMIRATE_LABEL[b.emirate]}</span>
                  </td>
                  <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{b.units}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ flex: 1, maxWidth: 110, height: 6, borderRadius: 999, background: "var(--line-soft)", overflow: "hidden" }}>
                        <div style={{ width: `${b.occupancy}%`, height: "100%", background: occColor(b.occupancy) }} />
                      </div>
                      <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: occColor(b.occupancy) }}>{b.occupancy}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
