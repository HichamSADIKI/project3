"use client";

import React, { useState } from "react";
import { Topbar, IcList, IcArrowUp, IcPlus } from "@/components/sgi-ui";
import { useT, useLang } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";
import { postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";
import { ListingFlagToggle } from "@/components/listing-flag-toggle";
import { ListingOnlineToggle } from "@/components/listing-online-toggle";
import { SocialPublish, type SocialPost } from "@/components/social-publish";
import { ScenarioVideo, type Scenario } from "@/components/scenario-video";

// Câblé sur /api/admin/leasing/{listings,applications} → /api/v1/leasing/*.

const actBtn = (color: string, bg: string): React.CSSProperties => ({
  border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer",
  fontSize: 11.5, fontWeight: 600, background: bg, color,
});

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

// Label de statut générique : t["st_"+s] sinon le code brut.
function statusLabel(t: Translations, s: string): string {
  return (t as unknown as Record<string, string>)["st_" + s] ?? s;
}

// Couleurs/fonds des badges (les labels viennent de statusLabel).
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  draft: { color: "var(--ink-4)", bg: "var(--line-soft)" },
  published: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  reserved: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  leased: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  withdrawn: { color: "var(--rose)", bg: "var(--rose-soft)" },
  submitted: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  screening: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  approved: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  converted: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  rejected: { color: "var(--rose)", bg: "var(--rose-soft)" },
};
const badge = (t: Translations, s: string) => {
  const st = STATUS_STYLE[s] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>
      {statusLabel(t, s)}
    </span>
  );
};

type Listing = {
  id: string; reference: string; unit_id: string | null;
  monthly_rent: string; annual_rent: string | null; status: string; slug?: string | null;
  is_featured?: boolean; is_urgent?: boolean;
};

const PORTAL_URL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3001";
type Application = {
  id: string; reference: string; listing_id: string;
  applicant_client_id: string; offered_rent: string | null; status: string;
};
type UnitOpt = { id: string; unit_number: string };
type ClientOpt = { id: string; first_name: string | null; last_name: string | null; company_name: string | null };
const clientLabel = (c: ClientOpt) => c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id.slice(0, 8);

const trunc = (id: string) => `${id.slice(0, 8)}…`;
const toNum = (v: string | null): number | null => (v == null || v === "" ? null : Number(v));

// Transitions valides par statut (machine à états backend).
const LISTING_NEXT: Record<string, string[]> = {
  draft: ["published", "withdrawn"],
  // Aligné sur le backend (_LISTING_TRANSITIONS) : location directe depuis
  // published, et une annonce retirée peut être republiée.
  published: ["reserved", "leased", "withdrawn"],
  reserved: ["leased", "published", "withdrawn"],
  leased: [],
  withdrawn: ["published"],
};
const APPLICATION_NEXT: Record<string, string[]> = {
  submitted: ["screening", "rejected"],
  screening: ["approved", "rejected"],
  approved: ["converted", "rejected"],
  converted: [],
  rejected: [],
};

