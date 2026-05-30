"use client";

import React from "react";
import { Topbar, IcReport, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";

// Câblé sur /api/admin/pdc → /api/v1/pdc.

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "À déposer", color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  deposited: { label: "Déposé", color: "var(--azure)", bg: "rgba(56,132,255,0.12)" },
  cleared: { label: "Encaissé", color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  bounced: { label: "Rejeté", color: "var(--rose)", bg: "var(--rose-soft)" },
  replaced: { label: "Remplacé", color: "var(--ink-3)", bg: "var(--line-soft)" },
  cancelled: { label: "Annulé", color: "var(--ink-4)", bg: "var(--line-soft)" },
};

type Pdc = {
  id: string; reference: string; cheque_number: string; bank_name: string;
  amount_aed: string; due_date: string; status: string; legal_notices_sent: number;
};

export function ScreenRealEstateCheques() {
  const t = useT();
  const { items, loading, error } = useApiList<Pdc>("/api/admin/pdc?limit=100");
  const outstanding = items.filter(c => ["pending", "deposited"].includes(c.status)).reduce((s, c) => s + Number(c.amount_aed), 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_cheques} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcReport /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_cheques}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? "Chargement…" : `encours ${aed(outstanding)} · ${items.length} chèque(s)`}</div>
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
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Référence</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>N° chèque</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Banque</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Montant</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Échéance</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucun chèque.</td></tr>
              )}
              {items.map(c => {
                const st = STATUS[c.status] ?? { label: c.status, color: "var(--ink-3)", bg: "var(--line-soft)" };
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{c.reference}</td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{c.cheque_number}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{c.bank_name}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink)" }}>{aed(Number(c.amount_aed))}</td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{c.due_date}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                      {c.legal_notices_sent > 0 && <span style={{ marginInlineStart: 6, fontSize: 10, color: "var(--rose)" }}>⚖ {c.legal_notices_sent}</span>}
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
