"use client";

import React, { useState, useEffect } from "react";
import { Topbar, IcContract, IcPlus, IcCheck, IcClock } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";
import { getJson, postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";
import { Can } from "@/lib/permissions";

const cBtn = (color: string, bg: string): React.CSSProperties => ({ border: "none", borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 11.5, fontWeight: 600, background: bg, color });

type ClientOpt = { id: string; first_name: string | null; last_name: string | null; company_name: string | null };
type PropertyOpt = { id: string; reference?: string | null; title_en?: string | null };
type DocOpt = { id: string; title: string; doc_type: string; status: string };
const clientLabel = (c: ClientOpt) => c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id.slice(0, 8);
const propLabel = (p: PropertyOpt) => p.reference || p.title_en || p.id.slice(0, 8);

// Câblé sur /api/admin/contracts → /api/v1/contracts.

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

// Couleurs/fonds du badge (le label vient de t.*).
const STATUS: Record<string, { color: string; bg: string }> = {
  draft: { color: "var(--ink-4)", bg: "var(--line-soft)" },
  signed: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  active: { color: "var(--azure)", bg: "rgba(56,132,255,0.12)" },
  expired: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  cancelled: { color: "var(--rose)", bg: "var(--rose-soft)" },
};
const statusLabel = (t: Translations, k: string): string =>
  ({ draft: t.ct_draft, signed: t.ct_signed, active: t.ct_active, expired: t.ct_expired, cancelled: t.ct_cancelled })[k] ?? k;

type Contract = {
  id: string; reference: string; type: string; amount: string; status: string;
  signed_at: string | null; end_date: string | null; renewed_from_contract_id: string | null;
};

export function ScreenRealEstateContracts({
  initialLead,
  onPrefillConsumed,
}: {
  initialLead?: Record<string, string | number>;
  onPrefillConsumed?: () => void;
} = {}) {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Contract>("/api/admin/contracts?limit=100");
  const { items: clients } = useApiList<ClientOpt>("/api/admin/clients?limit=100");
  const { items: properties } = useApiList<PropertyOpt>("/api/admin/properties?limit=100");
  const { busy, error: actErr, run } = useRowAction(reload);

  // Génération + téléchargement du PDF du contrat (WeasyPrint côté backend).
  const [pdfBusy, setPdfBusy] = useState<string | null>(null);
  async function downloadPdf(id: string): Promise<void> {
    setPdfBusy(id);
    try {
      const res = await postJson(`/api/admin/contracts/${id}/pdf`, {});
      if (res.ok) {
        const body = (await res.json()) as { data?: { url?: string } };
        if (body.data?.url) window.open(body.data.url, "_blank", "noopener");
      }
    } catch {
      /* erreur réseau ignorée — l'utilisateur peut réessayer */
    } finally {
      setPdfBusy(null);
    }
  }

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "rental", client_id: "", property_id: "", amount: "" });

  // Action guidée de l'assistant : ouvre le formulaire de création pré-rempli
  // (type/montant extraits du message ; client/bien restent à choisir). One-shot.
  useEffect(() => {
    if (!initialLead) return;
    setForm((f) => ({
      ...f,
      type: initialLead.type != null ? String(initialLead.type) : f.type,
      amount: initialLead.amount != null ? String(initialLead.amount) : f.amount,
    }));
    setFormError(null);
    setOpen(true);
    onPrefillConsumed?.();
  }, [initialLead, onPrefillConsumed]);

  // Demande de signature : picker de document lié au contrat (S3 wiring).
  const [sigContract, setSigContract] = useState<Contract | null>(null);
  const [docs, setDocs] = useState<DocOpt[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState("");
  const [sigSaving, setSigSaving] = useState(false);
  const [sigErr, setSigErr] = useState<string | null>(null);

  function openSignature(c: Contract) {
    setSigContract(c); setSelectedDoc(""); setSigErr(null); setDocs([]); setDocsLoading(true);
    // Filtre par entity_id = le contrat (sans présumer la valeur d'entity_type).
    getJson<{ data: DocOpt[] }>(`/api/admin/documents?entity_id=${c.id}&limit=100`)
      .then(r => setDocs(r.data ?? []))
      .catch(() => setDocs([]))
      .finally(() => setDocsLoading(false));
  }

  async function submitSignature() {
    if (!sigContract || !selectedDoc) { setSigErr(t.ct_select_document); return; }
    setSigSaving(true); setSigErr(null);
    try {
      const res = await postJson(`/api/admin/contracts/${sigContract.id}/request-signature`, { document_id: selectedDoc });
      if (!res.ok) { setSigErr(await extractError(res, "signature_request_failed")); return; }
      setSigContract(null); reload();
    } catch { setSigErr("signature_request_failed"); } finally { setSigSaving(false); }
  }

  async function submit() {
    if (!form.client_id || !form.property_id) { setFormError(t.ct_client_property_required); return; }
    if (!form.amount || Number(form.amount) <= 0) { setFormError(t.invalid_amount); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/contracts", {
        type: form.type, client_id: form.client_id, property_id: form.property_id, amount: Number(form.amount),
      });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false); setForm({ type: "rental", client_id: "", property_id: "", amount: "" }); reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_contracts_re} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcContract /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_contracts_re}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${items.length} ${t.count_contracts}`}</div>
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
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_reference}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_type}</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_amount}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_signature}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_due_date}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_status}</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.col_action}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={7} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.empty_contracts}</td></tr>
              )}
              {items.map(c => {
                const st = STATUS[c.status] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>
                      {c.reference}{c.renewed_from_contract_id && <span style={{ marginInlineStart: 6, fontSize: 10, color: "var(--azure)" }}>↻</span>}
                    </td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{c.type === "rental" ? t.contract_type_rental : t.contract_type_sale}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink)" }}>
                      {/* Gating de champ (IAM) : le montant est masqué sans la permission. */}
                      <Can node="realestate.contracts.finance.rent_amount" fallback={<span style={{ color: "var(--ink-4)" }}>•••</span>}>
                        {aed(Number(c.amount))}
                      </Can>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontWeight: 600, color: c.signed_at ? "var(--emerald)" : "var(--ink-4)" }}>
                        {c.signed_at ? <><IcCheck /> {t.ct_signed}</> : <><IcClock /> —</>}
                      </span>
                    </td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{c.end_date ?? "—"}</td>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{statusLabel(t, c.status)}</span></td>
                    <td style={{ padding: "13px 16px", textAlign: "end" }}>
                      {busy === c.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                        <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                          {(c.status === "active" || c.status === "expired") && <button onClick={() => run(c.id, `/api/admin/contracts/${c.id}/renew`, { rent_escalation_pct: 0 })} style={cBtn("var(--azure)", "rgba(56,132,255,0.12)")}>{t.ct_renew}</button>}
                          {!c.signed_at && c.status !== "cancelled" && <button onClick={() => openSignature(c)} style={cBtn("var(--gold-deep)", "rgba(212,160,55,0.14)")}>{t.ct_request_signature}</button>}
                          {c.status !== "draft" && c.status !== "cancelled" && <button onClick={() => run(c.id, `/api/admin/contracts/${c.id}/sync-signature`)} style={cBtn("var(--ink-2)", "var(--line-soft)")}>{t.ct_sync_signature}</button>}
                          <button onClick={() => void downloadPdf(c.id)} style={cBtn("var(--emerald)", "var(--emerald-soft, rgba(47,158,110,0.14))")}>{pdfBusy === c.id ? "…" : "PDF"}</button>
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

      <CreateModal title={t.contract_new} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={t.col_type}>
          <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} style={fieldInput}>
            <option value="rental">{t.contract_type_rental}</option>
            <option value="sale">{t.contract_type_sale}</option>
          </select>
        </Field>
        <Field label={`${t.field_client} *`}>
          <select value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })} style={fieldInput}>
            <option value="">{t.select_placeholder}</option>
            {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
          </select>
        </Field>
        <Field label={`${t.field_property} *`}>
          <select value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })} style={fieldInput}>
            <option value="">{t.select_placeholder}</option>
            {properties.map(p => <option key={p.id} value={p.id}>{propLabel(p)}</option>)}
          </select>
        </Field>
        <Field label={`${t.field_amount_aed} *`}><input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} style={fieldInput} placeholder="145000" /></Field>
      </CreateModal>

      <CreateModal
        title={sigContract ? `${t.ct_request_signature_title} ${sigContract.reference}` : ""}
        open={sigContract !== null}
        saving={sigSaving}
        error={sigErr}
        onClose={() => setSigContract(null)}
        onSubmit={submitSignature}
      >
        <Field label={t.ct_document_to_sign}>
          {docsLoading ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{t.ct_loading_documents}</div>
          ) : docs.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{t.ct_no_linked_documents}</div>
          ) : (
            <select value={selectedDoc} onChange={e => setSelectedDoc(e.target.value)} style={fieldInput}>
              <option value="">{t.select_placeholder}</option>
              {docs.map(d => <option key={d.id} value={d.id}>{d.title} ({d.doc_type})</option>)}
            </select>
          )}
        </Field>
      </CreateModal>
    </div>
  );
}
