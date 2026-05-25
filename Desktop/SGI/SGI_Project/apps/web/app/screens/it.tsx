"use client";
import React, { useState } from "react";
import { Topbar, IcArrowUp, IcArrowDown } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const KPIS = [
  { key: "uptime",  color: "var(--emerald)", value: "99.8 %", delta: "30-day avg",         up: true,  label_en: "System uptime",   label_ar: "وقت التشغيل",      label_fr: "Disponibilité" },
  { key: "tickets", color: "var(--gold)",    value: "14",     delta: "3 critical open",     up: false, label_en: "Open tickets",    label_ar: "تذاكر مفتوحة",     label_fr: "Tickets ouverts" },
  { key: "devices", color: "var(--azure)",   value: "203",    delta: "18 pending update",   up: null,  label_en: "Managed devices", label_ar: "أجهزة مُدارة",      label_fr: "Appareils gérés" },
  { key: "security",color: "var(--emerald)", value: "A+",     delta: "security score",      up: true,  label_en: "Security score",  label_ar: "درجة الأمان",       label_fr: "Score sécurité" },
];

const SERVICES = [
  { name_en: "ERP System",          name_ar: "نظام ERP",              name_fr: "Système ERP",          status: "operational", uptime: 99.9, icon: "ERP" },
  { name_en: "CRM Platform",        name_ar: "منصة CRM",              name_fr: "Plateforme CRM",       status: "operational", uptime: 99.7, icon: "CRM" },
  { name_en: "Email & Calendar",    name_ar: "البريد والتقويم",        name_fr: "Messagerie & Agenda",  status: "operational", uptime: 100,  icon: "MLT" },
  { name_en: "Document Storage",    name_ar: "تخزين الوثائق",          name_fr: "Stockage docs",        status: "degraded",    uptime: 97.2, icon: "DOC" },
  { name_en: "VPN & Network",       name_ar: "الشبكة والـ VPN",        name_fr: "VPN & Réseau",         status: "operational", uptime: 99.5, icon: "NET" },
  { name_en: "Backup System",       name_ar: "نظام النسخ الاحتياطي",   name_fr: "Sauvegardes",          status: "operational", uptime: 100,  icon: "BCK" },
  { name_en: "Video Conferencing",  name_ar: "الاجتماعات المرئية",     name_fr: "Visioconférence",      status: "operational", uptime: 98.8, icon: "VID" },
  { name_en: "Security / SIEM",     name_ar: "الأمان والرصد",          name_fr: "Sécurité / SIEM",      status: "maintenance", uptime: 95.0, icon: "SEC" },
];

const TICKETS = [
  { id: "T-412", title: "Laptop not connecting to VPN",    user: "L. Karim",   priority: "high",   status: "open",       created: "Today 09:14" },
  { id: "T-411", title: "Outlook sync issue on mobile",    user: "N. Amira",   priority: "medium", status: "in_progress",created: "Today 08:30" },
  { id: "T-410", title: "Printer offline — floor 3",       user: "R. Fatiha",  priority: "low",    status: "open",       created: "Yesterday" },
  { id: "T-409", title: "ERP login error after update",    user: "M. Youssef", priority: "high",   status: "resolved",   created: "Yesterday" },
  { id: "T-408", title: "New MacBook setup request",       user: "O. Rashid",  priority: "low",    status: "in_progress",created: "May 24" },
  { id: "T-407", title: "Access rights — Finance module",  user: "S. Al Zaabi",priority: "medium", status: "resolved",   created: "May 23" },
];

const SVC_STATUS: Record<string, { color: string; en: string; ar: string; fr: string }> = {
  operational: { color: "var(--emerald)", en: "Operational", ar: "يعمل",       fr: "Opérationnel" },
  degraded:    { color: "var(--gold)",    en: "Degraded",    ar: "منخفض الأداء", fr: "Dégradé" },
  maintenance: { color: "var(--azure)",   en: "Maintenance", ar: "صيانة",       fr: "Maintenance" },
};

