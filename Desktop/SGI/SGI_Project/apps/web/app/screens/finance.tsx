"use client";
import React, { useState, useRef } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Chip, IcDownload, IcArrowUp, IcArrowDown, IcCheck } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

/* ─── Filter types ───────────────────────────────────────────────────── */

type FinanceFilter = {
  period: "may" | "apr" | "q2" | "ytd";
  agent: "all" | "YK" | "OB" | "RM" | "AH" | "NK";
  category: "all" | "sale" | "rent" | "gv";
};

const DEFAULT_FINANCE_FILTER: FinanceFilter = { period: "may", agent: "all", category: "all" };

function isFinanceFilterActive(f: FinanceFilter) {
  return f.period !== "may" || f.agent !== "all" || f.category !== "all";
}

function periodLabel(p: FinanceFilter["period"]): string {
  switch (p) {
    case "apr": return "Apr 2026";
    case "q2":  return "Q2 2026";
    case "ytd": return "YTD 2026";
    default:    return "May 2026";
  }
}

const PERIOD_OPTS = [
  { label: "May 2026", value: "may" },
  { label: "Apr 2026", value: "apr" },
  { label: "Q2 2026",  value: "q2"  },
  { label: "YTD 2026", value: "ytd" },
];

const AGENT_OPTS = [
  { label: "All agents",    value: "all" },
  { label: "Yasmine K.",    value: "YK"  },
  { label: "Omar B.",       value: "OB"  },
  { label: "Reem M.",       value: "RM"  },
  { label: "Adel H.",       value: "AH"  },
  { label: "Nadia K.",      value: "NK"  },
];

const CATEGORY_OPTS = [
  { label: "All categories", value: "all"  },
  { label: "Sales",          value: "sale" },
  { label: "Rentals",        value: "rent" },
  { label: "Golden Visa",    value: "gv"   },
];

/* ─── FinanceFilterPill ──────────────────────────────────────────────── */

