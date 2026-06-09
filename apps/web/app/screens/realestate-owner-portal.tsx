"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Topbar, IcWorkspace, IcReport, IcCheck } from "@/components/sgi-ui";
import { useT, useLang } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson } from "@/lib/api-client";

type Lang = "ar" | "en" | "fr";
// Libellés locaux des ajouts (PDF + onglet commissions) — évite de toucher i18n.ts.
const LOC: Record<Lang, Record<string, string>> = {
  fr: { tabStatements: "Relevés", tabCommissions: "Commissions agents", pdf: "PDF", agent: "Agent", pending: "En attente", payable: "À payer", paid: "Payé", total: "Total", noComm: "Aucune commission.", genErr: "Échec génération PDF" },
  en: { tabStatements: "Statements", tabCommissions: "Agent commissions", pdf: "PDF", agent: "Agent", pending: "Pending", payable: "Payable", paid: "Paid", total: "Total", noComm: "No commission.", genErr: "PDF generation failed" },
  ar: { tabStatements: "الكشوف", tabCommissions: "عمولات الوكلاء", pdf: "PDF", agent: "الوكيل", pending: "معلّق", payable: "مستحق", paid: "مدفوع", total: "الإجمالي", noComm: "لا عمولات.", genErr: "فشل توليد PDF" },
};

type CommAgent = { agent_id: string; agent_name: string | null; pending: string; payable: string; paid: string; cancelled: string; total: string };

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

// Couleurs/fonds du badge (le label vient de t.*).
const STMT: Record<string, { color: string; bg: string }> = {
  draft: { color: "var(--ink-4)", bg: "var(--line-soft)" },
  sent: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
};
const stmtLabel = (t: Translations, k: string): string =>
  ({ draft: t.op_draft, sent: t.op_sent })[k] ?? k;

