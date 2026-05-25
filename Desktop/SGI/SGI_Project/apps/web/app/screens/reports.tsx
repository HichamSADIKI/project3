"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Ic, IcDownload, IcArrowUp, IcArrowDown, IcCheck, IcClock } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";

/* ─── Icons ──────────────────────────────────────────────────────────── */
const IcFile    = () => <Ic><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></Ic>;
const IcRefresh = () => <Ic s={14}><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></Ic>;
const IcShare   = () => <Ic s={14}><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></Ic>;
const IcEye     = () => <Ic s={14}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></Ic>;
const IcPlus    = () => <Ic s={15}><path d="M12 5v14M5 12h14"/></Ic>;
const IcXCircle = () => <Ic s={13}><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></Ic>;

/* ─── Types ──────────────────────────────────────────────────────────── */
type Period   = "may26" | "apr26" | "q2-26" | "q1-26" | "ytd26" | "2025";
type CatKey   = "all" | "sales" | "finance" | "prop" | "crm" | "rental" | "visa";
type Status   = "ready" | "generating" | "scheduled" | "failed";

interface Report {
  id: string;
  title_en: string; title_ar: string; title_fr: string;
  cat: Exclude<CatKey, "all">;
  period: Period;
  generatedAt: string;
  size: string;
  status: Status;
  pages: number;
}

/* ─── Data ───────────────────────────────────────────────────────────── */
const PERIOD_OPTS: { value: Period; label: string }[] = [
  { value: "may26",  label: "May 2026" },
  { value: "apr26",  label: "Apr 2026" },
  { value: "q2-26",  label: "Q2 2026"  },
  { value: "q1-26",  label: "Q1 2026"  },
  { value: "ytd26",  label: "YTD 2026" },
  { value: "2025",   label: "FY 2025"  },
];

const CAT_OPTS: { value: CatKey; en: string; ar: string; fr: string; color: string }[] = [
  { value: "all",     en: "All",          ar: "الكل",          fr: "Tout",            color: "var(--ink-3)" },
  { value: "sales",   en: "Sales",        ar: "المبيعات",      fr: "Ventes",          color: "var(--gold)" },
  { value: "finance", en: "Finance",      ar: "المالية",       fr: "Finance",         color: "var(--azure)" },
  { value: "prop",    en: "Properties",   ar: "العقارات",      fr: "Propriétés",      color: "var(--emerald)" },
  { value: "crm",     en: "CRM",         ar: "العملاء",       fr: "CRM",             color: "#8B5CF6" },
  { value: "rental",  en: "Rentals",      ar: "الإيجارات",     fr: "Locations",       color: "var(--rose)" },
  { value: "visa",    en: "Golden Visa",  ar: "التأشيرة الذهبية", fr: "Visa Doré",   color: "#F59E0B" },
];

