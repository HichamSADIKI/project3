"use client";

import React, { useState } from "react";
import { Topbar, Eyebrow, Chip, IcMarketing, IcPlus, IcTrend } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";
import { getJson, postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

// Câblé sur /api/admin/marketing/{campaigns,kpis} → /api/v1/marketing/*.

const actBtn = (color: string, bg: string): React.CSSProperties => ({
  border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer",
  fontSize: 11.5, fontWeight: 600, background: bg, color,
});

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);
const num = (n: number) => new Intl.NumberFormat("en-AE").format(n);

// Label de statut générique : t["st_"+s] sinon le code brut.
function statusLabel(t: Translations, s: string): string {
  return (t as unknown as Record<string, string>)["st_" + s] ?? s;
}

// Couleurs/fonds des badges (les labels viennent de statusLabel).
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  draft: { color: "var(--ink-4)", bg: "var(--line-soft)" },
  scheduled: { color: "var(--azure)", bg: "rgba(59,130,246,0.12)" },
  active: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  paused: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  completed: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  cancelled: { color: "var(--rose)", bg: "var(--rose-soft)" },
};
const badge = (t: Translations, s: string) => {
  const st = STATUS_STYLE[s] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>
      {statusLabel(t, s)}
    </span>
  );
};

// Canaux de diffusion (miroir CAMPAIGN_CHANNELS backend).
const CHANNELS = [
  "social_facebook", "social_instagram", "social_linkedin",
  "portal_bayut", "portal_propertyfinder", "portal_dubizzle",
  "email", "other",
] as const;
function channelLabel(t: Translations, c: string): string {
  return (t as unknown as Record<string, string>)["mkt_chan_" + c] ?? c;
}

// Transitions valides par statut (machine à états backend _CAMPAIGN_TRANSITIONS).
const CAMPAIGN_NEXT: Record<string, string[]> = {
  draft: ["scheduled", "active", "cancelled"],
  scheduled: ["active", "cancelled"],
  active: ["paused", "completed", "cancelled"],
  paused: ["active", "completed", "cancelled"],
  completed: [],
  cancelled: [],
};

type Campaign = {
  id: string; reference: string; name: string; channel: string; status: string;
  starts_on: string | null; ends_on: string | null;
  budget_aed: string | null; spend_aed: string;
  impressions: number; clicks: number; leads_count: number;
  published_at: string | null; external_ref: string | null;
};
type Kpis = {
  total_campaigns: number; by_status: Record<string, number>;
  impressions: number; clicks: number; leads: number; spend_aed: string;
};

export function ScreenRealEstateMarketing() {
  const t = useT();
  const [tab, setTab] = useState<"campaigns" | "kpis">("campaigns");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_re_marketing} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ color: "var(--gold)" }}><IcMarketing /></span>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_re_marketing}</div>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 22, borderBottom: "1px solid var(--line-soft)" }}>
          {(["campaigns", "kpis"] as const).map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: "9px 16px", border: "none", background: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                color: tab === k ? "var(--gold-deep)" : "var(--ink-4)",
                borderBottom: tab === k ? "2px solid var(--gold)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {k === "campaigns" ? t.mkt_campaigns : t.mkt_kpis}
            </button>
          ))}
        </div>
        {tab === "campaigns" ? <CampaignsTab t={t} /> : <KpisTab t={t} />}
      </div>
    </div>
  );
}

