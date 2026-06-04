"use client";

import React, { useState } from "react";
import { Topbar, IcContract, IcList, IcArrowUp, IcFinance, IcPlus } from "@/components/sgi-ui";
import { useT, useLang } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3001";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";
import { postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";
import { ListingFlagToggle } from "@/components/listing-flag-toggle";
import { ListingOnlineToggle } from "@/components/listing-online-toggle";
import { SocialPublish, type SocialPost } from "@/components/social-publish";
import { ScenarioVideo, type Scenario } from "@/components/scenario-video";

// Câblé sur /api/admin/sales/* → /api/v1/sales/* (module Vente : pipeline
// mandat → annonce → offre → transaction).

const actBtn = (color: string, bg: string): React.CSSProperties => ({
  border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer",
  fontSize: 11.5, fontWeight: 600, background: bg, color,
});

const aed = (n: number): string =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);
const pct = (n: number): string => `${new Intl.NumberFormat("en").format(n)} %`;

// Libellé de statut générique : t["st_<statut>"] si présent, sinon le code brut.
function statusLabel(t: Translations, s: string): string {
  const v = (t as unknown as Record<string, string | undefined>)[`st_${s}`];
  return v ?? s;
}

// Couleurs/fonds des badges de statut (les labels viennent de statusLabel).
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  active: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  published: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  accepted: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  completed: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  sold: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  draft: { color: "var(--ink-4)", bg: "var(--line-soft)" },
  submitted: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  pending: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  under_offer: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  expired: { color: "var(--ink-4)", bg: "var(--line-soft)" },
  cancelled: { color: "var(--rose)", bg: "var(--rose-soft)" },
  rejected: { color: "var(--rose)", bg: "var(--rose-soft)" },
  withdrawn: { color: "var(--rose)", bg: "var(--rose-soft)" },
};
function StatusBadge({ t, status }: { t: Translations; status: string }) {
  const st = STATUS_STYLE[status] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
  return <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{statusLabel(t, status)}</span>;
}

type ClientOpt = { id: string; first_name: string | null; last_name: string | null; company_name: string | null };
const clientLabel = (c: ClientOpt) => c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id.slice(0, 8);

type Mandate = {
  id: string; reference: string; seller_client_id: string; property_id: string | null;
  mandate_type: string; commission_rate: number; asking_price: number | null; status: string;
};
type Listing = {
  id: string; reference: string; mandate_id: string;
  title_ar: string | null; title_en: string | null; title_fr: string | null;
  list_price: number; status: string; slug?: string | null;
  is_featured?: boolean; is_urgent?: boolean;
};
type Offer = {
  id: string; reference: string; listing_id: string; buyer_client_id: string;
  amount: number; status: string;
};
type Transaction = {
  id: string; reference: string; listing_id: string; offer_id: string | null;
  final_price: number; commission_amount: number; status: string;
};

