"use client";

import React from "react";
import { Topbar, IcContract, IcPlus, IcCheck, IcClock } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique. Câblage à l'API /api/v1/contracts (+ /renew,
// /request-signature, /sync-signature) prévu lors d'une étape de wiring.

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: "Brouillon", color: "var(--ink-4)",   bg: "var(--line-soft)" },
  signed:    { label: "Signé",     color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  active:    { label: "Actif",     color: "var(--azure)",   bg: "rgba(56,132,255,0.12)" },
  expired:   { label: "Expiré",    color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  cancelled: { label: "Annulé",    color: "var(--rose)",    bg: "var(--rose-soft)" },
};

const SIGN: Record<string, { label: string; color: string }> = {
  none:    { label: "—",          color: "var(--ink-4)" },
  pending: { label: "En attente", color: "var(--gold-deep)" },
  signed:  { label: "Signé",      color: "var(--emerald)" },
};

const CONTRACTS = [
  { ref: "CNT-2026-0007", type: "rental", amount: 145000, status: "active", sign: "signed", end: "2026-12-31", renewed: false },
  { ref: "CNT-2026-0006", type: "sale", amount: 6400000, status: "signed", sign: "signed", end: "—", renewed: false },
  { ref: "CNT-2026-0005", type: "rental", amount: 98000, status: "expired", sign: "signed", end: "2026-06-15", renewed: false },
  { ref: "CNT-2026-0009", type: "rental", amount: 152250, status: "draft", sign: "pending", end: "2027-06-30", renewed: true },
  { ref: "CNT-2026-0004", type: "rental", amount: 88000, status: "draft", sign: "none", end: "2027-01-31", renewed: false },
];

export function ScreenRealEstateContracts() {
  const t = useT();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_contracts_re} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcContract /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_contracts_re}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                {CONTRACTS.length} · {CONTRACTS.filter(c => c.status === "expired").length} à renouveler
              </div>
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
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Montant</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Signature</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Échéance</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {CONTRACTS.map(c => {
                const st = STATUS[c.status];
                const sg = SIGN[c.sign];
                return (
                  <tr key={c.ref} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>
                      {c.ref}{c.renewed && <span style={{ marginInlineStart: 6, fontSize: 10, color: "var(--azure)" }}>↻ renouvelé</span>}
                    </td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{c.type === "rental" ? "Location" : "Vente"}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink)" }}>{aed(c.amount)}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: sg.color }}>
                        {c.sign === "signed" ? <IcCheck /> : c.sign === "pending" ? <IcClock /> : null}{sg.label}
                      </span>
                    </td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{c.end}</td>
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
