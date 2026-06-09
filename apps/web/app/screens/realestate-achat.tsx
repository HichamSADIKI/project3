"use client";

import React, { useState } from "react";
import { Topbar, IcProp, IcPlus, IcSearch } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";
import { getJson, postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

// Câblé sur /api/admin/acquisitions/{mandates,offers} → /api/v1/acquisitions/*.

const actBtn = (color: string, bg: string): React.CSSProperties => ({
  border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer",
  fontSize: 11.5, fontWeight: 600, background: bg, color,
});

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

// Label de statut : lit t["st_"+s] proprement, sinon retombe sur la valeur brute.
function statusLabel(t: Translations, s: string): string {
  const rec = t as unknown as Record<string, string | undefined>;
  return rec["st_" + s] ?? s;
}

// Couleurs/fonds des badges de statut (les labels viennent de statusLabel).
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  active: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  fulfilled: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  expired: { color: "var(--ink-4)", bg: "var(--line-soft)" },
  cancelled: { color: "var(--rose)", bg: "var(--rose-soft)" },
  draft: { color: "var(--ink-4)", bg: "var(--line-soft)" },
  submitted: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  accepted: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  rejected: { color: "var(--rose)", bg: "var(--rose-soft)" },
  withdrawn: { color: "var(--ink-4)", bg: "var(--line-soft)" },
};
function StatusBadge({ t, s }: { t: Translations; s: string }) {
  const st = STATUS_STYLE[s] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{statusLabel(t, s)}</span>;
}

type ClientOpt = { id: string; first_name: string | null; last_name: string | null; company_name: string | null };
const clientLabel = (c: ClientOpt) => c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id.slice(0, 8);

type PropertyOpt = { id: string; reference?: string | null; title_en?: string | null };
const propLabel = (p: PropertyOpt) => p.reference || p.title_en || p.id.slice(0, 8);

type Mandate = {
  id: string; reference: string; buyer_client_id: string; status: string;
  budget_min: string | null; budget_max: string | null; property_type: string | null; bedrooms_min: number | null;
};

type Offer = {
  id: string; reference: string; mandate_id: string; property_id: string; amount: string; status: string;
};

type Match = {
  id?: string; reference?: string | null; title_en?: string | null;
  match_score?: number | null; dist_m?: number | null;
};

const budgetRange = (t: Translations, lo: string | null, hi: string | null): string => {
  const a = lo != null ? aed(Number(lo)) : null;
  const b = hi != null ? aed(Number(hi)) : null;
  if (a && b) return `${a} – ${b}`;
  if (a) return a;
  if (b) return b;
  return "—";
};

const TH: React.CSSProperties = { textAlign: "start", padding: "12px 16px", fontWeight: 600 };
const THEnd: React.CSSProperties = { textAlign: "end", padding: "12px 16px", fontWeight: 600 };

export function ScreenRealEstateAchat() {
  const t = useT();
  const [tab, setTab] = useState<"mandates" | "offers">("mandates");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_achat} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
          <span style={{ color: "var(--gold)" }}><IcProp /></span>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_achat}</div>
        </div>

        <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "1px solid var(--line-soft)" }}>
          {(["mandates", "offers"] as const).map(k => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{
                padding: "10px 16px", border: "none", background: "transparent", cursor: "pointer",
                fontSize: 13.5, fontWeight: 600,
                color: tab === k ? "var(--ink)" : "var(--ink-4)",
                borderBottom: tab === k ? "2px solid var(--gold)" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {k === "mandates" ? t.re_mandates : t.re_offers}
            </button>
          ))}
        </div>

        {tab === "mandates" ? <MandatesTab t={t} /> : <OffersTab t={t} />}
      </div>
    </div>
  );
}

// ── Onglet Mandats d'achat ────────────────────────────────────────────────────

