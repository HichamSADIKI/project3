"use client";
import React from "react";
import { Wordmark, Eyebrow, Chip, PropertyImage, IcPhone, IcSearch, IcHeart, IcShare, IcChevR } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";

export function ScreenPortal() {
  const { lang } = useLang();
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: "var(--bg-cream)", color: "var(--ink)", fontFamily: "Inter, sans-serif", overflow: "auto" }}>
      {/* Header */}
      <header style={{ height: 76, padding: "0 56px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-cream)", borderBottom: "1px solid var(--line-soft)", position: "sticky", top: 0, zIndex: 10 }}>
        <Wordmark />
        <nav style={{ display: "flex", gap: 32, fontSize: 13, color: "var(--ink-2)" }}>
          {["Properties","Sale","Rent","Golden Visa","Insights","About"].map(l => (
            <span key={l} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer" }}>
              <span>{l}</span>
              {l === "Properties" && <span style={{ width: 20, height: 1, background: "var(--gold)" }} />}
            </span>
          ))}
        </nav>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 11.5, color: "var(--ink-3)", letterSpacing: "0.08em" }}>AR · EN · FR</span>
          <button className="sgi-btn sgi-btn-ghost" style={{ height: 36 }}><IcPhone />&nbsp;+971 4 555 0100</button>
          <button className="sgi-btn sgi-btn-primary" style={{ height: 36 }}>Book a viewing</button>
        </div>
      </header>

      {/* Hero */}
      <section style={{ padding: "64px 56px 48px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
        <div>
          <Eyebrow>Infinity Curated · Spring 2026</Eyebrow>
          <div className="font-display" style={{ fontSize: 64, lineHeight: 1.02, marginTop: 18, letterSpacing: "-0.02em" }}>
            A different kind of <i style={{ color: "var(--gold-deep)" }}>address</i> in the Emirates.
          </div>
          {lang === "ar" && (
            <div className="font-ar" style={{ fontSize: 22, color: "var(--ink-2)", marginTop: 16, lineHeight: 1.55 }}>
              عقارات مختارة بعناية — من المرسى إلى السعديات.
            </div>
          )}
          <div style={{ fontSize: 14.5, color: "var(--ink-3)", lineHeight: 1.7, marginTop: 18, maxWidth: 480 }}>
            1,284 hand-picked properties across Dubai, Abu Dhabi and Sharjah —
            with Golden Visa pathways for qualifying acquisitions ≥ AED 2,000,000.
          </div>

          {/* Search pill */}
          <div style={{ marginTop: 32, display: "flex", background: "var(--bg-ivory)", border: "1px solid var(--line)", borderRadius: 999, padding: 6, boxShadow: "var(--shadow-2)" }}>
            {[
              { l: "Listing",  v: "For Sale" },
              { l: "Location", v: "Dubai Marina" },
              { l: "Bedrooms", v: "2 — 4" },
              { l: "Budget",   v: "AED 2M — 8M" },
            ].map((f, i) => (
              <React.Fragment key={f.l}>
                {i > 0 && <div style={{ width: 1, background: "var(--line-soft)", margin: "8px 0" }} />}
                <div style={{ padding: "10px 18px", flex: 1 }}>
                  <div className="eyebrow" style={{ fontSize: 9 }}>{f.l}</div>
                  <div style={{ fontSize: 13, color: "var(--ink)", marginTop: 2, fontWeight: 500 }}>{f.v}</div>
                </div>
              </React.Fragment>
            ))}
            <button style={{ background: "var(--gold)", color: "#1A1610", border: "none", width: 56, borderRadius: 999, display: "grid", placeItems: "center", cursor: "pointer" }}>
              <IcSearch />
            </button>
          </div>

          <div style={{ marginTop: 40, paddingTop: 24, borderTop: "1px solid var(--line)", display: "flex", gap: 40 }}>
            {[["1,284","Properties"],["18","Years in UAE"],["AED 8.4B","Volume 2025"]].map(([n,l]) => (
              <div key={l}>
                <div className="font-display tnum" style={{ fontSize: 28 }}>{n}</div>
                <div style={{ fontSize: 10.5, letterSpacing: "0.16em", color: "var(--ink-4)", textTransform: "uppercase", marginTop: 2 }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", height: 560, borderRadius: 6, overflow: "hidden", boxShadow: "var(--shadow-3)" }}>
          <PropertyImage variant={1} />
          <div style={{ position: "absolute", bottom: 24, insetInlineStart: 24, color: "#fff", maxWidth: 360 }}>
            <Chip tone="gold">Featured · INF-2418</Chip>
            <div className="font-display" style={{ fontSize: 30, color: "#fff", marginTop: 10, lineHeight: 1.1 }}>Marina Gate · Tower 2</div>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.85)", marginTop: 4 }}>3 BR Duplex · 2,150 ft² · Dubai Marina</div>
            <div className="font-display tnum" style={{ fontSize: 26, color: "var(--gold)", marginTop: 10 }}>AED 4,750,000</div>
          </div>
          <div style={{ position: "absolute", top: 24, insetInlineEnd: 24, display: "flex", gap: 6 }}>
            <button style={{ width: 38, height: 38, borderRadius: 19, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", display: "grid", placeItems: "center", backdropFilter: "blur(8px)", cursor: "pointer" }}><IcHeart /></button>
            <button style={{ width: 38, height: 38, borderRadius: 19, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", display: "grid", placeItems: "center", backdropFilter: "blur(8px)", cursor: "pointer" }}><IcShare /></button>
          </div>
        </div>
      </section>

      {/* Trust bar */}
      <section style={{ padding: "20px 56px 40px", borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 56 }}>
        <Eyebrow>Trusted partners</Eyebrow>
        <div style={{ display: "flex", gap: 48, flex: 1, alignItems: "center", color: "var(--ink-4)", fontFamily: "'Cormorant Garamond', serif", fontSize: 18, letterSpacing: "0.16em" }}>
          {["EMAAR","DAMAC","MERAAS","NAKHEEL","ALDAR","SOBHA","OMNIYAT"].map(p => <span key={p}>{p}</span>)}
        </div>
      </section>

      {/* Property grid */}
      <section style={{ padding: "32px 56px 56px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 26 }}>
          <div>
            <Eyebrow>The collection · May 2026</Eyebrow>
            <div className="font-display" style={{ fontSize: 42, marginTop: 8 }}>Curated properties</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Chip tone="gold">All · 84</Chip>
            <Chip>Marina · 18</Chip>
            <Chip>Palm · 12</Chip>
            <Chip>Saadiyat · 9</Chip>
            <Chip>Downtown · 22</Chip>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20 }}>
          {[
            { variant: 2, ref: "INF-2417", title: "Bluewaters Residences",  area: "Bluewaters · 4BR",     price: "AED 12.5M", tag: "Golden Visa" },
            { variant: 3, ref: "INF-2416", title: "Palm Shoreline 12",       area: "Palm Jumeirah · Rent", price: "AED 350K/y", tag: "Furnished" },
            { variant: 4, ref: "INF-2418", title: "Marina Gate · Tower 2",   area: "Marina · 3BR Duplex",  price: "AED 4.75M", tag: "Featured" },
            { variant: 5, ref: "INF-2414", title: "Saadiyat Beach Villa 32", area: "Abu Dhabi · 5BR Villa", price: "AED 28M",   tag: "Golden Visa" },
          ].map((p, i) => (
            <div key={i} style={{ borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--line-soft)", background: "var(--bg-ivory)" }}>
              <div style={{ height: 220, position: "relative" }}>
                <PropertyImage variant={p.variant} />
                <span style={{ position: "absolute", top: 12, insetInlineStart: 12 }}>
                  <Chip tone={p.tag === "Golden Visa" ? "gold" : undefined}>{p.tag}</Chip>
                </span>
                <button style={{ position: "absolute", top: 12, insetInlineEnd: 12, width: 32, height: 32, borderRadius: 16, background: "rgba(255,255,255,0.9)", border: "none", display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-3)" }}><IcHeart /></button>
              </div>
              <div style={{ padding: 16 }}>
                <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.06em" }}>{p.ref}</div>
                <div className="font-display" style={{ fontSize: 19, marginTop: 4 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{p.area}</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-soft)" }}>
                  <span className="font-display tnum" style={{ fontSize: 18, color: "var(--gold-deep)" }}>{p.price}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: "var(--ink-3)", cursor: "pointer" }}>View <IcChevR /></span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 28, textAlign: "center" }}>
          <button className="sgi-btn sgi-btn-ghost" style={{ padding: "12px 28px" }}>
            View the full collection · 1,284 properties&nbsp;<IcChevR />
          </button>
        </div>
      </section>

      {/* Golden Visa banner */}
      <section style={{ padding: "0 56px" }}>
        <div style={{ background: "var(--ink)", color: "var(--bg-ivory)", padding: "56px 64px", borderRadius: "var(--r-md)", display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 40, position: "relative", overflow: "hidden" }}>
          <svg width="280" height="280" viewBox="0 0 280 280" style={{ position: "absolute", insetInlineEnd: -40, top: -30, opacity: 0.10 }}>
            <path d="M140 20 L168 100 L252 100 L184 152 L212 232 L140 184 L68 232 L96 152 L28 100 L112 100 Z" fill="var(--gold)" />
          </svg>
          <div style={{ position: "relative", zIndex: 1 }}>
            <Eyebrow style={{ color: "var(--gold)" }}>UAE 10-year residency</Eyebrow>
            <div className="font-display" style={{ fontSize: 48, color: "var(--gold)", marginTop: 14, lineHeight: 1.05 }}>
              Buy a home. <i>Earn</i> a homeland.
            </div>
            {lang === "ar" && (
              <div className="font-ar" style={{ fontSize: 18, color: "var(--ink-5)", marginTop: 10 }}>
                اشترِ منزلاً، واكتسب وطناً. التأشيرة الذهبية تبدأ من ٢ مليون درهم.
              </div>
            )}
            <div style={{ fontSize: 14, color: "var(--ink-5)", marginTop: 18, lineHeight: 1.7, maxWidth: 460 }}>
              Acquire qualifying property ≥ AED 2,000,000 and we&apos;ll guide you through every step of the
              Golden Visa — DLD, GDRFA, medical, biometrics — in 30 to 45 days.
            </div>
            <div style={{ marginTop: 26, display: "flex", gap: 10 }}>
              <button style={{ padding: "12px 24px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                Check eligibility <IcChevR />
              </button>
              <button style={{ padding: "12px 24px", border: "1px solid var(--gold)", color: "var(--gold)", background: "transparent", borderRadius: "var(--r)", cursor: "pointer", fontFamily: "Inter, sans-serif", fontSize: 13 }}>
                Read the guide
              </button>
            </div>
          </div>
          <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              ["10", "year residency"],
              ["AED 2M", "minimum threshold"],
              ["30–45", "days processing"],
              ["218", "visas issued · 2025"],
            ].map(([n,l]) => (
              <div key={l} style={{ padding: "20px 18px", background: "rgba(217,183,119,0.06)", borderInlineStart: "2px solid var(--gold)" }}>
                <div className="font-display tnum" style={{ fontSize: 36, color: "var(--gold)", lineHeight: 1 }}>{n}</div>
                <div style={{ fontSize: 11, letterSpacing: "0.12em", color: "var(--ink-5)", marginTop: 6, textTransform: "uppercase" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "56px 56px 32px", marginTop: 56, borderTop: "1px solid var(--line-soft)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr", gap: 40 }}>
          <div>
            <Wordmark />
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", marginTop: 16, lineHeight: 1.7, maxWidth: 280 }}>
              Infinity International Facilities Management LLC.
              Dubai · Abu Dhabi · Sharjah. RERA #21841.
            </div>
          </div>
          {[
            ["Buy",      ["Properties","Off-plan","Golden Visa","Mortgage"]],
            ["Rent",     ["Apartments","Villas","Commercial","Short-term"]],
            ["Insights", ["Market reports","Neighborhood guides","Blog","Press"]],
            ["Company",  ["About","Careers","Contact","Privacy"]],
          ].map(([h, items]) => (
            <div key={h as string}>
              <div className="eyebrow">{h}</div>
              <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5, color: "var(--ink-3)" }}>
                {(items as string[]).map(i => <span key={i} style={{ cursor: "pointer" }}>{i}</span>)}
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-4)", letterSpacing: "0.08em" }}>
          <span>© 2026 Infinity International FM · All rights reserved</span>
          <span>DUBAI · ABU DHABI · SHARJAH · RIYADH</span>
        </div>
      </footer>
    </div>
  );
}
