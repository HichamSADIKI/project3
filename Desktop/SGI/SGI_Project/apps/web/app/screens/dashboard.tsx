"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import {
  Topbar, Eyebrow, Chip, StatusDot,
  IcDownload, IcPlus, IcArrowUp, IcTrend,
} from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";

/* ─── Types ──────────────────────────────────────────────────────────── */
type Period         = "week" | "month" | "quarter";
type ActivityType   = "visit" | "contract" | "lead" | "payment" | "visa";
type ActivityFilter = "all" | "sales" | "rentals" | "crm";

/* ─── KPI sparkline tile ─────────────────────────────────────────────── */
function KpiTile({ eyebrow, label, value, delta, deltaPct, tone = "gold", spark }: {
  eyebrow: string; label: string; value: string;
  delta: string; deltaPct: string; tone?: string; spark: number[];
}) {
  const max = Math.max(...spark);
  const w = 100, h = 28;
  const pts = spark.map((v, i) => `${(i / (spark.length - 1)) * w},${h - (v / max) * h}`).join(" ");
  return (
    <div className="sgi-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <Chip tone={tone as "gold" | "emerald" | "azure"}>
          <span style={{ marginInlineEnd: 4, display: "inline-flex" }}><IcArrowUp /></span>
          <span className="tnum">{deltaPct}</span>
        </Chip>
      </div>
      <div className="font-display tnum" style={{ fontSize: 34, lineHeight: 1, color: "var(--ink)" }}>{value}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 10 }}>
        <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: "0.04em" }}>{label} · {delta}</div>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: "visible" }}>
          <polyline points={pts} fill="none" stroke={`var(--${tone})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={w} cy={h - (spark[spark.length - 1] / max) * h} r="2.5" fill={`var(--${tone})`} />
        </svg>
      </div>
    </div>
  );
}

/* ─── Pipeline data by period ────────────────────────────────────────── */
const PIPELINE: Record<Period, { ar: string; en: string; fr: string; n: number; v: string; h: number; won?: boolean }[]> = {
  week: [
    { ar: "جديد",       en: "New",         fr: "Nouveau",     n: 11, v: "—",       h: 1.00 },
    { ar: "تواصل",      en: "Contacted",   fr: "Contacté",    n:  8, v: "—",       h: 0.80 },
    { ar: "مؤهَّل",      en: "Qualified",   fr: "Qualifié",    n:  5, v: "AED 20M", h: 0.55 },
    { ar: "عرض",        en: "Proposal",    fr: "Proposition", n:  3, v: "AED 13M", h: 0.38 },
    { ar: "تفاوض",      en: "Negotiation", fr: "Négociation", n:  2, v: "AED 9M",  h: 0.24 },
    { ar: "مغلق · ربح", en: "Won",         fr: "Conclu",      n:  1, v: "AED 5M",  h: 0.12, won: true },
  ],
  month: [
    { ar: "جديد",       en: "New",         fr: "Nouveau",     n: 45, v: "—",        h: 1.00 },
    { ar: "تواصل",      en: "Contacted",   fr: "Contacté",    n: 32, v: "—",        h: 0.85 },
    { ar: "مؤهَّل",      en: "Qualified",   fr: "Qualifié",    n: 21, v: "AED 84M",  h: 0.65 },
    { ar: "عرض",        en: "Proposal",    fr: "Proposition", n: 14, v: "AED 56M",  h: 0.45 },
    { ar: "تفاوض",      en: "Negotiation", fr: "Négociation", n:  8, v: "AED 34M",  h: 0.30 },
    { ar: "مغلق · ربح", en: "Won",         fr: "Conclu",      n:  5, v: "AED 22M",  h: 0.18, won: true },
  ],
  quarter: [
    { ar: "جديد",       en: "New",         fr: "Nouveau",     n: 156, v: "—",         h: 1.00 },
    { ar: "تواصل",      en: "Contacted",   fr: "Contacté",    n: 112, v: "—",         h: 0.88 },
    { ar: "مؤهَّل",      en: "Qualified",   fr: "Qualifié",    n:  74, v: "AED 296M",  h: 0.67 },
    { ar: "عرض",        en: "Proposal",    fr: "Proposition", n:  48, v: "AED 192M",  h: 0.46 },
    { ar: "تفاوض",      en: "Negotiation", fr: "Négociation", n:  28, v: "AED 118M",  h: 0.28 },
    { ar: "مغلق · ربح", en: "Won",         fr: "Conclu",      n:  17, v: "AED 74M",   h: 0.16, won: true },
  ],
};

/* ─── Activity feed ──────────────────────────────────────────────────── */
const ACT_COLOR: Record<ActivityType, string> = {
  visit:    "var(--azure)",
  contract: "var(--emerald)",
  lead:     "var(--gold)",
  payment:  "var(--emerald)",
  visa:     "#8B5CF6",
};

const ACTIVITIES: {
  id: number; time: string; type: ActivityType;
  cat: "sales" | "rentals" | "crm";
  title: string; detail: string; agent: string; amount?: string;
}[] = [
  { id: 1, time: "14:22", type: "contract", cat: "sales",   title: "Contract signed · Bluewaters Villa B12",    detail: "AED 6.2M · 4BR Palm Jumeirah",           agent: "Reem K.",    amount: "AED 6.2M"   },
  { id: 2, time: "13:45", type: "lead",     cat: "crm",     title: "Lead qualified · Al-Rashidi family",        detail: "Budget AED 4M · Downtown",               agent: "Karim A."                         },
  { id: 3, time: "12:30", type: "visit",    cat: "sales",   title: "Viewing confirmed · Marina Gate #4502",     detail: "3BR · Tomorrow 09:30",                   agent: "Sara M."                          },
  { id: 4, time: "11:18", type: "payment",  cat: "rentals", title: "Rent received · DIFC Office 2204",          detail: "AED 185,000/yr · Cheque #4",             agent: "Ali H.",     amount: "AED 46,250" },
  { id: 5, time: "10:52", type: "visa",     cat: "sales",   title: "Golden Visa submitted · Mr. Petrov",        detail: "ICA-DXB · AED 3.8M property",            agent: "Legal"                            },
  { id: 6, time: "09:34", type: "lead",     cat: "crm",     title: "New lead · Saudi family via portal",        detail: "Budget AED 8M · Villa, Golf area",       agent: "Hicham S."                        },
  { id: 7, time: "08:15", type: "contract", cat: "rentals", title: "Lease renewed · Business Bay #1402",        detail: "AED 120,000/yr · +5% vs prior",          agent: "Nour A.",    amount: "AED 120K"   },
];

/* ─── Top Agents ─────────────────────────────────────────────────────── */
const TOP_AGENTS = [
  { rank: 1, initials: "KA", name: "Karim Al-Amri",  deals: 8, vol: 48.2, pct: 100 },
  { rank: 2, initials: "RS", name: "Reem Suleiman",  deals: 6, vol: 36.5, pct: 76  },
  { rank: 3, initials: "SM", name: "Sara Mansouri",  deals: 5, vol: 28.1, pct: 58  },
  { rank: 4, initials: "AH", name: "Ali Hassan",     deals: 4, vol: 21.4, pct: 44  },
  { rank: 5, initials: "HS", name: "Hicham Sadiki",  deals: 3, vol: 15.8, pct: 33  },
];
const RANK_C = ["var(--gold)", "var(--ink-3)", "#CD7F32"];

/* ─── Helpers ────────────────────────────────────────────────────────── */
type L3 = { en: string; fr: string; ar: string };
const PERIOD_LABEL: Record<Period, L3> = {
  week:    { en: "This week", fr: "Cette semaine", ar: "هذا الأسبوع" },
  month:   { en: "Month",     fr: "Ce mois",       ar: "هذا الشهر"  },
  quarter: { en: "Quarter",   fr: "Trimestre",     ar: "الربع"      },
};
const ACT_LABEL: Record<ActivityFilter, L3> = {
  all:     { en: "All",     fr: "Tout",      ar: "الكل"      },
  sales:   { en: "Sales",   fr: "Ventes",    ar: "مبيعات"   },
  rentals: { en: "Rentals", fr: "Locations", ar: "إيجارات"  },
  crm:     { en: "CRM",     fr: "CRM",       ar: "CRM"      },
};

/* ─── Screen ─────────────────────────────────────────────────────────── */
export function ScreenDashboard() {
  const t = useT();
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob     = bp === "mobile";
  const isCompact = bp !== "desktop";

  const [period,    setPeriod]    = useState<Period>("month");
  const [actFilter, setActFilter] = useState<ActivityFilter>("all");

  const now = new Date();
  const locale    = lang === "ar" ? "ar-AE" : lang === "fr" ? "fr-FR" : "en-AE";
  const dateLabel = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const todayShort = now.toLocaleDateString("en-AE", { day: "numeric", month: "short" });

  const pipeline    = PIPELINE[period];
  const filteredAct = actFilter === "all" ? ACTIVITIES : ACTIVITIES.filter(a => a.cat === actFilter);

  function pl(obj: L3) { return lang === "ar" ? obj.ar : lang === "fr" ? obj.fr : obj.en; }

  /* ── Tab button style helper ─────────────────────────────────────── */
  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: "4px 11px", borderRadius: "var(--r-sm)", border: "none", cursor: "pointer",
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      background: active ? "var(--bg-ivory)" : "transparent",
      color:      active ? "var(--ink)"      : "var(--ink-4)",
      boxShadow:  active ? "var(--shadow-1)" : "none",
    };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_dash}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcDownload />&nbsp;{t.export_btn}</button>}
        <button className="sgi-btn sgi-btn-primary"><IcPlus />&nbsp;{t.new_btn}</button>
      </Topbar>

      <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable", padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 20, background: "var(--bg-cream)" }}>

        {/* ── Greeting ───────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <Eyebrow style={{ textTransform: "capitalize" }}>{dateLabel} · DXB</Eyebrow>
            <div className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: isMob ? 26 : 36, marginTop: 8, color: "var(--ink)" }}>
              {lang === "ar" ? "مرحباً، هشام." : lang === "fr" ? "Bonjour, Hicham." : "Good morning, Hicham."}
            </div>
          </div>
          {!isMob && (
            <div style={{ display: "flex", gap: 8 }}>
              <Chip tone="gold"><span style={{ marginInlineEnd: 4, display: "inline-flex" }}><IcTrend /></span>Q2 pacing +18%</Chip>
              <Chip tone="emerald"><StatusDot tone="emerald" />&nbsp;All systems green</Chip>
            </div>
          )}
        </div>

        {/* ── KPI row ────────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 16 }}>
          <KpiTile eyebrow="Inventory"  label={t.nav_prop}    value="1,284"      delta="+12"   deltaPct="+12.4%" tone="gold"    spark={[3,5,4,7,6,8,9,11,10,12]} />
          <KpiTile eyebrow="Pipeline"   label={t.nav_crm}     value="342"        delta="+28"   deltaPct="+8.9%"  tone="emerald" spark={[2,3,2,4,5,4,6,7,6,8]}    />
          <KpiTile eyebrow="May volume" label={t.hero_s3_l}   value="AED 24.5M"  delta="+4.5M" deltaPct="+23.1%" tone="gold"   spark={[4,5,3,6,8,7,9,8,11,12]}  />
          <KpiTile eyebrow="Golden Visa" label={t.nav_visa}   value="18"         delta="+3"    deltaPct="+5.0%"  tone="azure"   spark={[1,2,2,3,2,4,3,4,5,5]}    />
        </div>

        {/* ── Middle row ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.5fr 1fr", gap: 16, minHeight: isCompact ? undefined : 280, alignItems: "stretch" }}>

          {/* Pipeline funnel */}
          <div className="sgi-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden", minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <div>
                <Eyebrow>CRM · Sales pipeline</Eyebrow>
                <div className="font-display" style={{ fontSize: 22, marginTop: 4 }}>Where the money is moving</div>
              </div>
              {/* Period selector — functional */}
              <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-inset)", borderRadius: "var(--r)" }}>
                {(["week","month","quarter"] as Period[]).map(p => (
                  <button key={p} onClick={() => setPeriod(p)} style={tabStyle(period === p)}>
                    {pl(PERIOD_LABEL[p])}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(3, 1fr)" : "repeat(6, 1fr)", gap: 10 }}>
              {pipeline.map(s => (
                <div key={s.en} style={{
                  background: s.won ? "var(--ink)" : "var(--bg-ivory)",
                  border: "1px solid " + (s.won ? "var(--ink)" : "var(--line-soft)"),
                  borderRadius: "var(--r)", padding: isMob ? 10 : 14,
                  display: "flex", flexDirection: "column", gap: 6,
                  position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", insetBlockStart: 0, insetInlineStart: 0, height: 3, width: `${s.h * 100}%`, background: "var(--gold)" }} />
                  <div className={lang === "ar" ? "font-ar" : undefined} style={{
                    fontSize: lang === "ar" ? 13 : 10,
                    letterSpacing: lang === "ar" ? 0 : "0.14em",
                    textTransform: lang === "ar" ? undefined : "uppercase",
                    color: s.won ? "var(--gold-soft)" : "var(--ink-4)",
                  }}>
                    {lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en}
                  </div>
                  <div className="font-display tnum" style={{ fontSize: isMob ? 24 : 32, color: s.won ? "var(--gold)" : "var(--ink)" }}>{s.n}</div>
                  <div className="tnum" style={{ fontSize: 11, color: s.won ? "var(--gold-soft)" : "var(--ink-3)" }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Emirates bar */}
            {!isMob && (
              <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 14, marginTop: 4 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Closed volume by emirate · May</div>
                  <div style={{ display: "flex", gap: 14, fontSize: 10.5, color: "var(--ink-3)" }}>
                    {[["Dubai","var(--gold)"],["Abu Dhabi","var(--ink)"],["Sharjah","var(--azure)"],["Other","var(--ink-4)"]].map(([l,c]) => (
                      <span key={l} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 10, height: 10, background: c, borderRadius: 2 }} />{l}
                      </span>
                    ))}
                  </div>
                </div>
                <div style={{ display: "flex", height: 22, borderRadius: 4, overflow: "hidden", border: "1px solid var(--line-soft)" }}>
                  <div style={{ width: "52%", background: "var(--gold)",  color: "#1A1610",        display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 600 }}>Dubai · 52%</div>
                  <div style={{ width: "26%", background: "var(--ink)",   color: "var(--gold)",    display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 600 }}>AUH · 26%</div>
                  <div style={{ width: "14%", background: "var(--azure)", color: "#fff",           display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 600 }}>SHJ · 14%</div>
                  <div style={{ width: "8%",  background: "var(--ink-4)", color: "#fff",           display: "grid", placeItems: "center", fontSize: 10 }}>8%</div>
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0, minWidth: 0, overflow: "hidden" }}>
            {/* Agenda */}
            <div className="sgi-card" style={{ padding: 20, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <Eyebrow>Today · {todayShort}</Eyebrow>
                  <div className="font-display" style={{ fontSize: 18, marginTop: 2 }}>Your agenda</div>
                </div>
                <span style={{ fontSize: 11, color: "var(--gold-deep)" }}>5 events</span>
              </div>
              {[
                { t: "09:30", title: "Viewing · Marina Gate Tower 2 #4502",   who: "M. Al-Hashimi",     tag: "Visit"    },
                { t: "11:00", title: "Proposal sign-off · Bluewaters Villa B12", who: "Legal · Reem K.", tag: "Contract" },
                { t: "14:00", title: "Discovery call · Saudi family · 8M AED",  who: "+966 5x · WhatsApp",tag: "Lead"   },
                { t: "16:30", title: "Golden Visa interview · ICA-DXB",          who: "Mr. Petrov",       tag: "Visa"   },
              ].map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "10px 0", borderTop: i ? "1px solid var(--line-soft)" : "none" }}>
                  <div className="font-mono tnum" style={{ fontSize: 12, color: "var(--ink-3)", width: 40, paddingTop: 2 }}>{e.t}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500, lineHeight: 1.3 }}>{e.title}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>{e.who}</div>
                  </div>
                  <Chip tone="gold">{e.tag}</Chip>
                </div>
              ))}
            </div>

            {/* Golden Visa card */}
            <div className="sgi-card" style={{ padding: 20, background: "var(--ink)", color: "var(--bg-ivory)", border: "1px solid var(--ink)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                <Eyebrow style={{ color: "var(--gold)" }}>Golden Visa · Pipeline</Eyebrow>
                <span style={{ fontSize: 11, color: "var(--ink-5)" }}>3 actions required</span>
              </div>
              <div className="font-display" style={{ fontSize: 22, color: "var(--bg-ivory)", marginBottom: 12 }}>
                18 applications · <span className="tnum" style={{ color: "var(--gold)" }}>AED 47.2M</span> qualifying
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                {[["Eligible","9"],["Docs pending","4"],["ICA review","3"],["Issued","2"]].map(([l,n]) => (
                  <div key={l} style={{ padding: "10px 12px", background: "rgba(217,183,119,0.08)", borderRadius: 6 }}>
                    <div className="font-display tnum" style={{ fontSize: 22, color: "var(--gold)" }}>{n}</div>
                    <div style={{ fontSize: 10, color: "var(--ink-5)", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 2 }}>{l}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom row : Activity feed + Leaderboard ───────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.5fr 1fr", gap: 16, alignItems: "start" }}>

            {/* Activity feed */}
            <div className="sgi-card" style={{ padding: 22, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
                <div>
                  <Eyebrow>Today's activity</Eyebrow>
                  <div className="font-display" style={{ fontSize: 20, marginTop: 3 }}>Live feed</div>
                </div>
                {/* Activity filter */}
                <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-inset)", borderRadius: "var(--r)" }}>
                  {(["all","sales","rentals","crm"] as ActivityFilter[]).map(f => (
                    <button key={f} onClick={() => setActFilter(f)} style={tabStyle(actFilter === f)}>
                      {pl(ACT_LABEL[f])}
                    </button>
                  ))}
                </div>
              </div>

              {filteredAct.length === 0 ? (
                <div style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>No activity</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column" }}>
                  {filteredAct.map((a, i) => (
                    <div key={a.id} style={{ display: "flex", gap: 14, padding: "12px 0", borderTop: i ? "1px solid var(--line-soft)" : "none", alignItems: "flex-start" }}>
                      {/* Type indicator */}
                      <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, marginTop: 2, display: "grid", placeItems: "center", background: ACT_COLOR[a.type] + "18" }}>
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: ACT_COLOR[a.type], display: "block" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", lineHeight: 1.35 }}>{a.title}</div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>{a.detail}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 4, display: "flex", gap: 10, alignItems: "center" }}>
                          <span>{a.agent}</span>
                          {a.amount && <span style={{ color: "var(--emerald)", fontWeight: 600 }}>{a.amount}</span>}
                        </div>
                      </div>
                      <div className="tnum" style={{ fontSize: 11.5, color: "var(--ink-4)", flexShrink: 0, paddingTop: 3 }}>{a.time}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Top agents leaderboard */}
            <div className="sgi-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14, overflow: "hidden", minWidth: 0 }}>
              <div>
                <Eyebrow>May · Top performers</Eyebrow>
                <div className="font-display" style={{ fontSize: 20, marginTop: 3 }}>Agent leaderboard</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {TOP_AGENTS.map((a, i) => (
                  <div key={a.rank} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i ? "1px solid var(--line-soft)" : "none" }}>
                    {/* Rank badge */}
                    <div style={{
                      width: 22, height: 22, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
                      background: i < 3 ? RANK_C[i] + "18" : "var(--bg-inset)",
                      fontSize: 11, fontWeight: 700,
                      color: i < 3 ? RANK_C[i] : "var(--ink-4)",
                    }}>
                      {a.rank}
                    </div>
                    {/* Avatar */}
                    <div style={{
                      width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center",
                      background: i === 0 ? "var(--ink)" : "var(--bg-ivory)",
                      border: "1px solid var(--line-soft)",
                      fontSize: 11, fontWeight: 700,
                      color: i === 0 ? "var(--gold)" : "var(--ink-3)",
                      fontFamily: "'Roboto', sans-serif",
                    }}>
                      {a.initials}
                    </div>
                    {/* Name + progress bar */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                      <div style={{ marginTop: 5, height: 4, borderRadius: 2, background: "var(--bg-inset)", overflow: "hidden" }}>
                        <div style={{
                          height: "100%", width: `${a.pct}%`, borderRadius: 2,
                          background: i === 0 ? "var(--gold)" : i === 1 ? "var(--ink-3)" : i === 2 ? "#CD7F32" : "var(--azure)",
                          transition: "width 0.4s ease",
                        }} />
                      </div>
                    </div>
                    {/* Volume */}
                    <div style={{ textAlign: "end", flexShrink: 0 }}>
                      <div className="tnum font-display" style={{ fontSize: 15, color: i === 0 ? "var(--gold-deep)" : "var(--ink)" }}>
                        {a.vol.toFixed(1)}M
                      </div>
                      <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 1 }}>{a.deals} deals</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Team summary */}
              <div style={{ paddingTop: 12, borderTop: "1px solid var(--line-soft)", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                {[
                  { label: "Team total", value: "150M" },
                  { label: "Avg / agent", value: "30M" },
                  { label: "vs last month", value: "+18%" },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: "center", padding: "8px 4px", background: "var(--bg-ivory)", borderRadius: "var(--r)" }}>
                    <div className="tnum font-display" style={{ fontSize: 14, color: "var(--ink)" }}>{s.value}</div>
                    <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 2, letterSpacing: "0.06em" }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

          </div>
      </main>
    </div>
  );
}
