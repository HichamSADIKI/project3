"use client";
import React from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Chip, IcDownload, IcArrowUp, IcArrowDown } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

function Stat({ l, v }: { l: string; v: string }) {
  return (
    <div>
      <div className="eyebrow">{l}</div>
      <div className="font-display tnum" style={{ fontSize: 18, marginTop: 3 }}>{v}</div>
    </div>
  );
}

function FinanceChart() {
  const data = [12, 15, 13, 18, 22, 19, 24, 21, 28, 26, 31, 24.5];
  const max = Math.max(...data);
  const w = 760, h = 90;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - (v / max) * h * 0.85 - 4}`);
  const area = `M0,${h} L${pts.join(" L")} L${w},${h} Z`;
  const line = `M${pts.join(" L")}`;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} style={{ width: "100%", height: 100 }}>
      <defs>
        <linearGradient id="finGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#finGrad)" />
      <path d={line} fill="none" stroke="var(--gold-deep)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((v, i) => i === data.length - 1 && (
        <circle key={i} cx={i * step} cy={h - (v / max) * h * 0.85 - 4} r="4" fill="var(--ink)" stroke="var(--gold)" strokeWidth="2" />
      ))}
      {["J","F","M","A","M","J","J","A","S","O","N","D"].map((m, i) => (
        <text key={i} x={i * step} y={h + 14} fill="var(--ink-4)" fontSize="9" letterSpacing="1" textAnchor="middle" fontFamily="Inter">{m}</text>
      ))}
    </svg>
  );
}

function Donut({ segments, size = 110, thickness = 18 }: { segments: { label: string; value: number; color: string }[]; size?: number; thickness?: number }) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size/2} cy={size/2} r={r} stroke="var(--bg-inset)" strokeWidth={thickness} fill="none" />
      {segments.map((s, i) => {
        const dash = (s.value / 100) * c;
        const offset = -acc;
        acc += dash;
        return (
          <circle key={i} cx={size/2} cy={size/2} r={r}
            stroke={s.color} strokeWidth={thickness} fill="none"
            strokeDasharray={`${dash} ${c - dash}`}
            strokeDashoffset={offset}
          />
        );
      })}
    </svg>
  );
}

export function ScreenFinance() {
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isCompact = bp !== "desktop";
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_finance}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost">May · Q2 ▾</button>}
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcDownload />&nbsp;{t.export_btn} PDF</button>}
        <button className="sgi-btn sgi-btn-primary">{t.close_month}</button>
      </Topbar>

      <main style={{ flex: 1, padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 18, background: "var(--bg-cream)", overflow: "auto" }}>
        {/* Hero KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.4fr 1fr 1fr", gap: 18 }}>
          <div className="sgi-card-elevated" style={{ padding: 26 }}>
            <Eyebrow>Closed volume · May 2026</Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
              <span className="font-display tnum" style={{ fontSize: isMob ? 38 : 54, color: "var(--ink)", letterSpacing: "-0.02em" }}>AED 24.5M</span>
              <Chip tone="emerald"><span style={{ display: "inline-flex" }}><IcArrowUp /></span>&nbsp;+23.1% MoM</Chip>
            </div>
            <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--line-soft)", flexWrap: "wrap" }}>
              <Stat l="Transactions" v="14" />
              <Stat l="Avg deal" v="AED 1.75M" />
              {!isMob && <Stat l="Commission" v="AED 487K" />}
              {!isMob && <Stat l="VAT collected" v="AED 23K" />}
            </div>
            <div style={{ marginTop: 16 }}>
              <FinanceChart />
            </div>
          </div>

          <div className="sgi-card" style={{ padding: 22, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <Eyebrow>Pipeline value · weighted</Eyebrow>
              <div className="font-display tnum" style={{ fontSize: 38, marginTop: 6 }}>AED 196.4M</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>across 342 opportunities</div>
            </div>
            <div style={{ marginTop: 14 }}>
              {[
                ["Qualified",   "AED 84M", 0.42],
                ["Proposal",    "AED 56M", 0.28],
                ["Negotiation", "AED 34M", 0.17],
                ["Won (LTD)",   "AED 22M", 0.13],
              ].map(([l, v, w], i) => (
                <div key={l as string} style={{ marginTop: i ? 10 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "var(--ink-3)", marginBottom: 4 }}>
                    <span>{l}</span><span className="tnum">{v}</span>
                  </div>
                  <div style={{ height: 6, background: "var(--bg-inset)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${(w as number) * 100}%`, height: "100%", background: i === 3 ? "var(--emerald)" : "var(--gold)" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="sgi-card" style={{ padding: 22 }}>
            <Eyebrow>Cash position · today</Eyebrow>
            <div className="font-display tnum" style={{ fontSize: 38, marginTop: 6, color: "var(--ink)" }}>AED 3.84M</div>
            <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>across operating accounts</div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
              {[
                ["ENBD · operating",  "AED 2,840,000", "var(--ink)"],
                ["FAB · escrow",      "AED   682,000", "var(--gold-deep)"],
                ["ADCB · commission", "AED   318,000", "var(--azure)"],
              ].map(([n, v, c]) => (
                <div key={n as string} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg-paper)", borderRadius: 5, fontSize: 11.5 }}>
                  <span style={{ width: 4, height: 22, background: c as string, borderRadius: 2 }} />
                  <span style={{ flex: 1, color: "var(--ink-2)" }}>{n}</span>
                  <span className="tnum" style={{ color: "var(--ink)", fontWeight: 500 }}>{v}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
              <span style={{ color: "var(--ink-3)" }}>Pending escrow release</span>
              <span className="tnum" style={{ color: "var(--gold-deep)", fontWeight: 600 }}>AED 1.42M</span>
            </div>
          </div>
        </div>

        {/* Three columns */}
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.2fr 1fr 1.2fr", gap: 18 }}>
          {/* Leaderboard */}
          <div className="sgi-card" style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <Eyebrow>Top agents · May</Eyebrow>
                <div className="font-display" style={{ fontSize: 19, marginTop: 4 }}>Leaderboard</div>
              </div>
              <Chip>14 active</Chip>
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column" }}>
              {[
                { rank: 1, init: "YK", name: "Yasmine Karim",  deals: 6, vol: 18.4, mom: "+34%" },
                { rank: 2, init: "OB", name: "Omar Belkacem",  deals: 4, vol: 9.8,  mom: "+12%" },
                { rank: 3, init: "RM", name: "Reem M. Faisal", deals: 3, vol: 5.6,  mom: "-4%" },
                { rank: 4, init: "AH", name: "Adel Habib",     deals: 2, vol: 3.2,  mom: "+8%" },
                { rank: 5, init: "NK", name: "Nadia Khoury",   deals: 1, vol: 1.8,  mom: "—" },
              ].map((a) => (
                <div key={a.rank} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: a.rank > 1 ? "1px solid var(--line-soft)" : "none" }}>
                  <div className="font-display tnum" style={{ fontSize: 17, color: a.rank === 1 ? "var(--gold-deep)" : "var(--ink-4)", width: 20 }}>{a.rank}</div>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: "var(--ink)", color: "var(--gold)", display: "grid", placeItems: "center", fontFamily: "'Cormorant Garamond', serif", fontSize: 13, fontWeight: 600 }}>{a.init}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{a.deals} deals · {a.mom}</div>
                  </div>
                  <div className="font-display tnum" style={{ fontSize: 16, color: "var(--ink)" }}>{a.vol}M</div>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue donut */}
          <div className="sgi-card" style={{ padding: 22 }}>
            <Eyebrow>Revenue mix · YTD</Eyebrow>
            <div className="font-display" style={{ fontSize: 19, marginTop: 4 }}>Where money comes from</div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 16 }}>
              <Donut segments={[
                { label: "Sales commission", value: 64, color: "var(--gold)" },
                { label: "Leasing fees",     value: 22, color: "var(--ink)" },
                { label: "GV processing",    value:  9, color: "var(--azure)" },
                { label: "Property mgmt",    value:  5, color: "var(--emerald)" },
              ]} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  ["Sales commission", "64%", "var(--gold)"],
                  ["Leasing fees",     "22%", "var(--ink)"],
                  ["GV processing",     "9%", "var(--azure)"],
                  ["Property mgmt",     "5%", "var(--emerald)"],
                ].map(([l, v, c]) => (
                  <div key={l as string} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11.5 }}>
                    <span style={{ width: 9, height: 9, background: c as string, borderRadius: 2 }} />
                    <span style={{ flex: 1, color: "var(--ink-2)" }}>{l}</span>
                    <span className="tnum" style={{ color: "var(--ink)", fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
              <span style={{ color: "var(--ink-3)" }}>YTD total commission</span>
              <span className="font-display tnum" style={{ fontSize: 18, color: "var(--gold-deep)" }}>AED 2.18M</span>
            </div>
          </div>

          {/* Ledger */}
          <div className="sgi-card" style={{ padding: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div>
                <Eyebrow>Recent transactions</Eyebrow>
                <div className="font-display" style={{ fontSize: 19, marginTop: 4 }}>Ledger · 7 days</div>
              </div>
              <Chip tone="gold">14 entries</Chip>
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column" }}>
              {[
                { d: "23 May", type: "in",  ref: "Sale C-1280 · escrow release",    a: 1120000 },
                { d: "22 May", type: "out", ref: "Commission · Yasmine K.",         a: -94000 },
                { d: "21 May", type: "in",  ref: "Rent · JBR Sadaf #2206",           a: 18333 },
                { d: "21 May", type: "out", ref: "Marketing · Bayut featured",      a: -8400 },
                { d: "20 May", type: "in",  ref: "Sale C-1278 · deposit (10%)",     a: 840000 },
                { d: "19 May", type: "in",  ref: "GV processing · Mr. Bin Saud",    a: 22500 },
              ].map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? "1px solid var(--line-soft)" : "none", fontSize: 12 }}>
                  <span className="font-mono" style={{ width: 48, color: "var(--ink-4)", fontSize: 10.5 }}>{t.d}</span>
                  <span style={{ width: 22, height: 22, borderRadius: 11, background: t.type === "in" ? "var(--emerald-soft)" : "var(--rose-soft)", color: t.type === "in" ? "var(--emerald)" : "var(--rose)", display: "grid", placeItems: "center" }}>
                    {t.type === "in" ? <IcArrowDown /> : <IcArrowUp />}
                  </span>
                  <span style={{ flex: 1, color: "var(--ink-2)", minWidth: 0 }}>{t.ref}</span>
                  <span className="tnum" style={{ color: t.a < 0 ? "var(--rose)" : "var(--ink)", fontWeight: 500 }}>
                    {t.a < 0 ? "−" : "+"} AED {Math.abs(t.a).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
