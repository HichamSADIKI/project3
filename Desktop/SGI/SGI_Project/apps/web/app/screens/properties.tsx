"use client";
import React, { useState, useRef } from "react";
import { useBreakpoint } from "@/lib/hooks";
import {
  Topbar, Eyebrow, Chip, StatusDot, PropertyImage, fmtAED,
  IcFilter, IcDownload, IcPlus, IcChevD, IcChevR, IcChevL, IcMore,
  IcList, IcGrid, IcMap, IcBed, IcBath, IcArea, IcMail, IcCheck,
} from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";

// ─── Data ────────────────────────────────────────────────────────────────────

type Prop = {
  ref: string; t: string; area: string;
  bd: number; ba: number; sqft: number; price: number;
  type: "Sale" | "Rent";
  state: "available" | "offer" | "sold" | "rented";
  tag: string; img: number;
  imgUrls?: string[];
  propType: string;
  emirate: string;
  floor: number; parking: number;
  agent: string; agentPhone: string;
  desc: string;
};

const PROPERTIES: Prop[] = [
  {
    ref: "INF-2418", t: "Marina Gate · Tower 2 #4502",    area: "Dubai Marina",          bd: 3, ba: 4, sqft: 2150, price: 4750000,
    type: "Sale",  state: "available", tag: "Golden Visa", img: 1, propType: "apartment", emirate: "Dubai",
    floor: 45, parking: 2, agent: "Yasmine Khalil", agentPhone: "+971 50 123 4567",
    desc: "Spectacular full-marina view from this fully upgraded 3-bedroom. Open-plan kitchen, floor-to-ceiling glazing, private balcony. DLD transfer ready. Mortgage pre-approved.",
  },
  {
    ref: "INF-2417", t: "Bluewaters Residences B12",      area: "Bluewaters Island",     bd: 4, ba: 5, sqft: 3200, price: 12500000,
    type: "Sale",  state: "offer",     tag: "Premium",    img: 2, propType: "apartment", emirate: "Dubai",
    floor: 12, parking: 2, agent: "Omar Rashid",    agentPhone: "+971 55 987 6543",
    desc: "Rare corner unit facing Ain Dubai and the open sea. Bespoke Miele kitchen, Italian marble throughout, private pool access. Under offer — viewings by appointment only.",
  },
  {
    ref: "INF-2416", t: "Palm Jumeirah · Shoreline #1202", area: "Palm Jumeirah",        bd: 2, ba: 3, sqft: 1820, price: 350000,
    type: "Rent",  state: "available", tag: "Yearly",     img: 3, propType: "apartment", emirate: "Dubai",
    floor: 12, parking: 1, agent: "Sara Mansouri",  agentPhone: "+971 52 456 7890",
    desc: "Bright 2-bed with partial sea view on the West Crescent. Fully furnished. 4 cheques accepted. Beach access, pool, gym included.",
  },
  {
    ref: "INF-2415", t: "Downtown · Burj Vista T1 #3401", area: "Downtown Dubai",        bd: 1, ba: 2, sqft: 980,  price: 2100000,
    type: "Sale",  state: "available", tag: "—",          img: 4, propType: "apartment", emirate: "Dubai",
    floor: 34, parking: 1, agent: "Yasmine Khalil", agentPhone: "+971 50 123 4567",
    desc: "Clean 1-bedroom in the iconic Burj Vista with Burj Khalifa view. No agents. Direct from owner. Service charge settled for 2026.",
  },
  {
    ref: "INF-2414", t: "Saadiyat Beach Villa 32",        area: "Abu Dhabi · Saadiyat",  bd: 5, ba: 6, sqft: 5600, price: 28000000,
    type: "Sale",  state: "available", tag: "Golden Visa", img: 5, propType: "villa",    emirate: "Abu Dhabi",
    floor: 1,  parking: 4, agent: "Omar Rashid",    agentPhone: "+971 55 987 6543",
    desc: "Beachfront ultra-luxury villa — 5 en-suite bedrooms, private infinity pool, home cinema, 4-car garage. ADGM-registered. Price negotiable for cash buyers.",
  },
  {
    ref: "INF-2413", t: "JBR · Sadaf 5 #2206",           area: "JBR · Marina",          bd: 2, ba: 2, sqft: 1340, price: 220000,
    type: "Rent",  state: "rented",    tag: "Yearly",     img: 6, propType: "apartment", emirate: "Dubai",
    floor: 22, parking: 1, agent: "Sara Mansouri",  agentPhone: "+971 52 456 7890",
    desc: "Walk-to-beach 2-bed. Currently occupied — available for renewal Apr 2027. Previous tenant 4 years. Excellent rental yield: 5.8 %.",
  },
];

// ─── Filter system ────────────────────────────────────────────────────────────

type FilterState = {
  listing:    "all" | "Sale" | "Rent";
  emirate:    "all" | "Dubai" | "Abu Dhabi" | "Sharjah" | "Other";
  propType:   "all" | string;
  bedsMin:    number;
  bedsMax:    number;
  priceRange: "all" | "u500k" | "500k-1m" | "1m-3m" | "3m-7m" | "7m-15m" | "o15m";
  goldenVisa: boolean;
  agent:      "all" | string;
  sortBy:     "newest" | "price_asc" | "price_desc" | "sqft_desc";
};

const DEFAULT_FILTER: FilterState = {
  listing: "all", emirate: "all", propType: "all",
  bedsMin: 0, bedsMax: 0, priceRange: "all",
  goldenVisa: false, agent: "all", sortBy: "newest",
};

const PRICE_RANGES: Record<string, [number, number]> = {
  "all":     [0, 0],
  "u500k":   [0, 500_000],
  "500k-1m": [500_000, 1_000_000],
  "1m-3m":   [1_000_000, 3_000_000],
  "3m-7m":   [3_000_000, 7_000_000],
  "7m-15m":  [7_000_000, 15_000_000],
  "o15m":    [15_000_000, 0],
};

function activeFilterCount(f: FilterState): number {
  return [
    f.listing !== "all", f.emirate !== "all", f.propType !== "all",
    f.bedsMin > 0 || f.bedsMax > 0, f.priceRange !== "all",
    f.goldenVisa, f.agent !== "all",
  ].filter(Boolean).length;
}

function applyFilters(props: Prop[], f: FilterState, stateFilter: string): Prop[] {
  const [pMin, pMax] = PRICE_RANGES[f.priceRange] ?? [0, 0];
  return props
    .filter(p => {
      if (stateFilter !== "all") {
        const ok = p.state === stateFilter || (stateFilter === "sold" && (p.state === "sold" || p.state === "rented"));
        if (!ok) return false;
      }
      if (f.listing !== "all" && p.type !== f.listing)                              return false;
      if (f.emirate !== "all" && p.emirate !== f.emirate)                           return false;
      if (f.propType !== "all" && p.propType !== f.propType)                        return false;
      if (f.bedsMin > 0 && p.bd < f.bedsMin)                                       return false;
      if (f.bedsMax > 0 && p.bd > f.bedsMax)                                       return false;
      if (pMin > 0 && p.price < pMin)                                               return false;
      if (pMax > 0 && p.price > pMax)                                               return false;
      if (f.goldenVisa && !(p.type === "Sale" && p.price >= 2_000_000))             return false;
      if (f.agent !== "all" && p.agent !== f.agent)                                 return false;
      return true;
    })
    .sort((a, b) => {
      if (f.sortBy === "price_asc")  return a.price - b.price;
      if (f.sortBy === "price_desc") return b.price - a.price;
      if (f.sortBy === "sqft_desc")  return b.sqft - a.sqft;
      return 0;
    });
}

const AGENT_PHONES: Record<string, string> = {
  "Yasmine Khalil": "+971 50 123 4567",
  "Omar Rashid":    "+971 55 987 6543",
  "Sara Mansouri":  "+971 52 456 7890",
};

const STATE_MAP = {
  available: { en: "Available", ar: "متاح",     fr: "Disponible",   c: "var(--emerald)", tone: "emerald" as const },
  offer:     { en: "Under Offer",ar: "عرض مقدم", fr: "Sous Offre",   c: "var(--gold)",    tone: "gold"    as const },
  sold:      { en: "Sold",      ar: "مُباع",     fr: "Vendu",        c: "var(--rose)",    tone: "rose"    as const },
  rented:    { en: "Rented",    ar: "مؤجَّر",    fr: "Loué",         c: "var(--azure)",   tone: "azure"   as const },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function isSafeImgUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:") return false;
    // Reject localhost / private IP ranges
    if (/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(hostname)) return false;
    return true;
  } catch { return false; }
}

function PropImg({ p, style }: { p: Prop; style?: React.CSSProperties }) {
  const safeUrl = p.imgUrls?.find(isSafeImgUrl);
  if (safeUrl) {
    return (
      <img
        src={safeUrl}
        alt={p.t}
        referrerPolicy="no-referrer"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", ...style }}
      />
    );
  }
  return <PropertyImage variant={p.img} />;
}

