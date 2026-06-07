"use client";

/**
 * Écran Golden Visa (UAE) — câblé sur le backend `golden_visa` :
 *   GET   /api/admin/golden-visa            → liste paginée (filtre statut)
 *   GET   /api/admin/golden-visa/expiring   → visas qui expirent (alertes J-90/J-30)
 *   POST  /api/admin/golden-visa            → création d'une demande
 *   PATCH /api/admin/golden-visa/{id}       → mise à jour (statut)
 *
 * Seuil d'éligibilité : bien ≥ 2 000 000 AED. 5 documents requis : passeport ·
 * DLD · GDRFA · assurance · photo biométrique. CSS strictement logique (Loi 3 RTL).
 * Libellés localisés en local (via useLang) pour ne pas toucher i18n.ts partagé.
 */

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { Topbar, IcPlus } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson, patchJson, postForm, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";
import {
  type GoldenVisaApp,
  type ClientLite,
  type GvDoc,
  GV_STATUSES,
  GV_DOCS,
  clientLabel,
  docsProgress,
  daysUntil,
  expiryBucket,
  docTypeFor,
  acceptFor,
} from "@/lib/golden-visa";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Golden Visa", newApp: "Nouvelle demande", all: "Toutes", expiring: "Expirations",
    total: "Demandes", pending: "En attente", submitted: "Soumises", approved: "Approuvées",
    exp90: "Expirent < 90 j", exp30: "Expirent < 30 j", allStatus: "Tous statuts",
    client: "Client", appNo: "N° demande", status: "Statut", docs: "Documents", submission: "Soumission",
    expiry: "Expiration visa", empty: "Aucune demande", loading: "Chargement…", days: "j",
    expired: "Expiré", selectClient: "Sélectionner un client", property: "Bien (id, option.)",
    notes: "Notes", save_failed: "Échec de l'enregistrement", required: "Client requis",
    st_pending: "En attente", st_submitted: "Soumise", st_approved: "Approuvée",
    st_rejected: "Rejetée", st_expired: "Expirée", eligible: "≥ 2 M AED",
    st_documents_collection: "Collecte docs", st_under_review: "En revue",
    transition_err: "Transition de statut non autorisée",
    rv_approve: "Approuver", rv_reject: "Rejeter", rv_approved: "Approuvé", rv_rejected: "Rejeté", rv_pending: "À revoir",
    docTitle: "Documents du dossier", upload: "Téléverser", replace: "Remplacer",
    download: "Télécharger", uploading: "Envoi…", upload_failed: "Échec de l'envoi",
    present: "Fourni", missing: "Manquant", close: "Fermer",
    d_passport_doc: "Passeport", d_dld_doc: "DLD", d_gdrfa_doc: "GDRFA",
    d_insurance_doc: "Assurance", d_biometric_photo: "Photo biométrique",
  },
  en: {
    title: "Golden Visa", newApp: "New application", all: "All", expiring: "Expiring",
    total: "Applications", pending: "Pending", submitted: "Submitted", approved: "Approved",
    exp90: "Expiring < 90 d", exp30: "Expiring < 30 d", allStatus: "All statuses",
    client: "Client", appNo: "App. no.", status: "Status", docs: "Documents", submission: "Submission",
    expiry: "Visa expiry", empty: "No applications", loading: "Loading…", days: "d",
    expired: "Expired", selectClient: "Select a client", property: "Property (id, opt.)",
    notes: "Notes", save_failed: "Save failed", required: "Client required",
    st_pending: "Pending", st_submitted: "Submitted", st_approved: "Approved",
    st_rejected: "Rejected", st_expired: "Expired", eligible: "≥ 2M AED",
    st_documents_collection: "Docs collection", st_under_review: "Under review",
    transition_err: "Status transition not allowed",
    rv_approve: "Approve", rv_reject: "Reject", rv_approved: "Approved", rv_rejected: "Rejected", rv_pending: "To review",
    docTitle: "Application documents", upload: "Upload", replace: "Replace",
    download: "Download", uploading: "Uploading…", upload_failed: "Upload failed",
    present: "Provided", missing: "Missing", close: "Close",
    d_passport_doc: "Passport", d_dld_doc: "DLD", d_gdrfa_doc: "GDRFA",
    d_insurance_doc: "Insurance", d_biometric_photo: "Biometric photo",
  },
  ar: {
    title: "الإقامة الذهبية", newApp: "طلب جديد", all: "الكل", expiring: "قرب الانتهاء",
    total: "الطلبات", pending: "قيد الانتظار", submitted: "مُقدّمة", approved: "مقبولة",
    exp90: "تنتهي < 90 يوم", exp30: "تنتهي < 30 يوم", allStatus: "كل الحالات",
    client: "العميل", appNo: "رقم الطلب", status: "الحالة", docs: "المستندات", submission: "التقديم",
    expiry: "انتهاء التأشيرة", empty: "لا توجد طلبات", loading: "جارٍ التحميل…", days: "ي",
    expired: "منتهية", selectClient: "اختر عميلاً", property: "العقار (معرّف، اختياري)",
    notes: "ملاحظات", save_failed: "فشل الحفظ", required: "العميل مطلوب",
    st_pending: "قيد الانتظار", st_submitted: "مُقدّمة", st_approved: "مقبولة",
    st_rejected: "مرفوضة", st_expired: "منتهية", eligible: "≥ 2م درهم",
    st_documents_collection: "جمع المستندات", st_under_review: "قيد المراجعة",
    transition_err: "انتقال الحالة غير مسموح",
    rv_approve: "اعتماد", rv_reject: "رفض", rv_approved: "معتمد", rv_rejected: "مرفوض", rv_pending: "للمراجعة",
    docTitle: "مستندات الطلب", upload: "رفع", replace: "استبدال",
    download: "تنزيل", uploading: "جارٍ الرفع…", upload_failed: "فشل الرفع",
    present: "مُقدّم", missing: "ناقص", close: "إغلاق",
    d_passport_doc: "جواز السفر", d_dld_doc: "دائرة الأراضي", d_gdrfa_doc: "الإقامة",
    d_insurance_doc: "التأمين", d_biometric_photo: "صورة بيومترية",
  },
};