const TICKET_STATUS: Record<string, { bg: string; color: string }> = {
  open:        { bg: "rgba(239,68,68,0.1)",   color: "var(--rose)" },
  in_progress: { bg: "rgba(200,160,60,0.15)", color: "var(--gold)" },
  resolved:    { bg: "rgba(16,185,129,0.1)",  color: "var(--emerald)" },
};

const PRIORITY_COLOR: Record<string, string> = { high: "var(--rose)", medium: "var(--gold)", low: "var(--ink-4)" };

export function ScreenIT() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const [tab, setTab] = useState<"services" | "tickets">("services");

  const title = lang === "ar" ? "تقنية المعلومات" : "IT";
  const sLabel = (s: typeof SERVICES[0]) => lang === "ar" ? s.name_ar : lang === "fr" ? s.name_fr : s.name_en;
  const stLabel = (s: string) => SVC_STATUS[s][lang as "en"|"ar"|"fr"];

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

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--line-soft)" }}>
          {(["services","tickets"] as const).map(t => {
            const labels = { services: { en:"Services", ar:"الخدمات", fr:"Services" }, tickets: { en:"Tickets", ar:"التذاكر", fr:"Tickets" } };
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

        {/* Services */}
        {tab === "services" && (
          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(2,1fr)", gap: 12 }}>
            {SERVICES.map(s => (
              <div key={s.name_en} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "16px 20px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: "var(--r)", background: `${SVC_STATUS[s.status].color}15`, display: "grid", placeItems: "center", color: SVC_STATUS[s.status].color, fontSize: 10, fontWeight: 700, flexShrink: 0 }}>
                  {s.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 3 }}>{sLabel(s)}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: SVC_STATUS[s.status].color, flexShrink: 0 }} />
                    <span style={{ fontSize: 11.5, color: SVC_STATUS[s.status].color, fontWeight: 600 }}>{stLabel(s.status)}</span>
                  </div>
                </div>
                <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: s.uptime >= 99 ? "var(--emerald)" : s.uptime >= 97 ? "var(--gold)" : "var(--rose)" }}>
                  {s.uptime}%
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tickets */}
        {tab === "tickets" && (
          <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-cream)" }}>
                  {["ID", lang === "ar" ? "العنوان" : lang === "fr" ? "Titre" : "Title", lang === "ar" ? "المستخدم" : lang === "fr" ? "Utilisateur" : "User", lang === "ar" ? "الأولوية" : lang === "fr" ? "Priorité" : "Priority", lang === "ar" ? "الحالة" : lang === "fr" ? "Statut" : "Status", lang === "ar" ? "التاريخ" : lang === "fr" ? "Date" : "Date"].map(h => (
                    <th key={h} style={{ padding: "9px 16px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TICKETS.map((t, i) => (
                  <tr key={t.id} style={{ borderBottom: i < TICKETS.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                    <td style={{ padding: "11px 16px", fontSize: 11, color: "var(--ink-4)", fontFamily: "monospace" }}>{t.id}</td>
                    <td style={{ padding: "11px 16px", fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{t.title}</td>
                    <td style={{ padding: "11px 16px", fontSize: 12, color: "var(--ink-2)" }}>{t.user}</td>
                    <td style={{ padding: "11px 16px" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: PRIORITY_COLOR[t.priority] }}>{t.priority}</span>
                    </td>
                    <td style={{ padding: "11px 16px" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: TICKET_STATUS[t.status].bg, color: TICKET_STATUS[t.status].color }}>
                        {t.status === "open" ? (lang === "fr" ? "Ouvert" : lang === "ar" ? "مفتوح" : "Open") : t.status === "in_progress" ? (lang === "fr" ? "En cours" : lang === "ar" ? "جارٍ" : "In progress") : (lang === "fr" ? "Résolu" : lang === "ar" ? "محلول" : "Resolved")}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px", fontSize: 11, color: "var(--ink-4)" }}>{t.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
