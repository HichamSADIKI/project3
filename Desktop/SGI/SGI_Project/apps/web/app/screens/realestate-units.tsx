"use client";

import React from "react";
import { Topbar, IcGrid, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";

// Câblé sur /api/admin/units → /api/v1/units.

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const TYPE_LABEL: Record<string, string> = {
  studio: "Studio", apartment_1br: "Appart. 1ch", apartment_2br: "Appart. 2ch",
  apartment_3br: "Appart. 3ch", apartment_4br_plus: "Appart. 4ch+", penthouse: "Penthouse",
  duplex: "Duplex", villa: "Villa", townhouse: "Townhouse", office: "Bureau",
  shop: "Local", warehouse: "Entrepôt", other: "Autre",
};
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  vacant: { label: "Vacant", color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  reserved: { label: "Réservé", color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  occupied: { label: "Occupé", color: "var(--azure)", bg: "rgba(56,132,255,0.12)" },
  maintenance: { label: "Maintenance", color: "var(--rose)", bg: "var(--rose-soft)" },
  renovation: { label: "Rénovation", color: "#a259ff", bg: "rgba(162,89,255,0.10)" },
  off_market: { label: "Hors marché", color: "var(--ink-4)", bg: "var(--line-soft)" },
};

type Unit = {
  id: string; unit_number: string; unit_type: string; status: string;
  list_rent_aed: string | null;
};

export function ScreenRealEstateUnits() {
  const t = useT();
  const { items, loading, error } = useApiList<Unit>("/api/admin/units?limit=100");
  const vacant = items.filter(u => u.status === "vacant").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_units} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcGrid /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_units}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? "Chargement…" : `${items.length} · ${vacant} vacant(s)`}</div>
            </div>
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <IcPlus /> {t.add}
          </button>
        </div>
        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Erreur : {error}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>N° Unité</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Loyer / an</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={4} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucune unité.</td></tr>
              )}
              {items.map(u => {
                const st = STATUS_STYLE[u.status] ?? { label: u.status, color: "var(--ink-3)", bg: "var(--line-soft)" };
                const rent = u.list_rent_aed ? Number(u.list_rent_aed) : 0;
                return (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{u.unit_number}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{TYPE_LABEL[u.unit_type] ?? u.unit_type}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink)" }}>{rent > 0 ? aed(rent) : "—"}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
