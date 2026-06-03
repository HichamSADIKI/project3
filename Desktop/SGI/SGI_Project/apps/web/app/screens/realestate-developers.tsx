"use client";

import React, { useState } from "react";
import { Topbar, IcWorkspace, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

// Sous-catégorie « Developers » (promoteurs immobiliers UAE).
// ⚠️ Frontend-only pour l'instant : aucune table/route backend. Les données
// sont mockées localement et le CRUD reste en state — à brancher sur un module
// `developers` (migration + RLS + router) dans un second temps.

type Developer = {
  id: string;
  name: string;
  city: string;
  licence: string;
  projects: number;
  units: number;
  active: boolean;
};

const SEED: Developer[] = [
  { id: "dev-emaar",  name: "Emaar Properties", city: "Dubai",     licence: "DLD-1001", projects: 42, units: 18500, active: true },
  { id: "dev-damac",  name: "DAMAC Properties", city: "Dubai",     licence: "DLD-1002", projects: 35, units: 14200, active: true },
  { id: "dev-nakheel",name: "Nakheel",          city: "Dubai",     licence: "DLD-1003", projects: 19, units: 9800,  active: true },
  { id: "dev-sobha",  name: "Sobha Realty",     city: "Dubai",     licence: "DLD-1004", projects: 12, units: 6100,  active: true },
  { id: "dev-aldar",  name: "Aldar Properties", city: "Abu Dhabi", licence: "ADRA-2001",projects: 28, units: 11700, active: true },
  { id: "dev-meraas", name: "Meraas",           city: "Dubai",     licence: "DLD-1005", projects: 9,  units: 3400,  active: false },
];

const intFmt = new Intl.NumberFormat("en-AE");

export function ScreenRealEstateDevelopers() {
  const t = useT();
  const [items, setItems] = useState<Developer[]>(SEED);

  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", city: "", licence: "", projects: "" });

  function submit() {
    if (!form.name.trim()) { setFormError(t.dev_field_name); return; }
    setFormError(null);
    setItems(prev => [
      {
        id: `dev-${Date.now()}`,
        name: form.name.trim(),
        city: form.city.trim() || "—",
        licence: form.licence.trim() || "—",
        projects: form.projects ? Number(form.projects) : 0,
        units: 0,
        active: true,
      },
      ...prev,
    ]);
    setForm({ name: "", city: "", licence: "", projects: "" });
    setOpen(false);
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_developers} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcWorkspace /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_developers}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{items.length} {t.dev_count} · {t.dev_subtitle}</div>
            </div>
          </div>
          <button onClick={() => { setOpen(true); setFormError(null); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            <IcPlus /> {t.add}
          </button>
        </div>

        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.dev_field_name}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.dev_col_city}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.dev_field_license}</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.dev_col_projects}</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.dev_col_units}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.dev_col_status}</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.dev_empty}</td></tr>
              )}
              {items.map(d => (
                <tr key={d.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--ink)" }}>{d.name}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{d.city}</td>
                  <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{d.licence}</td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{intFmt.format(d.projects)}</td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{intFmt.format(d.units)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, color: d.active ? "var(--emerald)" : "var(--ink-4)", background: d.active ? "rgba(16,185,129,0.12)" : "var(--line-soft)" }}>
                      {d.active ? t.dev_status_active : t.dev_status_inactive}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CreateModal title={t.dev_new} open={open} saving={false} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.dev_field_name} *`}><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={fieldInput} placeholder="Emaar Properties" /></Field>
        <Field label={t.dev_field_city}><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} style={fieldInput} placeholder="Dubai" /></Field>
        <Field label={t.dev_field_license}><input value={form.licence} onChange={e => setForm({ ...form, licence: e.target.value })} style={fieldInput} placeholder="DLD-1001" /></Field>
        <Field label={t.dev_field_projects}><input type="number" value={form.projects} onChange={e => setForm({ ...form, projects: e.target.value })} style={fieldInput} placeholder="12" /></Field>
      </CreateModal>
    </div>
  );
}
