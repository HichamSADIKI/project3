"use client";

import React, { useState } from "react";
import { Topbar, IcGrid, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

// Câblé sur /api/admin/units → /api/v1/units.

const UNIT_TYPES = ["studio", "apartment_1br", "apartment_2br", "apartment_3br", "apartment_4br_plus", "penthouse", "duplex", "villa", "townhouse", "office", "shop", "warehouse", "other"];

type BuildingOpt = { id: string; reference: string; name_en: string | null };

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const TYPE_LABEL: Record<string, string> = {
  studio: "Studio", apartment_1br: "Appart. 1ch", apartment_2br: "Appart. 2ch",
  apartment_3br: "Appart. 3ch", apartment_4br_plus: "Appart. 4ch+", penthouse: "Penthouse",
  duplex: "Duplex", villa: "Villa", townhouse: "Townhouse", office: "Bureau",
  shop: "Local", warehouse: "Entrepôt", other: "Autre",
};
const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  vacant: { label: "Vacant", color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  reserved: { label: "Réservé", color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  occupied: { label: "Occupé", color: "var(--azure)", bg: "rgba(56,132,255,0.12)" },
  maintenance: { label: "Maintenance", color: "var(--rose)", bg: "var(--rose-soft)" },
  renovation: { label: "Rénovation", color: "#a259ff", bg: "rgba(162,89,255,0.10)" },
  off_market: { label: "Hors marché", color: "var(--ink-4)", bg: "var(--line-soft)" },
};

// Machine d'états (miroir de units/service.is_valid_status_transition).
const STATUS_TRANSITIONS: Record<string, string[]> = {
  vacant: ["reserved", "occupied", "maintenance", "renovation", "off_market"],
  reserved: ["occupied", "vacant"],
  occupied: ["vacant", "maintenance"],
  maintenance: ["vacant", "renovation"],
  renovation: ["vacant", "maintenance"],
  off_market: ["vacant"],
};

type Unit = {
  id: string; unit_number: string; unit_type: string; status: string;
  list_rent_aed: string | null;
};

export function ScreenRealEstateUnits() {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Unit>("/api/admin/units?limit=100");
  const { items: buildings } = useApiList<BuildingOpt>("/api/admin/buildings?limit=200");
  const vacant = items.filter(u => u.status === "vacant").length;

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ building_id: "", unit_number: "", unit_type: "apartment_1br" });

  async function submit() {
    if (!form.building_id) { setFormError("Sélectionnez un bâtiment."); return; }
    if (!form.unit_number.trim()) { setFormError("Le numéro d'unité est obligatoire."); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/units", {
        building_id: form.building_id, unit_number: form.unit_number.trim(), unit_type: form.unit_type,
      });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false); setForm({ building_id: "", unit_number: "", unit_type: "apartment_1br" }); reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  // Action machine d'états : changement de statut.
  const [updating, setUpdating] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function changeStatus(unitId: string, target: string) {
    setUpdating(unitId); setActionError(null);
    try {
      const res = await postJson(`/api/admin/units/${unitId}/status`, { target_status: target });
      if (!res.ok) { setActionError(await extractError(res, "status_change_failed")); return; }
      reload();
    } catch { setActionError("status_change_failed"); } finally { setUpdating(null); }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_units} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcGrid /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_units}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? "Chargement…" : `${items.length} · ${vacant} vacant(s)`}</div>
            </div>
          </div>
          <button onClick={() => { setOpen(true); setFormError(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <IcPlus /> {t.add}
          </button>
        </div>
        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Erreur : {error}</div>}
        {actionError && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Changement de statut refusé : {actionError}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>N° Unité</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Loyer / an</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucune unité.</td></tr>
              )}
              {items.map(u => {
                const st = STATUS_STYLE[u.status] ?? { label: u.status, color: "var(--ink-3)", bg: "var(--line-soft)" };
                const rent = u.list_rent_aed ? Number(u.list_rent_aed) : 0;
                return (
                  <tr key={u.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{u.unit_number}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{TYPE_LABEL[u.unit_type] ?? u.unit_type}</td>
                    <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink)" }}>{rent > 0 ? aed(rent) : "—"}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: "13px 16px", textAlign: "end" }}>
                      {(STATUS_TRANSITIONS[u.status] ?? []).length > 0 ? (
                        <select
                          value=""
                          disabled={updating === u.id}
                          onChange={e => { if (e.target.value) changeStatus(u.id, e.target.value); }}
                          style={{ padding: "5px 8px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-cream)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}
                        >
                          <option value="">{updating === u.id ? "…" : "Changer →"}</option>
                          {(STATUS_TRANSITIONS[u.status] ?? []).map(s => (
                            <option key={s} value={s}>{STATUS_STYLE[s]?.label ?? s}</option>
                          ))}
                        </select>
                      ) : <span style={{ color: "var(--ink-4)" }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <CreateModal title="Nouvelle unité" open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label="Bâtiment *">
          <select value={form.building_id} onChange={e => setForm({ ...form, building_id: e.target.value })} style={fieldInput}>
            <option value="">— Sélectionner —</option>
            {buildings.map(b => <option key={b.id} value={b.id}>{b.reference}{b.name_en ? ` · ${b.name_en}` : ""}</option>)}
          </select>
        </Field>
        <Field label="N° d'unité *"><input autoFocus value={form.unit_number} onChange={e => setForm({ ...form, unit_number: e.target.value })} style={fieldInput} placeholder="A-1204" /></Field>
        <Field label="Type"><select value={form.unit_type} onChange={e => setForm({ ...form, unit_type: e.target.value })} style={fieldInput}>{UNIT_TYPES.map(x => <option key={x} value={x}>{TYPE_LABEL[x] ?? x}</option>)}</select></Field>
      </CreateModal>
    </div>
  );
}
