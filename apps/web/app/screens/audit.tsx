"use client";
import React, { useState } from "react";
import { Topbar, IcArrowUp, IcArrowDown } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const KPIS = [
  { key: "events",  color: "var(--azure)",   value: "18 432", delta: "+1 204 this week", up: true,  label_en: "Audit events",    label_ar: "أحداث المراجعة",  label_fr: "Événements d'audit" },
  { key: "alerts",  color: "var(--rose)",    value: "7",      delta: "2 critical",       up: false, label_en: "Open alerts",     label_ar: "تنبيهات مفتوحة",  label_fr: "Alertes ouvertes" },
  { key: "compl",   color: "var(--emerald)", value: "96.4 %", delta: "+1.2 pts vs last", up: true,  label_en: "Compliance score", label_ar: "درجة الامتثال",   label_fr: "Score de conformité" },
  { key: "users",   color: "var(--gold)",    value: "148",    delta: "monitored",        up: null,  label_en: "Users monitored", label_ar: "مستخدمون مراقبون", label_fr: "Utilisateurs suivis" },
];

const AUDIT_LOG = [
  { id: "A-1042", action: "Login", user: "S. Hicham",   module: "Auth",       ip: "185.40.4.12",   risk: "low",    time: "10:42",  date: "Today" },
  { id: "A-1041", action: "Export",user: "L. Karim",    module: "Clients",    ip: "41.200.15.3",   risk: "medium", time: "10:18",  date: "Today" },
  { id: "A-1040", action: "Delete",user: "N. Amira",    module: "Documents",  ip: "185.40.4.18",   risk: "high",   time: "09:55",  date: "Today" },
  { id: "A-1039", action: "Login", user: "M. Youssef",  module: "Auth",       ip: "41.200.15.9",   risk: "low",    time: "09:31",  date: "Today" },
  { id: "A-1038", action: "Update",user: "R. Fatiha",   module: "Contracts",  ip: "185.40.4.22",   risk: "low",    time: "08:47",  date: "Today" },
  { id: "A-1037", action: "Export",user: "S. Hicham",   module: "Finance",    ip: "185.40.4.12",   risk: "medium", time: "17:30",  date: "Yesterday" },
  { id: "A-1036", action: "Create",user: "L. Karim",    module: "Clients",    ip: "41.200.15.3",   risk: "low",    time: "16:12",  date: "Yesterday" },
  { id: "A-1035", action: "Delete",user: "Admin",       module: "Users",      ip: "10.0.0.1",      risk: "high",   time: "14:05",  date: "Yesterday" },
];

const RISK: Record<string, { bg: string; color: string; en: string; ar: string; fr: string }> = {
  low:    { bg: "rgba(16,185,129,0.1)",  color: "var(--emerald)", en: "Low",      ar: "منخفض",  fr: "Faible" },
  medium: { bg: "rgba(200,160,60,0.15)", color: "var(--gold)",    en: "Medium",   ar: "متوسط",  fr: "Moyen" },
  high:   { bg: "rgba(239,68,68,0.1)",   color: "var(--rose)",    en: "High",     ar: "مرتفع",  fr: "Élevé" },
};

const COMPLIANCE = [
  { label_en: "Data access control",    label_ar: "التحكم في الوصول للبيانات",  label_fr: "Contrôle d'accès aux données", score: 98 },
  { label_en: "Password policy",        label_ar: "سياسة كلمة المرور",           label_fr: "Politique de mot de passe",    score: 100 },
  { label_en: "Document retention",     label_ar: "الاحتفاظ بالوثائق",           label_fr: "Rétention des documents",      score: 91 },
  { label_en: "Audit trail integrity",  label_ar: "سلامة مسار التدقيق",          label_fr: "Intégrité de la piste d'audit",score: 97 },
  { label_en: "User activity logging",  label_ar: "تسجيل نشاط المستخدم",         label_fr: "Journalisation des activités", score: 95 },
  { label_en: "GDPR / UAE data law",    label_ar: "قانون البيانات الإماراتي",    label_fr: "RGPD / loi données EAU",       score: 88 },
];

