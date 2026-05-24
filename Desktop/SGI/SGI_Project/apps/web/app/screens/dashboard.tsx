"use client";
import React from "react";
import { useBreakpoint } from "@/lib/hooks";
import {
  Topbar, Eyebrow, Chip, StatusDot,
  IcDownload, IcPlus, IcArrowUp, IcTrend,
} from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";

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

export function ScreenDashboard() {
  const t = useT();
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isCompact = bp !== "desktop";
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_dash}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcDownload />&nbsp;{t.export_btn}</button>}
        <button className="sgi-btn sgi-btn-primary"><IcPlus />&nbsp;{t.new_btn}</button>
      </Topbar>

      <main style={{ flex: 1, overflow: "auto", padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 20, background: "var(--bg-cream)" }}>
        {/* Greeting */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
          <div>
            <Eyebrow>Saturday · 23 May 2026 · DXB</Eyebrow>
            <div className="font-display" style={{ fontSize: isMob ? 26 : 36, marginTop: 8, color: "var(--ink)" }}>
              {t.t_dash}
            </div>
          </div>
          {!isMob && <div style={{ display: "flex", gap: 8 }}>
            <Chip tone="gold"><span style={{ marginInlineEnd: 4, display: "inline-flex" }}><IcTrend /></span>Q2 pacing +18%</Chip>
            <Chip tone="emerald"><StatusDot tone="emerald" />&nbsp;All systems green</Chip>
          </div>}
        </div>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 16 }}>
          <KpiTile eyebrow="Inventory" label={t.nav_prop} value="1,284" delta="+12" deltaPct="+12.4%" tone="gold" spark={[3,5,4,7,6,8,9,11,10,12]} />
          <KpiTile eyebrow="Pipeline" label={t.nav_crm} value="342" delta="+28" deltaPct="+8.9%" tone="emerald" spark={[2,3,2,4,5,4,6,7,6,8]} />
          <KpiTile eyebrow="May volume" label={t.hero_s3_l} value="AED 24.5M" delta="+4.5M" deltaPct="+23.1%" tone="gold" spark={[4,5,3,6,8,7,9,8,11,12]} />
          <KpiTile eyebrow="Golden Visa" label={t.nav_visa} value="18" delta="+3" deltaPct="+5.0%" tone="azure" spark={[1,2,2,3,2,4,3,4,5,5]} />
        </div>

        {/* Middle row */}
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.4fr 1fr", gap: 16, flex: 1, minHeight: isCompact ? undefined : 280 }}>
          {/* Pipeline */}
          <div className="sgi-card" style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
              <div>
                <Eyebrow>CRM · Sales pipeline</Eyebrow>
                <div className="font-display" style={{ fontSize: 22, marginTop: 4 }}>Where the money is moving</div>
              </div>
              {!isMob && <div style={{ display: "flex", gap: 6, fontSize: 11, color: "var(--ink-3)" }}>
                <span style={{ padding: "4px 10px", borderRadius: 999, background: "var(--gold-ghost)", color: "var(--gold-deep)" }}>This week</span>
                <span style={{ padding: "4px 10px", borderRadius: 999 }}>Month</span>
                <span style={{ padding: "4px 10px", borderRadius: 999 }}>Quarter</span>
              </div>}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(3, 1fr)" : "repeat(6, 1fr)", gap: 10 }}>
              {[
                { ar: "جديد",       en: "New",         fr: "Nouveau",      n: 45, v: "—",       h: 1.00 },
                { ar: "تواصل",      en: "Contacted",   fr: "Contacté",     n: 32, v: "—",       h: 0.85 },
                { ar: "مؤهَّل",      en: "Qualified",   fr: "Qualifié",     n: 21, v: "AED 84M", h: 0.65 },
                { ar: "عرض",        en: "Proposal",    fr: "Proposition",  n: 14, v: "AED 56M", h: 0.45 },
                { ar: "تفاوض",      en: "Negotiation", fr: "Négociation",  n:  8, v: "AED 34M", h: 0.30 },
                { ar: "مغلق · ربح", en: "Won",         fr: "Conclu",       n:  5, v: "AED 22M", h: 0.18, won: true },
              ].map((s) => (
                <div key={s.en} style={{
                  background: s.won ? "var(--ink)" : "var(--bg-ivory)",
                  color: s.won ? "var(--gold)" : "var(--ink)",
                  border: "1px solid " + (s.won ? "var(--ink)" : "var(--line-soft)"),
                  borderRadius: "var(--r)", padding: isMob ? 10 : 14,
                  display: "flex", flexDirection: "column", gap: 6, position: "relative", overflow: "hidden",
                }}>
                  <div style={{ position: "absolute", insetBlockStart: 0, insetInlineStart: 0, height: 3, width: `${s.h * 100}%`, background: "var(--gold)" }} />
                  <div className={lang === "ar" ? "font-ar" : undefined} style={{ fontSize: lang === "ar" ? 13 : 10, letterSpacing: lang === "ar" ? 0 : "0.14em", textTransform: lang === "ar" ? undefined : "uppercase", color: s.won ? "var(--gold-soft)" : "var(--ink-4)" }}>
                    {lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en}
                  </div>
                  <div className="font-display tnum" style={{ fontSize: isMob ? 24 : 32, color: s.won ? "var(--gold)" : "var(--ink)" }}>{s.n}</div>
                  <div className="tnum" style={{ fontSize: 11, color: s.won ? "var(--gold-soft)" : "var(--ink-3)" }}>{s.v}</div>
                </div>
              ))}
            </div>

            {/* Stacked bar */}
            {!isMob && <div style={{ borderTop: "1px solid var(--line-soft)", paddingTop: 14, marginTop: 4 }}>
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
                <div style={{ width: "52%", background: "var(--gold)", color: "#1A1610", display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 600 }}>Dubai · 52%</div>
                <div style={{ width: "26%", background: "var(--ink)", color: "var(--gold)", display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 600 }}>AUH · 26%</div>
                <div style={{ width: "14%", background: "var(--azure)", color: "#fff", display: "grid", placeItems: "center", fontSize: 10.5, fontWeight: 600 }}>SHJ · 14%</div>
                <div style={{ width: "8%", background: "var(--ink-4)", color: "#fff", display: "grid", placeItems: "center", fontSize: 10 }}>8%</div>
              </div>
            </div>}
          </div>

          {/* Right column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 16, minHeight: 0 }}>
            {/* Agenda */}
            <div className="sgi-card" style={{ padding: 20, flex: 1 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div>
                  <Eyebrow>Today · 23 May</Eyebrow>
                  <div className="font-display" style={{ fontSize: 18, marginTop: 2 }}>Your agenda</div>
                </div>
                <span style={{ fontSize: 11, color: "var(--gold-deep)" }}>5 events</span>
              </div>
              {[
                { t: "09:30", title: "Viewing · Marina Gate Tower 2 #4502", who: "M. Al-Hashimi", tag: "Visit" },
                { t: "11:00", title: "Proposal sign-off · Bluewaters Villa B12", who: "Legal · Reem K.", tag: "Contract" },
                { t: "14:00", title: "Discovery call · Saudi family · 8M AED", who: "+966 5x · WhatsApp", tag: "Lead" },
                { t: "16:30", title: "Golden Visa interview · ICA-DXB", who: "Mr. Petrov", tag: "Visa" },
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
      </main>
    </div>
  );
}
