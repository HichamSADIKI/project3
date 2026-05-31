"use client";

import React, { useState } from "react";
import { Topbar, IcReport, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { useRowAction } from "@/lib/use-row-action";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";
import { postJson, extractError } from "@/lib/api-client";

// Câblé sur /api/admin/pdc → /api/v1/pdc.

const aBtn = (color: string, bg: string): React.CSSProperties => ({ border: "none", borderRadius: 8, padding: "5px 9px", cursor: "pointer", fontSize: 11.5, fontWeight: 600, background: bg, color });

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: "À déposer", color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  deposited: { label: "Déposé", color: "var(--azure)", bg: "rgba(56,132,255,0.12)" },
  cleared: { label: "Encaissé", color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  bounced: { label: "Rejeté", color: "var(--rose)", bg: "var(--rose-soft)" },
  replaced: { label: "Remplacé", color: "var(--ink-3)", bg: "var(--line-soft)" },
  cancelled: { label: "Annulé", color: "var(--ink-4)", bg: "var(--line-soft)" },
};

type Pdc = {
  id: string; reference: string; cheque_number: string; bank_name: string;
  amount_aed: string; due_date: string; status: string; legal_notices_sent: number;
  // Champs reportés sur le chèque de remplacement (le backend exige un PdcCreate complet).
  rental_id: string | null; contract_id: string | null; drawer_party_id: string;
  account_holder_name: string; bank_branch: string | null;
};

// Brouillon du chèque de remplacement (PdcReplaceAction.new_cheque).
type ReplaceDraft = {
  source: Pdc;
  cheque_number: string; bank_name: string; bank_branch: string;
  amount_aed: string; due_date: string;
};

export function ScreenRealEstateCheques() {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Pdc>("/api/admin/pdc?limit=100");
  const { busy, error: actErr, run } = useRowAction(reload);
  const outstanding = items.filter(c => ["pending", "deposited"].includes(c.status)).reduce((s, c) => s + Number(c.amount_aed), 0);

  // Modal de remplacement d'un chèque rejeté.
  const [draft, setDraft] = useState<ReplaceDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalErr, setModalErr] = useState<string | null>(null);

  function bounce(id: string) {
    const reason = window.prompt("Motif du rejet du chèque ?");
    if (reason) run(id, `/api/admin/pdc/${id}/bounce`, { bounce_reason: reason });
  }

  function openReplace(c: Pdc) {
    setModalErr(null);
    setDraft({
      source: c,
      cheque_number: "",
      bank_name: c.bank_name,
      bank_branch: c.bank_branch ?? "",
      amount_aed: c.amount_aed,
      due_date: "",
    });
  }

  async function submitReplace() {
    if (!draft) return;
    setSaving(true);
    setModalErr(null);
    try {
      const s = draft.source;
      const new_cheque = {
        // Lien transactionnel + tireur reportés du chèque rejeté (un seul lien).
        rental_id: s.rental_id ?? undefined,
        contract_id: s.contract_id ?? undefined,
        drawer_party_id: s.drawer_party_id,
        account_holder_name: s.account_holder_name,
        cheque_number: draft.cheque_number.trim(),
        bank_name: draft.bank_name.trim(),
        bank_branch: draft.bank_branch.trim() || undefined,
        amount_aed: draft.amount_aed,
        due_date: draft.due_date,
      };
      const res = await postJson(`/api/admin/pdc/${s.id}/replace`, { new_cheque });
      if (!res.ok) {
        setModalErr(await extractError(res, "replace_failed"));
        return;
      }
      setDraft(null);
      reload();
    } catch {
      setModalErr("replace_failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_cheques} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcReport /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_cheques}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? "Chargement…" : `encours ${aed(outstanding)} · ${items.length} chèque(s)`}</div>
            </div>
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <IcPlus /> {t.add}
          </button>
        </div>
        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Erreur : {error}</div>}
        {actErr && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Action refusée : {actErr}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Référence</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>N° chèque</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Banque</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Montant</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Échéance</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={7} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucun chèque.</td></tr>
              )}
              {items.map(c => {
                const st = STATUS[c.status] ?? { label: c.status, color: "var(--ink-3)", bg: "var(--line-soft)" };
                return (
                  <tr key={c.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{c.reference}</td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{c.cheque_number}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{c.bank_name}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink)" }}>{aed(Number(c.amount_aed))}</td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{c.due_date}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                      {c.legal_notices_sent > 0 && <span style={{ marginInlineStart: 6, fontSize: 10, color: "var(--rose)" }}>⚖ {c.legal_notices_sent}</span>}
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "end" }}>
                      {busy === c.id ? <span style={{ color: "var(--ink-4)" }}>…</span> : (
                        <span style={{ display: "inline-flex", gap: 6, justifyContent: "flex-end" }}>
                          {c.status === "pending" && <button onClick={() => run(c.id, `/api/admin/pdc/${c.id}/deposit`)} style={aBtn("var(--azure)", "rgba(56,132,255,0.12)")}>Déposer</button>}
                          {c.status === "deposited" && (<>
                            <button onClick={() => run(c.id, `/api/admin/pdc/${c.id}/clear`)} style={aBtn("var(--emerald)", "rgba(16,185,129,0.12)")}>Encaissé</button>
                            <button onClick={() => bounce(c.id)} style={aBtn("var(--rose)", "var(--rose-soft)")}>Rejeté</button>
                          </>)}
                          {c.status === "bounced" && <button onClick={() => openReplace(c)} style={aBtn("var(--gold-deep)", "rgba(212,160,55,0.14)")}>Remplacer</button>}
                          {!["pending", "deposited", "bounced"].includes(c.status) && <span style={{ color: "var(--ink-4)" }}>—</span>}
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

      <CreateModal
        title={draft ? `Remplacer ${draft.source.reference}` : ""}
        open={draft !== null}
        saving={saving}
        error={modalErr}
        onClose={() => setDraft(null)}
        onSubmit={submitReplace}
      >
        <Field label="N° du nouveau chèque">
          <input style={fieldInput} value={draft?.cheque_number ?? ""} onChange={e => setDraft(d => d && { ...d, cheque_number: e.target.value })} />
        </Field>
        <Field label="Banque">
          <input style={fieldInput} value={draft?.bank_name ?? ""} onChange={e => setDraft(d => d && { ...d, bank_name: e.target.value })} />
        </Field>
        <Field label="Agence (optionnel)">
          <input style={fieldInput} value={draft?.bank_branch ?? ""} onChange={e => setDraft(d => d && { ...d, bank_branch: e.target.value })} />
        </Field>
        <Field label="Montant (AED)">
          <input type="number" min="0" step="0.01" style={fieldInput} value={draft?.amount_aed ?? ""} onChange={e => setDraft(d => d && { ...d, amount_aed: e.target.value })} />
        </Field>
        <Field label="Nouvelle échéance">
          <input type="date" style={fieldInput} value={draft?.due_date ?? ""} onChange={e => setDraft(d => d && { ...d, due_date: e.target.value })} />
        </Field>
      </CreateModal>
    </div>
  );
}