const REPORTS: Report[] = [
  { id: "r001", cat: "sales",   period: "may26",  status: "ready",      pages: 14, size: "2.1 MB",
    generatedAt: "2026-05-25 09:14",
    title_en: "Monthly Sales Performance — May 2026",
    title_ar: "أداء المبيعات الشهري — مايو 2026",
    title_fr: "Performance Commerciale Mensuelle — Mai 2026" },
  { id: "r002", cat: "finance", period: "may26",  status: "ready",      pages: 22, size: "3.4 MB",
    generatedAt: "2026-05-25 09:01",
    title_en: "P&L Statement — May 2026",
    title_ar: "بيان الأرباح والخسائر — مايو 2026",
    title_fr: "Compte de Résultat — Mai 2026" },
  { id: "r003", cat: "prop",    period: "may26",  status: "ready",      pages: 18, size: "5.7 MB",
    generatedAt: "2026-05-24 18:32",
    title_en: "Property Portfolio Valuation — May 2026",
    title_ar: "تقييم محفظة العقارات — مايو 2026",
    title_fr: "Évaluation du Portefeuille Immobilier — Mai 2026" },
  { id: "r004", cat: "crm",     period: "may26",  status: "ready",      pages: 9,  size: "1.2 MB",
    generatedAt: "2026-05-24 17:55",
    title_en: "CRM Pipeline Report — May 2026",
    title_ar: "تقرير خط أنابيب CRM — مايو 2026",
    title_fr: "Rapport Pipeline CRM — Mai 2026" },
  { id: "r005", cat: "rental",  period: "may26",  status: "ready",      pages: 11, size: "1.8 MB",
    generatedAt: "2026-05-24 16:40",
    title_en: "Rental Income & Occupancy — May 2026",
    title_ar: "دخل الإيجار والإشغال — مايو 2026",
    title_fr: "Revenus Locatifs & Taux d'Occupation — Mai 2026" },
  { id: "r006", cat: "visa",    period: "may26",  status: "generating", pages: 0,  size: "—",
    generatedAt: "2026-05-25 10:02",
    title_en: "Golden Visa Applications — May 2026",
    title_ar: "طلبات التأشيرة الذهبية — مايو 2026",
    title_fr: "Dossiers Visa Doré — Mai 2026" },
  { id: "r007", cat: "sales",   period: "q2-26",  status: "scheduled",  pages: 0,  size: "—",
    generatedAt: "2026-06-30 23:59",
    title_en: "Quarterly Sales Review — Q2 2026",
    title_ar: "مراجعة المبيعات الفصلية — الربع الثاني 2026",
    title_fr: "Bilan Trimestriel des Ventes — T2 2026" },
  { id: "r008", cat: "finance", period: "q2-26",  status: "scheduled",  pages: 0,  size: "—",
    generatedAt: "2026-06-30 23:59",
    title_en: "Quarterly Financial Report — Q2 2026",
    title_ar: "التقرير المالي الفصلي — الربع الثاني 2026",
    title_fr: "Rapport Financier Trimestriel — T2 2026" },
  { id: "r009", cat: "sales",   period: "apr26",  status: "ready",      pages: 13, size: "1.9 MB",
    generatedAt: "2026-05-01 08:20",
    title_en: "Monthly Sales Performance — Apr 2026",
    title_ar: "أداء المبيعات الشهري — أبريل 2026",
    title_fr: "Performance Commerciale Mensuelle — Avr 2026" },
  { id: "r010", cat: "finance", period: "apr26",  status: "ready",      pages: 20, size: "3.1 MB",
    generatedAt: "2026-05-01 08:05",
    title_en: "P&L Statement — Apr 2026",
    title_ar: "بيان الأرباح والخسائر — أبريل 2026",
    title_fr: "Compte de Résultat — Avr 2026" },
  { id: "r011", cat: "prop",    period: "q1-26",  status: "ready",      pages: 24, size: "7.2 MB",
    generatedAt: "2026-04-02 11:15",
    title_en: "Property Portfolio Valuation — Q1 2026",
    title_ar: "تقييم محفظة العقارات — الربع الأول 2026",
    title_fr: "Évaluation du Portefeuille Immobilier — T1 2026" },
  { id: "r012", cat: "crm",     period: "q1-26",  status: "ready",      pages: 16, size: "2.3 MB",
    generatedAt: "2026-04-01 09:50",
    title_en: "Lead Conversion Analysis — Q1 2026",
    title_ar: "تحليل تحويل العملاء المحتملين — الربع الأول 2026",
    title_fr: "Analyse Conversion Leads — T1 2026" },
  { id: "r013", cat: "rental",  period: "q1-26",  status: "ready",      pages: 15, size: "2.0 MB",
    generatedAt: "2026-04-01 09:30",
    title_en: "Rental Portfolio Review — Q1 2026",
    title_ar: "مراجعة محفظة الإيجار — الربع الأول 2026",
    title_fr: "Bilan Portefeuille Locatif — T1 2026" },
  { id: "r014", cat: "sales",   period: "ytd26",  status: "ready",      pages: 38, size: "6.8 MB",
    generatedAt: "2026-05-24 07:00",
    title_en: "YTD Sales Performance 2026",
    title_ar: "أداء المبيعات منذ بداية العام 2026",
    title_fr: "Performance Ventes Cumul 2026" },
  { id: "r015", cat: "finance", period: "2025",   status: "ready",      pages: 56, size: "9.3 MB",
    generatedAt: "2026-01-15 10:00",
    title_en: "Annual Financial Report — FY 2025",
    title_ar: "التقرير المالي السنوي — السنة المالية 2025",
    title_fr: "Rapport Financier Annuel — EF 2025" },
  { id: "r016", cat: "visa",    period: "q1-26",  status: "failed",     pages: 0,  size: "—",
    generatedAt: "2026-04-01 12:00",
    title_en: "Golden Visa Compliance Report — Q1 2026",
    title_ar: "تقرير الامتثال للتأشيرة الذهبية — الربع الأول 2026",
    title_fr: "Rapport Conformité Visa Doré — T1 2026" },
];

