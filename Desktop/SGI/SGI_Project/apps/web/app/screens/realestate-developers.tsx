"use client";

import React, { useState } from "react";
import { Topbar, IcWorkspace, IcPlus } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";
import { useApiList } from "@/lib/use-api-list";
import { postJson, extractError } from "@/lib/api-client";

// Sous-catégorie « Developers » (promoteurs immobiliers UAE).
// Câblé sur /api/admin/developers → /api/v1/developers (migration 0037).

type Developer = {
  id: string;
  reference: string;
  name_en: string;
  city: string | null;
  trade_license: string | null;
  projects_count: number;
  units_count: number;
  is_active: boolean;
};

const intFmt = new Intl.NumberFormat("en-AE");

export function ScreenRealEstateDevelopers() {
  const t = useT();
  const { items, loading, error, reload } = useApiList<Developer>("/api/admin/developers?limit=100");

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", city: "", licence: "", projects: "" });

  async function submit() {
    if (!form.name.trim()) { setFormError(t.dev_field_name); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/developers", {
        name_en: form.name.trim(),
        city: form.city.trim() || null,
        trade_license: form.licence.trim() || null,
        projects_count: form.projects ? Number(form.projects) : 0,
      });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ name: "", city: "", licence: "", projects: "" });
      reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
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

        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {error}</div>}
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
              {loading && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.loading}</td></tr>
              )}
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.dev_empty}</td></tr>
              )}
              {items.map(d => (
                <tr key={d.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "13px 16px", fontWeight: 600, color: "var(--ink)" }}>{d.name_en}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{d.city ?? "—"}</td>
                  <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{d.trade_license ?? "—"}</td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{intFmt.format(d.projects_count)}</td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{intFmt.format(d.units_count)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, color: d.is_active ? "var(--emerald)" : "var(--ink-4)", background: d.is_active ? "rgba(16,185,129,0.12)" : "var(--line-soft)" }}>
                      {d.is_active ? t.dev_status_active : t.dev_status_inactive}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CreateModal title={t.dev_new} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={submit}>
        <Field label={`${t.dev_field_name} *`}><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={fieldInput} placeholder="Emaar Properties" /></Field>
        <Field label={t.dev_field_city}><input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} style={fieldInput} placeholder="Dubai" /></Field>
        <Field label={t.dev_field_license}><input value={form.licence} onChange={e => setForm({ ...form, licence: e.target.value })} style={fieldInput} placeholder="DLD-1001" /></Field>
        <Field label={t.dev_field_projects}><input type="number" value={form.projects} onChange={e => setForm({ ...form, projects: e.target.value })} style={fieldInput} placeholder="12" /></Field>
      </CreateModal>
    </div>
  );
}
