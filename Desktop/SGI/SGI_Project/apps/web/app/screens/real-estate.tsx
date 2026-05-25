"use client";

import React from "react";
import { Topbar, IcProp, IcContract, IcRental, IcVisa, IcArrowUp } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

const aed = (n: number) => new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency", maximumFractionDigits: 0 }).format(n);

const METRICS = [
  { icon: <IcProp />, labelKey: "nav_prop" as const, value: "1 284", sub: "active listings", delta: "+3.2%", up: true, color: "var(--gold)" },
  { icon: <IcContract />, labelKey: "nav_contract" as const, value: "87", sub: "contracts this month", delta: "+12%", up: true, color: "var(--azure)" },
  { icon: <IcRental />, labelKey: "nav_rental" as const, value: "342", sub: "active rentals", delta: "-1.4%", up: false, color: "var(--emerald)" },
  { icon: <IcVisa />, labelKey: "nav_visa" as const, value: "23", sub: "pending applications", delta: "+8", up: true, color: "var(--gold)" },
];

const RECENT = [
  { ref: "DXB-2024-1182", type: "Villa", loc: "Palm Jumeirah", price: 6_400_000, status: "Under Offer", statusColor: "var(--gold)" },
  { ref: "DXB-2024-1179", type: "Apartment", loc: "Downtown Dubai", price: 2_150_000, status: "Available", statusColor: "var(--emerald)" },
  { ref: "DXB-2024-1175", type: "Office", loc: "DIFC", price: 3_800_000, status: "Reserved", statusColor: "var(--azure)" },
  { ref: "DXB-2024-1168", type: "Penthouse", loc: "Business Bay", price: 11_200_000, status: "Available", statusColor: "var(--emerald)" },
  { ref: "DXB-2024-1160", type: "Villa", loc: "Emirates Hills", price: 22_500_000, status: "Sold", statusColor: "var(--ink-4)" },
];

export function ScreenRealEstate() {
  const t = useT();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_realestate} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16, marginBottom: 28 }}>
          {METRICS.map(m => (
            <div key={m.labelKey} style={{
              background: "var(--bg-paper)", border: "1px solid var(--line-soft)",
              borderRadius: "var(--r)", padding: "20px 22px",
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: m.color, opacity: 0.85 }}>{m.icon}</span>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
                  background: m.up ? "var(--emerald-soft, rgba(16,185,129,0.1))" : "var(--rose-soft)",
                  color: m.up ? "var(--emerald)" : "var(--rose)",
                  display: "flex", alignItems: "center", gap: 4,
                }}>
                  {m.up ? <IcArrowUp /> : null}{m.delta}
                </span>
              </div>
              <div className="tnum" style={{ fontSize: 32, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{m.value}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{t[m.labelKey]}</div>
            </div>
          ))}
        </div>

        {/* Volume banner */}
        <div style={{
          background: "linear-gradient(120deg, #1A1610 0%, #2d2310 60%, #3a2d18 100%)",
          borderRadius: "var(--r)", padding: "24px 28px", marginBottom: 28,
          display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16,
        }}>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold)", opacity: 0.75, marginBottom: 6 }}>May 2026 · Sales Volume</div>
            <div className="font-display tnum" style={{ fontSize: 36, color: "#fff", letterSpacing: "0.02em" }}>AED 24.5M</div>
          </div>
          <div style={{ display: "flex", gap: 32 }}>
            {[
              { label: "Avg. Price", value: aed(2_850_000) },
              { label: "Transactions", value: "87" },
              { label: "Days on Market", value: "21" },
            ].map(s => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div className="tnum" style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>{s.value}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent listings */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="font-display" style={{ fontSize: 14, color: "var(--ink)" }}>Recent Listings</div>
            <span style={{ fontSize: 11, color: "var(--gold)", cursor: "pointer" }}>{t.view_all}</span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)" }}>
                {["Reference", "Type", "Location", "Price (AED)", "Status"].map(h => (
                  <th key={h} style={{ padding: "10px 20px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECENT.map((r, i) => (
                <tr key={r.ref} style={{ borderBottom: i < RECENT.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                  <td style={{ padding: "13px 20px", fontSize: 12.5, color: "var(--gold-deep)", fontWeight: 500 }}>{r.ref}</td>
                  <td style={{ padding: "13px 20px", fontSize: 12.5, color: "var(--ink-2)" }}>{r.type}</td>
                  <td style={{ padding: "13px 20px", fontSize: 12.5, color: "var(--ink-3)" }}>{r.loc}</td>
                  <td style={{ padding: "13px 20px", fontSize: 12.5, color: "var(--ink)", fontWeight: 600 }} className="tnum">{aed(r.price)}</td>
                  <td style={{ padding: "13px 20px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: `${r.statusColor}18`, color: r.statusColor }}>{r.status}</span>
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
