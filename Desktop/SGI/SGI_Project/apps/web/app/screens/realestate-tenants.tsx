"use client";

import React, { useState } from "react";
import { Topbar, IcPersonne, IcPlus, IcCheck, IcClock } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

// Câblé sur /api/admin/tenants → /api/v1/tenants.

type ClientOpt = { id: string; first_name: string | null; last_name: string | null; company_name: string | null };
const clientLabel = (c: ClientOpt) => c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.id.slice(0, 8);

const LIFECYCLE: Record<string, { label: string; color: string; bg: string }> = {
  candidate: { label: "Candidat", color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  active: { label: "Actif", color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  former: { label: "Ancien", color: "var(--ink-4)", bg: "var(--line-soft)" },
  blacklisted: { label: "Blacklisté", color: "var(--rose)", bg: "var(--rose-soft)" },
};
const KYC: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Non démarré", color: "var(--ink-4)", bg: "var(--line-soft)" },
  pending: { label: "En revue", color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  verified: { label: "Vérifié", color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  rejected: { label: "Rejeté", color: "var(--rose)", bg: "var(--rose-soft)" },
};

type Tenant = {
  party_id: string; lifecycle_status: string; kyc_status: string;
  loyalty_score: number; visa_expiry: string | null;
};

function visaAlert(expiry: string | null): { label: string; color: string } | null {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (days < 0) return { label: "Visa expiré", color: "var(--rose)" };
  if (days <= 30) return { label: "Visa ≤30j", color: "var(--rose)" };
  if (days <= 90) return { label: "Visa ≤90j", color: "var(--gold-deep)" };
  return null;
}
function loyaltyColor(n: number): string {
  if (n >= 75) return "var(--emerald)";
  if (n >= 50) return "var(--gold)";
  return "var(--rose)";
}

export function ScreenRealEstateTenants() {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Tenant>("/api/admin/tenants?limit=100");
  const { items: clients } = useApiList<ClientOpt>("/api/admin/clients?limit=200");
  const verified = items.filter(x => x.kyc_status === "verified").length;

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ party_id: "", lifecycle_status: "candidate" });

  async function submit() {
    if (!form.party_id) { setFormError("Sélectionnez un client."); return; }
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
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? "Chargement…" : `${items.length} · ${verified} KYC vérifié(s)`}</div>
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
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Locataire</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Cycle de vie</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>KYC</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Loyauté</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Visa</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucun locataire.</td></tr>
              )}
              {items.map(x => {
                const lc = LIFECYCLE[x.lifecycle_status] ?? { label: x.lifecycle_status, color: "var(--ink-3)", bg: "var(--line-soft)" };
                const kyc = KYC[x.kyc_status] ?? { label: x.kyc_status, color: "var(--ink-3)", bg: "var(--line-soft)" };
                const va = visaAlert(x.visa_expiry);
                return (
                  <tr key={x.party_id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink-3)" }}>{x.party_id.slice(0, 8)}…</td>
                    <td style={{ padding: "13px 16px" }}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: lc.bg, color: lc.color }}>{lc.label}</span></td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: kyc.bg, color: kyc.color }}>
                        {x.kyc_status === "verified" ? <IcCheck /> : x.kyc_status === "pending" ? <IcClock /> : null}{kyc.label}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span className="tnum" style={{ fontWeight: 600, color: loyaltyColor(x.loyalty_score) }}>{x.loyalty_score}</span>
                      <span style={{ color: "var(--ink-4)", fontSize: 11 }}> /100</span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>{va ? <span style={{ fontSize: 12, fontWeight: 600, color: va.color }}>⚠ {va.label}</span> : <span style={{ color: "var(--ink-4)" }}>—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateModal title="Nouveau locataire" open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label="Client *">
          <select value={form.party_id} onChange={e => setForm({ ...form, party_id: e.target.value })} style={fieldInput}>
            <option value="">— Sélectionner —</option>
            {clients.map(c => <option key={c.id} value={c.id}>{clientLabel(c)}</option>)}
          </select>
        </Field>
        <Field label="Cycle de vie">
          <select value={form.lifecycle_status} onChange={e => setForm({ ...form, lifecycle_status: e.target.value })} style={fieldInput}>
            <option value="candidate">Candidat</option>
            <option value="active">Actif</option>
          </select>
        </Field>
      </CreateModal>
    </div>
  );
}