/* ─── Monthly bar chart data ─────────────────────────────────────────── */
const MONTHLY = [
  { m: "Jan", v: 14.2 }, { m: "Feb", v: 18.7 }, { m: "Mar", v: 21.5 },
  { m: "Apr", v: 19.1 }, { m: "May", v: 24.5 }, { m: "Jun", v: 0 },
];
const MAX_V = Math.max(...MONTHLY.map(m => m.v));

/* ─── KPIs ───────────────────────────────────────────────────────────── */
const KPIS = [
  { label_en: "Total Reports",    label_ar: "إجمالي التقارير",   label_fr: "Rapports totaux",   value: "16",       delta: "+4 vs last month", up: true,  color: "var(--azure)" },
  { label_en: "Ready",            label_ar: "جاهزة",              label_fr: "Prêts",             value: "12",       delta: "75% of total",     up: true,  color: "var(--emerald)" },
  { label_en: "Scheduled",        label_ar: "مجدولة",             label_fr: "Planifiés",         value: "2",        delta: "End of Q2",        up: null,  color: "var(--gold)" },
  { label_en: "YTD Volume",       label_ar: "حجم المبيعات",      label_fr: "Volume YTD",        value: "AED 98.4M", delta: "+18% vs 2025",    up: true,  color: "var(--gold)" },
];

/* ─── Helpers ────────────────────────────────────────────────────────── */
const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

function StatusBadge({ status, lang }: { status: Status; lang: string }) {
  const cfg = {
    ready:      { en: "Ready",      ar: "جاهز",      fr: "Prêt",       color: "var(--emerald)", icon: <IcCheck /> },
    generating: { en: "Generating", ar: "يُنشأ",     fr: "En cours",   color: "var(--azure)",   icon: <IcRefresh /> },
    scheduled:  { en: "Scheduled",  ar: "مجدول",     fr: "Planifié",   color: "var(--gold)",    icon: <IcClock /> },
    failed:     { en: "Failed",     ar: "فشل",       fr: "Échoué",     color: "var(--rose)",    icon: <IcXCircle /> },
  }[status];
  const label = lang === "ar" ? cfg.ar : lang === "fr" ? cfg.fr : cfg.en;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: `${cfg.color}18`, color: cfg.color }}>
      <span style={{ width: 11, height: 11, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{cfg.icon}</span>
      {label}
    </span>
  );
}

