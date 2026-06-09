"use client";

import React, { useState } from "react";
import { Topbar, IcPersonne, IcPlus, IcCheck, IcClock } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";
import { postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

const actBtn = (color: string, bg: string): React.CSSProperties => ({
  border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer",
  fontSize: 11.5, fontWeight: 600, background: bg, color,
});

// Câblé sur /api/admin/tenants → /api/v1/tenants.

type ClientOpt = { id: string; first_name: string | null; last_name: string | null; company_name: string | null };
const clientLabel = (c: ClientOpt) => c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id.slice(0, 8);

// Couleurs/fonds des badges (les labels viennent de t.*).
const LIFECYCLE: Record<string, { color: string; bg: string }> = {
  candidate: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  active: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  former: { color: "var(--ink-4)", bg: "var(--line-soft)" },
  blacklisted: { color: "var(--rose)", bg: "var(--rose-soft)" },
};
const lifecycleLabel = (t: Translations, k: string): string =>
  ({ candidate: t.tn_candidate, active: t.tn_active, former: t.tn_former, blacklisted: t.tn_blacklisted })[k] ?? k;
const KYC: Record<string, { color: string; bg: string }> = {
  not_started: { color: "var(--ink-4)", bg: "var(--line-soft)" },
  pending: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  verified: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  rejected: { color: "var(--rose)", bg: "var(--rose-soft)" },
};
const kycLabel = (t: Translations, k: string): string =>
  ({ not_started: t.kyc_not_started, pending: t.kyc_pending, verified: t.kyc_verified, rejected: t.kyc_rejected })[k] ?? k;

type Tenant = {
  party_id: string; lifecycle_status: string; kyc_status: string;
  loyalty_score: number; visa_expiry: string | null;
};

// Niveau d'alerte visa — le label vient de t.* dans le rendu.
function visaAlert(expiry: string | null): { level: "expired" | "d30" | "d90"; color: string } | null {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return { level: "expired", color: "var(--rose)" };
  if (days <= 30) return { level: "d30", color: "var(--rose)" };
  if (days <= 90) return { level: "d90", color: "var(--gold-deep)" };
  return null;
}
const visaLabel = (t: Translations, level: "expired" | "d30" | "d90"): string =>
  ({ expired: t.visa_expired, d30: t.visa_30d, d90: t.visa_90d })[level];
function loyaltyColor(n: number): string {
  if (n >= 75) return "var(--emerald)";
  if (n >= 50) return "var(--gold)";
  return "var(--rose)";
}

export function ScreenRealEstateTenants() {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Tenant>("/api/admin/tenants?limit=100");
  const { items: clients } = useApiList<ClientOpt>("/api/admin/clients?limit=100");
  const { busy, error: actErr, run } = useRowAction(reload);
  const verified = items.filter(x => x.kyc_status === "verified").length;

  function kycReject(id: string) {
    const reason = window.prompt(t.kyc_reject_reason);
    if (reason) run(id, `/api/admin/tenants/${id}/kyc/reject`, { reason });
  }

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ party_id: "", lifecycle_status: "candidate" });

  async function submit() {
    if (!form.party_id) { setFormError(t.select_client_required); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/tenants", { party_id: form.party_id, lifecycle_status: form.lifecycle_status });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false); setForm({ party_id: "", lifecycle_status: "candidate" }); reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_tenants} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcPersonne /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_tenants}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${items.length} · ${verified} ${t.kyc_verified_count}`}</div>
            </div>
          </div>
          <button onClick={() => { setOpen(true); setFormError(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <IcPlus /> {t.add}
          </button>
        </div>
        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {error}</div>}
        {actErr && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.action_refused} : {actErr}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_tenant}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_lifecycle}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>KYC</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_loyalty}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Visa</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_kyc_action}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.empty_tenants}</td></tr>
              )}
              {items.map(x => {
                const lc = LIFECYCLE[x.lifecycle_status] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
                const kyc = KYC[x.kyc_status] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
                const va = visaAlert(x.visa_expiry);
                return (
                  <tr key={x.party_id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink-3)" }}>{x.party_id.slice(0, 8)}…</td>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: lc.bg, color: lc.color }}>{lifecycleLabel(t, x.lifecycle_status)}</span></td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: kyc.bg, color: kyc.color }}>
                        {x.kyc_status === "verified" ? <IcCheck /> : x.kyc_status === "pending" ? <IcClock /> : null}{kycLabel(t, x.kyc_status)}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span className="tnum" style={{ fontWeight: 600, color: loyaltyColor(x.loyalty_score) }}>{x.loyalty_score}</span>
                      <span style={{ color: "var(--ink-4)", fontSize: 11 }}> /100</span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>{va ? <span style={{ fontSize: 12, fontWeight: 600, color: va.color }}>⚠ {visaLabel(t, va.level)}</span> : <span style={{ color: "var(--ink-4)" }}>—</span>}</td>
                    <td style={{ padding: "13px 16px", textAlign: "end" }}>
                      {busy === x.party_id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                        <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                          {(x.kyc_status === "not_started" || x.kyc_status === "rejected") && (
                            <button onClick={() => run(x.party_id, `/api/admin/tenants/${x.party_id}/kyc/submit`)} style={actBtn("var(--gold-deep)", "rgba(212,160,55,0.14)")}>{t.kyc_submit}</button>
                          )}
                          {x.kyc_status === "pending" && (<>
                            <button onClick={() => run(x.party_id, `/api/admin/tenants/${x.party_id}/kyc/verify`)} style={actBtn("var(--emerald)", "rgba(16,185,129,0.12)")}>{t.kyc_verify}</button>
                            <button onClick={() => kycReject(x.party_id)} style={actBtn("var(--rose)", "var(--rose-soft)")}>{t.kyc_reject}</button>
                          </>)}
                          {x.kyc_status === "verified" && <span style={{ color: "var(--ink-4)" }}>—</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateModal title={t.tenant_new} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.field_client} *`}>
          <select value={form.party_id} onChange={e => setForm({ ...form, party_id: e.target.value })} style={fieldInput}>
            <option value="">{t.select_placeholder}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
          </select>
        </Field>
        <Field label={t.col_lifecycle}>
          <select value={form.lifecycle_status} onChange={e => setForm({ ...form, lifecycle_status: e.target.value })} style={fieldInput}>
            <option value="candidate">{t.tn_candidate}</option>
            <option value="active">{t.tn_active}</option>
          </select>
        </Field>
      </CreateModal>
    </div>
  );
}