export function ScreenAudit() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const [riskFilter, setRiskFilter] = useState<"all"|"low"|"medium"|"high">("all");

  const title = lang === "ar" ? "المراجعة والتدقيق" : lang === "fr" ? "Audit" : "Audit";
  const riskLabel = (r: string) => RISK[r][lang as "en"|"ar"|"fr"];

  const filtered = AUDIT_LOG.filter(e => riskFilter === "all" || e.risk === riskFilter);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title} />
      <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "16px 12px" : "28px 32px", background: "var(--bg-cream)" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
          {KPIS.map(k => (
            <div key={k.key} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
              <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginBottom: 6 }}>
                {lang === "ar" ? k.label_ar : lang === "fr" ? k.label_fr : k.label_en}
              </div>
              <div className="tnum font-display" style={{ fontSize: 26, color: k.color, lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
              <div style={{ fontSize: 10.5, display: "flex", alignItems: "center", gap: 4, color: k.up === null ? "var(--ink-4)" : k.up ? "var(--emerald)" : "var(--rose)" }}>
                {k.up === true && <IcArrowUp />}{k.up === false && <IcArrowDown />}{k.delta}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 340px", gap: 20 }}>

          {/* Audit log */}
          <div>
            {/* Risk filter */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              {(["all","low","medium","high"] as const).map(r => {
                const labels = { all: { en:"All", ar:"الكل", fr:"Tous" }, low: { en:"Low", ar:"منخفض", fr:"Faible" }, medium: { en:"Medium", ar:"متوسط", fr:"Moyen" }, high: { en:"High", ar:"مرتفع", fr:"Élevé" } };
                return (
                  <button key={r} onClick={() => setRiskFilter(r)} style={{
                    padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid",
                    background: riskFilter === r ? "var(--ink)" : "transparent",
                    borderColor: riskFilter === r ? "var(--ink)" : "var(--line-soft)",
                    color: riskFilter === r ? "var(--bg-paper)" : "var(--ink-4)",
                  }}>
                    {labels[r][lang as "en"|"ar"|"fr"]}
                  </button>
                );
              })}
            </div>

            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)" }}>
                <span className="font-display" style={{ fontSize: 13, color: "var(--ink)" }}>
                  {lang === "ar" ? "سجل الأحداث" : lang === "fr" ? "Journal d'audit" : "Audit log"}
                </span>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-cream)" }}>
                    {[
                      lang === "ar" ? "المعرف" : "ID",
                      lang === "ar" ? "الإجراء" : lang === "fr" ? "Action" : "Action",
                      lang === "ar" ? "المستخدم" : lang === "fr" ? "Utilisateur" : "User",
                      lang === "ar" ? "الوحدة" : lang === "fr" ? "Module" : "Module",
                      lang === "ar" ? "عنوان IP" : "IP",
                      lang === "ar" ? "الخطورة" : lang === "fr" ? "Risque" : "Risk",
                      lang === "ar" ? "الوقت" : lang === "fr" ? "Heure" : "Time",
                    ].map(h => (
                      <th key={h} style={{ padding: "9px 14px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e, i) => (
                    <tr key={e.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--ink-4)", fontFamily: "Roboto, sans-serif" }}>{e.id}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>{e.action}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--ink-2)" }}>{e.user}</td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--ink-4)" }}>{e.module}</td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--ink-4)", fontFamily: "Roboto, sans-serif" }}>{e.ip}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: RISK[e.risk].bg, color: RISK[e.risk].color }}>
                          {riskLabel(e.risk)}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 11, color: "var(--ink-4)" }}>{e.date} {e.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compliance panel */}
          <div>
            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "20px 22px" }}>
              <div className="font-display" style={{ fontSize: 13, color: "var(--ink)", marginBottom: 18 }}>
                {lang === "ar" ? "درجات الامتثال" : lang === "fr" ? "Conformité" : "Compliance checks"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {COMPLIANCE.map(c => {
                  const label = lang === "ar" ? c.label_ar : lang === "fr" ? c.label_fr : c.label_en;
                  const color = c.score >= 95 ? "var(--emerald)" : c.score >= 85 ? "var(--gold)" : "var(--rose)";
                  return (
                    <div key={c.label_en}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: "var(--ink-2)" }}>{label}</span>
                        <span className="tnum" style={{ fontSize: 12, fontWeight: 700, color }}>{c.score}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 999, background: "var(--line-soft)" }}>
                        <div style={{ height: "100%", borderRadius: 999, background: color, width: `${c.score}%`, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
