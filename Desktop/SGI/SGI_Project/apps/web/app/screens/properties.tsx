"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import {
  Topbar, Eyebrow, Chip, PropertyImage, fmtAED,
  IcFilter, IcDownload, IcPlus, IcChevD, IcChevR,
  IcList, IcGrid, IcMap, IcBed, IcBath, IcArea,
} from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

const PROPERTIES = [
  { ref: "INF-2418", t: "Marina Gate · Tower 2",         area: "Dubai Marina",          bd: 3, ba: 4, sqft: 2150,  price: 4750000,  status: "Sale", tag: "Golden Visa", img: 1 },
  { ref: "INF-2417", t: "Bluewaters Residences",          area: "Bluewaters Island",     bd: 4, ba: 5, sqft: 3200,  price: 12500000, status: "Sale", tag: "Premium",    img: 2 },
  { ref: "INF-2416", t: "Palm Jumeirah · Shoreline 12",   area: "Palm Jumeirah",         bd: 2, ba: 3, sqft: 1820,  price: 350000,   status: "Rent", tag: "Yearly",     img: 3 },
  { ref: "INF-2415", t: "Downtown · Burj Vista 1",        area: "Downtown Dubai",        bd: 1, ba: 2, sqft: 980,   price: 2100000,  status: "Sale", tag: "—",          img: 4 },
  { ref: "INF-2414", t: "Saadiyat Beach Villa 32",        area: "Abu Dhabi · Saadiyat",  bd: 5, ba: 6, sqft: 5600,  price: 28000000, status: "Sale", tag: "Golden Visa", img: 5 },
  { ref: "INF-2413", t: "JBR · Sadaf 5 · #2206",         area: "JBR · Marina",          bd: 2, ba: 2, sqft: 1340,  price: 220000,   status: "Rent", tag: "Yearly",     img: 6 },
];

function SelectPill({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", gap: 1, padding: "6px 12px",
      background: gold ? "var(--gold-ghost)" : "var(--bg-ivory)",
      border: "1px solid " + (gold ? "var(--gold-line)" : "var(--line-soft)"),
      borderRadius: "var(--r)", cursor: "pointer", minWidth: 110, flexShrink: 0,
    }}>
      <span style={{ fontSize: 9.5, letterSpacing: "0.14em", color: gold ? "var(--gold-deep)" : "var(--ink-4)", textTransform: "uppercase" }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 500, color: gold ? "var(--gold-deep)" : "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
        {value} <span style={{ color: "var(--ink-4)" }}><IcChevD /></span>
      </span>
    </div>
  );
}

function ViewBtn({ children, active }: { children: React.ReactNode; active?: boolean }) {
  return (
    <button style={{
      display: "inline-flex", alignItems: "center",
      padding: "6px 10px", borderRadius: 6,
      background: active ? "var(--bg-ivory)" : "transparent",
      color: active ? "var(--ink)" : "var(--ink-3)",
      border: "none", cursor: "pointer",
      boxShadow: active ? "var(--shadow-1)" : "none",
    }}>{children}</button>
  );
}

function PropertyHoverCard({ p, x, y }: { p: typeof PROPERTIES[0]; x: number; y: number }) {
  const W = 284;
  const left = Math.min(x + 20, window.innerWidth - W - 16);
  const top = Math.max(8, Math.min(y - 80, window.innerHeight - 380));
  return (
    <div style={{
      position: "fixed", left, top, width: W, zIndex: 9999,
      background: "var(--bg-ivory)",
      border: "1px solid var(--line-strong)",
      borderRadius: "var(--r-md)",
      boxShadow: "var(--shadow-3)",
      overflow: "hidden",
      pointerEvents: "none",
    }}>
      <div style={{ height: 160, position: "relative" }}>
        <PropertyImage variant={p.img} />
        <div style={{ position: "absolute", top: 8, insetInlineStart: 8, display: "flex", gap: 6 }}>
          <Chip tone={p.status === "Sale" ? "gold" : "azure"}>{p.status}</Chip>
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
          {p.status === "Rent" && <span style={{ fontSize: 11, color: "var(--ink-4)" }}>/ year</span>}
        </div>
        <div style={{ marginTop: 4, fontSize: 11, color: "var(--ink-4)" }}>
          {Math.round(p.price / p.sqft).toLocaleString()} AED / ft²
        </div>
      </div>
    </div>
  );
}

