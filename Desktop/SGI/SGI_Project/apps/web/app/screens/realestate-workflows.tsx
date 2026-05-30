"use client";

import React from "react";
import { Topbar, IcAudit } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";

// Câblé sur /api/admin/workflows/instances → /api/v1/workflows/instances.

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: "En cours", color: "var(--azure)", bg: "rgba(56,132,255,0.12)" },
  approved: { label: "Approuvé", color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  rejected: { label: "Rejeté", color: "var(--rose)", bg: "var(--rose-soft)" },
  cancelled: { label: "Annulé", color: "var(--ink-4)", bg: "var(--line-soft)" },
};

type Step = { status: string };
type Instance = {
  id: string; status: string;
  maintenance_ticket_id: string | null; maintenance_quote_id: string | null;
  contract_id: string | null; steps?: Step[];
};

function linkedObject(w: Instance): string {
  if (w.maintenance_quote_id) return `Devis ${w.maintenance_quote_id.slice(0, 8)}…`;
  if (w.maintenance_ticket_id) return `Ticket ${w.maintenance_ticket_id.slice(0, 8)}…`;
  if (w.contract_id) return `Contrat ${w.contract_id.slice(0, 8)}…`;
  return "—";
}

export function ScreenRealEstateWorkflows() {
  const t = useT();
  const { items, loading, error } = useApiList<Instance>("/api/admin/workflows/instances?limit=100");
  const inProgress = items.filter(i => i.status === "in_progress").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_workflows} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{ color: "var(--gold)" }}><IcAudit /></span>
          <div>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_workflows}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? "Chargement…" : `${items.length} · ${inProgress} en cours`}</div>
          </div>
        </div>
        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Erreur : {error}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Instance</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Objet lié</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Étapes</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={4} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucune instance de workflow.</td></tr>
              )}
              {items.map(w => {
                const st = STATUS[w.status] ?? { label: w.status, color: "var(--ink-3)", bg: "var(--line-soft)" };
                return (
                  <tr key={w.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{w.id.slice(0, 8)}…</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink)" }}>{linkedObject(w)}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{w.steps?.length ?? "—"}</td>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span></td>
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