// ─── Generic filter pill with fixed-position dropdown ────────────────────────

type FilterOpt = { label: string; value: string };

function FilterPill({
  label, displayValue, value, opts, isActive, gold, onSelect, renderMenu,
}: {
  label: string; displayValue: string; value?: string;
  opts?: FilterOpt[]; isActive?: boolean; gold?: boolean;
  onSelect?: (v: string) => void;
  renderMenu?: (close: () => void) => React.ReactNode;
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

  const active = isActive ?? false;
  const accent = gold || active;

  return (
    <>
      <div ref={ref} onClick={toggle} style={{
        display: "flex", flexDirection: "column", gap: 1, padding: "6px 12px",
        background: accent ? "var(--gold-ghost)" : "var(--bg-ivory)",
        border: `1px solid ${accent ? "var(--gold-line)" : "var(--line-soft)"}`,
        borderRadius: "var(--r)", cursor: "pointer", minWidth: 100, flexShrink: 0,
        boxShadow: accent ? "0 0 0 2px color-mix(in srgb,var(--gold) 18%,transparent)" : "none",
        transition: "box-shadow 0.12s, background 0.12s",
      }}>
        <span style={{ fontSize: 9.5, letterSpacing: "0.14em", textTransform: "uppercase", color: accent ? "var(--gold-deep)" : "var(--ink-4)" }}>
          {label}
        </span>
        <span style={{ fontSize: 12.5, fontWeight: 500, color: accent ? "var(--gold-deep)" : "var(--ink)", display: "flex", alignItems: "center", gap: 5 }}>
          {displayValue}<span style={{ color: "var(--ink-4)", fontSize: 10, marginInlineStart: 1 }}><IcChevD /></span>
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
            {renderMenu
              ? renderMenu(close)
              : opts?.map(o => (
                <div key={o.value}
                  onClick={() => { onSelect?.(o.value); close(); }}
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
              ))
            }
          </div>
        </>
      )}
    </>
  );
}

// ─── Bedrooms range picker ────────────────────────────────────────────────────

const BED_OPTS = [
  { label: "Studio", bd: 0 }, { label: "1", bd: 1 }, { label: "2", bd: 2 },
  { label: "3", bd: 3 },      { label: "4", bd: 4 }, { label: "5+", bd: 5 },
];

function BedsPicker({
  bedsMin, bedsMax, onChange, close,
}: { bedsMin: number; bedsMax: number; onChange: (min: number, max: number) => void; close: () => void }) {
  function pick(bd: number) {
    if (bedsMin === 0 && bedsMax === 0) { onChange(bd, bd === 5 ? 99 : bd); return; }
    if (bd < bedsMin || (bedsMin === 0)) { onChange(bd, bd === 5 ? 99 : Math.max(bd, bedsMax)); return; }
    if (bd > (bedsMax === 99 ? 5 : bedsMax)) { onChange(bedsMin, bd === 5 ? 99 : bd); return; }
    onChange(0, 0); // reset
  }
  function inRange(bd: number) {
    if (bedsMin === 0 && bedsMax === 0) return false;
    const hi = bedsMax === 99 ? 99 : bedsMax;
    return bd >= bedsMin && bd <= hi;
  }
  return (
    <div style={{ padding: 14 }}>
      <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--ink-4)", textTransform: "uppercase", marginBottom: 10 }}>Bedrooms</div>
      <div style={{ display: "flex", gap: 6 }}>
        {BED_OPTS.map(o => (
          <button key={o.bd} type="button" onClick={() => pick(o.bd)} style={{
            width: 40, height: 36, borderRadius: "var(--r)", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
            border: "1.5px solid " + (inRange(o.bd) ? "var(--gold)" : "var(--line-soft)"),
            background: inRange(o.bd) ? "var(--gold-ghost)" : "var(--bg-paper)",
            color: inRange(o.bd) ? "var(--gold-deep)" : "var(--ink)",
          }}>{o.label}</button>
        ))}
      </div>
      {(bedsMin > 0 || bedsMax > 0) && (
        <button type="button" onClick={() => { onChange(0, 0); close(); }}
          style={{ marginTop: 10, width: "100%", padding: "6px 0", fontSize: 11.5, background: "none", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", cursor: "pointer", color: "var(--ink-3)" }}>
          Reset
        </button>
      )}
    </div>
  );
}

// ─── Price range picker ───────────────────────────────────────────────────────

const PRICE_OPTS: FilterOpt[] = [
  { label: "All prices",        value: "all" },
  { label: "Under AED 500K",    value: "u500k" },
  { label: "AED 500K – 1M",    value: "500k-1m" },
  { label: "AED 1M – 3M",      value: "1m-3m" },
  { label: "AED 3M – 7M",      value: "3m-7m" },
  { label: "AED 7M – 15M",     value: "7m-15m" },
  { label: "Over AED 15M",      value: "o15m" },
];

function ViewBtn({ children, active, onClick }: { children: React.ReactNode; active?: boolean; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center",
      padding: "6px 10px", borderRadius: 6,
      background: active ? "var(--bg-ivory)" : "transparent",
      color: active ? "var(--ink)" : "var(--ink-3)",
      border: "none", cursor: "pointer",
      boxShadow: active ? "var(--shadow-1)" : "none",
    }}>{children}</button>
  );
}

function PropertyHoverCard({ p, x, y }: { p: Prop; x: number; y: number }) {
  const W = 284;
  const left = Math.min(x + 20, window.innerWidth - W - 16);
  const top = Math.max(8, Math.min(y - 80, window.innerHeight - 380));
  return (
    <div style={{
      position: "fixed", left, top, width: W, zIndex: 9999,
      background: "var(--bg-ivory)", border: "1px solid var(--line-strong)",
      borderRadius: "var(--r-md)", boxShadow: "var(--shadow-3)", overflow: "hidden", pointerEvents: "none",
    }}>
      <div style={{ height: 160, position: "relative" }}>
        <PropImg p={p} />
        <div style={{ position: "absolute", top: 8, insetInlineStart: 8, display: "flex", gap: 6 }}>
          <Chip tone={p.type === "Sale" ? "gold" : "azure"}>{p.type}</Chip>
          {p.tag !== "—" && <Chip tone="gold">{p.tag}</Chip>}
        </div>
      </div>
      <div style={{ padding: 16 }}>
        <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--ink-4)", textTransform: "uppercase" }}>{p.ref} · {p.area}</div>
        <div className="font-display" style={{ fontSize: 17, color: "var(--ink)", marginTop: 4, lineHeight: 1.2 }}>{p.t}</div>
        <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink-3)", marginTop: 10 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><IcBed /><span className="tnum">{p.bd}</span> bd</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><IcBath /><span className="tnum">{p.ba}</span> ba</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><IcArea /><span className="tnum">{p.sqft.toLocaleString()}</span> ft²</span>
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line-soft)", display: "flex", alignItems: "baseline", gap: 8 }}>
          <span className="font-display tnum" style={{ fontSize: 24, color: "var(--gold-deep)" }}>{fmtAED(p.price)}</span>
          {p.type === "Rent" && <span style={{ fontSize: 11, color: "var(--ink-4)" }}>/ year</span>}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-4)" }}>
          {Math.round(p.price / p.sqft).toLocaleString()} AED / ft²
        </div>
      </div>
    </div>
  );
}

// ─── List view row ────────────────────────────────────────────────────────────

