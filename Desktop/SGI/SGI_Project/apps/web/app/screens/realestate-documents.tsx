"use client";

import React, { useState } from "react";
import { Topbar, IcDoc, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

// Câblé sur /api/admin/documents → /api/v1/documents.

const TYPE_LABEL: Record<string, string> = {
  contract: "Contrat", mandate: "Mandat", ejari: "Ejari", dld: "DLD",
  insurance: "Assurance", invoice: "Facture", statement: "Relevé",
  id: "Pièce ID", passport: "Passeport", other: "Autre",
};
const DOC_TYPES = ["contract", "mandate", "id", "passport", "ejari", "dld", "insurance", "invoice", "statement", "other"];
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Brouillon", color: "var(--ink-4)", bg: "var(--line-soft)" },
  active: { label: "Actif", color: "var(--azure)", bg: "rgba(56,132,255,0.12)" },
  signed: { label: "Signé", color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  archived: { label: "Archivé", color: "var(--ink-3)", bg: "var(--line-soft)" },
};

type Doc = {
  id: string; title: string; doc_type: string; entity_type: string | null;
  status: string; current_version_id: string | null;
};

export function ScreenRealEstateDocuments() {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Doc>("/api/admin/documents?limit=100");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", doc_type: "other", entity_type: "", entity_id: "" });

  async function submit() {
    if (!form.title.trim()) { setFormError("Le titre est obligatoire."); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/documents", {
        title: form.title.trim(), doc_type: form.doc_type,
        entity_type: form.entity_type.trim() || null, entity_id: form.entity_id.trim() || null,
      });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false); setForm({ title: "", doc_type: "other", entity_type: "", entity_id: "" }); reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_documents} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcDoc /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_documents}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? "Chargement…" : `${items.length} document(s)`}</div>
            </div>
          </div>
          <button onClick={() => { setOpen(true); setFormError(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <IcPlus /> {t.add}
          </button>
        </div>
        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Erreur : {error}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.nav_documents}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Entité</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Version</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucun document.</td></tr>
              )}
              {items.map(d => {
                const st = STATUS_STYLE[d.status] ?? { label: d.status, color: "var(--ink-3)", bg: "var(--line-soft)" };
                return (
                  <tr key={d.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink)" }}>{d.title}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{TYPE_LABEL[d.doc_type] ?? d.doc_type}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{d.entity_type ?? "—"}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{d.current_version_id ? "✓" : "—"}</td>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateModal title="Nouveau document" open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label="Titre *"><input autoFocus value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} style={fieldInput} placeholder="Bail — Marina Tower #1204" /></Field>
        <Field label="Type"><select value={form.doc_type} onChange={e => setForm({ ...form, doc_type: e.target.value })} style={fieldInput}>{DOC_TYPES.map(x => <option key={x} value={x}>{TYPE_LABEL[x] ?? x}</option>)}</select></Field>
        <Field label="Type d'entité liée (optionnel)"><input value={form.entity_type} onChange={e => setForm({ ...form, entity_type: e.target.value })} style={fieldInput} placeholder="contract · building · tenant…" /></Field>
        <Field label="UUID entité liée (optionnel)"><input value={form.entity_id} onChange={e => setForm({ ...form, entity_id: e.target.value })} style={fieldInput} placeholder="UUID" /></Field>
      </CreateModal>
    </div>
  );
}
