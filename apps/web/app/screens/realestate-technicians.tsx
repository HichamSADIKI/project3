"use client";

import React, { useEffect, useState } from "react";
import { Topbar, IcPersonne } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";

// Sous-catégorie « Techniciens » (pôle Tiers Immobilier).
// Câblé sur /api/admin/technicians → /api/v1/technicians (migration 0002, rôle-partie).
// Lecture seule : la création exige un user_id salarié existant (sélecteur hors périmètre).

type Technician = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  skills: string[];
  assigned_zones: string[];
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  avg_resolution_hours: number | null;
  mobile_active: boolean;
  on_call: boolean;
  emergency_contact_phone: string | null;
};

type Summary = {
  total: number;
  mobile_active_count: number;
  on_call_count: number;
  by_skill: Record<string, number>;
  jobs_completed_total: number;
};

const intFmt = new Intl.NumberFormat("en-AE");

function shortRef(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

const chip = {
  fontSize: 11,
  fontWeight: 600,
  padding: "2px 8px",
  borderRadius: 999,
  background: "var(--bg-cream)",
  color: "var(--ink-3)",
  border: "1px solid var(--line-soft)",
} as const;

export function ScreenRealEstateTechnicians() {
  const t = useT();
  const { items, loading, error } = useApiList<Technician>("/api/admin/technicians?limit=100");
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/technicians/summary")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (!cancelled && j?.data) setSummary(j.data as Summary); })
      .catch(() => { /* résumé optionnel : silencieux */ });
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_technicians} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{ color: "var(--gold)" }}><IcPersonne /></span>
          <div>
            <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_technicians}</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{items.length} {t.tech_count} · {t.tech_subtitle}</div>
          </div>
        </div>

        {summary && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginBottom: 22 }}>
            {[
              { label: t.tech_kpi_total, value: summary.total },
              { label: t.tech_kpi_mobile, value: summary.mobile_active_count },
              { label: t.tech_kpi_oncall, value: summary.on_call_count },
              { label: t.tech_kpi_jobs, value: summary.jobs_completed_total },
            ].map((k) => (
              <div key={k.label} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "14px 16px" }}>
                <div className="tnum font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>{intFmt.format(k.value)}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {error}</div>}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.tech_col_ref}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.tech_col_skills}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.tech_col_zones}</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.tech_col_rating}</th>
                <th style={{ textAlign: "end", padding: "12px 16px", fontWeight: 600 }}>{t.tech_col_jobs}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.tech_col_status}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.loading}</td></tr>
              )}
              {!loading && items.length === 0 && !error && (
                <tr><td colSpan={6} style={{ padding: "24px 16px", textAlign: "center", color: "var(--ink-4)" }}>{t.tech_empty}</td></tr>
              )}
              {items.map((tech) => (
                <tr key={tech.user_id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ fontWeight: 600, color: "var(--ink)" }}>{tech.full_name ?? "—"}</div>
                    <div className="tnum" style={{ fontSize: 11, color: "var(--ink-4)" }}>{tech.email ?? shortRef(tech.user_id)}</div>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {tech.skills.length === 0 ? <span style={{ color: "var(--ink-4)" }}>—</span> : tech.skills.map((s) => <span key={s} style={chip}>{s}</span>)}
                    </div>
                  </td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{tech.assigned_zones.length ? tech.assigned_zones.join(", ") : "—"}</td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>
                    {tech.rating_count > 0 ? `${Number(tech.rating_avg).toFixed(1)} (${tech.rating_count})` : "—"}
                  </td>
                  <td className="tnum" style={{ padding: "13px 16px", textAlign: "end", color: "var(--ink-2)" }}>{intFmt.format(tech.jobs_completed)}</td>
                  <td style={{ padding: "13px 16px" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, color: tech.mobile_active ? "var(--emerald)" : "var(--ink-4)", background: tech.mobile_active ? "rgba(16,185,129,0.12)" : "var(--line-soft)" }}>
                        {tech.mobile_active ? t.tech_status_mobile : t.tech_status_offsite}
                      </span>
                      {tech.on_call && (
                        <span style={{ fontSize: 11.5, fontWeight: 600, padding: "3px 10px", borderRadius: 999, color: "var(--gold)", background: "rgba(201,168,76,0.14)" }}>
                          {t.tech_status_oncall}
                        </span>
                      )}
                    </div>
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
