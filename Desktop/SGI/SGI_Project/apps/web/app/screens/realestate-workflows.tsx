"use client";

import React from "react";
import { Topbar, IcAudit, IcCheck, IcClose, IcClock } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique. Câblage à l'API /api/v1/workflows (templates → instances →
// steps → events) prévu lors d'une étape de wiring ultérieure.

const TYPE_LABEL: Record<string, string> = {
  quote_approval: "Approbation devis", sla_escalation: "Escalade SLA",
  contract_approval: "Approbation contrat", custom: "Personnalisé",
};

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  in_progress: { label: "En cours",  color: "var(--azure)",   bg: "rgba(56,132,255,0.12)" },
  approved:    { label: "Approuvé",  color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  rejected:    { label: "Rejeté",    color: "var(--rose)",    bg: "var(--rose-soft)" },
  cancelled:   { label: "Annulé",    color: "var(--ink-4)",   bg: "var(--line-soft)" },
};

const INSTANCES = [
  { id: "w1", type: "quote_approval", object: "Devis MNT-2026-000142", step: "Validation manager", status: "in_progress", escalated: false },
  { id: "w2", type: "contract_approval", object: "Contrat CNT-2026-0006", step: "Signature légale", status: "approved", escalated: false },
  { id: "w3", type: "sla_escalation", object: "Ticket MNT-2026-000138", step: "Escalade niveau 2", status: "in_progress", escalated: true },
  { id: "w4", type: "quote_approval", object: "Devis MNT-2026-000131", step: "Approbation propriétaire", status: "rejected", escalated: false },
];

export function ScreenRealEstateWorkflows() {
  const t = useT();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_workflows} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{ color: "var(--gold)" }}><IcAudit /></span>
          <div>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_workflows}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
              {INSTANCES.filter(i => i.status === "in_progress").length} en cours · {INSTANCES.filter(i => i.escalated).length} escaladé(s)
            </div>
          </div>
        </div>

        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Objet</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Étape courante</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {INSTANCES.map(w => {
                const st = STATUS[w.status];
                return (
                  <tr key={w.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{TYPE_LABEL[w.type]}</td>
                    <td style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink)" }}>{w.object}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-3)" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        {w.escalated && <span style={{ color: "var(--rose)" }}><IcClock /></span>}
                        {w.step}{w.escalated && <span style={{ fontSize: 10, color: "var(--rose)", marginInlineStart: 4 }}>escaladé</span>}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "end" }}>
                      {w.status === "in_progress" ? (
                        <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                          <button title="Approuver" style={{ border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", background: "rgba(16,185,129,0.12)", color: "var(--emerald)" }}><IcCheck /></button>
                          <button title="Rejeter" style={{ border: "none", borderRadius: 8, padding: "5px 8px", cursor: "pointer", background: "var(--rose-soft)", color: "var(--rose)" }}><IcClose /></button>
                        </span>
                      ) : (
                        <span style={{ color: "var(--ink-4)" }}>—</span>
                      )}
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
