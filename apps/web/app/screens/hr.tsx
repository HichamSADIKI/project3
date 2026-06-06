"use client";
import React, { useState } from "react";
import { Topbar, IcArrowUp, IcArrowDown } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const KPIS = [
  { key: "staff",    color: "var(--azure)",   value: "148",     delta_en: "+6 this month",     delta_ar: "+6 هذا الشهر",     delta_fr: "+6 ce mois",    up: true,  label_en: "Total staff",      label_ar: "إجمالي الموظفين",  label_fr: "Effectif total" },
  { key: "open",     color: "var(--gold)",    value: "12",      delta_en: "open positions",    delta_ar: "وظائف شاغرة",      delta_fr: "postes ouverts", up: null, label_en: "Open positions",   label_ar: "وظائف شاغرة",      label_fr: "Postes ouverts" },
  { key: "leave",    color: "var(--emerald)", value: "7",       delta_en: "on leave today",    delta_ar: "في إجازة اليوم",   delta_fr: "en congé auj.",  up: null, label_en: "On leave today",   label_ar: "في إجازة اليوم",   label_fr: "En congé aujourd'hui" },
  { key: "retent",   color: "var(--emerald)", value: "94.2 %",  delta_en: "+1.4 pts / yr",     delta_ar: "+1.4 نقطة/سنة",    delta_fr: "+1.4 pts / an",  up: true, label_en: "Retention rate",   label_ar: "معدل الاحتفاظ",    label_fr: "Taux de rétention" },
];

const DEPARTMENTS = [
  { name_en: "Sales & CRM",        name_ar: "المبيعات",       name_fr: "Ventes & CRM",       headcount: 32, open: 4, color: "var(--azure)" },
  { name_en: "Operations",         name_ar: "العمليات",        name_fr: "Opérations",          headcount: 28, open: 2, color: "var(--emerald)" },
  { name_en: "Legal & Contracts",  name_ar: "القانون",         name_fr: "Juridique",           headcount: 11, open: 1, color: "var(--gold)" },
  { name_en: "Finance",            name_ar: "المالية",         name_fr: "Finance",             headcount: 14, open: 0, color: "var(--emerald)" },
  { name_en: "IT",                 name_ar: "تقنية المعلومات", name_fr: "Informatique",        headcount: 18, open: 3, color: "var(--azure)" },
  { name_en: "HR & Admin",         name_ar: "الموارد البشرية", name_fr: "RH & Admin",          headcount: 9,  open: 1, color: "var(--gold)" },
  { name_en: "Marketing",          name_ar: "التسويق",         name_fr: "Marketing",           headcount: 12, open: 1, color: "var(--rose)" },
  { name_en: "Golden Visa Unit",   name_ar: "وحدة التأشيرة",  name_fr: "Unité Visa Doré",     headcount: 8,  open: 0, color: "var(--gold)" },
  { name_en: "Property Mgmt",      name_ar: "إدارة العقارات",  name_fr: "Gestion Immobilière", headcount: 16, open: 0, color: "var(--emerald)" },
];

const EMPLOYEES = [
  { name: "Hicham Sadiki",   role_en: "Managing Director",   dept_en: "Operations",   status: "active",   joined: "Jan 2020", leave: false },
  { name: "Leila Karim",     role_en: "Senior Sales Agent",  dept_en: "Sales & CRM",  status: "active",   joined: "Mar 2021", leave: false },
  { name: "Nadia Amira",     role_en: "HR Manager",          dept_en: "HR & Admin",   status: "active",   joined: "Jun 2019", leave: false },
  { name: "Rachid Fatiha",   role_en: "Legal Counsel",       dept_en: "Legal & Contracts", status: "active", joined: "Sep 2022", leave: false },
  { name: "Mohammed Youssef",role_en: "IT Lead",             dept_en: "IT",           status: "active",   joined: "Feb 2023", leave: true  },
  { name: "Sara Al Zaabi",   role_en: "Finance Analyst",     dept_en: "Finance",      status: "active",   joined: "Nov 2021", leave: false },
  { name: "Omar Al Rashid",  role_en: "Sales Agent",         dept_en: "Sales & CRM",  status: "trial",    joined: "May 2026", leave: false },
  { name: "Fatima Al Hosni", role_en: "Marketing Manager",   dept_en: "Marketing",    status: "active",   joined: "Apr 2022", leave: false },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: "rgba(16,185,129,0.1)",  color: "var(--emerald)" },
  trial:  { bg: "rgba(200,160,60,0.15)", color: "var(--gold)" },
  leave:  { bg: "rgba(120,120,120,0.1)", color: "var(--ink-4)" },
};