function PropertyRow({ p, highlighted, selected, isMob, onSelect }: {
  p: Prop; highlighted?: boolean; selected?: boolean; isMob?: boolean; onSelect: () => void;
}) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const imgW = isMob ? 96 : 140;
  const imgH = isMob ? 76 : 110;
  const st = STATE_MAP[p.state];
  return (
    <div onClick={onSelect} style={{
      display: "flex", gap: 16, padding: 14,
      background: selected ? "var(--gold-ghost)" : highlighted ? "color-mix(in srgb, var(--bg-inset) 60%, transparent)" : "transparent",
      borderBottom: "1px solid var(--line-soft)", cursor: "pointer", position: "relative",
      outline: selected ? "2px solid var(--gold-line)" : "none",
    }}>
      {selected && <div style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 2, background: "var(--gold)" }} />}
      <div
        style={{ width: imgW, height: imgH, flexShrink: 0, borderRadius: "var(--r)", overflow: "hidden", position: "relative" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseMove={e => setPos({ x: e.clientX, y: e.clientY })}
      >
        <PropImg p={p} />
        <div style={{ position: "absolute", top: 6, insetInlineStart: 6 }}>
          <Chip tone={p.type === "Sale" ? "gold" : "azure"}>{p.type}</Chip>
        </div>
        <div style={{ position: "absolute", bottom: 6, insetInlineEnd: 6 }}>
          <Chip tone={st.tone}><StatusDot tone={st.tone} />&nbsp;{st.en}</Chip>
        </div>
      </div>
      {hover && !isMob && <PropertyHoverCard p={p} x={pos.x} y={pos.y} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{p.ref} · {p.area}</div>
          {p.tag !== "—" && !isMob && <Chip tone="gold">{p.tag}</Chip>}
        </div>
        <div className="font-display" style={{ fontSize: isMob ? 15 : 19, color: "var(--ink)", lineHeight: 1.15 }}>{p.t}</div>
        {!isMob && (
          <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><IcBed /><span className="tnum">{p.bd}</span> bd</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><IcBath /><span className="tnum">{p.ba}</span> ba</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5 }}><IcArea /><span className="tnum">{p.sqft.toLocaleString()}</span> ft²</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
          <div>
            <span className="font-display tnum" style={{ fontSize: isMob ? 16 : 22, color: "var(--ink)" }}>{fmtAED(p.price)}</span>
            {p.type === "Rent" && <span style={{ fontSize: 11, color: "var(--ink-4)", marginInlineStart: 4 }}>/ yr</span>}
          </div>
          {!isMob && (
            <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
              {Math.round(p.price / p.sqft).toLocaleString()} AED / ft²
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Grid view card ──────────────────────────────────────────────────────────

function PropertyCard({ p, selected, onSelect }: { p: Prop; selected?: boolean; onSelect: () => void }) {
  const st = STATE_MAP[p.state];
  return (
    <div onClick={onSelect} style={{
      background: "var(--bg-ivory)", border: "1.5px solid " + (selected ? "var(--gold)" : "var(--line-soft)"),
      borderRadius: "var(--r-md)", overflow: "hidden", cursor: "pointer",
      boxShadow: selected ? "0 0 0 3px var(--gold-ghost)" : "var(--shadow-1)",
      display: "flex", flexDirection: "column",
      transition: "box-shadow 0.15s ease, border-color 0.15s ease",
    }}>
      <div style={{ height: 160, position: "relative", flexShrink: 0 }}>
        <PropImg p={p} />
        <div style={{ position: "absolute", top: 8, insetInlineStart: 8, display: "flex", gap: 5 }}>
          <Chip tone={p.type === "Sale" ? "gold" : "azure"}>{p.type}</Chip>
          {p.tag !== "—" && <Chip tone="gold">{p.tag}</Chip>}
        </div>
        <div style={{ position: "absolute", top: 8, insetInlineEnd: 8 }}>
          <Chip tone={st.tone}><StatusDot tone={st.tone} /></Chip>
        </div>
      </div>
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ fontSize: 9.5, letterSpacing: "0.14em", color: "var(--ink-4)", textTransform: "uppercase" }}>{p.ref} · {p.area}</div>
        <div className="font-display" style={{ fontSize: 15, color: "var(--ink)", lineHeight: 1.2 }}>{p.t}</div>
        <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "var(--ink-3)", marginTop: 4 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><IcBed /><span className="tnum">{p.bd}</span></span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><IcBath /><span className="tnum">{p.ba}</span></span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><IcArea /><span className="tnum">{p.sqft.toLocaleString()}</span> ft²</span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <span className="font-display tnum" style={{ fontSize: 18, color: "var(--gold-deep)" }}>{fmtAED(p.price)}</span>
            {p.type === "Rent" && <span style={{ fontSize: 10, color: "var(--ink-4)", marginInlineStart: 3 }}>/ yr</span>}
          </div>
          <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{Math.round(p.price / p.sqft).toLocaleString()} / ft²</span>
        </div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{p.agent}</div>
      </div>
    </div>
  );
}

// ─── Map panel ────────────────────────────────────────────────────────────────

function MapPanel() {
  return (
    <div style={{ flex: 1, position: "relative", background: "var(--bg-inset)" }}>
      <svg viewBox="0 0 600 600" preserveAspectRatio="xMidYMid slice" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
        <defs>
          <pattern id="mapgrid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="var(--line)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="600" height="600" fill="var(--bg-inset)" />
        <rect width="600" height="600" fill="url(#mapgrid)" />
        <path d="M0 400 Q 80 380 140 410 T 280 420 T 440 380 T 600 360 L 600 600 L 0 600 Z" fill="var(--azure-soft)" opacity="0.7" />
        <path d="M0 400 Q 80 380 140 410 T 280 420 T 440 380 T 600 360" fill="none" stroke="var(--azure)" strokeWidth="1" opacity="0.4" />
        <path d="M0 200 L600 240" stroke="var(--line-strong)" strokeWidth="2.5" fill="none" opacity="0.5" />
        <path d="M0 320 L600 280" stroke="var(--line-strong)" strokeWidth="1.5" fill="none" opacity="0.5" />
        <path d="M150 0 L180 600" stroke="var(--line-strong)" strokeWidth="1.5" fill="none" opacity="0.5" />
        <path d="M380 0 L420 600" stroke="var(--line-strong)" strokeWidth="2" fill="none" opacity="0.5" />
        <text x="30"  y="160" fill="var(--ink-4)" fontSize="11" letterSpacing="2" fontFamily="Roboto">DUBAI MARINA</text>
        <text x="220" y="170" fill="var(--ink-4)" fontSize="11" letterSpacing="2" fontFamily="Roboto">DOWNTOWN</text>
        <text x="430" y="180" fill="var(--ink-4)" fontSize="11" letterSpacing="2" fontFamily="Roboto">CREEK</text>
        <text x="60"  y="500" fill="var(--azure)" fontSize="10" letterSpacing="2" fontFamily="Roboto" opacity="0.7">ARABIAN GULF</text>
      </svg>
      {[
        { x: 22, y: 35, n: "12", active: true },
        { x: 35, y: 28, n: "8" },
        { x: 50, y: 42, n: "24", gold: true },
        { x: 64, y: 30, n: "5" },
        { x: 75, y: 48, n: "3" },
        { x: 30, y: 56, n: "2" },
        { x: 82, y: 22, n: "6" },
      ].map((pin, i) => (
        <div key={i} style={{ position: "absolute", insetInlineStart: `${pin.x}%`, top: `${pin.y}%`, transform: "translate(-50%, -100%)" }}>
          <div style={{
            background: pin.active ? "var(--ink)" : (pin.gold ? "var(--gold)" : "var(--bg-ivory)"),
            color: pin.active ? "var(--gold)" : (pin.gold ? "#1A1610" : "var(--ink)"),
            border: "1.5px solid " + (pin.active ? "var(--gold)" : "var(--ink)"),
            borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600,
            boxShadow: "var(--shadow-2)", display: "flex", alignItems: "center", gap: 5,
          }}>
            {pin.gold && <span style={{ width: 5, height: 5, borderRadius: 3, background: "var(--ink)" }} />}
            {pin.n}
          </div>
          <div style={{ width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `6px solid ${pin.active ? "var(--gold)" : "var(--ink)"}`, margin: "0 auto" }} />
        </div>
      ))}
      <div style={{ position: "absolute", top: "15%", insetInlineStart: "8%", width: 240, background: "var(--bg-ivory)", border: "1px solid var(--line-strong)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-3)", overflow: "hidden" }}>
        <div style={{ height: 90, position: "relative" }}>
          <PropertyImage variant={2} />
          <span style={{ position: "absolute", top: 8, insetInlineStart: 8 }}><Chip tone="gold">Bluewaters</Chip></span>
        </div>
        <div style={{ padding: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--ink-4)" }}>INF-2417 · 4BR</div>
          <div className="font-display" style={{ fontSize: 15, marginTop: 2 }}>Bluewaters Residences</div>
          <div className="font-display tnum" style={{ fontSize: 18, color: "var(--gold-deep)", marginTop: 4 }}>AED 12,500,000</div>
          <button className="sgi-btn sgi-btn-ghost" style={{ height: 30, padding: "0 10px", marginTop: 8, fontSize: 11.5, width: "100%", justifyContent: "center" }}>
            View full detail <IcChevR />
          </button>
        </div>
      </div>
      <div style={{ position: "absolute", top: 14, insetInlineEnd: 14, display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="sgi-btn sgi-btn-ghost" style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}>+</button>
        <button className="sgi-btn sgi-btn-ghost" style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}>−</button>
      </div>
      <div style={{ position: "absolute", bottom: 14, insetInlineStart: 14, padding: "8px 12px", background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", display: "flex", gap: 12, fontSize: 11, color: "var(--ink-3)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: "var(--gold)", borderRadius: 4 }} />Golden Visa</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: "var(--ink)", borderRadius: 4 }} />Sale</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: "var(--azure)", borderRadius: 4 }} />Rent</span>
      </div>
    </div>
  );
}

// ─── Detail aside panel ──────────────────────────────────────────────────────