const STATUS_TONE: Record<string, { c: string; bg: string }> = {
  pending: { c: "var(--ink-3)", bg: "var(--line-soft)" },
  documents_collection: { c: "var(--gold-deep)", bg: "var(--gold-ghost)" },
  under_review: { c: "var(--azure, #2563eb)", bg: "rgba(37,99,235,0.12)" },
  submitted: { c: "var(--azure, #2563eb)", bg: "rgba(37,99,235,0.12)" },
  approved: { c: "var(--emerald)", bg: "var(--emerald-soft, rgba(47,158,110,0.14))" },
  rejected: { c: "var(--rose)", bg: "var(--rose-soft, rgba(214,69,93,0.12))" },
  expired: { c: "var(--rose)", bg: "var(--rose-soft, rgba(214,69,93,0.12))" },
};

const BUCKET_TONE: Record<string, string> = {
  expired: "var(--rose)",
  j30: "var(--rose)",
  j90: "var(--gold)",
  ok: "var(--ink-4)",
  none: "var(--ink-4)",
};

export function ScreenRealEstateGoldenVisa(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;
  const stLabel = (s: string): string => L(`st_${s}`) || s;

  const [tab, setTab] = useState<"all" | "expiring">("all");
  const [statusF, setStatusF] = useState("");

  const qs = new URLSearchParams({ limit: "100", ...(statusF ? { status: statusF } : {}) }).toString();
  const { items, loading, error, reload } = useApiList<GoldenVisaApp>(`/api/admin/golden-visa?${qs}`);

  // Visas expirants (alertes J-90 / J-30).
  const [expiring, setExpiring] = useState<GoldenVisaApp[]>([]);
  useEffect(() => {
    getJson<{ data: GoldenVisaApp[] }>("/api/admin/golden-visa/expiring?days=90")
      .then((r) => setExpiring(r.data ?? []))
      .catch(() => setExpiring([]));
  }, [items]);

  // Clients (dropdown + map id→nom).
  const [clients, setClients] = useState<ClientLite[]>([]);
  useEffect(() => {
    getJson<{ data: ClientLite[] }>("/api/admin/clients?limit=200")
      .then((r) => setClients(r.data ?? []))
      .catch(() => setClients([]));
  }, []);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  // KPIs
  const counts = useMemo(() => {
    const by = (s: string): number => items.filter((a) => a.status === s).length;
    const e30 = expiring.filter((a) => {
      const d = daysUntil(a.visa_expiry_date);
      return d !== null && d <= 30;
    }).length;
    return { total: items.length, pending: by("pending"), submitted: by("submitted"), approved: by("approved"), e90: expiring.length, e30 };
  }, [items, expiring]);

  // Création
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const blank = { client_id: "", application_number: "", status: "pending", property_id: "", submission_date: "", visa_expiry_date: "", notes: "" };
  const [form, setForm] = useState(blank);

  async function submit(): Promise<void> {
    if (!form.client_id) {
      setFormError(L("required"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await postJson("/api/admin/golden-visa", {
        client_id: form.client_id,
        status: form.status,
        application_number: form.application_number || undefined,
        property_id: form.property_id || undefined,
        submission_date: form.submission_date || undefined,
        visa_expiry_date: form.visa_expiry_date || undefined,
        notes: form.notes || undefined,
      });
      if (!res.ok) {
        setFormError(await extractError(res, L("save_failed")));
        return;
      }
      setForm(blank);
      setOpen(false);
      reload();
    } catch {
      setFormError(L("save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(a: GoldenVisaApp, status: string): Promise<void> {
    const res = await patchJson(`/api/admin/golden-visa/${a.id}`, { status });
    if (res.ok) { reload(); return; }
    // 409 = transition de statut non autorisée (machine à états backend).
    if (res.status === 409) window.alert(L("transition_err"));
    reload(); // resynchronise le <select> sur la valeur réelle
  }

  // Documents (upload/téléchargement MinIO) + revue par pièce
  const [docsApp, setDocsApp] = useState<GoldenVisaApp | null>(null);
  const [uploading, setUploading] = useState<GvDoc | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  // Statut de revue par type de document (depuis la checklist backend).
  const [docReview, setDocReview] = useState<Record<string, { status: string; present: boolean }>>({});

  const loadChecklist = useCallback(async (appId: string) => {
    const r = await getJson<{ data: { items: { doc_type: string; status: string; present: boolean }[] } }>(
      `/api/admin/golden-visa/${appId}/documents/checklist`,
    ).catch(() => null);
    const map: Record<string, { status: string; present: boolean }> = {};
    for (const it of r?.data?.items ?? []) map[it.doc_type] = { status: it.status, present: it.present };
    setDocReview(map);
  }, []);

  useEffect(() => { if (docsApp) void loadChecklist(docsApp.id); }, [docsApp, loadChecklist]);

  async function reviewDoc(app: GoldenVisaApp, doc: GvDoc, status: string): Promise<void> {
    const res = await postJson(`/api/admin/golden-visa/${app.id}/documents/${docTypeFor(doc)}/review`, { status });
    if (res.ok) void loadChecklist(app.id);
  }

  async function uploadDoc(app: GoldenVisaApp, doc: GvDoc, file: File): Promise<void> {
    setUploading(doc);
    setDocError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await postForm(`/api/admin/golden-visa/${app.id}/documents/${docTypeFor(doc)}`, fd);
      if (!res.ok) {
        setDocError(await extractError(res, L("upload_failed")));
        return;
      }
      const body = (await res.json()) as { data: GoldenVisaApp };
      setDocsApp(body.data);
      reload();
    } catch {
      setDocError(L("upload_failed"));
    } finally {
      setUploading(null);
    }
  }

  async function downloadDoc(app: GoldenVisaApp, doc: GvDoc): Promise<void> {
    const data = await getJson<{ url: string }>(
      `/api/admin/golden-visa/${app.id}/documents/${docTypeFor(doc)}/download`,
    ).catch(() => null);
    if (data?.url) window.open(data.url, "_blank", "noopener");
  }

  const kpi = (label: string, value: string | number, accent?: string): React.ReactNode => (
    <div style={{ flex: "1 1 130px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBlockEnd: 6 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: accent ?? "var(--ink)" }}>{value}</div>
    </div>
  );

  const Badge = ({ s }: { s: string }): React.ReactNode => {
    const tone = STATUS_TONE[s] ?? STATUS_TONE.pending;
    return (
      <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: tone.c, background: tone.bg }}>
        {stLabel(s)}
      </span>
    );
  };

  const ExpiryCell = ({ iso }: { iso: string | null }): React.ReactNode => {
    if (!iso) return <span style={{ color: "var(--ink-4)" }}>—</span>;
    const d = daysUntil(iso);
    const b = expiryBucket(d);
    return (
      <span style={{ color: BUCKET_TONE[b], fontWeight: b === "expired" || b === "j30" ? 700 : 500 }}>
        {iso}
        {d !== null && (
          <span style={{ fontSize: 11, marginInlineStart: 6 }}>
            ({d < 0 ? L("expired") : `${d} ${L("days")}`})
          </span>
        )}
      </span>
    );
  };

  const rows = tab === "all" ? items : expiring;

  return (
    <div data-testid="screen-golden-visa" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title={L("title")}>
        <button onClick={() => { setOpen(true); setFormError(null); }} className="sgi-btn sgi-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <IcPlus />&nbsp;{L("newApp")}
        </button>
      </Topbar>

      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16, background: "var(--bg-cream)" }}>
        {/* KPIs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {kpi(L("total"), counts.total)}
          {kpi(L("pending"), counts.pending)}
          {kpi(L("submitted"), counts.submitted, "var(--azure, #2563eb)")}
          {kpi(L("approved"), counts.approved, "var(--emerald)")}
          {kpi(L("exp90"), counts.e90, counts.e90 ? "var(--gold)" : undefined)}
          {kpi(L("exp30"), counts.e30, counts.e30 ? "var(--rose)" : undefined)}
        </div>

        {/* Onglets */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["all", "expiring"] as const).map((v) => (
            <button
              key={v}
              data-testid={`tab-${v}`}
              onClick={() => setTab(v)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "1px solid var(--line)",
                background: tab === v ? "var(--gold)" : "transparent",
                color: tab === v ? "#1A1610" : "var(--ink-3)", fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              {v === "all" ? L("all") : `${L("expiring")} (${counts.e90})`}
            </button>
          ))}
        </div>

        {tab === "all" && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={{ ...fieldInput, width: "auto" }}>
              <option value="">{L("allStatus")}</option>
              {GV_STATUSES.map((s) => (<option key={s} value={s}>{stLabel(s)}</option>))}
            </select>
          </div>
        )}

        {/* Table */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", textAlign: "start" }}>
                {[L("appNo"), L("client"), L("status"), L("docs"), L("submission"), L("expiry")].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "start", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && tab === "all" ? (
                <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: "var(--ink-4)" }}>{L("loading")}</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: "var(--ink-4)" }}>{error ?? L("empty")}</td></tr>
              ) : (
                rows.map((a) => {
                  const dp = docsProgress(a);
                  return (
                    <tr key={a.id} style={{ borderBlockStart: "1px solid var(--line-soft)" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{a.application_number ?? `#${a.id.slice(0, 8)}`}</td>
                      <td style={{ padding: "9px 12px" }}>{clientLabel(clientMap.get(a.client_id), a.client_id)}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <select
                          value={a.status}
                          onChange={(e) => void changeStatus(a, e.target.value)}
                          aria-label={L("status")}
                          style={{ ...fieldInput, width: "auto", padding: "3px 8px", fontSize: 11.5 }}
                        >
                          {GV_STATUSES.map((s) => (<option key={s} value={s}>{stLabel(s)}</option>))}
                        </select>
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <button
                          type="button"
                          onClick={() => { setDocsApp(a); setDocError(null); }}
                          title={L("docTitle")}
                          style={{
                            cursor: "pointer", border: "1px solid var(--line-soft)", background: "var(--bg-cream)",
                            borderRadius: 999, padding: "2px 10px", fontWeight: 600, fontSize: 11.5,
                            color: dp.complete ? "var(--emerald)" : "var(--ink-3)",
                          }}
                        >
                          {dp.done}/{dp.total}
                        </button>
                      </td>
                      <td style={{ padding: "9px 12px", color: "var(--ink-3)" }}>{a.submission_date ?? "—"}</td>
                      <td style={{ padding: "9px 12px" }}><ExpiryCell iso={a.visa_expiry_date} /></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Légende statut (badges) */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {GV_STATUSES.map((s) => (<Badge key={s} s={s} />))}
        </div>
      </div>

      <CreateModal title={L("newApp")} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={() => void submit()}>
        <Field label={L("client")}>
          <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} style={fieldInput}>
            <option value="">{L("selectClient")}</option>
            {clients.map((c) => (<option key={c.id} value={c.id}>{clientLabel(c, c.id)}</option>))}
          </select>
        </Field>
        <Field label={L("appNo")}>
          <input value={form.application_number} onChange={(e) => setForm({ ...form, application_number: e.target.value })} placeholder="GV-2026-001" style={fieldInput} />
        </Field>
        <Field label={L("status")}>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={fieldInput}>
            {GV_STATUSES.map((s) => (<option key={s} value={s}>{stLabel(s)}</option>))}
          </select>
        </Field>
        <Field label={L("property")}>
          <input value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={L("submission")}>
          <input type="date" value={form.submission_date} onChange={(e) => setForm({ ...form, submission_date: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={L("expiry")}>
          <input type="date" value={form.visa_expiry_date} onChange={(e) => setForm({ ...form, visa_expiry_date: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={L("notes")}>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={fieldInput} />
        </Field>
      </CreateModal>

      {docsApp && (
        <div
          role="dialog"
          aria-label={L("docTitle")}
          onClick={() => setDocsApp(null)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 14, width: "min(560px, 100%)", maxHeight: "86vh", overflow: "auto", padding: 20 }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBlockEnd: 14 }}>
              <h3 className="font-display" style={{ fontSize: 16, fontWeight: 700 }}>{L("docTitle")}</h3>
              <button type="button" onClick={() => setDocsApp(null)} style={{ cursor: "pointer", border: "none", background: "transparent", color: "var(--ink-4)", fontSize: 13 }}>{L("close")}</button>
            </div>
            {docError && <div style={{ color: "var(--rose)", fontSize: 12.5, marginBlockEnd: 10 }}>{docError}</div>}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {GV_DOCS.map((doc) => {
                const present = Boolean((docsApp as Record<GvDoc, string | null>)[doc]);
                const busy = uploading === doc;
                const rv = docReview[docTypeFor(doc)]?.status ?? (present ? "approved" : "missing");
                const rvTone = rv === "approved" ? "var(--emerald)" : rv === "rejected" ? "var(--rose)" : "var(--ink-4)";
                const rvLabel = rv === "approved" ? L("rv_approved") : rv === "rejected" ? L("rv_rejected") : rv === "pending" ? L("rv_pending") : L("missing");
                return (
                  <div key={doc} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, border: "1px solid var(--line-soft)", borderRadius: 10, padding: "10px 12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: present ? "var(--emerald)" : "var(--line-soft)" }} />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{L(`d_${doc}`)}</div>
                        <div style={{ fontSize: 11, display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ color: present ? "var(--emerald)" : "var(--ink-4)" }}>{present ? L("present") : L("missing")}</span>
                          {present && <span style={{ color: rvTone, fontWeight: 600 }}>· {rvLabel}</span>}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {present && (
                        <>
                          <button type="button" onClick={() => void reviewDoc(docsApp, doc, "approved")} title={L("rv_approve")} style={{ cursor: "pointer", border: "1px solid var(--emerald)", background: "transparent", color: "var(--emerald)", borderRadius: 8, padding: "5px 8px", fontSize: 11.5, fontWeight: 600 }}>✓</button>
                          <button type="button" onClick={() => void reviewDoc(docsApp, doc, "rejected")} title={L("rv_reject")} style={{ cursor: "pointer", border: "1px solid var(--rose)", background: "transparent", color: "var(--rose)", borderRadius: 8, padding: "5px 8px", fontSize: 11.5, fontWeight: 600 }}>✕</button>
                        </>
                      )}
                      {present && (
                        <button type="button" onClick={() => void downloadDoc(docsApp, doc)} style={{ cursor: "pointer", border: "1px solid var(--line-soft)", background: "var(--bg-cream)", borderRadius: 8, padding: "5px 10px", fontSize: 12 }}>{L("download")}</button>
                      )}
                      <label style={{ cursor: busy ? "default" : "pointer", border: "1px solid var(--line-soft)", background: present ? "var(--bg-cream)" : "var(--gold-soft, rgba(192,160,98,0.16))", color: "var(--ink)", borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, opacity: busy ? 0.6 : 1 }}>
                        {busy ? L("uploading") : present ? L("replace") : L("upload")}
                        <input
                          type="file"
                          accept={acceptFor(doc)}
                          disabled={busy}
                          style={{ display: "none" }}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadDoc(docsApp, doc, f); e.target.value = ""; }}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
