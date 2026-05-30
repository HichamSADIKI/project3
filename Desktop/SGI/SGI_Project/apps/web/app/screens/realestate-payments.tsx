"use client";

import React from "react";
import { Topbar, IcFinance, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique. Câblage à l'API /api/v1/payments/requests ultérieur.

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const TYPE_LABEL: Record<string, string> = {
  rent: "Loyer", charges: "Charges", deposit: "Caution",
  deposit_return: "Restitution", owner_payout: "Payout propriétaire", other: "Autre",
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "En attente", color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  paid:      { label: "Payé",       color: "var(--emerald)",  bg: "rgba(16,185,129,0.12)" },
  overdue:   { label: "En retard",  color: "var(--rose)",     bg: "var(--rose-soft)" },
  cancelled: { label: "Annulé",     color: "var(--ink-4)",    bg: "var(--line-soft)" },
};

const PAYMENTS = [
  { ref: "PAY-2026-000142", type: "rent", amount: 145000, due: "2026-06-01", status: "pending" },
  { ref: "PAY-2026-000141", type: "rent", amount: 98000, due: "2026-05-01", status: "paid" },
  { ref: "PAY-2026-000138", type: "charges", amount: 12000, due: "2026-05-15", status: "overdue" },
  { ref: "PAY-2026-000130", type: "owner_payout", amount: 424000, due: "2026-05-05", status: "paid" },
  { ref: "PAY-2026-000125", type: "deposit", amount: 29000, due: "2026-04-20", status: "paid" },
];

export function ScreenRealEstatePayments() {
  const t = useT();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_payments} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcFinance /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_payments}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                {PAYMENTS.length} · {PAYMENTS.filter(p => p.status === "overdue").length} en retard
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
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Échéance</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {PAYMENTS.map(p => {
                const st = STATUS[p.status];
                return (
                  <tr key={p.ref} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{p.ref}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{TYPE_LABEL[p.type]}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink)" }}>{aed(p.amount)}</td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{p.due}</td>
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
