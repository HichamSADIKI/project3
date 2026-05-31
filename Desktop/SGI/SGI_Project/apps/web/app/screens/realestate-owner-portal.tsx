"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Topbar, IcWorkspace, IcReport, IcCheck } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { getJson } from "@/lib/api-client";

// Vue admin du portail propriétaire : le manager choisit un propriétaire et
// consulte ses relevés (GET /api/admin/owners/{id}/statements). Le portail
// self-service propriétaire connecté (flux /owner/*) est une app distincte.

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

type OwnerOpt = { party_id: string; mandate_reference: string | null };
type Statement = {
  id: string; period_year: number; period_month: number;
  gross_revenue_aed: string; expenses_aed: string; commission_aed: string;
  net_payout_aed: string; status: string;
};

const STMT: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "var(--ink-4)", bg: "var(--line-soft)" },
  sent: { label: "Envoyé", color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
};

export function ScreenRealEstateOwnerPortal() {
  const t = useT();
  const { items: owners } = useApiList<OwnerOpt>("/api/admin/owners?limit=200");
  const [selId, setSelId] = useState<string | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback((id: string) => {
    setLoading(true);
    getJson<{ data: Statement[] }>(`/api/admin/owners/${id}/statements`)
      .then(r => setStatements(r.data ?? []))
      .catch(() => setStatements([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (selId) load(selId); }, [selId, load]);

  const latestNet = statements.length ? Number(statements[0].net_payout_aed) : 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_owner_portal} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
          <span style={{ color: "var(--gold)" }}><IcWorkspace /></span>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_owner_portal}</div>
          <select value={selId ?? ""} onChange={e => setSelId(e.target.value || null)} style={{ marginInlineStart: "auto", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-paper)", color: "var(--ink)", fontSize: 13 }}>
            <option value="">— Choisir un propriétaire —</option>
            {owners.map(o => <option key={o.party_id} value={o.party_id}>{o.mandate_reference || o.party_id.slice(0, 8)}</option>)}
          </select>
        </div>

        {!selId ? (
          <div style={{ color: "var(--ink-4)", fontSize: 13, padding: "24px 0" }}>Sélectionnez un propriétaire pour voir ses relevés.</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 26 }}>
              <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
                <span style={{ color: "var(--azure)" }}><IcReport /></span>
                <div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", marginTop: 8 }}>{statements.length}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>Relevés</div>
              </div>
              <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
                <span style={{ color: "var(--emerald)" }}><IcCheck /></span>
                <div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", marginTop: 8 }}>{aed(latestNet)}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>Dernier payout net</div>
              </div>
            </div>

            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Période</th>
                    <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Revenus</th>
                    <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Dépenses</th>
                    <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Commission</th>
                    <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Payout net</th>
                    <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={6} style={{ padding: "20px 16px", textAlign: "center", color: "var(--ink-4)" }}>Chargement…</td></tr>}
                  {!loading && statements.length === 0 && <tr><td colSpan={6} style={{ padding: "20px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucun relevé.</td></tr>}
                  {statements.map(s => {
                    const st = STMT[s.status] ?? { label: s.status, color: "var(--ink-3)", bg: "var(--line-soft)" };
                    return (
                      <tr key={s.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                        <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--ink)" }}>{s.period_year}-{String(s.period_month).padStart(2, "0")}</td>
                        <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{aed(Number(s.gross_revenue_aed))}</td>
                        <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--rose)" }}>−{aed(Number(s.expenses_aed))}</td>
                        <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--gold-deep)" }}>−{aed(Number(s.commission_aed))}</td>
                        <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", fontWeight: 700, color: "var(--emerald)" }}>{aed(Number(s.net_payout_aed))}</td>
                        <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
