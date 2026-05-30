"use client";

import React, { useState } from "react";
import { Topbar, IcProp, IcPlus, IcPin } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

// Câblé sur /api/admin/buildings → /api/v1/buildings.

const BUILDING_TYPES = ["residential_tower", "villa_compound", "mixed_use", "commercial", "warehouse"];
const EMIRATES = ["DXB", "AUH", "SHJ", "AJM", "RAK", "FUJ", "UAQ"];

const EMIRATE_LABEL: Record<string, string> = {
  DXB: "Dubai", AUH: "Abu Dhabi", SHJ: "Sharjah", AJM: "Ajman",
  RAK: "Ras Al Khaimah", FUJ: "Fujairah", UAQ: "Umm Al Quwain",
};
const TYPE_LABEL: Record<string, string> = {
  residential_tower: "Tour résidentielle", villa_compound: "Compound villas",
  mixed_use: "Usage mixte", commercial: "Commercial", warehouse: "Entrepôt",
};
const STATUS_LABEL: Record<string, string> = {
  operational: "Opérationnel", under_renovation: "Rénovation",
  off_market: "Hors marché", demolished: "Démoli",
};

type Building = {
  id: string; reference: string; name_ar: string | null; name_en: string | null;
  name_fr: string | null; building_type: string; emirate: string;
  total_units: number | null; status: string;
};

export function ScreenRealEstateBuildings() {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Building>("/api/admin/buildings?limit=100");
  const name = (b: Building) => b.name_en || b.name_fr || b.name_ar || b.reference;

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ reference: "", name_en: "", building_type: "residential_tower", emirate: "DXB" });

  async function submit() {
    if (!form.reference.trim()) { setFormError("La référence est obligatoire."); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/buildings", {
        reference: form.reference.trim(), name_en: form.name_en.trim() || null,
        building_type: form.building_type, emirate: form.emirate,
      });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false); setForm({ reference: "", name_en: "", building_type: "residential_tower", emirate: "DXB" }); reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_buildings} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcProp /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_buildings}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? "Chargement…" : `${items.length} bâtiment(s)`}</div>
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
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Référence</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.nav_buildings}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Emirate</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.nav_units}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucun bâtiment.</td></tr>
              )}
              {items.map(b => (
                <tr key={b.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{b.reference}</td>
                  <td style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink)" }}>{name(b)}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{TYPE_LABEL[b.building_type] ?? b.building_type}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-3)" }}><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><IcPin /> {EMIRATE_LABEL[b.emirate] ?? b.emirate}</span></td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{b.total_units ?? "—"}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{STATUS_LABEL[b.status] ?? b.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CreateModal title="Nouveau bâtiment" open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label="Référence *"><input autoFocus value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} style={fieldInput} placeholder="BLD-DXB-MARINA-A" /></Field>
        <Field label="Nom"><input value={form.name_en} onChange={e => setForm({ ...form, name_en: e.target.value })} style={fieldInput} placeholder="Marina Tower A" /></Field>
        <Field label="Type"><select value={form.building_type} onChange={e => setForm({ ...form, building_type: e.target.value })} style={fieldInput}>{BUILDING_TYPES.map(x => <option key={x} value={x}>{TYPE_LABEL[x] ?? x}</option>)}</select></Field>
        <Field label="Émirat"><select value={form.emirate} onChange={e => setForm({ ...form, emirate: e.target.value })} style={fieldInput}>{EMIRATES.map(x => <option key={x} value={x}>{EMIRATE_LABEL[x] ?? x}</option>)}</select></Field>
      </CreateModal>
    </div>
  );
}
