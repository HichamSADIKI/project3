"use client";

import React from "react";
import { Topbar, IcClients, IcPlus, IcCheck, IcBell } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique. Câblage à l'API /api/v1/owners/{id}/statements
// (+ notifications) prévu lors d'une étape de wiring ultérieure.

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const OWNERS = [
  { name: "Yousef Rahman", mandate: "active", period: "2026-04", gross: 480000, expenses: 32000, commission: 24000, net: 424000, statement: "sent", notified: true },
  { name: "Aisha Al Suwaidi", mandate: "active", period: "2026-04", gross: 145000, expenses: 8000, commission: 7250, net: 129750, statement: "draft", notified: false },
  { name: "Infinity Holdings LLC", mandate: "active", period: "2026-04", gross: 1120000, expenses: 96000, commission: 56000, net: 968000, statement: "sent", notified: true },
  { name: "Mariam Khouri", mandate: "expiring", period: "2026-03", gross: 88000, expenses: 5000, commission: 4400, net: 78600, statement: "draft", notified: false },
];

const STMT: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "var(--ink-4)", bg: "var(--line-soft)" },
  sent:  { label: "Envoyé",    color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
};

export function ScreenRealEstateOwners() {
  const t = useT();
  const totalNet = OWNERS.reduce((s, o) => s + o.net, 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_owners} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcClients /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_owners}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{OWNERS.length} · payout net total {aed(totalNet)}</div>
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
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Propriétaire</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Période</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Revenus</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Dépenses</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Commission</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Payout net</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Relevé</th>
              </tr>
            </thead>
            <tbody>
              {OWNERS.map(o => {
                const st = STMT[o.statement];
                return (
                  <tr key={o.name} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink)" }}>
                      {o.name}
                      {o.mandate === "expiring" && <span style={{ marginInlineStart: 6, fontSize: 10, color: "var(--rose)" }}>⚠ mandat</span>}
                    </td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{o.period}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{aed(o.gross)}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--rose)" }}>−{aed(o.expenses)}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--gold-deep)" }}>−{aed(o.commission)}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", fontWeight: 700, color: "var(--emerald)" }}>{aed(o.net)}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                        {o.notified ? <span title="Notifié" style={{ color: "var(--emerald)" }}><IcCheck /></span> : <span title="Non notifié" style={{ color: "var(--ink-4)" }}><IcBell /></span>}
                      </span>
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
