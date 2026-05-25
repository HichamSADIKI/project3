"use client";
import React from "react";
import { Topbar, IcHR, IcIT, IcFinance } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const MODULES = [
  {
    key: "hr", icon: <IcHR />, color: "var(--azure)",
    en: "HR", ar: "الموارد البشرية", fr: "RH",
    sub_en: "Staff records, payroll, leaves, recruitment",
    sub_ar: "سجلات الموظفين، الرواتب، الإجازات، التوظيف",
    sub_fr: "Dossiers RH, paie, congés, recrutement",
    kpi: "148 staff · 12 open",
  },
  {
    key: "it", icon: <IcIT />, color: "var(--emerald)",
    en: "IT", ar: "تقنية المعلومات", fr: "Informatique",
    sub_en: "Infrastructure, helpdesk, security, devices",
    sub_ar: "البنية التحتية، الدعم الفني، الأمن، الأجهزة",
    sub_fr: "Infrastructure, support, sécurité, appareils",
    kpi: "99.8% uptime · 14 tickets",
  },
  {
    key: "finance", icon: <IcFinance />, color: "var(--gold)",
    en: "Finance", ar: "المالية", fr: "Finance",
    sub_en: "Accounting, P&L, budget, bank reconciliation",
    sub_ar: "المحاسبة، الأرباح والخسائر، الميزانية، التسوية",
    sub_fr: "Comptabilité, P&L, budget, rapprochement bancaire",
    kpi: "AED 124M · Q2 2026",
  },
];

export function ScreenBackOffice({ onNavigate }: { onNavigate?: (k: string) => void }) {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const title = lang === "ar" ? "الإدارة الداخلية" : lang === "fr" ? "Back Office" : "Back Office";
  const label = (m: typeof MODULES[0]) => lang === "ar" ? m.ar : lang === "fr" ? m.fr : m.en;
  const sub   = (m: typeof MODULES[0]) => lang === "ar" ? m.sub_ar : lang === "fr" ? m.sub_fr : m.sub_en;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title} />
      <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "16px 12px" : "28px 32px", background: "var(--bg-cream)" }}>

        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(3,1fr)", gap: 18 }}>
          {MODULES.map(m => (
            <div
              key={m.key}
              onClick={() => onNavigate?.(m.key)}
              style={{
                background: "var(--bg-paper)", border: `1.5px solid ${m.color}30`,
                borderRadius: "var(--r)", padding: "26px 26px", cursor: "pointer",
                transition: "box-shadow 0.15s, transform 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-2)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                (e.currentTarget as HTMLDivElement).style.transform = "none";
              }}
            >
              <div style={{ width: 46, height: 46, borderRadius: "var(--r)", background: `${m.color}15`, display: "grid", placeItems: "center", color: m.color, marginBottom: 16 }}>
                {m.icon}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 8 }}>{label(m)}</div>
              <div style={{ fontSize: 12.5, color: "var(--ink-4)", lineHeight: 1.6, marginBottom: 16 }}>{sub(m)}</div>
              <div style={{ fontSize: 11.5, color: m.color, fontWeight: 600, paddingTop: 14, borderTop: `1px solid ${m.color}20` }}>
                {m.kpi}
              </div>
              <div style={{ marginTop: 10, fontSize: 11.5, fontWeight: 600, color: m.color }}>
                {lang === "ar" ? "فتح ←" : lang === "fr" ? "Ouvrir →" : "Open →"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