function DetailPanel({ p }: { p: Prop }) {
  const st = STATE_MAP[p.state];
  return (
    <aside className="sgi-card-elevated" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: 18, borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", background: "var(--bg-paper)" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
            <Chip tone={p.type === "Sale" ? "gold" : "azure"}>{p.type}</Chip>
            <Chip tone={st.tone}><StatusDot tone={st.tone} />&nbsp;{st.en}</Chip>
            {p.tag !== "—" && <Chip tone="gold">{p.tag}</Chip>}
          </div>
          <div className="font-display" style={{ fontSize: 18, marginTop: 6, lineHeight: 1.2 }}>{p.t}</div>
          <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3 }}>{p.area} · {p.ref}</div>
        </div>
        <button className="sgi-btn sgi-btn-ghost" style={{ height: 32, padding: "0 10px", flexShrink: 0 }}><IcMore /></button>
      </div>

      <div style={{ flex: 1, overflow: "auto", background: "var(--bg-cream)" }}>
        {/* Photo */}
        <div style={{ height: 180, position: "relative" }}>
          <PropImg p={p} />
          <div style={{ position: "absolute", bottom: 8, insetInlineEnd: 8 }}>
            <button className="sgi-btn sgi-btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 11, background: "var(--bg-ivory)" }}>
              All photos
            </button>
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {/* Price block */}
          <div style={{ padding: "14px 16px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 6, marginBottom: 16 }}>
            <Eyebrow>{p.type === "Sale" ? "Asking price" : "Annual rent"}</Eyebrow>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 4 }}>
              <span className="font-display tnum" style={{ fontSize: 28, color: "var(--gold-deep)" }}>{fmtAED(p.price)}</span>
              {p.type === "Rent" && <span style={{ fontSize: 12, color: "var(--ink-4)" }}>/ year</span>}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
              {Math.round(p.price / p.sqft).toLocaleString()} AED / ft² · {p.type === "Sale" ? "4% DLD + 2% commission" : "Cheques negotiable"}
            </div>
          </div>

          {/* Specs grid */}
          <div style={{ marginBottom: 16 }}>
            <Eyebrow style={{ marginBottom: 8 }}>Specifications</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              {[
                ["Bedrooms",  p.bd + " BR"],
                ["Bathrooms", p.ba + " BA"],
                ["Area",      p.sqft.toLocaleString() + " ft²"],
                ["Floor",     p.floor > 1 ? p.floor + "th" : "Ground"],
                ["Parking",   p.parking + " space" + (p.parking > 1 ? "s" : "")],
                ["Year",      "2024"],
              ].map(([l, v]) => (
                <div key={l} style={{ padding: "8px 10px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 4 }}>
                  <div className="eyebrow">{l}</div>
                  <div className="tnum" style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: 16 }}>
            <Eyebrow style={{ marginBottom: 6 }}>Description</Eyebrow>
            <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.65, padding: "12px 14px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 6 }}>
              {p.desc}
            </div>
          </div>

          {/* Agent card */}
          <div style={{ marginBottom: 16, padding: "12px 14px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 6 }}>
            <Eyebrow style={{ marginBottom: 8 }}>Listing agent</Eyebrow>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)" }}>{p.agent}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 1 }}>{p.agentPhone}</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="sgi-btn sgi-btn-ghost" style={{ height: 30, padding: "0 10px" }}><IcMail /></button>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <button className="sgi-btn sgi-btn-ghost" style={{ justifyContent: "center", height: 36 }}><IcDownload />&nbsp;PDF</button>
            <button className="sgi-btn sgi-btn-ghost" style={{ justifyContent: "center", height: 36 }}><IcMail />&nbsp;Share</button>
            <button className="sgi-btn sgi-btn-primary" style={{ justifyContent: "center", height: 36 }}>
              {p.type === "Sale" ? "Make offer" : "Schedule visit"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ─── Scraping ────────────────────────────────────────────────────────────────

type ScrapeStatus = "idle" | "loading" | "done" | "error";

type ScrapedProperty = {
  titleEn: string;
  price: string;
  type: "Sale" | "Rent";
  propType: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  emirate: string;
  community: string;
  desc: string;
  images: string[];
  source: string;
  fieldsFound: number;
};

const SITE_MOCKS: Record<string, () => ScrapedProperty> = {
  bayut: () => ({
    titleEn: "Luxurious 2BR | Sea View | High Floor | Marina Gate T2",
    price: "1850000",
    type: "Sale", propType: "apartment",
    bedrooms: "2", bathrooms: "2", sqft: "1240",
    emirate: "Dubai", community: "Dubai Marina",
    desc: "A stunning 2-bedroom apartment in Marina Gate Tower 2. Panoramic sea views, high-end finishes, fully equipped kitchen and built-in wardrobes. Access to world-class amenities including infinity pool, gym and concierge.",
    images: ["bayut-img-1.webp", "bayut-img-2.webp", "bayut-img-3.webp", "bayut-img-4.webp"],
    source: "Bayut.com", fieldsFound: 8,
  }),
  propertyfinder: () => ({
    titleEn: "Stunning 3BR Villa | Private Pool | Gated Community | Arabian Ranches",
    price: "4500000",
    type: "Sale", propType: "villa",
    bedrooms: "3", bathrooms: "4", sqft: "3200",
    emirate: "Dubai", community: "Arabian Ranches",
    desc: "Beautifully landscaped 3-bedroom villa with private pool, double garage and mature garden in the prestigious Arabian Ranches community. Corner plot, extended patio, smart home system.",
    images: ["pf-img-1.jpg", "pf-img-2.jpg", "pf-img-3.jpg"],
    source: "PropertyFinder.ae", fieldsFound: 9,
  }),
  dubizzle: () => ({
    titleEn: "1BR Apartment | Fully Furnished | Bills Included | Downtown Dubai",
    price: "95000",
    type: "Rent", propType: "apartment",
    bedrooms: "1", bathrooms: "1", sqft: "750",
    emirate: "Dubai", community: "Downtown Dubai",
    desc: "Fully furnished 1-bedroom apartment in the heart of Downtown Dubai. All bills included, gym and pool access, walking distance to Dubai Mall and Burj Khalifa.",
    images: ["dub-img-1.jpg"],
    source: "Dubizzle.com", fieldsFound: 7,
  }),
};

async function scrapePropertyFromUrl(url: string): Promise<ScrapedProperty> {
  // Attempt real backend API — falls back to demo mock if unavailable
  try {
    const res = await fetch("/api/v1/scraping/property", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(15000),
    });
    if (res.ok) {
      const raw = await res.json() as Record<string, unknown>;
      return {
        titleEn:     String(raw.title_en   ?? ""),
        price:       String(raw.price      ?? ""),
        type:        (raw.type as "Sale" | "Rent") ?? "Sale",
        propType:    String(raw.prop_type  ?? "apartment"),
        bedrooms:    String(raw.bedrooms   ?? ""),
        bathrooms:   String(raw.bathrooms  ?? ""),
        sqft:        String(raw.sqft       ?? ""),
        emirate:     String(raw.emirate    ?? ""),
        community:   String(raw.community  ?? ""),
        desc:        String(raw.description ?? ""),
        images:      Array.isArray(raw.images) ? raw.images as string[] : [],
        source:      String(raw.source     ?? ""),
        fieldsFound: Number(raw.fields_found ?? 0),
      };
    }
  } catch { /* backend not available yet — use demo data */ }

  // Demo mock: simulate network delay + site detection
  await new Promise(r => setTimeout(r, 1800));
  const { hostname } = new URL(url);
  if (hostname.includes("bayut"))          return SITE_MOCKS.bayut();
  if (hostname.includes("propertyfinder")) return SITE_MOCKS.propertyfinder();
  if (hostname.includes("dubizzle"))       return SITE_MOCKS.dubizzle();
  return {
    titleEn: "Property imported from external listing",
    price: "", type: "Sale", propType: "apartment",
    bedrooms: "2", bathrooms: "2", sqft: "",
    emirate: "Dubai", community: "",
    desc: "Imported from external listing. Please verify all details.",
    images: [], source: hostname, fieldsFound: 3,
  };
}

function ScrapePreview({ data, onApply, onDismiss }: {
  data: ScrapedProperty;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const priceNum = Number(data.price);
  const rows = [
    { icon: "🏠", label: "Title",    value: data.titleEn },
    { icon: "💰", label: "Price",    value: priceNum ? `AED ${priceNum.toLocaleString("en-AE")} · ${data.type}` : "—" },
    { icon: "🛏", label: "Rooms",    value: `${data.bedrooms} BR · ${data.bathrooms} BA` },
    { icon: "📐", label: "Area",     value: data.sqft ? `${Number(data.sqft).toLocaleString("en-AE")} ft²` : "—" },
    { icon: "📍", label: "Location", value: [data.community, data.emirate].filter(Boolean).join(", ") },
    { icon: "🏢", label: "Type",     value: data.propType.charAt(0).toUpperCase() + data.propType.slice(1) },
  ].filter(r => r.value && r.value !== "—");

  return (
    <div style={{ border: "1px solid var(--emerald)", borderRadius: "var(--r)", overflow: "hidden", background: "var(--bg-paper)" }}>
      {/* Header */}
      <div style={{ padding: "10px 14px", background: "rgba(16,185,129,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(16,185,129,0.2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "var(--emerald)", fontWeight: 600 }}>
          <IcCheck />
          {data.fieldsFound} champs extraits
          {data.images.length > 0 && <span style={{ fontWeight: 400 }}>· {data.images.length} photo{data.images.length > 1 ? "s" : ""}</span>}
          <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>depuis {data.source}</span>
        </div>
        <button type="button" onClick={onDismiss} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", fontSize: 18, lineHeight: 1, padding: 0 }}>×</button>
      </div>

      {/* Field mapping rows */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
        {rows.map(r => (
          <div key={r.label} style={{ display: "grid", gridTemplateColumns: "22px 84px 1fr", gap: 6, fontSize: 12, alignItems: "flex-start" }}>
            <span>{r.icon}</span>
            <span style={{ color: "var(--ink-4)" }}>{r.label}</span>
            <span style={{ color: "var(--ink)", fontWeight: 500, wordBreak: "break-word", lineHeight: 1.4 }}>{r.value}</span>
          </div>
        ))}

        {/* Image thumbnails — only render safe https:// URLs */}
        {data.images.filter(isSafeImgUrl).length > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {data.images.filter(isSafeImgUrl).slice(0, 5).map((url, i) => (
              <img key={i} src={url} referrerPolicy="no-referrer" alt=""
                style={{ width: 52, height: 40, borderRadius: 4, objectFit: "cover", border: "1px solid var(--line-soft)" }}
              />
            ))}
            {data.images.filter(isSafeImgUrl).length > 5 && (
              <div style={{ width: 52, height: 40, borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", fontSize: 11, color: "var(--ink-4)" }}>
                +{data.images.filter(isSafeImgUrl).length - 5}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "10px 14px", borderTop: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <button type="button" onClick={onDismiss} className="sgi-btn sgi-btn-ghost">Ignorer</button>
        <button type="button" onClick={onApply} className="sgi-btn sgi-btn-primary">
          <IcCheck />&nbsp;Remplir le formulaire →
        </button>
      </div>
    </div>
  );
}

// ─── Add Property Modal ──────────────────────────────────────────────────────

type PropForm = {
  type: "Sale" | "Rent";
  state: "available" | "offer";
  propType: string;
  emirate: string;
  community: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  floor: string;
  parking: string;
  price: string;
  cheques: string;
  tags: string[];
  titleEn: string;
  titleAr: string;
  desc: string;
  agent: string;
  imgUrls: string[];
};

const INIT_FORM: PropForm = {
  type: "Sale", state: "available", propType: "apartment",
  emirate: "Dubai", community: "",
  bedrooms: "2", bathrooms: "2",
  sqft: "", floor: "", parking: "1",
  price: "", cheques: "4", tags: [],
  titleEn: "", titleAr: "", desc: "", agent: "Yasmine Khalil",
  imgUrls: [],
};

const PROP_TYPES = ["Apartment", "Villa", "Townhouse", "Penthouse", "Office", "Retail"];
const AGENTS     = ["Yasmine Khalil", "Omar Rashid", "Sara Mansouri"];
const MODAL_STEPS = ["Type & Location", "Specifications", "Pricing", "Details"];

const INP: React.CSSProperties = {
  width: "100%", height: 40, padding: "0 12px",
  border: "1px solid var(--line-strong)", borderRadius: "var(--r)",
  background: "var(--bg-paper)", color: "var(--ink)", fontSize: 13.5,
  outline: "none", boxSizing: "border-box",
};

function FField({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-3)", fontWeight: 500 }}>
        {label}{required && <span style={{ color: "var(--rose)", marginInlineStart: 3 }}>*</span>}
      </span>
      {children}
    </div>
  );
}

function Pills({ opts, val, onPick }: { opts: string[]; val: string; onPick: (v: string) => void }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {opts.map(o => (
        <button key={o} type="button" onClick={() => onPick(o)} style={{
          padding: "7px 16px", borderRadius: 999,
          border: "1.5px solid " + (val === o ? "var(--gold)" : "var(--line-strong)"),
          background: val === o ? "var(--gold-ghost)" : "var(--bg-paper)",
          color: val === o ? "var(--gold-deep)" : "var(--ink)",
          fontWeight: val === o ? 600 : 400, cursor: "pointer", fontSize: 13,
        }}>{o}</button>
      ))}
    </div>
  );
}

function TagChip({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{
      padding: "5px 14px", borderRadius: 999,
      border: "1.5px solid " + (active ? "var(--gold)" : "var(--line-soft)"),
      background: active ? "var(--gold-ghost)" : "transparent",
      color: active ? "var(--gold-deep)" : "var(--ink-3)",
      fontSize: 12, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 5,
    }}>
      {active && <IcCheck />}{label}
    </button>
  );
}

function AddPropertyModal({ onClose, onSave, nextRef }: {
  onClose: () => void;
  onSave: (p: Prop) => void;
  nextRef: string;
}) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PropForm>(INIT_FORM);
  const bp    = useBreakpoint();
  const isMob = bp === "mobile";

  // Scraping state
  const [showScrape, setShowScrape]       = useState(false);
  const [scrapeUrl, setScrapeUrl]         = useState("");
  const [scrapeStatus, setScrapeStatus]   = useState<ScrapeStatus>("idle");
  const [scraped, setScraped]             = useState<ScrapedProperty | null>(null);
  const [scrapeApplied, setScrapeApplied] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  async function runScrape() {
    const url = scrapeUrl.trim();
    if (!url) return;
    setScrapeStatus("loading");
    setScraped(null);
    try {
      new URL(url); // validate URL format
      const data = await scrapePropertyFromUrl(url);
      setScraped(data);
      setScrapeStatus("done");
    } catch {
      setScrapeStatus("error");
    }
  }

  function applyScrape() {
    if (!scraped) return;
    setForm(f => ({
      ...f,
      titleEn:   scraped.titleEn,
      price:     scraped.price ? Number(scraped.price).toLocaleString("en-AE") : f.price,
      type:      scraped.type,
      propType:  scraped.propType,
      bedrooms:  scraped.bedrooms || f.bedrooms,
      bathrooms: scraped.bathrooms || f.bathrooms,
      sqft:      scraped.sqft || f.sqft,
      emirate:   scraped.emirate || f.emirate,
      community: scraped.community || f.community,
      desc:      scraped.desc || f.desc,
      imgUrls:   scraped.images.length > 0 ? scraped.images : f.imgUrls,
      tags:      scraped.type === "Sale" && Number(scraped.price) >= 2_000_000
        ? [...new Set([...f.tags, "Premium"])]
        : f.tags,
    }));
    setScrapeApplied(true);
    setShowScrape(false);
    setStep(4); // jump to Details for final review
  }

  function dismissScrape() {
    setShowScrape(false);
    setScrapeUrl("");
    setScrapeStatus("idle");
    setScraped(null);
  }

  function upd<K extends keyof PropForm>(k: K, v: PropForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function toggleTag(tag: string) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  }

  function saveProperty() {
    const priceN = Number(form.price.replace(/[^0-9]/g, ""));
    const isGV = form.type === "Sale" && priceN >= 2_000_000;
    const allTags = [...new Set([...form.tags, ...(isGV ? ["Golden Visa"] : [])])];
    onSave({
      ref:        nextRef,
      t:          form.titleEn || "New property",
      area:       form.community || form.emirate,
      bd:         Number(form.bedrooms) || 0,
      ba:         Number(form.bathrooms) || 0,
      sqft:       Number(form.sqft) || 0,
      price:      priceN,
      type:       form.type,
      state:      form.state,
      tag:        allTags[0] || "—",
      img:        1,
      imgUrls:    form.imgUrls,
      propType:   form.propType,
      emirate:    form.emirate,
      floor:      Number(form.floor) || 0,
      parking:    Number(form.parking) || 0,
      agent:      form.agent,
      agentPhone: AGENT_PHONES[form.agent] ?? "+971 50 000 0000",
      desc:       form.desc,
    });
  }

  const priceNum = Number(form.price.replace(/[^0-9]/g, ""));
  const isGoldenVisa = form.type === "Sale" && priceNum >= 2_000_000;

  const stepValid: boolean[] = [
    form.propType.length > 0 && form.emirate.length > 0,
    form.bedrooms.length > 0 && form.sqft.length > 0,
    form.price.length > 0,
    form.titleEn.length > 0,
  ];
  const canAdvance = stepValid[step - 1] ?? false;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: "fixed", inset: 0, background: "rgba(10,8,6,0.5)", zIndex: 900 }}
        onClick={onClose}
      />

      {/* Dialog */}
      <div style={{ position: "fixed", inset: 0, zIndex: 901, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, pointerEvents: "none" }}>
        <div style={{ width: "100%", maxWidth: 700, maxHeight: "92vh", display: "flex", flexDirection: "column", background: "var(--bg-ivory)", borderRadius: 12, boxShadow: "var(--shadow-3)", overflow: "hidden", pointerEvents: "all" }}>

          {/* Header */}
          <div style={{ padding: "22px 28px 0", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <Eyebrow>New property</Eyebrow>
              <div className="font-display" style={{ fontSize: 22, marginTop: 4 }}>Add to inventory</div>
            </div>
            <button type="button" onClick={onClose} style={{ background: "none", border: "1px solid var(--line-strong)", borderRadius: "var(--r)", cursor: "pointer", width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-3)", flexShrink: 0, fontSize: 14 }}>
              &#x2715;
            </button>
          </div>

          {/* ── URL Import Zone ── */}
          <div style={{ padding: "16px 28px 0" }}>
            {/* Applied banner */}
            {scrapeApplied && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", marginBottom: 12, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--r)", fontSize: 12, color: "var(--emerald)" }}>
                <IcCheck />
                Formulaire pré-rempli depuis <strong style={{ marginInlineStart: 3 }}>{scraped?.source}</strong>
                <span style={{ color: "var(--ink-4)", marginInlineStart: 3 }}>— vérifiez les données avant de publier</span>
              </div>
            )}

            {/* Trigger button — shown when scrape panel is closed and nothing applied */}
            {!showScrape && !scraped && (
              <button
                type="button"
                onClick={() => { setShowScrape(true); setScrapeApplied(false); setTimeout(() => urlInputRef.current?.focus(), 50); }}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  width: "100%", padding: "9px 14px", marginBottom: 4,
                  borderRadius: "var(--r)", border: "1px dashed var(--line-strong)",
                  background: "var(--bg-inset)", color: "var(--ink-3)",
                  fontSize: 12.5, cursor: "pointer", fontFamily: "Roboto, sans-serif",
                }}
              >
                🔗 Importer depuis une URL de listing
                <span style={{ fontSize: 10, color: "var(--ink-4)" }}>Bayut · PropertyFinder · Dubizzle</span>
              </button>
            )}

            {/* Scrape input panel */}
            {showScrape && scrapeStatus !== "done" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 14px", background: "var(--bg-inset)", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", marginBottom: 4 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--ink-4)", fontWeight: 600 }}>
                  URL du listing
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    ref={urlInputRef}
                    value={scrapeUrl}
                    onChange={e => { setScrapeUrl(e.target.value); setScrapeStatus("idle"); }}
                    onKeyDown={e => e.key === "Enter" && runScrape()}
                    placeholder="https://bayut.com/property/...  ou PropertyFinder, Dubizzle"
                    disabled={scrapeStatus === "loading"}
                    style={{ ...INP, flex: 1, fontSize: 12.5, height: 38 }}
                  />
                  <button
                    type="button"
                    onClick={runScrape}
                    disabled={!scrapeUrl.trim() || scrapeStatus === "loading"}
                    className="sgi-btn sgi-btn-primary"
                    style={{ height: 38, padding: "0 16px", flexShrink: 0, opacity: (!scrapeUrl.trim() || scrapeStatus === "loading") ? 0.5 : 1 }}
                  >
                    {scrapeStatus === "loading" ? "…" : "Analyser"}
                  </button>
                  <button
                    type="button"
                    onClick={dismissScrape}
                    style={{ height: 38, width: 38, borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "none", cursor: "pointer", color: "var(--ink-4)", fontSize: 18, flexShrink: 0, display: "grid", placeItems: "center" }}
                  >×</button>
                </div>

                {scrapeStatus === "loading" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-3)" }}>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
                    Extraction des données en cours…
                  </div>
                )}
                {scrapeStatus === "error" && (
                  <div style={{ fontSize: 12, color: "var(--rose)", padding: "6px 10px", background: "rgba(220,50,50,0.06)", borderRadius: "var(--r)" }}>
                    Impossible d'extraire les données. Vérifiez l'URL (Bayut, PropertyFinder ou Dubizzle) et réessayez.
                  </div>
                )}
              </div>
            )}

            {/* Scrape preview */}
            {scrapeStatus === "done" && scraped && (
              <div style={{ marginBottom: 4 }}>
                <ScrapePreview data={scraped} onApply={applyScrape} onDismiss={dismissScrape} />
              </div>
            )}
          </div>

          {/* Step progress */}
          <div style={{ display: "flex", alignItems: "flex-start", padding: "20px 28px 0" }}>
            {MODAL_STEPS.map((s, i) => (
              <React.Fragment key={s}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 14,
                    background: i + 1 < step ? "var(--emerald)" : i + 1 === step ? "var(--gold)" : "var(--bg-inset)",
                    border: "2px solid " + (i + 1 < step ? "var(--emerald)" : i + 1 === step ? "var(--gold)" : "var(--line-strong)"),
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: i + 1 < step ? "white" : i + 1 === step ? "var(--gold-deep)" : "var(--ink-4)",
                    fontSize: 11.5, fontWeight: 700,
                  }}>
                    {i + 1 < step ? <IcCheck /> : <span>{i + 1}</span>}
                  </div>
                  <span style={{ fontSize: 9.5, color: i + 1 === step ? "var(--gold-deep)" : "var(--ink-4)", fontWeight: i + 1 === step ? 600 : 400, whiteSpace: "nowrap" }}>{s}</span>
                </div>
                {i < MODAL_STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: i + 1 < step ? "var(--emerald)" : "var(--line-soft)", marginTop: 13, marginInlineStart: 4, marginInlineEnd: 4 }} />
                )}
              </React.Fragment>
            ))}
          </div>

          <div style={{ height: 1, background: "var(--line-soft)", margin: "20px 28px 0" }} />

          {/* Step body */}
          <div style={{ flex: 1, overflow: "auto", padding: "24px 28px" }}>

            {/* Step 1 — Type & Location */}
            {step === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

                <FField label="Listing type" required>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {(["Sale", "Rent"] as const).map(tp => (
                      <button key={tp} type="button" onClick={() => upd("type", tp)} style={{
                        padding: "16px 14px", borderRadius: "var(--r)", textAlign: "start",
                        border: "2px solid " + (form.type === tp ? "var(--gold)" : "var(--line-soft)"),
                        background: form.type === tp ? "var(--gold-ghost)" : "var(--bg-paper)",
                        cursor: "pointer",
                      }}>
                        <div style={{ fontSize: 15, fontWeight: 600, color: form.type === tp ? "var(--gold-deep)" : "var(--ink)" }}>{tp}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                          {tp === "Sale" ? "Transfer of ownership · DLD" : "Fixed-term tenancy agreement"}
                        </div>
                      </button>
                    ))}
                  </div>
                </FField>

                <FField label="Availability">
                  <Pills
                    opts={["Available", "Under Offer"]}
                    val={form.state === "available" ? "Available" : "Under Offer"}
                    onPick={v => upd("state", v === "Available" ? "available" : "offer")}
                  />
                </FField>

                <FField label="Property type" required>
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 8 }}>
                    {PROP_TYPES.map(pt => (
                      <button key={pt} type="button" onClick={() => upd("propType", pt.toLowerCase())} style={{
                        padding: "11px 8px", borderRadius: "var(--r)",
                        border: "1.5px solid " + (form.propType === pt.toLowerCase() ? "var(--gold)" : "var(--line-soft)"),
                        background: form.propType === pt.toLowerCase() ? "var(--gold-ghost)" : "var(--bg-paper)",
                        color: form.propType === pt.toLowerCase() ? "var(--gold-deep)" : "var(--ink-2)",
                        cursor: "pointer", fontSize: 12.5,
                        fontWeight: form.propType === pt.toLowerCase() ? 600 : 400,
                      }}>{pt}</button>
                    ))}
                  </div>
                </FField>

                <FField label="Emirate" required>
                  <Pills opts={["Dubai", "Abu Dhabi", "Sharjah", "Other"]} val={form.emirate} onPick={v => upd("emirate", v)} />
                </FField>

                <FField label="Community / Area">
                  <input
                    style={INP}
                    placeholder="e.g. Dubai Marina, Downtown Dubai, Palm Jumeirah…"
                    value={form.community}
                    onChange={e => upd("community", e.target.value)}
                  />
                </FField>
              </div>
            )}

            {/* Step 2 — Specifications */}
            {step === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

                <FField label="Bedrooms" required>
                  <Pills opts={["Studio", "1", "2", "3", "4", "5+"]} val={form.bedrooms} onPick={v => upd("bedrooms", v)} />
                </FField>

                <FField label="Bathrooms" required>
                  <Pills opts={["1", "2", "3", "4", "5+"]} val={form.bathrooms} onPick={v => upd("bathrooms", v)} />
                </FField>

                <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr 1fr", gap: 14 }}>
                  <FField label="Built-up area (ft²)" required>
                    <input
                      style={INP} type="number" min={0} placeholder="e.g. 1850"
                      value={form.sqft} onChange={e => upd("sqft", e.target.value)}
                    />
                  </FField>
                  <FField label="Floor">
                    <input
                      style={INP} type="number" min={0} placeholder="e.g. 12"
                      value={form.floor} onChange={e => upd("floor", e.target.value)}
                    />
                  </FField>
                  <FField label="Parking spaces">
                    <Pills opts={["0", "1", "2", "3+"]} val={form.parking} onPick={v => upd("parking", v)} />
                  </FField>
                </div>
              </div>
            )}

            {/* Step 3 — Pricing */}
            {step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

                <FField label={form.type === "Sale" ? "Asking price (AED)" : "Annual rent (AED)"} required>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12, color: "var(--ink-4)", pointerEvents: "none" }}>AED</span>
                    <input
                      style={{ ...INP, paddingInlineStart: 48, fontSize: 18, fontWeight: 600, color: "var(--gold-deep)" }}
                      type="text" inputMode="numeric" placeholder="0"
                      value={form.price}
                      onChange={e => {
                        const raw = e.target.value.replace(/[^0-9]/g, "");
                        upd("price", raw ? Number(raw).toLocaleString("en-AE") : "");
                      }}
                    />
                  </div>
                  {priceNum > 0 && (
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>
                      {form.type === "Sale"
                        ? `DLD 4 %: AED ${(priceNum * 0.04).toLocaleString("en-AE")}  ·  Commission 2 %: AED ${(priceNum * 0.02).toLocaleString("en-AE")}`
                        : `Monthly: AED ${Math.round(priceNum / 12).toLocaleString("en-AE")}  ·  Security deposit: 1 month`
                      }
                    </div>
                  )}
                </FField>

                {isGoldenVisa && (
                  <div style={{ padding: "12px 16px", background: "var(--gold-ghost)", border: "1px solid var(--gold-line)", borderRadius: "var(--r)", display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--gold-deep)" }}>
                    <IcCheck />
                    <span><strong>Golden Visa eligible</strong> — price ≥ AED 2,000,000. Tag applied automatically.</span>
                  </div>
                )}

                {form.type === "Rent" && (
                  <FField label="Payment cheques">
                    <Pills opts={["1", "2", "4", "6", "12"]} val={form.cheques} onPick={v => upd("cheques", v)} />
                    {priceNum > 0 && form.cheques && (
                      <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>
                        {form.cheques} {Number(form.cheques) > 1 ? "cheques" : "cheque"} · AED {Math.round(priceNum / Number(form.cheques)).toLocaleString("en-AE")} each
                      </div>
                    )}
                  </FField>
                )}

                <FField label="Tags">
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["Premium", "Off-plan", "Beachfront", "Sea view", "No agency fee", "Furnished"].map(tag => (
                      <TagChip key={tag} label={tag} active={form.tags.includes(tag)} onToggle={() => toggleTag(tag)} />
                    ))}
                  </div>
                </FField>
              </div>
            )}

            {/* Step 4 — Details */}
            {step === 4 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>

                <FField label="Title (English)" required>
                  <input
                    style={INP}
                    placeholder="e.g. Marina Gate · Tower 2 #4502"
                    value={form.titleEn}
                    onChange={e => upd("titleEn", e.target.value)}
                  />
                </FField>

                <FField label="Title (Arabic)">
                  <input
                    style={{ ...INP, direction: "rtl" }}
                    placeholder="مثال: برج مارينا جيت · الطابق 45"
                    value={form.titleAr}
                    onChange={e => upd("titleAr", e.target.value)}
                  />
                </FField>

                <FField label="Description">
                  <textarea
                    style={{ ...INP, height: 96, padding: "10px 12px", resize: "none", lineHeight: 1.6 } as React.CSSProperties}
                    placeholder="Describe the property — views, finishes, highlights, access…"
                    value={form.desc}
                    onChange={e => upd("desc", e.target.value)}
                  />
                </FField>

                <FField label="Assign agent">
                  <select style={{ ...INP } as React.CSSProperties} value={form.agent} onChange={e => upd("agent", e.target.value)}>
                    {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </FField>

                {/* Summary */}
                <div style={{ padding: 16, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)" }}>
                  <Eyebrow style={{ marginBottom: 10 }}>Summary before saving</Eyebrow>
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: 6, fontSize: 12 }}>
                    {[
                      ["Type",    `${form.type} · ${form.propType}`],
                      ["Location",`${form.emirate}${form.community ? " · " + form.community : ""}`],
                      ["Specs",   `${form.bedrooms || "—"} BR · ${form.bathrooms || "—"} BA · ${form.sqft || "—"} ft²`],
                      ["Price",   form.price ? `AED ${form.price}` : "—"],
                      ["Tags",    [...form.tags, ...(isGoldenVisa ? ["Golden Visa"] : [])].join(", ") || "—"],
                      ["Agent",   form.agent],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <span style={{ color: "var(--ink-4)" }}>{l}:&nbsp;</span>
                        <span style={{ fontWeight: 500, color: "var(--ink)" }}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 11, color: "var(--ink-4)" }}>
                    Reference: <span className="font-mono">{nextRef}</span> — auto-assigned on save
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: "16px 28px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-paper)", flexShrink: 0 }}>
            <button type="button" onClick={step > 1 ? () => setStep(s => s - 1) : onClose} className="sgi-btn sgi-btn-ghost">
              {step > 1 ? <><IcChevL />&nbsp;Back</> : "Cancel"}
            </button>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{step} / {MODAL_STEPS.length}</span>
              {step < MODAL_STEPS.length ? (
                <button
                  type="button"
                  onClick={() => setStep(s => s + 1)}
                  className="sgi-btn sgi-btn-primary"
                  disabled={!canAdvance}
                  style={{ opacity: canAdvance ? 1 : 0.45, cursor: canAdvance ? "pointer" : "not-allowed" }}
                >
                  Next&nbsp;<IcChevR />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveProperty}
                  className="sgi-btn sgi-btn-primary"
                  disabled={!canAdvance}
                  style={{ opacity: canAdvance ? 1 : 0.45, cursor: canAdvance ? "pointer" : "not-allowed" }}
                >
                  <IcCheck />&nbsp;Save property
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export function ScreenProperties() {
  const t = useT();
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isCompact = bp !== "desktop";

  const [properties, setProperties] = useState<Prop[]>(PROPERTIES);
  const [view, setView] = useState<"list" | "grid" | "map">("list");
  const [selected, setSelected] = useState<string | null>("INF-2417");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTER);
  const [showModal, setShowModal] = useState(false);

  const nextRef = "INF-" + (
    Math.max(...properties.map(p => parseInt(p.ref.replace("INF-", ""), 10)).filter(n => !isNaN(n)), 2418) + 1
  );

  function handleSave(p: Prop) {
    setProperties(ps => [p, ...ps]);
    setSelected(p.ref);
    setShowModal(false);
  }

  function upd<K extends keyof FilterState>(k: K, v: FilterState[K]) {
    setFilters(f => ({ ...f, [k]: v }));
  }

  const nActive = activeFilterCount(filters);
  const allAgents = [...new Set(properties.map(p => p.agent))];

  const counters = [
    { key: "all",       en: "All",          ar: "الكل",           fr: "Tous",        n: properties.length,                                                                       c: "var(--ink-3)" },
    { key: "available", en: "Available",    ar: "متاح",           fr: "Disponible",  n: properties.filter(p => p.state === "available").length,                                  c: "var(--emerald)" },
    { key: "offer",     en: "Under Offer",  ar: "عرض",            fr: "Sous Offre",  n: properties.filter(p => p.state === "offer").length,                                      c: "var(--gold)" },
    { key: "sold",      en: "Sold / Rented",ar: "مُباع / مؤجَّر", fr: "Vendu / Loué",n: properties.filter(p => p.state === "sold" || p.state === "rented").length, c: "var(--ink-4)" },
  ];

  // Beds display label
  const bedsLabel = (() => {
    const { bedsMin: mn, bedsMax: mx } = filters;
    if (mn === 0 && mx === 0) return "All";
    const lo = mn === 0 ? "Studio" : String(mn);
    const hi = mx === 99 ? "5+" : String(mx);
    return lo === hi ? lo : `${lo} — ${hi}`;
  })();

  // Price display label
  const priceLabel = PRICE_OPTS.find(o => o.value === filters.priceRange)?.label ?? "All prices";

  const visibleProps = applyFilters(properties, filters, stateFilter);
  const selProp = selected ? properties.find(p => p.ref === selected) : null;

  const showDetail = !isCompact && selProp && view !== "map";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_prop} crumb={[`${properties.length} active`, "Dubai · all emirates"]}>
        {!isMob && (
          <button className="sgi-btn sgi-btn-ghost" onClick={() => setFilters(DEFAULT_FILTER)}>
            <IcFilter />&nbsp;{t.filter}{nActive > 0 ? ` · ${nActive}` : ""}
          </button>
        )}
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcDownload />&nbsp;{t.export_btn}</button>}
        <button className="sgi-btn sgi-btn-primary" onClick={() => setShowModal(true)}><IcPlus />&nbsp;{t.add}</button>
      </Topbar>

      <main style={{ flex: 1, padding: isMob ? 14 : 24, display: "flex", flexDirection: "column", gap: 16, background: "var(--bg-cream)", overflow: "hidden" }}>

        {/* Filter ribbon */}
        <div className="sgi-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 10, overflowX: "auto", flexWrap: "nowrap" }}>

          {/* Listing type */}
          <FilterPill
            label="Listing" value={filters.listing} isActive={filters.listing !== "all"}
            displayValue={filters.listing === "all" ? "Sale + Rent" : filters.listing}
            opts={[
              { label: "Sale + Rent", value: "all" },
              { label: "Sale only",   value: "Sale" },
              { label: "Rent only",   value: "Rent" },
            ]}
            onSelect={v => upd("listing", v as FilterState["listing"])}
          />

          {/* Emirate */}
          <FilterPill
            label="Emirate" value={filters.emirate} isActive={filters.emirate !== "all"}
            displayValue={filters.emirate === "all" ? "All" : filters.emirate}
            opts={[
              { label: "All emirates", value: "all"       },
              { label: "Dubai",        value: "Dubai"     },
              { label: "Abu Dhabi",    value: "Abu Dhabi" },
              { label: "Sharjah",      value: "Sharjah"   },
              { label: "Other",        value: "Other"     },
            ]}
            onSelect={v => upd("emirate", v as FilterState["emirate"])}
          />

          {/* Property type */}
          {!isMob && (
            <FilterPill
              label="Type" value={filters.propType} isActive={filters.propType !== "all"}
              displayValue={filters.propType === "all" ? "All types" : filters.propType.charAt(0).toUpperCase() + filters.propType.slice(1)}
              opts={[
                { label: "All types",  value: "all"        },
                { label: "Apartment",  value: "apartment"  },
                { label: "Villa",      value: "villa"      },
                { label: "Townhouse",  value: "townhouse"  },
                { label: "Penthouse",  value: "penthouse"  },
                { label: "Office",     value: "office"     },
                { label: "Retail",     value: "retail"     },
              ]}
              onSelect={v => upd("propType", v)}
            />
          )}

          {/* Bedrooms */}
          {!isMob && (
            <FilterPill
              label="Bedrooms" value="" isActive={filters.bedsMin > 0 || filters.bedsMax > 0}
              displayValue={bedsLabel}
              renderMenu={close => (
                <BedsPicker
                  bedsMin={filters.bedsMin} bedsMax={filters.bedsMax}
                  onChange={(mn, mx) => setFilters(f => ({ ...f, bedsMin: mn, bedsMax: mx }))}
                  close={close}
                />
              )}
            />
          )}

          {/* Price */}
          <FilterPill
            label="Price" value={filters.priceRange} isActive={filters.priceRange !== "all"}
            displayValue={filters.priceRange === "all" ? "All prices" : priceLabel.replace("AED ", "AED ").replace("All prices", "All")}
            opts={PRICE_OPTS}
            onSelect={v => upd("priceRange", v as FilterState["priceRange"])}
          />

          {/* Golden Visa */}
          <FilterPill
            label="Golden Visa" value={filters.goldenVisa ? "yes" : "all"} gold={filters.goldenVisa}
            isActive={filters.goldenVisa}
            displayValue={filters.goldenVisa ? "Eligible" : "All"}
            opts={[
              { label: "All properties",      value: "all" },
              { label: "Eligible (≥ 2M AED)", value: "yes" },
            ]}
            onSelect={v => upd("goldenVisa", v === "yes")}
          />

          {/* Agent */}
          {!isMob && (
            <FilterPill
              label="Agent" value={filters.agent} isActive={filters.agent !== "all"}
              displayValue={filters.agent === "all" ? "All agents" : filters.agent.split(" ")[0]}
              opts={[
                { label: "All agents", value: "all" },
                ...allAgents.map(a => ({ label: a, value: a })),
              ]}
              onSelect={v => upd("agent", v)}
            />
          )}

          {/* Sort */}
          {!isMob && (
            <FilterPill
              label="Sort" value={filters.sortBy} isActive={filters.sortBy !== "newest"}
              displayValue={{
                newest:     "Newest",
                price_asc:  "Price ↑",
                price_desc: "Price ↓",
                sqft_desc:  "Area ↓",
              }[filters.sortBy]}
              opts={[
                { label: "Newest first",  value: "newest"     },
                { label: "Price: low → high", value: "price_asc"  },
                { label: "Price: high → low", value: "price_desc" },
                { label: "Largest area",  value: "sqft_desc"  },
              ]}
              onSelect={v => upd("sortBy", v as FilterState["sortBy"])}
            />
          )}

          {/* Reset button — visible only when filters are active */}
          {nActive > 0 && (
            <button
              onClick={() => setFilters(DEFAULT_FILTER)}
              style={{
                height: 52, padding: "0 12px", borderRadius: "var(--r)", flexShrink: 0,
                border: "1px solid var(--rose)", background: "rgba(220,50,50,0.06)",
                color: "var(--rose)", fontSize: 12, fontWeight: 500, cursor: "pointer",
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              ✕ Reset{nActive > 1 ? ` (${nActive})` : ""}
            </button>
          )}

          <div style={{ flex: 1, flexShrink: 0 }} />

          {/* View mode toggle */}
          <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-inset)", borderRadius: "var(--r)", flexShrink: 0 }}>
            <ViewBtn active={view === "list"} onClick={() => setView("list")}>
              <IcList />{!isMob && <span style={{ fontSize: 11, marginInlineStart: 6 }}>List</span>}
            </ViewBtn>
            <ViewBtn active={view === "grid"} onClick={() => setView("grid")}>
              <IcGrid />{!isMob && <span style={{ fontSize: 11, marginInlineStart: 6 }}>Grid</span>}
            </ViewBtn>
            <ViewBtn active={view === "map"} onClick={() => setView("map")}>
              <IcMap />{!isMob && <span style={{ fontSize: 11, marginInlineStart: 6 }}>Map</span>}
            </ViewBtn>
          </div>
        </div>

        {/* Status counter strip */}
        <div className="sgi-card" style={{ padding: "10px 18px", display: "flex", gap: isMob ? 8 : 20, overflowX: "auto", flexWrap: "nowrap" }}>
          {counters.map((s) => {
            const label = lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en;
            const isActive = stateFilter === s.key;
            return (
              <div key={s.key} onClick={() => setStateFilter(s.key)} style={{ padding: "6px 12px", borderRadius: 6, background: isActive ? "color-mix(in srgb, " + s.c + " 10%, transparent)" : "transparent", borderInlineStart: "2px solid " + s.c, cursor: "pointer", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span className="font-display tnum" style={{ fontSize: 20, color: s.c }}>{s.n.toLocaleString()}</span>
                  <span className={lang === "ar" ? "font-ar" : undefined} style={{ fontSize: lang === "ar" ? 12 : 10.5, color: "var(--ink-3)", fontWeight: 500 }}>{label}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Main content area */}
        {view === "map" ? (
          /* Full map view */
          <div className="sgi-card" style={{ flex: 1, padding: 0, overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
            <MapPanel />
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: showDetail ? "1.1fr 420px" : "1fr", gap: 16, flex: 1, minHeight: 0 }}>

            {/* List or Grid */}
            <div className="sgi-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Card header */}
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <Eyebrow>Showing {visibleProps.length} of {properties.length}</Eyebrow>
                  <div className="font-display" style={{ fontSize: 18, marginTop: 2 }}>Featured inventory</div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
                  Sort by <span style={{ color: "var(--ink)", fontWeight: 500 }}>Newest</span> <IcChevD />
                </div>
              </div>

              {/* List view */}
              {view === "list" && (
                <div style={{ overflow: "auto", flex: 1 }}>
                  {visibleProps.map((p) => (
                    <PropertyRow
                      key={p.ref} p={p}
                      selected={selected === p.ref}
                      isMob={isMob}
                      onSelect={() => setSelected(p.ref === selected ? null : p.ref)}
                    />
                  ))}
                </div>
              )}

              {/* Grid view */}
              {view === "grid" && (
                <div style={{ overflow: "auto", flex: 1, padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : isCompact ? "1fr 1fr" : "1fr 1fr 1fr", gap: 14 }}>
                    {visibleProps.map((p) => (
                      <PropertyCard
                        key={p.ref} p={p}
                        selected={selected === p.ref}
                        onSelect={() => setSelected(p.ref === selected ? null : p.ref)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Detail panel — desktop only, when a property is selected */}
            {showDetail && selProp && <DetailPanel p={selProp} />}
          </div>
        )}
      </main>

      {showModal && (
        <AddPropertyModal
          onClose={() => setShowModal(false)}
          onSave={handleSave}
          nextRef={nextRef}
        />
      )}
    </div>
  );
}