function FinanceFilterPill({
  label, displayValue, value, opts, isActive, onSelect,
}: {
  label: string; displayValue: string; value?: string;
  opts: { label: string; value: string }[]; isActive?: boolean;
  onSelect: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, minW: 0 });

  function toggle() {
    if (!open && ref.current) {
      const r = ref.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, left: r.left, minW: Math.max(r.width, 160) });
    }
    setOpen(o => !o);
  }
  const close = () => setOpen(false);
  const accent = isActive ?? false;

  return (
    <>
      <div ref={ref} onClick={toggle} style={{
        display: "flex", flexDirection: "column", gap: 1, padding: "6px 12px",
        background: accent ? "var(--gold-ghost)" : "var(--bg-paper)",
        border: `1px solid ${accent ? "var(--gold-line, var(--gold))" : "var(--line-soft)"}`,
        borderRadius: "var(--r)", cursor: "pointer", minWidth: 96, flexShrink: 0,
        boxShadow: accent ? "0 0 0 2px color-mix(in srgb,var(--gold) 18%,transparent)" : "none",
        transition: "box-shadow 0.12s, background 0.12s",
      }}>
        <span style={{ fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: accent ? "var(--gold-deep)" : "var(--ink-4)" }}>
          {label}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: accent ? "var(--gold-deep)" : "var(--ink)", display: "flex", alignItems: "center", gap: 4 }}>
          {displayValue}<span style={{ color: "var(--ink-4)", fontSize: 10, marginInlineStart: 1 }}>▾</span>
        </span>
      </div>

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 500 }} onClick={close} />
          <div style={{
            position: "fixed", top: pos.top, left: pos.left, minWidth: pos.minW,
            zIndex: 501, background: "var(--bg-ivory)", border: "1px solid var(--line-strong)",
            borderRadius: "var(--r-md)", boxShadow: "var(--shadow-3)", overflow: "hidden",
          }}>
            {opts.map(o => (
              <div key={o.value}
                onClick={() => { onSelect(o.value); close(); }}
                style={{
                  padding: "9px 14px", cursor: "pointer", fontSize: 13,
                  display: "flex", alignItems: "center", gap: 10,
                  background: o.value === value ? "color-mix(in srgb,var(--gold) 8%,transparent)" : "transparent",
                  color: o.value === value ? "var(--gold-deep)" : "var(--ink)",
                  fontWeight: o.value === value ? 600 : 400,
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = o.value === value ? "color-mix(in srgb,var(--gold) 12%,transparent)" : "var(--bg-inset)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = o.value === value ? "color-mix(in srgb,var(--gold) 8%,transparent)" : "transparent"; }}
              >
                {o.value === value ? <IcCheck /> : <span style={{ width: 14, display: "inline-block" }} />}
                {o.label}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ─── FinanceSnapshotBar ─────────────────────────────────────────────── */

function FinanceSnapshotBar({ filter, onChange, ledgerCount }: {
  filter: FinanceFilter;
  onChange: (f: FinanceFilter) => void;
  ledgerCount: number;
}) {
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const active = isFinanceFilterActive(filter);
  const activeCount = [filter.period !== "may", filter.agent !== "all", filter.category !== "all"].filter(Boolean).length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isMob ? "8px 12px" : "10px 28px", background: "var(--bg-cream)", borderBottom: "1px solid var(--line-soft)", overflowX: "auto", flexShrink: 0, WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>

      <FinanceFilterPill
        label="Period"
        displayValue={periodLabel(filter.period)}
        value={filter.period}
        isActive={filter.period !== "may"}
        opts={PERIOD_OPTS}
        onSelect={v => onChange({ ...filter, period: v as FinanceFilter["period"] })}
      />

      <FinanceFilterPill
        label="Agent"
        displayValue={filter.agent === "all" ? "All agents" : (AGENT_OPTS.find(o => o.value === filter.agent)?.label ?? filter.agent)}
        value={filter.agent}
        isActive={filter.agent !== "all"}
        opts={AGENT_OPTS}
        onSelect={v => onChange({ ...filter, agent: v as FinanceFilter["agent"] })}
      />

      <FinanceFilterPill
        label="Category"
        displayValue={filter.category === "all" ? "All" : (CATEGORY_OPTS.find(o => o.value === filter.category)?.label ?? filter.category)}
        value={filter.category}
        isActive={filter.category !== "all"}
        opts={CATEGORY_OPTS}
        onSelect={v => onChange({ ...filter, category: v as FinanceFilter["category"] })}
      />

      {active && (
        <button onClick={() => onChange(DEFAULT_FINANCE_FILTER)}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontFamily: "Roboto, sans-serif", cursor: "pointer", border: "1px solid rgba(220,50,50,0.4)", background: "var(--bg-paper)", color: "var(--rose)", whiteSpace: "nowrap", flexShrink: 0 }}>
          Reset
          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "var(--rose)", color: "#fff" }}>{activeCount}</span>
        </button>
      )}

      {!isMob && (
        <div style={{ marginInlineStart: "auto", fontSize: 11, color: "var(--ink-4)", whiteSpace: "nowrap" }} className="tnum">
          {ledgerCount} transactions · {periodLabel(filter.period)}
        </div>
      )}
    </div>
  );
}

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
        <text key={i} x={i * step} y={h + 14} fill="var(--ink-4)" fontSize="9" letterSpacing="1" textAnchor="middle" fontFamily="Roboto">{m}</text>
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

const LEDGER_ENTRIES: { d: string; type: "in" | "out"; ref: string; a: number; cat: FinanceFilter["category"] }[] = [
  { d: "23 May", type: "in",  ref: "Sale C-1280 · escrow release",  a:  1120000, cat: "sale" },
  { d: "22 May", type: "out", ref: "Commission · Yasmine K.",        a:   -94000, cat: "sale" },
  { d: "21 May", type: "in",  ref: "Rent · JBR Sadaf #2206",         a:    18333, cat: "rent" },
  { d: "21 May", type: "out", ref: "Marketing · Bayut featured",     a:    -8400, cat: "sale" },
  { d: "20 May", type: "in",  ref: "Sale C-1278 · deposit (10%)",    a:   840000, cat: "sale" },
  { d: "19 May", type: "in",  ref: "GV processing · Mr. Bin Saud",   a:    22500, cat: "gv"   },
];

