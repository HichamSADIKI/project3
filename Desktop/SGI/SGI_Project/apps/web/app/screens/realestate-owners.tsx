"use client";

import React, { useState } from "react";
import { Topbar, IcClients, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";
import { postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

type ClientOpt = { id: string; first_name: string | null; last_name: string | null; company_name: string | null };
const clientLabel = (c: ClientOpt) => c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id.slice(0, 8);

// Câblé sur /api/admin/owners → /api/v1/owners.
// Les relevés (payout net) sont par propriétaire (GET /owners/{id}/statements) →
// non chargés dans la liste ; voir le module relevés (M6).

const PAYOUT_LABEL: Record<string, string> = {
  bank_transfer: "Virement", cheque: "Chèque", cash: "Espèces",
};

type Owner = {
  party_id: string; residency_uae: boolean; mandate_reference: string | null;
  mandate_end_date: string | null; mandate_commission_rate: string | null;
  preferred_payout_method: string; monthly_statement_enabled: boolean;
};

function mandateAlert(end: string | null): { label: string; color: string } | null {
  if (!end) return null;
  const days = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "Mandat expiré", color: "var(--rose)" };
  if (days <= 60) return { label: `Mandat J-${days}`, color: "var(--gold-deep)" };
  return null;
}

export function ScreenRealEstateOwners() {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Owner>("/api/admin/owners?limit=100");
  const { items: clients } = useApiList<ClientOpt>("/api/admin/clients?limit=200");
  const { busy, error: actErr, run } = useRowAction(() => {});

  function genStatement(id: string) {
    const now = new Date();
    run(id, `/api/admin/owners/${id}/statements?year=${now.getFullYear()}&month=${now.getMonth() + 1}`);
  }

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ party_id: "", mandate_reference: "", mandate_commission_rate: "" });

  async function submit() {
    if (!form.party_id) { setFormError("Sélectionnez un client."); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/owners", {
        party_id: form.party_id,
        mandate_reference: form.mandate_reference.trim() || null,
        mandate_commission_rate: form.mandate_commission_rate ? Number(form.mandate_commission_rate) : null,
      });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false); setForm({ party_id: "", mandate_reference: "", mandate_commission_rate: "" }); reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_owners} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcClients /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_owners}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? "Chargement…" : `${items.length} propriétaire(s)`}</div>
            </div>
          </div>
          <button onClick={() => { setOpen(true); setFormError(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <IcPlus /> {t.add}
          </button>
        </div>
        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Erreur : {error}</div>}
        {actErr && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Action refusée : {actErr}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Propriétaire</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Mandat</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Commission</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Versement</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Échéance mandat</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Relevé</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucun propriétaire.</td></tr>
              )}
              {items.map(o => {
                const ma = mandateAlert(o.mandate_end_date);
                return (
                  <tr key={o.party_id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink-3)" }}>{o.party_id.slice(0, 8)}…</td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{o.mandate_reference ?? "—"}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{o.mandate_commission_rate ? `${o.mandate_commission_rate} %` : "—"}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{PAYOUT_LABEL[o.preferred_payout_method] ?? o.preferred_payout_method}</td>
                    <td style={{ padding: "13px 16px" }}>
                      {ma ? <span style={{ fontSize: 12, fontWeight: 600, color: ma.color }}>⚠ {ma.label}</span> : <span className="tnum" style={{ color: "var(--ink-3)" }}>{o.mandate_end_date ?? "—"}</span>}
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "end" }}>
                      {busy === o.party_id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                        <button onClick={() => genStatement(o.party_id)} style={{ border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11.5, fontWeight: 600, background: "rgba(212,160,55,0.14)", color: "var(--gold-deep)" }}>Générer (mois courant)</button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateModal title="Nouveau propriétaire" open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label="Client *">
          <select value={form.party_id} onChange={e => setForm({ ...form, party_id: e.target.value })} style={fieldInput}>
            <option value="">— Sélectionner —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
          </select>
        </Field>
        <Field label="Référence mandat"><input value={form.mandate_reference} onChange={e => setForm({ ...form, mandate_reference: e.target.value })} style={fieldInput} placeholder="MND-2026-001" /></Field>
        <Field label="Commission mandat (%)"><input type="number" value={form.mandate_commission_rate} onChange={e => setForm({ ...form, mandate_commission_rate: e.target.value })} style={fieldInput} placeholder="5" /></Field>
      </CreateModal>
    </div>
  );
}
