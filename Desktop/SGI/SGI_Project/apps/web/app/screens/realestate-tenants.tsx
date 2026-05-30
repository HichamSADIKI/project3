"use client";

import React from "react";
import { Topbar, IcPersonne, IcPlus, IcCheck, IcClock } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique. Câblage à l'API /api/v1/tenants (+ /{id}/kyc) prévu
// lors d'une étape de wiring ultérieure.

const LIFECYCLE: Record<string, { label: string; color: string; bg: string }> = {
  candidate:   { label: "Candidat",  color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  active:      { label: "Actif",     color: "var(--emerald)",  bg: "rgba(16,185,129,0.12)" },
  former:      { label: "Ancien",    color: "var(--ink-4)",    bg: "var(--line-soft)" },
  blacklisted: { label: "Blacklisté", color: "var(--rose)",    bg: "var(--rose-soft)" },
};

const KYC: Record<string, { label: string; color: string; bg: string }> = {
  not_started: { label: "Non démarré", color: "var(--ink-4)",   bg: "var(--line-soft)" },
  pending:     { label: "En revue",    color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  verified:    { label: "Vérifié",     color: "var(--emerald)",  bg: "rgba(16,185,129,0.12)" },
  rejected:    { label: "Rejeté",      color: "var(--rose)",     bg: "var(--rose-soft)" },
};

const TENANTS = [
  { name: "Omar Haddad", lifecycle: "active", kyc: "verified", loyalty: 88, visaAlert: null },
  { name: "Lina Said", lifecycle: "candidate", kyc: "pending", loyalty: 50, visaAlert: "warning" },
  { name: "Raj Patel", lifecycle: "active", kyc: "verified", loyalty: 72, visaAlert: "critical" },
  { name: "Nadia Khalifa", lifecycle: "candidate", kyc: "not_started", loyalty: 50, visaAlert: null },
  { name: "Tom Becker", lifecycle: "former", kyc: "rejected", loyalty: 34, visaAlert: "expired" },
];

const VISA_ALERT: Record<string, { label: string; color: string }> = {
  expired:  { label: "Visa expiré", color: "var(--rose)" },
  critical: { label: "Visa ≤30j",   color: "var(--rose)" },
  warning:  { label: "Visa ≤90j",   color: "var(--gold-deep)" },
};

function loyaltyColor(n: number): string {
  if (n >= 75) return "var(--emerald)";
  if (n >= 50) return "var(--gold)";
  return "var(--rose)";
}

export function ScreenRealEstateTenants() {
  const t = useT();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_tenants} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcPersonne /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_tenants}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                {TENANTS.length} · {TENANTS.filter(x => x.kyc === "verified").length} KYC vérifié(s)
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
              {TENANTS.map(x => {
                const lc = LIFECYCLE[x.lifecycle];
                const kyc = KYC[x.kyc];
                const va = x.visaAlert ? VISA_ALERT[x.visaAlert] : null;
                return (
                  <tr key={x.name} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink)" }}>{x.name}</td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: lc.bg, color: lc.color }}>{lc.label}</span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: kyc.bg, color: kyc.color }}>
                        {x.kyc === "verified" ? <IcCheck /> : x.kyc === "pending" ? <IcClock /> : null}{kyc.label}
                      </span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span className="tnum" style={{ fontWeight: 600, color: loyaltyColor(x.loyalty) }}>{x.loyalty}</span>
                      <span style={{ color: "var(--ink-4)", fontSize: 11 }}> /100</span>
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      {va ? (
                        <span style={{ fontSize: 12, fontWeight: 600, color: va.color }}>⚠ {va.label}</span>
                      ) : (
                        <span style={{ color: "var(--ink-4)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
