"use client";
import React, { useState } from "react";
import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const SECTIONS = [
  {
    key: "general",
    en: "General", ar: "عام", fr: "Général",
    settings: [
      { key: "lang",     label_en: "Interface language",   label_ar: "لغة الواجهة",         label_fr: "Langue d'interface",    type: "select",  value: "French" },
      { key: "tz",       label_en: "Timezone",             label_ar: "المنطقة الزمنية",       label_fr: "Fuseau horaire",        type: "select",  value: "Asia/Dubai (UTC+4)" },
      { key: "currency", label_en: "Currency display",     label_ar: "عرض العملة",           label_fr: "Affichage devise",      type: "select",  value: "AED — Dirham" },
      { key: "darkmode", label_en: "Dark mode",            label_ar: "الوضع الداكن",          label_fr: "Mode sombre",           type: "toggle",  value: false },
    ],
  },
  {
    key: "notifications",
    en: "Notifications", ar: "الإشعارات", fr: "Notifications",
    settings: [
      { key: "email",    label_en: "Email alerts",         label_ar: "تنبيهات البريد",        label_fr: "Alertes e-mail",        type: "toggle",  value: true },
      { key: "push",     label_en: "Push notifications",   label_ar: "الإشعارات الفورية",     label_fr: "Notifications push",    type: "toggle",  value: true },
      { key: "crm",      label_en: "CRM follow-up alerts", label_ar: "تنبيهات المتابعة",      label_fr: "Alertes relance CRM",   type: "toggle",  value: true },
      { key: "visa",     label_en: "Golden Visa expiry",   label_ar: "انتهاء التأشيرة",       label_fr: "Expiration Visa Doré",  type: "toggle",  value: true },
    ],
  },
  {
    key: "security",
    en: "Security", ar: "الأمان", fr: "Sécurité",
    settings: [
      { key: "2fa",      label_en: "Two-factor auth (2FA)",label_ar: "المصادقة الثنائية",     label_fr: "Authentification 2FA",  type: "toggle",  value: true },
      { key: "session",  label_en: "Session timeout",      label_ar: "انتهاء الجلسة",         label_fr: "Expiration session",    type: "select",  value: "4 hours" },
      { key: "iplog",    label_en: "IP address logging",   label_ar: "تسجيل عناوين IP",       label_fr: "Journal adresses IP",   type: "toggle",  value: true },
      { key: "passreset",label_en: "Password reset",       label_ar: "إعادة تعيين كلمة المرور",label_fr: "Réinitialiser MDP",   type: "action",  value: "" },
    ],
  },
  {
    key: "integrations",
    en: "Integrations", ar: "التكاملات", fr: "Intégrations",
    settings: [
      { key: "ms365",    label_en: "Microsoft 365",        label_ar: "مايكروسوفت 365",        label_fr: "Microsoft 365",         type: "status",  value: "connected" },
      { key: "whatsapp", label_en: "WhatsApp Business",    label_ar: "واتساب بيزنس",          label_fr: "WhatsApp Business",     type: "status",  value: "connected" },
      { key: "dld",      label_en: "DLD (Dubai Land Dept)",label_ar: "دائرة الأراضي دبي",     label_fr: "DLD Dubai",             type: "status",  value: "connected" },
      { key: "gdrfa",    label_en: "GDRFA",                label_ar: "إدارة الإقامة",          label_fr: "GDRFA",                 type: "status",  value: "disconnected" },
    ],
  },
];

export function ScreenParametres() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const [activeSection, setActiveSection] = useState("general");
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    darkmode: false, email: true, push: true, crm: true, visa: true, "2fa": true, iplog: true,
  });

  const title = lang === "ar" ? "الإعدادات" : lang === "fr" ? "Paramètres" : "Settings";
  const sLabel = (s: typeof SECTIONS[0]) => lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en;
  const settingLabel = (s: { label_en: string; label_ar: string; label_fr: string }) =>
    lang === "ar" ? s.label_ar : lang === "fr" ? s.label_fr : s.label_en;

  const section = SECTIONS.find(s => s.key === activeSection)!;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: isMob ? "column" : "row" }}>

        {/* Sidebar nav */}
        <div style={{ width: isMob ? "100%" : 200, flexShrink: 0, borderInlineEnd: "1px solid var(--line-soft)", padding: "20px 0", background: "var(--bg-paper)", overflowY: "auto" }}>
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setActiveSection(s.key)}
              style={{
                width: "100%", textAlign: "start", padding: "10px 20px", fontSize: 13, fontWeight: activeSection === s.key ? 600 : 400,
                border: "none", background: activeSection === s.key ? "var(--gold-ghost)" : "none",
                color: activeSection === s.key ? "var(--gold-deep)" : "var(--ink-3)",
                borderInlineStart: `3px solid ${activeSection === s.key ? "var(--gold)" : "transparent"}`,
                cursor: "pointer",
              }}
            >
              {sLabel(s)}
            </button>
          ))}
        </div>

        {/* Settings panel */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "20px 16px" : "32px 40px", background: "var(--bg-cream)" }}>
          <div className="font-display" style={{ fontSize: 16, color: "var(--ink)", marginBottom: 24 }}>
            {sLabel(section)}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 560 }}>
            {section.settings.map(st => (
              <div key={st.key} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{settingLabel(st)}</div>

                {st.type === "toggle" && (
                  <button
                    onClick={() => setToggles(t => ({ ...t, [st.key]: !t[st.key] }))}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", flexShrink: 0,
                      background: toggles[st.key] ? "var(--emerald)" : "var(--line-soft)",
                      position: "relative", transition: "background 0.2s",
                    }}
                  >
                    <span style={{
                      position: "absolute", top: 3, width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      insetInlineStart: toggles[st.key] ? 23 : 3,
                      transition: "inset-inline-start 0.2s",
                    }} />
                  </button>
                )}

                {st.type === "select" && (
                  <span style={{ fontSize: 12, color: "var(--ink-4)", background: "var(--bg-cream)", padding: "4px 12px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)" }}>
                    {st.value}
                  </span>
                )}

                {st.type === "status" && (
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999,
                    background: st.value === "connected" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                    color: st.value === "connected" ? "var(--emerald)" : "var(--rose)",
                  }}>
                    {st.value === "connected"
                      ? (lang === "ar" ? "متصل" : lang === "fr" ? "Connecté" : "Connected")
                      : (lang === "ar" ? "غير متصل" : lang === "fr" ? "Déconnecté" : "Disconnected")}
                  </span>
                )}

                {st.type === "action" && (
                  <button style={{ fontSize: 12, fontWeight: 600, color: "var(--gold-deep)", background: "none", border: "1px solid var(--gold)", borderRadius: "var(--r)", padding: "4px 14px", cursor: "pointer" }}>
                    {lang === "ar" ? "إعادة تعيين" : lang === "fr" ? "Réinitialiser" : "Reset"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