export function ScreenRealEstateOwnerPortal() {
  const t = useT();
  const { lang } = useLang();
  const lg = (lang as Lang) in LOC ? (lang as Lang) : "fr";
  const LL = (k: string): string => LOC[lg][k] ?? LOC.fr[k] ?? k;
  const { items: owners } = useApiList<OwnerOpt>("/api/admin/owners?limit=100");
  const [tab, setTab] = useState<"statements" | "commissions">("statements");
  const [selId, setSelId] = useState<string | null>(null);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Commissions agents (tenant-wide).
  const [comm, setComm] = useState<{ agents: CommAgent[]; totals: Record<string, string> } | null>(null);

  const load = useCallback((id: string) => {
    setLoading(true);
    getJson<{ data: Statement[] }>(`/api/admin/owners/${id}/statements`)
      .then(r => setStatements(r.data ?? []))
      .catch(() => setStatements([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (selId) load(selId); }, [selId, load]);
  useEffect(() => {
    if (tab !== "commissions" || comm) return;
    getJson<{ agents: CommAgent[]; totals: Record<string, string> }>("/api/admin/reporting/commissions")
      .then(setComm).catch(() => setComm({ agents: [], totals: {} }));
  }, [tab, comm]);

  async function genPdf(sid: string): Promise<void> {
    if (!selId) return;
    setBusy(sid);
    try {
      const res = await postJson(`/api/admin/owners/${selId}/statements/${sid}/pdf`, {});
      if (res.ok) {
        const j = (await res.json()) as { data?: { url?: string } };
        if (j?.data?.url) window.open(j.data.url, "_blank", "noopener");
      } else {
        window.alert(LL("genErr"));
      }
    } finally {
      setBusy(null);
    }
  }

  const latestNet = statements.length ? Number(statements[0].net_payout_aed) : 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_owner_portal} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{ color: "var(--gold)" }}><IcWorkspace /></span>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_owner_portal}</div>
          {tab === "statements" && (
            <select value={selId ?? ""} onChange={e => setSelId(e.target.value || null)} style={{ marginInlineStart: "auto", padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-paper)", color: "var(--ink)", fontSize: 13 }}>
              <option value="">{t.op_choose_owner}</option>
              {owners.map(o => <option key={o.party_id} value={o.party_id}>{o.mandate_reference || o.party_id.slice(0, 8)}</option>)}
            </select>
          )}
        </div>

        {/* Onglets : Relevés propriétaires / Commissions agents */}
        <div style={{ display: "flex", gap: 6, marginBottom: 22 }}>
          {(["statements", "commissions"] as const).map(k => (
            <button
              key={k}
              data-testid={`op-tab-${k}`}
              onClick={() => setTab(k)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid var(--line)",
                background: tab === k ? "var(--gold)" : "transparent",
                color: tab === k ? "#1A1610" : "var(--ink-3)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              {k === "statements" ? LL("tabStatements") : LL("tabCommissions")}
            </button>
          ))}
        </div>

        {tab === "commissions" ? (
          <CommissionsTable comm={comm} aed={aed} LL={LL} />
        ) : !selId ? (
          <div style={{ color: "var(--ink-4)", fontSize: 13, padding: "24px 0" }}>{t.op_select_prompt}</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 26 }}>
              <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
                <span style={{ color: "var(--azure)" }}><IcReport /></span>
                <div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", marginTop: 8 }}>{statements.length}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{t.op_statements_label}</div>
              </div>
              <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
                <span style={{ color: "var(--emerald)" }}><IcCheck /></span>
                <div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)", marginTop: 8 }}>{aed(latestNet)}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{t.op_last_net_payout}</div>
              </div>
            </div>

            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                    <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_period}</th>
                    <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_revenue}</th>
                    <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_expenses}</th>
                    <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_commission}</th>
                    <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_net_payout}</th>
                    <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_status}</th>
                    <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{LL("pdf")}</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && <tr><td colSpan={7} style={{ padding: "20px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.loading}</td></tr>}
                  {!loading && statements.length === 0 && <tr><td colSpan={7} style={{ padding: "20px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.op_empty_statements}</td></tr>}
                  {statements.map(s => {
                    const st = STMT[s.status] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
                    return (
                      <tr key={s.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                        <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--ink)" }}>{s.period_year}-{String(s.period_month).padStart(2, "0")}</td>
                        <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{aed(Number(s.gross_revenue_aed))}</td>
                        <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--rose)" }}>−{aed(Number(s.expenses_aed))}</td>
                        <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--gold-deep)" }}>−{aed(Number(s.commission_aed))}</td>
                        <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", fontWeight: 700, color: "var(--emerald)" }}>{aed(Number(s.net_payout_aed))}</td>
                        <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{stmtLabel(t, s.status)}</span></td>
                        <td style={{ padding: "13px 16px", textAlign: "end" }}>
                          <button
                            data-testid={`op-pdf-${s.id}`}
                            disabled={busy === s.id}
                            onClick={() => void genPdf(s.id)}
                            style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "4px 10px", background: "transparent", color: "var(--ink-2)", fontSize: 11.5, cursor: "pointer" }}
                          >
                            {LL("pdf")}
                          </button>
                        </td>
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

// Rapprochement des commissions agents (tenant-wide).
function CommissionsTable({
  comm, aed, LL,
}: {
  comm: { agents: CommAgent[]; totals: Record<string, string> } | null;
  aed: (n: number) => string;
  LL: (k: string) => string;
}): React.ReactNode {
  if (comm === null) return <div style={{ color: "var(--ink-4)", fontSize: 13, padding: "20px 0" }}>…</div>;
  if (comm.agents.length === 0) return <div style={{ color: "var(--ink-4)", fontSize: 13, padding: "20px 0" }}>{LL("noComm")}</div>;
  const th: React.CSSProperties = { padding: "12px 16px", fontWeight: 600, color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 };
  const td: React.CSSProperties = { padding: "13px 16px", textAlign: "end" };
  return (
    <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "var(--bg-cream)" }}>
            <th style={{ ...th, textAlign: "start" }}>{LL("agent")}</th>
            <th style={{ ...th, textAlign: "end" }}>{LL("pending")}</th>
            <th style={{ ...th, textAlign: "end" }}>{LL("payable")}</th>
            <th style={{ ...th, textAlign: "end" }}>{LL("paid")}</th>
            <th style={{ ...th, textAlign: "end" }}>{LL("total")}</th>
          </tr>
        </thead>
        <tbody>
          {comm.agents.map(a => (
            <tr key={a.agent_id} style={{ borderTop: "1px solid var(--line-soft)" }}>
              <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--ink)" }}>{a.agent_name ?? a.agent_id.slice(0, 8)}</td>
              <td className="tnum" style={{ ...td, color: "var(--ink-3)" }}>{aed(Number(a.pending))}</td>
              <td className="tnum" style={{ ...td, color: "var(--gold-deep)" }}>{aed(Number(a.payable))}</td>
              <td className="tnum" style={{ ...td, color: "var(--emerald)" }}>{aed(Number(a.paid))}</td>
              <td className="tnum" style={{ ...td, fontWeight: 700, color: "var(--ink)" }}>{aed(Number(a.total))}</td>
            </tr>
          ))}
          <tr style={{ borderTop: "2px solid var(--line)" }}>
            <td style={{ padding: "13px 16px", fontWeight: 700, color: "var(--ink)" }}>{LL("total")}</td>
            <td className="tnum" style={{ ...td, color: "var(--ink-3)" }}>{aed(Number(comm.totals.pending ?? 0))}</td>
            <td className="tnum" style={{ ...td, color: "var(--gold-deep)" }}>{aed(Number(comm.totals.payable ?? 0))}</td>
            <td className="tnum" style={{ ...td, color: "var(--emerald)" }}>{aed(Number(comm.totals.paid ?? 0))}</td>
            <td className="tnum" style={{ ...td, fontWeight: 700, color: "var(--ink)" }}>{aed(Number(comm.totals.total ?? 0))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
