"use client";

import React from "react";
import { Topbar, IcFinance, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";

// Câblé sur /api/admin/payments/requests → /api/v1/payments/requests.

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const typeLabel = (t: Translations, k: string): string =>
  ({
    rent: t.pt_rent, charges: t.pt_charges, deposit: t.pt_deposit,
    deposit_return: t.pt_deposit_return, owner_payout: t.pt_owner_payout, other: t.pt_other,
  })[k] ?? k;
// Couleurs/fonds du badge (le label vient de t.*).
const STATUS: Record<string, { color: string; bg: string }> = {
  pending: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  paid: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  overdue: { color: "var(--rose)", bg: "var(--rose-soft)" },
  cancelled: { color: "var(--ink-4)", bg: "var(--line-soft)" },
};
const statusLabel = (t: Translations, k: string): string =>
  ({ pending: t.pay_pending, paid: t.pay_paid, overdue: t.pay_overdue, cancelled: t.pay_cancelled })[k] ?? k;

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
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${items.length} · ${overdue} ${t.payments_overdue_count}`}</div>
            </div>
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <IcPlus /> {t.add}
          </button>
        </div>
        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {error}</div>}
        {actErr && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.action_refused} : {actErr}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_reference}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_type}</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_amount}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_due_date}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_status}</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_action}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.empty_payments}</td></tr>
              )}
              {items.map(p => {
                const st = STATUS[p.status] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
                return (
                  <tr key={p.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{p.reference}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{typeLabel(t, p.payment_type)}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink)" }}>{aed(Number(p.amount_aed))}</td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{p.due_date}</td>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{statusLabel(t, p.status)}</span></td>
                    <td style={{ padding: "13px 16px", textAlign: "end" }}>
                      {(p.status === "pending" || p.status === "overdue")
                        ? (busy === p.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : <button onClick={() => run(p.id, `/api/admin/payments/requests/${p.id}/pay`, { method: "online" })} style={payBtn}>{t.pay_collect}</button>)
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