function MandatesTab({ t }: { t: Translations }) {
  const { items, loading, error, reload } = useApiList<Mandate>("/api/admin/acquisitions/mandates?limit=100");
  const { items: clients } = useApiList<ClientOpt>("/api/admin/clients?limit=100");
  const { busy, error: actErr, run } = useRowAction(reload);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ buyer_client_id: "", budget_min: "", budget_max: "", property_type: "", bedrooms_min: "" });

  // Rapprochements (matches) du mandat sélectionné.
  const [matchFor, setMatchFor] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState<string | null>(null);

  async function loadMatches(id: string) {
    setMatchFor(id); setMatches([]); setMatchError(null); setMatchLoading(true);
    try {
      const r = await getJson<{ data: Match[] }>(`/api/admin/acquisitions/mandates/${id}/matches?limit=50`);
      setMatches(r.data ?? []);
    } catch (e: unknown) {
      setMatchError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setMatchLoading(false);
    }
  }

  async function submit() {
    if (!form.buyer_client_id) { setFormError(t.select_client_required); return; }
    setSaving(true); setFormError(null);
    const payload: Record<string, unknown> = { buyer_client_id: form.buyer_client_id };
    if (form.budget_min !== "") payload.budget_min = Number(form.budget_min);
    if (form.budget_max !== "") payload.budget_max = Number(form.budget_max);
    if (form.property_type !== "") payload.property_type = form.property_type;
    if (form.bedrooms_min !== "") payload.bedrooms_min = Number(form.bedrooms_min);
    try {
      const res = await postJson("/api/admin/acquisitions/mandates", payload);
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ buyer_client_id: "", budget_min: "", budget_max: "", property_type: "", bedrooms_min: "" });
      reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${items.length}`}</div>
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
              <th style={TH}>{t.col_reference}</th>
              <th style={TH}>{t.field_client}</th>
              <th style={TH}>{t.re_budget}</th>
              <th style={TH}>{t.col_type}</th>
              <th style={TH}>{t.col_status}</th>
              <th style={THEnd}>{t.re_matches}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>—</td></tr>
            )}
            {items.map(m => (
              <tr key={m.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--ink)" }}>{m.reference}</td>
                <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{m.buyer_client_id.slice(0, 8)}…</td>
                <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{budgetRange(t, m.budget_min, m.budget_max)}</td>
                <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{m.property_type ?? "—"}</td>
                <td style={{ padding: "13px 16px" }}><StatusBadge t={t} s={m.status} /></td>
                <td style={{ padding: "13px 16px", textAlign: "end" }}>
                  {busy === m.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                    <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button onClick={() => loadMatches(m.id)} style={{ ...actBtn("var(--azure)", "rgba(56,132,255,0.12)"), display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <IcSearch /> {t.re_run_match}
                      </button>
                      {m.status === "active" && (<>
                        <button onClick={() => run(m.id, `/api/admin/acquisitions/mandates/${m.id}/transition`, { status: "fulfilled" })} style={actBtn("var(--emerald)", "rgba(16,185,129,0.12)")}>{statusLabel(t, "fulfilled")}</button>
                        <button onClick={() => run(m.id, `/api/admin/acquisitions/mandates/${m.id}/transition`, { status: "expired" })} style={actBtn("var(--ink-4)", "var(--line-soft)")}>{statusLabel(t, "expired")}</button>
                        <button onClick={() => run(m.id, `/api/admin/acquisitions/mandates/${m.id}/transition`, { status: "cancelled" })} style={actBtn("var(--rose)", "var(--rose-soft)")}>{statusLabel(t, "cancelled")}</button>
                      </>)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {matchFor && (
        <div style={{ marginTop: 20, background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--line-soft)" }}>
            <span className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t.re_matches}</span>
            <button onClick={() => { setMatchFor(null); setMatches([]); setMatchError(null); }} style={actBtn("var(--ink-3)", "var(--line-soft)")}>{t.cancel}</button>
          </div>
          {matchLoading && <div style={{ padding: "18px 16px", color: "var(--ink-4)", fontSize: 13 }}>{t.loading}</div>}
          {matchError && <div style={{ padding: "12px 16px", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {matchError}</div>}
          {!matchLoading && !matchError && matches.length === 0 && (
            <div style={{ padding: "18px 16px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>{t.re_no_matches}</div>
          )}
          {!matchLoading && !matchError && matches.length > 0 && (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                  <th style={TH}>{t.col_reference}</th>
                  <th style={THEnd}>{t.re_match_score}</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((mt, i) => (
                  <tr key={mt.id ?? i} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "11px 16px", color: "var(--ink-2)" }}>{mt.reference || mt.title_en || (mt.id ? `${mt.id.slice(0, 8)}…` : "—")}</td>
                    <td className="tnum" style={{ padding: "11px 16px", textAlign: "end", fontWeight: 600, color: "var(--gold-deep)" }}>{mt.match_score != null ? mt.match_score : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <CreateModal title={t.re_new_mandate} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.field_client} *`}>
          <select value={form.buyer_client_id} onChange={e => setForm({ ...form, buyer_client_id: e.target.value })} style={fieldInput}>
            <option value="">{t.select_placeholder}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
          </select>
        </Field>
        <Field label={`${t.re_budget} (min)`}>
          <input type="number" min={0} value={form.budget_min} onChange={e => setForm({ ...form, budget_min: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={`${t.re_budget} (max)`}>
          <input type="number" min={0} value={form.budget_max} onChange={e => setForm({ ...form, budget_max: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={t.col_type}>
          <input value={form.property_type} onChange={e => setForm({ ...form, property_type: e.target.value })} style={fieldInput} />
        </Field>
        <Field label="BR (min)">
          <input type="number" min={0} value={form.bedrooms_min} onChange={e => setForm({ ...form, bedrooms_min: e.target.value })} style={fieldInput} />
        </Field>
      </CreateModal>
    </>
  );
}

// ── Onglet Offres d'achat ──────────────────────────────────────────────────────

function OffersTab({ t }: { t: Translations }) {
  const { items, loading, error, reload } = useApiList<Offer>("/api/admin/acquisitions/offers?limit=100");
  const { items: mandates } = useApiList<Mandate>("/api/admin/acquisitions/mandates?limit=100");
  const { items: properties } = useApiList<PropertyOpt>("/api/admin/properties?limit=100");
  const { busy, error: actErr, run } = useRowAction(reload);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ mandate_id: "", property_id: "", amount: "" });

  async function submit() {
    if (!form.mandate_id || !form.property_id) { setFormError(t.select_placeholder); return; }
    const amount = Number(form.amount);
    if (!(amount > 0)) { setFormError(t.invalid_amount); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/acquisitions/offers", { mandate_id: form.mandate_id, property_id: form.property_id, amount });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ mandate_id: "", property_id: "", amount: "" });
      reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${items.length}`}</div>
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
              <th style={TH}>{t.col_reference}</th>
              <th style={TH}>{t.re_mandates}</th>
              <th style={TH}>{t.field_property}</th>
              <th style={TH}>{t.re_amount}</th>
              <th style={THEnd}>{t.col_status}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>—</td></tr>
            )}
            {items.map(o => (
              <tr key={o.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--ink)" }}>{o.reference}</td>
                <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{o.mandate_id.slice(0, 8)}…</td>
                <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{o.property_id.slice(0, 8)}…</td>
                <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{aed(Number(o.amount))}</td>
                <td style={{ padding: "13px 16px", textAlign: "end" }}>
                  {busy === o.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                    <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" }}>
                      <StatusBadge t={t} s={o.status} />
                      {o.status === "draft" && (
                        <button onClick={() => run(o.id, `/api/admin/acquisitions/offers/${o.id}/transition`, { status: "submitted" })} style={actBtn("var(--gold-deep)", "rgba(212,160,55,0.14)")}>{statusLabel(t, "submitted")}</button>
                      )}
                      {o.status === "submitted" && (<>
                        <button onClick={() => run(o.id, `/api/admin/acquisitions/offers/${o.id}/transition`, { status: "accepted" })} style={actBtn("var(--emerald)", "rgba(16,185,129,0.12)")}>{statusLabel(t, "accepted")}</button>
                        <button onClick={() => run(o.id, `/api/admin/acquisitions/offers/${o.id}/transition`, { status: "rejected" })} style={actBtn("var(--rose)", "var(--rose-soft)")}>{statusLabel(t, "rejected")}</button>
                      </>)}
                      {(o.status === "draft" || o.status === "submitted") && (
                        <button onClick={() => run(o.id, `/api/admin/acquisitions/offers/${o.id}/transition`, { status: "withdrawn" })} style={actBtn("var(--ink-4)", "var(--line-soft)")}>{statusLabel(t, "withdrawn")}</button>
                      )}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateModal title={t.re_new_offer} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.re_mandates} *`}>
          <select value={form.mandate_id} onChange={e => setForm({ ...form, mandate_id: e.target.value })} style={fieldInput}>
            <option value="">{t.select_placeholder}</option>
            {mandates.map(m => <option key={m.id} value={m.id}>{m.reference}</option>)}
          </select>
        </Field>
        <Field label={`${t.field_property} *`}>
          <select value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })} style={fieldInput}>
            <option value="">{t.select_placeholder}</option>
            {properties.map(p => <option key={p.id} value={p.id}>{propLabel(p)}</option>)}
          </select>
        </Field>
        <Field label={`${t.re_amount} *`}>
          <input type="number" min={0} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={fieldInput} />
        </Field>
      </CreateModal>
    </>
  );
}
