"use client";

import React from "react";
import { Topbar, IcWorkspace, IcProp, IcReport, IcBell, IcCheck } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique — aperçu (côté backoffice) du portail propriétaire connecté.
// Câblage à l'API /api/v1/owner/{dashboard,statements,notifications} ultérieur.

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const KPIS = [
  { icon: <IcProp />, label: "Biens", value: "3", color: "var(--gold)" },
  { icon: <IcReport />, label: "Relevés", value: "12", color: "var(--azure)" },
  { icon: <IcCheck />, label: "Dernier payout net", value: aed(424000), color: "var(--emerald)" },
  { icon: <IcBell />, label: "Notifs non lues", value: "2", color: "var(--rose)" },
];

const STATEMENTS = [
  { period: "2026-04", net: 424000, status: "sent" },
  { period: "2026-03", net: 410500, status: "sent" },
  { period: "2026-02", net: 398000, status: "sent" },
];

const NOTIFS = [
  { title: "Relevé 2026-04 disponible", type: "statement_ready", read: false },
  { title: "Devis maintenance à approuver — Marina A", type: "expense_approval", read: false },
  { title: "Payout 2026-03 viré", type: "payout_sent", read: true },
];

export function ScreenRealEstateOwnerPortal() {
  const t = useT();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_owner_portal} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ color: "var(--gold)" }}><IcWorkspace /></span>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_owner_portal}</div>
        </div>

        {/* KPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 26 }}>
          {KPIS.map(k => (
            <div key={k.label} style={{
              background: "var(--bg-paper)", border: "1px solid var(--line-soft)",
              borderRadius: "var(--r)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 8,
            }}>
              <span style={{ color: k.color }}>{k.icon}</span>
              <div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: "var(--ink)" }}>{k.value}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
          {/* Relevés */}
          <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
            <div className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>Relevés mensuels</div>
            {STATEMENTS.map(s => (
              <div key={s.period} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "9px 0", borderTop: "1px solid var(--line-soft)" }}>
                <span className="tnum" style={{ color: "var(--ink-2)" }}>{s.period}</span>
                <span className="tnum" style={{ fontWeight: 700, color: "var(--emerald)" }}>{aed(s.net)}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(16,185,129,0.12)", color: "var(--emerald)" }}>Envoyé</span>
              </div>
            ))}
          </div>

          {/* Notifications */}
          <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
            <div className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>Notifications</div>
            {NOTIFS.map(n => (
              <div key={n.title} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: "1px solid var(--line-soft)" }}>
                <span style={{ color: n.read ? "var(--ink-4)" : "var(--gold)" }}><IcBell /></span>
                <span style={{ flex: 1, fontSize: 13, color: n.read ? "var(--ink-4)" : "var(--ink)", fontWeight: n.read ? 400 : 500 }}>{n.title}</span>
                {!n.read && <span style={{ width: 8, height: 8, borderRadius: 999, background: "var(--gold)" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
