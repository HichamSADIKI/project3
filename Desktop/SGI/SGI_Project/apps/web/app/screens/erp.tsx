"use client";
import React, { useState } from "react";
import { Topbar, IcArrowUp, IcArrowDown } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const KPIS = [
  { key: "users",    color: "var(--azure)",   value: "148",        delta: "+6 ce mois",        up: true,  label_en: "Active users",      label_ar: "مستخدمون نشطون",  label_fr: "Utilisateurs actifs" },
  { key: "modules",  color: "var(--emerald)", value: "9",          delta: "7 configurés",       up: null,  label_en: "Modules",           label_ar: "الوحدات",          label_fr: "Modules" },
  { key: "tasks",    color: "var(--gold)",    value: "2 340",      delta: "+312 cette semaine", up: true,  label_en: "Open tasks",        label_ar: "مهام مفتوحة",     label_fr: "Tâches ouvertes" },
  { key: "sync",     color: "var(--emerald)", value: "99.8 %",     delta: "uptime 30 j",        up: true,  label_en: "System uptime",     label_ar: "وقت التشغيل",     label_fr: "Disponibilité" },
];

const MODULES = [
  { key: "hr",       color: "var(--azure)",   status: "active",  users: 52,  label_en: "HR & Payroll",        label_ar: "الموارد البشرية",    label_fr: "RH & Paie",           sub_en: "Staff records, payroll, leave management",   sub_ar: "سجلات الموظفين، الرواتب، الإجازات",       sub_fr: "Dossiers RH, paie, gestion des congés" },
  { key: "account",  color: "var(--emerald)", status: "active",  users: 18,  label_en: "Accounting",          label_ar: "المحاسبة",            label_fr: "Comptabilité",         sub_en: "Journal, P&L, balance sheet, bank reco",    sub_ar: "دفتر اليومية، أرباح وخسائر، ميزانية",     sub_fr: "Journal, P&L, bilan, rapprochement bancaire" },
  { key: "inv",      color: "var(--gold)",    status: "active",  users: 24,  label_en: "Inventory",           label_ar: "المخزون",             label_fr: "Inventaire",           sub_en: "Stock levels, warehousing, FIFO/LIFO",       sub_ar: "مستويات المخزون، المستودعات، تدفق المخزون", sub_fr: "Niveaux de stock, entrepôts, FIFO/LIFO" },
  { key: "proc",     color: "var(--azure)",   status: "active",  users: 11,  label_en: "Procurement",         label_ar: "المشتريات",           label_fr: "Achats",               sub_en: "POs, suppliers, approval workflows",         sub_ar: "طلبات الشراء، الموردون، سير العمل",       sub_fr: "Bons de commande, fournisseurs, workflows" },
  { key: "proj",     color: "var(--emerald)", status: "active",  users: 33,  label_en: "Project Management",  label_ar: "إدارة المشاريع",      label_fr: "Gestion de projets",   sub_en: "Gantt, milestones, budget tracking",         sub_ar: "جانت، المعالم، تتبع الميزانية",            sub_fr: "Gantt, jalons, suivi budgétaire" },
  { key: "crm",      color: "var(--rose)",    status: "active",  users: 47,  label_en: "CRM",                 label_ar: "إدارة العملاء",       label_fr: "CRM",                  sub_en: "Leads, pipeline, follow-up sequences",       sub_ar: "العملاء المحتملون، خط الأنابيب، المتابعة", sub_fr: "Leads, pipeline, séquences de relance" },
  { key: "docs",     color: "var(--gold)",    status: "config",  users: 0,   label_en: "Document Management", label_ar: "إدارة الوثائق",       label_fr: "GED",                  sub_en: "Contracts, templates, e-signature",          sub_ar: "العقود، القوالب، التوقيع الإلكتروني",     sub_fr: "Contrats, modèles, signature électronique" },
  { key: "bi",       color: "var(--azure)",   status: "config",  users: 0,   label_en: "Business Intelligence",label_ar: "ذكاء الأعمال",       label_fr: "Business Intelligence",sub_en: "Dashboards, KPIs, drill-down analytics",     sub_ar: "لوحات القيادة، مؤشرات الأداء، التحليل",  sub_fr: "Tableaux de bord, KPIs, analyses avancées" },
  { key: "asset",    color: "var(--emerald)", status: "planned", users: 0,   label_en: "Asset Management",    label_ar: "إدارة الأصول",        label_fr: "Gestion des actifs",   sub_en: "Properties, equipment, depreciation",        sub_ar: "العقارات، المعدات، الاستهلاك",             sub_fr: "Biens, équipements, amortissements" },
];

