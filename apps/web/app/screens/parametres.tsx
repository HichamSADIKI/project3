"use client";
import React, { useState } from "react";
import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";
import { useTheme, type Palette } from "@/components/theme-provider";
import { useCanNode } from "@/lib/permissions";
import { AccessManager } from "./access-manager";

const SECTIONS = [
  {
    key: "appearance",
    en: "Appearance", ar: "المظهر", fr: "Apparence",
    settings: [],
  },
  {
    key: "general",
    en: "General", ar: "عام", fr: "Général",
    settings: [
      { key: "lang",     label_en: "Interface language",    label_ar: "لغة الواجهة",          label_fr: "Langue d'interface",    type: "select",  value: "French" },
      { key: "tz",       label_en: "Timezone",              label_ar: "المنطقة الزمنية",        label_fr: "Fuseau horaire",        type: "select",  value: "Asia/Dubai (UTC+4)" },
      { key: "currency", label_en: "Currency display",      label_ar: "عرض العملة",            label_fr: "Affichage devise",      type: "select",  value: "AED — Dirham" },
    ],
  },
  {
    key: "notifications",
    en: "Notifications", ar: "الإشعارات", fr: "Notifications",
    settings: [
      { key: "email",    label_en: "Email alerts",          label_ar: "تنبيهات البريد",         label_fr: "Alertes e-mail",        type: "toggle",  value: true },
      { key: "push",     label_en: "Push notifications",    label_ar: "الإشعارات الفورية",      label_fr: "Notifications push",    type: "toggle",  value: true },
      { key: "crm",      label_en: "CRM follow-up alerts",  label_ar: "تنبيهات المتابعة",       label_fr: "Alertes relance CRM",   type: "toggle",  value: true },
      { key: "visa",     label_en: "Golden Visa expiry",    label_ar: "انتهاء التأشيرة",        label_fr: "Expiration Visa Doré",  type: "toggle",  value: true },
    ],
  },
  {
    key: "security",
    en: "Security", ar: "الأمان", fr: "Sécurité",
    settings: [
      { key: "2fa",      label_en: "Two-factor auth (2FA)", label_ar: "المصادقة الثنائية",      label_fr: "Authentification 2FA",  type: "toggle",  value: true },
      { key: "session",  label_en: "Session timeout",       label_ar: "انتهاء الجلسة",          label_fr: "Expiration session",    type: "select",  value: "4 hours" },
      { key: "iplog",    label_en: "IP address logging",    label_ar: "تسجيل عناوين IP",        label_fr: "Journal adresses IP",   type: "toggle",  value: true },
      { key: "passreset",label_en: "Password reset",        label_ar: "إعادة تعيين كلمة المرور", label_fr: "Réinitialiser MDP",    type: "action",  value: "" },
    ],
  },
  {
    key: "integrations",
    en: "Integrations", ar: "التكاملات", fr: "Intégrations",
    settings: [
      { key: "ms365",    label_en: "Microsoft 365",         label_ar: "مايكروسوفت 365",         label_fr: "Microsoft 365",         type: "status",  value: "connected" },
      { key: "whatsapp", label_en: "WhatsApp Business",     label_ar: "واتساب بيزنس",           label_fr: "WhatsApp Business",     type: "status",  value: "connected" },
      { key: "dld",      label_en: "DLD (Dubai Land Dept)", label_ar: "دائرة الأراضي دبي",      label_fr: "DLD Dubai",             type: "status",  value: "connected" },
      { key: "gdrfa",    label_en: "GDRFA",                 label_ar: "إدارة الإقامة",           label_fr: "GDRFA",                 type: "status",  value: "disconnected" },
    ],
  },
];

const PALETTES: { key: Palette; label_en: string; label_ar: string; label_fr: string; bg: string; accent: string; text: string }[] = [
  { key: "slate",    label_en: "Slate Pro",    label_ar: "رمادي برو",    label_fr: "Slate Pro",    bg: "#F1F3F5", accent: "#B8924F", text: "#374151" },
  { key: "gold",     label_en: "Dubai Gold",   label_ar: "ذهب دبي",      label_fr: "Or Dubaï",     bg: "#FBF7EC", accent: "#B8924F", text: "#3D352A" },
  { key: "midnight", label_en: "Midnight",     label_ar: "منتصف الليل",  label_fr: "Minuit",       bg: "#F8FAFC", accent: "#B8924F", text: "#1E3A5F" },
  { key: "sage",     label_en: "Sage Forest",  label_ar: "أخضر الغابة",  label_fr: "Forêt Sage",   bg: "#F7F8F4", accent: "#B8924F", text: "#344A28" },
];

