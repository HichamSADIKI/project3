"use client";

import React from "react";
import { Topbar, IcFinance, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";

// Câblé sur /api/admin/payments/requests → /api/v1/payments/requests.

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const TYPE_LABEL: Record<string, string> = {
  rent: "Loyer", charges: "Charges", deposit: "Caution",
  deposit_return: "Restitution", owner_payout: "Payout propriétaire", other: "Autre",
};
const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "En attente", color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  paid: { label: "Payé", color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  overdue: { label: "En retard", color: "var(--rose)", bg: "var(--rose-soft)" },
  cancelled: { label: "Annulé", color: "var(--ink-4)", bg: "var(--line-soft)" },
};

type Request = {
  id: string; reference: string; payment_type: string; status: string;
  amount_aed: string; due_date: string;
};

export function ScreenRealEstatePayments() {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Request>("/api/admin/payments/requests?limit=100");
  const { busy, error: actErr, run } = useRowAction(reload);
  const overdue = items.filter(p => p.status === "overdue").length;
  const payBtn: React.CSSProperties = { border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11.5, fontWeight: 600, background: "rgba(16,185,129,0.12)", color: "var(--emerald)" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_payments} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcFinance /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_payments}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? "Chargement…" : `${items.length} · ${overdue} en retard`}</div>
            </div>
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <IcPlus /> {t.add}
          </button>
        </div>
        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Erreur : {error}</div>}
        {actErr && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Action refusée : {actErr}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Référence</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Montant</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Échéance</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucune demande de paiement.</td></tr>
              )}
              {items.map(p => {
                const st = STATUS[p.status] ?? { label: p.status, color: "var(--ink-3)", bg: "var(--line-soft)" };
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{p.reference}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{TYPE_LABEL[p.payment_type] ?? p.payment_type}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink)" }}>{aed(Number(p.amount_aed))}</td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{p.due_date}</td>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span></td>
                    <td style={{ padding: "13px 16px", textAlign: "end" }}>
                      {(p.status === "pending" || p.status === "overdue")
                        ? (busy === p.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : <button onClick={() => run(p.id, `/api/admin/payments/requests/${p.id}/pay`, { method: "online" })} style={payBtn}>Encaisser</button>)
                        : <span style={{ color: "var(--ink-4)" }}>—</span>}
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
