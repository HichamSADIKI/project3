"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Topbar, IcPin, IcPlus, IcPhone, IcMail, IcClose } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { getJson, postJson, extractError } from "@/lib/api-client";

// Écran câblé sur l'API réelle : GET + POST /api/admin/branches → /api/v1/branches
// (module realestate_core, M1). Gabarit du wiring écriture (création).

const EMIRATES: { code: string; label: string }[] = [
  { code: "DXB", label: "Dubai" }, { code: "AUH", label: "Abu Dhabi" },
  { code: "SHJ", label: "Sharjah" }, { code: "AJM", label: "Ajman" },
  { code: "RAK", label: "Ras Al Khaimah" }, { code: "FUJ", label: "Fujairah" },
  { code: "UAQ", label: "Umm Al Quwain" },
];
const EMIRATE_LABEL: Record<string, string> = Object.fromEntries(EMIRATES.map(e => [e.code, e.label]));

type Branch = {
  id: string; code: string; name: string; emirate: string;
  phone: string | null; email: string | null; manager_user_id: string | null; is_active: boolean;
};
type BranchListResponse = { success: boolean; data: Branch[]; meta: { total: number } };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 11px", border: "1px solid var(--line)",
  borderRadius: 8, background: "var(--bg-cream)", color: "var(--ink)", fontSize: 13,
};

export function ScreenRealEstateBranches() {
  const t = useT();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Création
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", emirate: "DXB", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    getJson<BranchListResponse>("/api/admin/branches?limit=100")
      .then(res => { setBranches(res.data ?? []); setError(null); })
      .catch(err => setError(err instanceof Error ? err.message : "load_failed"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit() {
    if (!form.name.trim()) { setFormError(t.name_required); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/branches", {
        name: form.name.trim(),
        emirate: form.emirate,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false);
      setForm({ name: "", emirate: "DXB", phone: "", email: "" });
      load();
    } catch {
      setFormError("create_failed");
    } finally {
      setSaving(false);
    }
  }

  const activeCount = branches.filter(b => b.is_active).length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_branches} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcPin /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_branches}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{loading ? t.loading : `${branches.length} · ${activeCount} ${t.branches_active_count}`}</div>
            </div>
          </div>
          <button onClick={() => { setOpen(true); setFormError(null); }} style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 16px",
            background: "var(--gold)", color: "#1A1610", border: "none",
            borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            <IcPlus /> {t.add}
          </button>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>
            {t.error_label} : {error}
          </div>
        )}

        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_code}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.nav_branches}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_emirate}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_contact}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.col_status}</th>
              </tr>
            </thead>
            <tbody>
              {!loading && branches.length === 0 && !error && (
                <tr><td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.empty_branches}</td></tr>
              )}
              {branches.map(b => (
                <tr key={b.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{b.code}</td>
                  <td style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink)" }}>{b.name}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{EMIRATE_LABEL[b.emirate] ?? b.emirate}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-3)" }}>
                    {b.phone && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><IcPhone /> {b.phone}</div>}
                    {b.email && <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}><IcMail /> {b.email}</div>}
                    {!b.phone && !b.email && <span style={{ color: "var(--ink-4)" }}>—</span>}
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: b.is_active ? "rgba(16,185,129,0.12)" : "var(--line-soft)", color: b.is_active ? "var(--emerald)" : "var(--ink-4)" }}>
                      {b.is_active ? t.br_active : t.br_inactive}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal création */}
      {open && (
        <div onClick={() => !saving && setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 440, maxWidth: "92vw", background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line-soft)" }}>
              <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t.branch_new}</span>
              <button onClick={() => !saving && setOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)" }}><IcClose /></button>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <label style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>{t.field_name} *
                <input autoFocus value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, marginTop: 5 }} placeholder="Dubai Marina" />
              </label>
              <label style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>{t.field_emirate}
                <select value={form.emirate} onChange={e => setForm({ ...form, emirate: e.target.value })} style={{ ...inputStyle, marginTop: 5 }}>
                  {EMIRATES.map(e => <option key={e.code} value={e.code}>{e.label}</option>)}
                </select>
              </label>
              <label style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>{t.field_phone}
                <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={{ ...inputStyle, marginTop: 5 }} placeholder="+971 4 …" />
              </label>
              <label style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500 }}>{t.field_email}
                <input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} style={{ ...inputStyle, marginTop: 5 }} placeholder="marina@infinity.ae" />
              </label>
              {formError && <div style={{ color: "var(--rose)", fontSize: 12.5 }}>{t.error_label} : {formError}</div>}
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: "1px solid var(--line-soft)" }}>
              <button onClick={() => setOpen(false)} disabled={saving} style={{ padding: "8px 16px", background: "transparent", color: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: "var(--r)", fontSize: 13, cursor: "pointer" }}>{t.cancel}</button>
              <button onClick={submit} disabled={saving} style={{ padding: "8px 18px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "…" : t.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
