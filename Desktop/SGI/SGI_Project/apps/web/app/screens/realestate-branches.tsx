"use client";

import React, { useEffect, useState } from "react";
import { Topbar, IcPin, IcPlus, IcPhone, IcMail } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { getJson } from "@/lib/api-client";

// Écran câblé sur l'API réelle : GET /api/admin/branches → proxy → /api/v1/branches
// (module realestate_core, M1). Slice verticale de référence pour le wiring.

const EMIRATE_LABEL: Record<string, string> = {
  DXB: "Dubai", AUH: "Abu Dhabi", SHJ: "Sharjah", AJM: "Ajman",
  RAK: "Ras Al Khaimah", FUJ: "Fujairah", UAQ: "Umm Al Quwain",
};

type Branch = {
  id: string;
  code: string;
  name: string;
  emirate: string;
  phone: string | null;
  email: string | null;
  manager_user_id: string | null;
  is_active: boolean;
};

type BranchListResponse = { success: boolean; data: Branch[]; meta: { total: number } };

export function ScreenRealEstateBranches() {
  const t = useT();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getJson<BranchListResponse>("/api/admin/branches?limit=100")
      .then(res => { if (!cancelled) { setBranches(res.data ?? []); setError(null); } })
      .catch(err => { if (!cancelled) setError(err.message ?? "load_failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const activeCount = branches.filter(b => b.is_active).length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_branches} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcPin /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_branches}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                {loading ? "Chargement…" : `${branches.length} · ${activeCount} active(s)`}
              </div>
            </div>
          </div>
          <button style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 16px",
            background: "var(--gold)", color: "#1A1610", border: "none",
            borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            <IcPlus /> {t.add}
          </button>
        </div>

        {error && (
          <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>
            Erreur de chargement : {error}
          </div>
        )}

        {/* Table */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Code</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.nav_branches}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Emirate</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Contact</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {!loading && branches.length === 0 && !error && (
                <tr><td colSpan={5} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>Aucune succursale.</td></tr>
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
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                      background: b.is_active ? "rgba(16,185,129,0.12)" : "var(--line-soft)",
                      color: b.is_active ? "var(--emerald)" : "var(--ink-4)",
                    }}>
                      {b.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
