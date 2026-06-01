"use client";

import React from "react";
import { Topbar, IcAudit, IcCheck, IcClose } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";

// Câblé sur /api/admin/workflows/instances → /api/v1/workflows/instances.

const aBtn = (color: string, bg: string): React.CSSProperties => ({ border: "none", borderRadius: 8, padding: "5px 9px", cursor: "pointer", background: bg, color });

// Couleurs/fonds du badge (le label vient de t.*).
const STATUS: Record<string, { color: string; bg: string }> = {
  in_progress: { color: "var(--azure)", bg: "rgba(56,132,255,0.12)" },
  approved: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  rejected: { color: "var(--rose)", bg: "var(--rose-soft)" },
  cancelled: { color: "var(--ink-4)", bg: "var(--line-soft)" },
};
const statusLabel = (t: Translations, k: string): string =>
  ({ in_progress: t.wf_in_progress, approved: t.wf_approved, rejected: t.wf_rejected, cancelled: t.wf_cancelled })[k] ?? k;

type Step = { id: string; status: string };
type Instance = {
  id: string; status: string;
  maintenance_ticket_id: string | null; maintenance_quote_id: string | null;
  contract_id: string | null; steps?: Step[];
};

const currentStep = (w: Instance): Step | undefined => w.steps?.find(s => s.status === "in_progress");

function linkedObject(t: Translations, w: Instance): string {
  if (w.maintenance_quote_id) return `${t.wf_quote_prefix} ${w.maintenance_quote_id.slice(0, 8)}…`;
  if (w.maintenance_ticket_id) return `${t.wf_ticket_prefix} ${w.maintenance_ticket_id.slice(0, 8)}…`;
  if (w.contract_id) return `${t.wf_contract_prefix} ${w.contract_id.slice(0, 8)}…`;
  return "—";
}

export function ScreenRealEstateWorkflows() {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Instance>("/api/admin/workflows/instances?limit=100");
  const { busy, error: actErr, run } = useRowAction(reload);
  const inProgress = items.filter(i => i.status === "in_progress").length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_workflows} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{ color: "var(--gold)" }}><IcAudit /></span>
          <div>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_workflows}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${items.length} · ${inProgress} ${t.wf_in_progress_count}`}</div>
          </div>
        </div>
        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {error}</div>}
        {actErr && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.action_refused} : {actErr}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_instance}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_linked_object}</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_steps}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_status}</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_action}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.empty_workflows}</td></tr>
              )}
              {items.map(w => {
                const st = STATUS[w.status] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
                const step = currentStep(w);
                return (
                  <tr key={w.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{w.id.slice(0, 8)}…</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink)" }}>{linkedObject(t, w)}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{w.steps?.length ?? "—"}</td>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{statusLabel(t, w.status)}</span></td>
                    <td style={{ padding: "13px 16px", textAlign: "end" }}>
                      {w.status === "in_progress" && step ? (
                        busy === w.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                          <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                            <button title={t.wf_approve} onClick={() => run(w.id, `/api/admin/workflows/instances/${w.id}/steps/${step.id}/approve`)} style={aBtn("var(--emerald)", "rgba(16,185,129,0.12)")}><IcCheck /></button>
                            <button title={t.wf_reject} onClick={() => run(w.id, `/api/admin/workflows/instances/${w.id}/steps/${step.id}/reject`)} style={aBtn("var(--rose)", "var(--rose-soft)")}><IcClose /></button>
                          </span>
                        )
                      ) : <span style={{ color: "var(--ink-4)" }}>—</span>}
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