/* ─── Component ──────────────────────────────────────────────────────── */
export function ScreenReports() {
  const { lang } = useLang();
  const t        = useT();
  const bp       = useBreakpoint();
  const isMob    = bp === "mobile";

  const [period,   setPeriod]   = useState<Period | "all">("all");
  const [cat,      setCat]      = useState<CatKey>("all");
  const [showGen,  setShowGen]  = useState(false);

  const catLabel = (k: CatKey) => {
    const found = CAT_OPTS.find(c => c.value === k)!;
    return lang === "ar" ? found.ar : lang === "fr" ? found.fr : found.en;
  };

  const title = (r: Report) => lang === "ar" ? r.title_ar : lang === "fr" ? r.title_fr : r.title_en;

  const filtered = REPORTS.filter(r =>
    (period === "all" || r.period === period) &&
    (cat    === "all" || r.cat    === cat)
  );

  const ready = REPORTS.filter(r => r.status === "ready").length;

  const topbarTitle = lang === "ar" ? t.t_report : lang === "fr" ? "Rapports" : "Reports";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={topbarTitle}>
        <button
          onClick={() => setShowGen(true)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "8px 14px", borderRadius: "var(--r)",
            background: "var(--gold)", color: "#1A1610",
            border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
            flexShrink: 0,
          }}
        >
          <IcPlus />
          {lang === "ar" ? "تقرير جديد" : lang === "fr" ? "Nouveau rapport" : "New Report"}
        </button>
      </Topbar>

      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-cream)" }}>

        {/* ── KPI row ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, padding: isMob ? "16px 12px 0" : "24px 28px 0" }}>
          {KPIS.map(k => (
            <div key={k.label_en} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "16px 18px" }}>
              <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginBottom: 6, letterSpacing: "0.06em" }}>
                {lang === "ar" ? k.label_ar : lang === "fr" ? k.label_fr : k.label_en}
              </div>
              <div className="tnum font-display" style={{ fontSize: 24, color: "var(--ink)", lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
              <div style={{ fontSize: 10.5, display: "flex", alignItems: "center", gap: 4, color: k.up === null ? "var(--ink-4)" : k.up ? "var(--emerald)" : "var(--rose)" }}>
                {k.up === true && <IcArrowUp />}
                {k.up === false && <IcArrowDown />}
                {k.delta}
              </div>
            </div>
          ))}
        </div>

        {/* ── Main content grid ── */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 280px", gap: 20, padding: isMob ? "16px 12px" : "20px 28px", alignItems: "start" }}>

          {/* Left — filters + table */}
          <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>

            {/* Filter bar */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {/* Period select */}
              <select
                value={period}
                onChange={e => setPeriod(e.target.value as Period | "all")}
                style={{ padding: "7px 12px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-2)", fontSize: 12.5, cursor: "pointer" }}
              >
                <option value="all">{lang === "ar" ? "كل الفترات" : lang === "fr" ? "Toutes périodes" : "All periods"}</option>
                {PERIOD_OPTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>

              {/* Category pills */}
              <div style={{ display: "flex", gap: 6, overflowX: "auto", flexWrap: isMob ? "nowrap" : "wrap" }}>
                {CAT_OPTS.map(c => (
                  <button key={c.value} onClick={() => setCat(c.value)}
                    style={{
                      padding: "6px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: cat === c.value ? 600 : 400,
                      cursor: "pointer", whiteSpace: "nowrap",
                      background: cat === c.value ? (c.value === "all" ? "var(--gold)" : `${c.color}18`) : "var(--bg-paper)",
                      color: cat === c.value ? (c.value === "all" ? "#1A1610" : c.color) : "var(--ink-4)",
                      border: cat === c.value ? (c.value === "all" ? "1px solid var(--gold)" : `1px solid ${c.color}`) : "1px solid var(--line-soft)",
                    }}
                  >
                    {lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en}
                    {c.value !== "all" && (
                      <span style={{ marginInlineStart: 5, opacity: 0.6, fontSize: 10 }}>
                        {REPORTS.filter(r => r.cat === c.value).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <div style={{ marginInlineStart: "auto", fontSize: 11.5, color: "var(--ink-4)" }}>
                {filtered.length} {lang === "ar" ? "تقرير" : lang === "fr" ? "rapport(s)" : "report(s)"}
              </div>
            </div>

            {/* Reports table */}
            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
              {filtered.length === 0 ? (
                <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                  {lang === "ar" ? "لا توجد تقارير" : lang === "fr" ? "Aucun rapport" : "No reports found"}
                </div>
              ) : (
                filtered.map((r, i) => {
                  const catMeta = CAT_OPTS.find(c => c.value === r.cat)!;
                  return (
                    <div key={r.id} style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 18px",
                      borderBottom: i < filtered.length - 1 ? "1px solid var(--line-soft)" : "none",
                      transition: "background 0.12s",
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "var(--bg-cream)"}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = "transparent"}
                    >
                      {/* Icon */}
                      <div style={{ width: 34, height: 34, borderRadius: "var(--r-sm)", background: `${catMeta.color}15`, display: "grid", placeItems: "center", color: catMeta.color, flexShrink: 0 }}>
                        <IcFile />
                      </div>

                      {/* Title + meta */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", lineHeight: 1.3, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {title(r)}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10.5, padding: "1px 8px", borderRadius: 999, background: `${catMeta.color}12`, color: catMeta.color, fontWeight: 600 }}>
                            {catLabel(r.cat)}
                          </span>
                          {r.status === "ready" && (
                            <>
                              <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{r.pages}p · {r.size}</span>
                              <span style={{ fontSize: 10.5, color: "var(--ink-5)" }}>{r.generatedAt}</span>
                            </>
                          )}
                          {r.status === "scheduled" && (
                            <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
                              {lang === "ar" ? "مجدول لـ" : lang === "fr" ? "Planifié le" : "Scheduled"} {r.generatedAt}
                            </span>
                          )}
                          {r.status === "generating" && (
                            <span style={{ fontSize: 10.5, color: "var(--azure)" }}>
                              {lang === "ar" ? "جارٍ الإنشاء..." : lang === "fr" ? "Génération en cours..." : "Generating…"}
                            </span>
                          )}
                          {r.status === "failed" && (
                            <span style={{ fontSize: 10.5, color: "var(--rose)" }}>
                              {lang === "ar" ? "فشل الإنشاء" : lang === "fr" ? "Génération échouée" : "Generation failed"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status */}
                      {!isMob && <StatusBadge status={r.status} lang={lang} />}

                      {/* Actions */}
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        {r.status === "ready" && (
                          <>
                            <ActionBtn title="Preview"><IcEye /></ActionBtn>
                            <ActionBtn title="Download PDF"><IcDownload /></ActionBtn>
                            <ActionBtn title="Share"><IcShare /></ActionBtn>
                          </>
                        )}
                        {r.status === "failed" && (
                          <ActionBtn title="Retry" color="var(--rose)"><IcRefresh /></ActionBtn>
                        )}
                        {r.status === "generating" && (
                          <div style={{ width: 28, height: 28, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", color: "var(--azure)" }}>
                            <IcRefresh />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right — chart + summary */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* Monthly volume chart */}
            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                  {lang === "ar" ? "حجم المبيعات الشهري" : lang === "fr" ? "Volume mensuel (AED M)" : "Monthly Volume (AED M)"}
                </div>
                <div className="tnum" style={{ fontSize: 10.5, color: "var(--gold)", fontWeight: 700 }}>2026</div>
              </div>
              {/* Bar chart */}
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 90 }}>
                {MONTHLY.map(m => {
                  const pct = m.v > 0 ? (m.v / MAX_V) * 100 : 0;
                  const isMay = m.m === "May";
                  return (
                    <div key={m.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, height: "100%", justifyContent: "flex-end" }}>
                      <div className="tnum" style={{ fontSize: 9, color: isMay ? "var(--gold)" : "var(--ink-4)", fontWeight: isMay ? 700 : 400 }}>
                        {m.v > 0 ? m.v.toFixed(1) : ""}
                      </div>
                      <div style={{
                        width: "100%", height: `${pct}%`,
                        background: isMay ? "var(--gold)" : m.v === 0 ? "var(--line-soft)" : "var(--gold-ghost)",
                        borderRadius: "3px 3px 0 0",
                        minHeight: m.v === 0 ? 3 : undefined,
                        transition: "height 0.3s ease",
                        opacity: m.v === 0 ? 0.4 : 1,
                      }} />
                      <div style={{ fontSize: 9.5, color: isMay ? "var(--gold)" : "var(--ink-4)", fontWeight: isMay ? 700 : 400 }}>{m.m}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick stats */}
            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "16px 18px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                {lang === "ar" ? "ملخص التقارير" : lang === "fr" ? "Résumé des rapports" : "Report Summary"}
              </div>
              {CAT_OPTS.filter(c => c.value !== "all").map(c => {
                const count = REPORTS.filter(r => r.cat === c.value).length;
                const readyCount = REPORTS.filter(r => r.cat === c.value && r.status === "ready").length;
                return (
                  <div key={c.value} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 3, background: c.color, flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 12, color: "var(--ink-2)" }}>
                      {lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }} className="tnum">
                      {readyCount}/{count}
                    </div>
                    <div style={{ width: 60, height: 4, borderRadius: 2, background: "var(--line-soft)", overflow: "hidden" }}>
                      <div style={{ width: `${count > 0 ? (readyCount / count) * 100 : 0}%`, height: "100%", background: c.color, borderRadius: 2, transition: "width 0.4s ease" }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Recent activity */}
            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "16px 18px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)", marginBottom: 12 }}>
                {lang === "ar" ? "آخر النشاطات" : lang === "fr" ? "Activité récente" : "Recent Activity"}
              </div>
              {[
                { time: "09:14", en: "Sales report generated", ar: "تم إنشاء تقرير المبيعات", fr: "Rapport ventes généré", color: "var(--gold)" },
                { time: "09:01", en: "P&L statement ready",   ar: "بيان الأرباح والخسائر جاهز", fr: "Compte résultat prêt",  color: "var(--emerald)" },
                { time: "10:02", en: "Visa report generating", ar: "إنشاء تقرير التأشيرة جارٍ", fr: "Rapport visa en cours", color: "var(--azure)" },
              ].map(a => (
                <div key={a.time} style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 6, height: 6, borderRadius: 3, background: a.color, marginTop: 5, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "var(--ink-2)" }}>{lang === "ar" ? a.ar : lang === "fr" ? a.fr : a.en}</div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-5)", marginTop: 1 }}>Today {a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Generate Report Modal ── */}
      {showGen && (
        <>
          <div onClick={() => setShowGen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 900, backdropFilter: "blur(2px)" }} />
          <div style={{
            position: "fixed", top: "50%", insetInlineStart: "50%",
            transform: "translate(-50%, -50%)",
            width: isMob ? "92vw" : 420, zIndex: 1000,
            background: "var(--bg-paper)", border: "1px solid var(--line-soft)",
            borderRadius: "var(--r)", boxShadow: "var(--shadow-2)",
            padding: "24px",
          }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 4 }}>
              {lang === "ar" ? "إنشاء تقرير جديد" : lang === "fr" ? "Générer un rapport" : "Generate New Report"}
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 20 }}>
              {lang === "ar" ? "اختر النوع والفترة" : lang === "fr" ? "Choisissez le type et la période" : "Select type and period"}
            </div>

            {/* Report type grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 16 }}>
              {CAT_OPTS.filter(c => c.value !== "all").map(c => (
                <button key={c.value} onClick={() => { setCat(c.value); setShowGen(false); }}
                  style={{
                    padding: "10px 8px", borderRadius: "var(--r)", border: `1px solid ${c.color}30`,
                    background: `${c.color}08`, color: c.color, cursor: "pointer", fontSize: 11.5, fontWeight: 600,
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                  }}
                >
                  <span style={{ fontSize: 16 }}>
                    {c.value === "sales" ? "📊" : c.value === "finance" ? "💰" : c.value === "prop" ? "🏙️" : c.value === "crm" ? "👥" : c.value === "rental" ? "🔑" : "⭐"}
                  </span>
                  {lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en}
                </button>
              ))}
            </div>

            <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 16, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={() => setShowGen(false)} style={{ padding: "8px 16px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "transparent", color: "var(--ink-3)", cursor: "pointer", fontSize: 12.5 }}>
                {t.cancel}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ActionBtn({ children, title, color }: { children: React.ReactNode; title: string; color?: string }) {
  return (
    <button
      title={title}
      style={{
        width: 28, height: 28, borderRadius: "var(--r-sm)",
        display: "grid", placeItems: "center",
        background: "transparent", border: "1px solid var(--line-soft)",
        color: color ?? "var(--ink-4)", cursor: "pointer",
        transition: "all 0.12s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "var(--bg-cream)";
        (e.currentTarget as HTMLButtonElement).style.color = color ?? "var(--ink-2)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = color ?? "var(--ink-4)";
      }}
    >
      {children}
    </button>
  );
}