export function ScreenHR() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const [tab, setTab] = useState<"team" | "depts">("team");

  const title = lang === "ar" ? "الموارد البشرية" : lang === "fr" ? "RH" : "HR";
  const dName = (d: typeof DEPARTMENTS[0]) => lang === "ar" ? d.name_ar : lang === "fr" ? d.name_fr : d.name_en;

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
                {k.up === true && <IcArrowUp />}{k.up === false && <IcArrowDown />}{lang === "ar" ? k.delta_ar : lang === "fr" ? k.delta_fr : k.delta_en}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--line-soft)" }}>
          {(["team","depts"] as const).map(t => {
            const labels = { team: { en:"Team", ar:"الفريق", fr:"Équipe" }, depts: { en:"Departments", ar:"الأقسام", fr:"Départements" } };
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: "none", background: "none",
                color: tab === t ? "var(--gold)" : "var(--ink-4)",
                borderBottom: `2px solid ${tab === t ? "var(--gold)" : "transparent"}`,
                marginBottom: -1,
              }}>
                {labels[t][lang as "en"|"ar"|"fr"]}
              </button>
            );
          })}
        </div>

        {/* Team tab */}
        {tab === "team" && (
          <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-cream)" }}>
                  {[
                    lang === "ar" ? "الموظف" : lang === "fr" ? "Employé" : "Employee",
                    lang === "ar" ? "المنصب" : lang === "fr" ? "Poste" : "Role",
                    lang === "ar" ? "القسم" : lang === "fr" ? "Département" : "Dept",
                    lang === "ar" ? "الحالة" : lang === "fr" ? "Statut" : "Status",
                    lang === "ar" ? "تاريخ الانضمام" : lang === "fr" ? "Arrivée" : "Joined",
                  ].map(h => (
                    <th key={h} style={{ padding: "9px 18px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EMPLOYEES.map((e, i) => {
                  const st = e.leave ? "leave" : e.status;
                  return (
                    <tr key={e.name} style={{ borderBottom: i < EMPLOYEES.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--azure)", display: "grid", placeItems: "center", color: "#fff", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                            {e.name.split(" ").map(w => w[0]).slice(0,2).join("")}
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{e.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: "12px 18px", fontSize: 12, color: "var(--ink-2)" }}>{e.role_en}</td>
                      <td style={{ padding: "12px 18px", fontSize: 12, color: "var(--ink-4)" }}>{e.dept_en}</td>
                      <td style={{ padding: "12px 18px" }}>
                        <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: STATUS_STYLE[st].bg, color: STATUS_STYLE[st].color }}>
                          {st === "active" ? (lang === "ar" ? "نشط" : lang === "fr" ? "Actif" : "Active") : st === "trial" ? (lang === "ar" ? "تجربة" : lang === "fr" ? "Essai" : "Trial") : (lang === "ar" ? "إجازة" : lang === "fr" ? "Congé" : "On leave")}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px", fontSize: 12, color: "var(--ink-4)" }}>{e.joined}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Departments tab */}
        {tab === "depts" && (
          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(3,1fr)", gap: 14 }}>
            {DEPARTMENTS.map(d => (
              <div key={d.name_en} style={{ background: "var(--bg-paper)", border: `1.5px solid ${d.color}22`, borderRadius: "var(--r)", padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{dName(d)}</div>
                  {d.open > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "rgba(200,160,60,0.15)", color: "var(--gold)" }}>
                      {d.open} {lang === "ar" ? "شاغر" : lang === "fr" ? "poste(s)" : "open"}
                    </span>
                  )}
                </div>
                <div className="tnum font-display" style={{ fontSize: 30, color: d.color, marginBottom: 4 }}>{d.headcount}</div>
                <div style={{ fontSize: 11, color: "var(--ink-4)" }}>
                  {lang === "ar" ? "موظف" : lang === "fr" ? "employés" : "employees"}
                </div>
                <div style={{ marginTop: 12, height: 4, borderRadius: 999, background: "var(--line-soft)" }}>
                  <div style={{ height: "100%", borderRadius: 999, background: d.color, width: `${Math.min(100, (d.headcount / 32) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