export function ScreenRealEstateLocation() {
  const t = useT();
  const [tab, setTab] = useState<"listings" | "applications">("listings");

  // Même barre d'onglets que l'écran Vente (icônes + style identiques).
  const tabs: ReadonlyArray<readonly ["listings" | "applications", string, React.ReactNode]> = [
    ["listings", t.re_listings, <IcList key="l" />],
    ["applications", t.re_applications, <IcArrowUp key="a" />],
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_location} />
      <div style={{ display: "flex", gap: 4, padding: "10px 26px 0", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-paper)" }}>
        {tabs.map(([key, label, icon]) => (
          <button
            key={key}
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
        {tab === "listings" ? <ListingsTab t={t} /> : <ApplicationsTab t={t} />}
      </div>
    </div>
  );
}

function ListingsTab({ t }: { t: Translations }) {
  const { lang } = useLang();
  const { items, loading, error, reload } = useApiList<Listing>("/api/admin/leasing/listings?limit=100");
  const { items: units } = useApiList<UnitOpt>("/api/admin/units?limit=200");
  const social = useApiList<SocialPost>("/api/admin/social/posts?listing_type=rent&limit=500");
  const socialByListing = React.useMemo(() => {
    const m: Record<string, SocialPost[]> = {};
    for (const p of social.items) (m[p.listing_id] ??= []).push(p);
    return m;
  }, [social.items]);
  const scenarios = useApiList<Scenario>("/api/admin/scenarios?listing_type=rent&limit=500");
  const scenariosByListing = React.useMemo(() => {
    const m: Record<string, Scenario[]> = {};
    for (const s of scenarios.items) (m[s.listing_id] ??= []).push(s);
    return m;
  }, [scenarios.items]);
  const { busy, error: actErr, run } = useRowAction(reload);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ unit_id: "", title_fr: "", title_ar: "", title_en: "", monthly_rent: "", annual_rent: "" });

  async function submit() {
    const monthly = Number(form.monthly_rent);
    if (!form.monthly_rent || Number.isNaN(monthly) || monthly < 0) { setFormError(t.invalid_amount); return; }
    setSaving(true); setFormError(null);
    try {
      const body: Record<string, unknown> = { monthly_rent: monthly };
      if (form.unit_id) body.unit_id = form.unit_id;
      if (form.title_fr.trim()) body.title_fr = form.title_fr.trim();
      if (form.title_ar.trim()) body.title_ar = form.title_ar.trim();
      if (form.title_en.trim()) body.title_en = form.title_en.trim();
      if (form.annual_rent) {
        const annual = Number(form.annual_rent);
        if (Number.isNaN(annual) || annual < 0) { setFormError(t.invalid_amount); return; }
        body.annual_rent = annual;
      }
      const res = await postJson("/api/admin/leasing/listings", body);
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ unit_id: "", title_fr: "", title_ar: "", title_en: "", monthly_rent: "", annual_rent: "" });
      reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${items.length}`}</div>
        <button onClick={() => { setOpen(true); setFormError(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          <IcPlus /> {t.re_new_listing}
        </button>
      </div>
      {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {error}</div>}
      {actErr && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.action_refused} : {actErr}</div>}
      <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.re_listings}</th>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_unit_number}</th>
              <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.re_monthly_rent}</th>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_status}</th>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.re_showcase}</th>
              <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_action}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>—</td></tr>
            )}
            {items.map(x => {
              const allNext = LISTING_NEXT[x.status] ?? [];
              const online = x.status === "draft" || x.status === "published" || x.status === "withdrawn";
              // Quand l'interrupteur En ligne/Hors ligne gère la mise en ligne,
              // on retire published/withdrawn des boutons de progression.
              const next = online ? allNext.filter(s => s !== "published" && s !== "withdrawn") : allNext;
              return (
                <tr key={x.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{x.reference}</td>
                  <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{x.unit_id ? trunc(x.unit_id) : "—"}</td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", fontWeight: 600, color: "var(--ink)" }}>{aed(Number(x.monthly_rent))}</td>
                  <td style={{ padding: "13px 16px" }}>
                    {online ? (
                      <ListingOnlineToggle basePath="/api/admin/leasing/listings" id={x.id} status={x.status} labelOn={t.web_badge_online} labelOff={t.web_offline} onChanged={reload} />
                    ) : (
                      badge(t, x.status)
                    )}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap" }}>
                      <ListingFlagToggle basePath="/api/admin/leasing/listings" id={x.id} flag="is_featured" value={!!x.is_featured} label={t.st_featured} activeColor="var(--gold-deep)" activeBg="rgba(212,160,55,0.14)" />
                      <ListingFlagToggle basePath="/api/admin/leasing/listings" id={x.id} flag="is_urgent" value={!!x.is_urgent} label={t.st_urgent} activeColor="var(--rose)" activeBg="var(--rose-soft)" />
                    </span>
                  </td>
                  <td style={{ padding: "13px 16px", textAlign: "end" }}>
                    {busy === x.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                      <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end", alignItems: "center" }}>
                        <SocialPublish t={t} listingType="rent" listingId={x.id} posts={socialByListing[x.id] ?? []} onChanged={social.reload} />
                        <ScenarioVideo t={t} listingType="rent" listingId={x.id} scenarios={scenariosByListing[x.id] ?? []} onChanged={scenarios.reload} />
                        {x.status === "published" && x.slug && (
                          <a href={`${PORTAL_URL}/${lang}/property/${x.slug}`} target="_blank" rel="noopener noreferrer" style={{ ...actBtn("var(--gold-deep)", "rgba(212,160,55,0.14)"), textDecoration: "none" }}>{t.web_view}</a>
                        )}
                        {next.length === 0 ? <span style={{ color: "var(--ink-4)" }}>—</span> : next.map(s => {
                          const st = STATUS_STYLE[s] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
                          const isPublish = s === "published";
                          return (
                            <button key={s} onClick={() => run(x.id, `/api/admin/leasing/listings/${x.id}/transition`, { status: s })} style={isPublish ? actBtn("#fff", "var(--emerald)") : actBtn(st.color, st.bg)}>
                              {isPublish ? t.web_publish : statusLabel(t, s)}
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

      <CreateModal title={t.re_new_listing} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={t.field_unit_number}>
          <select value={form.unit_id} onChange={e => setForm({ ...form, unit_id: e.target.value })} style={fieldInput}>
            <option value="">{t.select_placeholder}</option>
            {units.map(u => <option key={u.id} value={u.id}>{u.unit_number}</option>)}
          </select>
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
        <Field label={`${t.re_monthly_rent} *`}>
          <input type="number" min={0} value={form.monthly_rent} onChange={e => setForm({ ...form, monthly_rent: e.target.value })} style={{ ...fieldInput, textAlign: "start" }} />
        </Field>
        <Field label={t.re_amount}>
          <input type="number" min={0} value={form.annual_rent} onChange={e => setForm({ ...form, annual_rent: e.target.value })} style={{ ...fieldInput, textAlign: "start" }} placeholder={t.re_amount} />
        </Field>
      </CreateModal>
    </>
  );
}

function ApplicationsTab({ t }: { t: Translations }) {
  const { items, loading, error, reload } = useApiList<Application>("/api/admin/leasing/applications?limit=100");
  const { items: clients } = useApiList<ClientOpt>("/api/admin/clients?limit=200");
  const { busy, error: actErr, run } = useRowAction(reload);

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ listing_id: "", applicant_client_id: "", offered_rent: "" });

  async function submit() {
    if (!form.listing_id.trim()) { setFormError(t.select_placeholder); return; }
    if (!form.applicant_client_id) { setFormError(t.select_client_required); return; }
    setSaving(true); setFormError(null);
    try {
      const body: Record<string, unknown> = {
        listing_id: form.listing_id.trim(),
        applicant_client_id: form.applicant_client_id,
      };
      if (form.offered_rent) {
        const offered = Number(form.offered_rent);
        if (Number.isNaN(offered) || offered < 0) { setFormError(t.invalid_amount); return; }
        body.offered_rent = offered;
      }
      const res = await postJson("/api/admin/leasing/applications", body);
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ listing_id: "", applicant_client_id: "", offered_rent: "" });
      reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 16, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${items.length}`}</div>
        <button onClick={() => { setOpen(true); setFormError(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          <IcPlus /> {t.re_new_application}
        </button>
      </div>
      {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {error}</div>}
      {actErr && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.action_refused} : {actErr}</div>}
      <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.re_applications}</th>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.re_listings}</th>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.field_client}</th>
              <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.re_amount}</th>
              <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_status}</th>
              <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_action}</th>
            </tr>
          </thead>
          <tbody>
            {!loading && items.length === 0 && !error && (
              <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>—</td></tr>
            )}
            {items.map(x => {
              const next = APPLICATION_NEXT[x.status] ?? [];
              const offered = toNum(x.offered_rent);
              return (
                <tr key={x.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{x.reference}</td>
                  <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{trunc(x.listing_id)}</td>
                  <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{trunc(x.applicant_client_id)}</td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", fontWeight: 600, color: "var(--ink)" }}>{offered == null ? "—" : aed(offered)}</td>
                  <td style={{ padding: "13px 16px" }}>{badge(t, x.status)}</td>
                  <td style={{ padding: "13px 16px", textAlign: "end" }}>
                    {busy === x.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                      <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                        {next.length === 0 ? <span style={{ color: "var(--ink-4)" }}>—</span> : next.map(s => {
                          const st = STATUS_STYLE[s] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
                          return (
                            <button key={s} onClick={() => run(x.id, `/api/admin/leasing/applications/${x.id}/transition`, { status: s })} style={actBtn(st.color, st.bg)}>
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

      <CreateModal title={t.re_new_application} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.re_listings} *`}>
          <input value={form.listing_id} onChange={e => setForm({ ...form, listing_id: e.target.value })} style={{ ...fieldInput, textAlign: "start" }} placeholder={t.select_placeholder} />
        </Field>
        <Field label={`${t.field_client} *`}>
          <select value={form.applicant_client_id} onChange={e => setForm({ ...form, applicant_client_id: e.target.value })} style={fieldInput}>
            <option value="">{t.select_placeholder}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
          </select>
        </Field>
        <Field label={t.re_amount}>
          <input type="number" min={0} value={form.offered_rent} onChange={e => setForm({ ...form, offered_rent: e.target.value })} style={{ ...fieldInput, textAlign: "start" }} placeholder={t.re_amount} />
        </Field>
      </CreateModal>
    </>
  );
}