const tableShell: React.CSSProperties = {
  background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden",
};
const th: React.CSSProperties = { textAlign: "start", padding: "12px 16px", fontWeight: 600 };
const thEnd: React.CSSProperties = { textAlign: "end", padding: "12px 16px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "13px 16px" };
const tdEnd: React.CSSProperties = { padding: "13px 16px", textAlign: "end" };
const trow: React.CSSProperties = { borderTop: "1px solid var(--line-soft)" };
const refCell: React.CSSProperties = { padding: "13px 16px", fontWeight: 600, color: "var(--ink-2)" };

// ── Onglet Mandats ───────────────────────────────────────────────────────────

function MandatesTab({ t }: { t: Translations }) {
  const { items, loading, error, reload } = useApiList<Mandate>("/api/admin/sales/mandates?limit=100");
  const { items: clients } = useApiList<ClientOpt>("/api/admin/clients?limit=200");
  const { busy, error: actErr, run } = useRowAction(reload);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ seller_client_id: "", property_id: "", mandate_type: "exclusive", commission_rate: "2", asking_price: "" });

  async function submit() {
    if (!form.seller_client_id) { setFormError(t.select_client_required); return; }
    setSaving(true); setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        seller_client_id: form.seller_client_id,
        mandate_type: form.mandate_type,
        commission_rate: Number(form.commission_rate),
      };
      if (form.property_id.trim()) payload.property_id = form.property_id.trim();
      if (form.asking_price.trim()) payload.asking_price = Number(form.asking_price);
      const res = await postJson("/api/admin/sales/mandates", payload);
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ seller_client_id: "", property_id: "", mandate_type: "exclusive", commission_rate: "2", asking_price: "" });
      reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <>
      <TabHeader t={t} count={items.length} loading={loading} onAdd={() => { setOpen(true); setFormError(null); }} />
      {error && <ErrBox text={`${t.error_label} : ${error}`} />}
      {actErr && <ErrBox text={`${t.action_refused} : ${actErr}`} />}
      <div style={tableShell}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={th}>{t.col_reference}</th>
              <th style={th}>{t.field_client}</th>
              <th style={th}>{t.re_asking_price}</th>
              <th style={th}>{t.re_commission}</th>
              <th style={th}>{t.col_status}</th>
              <th style={thEnd} />
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>—</td></tr>
            )}
            {items.map(x => (
              <tr key={x.id} style={trow}>
                <td className="tnum" style={refCell}>{x.reference}</td>
                <td className="tnum" style={{ ...td, color: "var(--ink-3)" }}>{x.seller_client_id.slice(0, 8)}…</td>
                <td className="tnum" style={td}>{x.asking_price != null ? aed(x.asking_price) : <span style={{ color: "var(--ink-4)" }}>—</span>}</td>
                <td className="tnum" style={td}>{pct(x.commission_rate)}</td>
                <td style={td}><StatusBadge t={t} status={x.status} /></td>
                <td style={tdEnd}>
                  {busy === x.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : x.status === "active" ? (
                    <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => run(x.id, `/api/admin/sales/mandates/${x.id}/transition`, { status: "sold" })} style={actBtn("var(--emerald)", "rgba(16,185,129,0.12)")}>{t.st_sold}</button>
                      <button onClick={() => run(x.id, `/api/admin/sales/mandates/${x.id}/transition`, { status: "expired" })} style={actBtn("var(--ink-4)", "var(--line-soft)")}>{t.st_expired}</button>
                      <button onClick={() => run(x.id, `/api/admin/sales/mandates/${x.id}/transition`, { status: "cancelled" })} style={actBtn("var(--rose)", "var(--rose-soft)")}>{t.st_cancelled}</button>
                    </span>
                  ) : <span style={{ color: "var(--ink-4)" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateModal title={t.re_new_mandate} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.field_client} *`}>
          <select value={form.seller_client_id} onChange={e => setForm({ ...form, seller_client_id: e.target.value })} style={fieldInput}>
            <option value="">{t.select_placeholder}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
          </select>
        </Field>
        <Field label={t.field_property}>
          <input value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })} style={fieldInput} placeholder={t.select_placeholder} />
        </Field>
        <Field label={t.col_type}>
          <select value={form.mandate_type} onChange={e => setForm({ ...form, mandate_type: e.target.value })} style={fieldInput}>
            <option value="exclusive">exclusive</option>
            <option value="simple">simple</option>
            <option value="open">open</option>
          </select>
        </Field>
        <Field label={t.re_commission}>
          <input type="number" min={0} max={100} step="0.01" value={form.commission_rate} onChange={e => setForm({ ...form, commission_rate: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={t.re_asking_price}>
          <input type="number" min={0} value={form.asking_price} onChange={e => setForm({ ...form, asking_price: e.target.value })} style={fieldInput} />
        </Field>
      </CreateModal>
    </>
  );
}

// ── Onglet Annonces ──────────────────────────────────────────────────────────

function ListingsTab({ t }: { t: Translations }) {
  const { lang } = useLang();
  const { items, loading, error, reload } = useApiList<Listing>("/api/admin/sales/listings?limit=100");
  const social = useApiList<SocialPost>("/api/admin/social/posts?listing_type=sale&limit=500");
  const socialByListing = React.useMemo(() => {
    const m: Record<string, SocialPost[]> = {};
    for (const p of social.items) (m[p.listing_id] ??= []).push(p);
    return m;
  }, [social.items]);
  const scenarios = useApiList<Scenario>("/api/admin/scenarios?listing_type=sale&limit=500");
  const scenariosByListing = React.useMemo(() => {
    const m: Record<string, Scenario[]> = {};
    for (const s of scenarios.items) (m[s.listing_id] ??= []).push(s);
    return m;
  }, [scenarios.items]);
  const { busy, error: actErr, run } = useRowAction(reload);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ mandate_id: "", title_fr: "", title_ar: "", title_en: "", list_price: "" });

  async function submit() {
    if (!form.mandate_id.trim() || !form.list_price.trim()) { setFormError(t.invalid_amount); return; }
    setSaving(true); setFormError(null);
    try {
      const payload: Record<string, unknown> = {
        mandate_id: form.mandate_id.trim(),
        list_price: Number(form.list_price),
      };
      if (form.title_fr.trim()) payload.title_fr = form.title_fr.trim();
      if (form.title_ar.trim()) payload.title_ar = form.title_ar.trim();
      if (form.title_en.trim()) payload.title_en = form.title_en.trim();
      const res = await postJson("/api/admin/sales/listings", payload);
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ mandate_id: "", title_fr: "", title_ar: "", title_en: "", list_price: "" });
      reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <>
      <TabHeader t={t} count={items.length} loading={loading} onAdd={() => { setOpen(true); setFormError(null); }} />
      {error && <ErrBox text={`${t.error_label} : ${error}`} />}
      {actErr && <ErrBox text={`${t.action_refused} : ${actErr}`} />}
      <div style={tableShell}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={th}>{t.col_reference}</th>
              <th style={th}>{t.col_mandate}</th>
              <th style={th}>{t.re_list_price}</th>
              <th style={th}>{t.col_status}</th>
              <th style={th}>{t.re_showcase}</th>
              <th style={th}>{t.col_diffusion}</th>
              <th style={thEnd}>{t.col_action}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={7} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>—</td></tr>
            )}
            {items.map(x => (
              <tr key={x.id} style={trow}>
                <td className="tnum" style={refCell}>{x.reference}</td>
                <td className="tnum" style={{ ...td, color: "var(--ink-3)" }}>{x.mandate_id.slice(0, 8)}…</td>
                <td className="tnum" style={td}>{aed(x.list_price)}</td>
                <td style={td}>
                  {(x.status === "draft" || x.status === "published" || x.status === "withdrawn") ? (
                    <ListingOnlineToggle basePath="/api/admin/sales/listings" id={x.id} status={x.status} labelOn={t.web_badge_online} labelOff={t.web_offline} onChanged={reload} />
                  ) : (
                    <StatusBadge t={t} status={x.status} />
                  )}
                </td>
                <td style={td}>
                  <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                    <ListingFlagToggle basePath="/api/admin/sales/listings" id={x.id} flag="is_featured" value={!!x.is_featured} label={t.st_featured} activeColor="var(--gold-deep)" activeBg="rgba(212,160,55,0.14)" />
                    <ListingFlagToggle basePath="/api/admin/sales/listings" id={x.id} flag="is_urgent" value={!!x.is_urgent} label={t.st_urgent} activeColor="var(--rose)" activeBg="var(--rose-soft)" />
                  </span>
                </td>
                <td style={td}>
                  <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    <SocialPublish t={t} listingType="sale" listingId={x.id} posts={socialByListing[x.id] ?? []} onChanged={social.reload} />
                    <ScenarioVideo t={t} listingType="sale" listingId={x.id} scenarios={scenariosByListing[x.id] ?? []} onChanged={scenarios.reload} />
                  </span>
                </td>
                <td style={tdEnd}>
                  {busy === x.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                    <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                      {x.status === "published" && x.slug && (
                        <a href={`${PORTAL_URL}/${lang}/property/${x.slug}`} target="_blank" rel="noopener noreferrer" style={{ ...actBtn("var(--gold-deep)", "rgba(212,160,55,0.14)"), textDecoration: "none" }}>{t.web_view}</a>
                      )}
                      {x.status === "published" && (
                        <button onClick={() => run(x.id, `/api/admin/sales/listings/${x.id}/transition`, { status: "under_offer" })} style={actBtn("var(--gold-deep)", "rgba(212,160,55,0.14)")}>{t.st_under_offer}</button>
                      )}
                      {x.status === "under_offer" && (
                        <button onClick={() => run(x.id, `/api/admin/sales/listings/${x.id}/transition`, { status: "sold" })} style={actBtn("var(--emerald)", "rgba(16,185,129,0.12)")}>{t.st_sold}</button>
                      )}
                      {x.status === "sold" && <span style={{ color: "var(--ink-4)" }}>—</span>}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateModal title={t.re_new_listing} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.col_mandate} *`}>
          <input value={form.mandate_id} onChange={e => setForm({ ...form, mandate_id: e.target.value })} style={fieldInput} placeholder={t.select_placeholder} />
        </Field>
        <Field label="Titre (FR)">
          <input value={form.title_fr} onChange={e => setForm({ ...form, title_fr: e.target.value })} style={fieldInput} />
        </Field>
        <Field label="العنوان (AR)">
          <input value={form.title_ar} onChange={e => setForm({ ...form, title_ar: e.target.value })} style={fieldInput} />
        </Field>
        <Field label="Title (EN)">
          <input value={form.title_en} onChange={e => setForm({ ...form, title_en: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={`${t.re_list_price} *`}>
          <input type="number" min={0} value={form.list_price} onChange={e => setForm({ ...form, list_price: e.target.value })} style={fieldInput} />
        </Field>
      </CreateModal>
    </>
  );
}

// ── Onglet Offres ────────────────────────────────────────────────────────────

function OffersTab({ t }: { t: Translations }) {
  const { items, loading, error, reload } = useApiList<Offer>("/api/admin/sales/offers?limit=100");
  const { items: clients } = useApiList<ClientOpt>("/api/admin/clients?limit=200");
  const { busy, error: actErr, run } = useRowAction(reload);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ listing_id: "", buyer_client_id: "", amount: "" });

  async function submit() {
    if (!form.listing_id.trim() || !form.buyer_client_id) { setFormError(t.select_client_required); return; }
    if (!form.amount.trim()) { setFormError(t.invalid_amount); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/sales/offers", {
        listing_id: form.listing_id.trim(),
        buyer_client_id: form.buyer_client_id,
        amount: Number(form.amount),
      });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ listing_id: "", buyer_client_id: "", amount: "" });
      reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <>
      <TabHeader t={t} count={items.length} loading={loading} onAdd={() => { setOpen(true); setFormError(null); }} />
      {error && <ErrBox text={`${t.error_label} : ${error}`} />}
      {actErr && <ErrBox text={`${t.action_refused} : ${actErr}`} />}
      <div style={tableShell}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={th}>{t.col_reference}</th>
              <th style={th}>{t.re_listings}</th>
              <th style={th}>{t.field_client}</th>
              <th style={th}>{t.re_amount}</th>
              <th style={th}>{t.col_status}</th>
              <th style={thEnd} />
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>—</td></tr>
            )}
            {items.map(x => (
              <tr key={x.id} style={trow}>
                <td className="tnum" style={refCell}>{x.reference}</td>
                <td className="tnum" style={{ ...td, color: "var(--ink-3)" }}>{x.listing_id.slice(0, 8)}…</td>
                <td className="tnum" style={{ ...td, color: "var(--ink-3)" }}>{x.buyer_client_id.slice(0, 8)}…</td>
                <td className="tnum" style={td}>{aed(x.amount)}</td>
                <td style={td}><StatusBadge t={t} status={x.status} /></td>
                <td style={tdEnd}>
                  {busy === x.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : x.status === "submitted" ? (
                    <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => run(x.id, `/api/admin/sales/offers/${x.id}/transition`, { status: "accepted" })} style={actBtn("var(--emerald)", "rgba(16,185,129,0.12)")}>{t.st_accepted}</button>
                      <button onClick={() => run(x.id, `/api/admin/sales/offers/${x.id}/transition`, { status: "rejected" })} style={actBtn("var(--rose)", "var(--rose-soft)")}>{t.st_rejected}</button>
                      <button onClick={() => run(x.id, `/api/admin/sales/offers/${x.id}/transition`, { status: "withdrawn" })} style={actBtn("var(--ink-4)", "var(--line-soft)")}>{t.st_withdrawn}</button>
                    </span>
                  ) : <span style={{ color: "var(--ink-4)" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateModal title={t.re_new_offer} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.re_listings} *`}>
          <input value={form.listing_id} onChange={e => setForm({ ...form, listing_id: e.target.value })} style={fieldInput} placeholder={t.select_placeholder} />
        </Field>
        <Field label={`${t.field_client} *`}>
          <select value={form.buyer_client_id} onChange={e => setForm({ ...form, buyer_client_id: e.target.value })} style={fieldInput}>
            <option value="">{t.select_placeholder}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
          </select>
        </Field>
        <Field label={`${t.re_amount} *`}>
          <input type="number" min={0} value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={fieldInput} />
        </Field>
      </CreateModal>
    </>
  );
}

// ── Onglet Transactions ──────────────────────────────────────────────────────

function TransactionsTab({ t }: { t: Translations }) {
  const { items, loading, error, reload } = useApiList<Transaction>("/api/admin/sales/transactions?limit=100");
  const { busy, error: actErr, run } = useRowAction(reload);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ offer_id: "", final_price: "" });

  async function submit() {
    if (!form.offer_id.trim()) { setFormError(t.select_placeholder); return; }
    setSaving(true); setFormError(null);
    try {
      const payload: Record<string, unknown> = { offer_id: form.offer_id.trim() };
      if (form.final_price.trim()) payload.final_price = Number(form.final_price);
      const res = await postJson("/api/admin/sales/transactions", payload);
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ offer_id: "", final_price: "" });
      reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <>
      <TabHeader t={t} count={items.length} loading={loading} onAdd={() => { setOpen(true); setFormError(null); }} />
      {error && <ErrBox text={`${t.error_label} : ${error}`} />}
      {actErr && <ErrBox text={`${t.action_refused} : ${actErr}`} />}
      <div style={tableShell}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={th}>{t.col_reference}</th>
              <th style={th}>{t.re_listings}</th>
              <th style={th}>{t.re_final_price}</th>
              <th style={th}>{t.re_commission}</th>
              <th style={th}>{t.col_status}</th>
              <th style={thEnd} />
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>—</td></tr>
            )}
            {items.map(x => (
              <tr key={x.id} style={trow}>
                <td className="tnum" style={refCell}>{x.reference}</td>
                <td className="tnum" style={{ ...td, color: "var(--ink-3)" }}>{x.listing_id.slice(0, 8)}…</td>
                <td className="tnum" style={td}>{aed(x.final_price)}</td>
                <td className="tnum" style={td}>{aed(x.commission_amount)}</td>
                <td style={td}><StatusBadge t={t} status={x.status} /></td>
                <td style={tdEnd}>
                  {busy === x.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : x.status === "pending" ? (
                    <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                      <button onClick={() => run(x.id, `/api/admin/sales/transactions/${x.id}/transition`, { status: "completed" })} style={actBtn("var(--emerald)", "rgba(16,185,129,0.12)")}>{t.st_completed}</button>
                      <button onClick={() => run(x.id, `/api/admin/sales/transactions/${x.id}/transition`, { status: "cancelled" })} style={actBtn("var(--rose)", "var(--rose-soft)")}>{t.st_cancelled}</button>
                    </span>
                  ) : <span style={{ color: "var(--ink-4)" }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <CreateModal title={t.re_transactions} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.re_offers} *`}>
          <input value={form.offer_id} onChange={e => setForm({ ...form, offer_id: e.target.value })} style={fieldInput} placeholder={t.select_placeholder} />
        </Field>
        <Field label={t.re_final_price}>
          <input type="number" min={0} value={form.final_price} onChange={e => setForm({ ...form, final_price: e.target.value })} style={fieldInput} />
        </Field>
      </CreateModal>
    </>
  );
}

// ── Sous-composants partagés ─────────────────────────────────────────────────

function ErrBox({ text }: { text: string }) {
  return <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{text}</div>;
}

function TabHeader({ t, count, loading, onAdd }: { t: Translations; count: number; loading: boolean; onAdd: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
      <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${count}`}</div>
      <button onClick={onAdd} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
        <IcPlus /> {t.add}
      </button>
    </div>
  );
}

// ── Écran ────────────────────────────────────────────────────────────────────

type Tab = "mandates" | "listings" | "offers" | "transactions";

export function ScreenRealEstateVente() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("mandates");

  const tabs: ReadonlyArray<readonly [Tab, string, React.ReactNode]> = [
    ["mandates", t.re_mandates, <IcContract key="m" />],
    ["listings", t.re_listings, <IcList key="l" />],
    ["offers", t.re_offers, <IcArrowUp key="o" />],
    ["transactions", t.re_transactions, <IcFinance key="t" />],
  ];

  return (
    <div
      data-testid="screen-realestate_vente"
      style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}
    >
      <Topbar title={t.nav_vente} />
      <div style={{ display: "flex", gap: 4, padding: "10px 26px 0", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-paper)" }}>
        {tabs.map(([key, label, icon]) => (
          <button
            key={key}
            data-testid={`tab-${key}`}
            onClick={() => setTab(key)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px",
              border: "none", background: "transparent",
              borderBottom: tab === key ? "2px solid var(--gold)" : "2px solid transparent",
              color: tab === key ? "var(--ink)" : "var(--ink-4)",
              fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}
          >
            <span style={{ color: tab === key ? "var(--gold)" : "var(--ink-4)" }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        {tab === "mandates" && <MandatesTab t={t} />}
        {tab === "listings" && <ListingsTab t={t} />}
        {tab === "offers" && <OffersTab t={t} />}
        {tab === "transactions" && <TransactionsTab t={t} />}
      </div>
    </div>
  );
}
