"use client";
import React from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Chip, IcPlus } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";

const VISA_STAGES = [
  { k: "elig",  ar: "أهلية",  en: "Eligibility", fr: "Éligibilité",   desc: "Property ≥ AED 2M signed" },
  { k: "docs",  ar: "وثائق",  en: "Documents",   fr: "Documents",     desc: "Passport · photo · deed" },
  { k: "dld",   ar: "دائرة",  en: "DLD",         fr: "DLD",           desc: "Title issued by Dubai Land" },
  { k: "gdrfa", ar: "إقامة",  en: "GDRFA",       fr: "GDRFA",         desc: "Federal residency request" },
  { k: "med",   ar: "فحص",    en: "Medical",     fr: "Médical",       desc: "DHA medical + biometrics" },
  { k: "ica",   ar: "هوية",   en: "ICA",         fr: "ICA",           desc: "ID issuance" },
  { k: "iss",   ar: "تأشيرة", en: "Issued",      fr: "Délivré",       desc: "10-year residency granted" },
];

function VisaCard({ a }: { a: { name: string; property: string; stage: number; value: number } }) {
  const { lang } = useLang();
  return (
    <div style={{ padding: 14, background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>{a.name}</div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>{a.property}</div>
        </div>
        <span className="tnum" style={{ fontSize: 11, color: "var(--gold-deep)", fontWeight: 600 }}>AED {a.value}M</span>
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 12 }}>
        {VISA_STAGES.map((_, i) => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= a.stage ? (a.stage === 6 ? "var(--emerald)" : "var(--gold)") : "var(--bg-inset)" }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11 }}>
        <span style={{ color: "var(--ink-3)" }}>{lang === "ar" ? VISA_STAGES[a.stage].ar : lang === "fr" ? VISA_STAGES[a.stage].fr : VISA_STAGES[a.stage].en}</span>
        <span style={{ color: "var(--ink-4)" }}>{a.stage === 6 ? "Issued" : `Step ${a.stage + 1} / 7`}</span>
      </div>
    </div>
  );
}