export function ScreenFinance() {
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isCompact = bp !== "desktop";

  const [filter, setFilter] = useState<FinanceFilter>(DEFAULT_FINANCE_FILTER);

  const filteredLedger = filter.category === "all"
    ? LEDGER_ENTRIES
    : LEDGER_ENTRIES.filter(e => e.cat === filter.category);

  const pLabel = periodLabel(filter.period);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_finance}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost">{pLabel} ▾</button>}
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcDownload />&nbsp;{t.export_btn} PDF</button>}
        <button className="sgi-btn sgi-btn-primary">{t.close_month}</button>
      </Topbar>

      <FinanceSnapshotBar filter={filter} onChange={setFilter} ledgerCount={filteredLedger.length} />

      <main style={{ flex: 1, padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 18, background: "var(--bg-cream)", overflow: "auto" }}>
        {/* Hero KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.4fr 1fr 1fr", gap: 18 }}>
          <div className="sgi-card-elevated" style={{ padding: 26 }}>
            <Eyebrow>Closed volume · {pLabel}</Eyebrow>
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
                { rank: 3, init: "RM", name: "Reem M. Faisal", deals: 3, vol: 5.6,  mom: "-4%"  },
                { rank: 4, init: "AH", name: "Adel Habib",     deals: 2, vol: 3.2,  mom: "+8%"  },
                { rank: 5, init: "NK", name: "Nadia Khoury",   deals: 1, vol: 1.8,  mom: "—"    },
              ].filter(a => filter.agent === "all" || a.init === filter.agent).map((a) => {
                const isHighlighted = filter.agent !== "all" && a.init === filter.agent;
                return (
                <div key={a.rank} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: a.rank > 1 ? "1px solid var(--line-soft)" : "none", background: isHighlighted ? "var(--gold-ghost)" : "transparent", borderRadius: isHighlighted ? "var(--r)" : 0, paddingInline: isHighlighted ? 8 : 0, marginInline: isHighlighted ? -8 : 0 }}>
                  <div className="font-display tnum" style={{ fontSize: 17, color: a.rank === 1 ? "var(--gold-deep)" : "var(--ink-4)", width: 20 }}>{a.rank}</div>
                  <div style={{ width: 32, height: 32, borderRadius: 16, background: isHighlighted ? "var(--gold-deep)" : "var(--ink)", color: "var(--gold)", display: "grid", placeItems: "center", fontFamily: "'Roboto', sans-serif", fontSize: 13, fontWeight: 600 }}>{a.init}</div>
                  <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: isHighlighted ? 700 : 500, color: isHighlighted ? "var(--gold-deep)" : "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{a.deals} deals · {a.mom}</div>
                  </div>
                  <div className="font-display tnum" style={{ fontSize: 16, color: isHighlighted ? "var(--gold-deep)" : "var(--ink)" }}>{a.vol}M</div>
                </div>
                );
              })}
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
              <Chip tone="gold">{filteredLedger.length} entries</Chip>
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column" }}>
              {filteredLedger.length === 0 ? (
                <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12, color: "var(--ink-4)" }}>No transactions for this category</div>
              ) : filteredLedger.map((tx, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? "1px solid var(--line-soft)" : "none", fontSize: 12 }}>
                  <span className="font-mono" style={{ width: 48, color: "var(--ink-4)", fontSize: 10.5 }}>{tx.d}</span>
                  <span style={{ width: 22, height: 22, borderRadius: 11, background: tx.type === "in" ? "var(--emerald-soft)" : "var(--rose-soft)", color: tx.type === "in" ? "var(--emerald)" : "var(--rose)", display: "grid", placeItems: "center" }}>
                    {tx.type === "in" ? <IcArrowDown /> : <IcArrowUp />}
                  </span>
                  <span style={{ flex: 1, color: "var(--ink-2)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tx.ref}</span>
                  <span className="tnum" style={{ color: tx.a < 0 ? "var(--rose)" : "var(--ink)", fontWeight: 500 }}>
                    {tx.a < 0 ? "−" : "+"} AED {Math.abs(tx.a).toLocaleString()}
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
