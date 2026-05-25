"use client";
import React, { useState } from "react";
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
  floor: number; parking: number;
  agent: string; agentPhone: string;
  desc: string;
};

const PROPERTIES: Prop[] = [
  {
    ref: "INF-2418", t: "Marina Gate · Tower 2 #4502",  area: "Dubai Marina",         bd: 3, ba: 4, sqft: 2150, price: 4750000,
    type: "Sale", state: "available", tag: "Golden Visa", img: 1, floor: 45, parking: 2,
    agent: "Yasmine Khalil", agentPhone: "+971 50 123 4567",
    desc: "Spectacular full-marina view from this fully upgraded 3-bedroom. Open-plan kitchen, floor-to-ceiling glazing, private balcony. DLD transfer ready. Mortgage pre-approved.",
  },
  {
    ref: "INF-2417", t: "Bluewaters Residences B12",     area: "Bluewaters Island",    bd: 4, ba: 5, sqft: 3200, price: 12500000,
    type: "Sale", state: "offer",     tag: "Premium",    img: 2, floor: 12, parking: 2,
    agent: "Omar Rashid",    agentPhone: "+971 55 987 6543",
    desc: "Rare corner unit facing Ain Dubai and the open sea. Bespoke Miele kitchen, Italian marble throughout, private pool access. Under offer — viewings by appointment only.",
  },
  {
    ref: "INF-2416", t: "Palm Jumeirah · Shoreline #1202", area: "Palm Jumeirah",      bd: 2, ba: 3, sqft: 1820, price: 350000,
    type: "Rent", state: "available", tag: "Yearly",     img: 3, floor: 12, parking: 1,
    agent: "Sara Mansouri",  agentPhone: "+971 52 456 7890",
    desc: "Bright 2-bed with partial sea view on the West Crescent. Fully furnished. 4 cheques accepted. Beach access, pool, gym included.",
  },
  {
    ref: "INF-2415", t: "Downtown · Burj Vista T1 #3401",  area: "Downtown Dubai",    bd: 1, ba: 2, sqft: 980,  price: 2100000,
    type: "Sale", state: "available", tag: "—",          img: 4, floor: 34, parking: 1,
    agent: "Yasmine Khalil", agentPhone: "+971 50 123 4567",
    desc: "Clean 1-bedroom in the iconic Burj Vista with Burj Khalifa view. No agents. Direct from owner. Service charge settled for 2026.",
  },
  {
    ref: "INF-2414", t: "Saadiyat Beach Villa 32",         area: "Abu Dhabi · Saadiyat", bd: 5, ba: 6, sqft: 5600, price: 28000000,
    type: "Sale", state: "available", tag: "Golden Visa", img: 5, floor: 1,  parking: 4,
    agent: "Omar Rashid",    agentPhone: "+971 55 987 6543",
    desc: "Beachfront ultra-luxury villa — 5 en-suite bedrooms, private infinity pool, home cinema, 4-car garage. ADGM-registered. Price negotiable for cash buyers.",
  },
  {
    ref: "INF-2413", t: "JBR · Sadaf 5 #2206",            area: "JBR · Marina",        bd: 2, ba: 2, sqft: 1340, price: 220000,
    type: "Rent", state: "rented",   tag: "Yearly",     img: 6, floor: 22, parking: 1,
    agent: "Sara Mansouri",  agentPhone: "+971 52 456 7890",
    desc: "Walk-to-beach 2-bed. Currently occupied — available for renewal Apr 2027. Previous tenant 4 years. Excellent rental yield: 5.8 %.",
  },
];