const STATUS_COLORS: Record<string, { bg: string; color: string; en: string; ar: string; fr: string }> = {
  active:  { bg: "rgba(16,185,129,0.1)", color: "var(--emerald)", en: "Active",      ar: "نشط",     fr: "Actif" },
  config:  { bg: "rgba(200,160,60,0.15)", color: "var(--gold)",   en: "Configuring", ar: "جار الضبط", fr: "Configuration" },
  planned: { bg: "rgba(120,120,120,0.1)", color: "var(--ink-4)", en: "Planned",     ar: "مخطط",    fr: "Planifié" },
};

export function ScreenERP() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const [filter, setFilter] = useState<"all" | "active" | "config" | "planned">("all");

  const title = lang === "ar" ? "نظام ERP" : "ERP";
  const label = (m: typeof MODULES[0]) => lang === "ar" ? m.label_ar : lang === "fr" ? m.label_fr : m.label_en;
  const sub   = (m: typeof MODULES[0]) => lang === "ar" ? m.sub_ar   : lang === "fr" ? m.sub_fr   : m.sub_en;
  const statusLabel = (s: string) => STATUS_COLORS[s][lang as "en" | "ar" | "fr"];

  const filtered = MODULES.filter(m => filter === "all" || m.status === filter);

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

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {(["all","active","config","planned"] as const).map(f => {
            const labels: Record<string, Record<string, string>> = {
              all:     { en: "All modules", ar: "كل الوحدات",   fr: "Tous les modules" },
              active:  { en: "Active",      ar: "نشط",           fr: "Actifs" },
              config:  { en: "Configuring", ar: "جار الضبط",     fr: "En configuration" },
              planned: { en: "Planned",     ar: "مخطط",          fr: "Planifiés" },
            };
            return (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1px solid",
                background: filter === f ? "var(--ink)" : "transparent",
                borderColor: filter === f ? "var(--ink)" : "var(--line-soft)",
                color: filter === f ? "var(--bg-paper)" : "var(--ink-4)",
              }}>
                {labels[f][lang]}
              </button>
            );
          })}
        </div>

        {/* Module grid */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(3,1fr)", gap: 16 }}>
          {filtered.map(m => (
            <div key={m.key} style={{
              background: "var(--bg-paper)", border: `1.5px solid ${m.color}25`,
              borderRadius: "var(--r)", padding: "20px 22px",
              opacity: m.status === "planned" ? 0.65 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: "var(--r)", background: `${m.color}15`, display: "grid", placeItems: "center", color: m.color, fontSize: 15, fontWeight: 700 }}>
                  {m.key.slice(0,2).toUpperCase()}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: STATUS_COLORS[m.status].bg, color: STATUS_COLORS[m.status].color }}>
                  {statusLabel(m.status)}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>{label(m)}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)", lineHeight: 1.55, marginBottom: 12 }}>{sub(m)}</div>
              {m.users > 0 && (
                <div style={{ fontSize: 10.5, color: m.color, fontWeight: 600 }}>
                  {m.users} {lang === "ar" ? "مستخدم" : lang === "fr" ? "utilisateurs" : "users"}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