function PropertyRow({ p, highlighted, isMob }: { p: typeof PROPERTIES[0]; highlighted?: boolean; isMob?: boolean }) {
  const [hover, setHover] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const imgW = isMob ? 96 : 140;
  const imgH = isMob ? 76 : 110;
  return (
    <div style={{
      display: "flex", gap: 16, padding: 14,
      background: highlighted ? "var(--gold-ghost)" : "transparent",
      borderBottom: "1px solid var(--line-soft)",
      cursor: "pointer", position: "relative",
    }}>
      {highlighted && <div style={{ position: "absolute", insetInlineStart: 0, top: 14, bottom: 14, width: 2, background: "var(--gold)" }} />}
      <div
        style={{ width: imgW, height: imgH, flexShrink: 0, borderRadius: "var(--r)", overflow: "hidden", position: "relative" }}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onMouseMove={e => setPos({ x: e.clientX, y: e.clientY })}
      >
        <PropertyImage variant={p.img} />
        <div style={{ position: "absolute", top: 6, insetInlineStart: 6 }}>
          <Chip tone={p.status === "Sale" ? "gold" : "azure"}>{p.status}</Chip>
        </div>
      </div>
      {hover && !isMob && <PropertyHoverCard p={p} x={pos.x} y={pos.y} />}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
          <div style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{p.ref} · {p.area}</div>
          {p.tag !== "—" && !isMob && <Chip tone="gold">{p.tag}</Chip>}
        </div>
        <div className="font-display" style={{ fontSize: isMob ? 15 : 19, color: "var(--ink)", lineHeight: 1.15 }}>{p.t}</div>
        {!isMob && <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><IcBed /><span className="tnum">{p.bd}</span> bd</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><IcBath /><span className="tnum">{p.ba}</span> ba</span>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}><IcArea /><span className="tnum">{p.sqft.toLocaleString()}</span> ft²</span>
        </div>}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginTop: 6 }}>
          <div>
            <span className="font-display tnum" style={{ fontSize: isMob ? 16 : 22, color: "var(--ink)" }}>{fmtAED(p.price)}</span>
            {p.status === "Rent" && <span style={{ fontSize: 11, color: "var(--ink-4)", marginInlineStart: 4 }}>/ year</span>}
          </div>
          <span style={{ color: "var(--ink-4)", display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
            View <IcChevR />
          </span>
        </div>
      </div>
    </div>
  );
}

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
        <text x="30" y="160" fill="var(--ink-4)" fontSize="11" letterSpacing="2" fontFamily="Inter">DUBAI MARINA</text>
        <text x="220" y="170" fill="var(--ink-4)" fontSize="11" letterSpacing="2" fontFamily="Inter">DOWNTOWN</text>
        <text x="430" y="180" fill="var(--ink-4)" fontSize="11" letterSpacing="2" fontFamily="Inter">CREEK</text>
        <text x="60" y="500" fill="var(--azure)" fontSize="10" letterSpacing="2" fontFamily="Inter" opacity="0.7">ARABIAN GULF</text>
      </svg>

      {[
        { x: 22, y: 35, n: "12", active: true },
        { x: 35, y: 28, n: "8" },
        { x: 50, y: 42, n: "24", gold: true },
        { x: 64, y: 30, n: "5" },
        { x: 75, y: 48, n: "3" },
        { x: 30, y: 56, n: "2" },
        { x: 82, y: 22, n: "6" },
      ].map((p, i) => (
        <div key={i} style={{ position: "absolute", insetInlineStart: `${p.x}%`, top: `${p.y}%`, transform: "translate(-50%, -100%)" }}>
          <div style={{
            background: p.active ? "var(--ink)" : (p.gold ? "var(--gold)" : "var(--bg-ivory)"),
            color: p.active ? "var(--gold)" : (p.gold ? "#1A1610" : "var(--ink)"),
            border: "1.5px solid " + (p.active ? "var(--gold)" : "var(--ink)"),
            borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 600,
            boxShadow: "var(--shadow-2)", display: "flex", alignItems: "center", gap: 5,
          }}>
            {p.gold && <span style={{ width: 5, height: 5, borderRadius: 3, background: "var(--ink)" }} />}
            {p.n}
          </div>
          <div style={{
            width: 0, height: 0, borderLeft: "5px solid transparent", borderRight: "5px solid transparent",
            borderTop: `6px solid ${p.active ? "var(--gold)" : "var(--ink)"}`, margin: "0 auto",
          }} />
        </div>
      ))}

      {/* Popover */}
      <div style={{
        position: "absolute", top: "15%", insetInlineStart: "8%", width: 240,
        background: "var(--bg-ivory)", border: "1px solid var(--line-strong)",
        borderRadius: "var(--r-md)", boxShadow: "var(--shadow-3)", overflow: "hidden",
      }}>
        <div style={{ height: 90, position: "relative" }}>
          <PropertyImage variant={2} />
          <span style={{ position: "absolute", top: 8, insetInlineStart: 8 }}><Chip tone="gold">Bluewaters</Chip></span>
        </div>
        <div style={{ padding: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--ink-4)" }}>INF-2417 · 4BR Villa</div>
          <div className="font-display" style={{ fontSize: 15, marginTop: 2 }}>Bluewaters Residences</div>
          <div className="font-display tnum" style={{ fontSize: 18, color: "var(--gold-deep)", marginTop: 4 }}>AED 12,500,000</div>
          <button className="sgi-btn sgi-btn-ghost" style={{ height: 30, padding: "0 10px", marginTop: 8, fontSize: 11.5, width: "100%", justifyContent: "center" }}>
            View full detail <IcChevR />
          </button>
        </div>
      </div>

      {/* Map controls */}
      <div style={{ position: "absolute", top: 14, insetInlineEnd: 14, display: "flex", flexDirection: "column", gap: 4 }}>
        <button className="sgi-btn sgi-btn-ghost" style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}>+</button>
        <button className="sgi-btn sgi-btn-ghost" style={{ width: 32, height: 32, padding: 0, justifyContent: "center" }}>−</button>
      </div>

      {/* Legend */}
      <div style={{ position: "absolute", bottom: 14, insetInlineStart: 14, padding: "8px 12px", background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", display: "flex", gap: 12, fontSize: 11, color: "var(--ink-3)" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: "var(--gold)", borderRadius: 4 }} />Golden Visa</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: "var(--ink)", borderRadius: 4 }} />Sale</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 8, height: 8, background: "var(--azure)", borderRadius: 4 }} />Rent</span>
      </div>
    </div>
  );
}