export function ScreenGoldenVisa() {
  const t = useT();
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isTab = bp === "tablet";
  const isCompact = bp !== "desktop";
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_visa} crumb={isMob ? [] : ["18 active applications", "AED 47.2M qualifying"]}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost">Templates · 6</button>}
        <button className="sgi-btn sgi-btn-primary"><IcPlus />&nbsp;{t.new_btn}</button>
      </Topbar>

      <main style={{ flex: 1, padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 18, background: "var(--bg-cream)", overflow: "auto" }}>
        {/* Header row */}
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.4fr 1fr", gap: 18 }}>
          {/* Dark hero card */}
          <div className="sgi-card-elevated" style={{ padding: 26, background: "linear-gradient(135deg, var(--ink) 0%, #2A2218 100%)", color: "var(--bg-ivory)", border: "1px solid var(--ink)", position: "relative", overflow: "hidden" }}>
            <svg width="180" height="180" viewBox="0 0 180 180" style={{ position: "absolute", top: -20, insetInlineEnd: -20, opacity: 0.15 }}>
              <path d="M90 10 L108 64 L168 64 L120 100 L138 158 L90 124 L42 158 L60 100 L12 64 L72 64 Z" fill="var(--gold)" />
            </svg>
            <Eyebrow style={{ color: "var(--gold)" }}>UAE 10-year residency · gold tier</Eyebrow>
            <div className="font-display" style={{ fontSize: isMob ? 28 : 38, color: "var(--gold)", marginTop: 8, letterSpacing: "-0.01em" }}>
              <i style={{ fontStyle: "italic" }}>Golden</i> Visa workflow
            </div>
            {lang === "ar" && (
              <div className="font-ar" style={{ fontSize: 16, color: "var(--ink-5)", marginTop: 4 }}>
                مسار طلبات التأشيرة الذهبية · إقامة طويلة الأمد
              </div>
            )}
            <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
              {[["Eligible","9"],["In progress","7"],["At ICA","3"],["Issued · 2026","12"]].map(([l,n]) => (
                <div key={l} style={{ padding: isMob ? "8px 10px" : "12px 14px", background: "rgba(217,183,119,0.10)", borderInlineStart: "2px solid var(--gold)" }}>
                  <div className="font-display tnum" style={{ fontSize: isMob ? 22 : 28, color: "var(--gold)" }}>{n}</div>
                  <div style={{ fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", color: "var(--ink-5)", marginTop: 2 }}>{l}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Alerts */}
          <div className="sgi-card" style={{ padding: 22 }}>
            <Eyebrow>Alerts · next 90 days</Eyebrow>
            <div className="font-display" style={{ fontSize: 22, marginTop: 4 }}>3 visas expiring</div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { name: "Yusuf Demir", d: "J-30", exp: "22 Jun 2026", c: "var(--rose)" },
                { name: "Sofia Russo", d: "J-72", exp: "03 Aug 2026", c: "var(--gold)" },
                { name: "Hu Wei",      d: "J-88", exp: "19 Aug 2026", c: "var(--gold)" },
              ].map((a) => (
                <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: 10, background: "var(--bg-paper)", borderRadius: 6, borderInlineStart: "2px solid " + a.c }}>
                  <div className="font-display tnum" style={{ fontSize: 18, color: a.c, minWidth: 48 }}>{a.d}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>Expires · {a.exp}</div>
                  </div>
                  <button className="sgi-btn sgi-btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 11 }}>Renew</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Workflow rail */}
        <div className="sgi-card" style={{ padding: isMob ? 14 : 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <div>
              <Eyebrow>Active application · #GV-2412</Eyebrow>
              <div className="font-display" style={{ fontSize: isMob ? 16 : 22, marginTop: 4 }}>
                Mohammed Bin Saud · <span style={{ color: "var(--gold-deep)" }}>AED 28.0M · Saadiyat Villa</span>
              </div>
            </div>
            {!isMob && <div style={{ display: "flex", gap: 6 }}>
              <Chip tone="gold">Stage 4 / 7 · GDRFA</Chip>
              <Chip>23 days in flight</Chip>
            </div>}
          </div>

          {/* Scrollable on mobile */}
          <div style={{ marginTop: 22, overflowX: isMob ? "auto" : undefined, WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>
            <div style={{ position: "relative", minWidth: isMob ? 560 : undefined }}>
              <div style={{ position: "absolute", insetInlineStart: 18, insetInlineEnd: 18, top: 21, height: 2, background: "var(--line)" }} />
              <div style={{ position: "absolute", insetInlineStart: 18, top: 21, height: 2, width: "calc((100% - 36px) * 0.5)", background: "var(--gold)" }} />
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${VISA_STAGES.length}, 1fr)`, gap: 0 }}>
                {VISA_STAGES.map((s, i) => {
                  const done = i < 3, current = i === 3;
                  return (
                    <div key={s.k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, position: "relative", padding: "0 6px" }}>
                      <div style={{
                        width: 44, height: 44, borderRadius: 22,
                        background: done ? "var(--gold)" : (current ? "var(--ink)" : "var(--bg-ivory)"),
                        border: "2px solid " + (done ? "var(--gold)" : (current ? "var(--gold)" : "var(--line-strong)")),
                        color: done ? "var(--ink)" : (current ? "var(--gold)" : "var(--ink-4)"),
                        display: "grid", placeItems: "center",
                        fontFamily: "'Roboto', sans-serif", fontSize: 18, fontWeight: 600,
                        boxShadow: current ? "0 0 0 6px var(--gold-ghost)" : "none",
                        position: "relative", zIndex: 1,
                      }}>
                        {done ? "✓" : (i + 1)}
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div className={lang === "ar" ? "font-ar" : undefined} style={{ fontSize: lang === "ar" ? 13 : 12, fontWeight: 600, color: current ? "var(--ink)" : "var(--ink-2)" }}>
                          {lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en}
                        </div>
                        <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 2, lineHeight: 1.3 }}>{s.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Stage detail */}
          <div style={{ marginTop: 24, padding: isMob ? 12 : 20, background: "var(--bg-inset)", borderRadius: "var(--r)", display: "grid", gridTemplateColumns: isMob ? "1fr" : isTab ? "1fr 1fr" : "1fr 1fr 1fr", gap: isMob ? 14 : 18 }}>
            <div>
              <Eyebrow>Current stage</Eyebrow>
              <div className="font-display" style={{ fontSize: 18, marginTop: 4 }}>GDRFA · residency request</div>
              <div style={{ marginTop: 10, fontSize: 12, color: "var(--ink-3)", lineHeight: 1.55 }}>
                Submitted 18 May. Expected SLA: 7–10 business days.
              </div>
            </div>
            <div>
              <Eyebrow>Documents · 8 / 10</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                {[
                  ["Passport · biometric page", true],
                  ["Photo · 4×6 white background", true],
                  ["DLD title deed", true],
                  ["Medical insurance", true],
                  ["DHA fitness certificate", false],
                  ["EIDA biometrics", false],
                ].map(([l, ok], i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: ok ? "var(--ink-2)" : "var(--ink-4)" }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, background: ok ? "var(--emerald)" : "transparent", border: "1px solid " + (ok ? "var(--emerald)" : "var(--line-strong)"), color: "#fff", display: "grid", placeItems: "center", fontSize: 9 }}>
                      {ok ? "✓" : ""}
                    </span>
                    <span style={{ flex: 1 }}>{l as string}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Eyebrow>Next actions</Eyebrow>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {[
                  { t: "Schedule DHA medical",   who: "Mr. Bin Saud",                  due: "27 May" },
                  { t: "Collect EIDA biometrics", who: "ICA centre · Mall of Emirates", due: "31 May" },
                  { t: "Insurance proof upload",  who: "Legal · Reem K.",               due: "29 May" },
                ].map((a, i) => (
                  <div key={i} style={{ padding: 10, background: "var(--bg-ivory)", borderRadius: 6, border: "1px solid var(--line-soft)" }}>
                    <div style={{ fontSize: 12.5, fontWeight: 500 }}>{a.t}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, fontSize: 10.5, color: "var(--ink-4)" }}>
                      <span>{a.who}</span><span className="tnum">Due {a.due}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Applications grid */}
        <div className="sgi-card" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <div>
              <Eyebrow>All applications</Eyebrow>
              <div className="font-display" style={{ fontSize: 20, marginTop: 4 }}>Portfolio · 18 active</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Chip tone="gold">All</Chip><Chip>Mine</Chip>{!isMob && <Chip>This quarter</Chip>}
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : isTab ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
            {[
              { name: "Bin Saud, M.",  property: "Saadiyat V32",       stage: 3, value: 28 },
              { name: "Tanaka, F.",    property: "Bluewaters B12",     stage: 1, value: 11.8 },
              { name: "Schmidt, A.",   property: "Marina Gate T2",     stage: 0, value: 4.75 },
              { name: "Petrov, D.",    property: "Palm · Shoreline 8", stage: 5, value: 9.2 },
              { name: "Demir, Y.",     property: "Marina #4502",       stage: 6, value: 4.75 },
              { name: "Russo, L.",     property: "Burj Vista 1",       stage: 6, value: 2.1 },
              { name: "Wei, H.",       property: "Palm · S12",         stage: 6, value: 8.4 },
              { name: "Almeida, R.",   property: "Downtown · Ad. 4",   stage: 2, value: 3.6 },
            ].map((a, i) => <VisaCard key={i} a={a} />)}
          </div>
        </div>
      </main>
    </div>
  );
}