function CampaignsTab({ t }: { t: Translations }) {
  const { items, loading, error, reload } = useApiList<Campaign>("/api/admin/marketing/campaigns?limit=100");
  const { busy, error: actErr, run } = useRowAction(reload);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", channel: "social_facebook", budget_aed: "", starts_on: "", ends_on: "" });

  async function submit() {
    if (!form.name.trim()) { setFormError(t.mkt_name_required); return; }
    setSaving(true); setFormError(null);
    try {
      const body: Record<string, unknown> = { name: form.name.trim(), channel: form.channel };
      if (form.budget_aed) {
        const budget = Number(form.budget_aed);
        if (Number.isNaN(budget) || budget < 0) { setFormError(t.invalid_amount); return; }
        body.budget_aed = budget;
      }
      if (form.starts_on) body.starts_on = form.starts_on;
      if (form.ends_on) body.ends_on = form.ends_on;
      const res = await postJson("/api/admin/marketing/campaigns", body);
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ name: "", channel: "social_facebook", budget_aed: "", starts_on: "", ends_on: "" });
      reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${num(items.length)}`}</div>
        <button onClick={() => { setOpen(true); setFormError(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          <IcPlus /> {t.mkt_new_campaign}
        </button>
      </div>
      {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {error}</div>}
      {actErr && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.action_refused} : {actErr}</div>}
      <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.mkt_campaigns}</th>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.mkt_name}</th>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.mkt_channel}</th>
              <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.mkt_leads}</th>
              <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.mkt_spend}</th>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_status}</th>
              <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_action}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={7} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.mkt_empty}</td></tr>
            )}
            {items.map(x => {
              const next = CAMPAIGN_NEXT[x.status] ?? [];
              const canPublish = x.status === "draft" || x.status === "scheduled";
              return (
                <tr key={x.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{x.reference}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink)", fontWeight: 600 }}>{x.name}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{channelLabel(t, x.channel)}</td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink)" }}>{num(x.leads_count)}</td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", fontWeight: 600, color: "var(--ink)" }}>{aed(Number(x.spend_aed))}</td>
                  <td style={{ padding: "13px 16px" }}>{badge(t, x.status)}</td>
                  <td style={{ padding: "13px 16px", textAlign: "end" }}>
                    {busy === x.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                      <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                        {canPublish && (
                          <button onClick={() => run(x.id, `/api/admin/marketing/campaigns/${x.id}/publish`, {})} style={actBtn("var(--emerald)", "rgba(16,185,129,0.12)")}>
                            {t.mkt_publish}
                          </button>
                        )}
                        {next.length === 0 && !canPublish ? <span style={{ color: "var(--ink-4)" }}>—</span> : next.map(s => {
                          const st = STATUS_STYLE[s] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
                          return (
                            <button key={s} onClick={() => run(x.id, `/api/admin/marketing/campaigns/${x.id}/transition`, { status: s })} style={actBtn(st.color, st.bg)}>
                              {statusLabel(t, s)}
                            </button>
                          );
                        })}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CreateModal title={t.mkt_new_campaign} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.mkt_name} *`}>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...fieldInput, textAlign: "start" }} />
        </Field>
        <Field label={t.mkt_channel}>
          <select value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })} style={fieldInput}>
            {CHANNELS.map(c => <option key={c} value={c}>{channelLabel(t, c)}</option>)}
          </select>
        </Field>
        <Field label={t.mkt_budget}>
          <input type="number" min={0} value={form.budget_aed} onChange={e => setForm({ ...form, budget_aed: e.target.value })} style={{ ...fieldInput, textAlign: "start" }} placeholder={t.mkt_budget} />
        </Field>
        <Field label={t.mkt_starts_on}>
          <input type="date" value={form.starts_on} onChange={e => setForm({ ...form, starts_on: e.target.value })} style={{ ...fieldInput, textAlign: "start" }} />
        </Field>
        <Field label={t.mkt_ends_on}>
          <input type="date" value={form.ends_on} onChange={e => setForm({ ...form, ends_on: e.target.value })} style={{ ...fieldInput, textAlign: "start" }} />
        </Field>
      </CreateModal>
    </>
  );
}

function KpiTile({ eyebrow, value, tone = "gold" }: { eyebrow: string; value: string; tone?: string }) {
  return (
    <div className="sgi-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Chip tone={tone as "gold" | "emerald" | "azure"}>
          <span style={{ marginInlineEnd: 4, display: "inline-flex" }}><IcTrend /></span>
        </Chip>
      </div>
      <div className="font-display tnum" style={{ fontSize: 30, lineHeight: 1, color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function KpisTab({ t }: { t: Translations }) {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true); setError(null);
    getJson<Kpis>("/api/admin/marketing/kpis")
      .then(d => { if (alive) setKpis(d); })
      .catch(() => { if (alive) setError("load_failed"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  if (loading) return <div style={{ fontSize: 13, color: "var(--ink-4)" }}>{t.loading}</div>;
  if (error) return <div style={{ padding: "12px 16px", borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {error}</div>;
  if (!kpis) return <div style={{ fontSize: 13, color: "var(--ink-4)" }}>{t.mkt_empty}</div>;

  const clickRate = kpis.impressions > 0 ? (kpis.clicks / kpis.impressions) * 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
        <KpiTile eyebrow={t.mkt_impressions} value={num(kpis.impressions)} tone="azure" />
        <KpiTile eyebrow={t.mkt_clicks} value={num(kpis.clicks)} tone="gold" />
        <KpiTile eyebrow={t.mkt_leads} value={num(kpis.leads)} tone="emerald" />
        <KpiTile eyebrow={t.mkt_spend} value={aed(Number(kpis.spend_aed))} tone="gold" />
        <KpiTile eyebrow={t.mkt_campaigns} value={num(kpis.total_campaigns)} tone="azure" />
        <KpiTile eyebrow={t.mkt_click_rate} value={`${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 1 }).format(clickRate)}%`} tone="emerald" />
      </div>

      <div className="sgi-card" style={{ padding: 18 }}>
        <Eyebrow>{t.col_status}</Eyebrow>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
          {Object.keys(kpis.by_status).length === 0 ? (
            <span style={{ fontSize: 13, color: "var(--ink-4)" }}>{t.mkt_empty}</span>
          ) : Object.entries(kpis.by_status).map(([s, n]) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {badge(t, s)}
              <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{num(n)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