export function ScreenProperties() {
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isCompact = bp !== "desktop";
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_prop} crumb={["1,284 active", "Dubai · all emirates"]}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcFilter />&nbsp;{t.filter} · 3</button>}
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcDownload />&nbsp;{t.export_btn}</button>}
        <button className="sgi-btn sgi-btn-primary"><IcPlus />&nbsp;{t.add}</button>
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
          <div style={{ display: "flex", gap: 4, padding: 3, background: "var(--bg-inset)", borderRadius: "var(--r)", flexShrink: 0 }}>
            <ViewBtn active><IcList />{!isMob && <span style={{ fontSize: 11, marginInlineStart: 6 }}>List</span>}</ViewBtn>
            <ViewBtn><IcGrid />{!isMob && <span style={{ fontSize: 11, marginInlineStart: 6 }}>Grid</span>}</ViewBtn>
            <ViewBtn><IcMap />{!isMob && <span style={{ fontSize: 11, marginInlineStart: 6 }}>Map</span>}</ViewBtn>
          </div>
        </div>

        {/* Split list | map */}
        <div style={{ display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1.15fr 1fr", gap: 16, flex: 1, minHeight: 0 }}>
          <div className="sgi-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <Eyebrow>Showing 1–6 of 1,284</Eyebrow>
                <div className="font-display" style={{ fontSize: 18, marginTop: 2 }}>Featured inventory</div>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-3)", display: "flex", alignItems: "center", gap: 6 }}>
                Sort by <span style={{ color: "var(--ink)", fontWeight: 500 }}>Newest</span> <IcChevD />
              </div>
            </div>
            <div style={{ overflow: "auto" }}>
              {PROPERTIES.map((p, i) => <PropertyRow key={p.ref} p={p} highlighted={i === 1} isMob={isMob} />)}
            </div>
          </div>

          {!isCompact && <div className="sgi-card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <MapPanel />
          </div>}
        </div>
      </main>
    </div>
  );
}