export function ScreenParametres() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const { theme, palette, toggle, setPalette } = useTheme();
  const canAccess = useCanNode("settings.access");
  const [activeSection, setActiveSection] = useState("appearance");

  // Section « Accès & Permissions » (IAM) — visible seulement si l'utilisateur a
  // la permission settings.access (admin par défaut). La sécurité réelle est backend.
  const sections = canAccess
    ? [
        ...SECTIONS,
        { key: "access", en: "Access & Permissions", ar: "الوصول والصلاحيات", fr: "Accès & Permissions", settings: [] },
      ]
    : SECTIONS;
  const [toggles, setToggles] = useState<Record<string, boolean>>({
    email: true, push: true, crm: true, visa: true, "2fa": true, iplog: true,
  });

  const title = lang === "ar" ? "الإعدادات" : lang === "fr" ? "Paramètres" : "Settings";
  const sLabel = (s: typeof SECTIONS[0]) => lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en;
  const settingLabel = (s: { label_en: string; label_ar: string; label_fr: string }) =>
    lang === "ar" ? s.label_ar : lang === "fr" ? s.label_fr : s.label_en;

  const section = sections.find(s => s.key === activeSection)!;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title} />
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: isMob ? "column" : "row" }}>

        {/* Sidebar nav */}
        <div style={{ width: isMob ? "100%" : 200, flexShrink: 0, borderInlineEnd: "1px solid var(--line-soft)", padding: "20px 0", background: "var(--bg-paper)", overflowY: "auto" }}>
          {sections.map(s => (
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

          {/* ── Appearance panel ── */}
          {activeSection === "appearance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 560 }}>

              {/* Dark / Light toggle */}
              <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r-md)", padding: "20px 24px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 14 }}>
                  {lang === "ar" ? "وضع العرض" : lang === "fr" ? "Mode d'affichage" : "Display mode"}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  {(["light", "dark"] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { if (theme !== m) toggle(); }}
                      style={{
                        flex: 1, padding: "14px 12px", borderRadius: "var(--r)",
                        border: `2px solid ${theme === m ? "var(--gold)" : "var(--line-soft)"}`,
                        background: theme === m ? "var(--gold-ghost)" : "var(--bg-base)",
                        cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                        transition: "all 0.15s ease",
                      }}
                    >
                      <div style={{ fontSize: 22 }}>{m === "light" ? "☀️" : "🌙"}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: theme === m ? "var(--gold-deep)" : "var(--ink-3)" }}>
                        {m === "light"
                          ? (lang === "ar" ? "فاتح" : lang === "fr" ? "Clair" : "Light")
                          : (lang === "ar" ? "داكن" : lang === "fr" ? "Sombre" : "Dark")}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Palette picker */}
              <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r-md)", padding: "20px 24px" }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                  {lang === "ar" ? "نظام الألوان" : lang === "fr" ? "Palette de couleurs" : "Color palette"}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBottom: 16 }}>
                  {lang === "ar" ? "يُطبَّق فوراً على واجهة التطبيق بالكامل"
                    : lang === "fr" ? "Appliqué instantanément sur toute l'interface"
                    : "Applied instantly across the entire interface"}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                  {PALETTES.map(p => {
                    const isActive = palette === p.key;
                    const pLabel = lang === "ar" ? p.label_ar : lang === "fr" ? p.label_fr : p.label_en;
                    return (
                      <button
                        key={p.key}
                        onClick={() => setPalette(p.key)}
                        style={{
                          padding: "14px 16px", borderRadius: "var(--r)",
                          border: `2px solid ${isActive ? "var(--gold)" : "var(--line-soft)"}`,
                          background: isActive ? "var(--gold-ghost)" : "var(--bg-base)",
                          cursor: "pointer", display: "flex", alignItems: "center", gap: 12,
                          transition: "all 0.15s ease", textAlign: "start",
                          boxShadow: isActive ? "0 0 0 1px var(--gold)" : "none",
                        }}
                      >
                        {/* Color swatch */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 3, flexShrink: 0 }}>
                          <div style={{ width: 32, height: 14, borderRadius: 4, background: p.bg, border: "1px solid rgba(0,0,0,0.08)" }} />
                          <div style={{ width: 32, height: 6, borderRadius: 3, background: p.accent }} />
                          <div style={{ width: 32, height: 6, borderRadius: 3, background: p.text, opacity: 0.5 }} />
                        </div>
                        <div>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? "var(--gold-deep)" : "var(--ink)", lineHeight: 1.3 }}>
                            {pLabel}
                          </div>
                          {isActive && (
                            <div style={{ fontSize: 10, color: "var(--gold)", marginTop: 2 }}>
                              {lang === "ar" ? "✓ مفعّل" : lang === "fr" ? "✓ Actif" : "✓ Active"}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Accès & Permissions (IAM) ── */}
          {activeSection === "access" && <AccessManager />}

          {/* ── Other sections ── */}
          {activeSection !== "appearance" && activeSection !== "access" && (
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
          )}
        </div>
      </div>
    </div>
  );
}
