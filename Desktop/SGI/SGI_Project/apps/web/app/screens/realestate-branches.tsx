"use client";

import React from "react";
import { Topbar, IcPin, IcPlus, IcPhone, IcMail } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique (comme les autres écrans). Le câblage à l'API
// /api/v1/branches (module realestate_core) viendra dans une étape ultérieure.

const EMIRATE_LABEL: Record<string, string> = {
  DXB: "Dubai", AUH: "Abu Dhabi", SHJ: "Sharjah", AJM: "Ajman",
  RAK: "Ras Al Khaimah", FUJ: "Fujairah", UAQ: "Umm Al Quwain",
};

const BRANCHES = [
  { code: "BR-001", name: "Dubai Marina", emirate: "DXB", manager: "Ahmed Al Mansoori", phone: "+971 4 555 0101", email: "marina@infinity.ae", active: true },
  { code: "BR-002", name: "Business Bay",  emirate: "DXB", manager: "Sara Khalil",       phone: "+971 4 555 0102", email: "bay@infinity.ae",    active: true },
  { code: "BR-003", name: "Abu Dhabi Corniche", emirate: "AUH", manager: "Yousef Rahman", phone: "+971 2 555 0103", email: "auh@infinity.ae", active: true },
  { code: "BR-004", name: "Sharjah Al Majaz", emirate: "SHJ", manager: "—",              phone: "+971 6 555 0104", email: "shj@infinity.ae",   active: false },
];

export function ScreenRealEstateBranches() {
  const t = useT();

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
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{BRANCHES.length} · {BRANCHES.filter(b => b.active).length} active</div>
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

        {/* Table */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Code</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.nav_branches}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Emirate</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Manager</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Contact</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {BRANCHES.map(b => (
                <tr key={b.code} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td className="tnum" style={{ padding: "13px 16px", fontWeight: 600, color: "var(--gold-deep)" }}>{b.code}</td>
                  <td style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink)" }}>{b.name}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{EMIRATE_LABEL[b.emirate]}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{b.manager}</td>
                  <td style={{ padding: "13px 16px", color: "var(--ink-3)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}><IcPhone /> {b.phone}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}><IcMail /> {b.email}</div>
                  </td>
                  <td style={{ padding: "13px 16px" }}>
                    <span style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                      background: b.active ? "rgba(16,185,129,0.12)" : "var(--line-soft)",
                      color: b.active ? "var(--emerald)" : "var(--ink-4)",
                    }}>
                      {b.active ? "Active" : "Inactive"}
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