const STATE_MAP = {
  available: { en: "Available", ar: "متاح",     fr: "Disponible",   c: "var(--emerald)", tone: "emerald" as const },
  offer:     { en: "Under Offer",ar: "عرض مقدم", fr: "Sous Offre",   c: "var(--gold)",    tone: "gold"    as const },
  sold:      { en: "Sold",      ar: "مُباع",     fr: "Vendu",        c: "var(--rose)",    tone: "rose"    as const },
  rented:    { en: "Rented",    ar: "مؤجَّر",    fr: "Loué",         c: "var(--azure)",   tone: "azure"   as const },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function SelectPill({ label, value, gold, active, onClick }: { label: string; value: string; gold?: boolean; active?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      display: "flex", flexDirection: "column", gap: 1, padding: "6px 12px",
      background: gold ? "var(--gold-ghost)" : active ? "var(--bg-paper)" : "var(--bg-ivory)",
      border: "1px solid " + (gold ? "var(--gold-line)" : active ? "var(--line-strong)" : "var(--line-soft)"),
      borderRadius: "var(--r)", cursor: "pointer", minWidth: 110, flexShrink: 0,
      boxShadow: active ? "var(--shadow-1)" : "none",
    }}>
      <span style={{ fontSize: 9.5, letterSpacing: "0.14em", color: gold ? "var(--gold-deep)" : "var(--ink-4)", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: gold ? "var(--gold-deep)" : "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
        {value} <span style={{ color: "var(--ink-4)" }}><IcChevD /></span>
      </span>
    </div>
  );
}

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
        <PropertyImage variant={p.img} />
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
        <PropertyImage variant={p.img} />
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
        <PropertyImage variant={p.img} />
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
        <text x="30"  y="160" fill="var(--ink-4)" fontSize="11" letterSpacing="2" fontFamily="Inter">DUBAI MARINA</text>
        <text x="220" y="170" fill="var(--ink-4)" fontSize="11" letterSpacing="2" fontFamily="Inter">DOWNTOWN</text>
        <text x="430" y="180" fill="var(--ink-4)" fontSize="11" letterSpacing="2" fontFamily="Inter">CREEK</text>
        <text x="60"  y="500" fill="var(--azure)" fontSize="10" letterSpacing="2" fontFamily="Inter" opacity="0.7">ARABIAN GULF</text>
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
          <PropertyImage variant={p.img} />
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
};

const INIT_FORM: PropForm = {
  type: "Sale", state: "available", propType: "apartment",
  emirate: "Dubai", community: "",
  bedrooms: "2", bathrooms: "2",
  sqft: "", floor: "", parking: "1",
  price: "", cheques: "4", tags: [],
  titleEn: "", titleAr: "", desc: "", agent: "Yasmine Khalil",
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

function AddPropertyModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<PropForm>(INIT_FORM);

  function upd<K extends keyof PropForm>(k: K, v: PropForm[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function toggleTag(tag: string) {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
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

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
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
                    Reference: <span className="font-mono">INF-2419</span> — auto-assigned on save
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
                  onClick={onClose}
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

  const [view, setView] = useState<"list" | "grid" | "map">("list");
  const [selected, setSelected] = useState<string | null>("INF-2417");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [showModal, setShowModal] = useState(false);

  const counters = [
    { key: "all",       en: "All",          ar: "الكل",     fr: "Tous",        n: 1284, c: "var(--ink-3)" },
    { key: "available", en: "Available",    ar: "متاح",     fr: "Disponible",  n: 847,  c: "var(--emerald)" },
    { key: "offer",     en: "Under Offer",  ar: "عرض",      fr: "Sous Offre",  n: 41,   c: "var(--gold)" },
    { key: "sold",      en: "Sold / Rented",ar: "مُباع / مؤجَّر", fr: "Vendu / Loué", n: 396, c: "var(--ink-4)" },
  ];

  const visibleProps = stateFilter === "all"
    ? PROPERTIES
    : PROPERTIES.filter(p => p.state === stateFilter || (stateFilter === "sold" && (p.state === "sold" || p.state === "rented")));

  const selProp = selected ? PROPERTIES.find(p => p.ref === selected) : null;

  const showDetail = !isCompact && selProp && view !== "map";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_prop} crumb={["1,284 active", "Dubai · all emirates"]}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcFilter />&nbsp;{t.filter} · 3</button>}
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcDownload />&nbsp;{t.export_btn}</button>}
        <button className="sgi-btn sgi-btn-primary" onClick={() => setShowModal(true)}><IcPlus />&nbsp;{t.add}</button>
      </Topbar>

      <main style={{ flex: 1, padding: isMob ? 14 : 24, display: "flex", flexDirection: "column", gap: 16, background: "var(--bg-cream)", overflow: "hidden" }}>

        {/* Filter ribbon */}
        <div className="sgi-card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12, overflowX: "auto", flexWrap: "nowrap" }}>
          <SelectPill label="Listing" value="Sale + Rent" />
          <SelectPill label="Emirate" value="Dubai" />
          {!isMob && <SelectPill label="Type" value="Apartments" />}
          {!isMob && <SelectPill label="Bedrooms" value="2 — 4" />}
          <SelectPill label="Price" value="AED 1M — 15M" />
          <SelectPill label="Golden Visa" value="Eligible" gold />
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
                  <Eyebrow>Showing {visibleProps.length} of 1,284</Eyebrow>
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

      {showModal && <AddPropertyModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
