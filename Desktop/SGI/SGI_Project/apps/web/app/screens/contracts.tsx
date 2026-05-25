"use client";
import React, { useState, useRef } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Chip, StatusDot, Wordmark, IcFilter, IcPlus, IcChevR, IcMore, IcDownload, IcMail, IcCheck } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";

type Contract = {
  ref: string; type: string; parties: string; value: string; valueRaw: number;
  d1: string; d2: string; status: string; sign: string;
  gold?: boolean; highlighted?: boolean;
};

const CONTRACTS: Contract[] = [
  { ref: "C-1284", type: "Sale", parties: "Y. Demir → Marina Gate #4502",    value: "AED 4,750,000",    valueRaw: 4_750_000,  d1: "Signed 12 May", d2: "Funds 28 May", status: "active",   sign: "2/2", gold: true },
  { ref: "C-1283", type: "Sale", parties: "A. Schmidt → Marina Gate T2",      value: "AED 4,750,000",    valueRaw: 4_750_000,  d1: "Sent 21 May",   d2: "—",             status: "pending",  sign: "0/2", highlighted: true },
  { ref: "C-1282", type: "Sale", parties: "Family Tanaka → Bluewaters B12",   value: "AED 11,800,000",   valueRaw: 11_800_000, d1: "Sent 19 May",   d2: "—",             status: "pending",  sign: "1/2" },
  { ref: "C-1281", type: "Rent", parties: "K. Mubarak → JBR Sadaf #2206",     value: "AED 220,000 / yr", valueRaw: 220_000,    d1: "Active until",  d2: "12 Apr 2027",   status: "active",   sign: "2/2" },
  { ref: "C-1280", type: "Sale", parties: "M. Bin Saud → Saadiyat Villa 32",  value: "AED 28,000,000",   valueRaw: 28_000_000, d1: "Signed 04 May", d2: "Funds 22 May",  status: "active",   sign: "2/2", gold: true },
  { ref: "C-1279", type: "Rent", parties: "L. Russo → Burj Vista 1",          value: "AED 180,000 / yr", valueRaw: 180_000,    d1: "Expires",       d2: "08 Aug 2026",   status: "expiring", sign: "2/2" },
  { ref: "C-1278", type: "Sale", parties: "H. Wei → Palm Shoreline 12",       value: "AED 8,400,000",    valueRaw: 8_400_000,  d1: "Draft",         d2: "—",             status: "draft",    sign: "0/2" },
  { ref: "C-1277", type: "Rent", parties: "P. Lemaire → Marina Promenade",    value: "AED 240,000 / yr", valueRaw: 240_000,    d1: "Active until",  d2: "31 Mar 2027",   status: "active",   sign: "2/2" },
];

const STATUS_MAP: Record<string, { label: string; tone: "gold" | "emerald" | "rose" | undefined; c: string }> = {
  draft:    { label: "Draft",    tone: undefined,  c: "var(--ink-4)" },
  pending:  { label: "Awaiting", tone: "gold",     c: "var(--gold)" },
  active:   { label: "Active",   tone: "emerald",  c: "var(--emerald)" },
  expiring: { label: "Expiring", tone: "rose",     c: "var(--rose)" },
};

/* ─── Filter types & helpers ─────────────────────────────────────────── */

type ContractFilter = {
  type: "all" | "Sale" | "Rent";
  status: "all" | "draft" | "pending" | "active" | "expiring";
  valueRange: "all" | "u1m" | "1m-10m" | "o10m";
  goldOnly: boolean;
};

const DEFAULT_CONTRACT_FILTER: ContractFilter = { type: "all", status: "all", valueRange: "all", goldOnly: false };

function isContractFilterActive(f: ContractFilter) {
  return f.type !== "all" || f.status !== "all" || f.valueRange !== "all" || f.goldOnly;
}

function applyContractFilters(contracts: Contract[], f: ContractFilter): Contract[] {
  return contracts.filter(c => {
    if (f.type !== "all" && c.type !== f.type) return false;
    if (f.status !== "all" && c.status !== f.status) return false;
    if (f.valueRange !== "all") {
      if (f.valueRange === "u1m"   && c.valueRaw >= 1_000_000)  return false;
      if (f.valueRange === "1m-10m" && (c.valueRaw < 1_000_000 || c.valueRaw >= 10_000_000)) return false;
      if (f.valueRange === "o10m"  && c.valueRaw < 10_000_000) return false;
    }
    if (f.goldOnly && !c.gold) return false;
    return true;
  });
}

const VALUE_OPTS = [
  { label: "All values",      value: "all"    },
  { label: "< AED 1M",        value: "u1m"    },
  { label: "AED 1M – 10M",    value: "1m-10m" },
  { label: "> AED 10M",       value: "o10m"   },
];

const CONTRACT_STATUS_OPTS = [
  { label: "All",      value: "all"      },
  { label: "Draft",    value: "draft"    },
  { label: "Awaiting", value: "pending"  },
  { label: "Active",   value: "active"   },
  { label: "Expiring", value: "expiring" },
];

function valueRangeLabel(r: ContractFilter["valueRange"]): string {
  switch (r) {
    case "u1m":    return "< AED 1M";
    case "1m-10m": return "1M – 10M";
    case "o10m":   return "> AED 10M";
    default:       return "All";
  }
}

/* ─── ContractFilterPill ─────────────────────────────────────────────── */

function ContractFilterPill({
  label, displayValue, value, opts, isActive, gold, onSelect,
}: {
  label: string; displayValue: string; value?: string;
  opts: { label: string; value: string }[]; isActive?: boolean; gold?: boolean;
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
  const accent = gold || (isActive ?? false);

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

/* ─── ContractSnapshotBar ────────────────────────────────────────────── */

function ContractSnapshotBar({ filter, onChange, total, filtered }: {
  filter: ContractFilter;
  onChange: (f: ContractFilter) => void;
  total: number;
  filtered: number;
}) {
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const active = isContractFilterActive(filter);
  const activeCount = [filter.type !== "all", filter.status !== "all", filter.valueRange !== "all", filter.goldOnly].filter(Boolean).length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isMob ? "8px 12px" : "10px 24px", background: "var(--bg-cream)", borderBottom: "1px solid var(--line-soft)", overflowX: "auto", flexShrink: 0, WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>

      <ContractFilterPill
        label="Type"
        displayValue={filter.type === "all" ? "Sale + Rent" : filter.type}
        value={filter.type}
        isActive={filter.type !== "all"}
        opts={[{ label: "Sale + Rent", value: "all" }, { label: "Sale", value: "Sale" }, { label: "Rent", value: "Rent" }]}
        onSelect={v => onChange({ ...filter, type: v as ContractFilter["type"] })}
      />

      <ContractFilterPill
        label="Status"
        displayValue={filter.status === "all" ? "All" : (CONTRACT_STATUS_OPTS.find(o => o.value === filter.status)?.label ?? filter.status)}
        value={filter.status}
        isActive={filter.status !== "all"}
        opts={CONTRACT_STATUS_OPTS}
        onSelect={v => onChange({ ...filter, status: v as ContractFilter["status"] })}
      />

      <ContractFilterPill
        label="Value"
        displayValue={valueRangeLabel(filter.valueRange)}
        value={filter.valueRange}
        isActive={filter.valueRange !== "all"}
        opts={VALUE_OPTS}
        onSelect={v => onChange({ ...filter, valueRange: v as ContractFilter["valueRange"] })}
      />

      <ContractFilterPill
        label="Golden Visa"
        displayValue={filter.goldOnly ? "Eligible" : "All"}
        value={filter.goldOnly ? "yes" : "all"}
        isActive={filter.goldOnly}
        gold={filter.goldOnly}
        opts={[{ label: "All contracts", value: "all" }, { label: "Eligible (≥ 2M AED)", value: "yes" }]}
        onSelect={v => onChange({ ...filter, goldOnly: v === "yes" })}
      />

      {active && (
        <button onClick={() => onChange(DEFAULT_CONTRACT_FILTER)}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontFamily: "Inter, sans-serif", cursor: "pointer", border: "1px solid rgba(220,50,50,0.4)", background: "var(--bg-paper)", color: "var(--rose)", whiteSpace: "nowrap", flexShrink: 0 }}>
          Reset
          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "var(--rose)", color: "#fff" }}>{activeCount}</span>
        </button>
      )}

      <div style={{ marginInlineStart: "auto", fontSize: 11, color: active ? "var(--ink)" : "var(--ink-4)", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }} className="tnum">
        {active ? `${filtered} / ${total}` : `${total}`} contracts
      </div>
    </div>
  );
}

/* ─── SignDots ───────────────────────────────────────────────────────── */

function SignDots({ signed }: { signed: string }) {
  const [s, t] = signed.split("/").map(Number);
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: t }).map((_, i) => (
        <span key={i} style={{ width: 8, height: 8, borderRadius: 4, background: i < s ? "var(--emerald)" : "transparent", border: "1.5px solid " + (i < s ? "var(--emerald)" : "var(--line-strong)") }} />
      ))}
    </div>
  );
}

function ContractRow({ c, isMob }: { c: Contract; isMob?: boolean }) {
  const st = STATUS_MAP[c.status];
  if (isMob) {
    return (
      <div style={{ padding: "12px 16px", background: c.highlighted ? "var(--gold-ghost)" : "transparent", borderBottom: "1px solid var(--line-soft)", cursor: "pointer", position: "relative" }}>
        {c.highlighted && <div style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 2, background: "var(--gold)" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="font-mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{c.ref}</span>
            <Chip tone={c.type === "Sale" ? "gold" : "azure"}>{c.type}</Chip>
            {c.gold && <Chip tone="gold">GV</Chip>}
          </div>
          <Chip tone={st.tone}><StatusDot tone={st.tone || "ink-4"} />&nbsp;{st.label}</Chip>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)", marginBottom: 4 }}>{c.parties}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="font-display tnum" style={{ fontSize: 13 }}>{c.value}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <SignDots signed={c.sign} />
            <span className="tnum" style={{ fontSize: 11, color: "var(--ink-3)" }}>{c.sign}</span>
          </div>
        </div>
        {c.d2 !== "—" && <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 3 }}>{c.d1} · {c.d2}</div>}
      </div>
    );
  }
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "60px 1fr 130px 130px 110px 90px 50px",
      padding: "14px 18px",
      background: c.highlighted ? "var(--gold-ghost)" : "transparent",
      borderBottom: "1px solid var(--line-soft)",
      alignItems: "center", cursor: "pointer", fontSize: 12, position: "relative",
    }}>
      {c.highlighted && <div style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 2, background: "var(--gold)" }} />}
      <span className="font-mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{c.ref}</span>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <Chip tone={c.type === "Sale" ? "gold" : "azure"}>{c.type}</Chip>
          {c.gold && <Chip tone="gold">GV</Chip>}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)", marginTop: 4 }}>{c.parties}</div>
      </div>
      <span className="font-display tnum" style={{ fontSize: 14 }}>{c.value}</span>
      <div>
        <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{c.d1}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 1 }}>{c.d2}</div>
      </div>
      <Chip tone={st.tone}><StatusDot tone={st.tone || "ink-4"} />&nbsp;{st.label}</Chip>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <SignDots signed={c.sign} />
        <span className="tnum" style={{ fontSize: 11, color: "var(--ink-3)" }}>{c.sign}</span>
      </div>
      <span style={{ color: "var(--ink-4)", justifySelf: "end" }}><IcChevR /></span>
    </div>
  );
}

function PartyBox({ role, name, id }: { role: string; name: string; id: string }) {
  return (
    <div style={{ padding: 10, border: "1px solid var(--line-soft)", borderRadius: 4 }}>
      <div className="eyebrow">{role}</div>
      <div style={{ fontSize: 13, fontWeight: 500, marginTop: 3 }}>{name}</div>
      <div className="font-mono" style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 2 }}>{id}</div>
    </div>
  );
}

export function ScreenContracts() {
  const t = useT();
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isCompact = bp !== "desktop";

  const [filter, setFilter] = useState<ContractFilter>(DEFAULT_CONTRACT_FILTER);
  const filteredContracts = applyContractFilters(CONTRACTS, filter);

  const COUNTER_STRIPS = [
    { key: "draft",    en: "Draft",          ar: "مسودة",              fr: "Brouillon",    c: "var(--ink-4)"   },
    { key: "pending",  en: "Awaiting sign",  ar: "بانتظار التوقيع",   fr: "En attente",   c: "var(--gold)"    },
    { key: "active",   en: "Active",         ar: "نشط",                fr: "Actif",        c: "var(--emerald)" },
    { key: "expiring", en: "Expiring · 90d", ar: "ينتهي",             fr: "Expire · 90j", c: "var(--rose)"    },
    { key: "all",      en: "All",            ar: "الكل",               fr: "Tous",         c: "var(--ink-3)"   },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_contract} crumb={[`${filteredContracts.length} contracts`, "4 awaiting signature"]}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcFilter />&nbsp;{t.filter}</button>}
        <button className="sgi-btn sgi-btn-primary"><IcPlus />&nbsp;{t.new_btn}</button>
      </Topbar>

      <ContractSnapshotBar
        filter={filter} onChange={setFilter}
        total={CONTRACTS.length} filtered={filteredContracts.length}
      />

      <main style={{ flex: 1, padding: isMob ? 14 : 24, display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 480px", gap: 16, background: "var(--bg-cream)", overflow: "hidden" }}>
        {/* List */}
        <div className="sgi-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Status counters — sync with Status pill */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: isMob ? 8 : 18, overflowX: "auto", flexWrap: "nowrap" }}>
            {COUNTER_STRIPS.map((s) => {
              const liveCount = s.key === "all" ? CONTRACTS.length : CONTRACTS.filter(c => c.status === s.key).length;
              const isActive = filter.status === s.key;
              const label = lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en;
              return (
                <div key={s.key}
                  onClick={() => setFilter(f => ({ ...f, status: s.key as ContractFilter["status"] }))}
                  style={{ padding: "6px 12px", borderRadius: 6, background: isActive ? `color-mix(in srgb,${s.c} 10%,transparent)` : "transparent", borderInlineStart: "2px solid " + (isActive ? s.c : "var(--line-soft)"), cursor: "pointer", flexShrink: 0, transition: "background 0.15s, border-color 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span className="font-display tnum" style={{ fontSize: 22, color: isActive ? s.c : "var(--ink-3)" }}>{liveCount}</span>
                    <span className={lang === "ar" ? "font-ar" : undefined} style={{ fontSize: lang === "ar" ? 13 : 11, color: isActive ? s.c : "var(--ink-4)", fontWeight: isActive ? 600 : 400 }}>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table header — hidden on mobile */}
          {!isMob && <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 130px 130px 110px 90px 50px", padding: "10px 18px", fontSize: 10.5, letterSpacing: "0.1em", color: "var(--ink-4)", textTransform: "uppercase", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-inset)" }}>
            <span>REF</span><span>PARTIES · PROPERTY</span><span>VALUE</span><span>DATES</span><span>STATUS</span><span>SIGN</span><span></span>
          </div>}
          <div style={{ overflow: "auto", flex: 1 }}>
            {filteredContracts.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12, color: "var(--ink-4)" }}>No contracts match your filters</div>
            ) : (
              filteredContracts.map((c) => <ContractRow key={c.ref} c={c} isMob={isMob} />)
            )}
          </div>
        </div>

        {/* Preview panel — hidden on compact */}
        {!isCompact && <aside className="sgi-card-elevated" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: 18, borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-paper)" }}>
            <div>
              <Eyebrow>Selected · awaiting signature</Eyebrow>
              <div className="font-display" style={{ fontSize: 20, marginTop: 4 }}>C-1283 · Sale Agreement</div>
            </div>
            <button className="sgi-btn sgi-btn-ghost" style={{ height: 32, padding: "0 10px" }}><IcMore /></button>
          </div>

          <div style={{ flex: 1, padding: 22, overflow: "auto", background: "var(--bg-cream)" }}>
            {/* Status banner */}
            <div style={{ padding: "10px 14px", background: "var(--gold-ghost)", border: "1px solid var(--gold-line)", borderRadius: "var(--r)", fontSize: 12, color: "var(--gold-deep)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span>Sent for signature · 2 days ago</span>
              <span className="tnum">0 / 2 signed</span>
            </div>

            {/* Document */}
            <div style={{ background: "var(--bg-ivory)", padding: 24, border: "1px solid var(--line-soft)", boxShadow: "var(--shadow-1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", paddingBottom: 18, borderBottom: "1px solid var(--line)" }}>
                <Wordmark subtitle={false} />
                <div style={{ textAlign: "end", fontSize: 10, color: "var(--ink-4)" }}>
                  <div className="font-mono">C-1283</div>
                  <div>Issued · 21 May 2026</div>
                </div>
              </div>
              <Eyebrow style={{ marginTop: 18 }}>Sale &amp; Purchase Agreement</Eyebrow>
              <div className="font-display" style={{ fontSize: 24, marginTop: 6 }}>Marina Gate · Tower 2, #4502</div>

              <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, fontSize: 12 }}>
                <PartyBox role="Seller" name="Infinity Holdings DMCC" id="License 712-2018" />
                <PartyBox role="Buyer" name="Anna Schmidt" id="Passport DE-89241 · DE" />
              </div>

              <div style={{ marginTop: 16, padding: 14, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", borderRadius: 6 }}>
                <div className="eyebrow">Subject</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6, marginTop: 4 }}>
                  Sale of property described as Unit 4502, Tower 2 of the Marina Gate development, Dubai Marina, comprising 2,150 ft² of built-up area.
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  ["Sale price",   "AED 4,750,000"],
                  ["Deposit · 10%","AED 475,000"],
                  ["DLD · 4%",     "AED 190,000"],
                  ["Commission",   "AED 99,750"],
                  ["Closing date", "12 Jun 2026"],
                  ["Title transfer","at DLD office"],
                ].map(([l, v]) => (
                  <div key={l} style={{ padding: "8px 10px", background: "var(--bg-cream)", borderRadius: 4 }}>
                    <div className="eyebrow">{l}</div>
                    <div className="tnum" style={{ fontSize: 13, fontWeight: 500, marginTop: 2 }}>{v}</div>
                  </div>
                ))}
              </div>

              {/* Signature blocks */}
              <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {[
                  { role: "Seller signature", name: "Infinity Holdings" },
                  { role: "Buyer signature",  name: "A. Schmidt" },
                ].map((s, i) => (
                  <div key={i} style={{ border: "1.5px dashed var(--gold-line)", borderRadius: 6, padding: 14, background: "var(--gold-ghost)", height: 90, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--gold-deep)", textTransform: "uppercase" }}>{s.role}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{s.name} · awaiting</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              <button className="sgi-btn sgi-btn-ghost" style={{ justifyContent: "center", height: 36 }}><IcDownload />&nbsp;PDF</button>
              <button className="sgi-btn sgi-btn-ghost" style={{ justifyContent: "center", height: 36 }}><IcMail />&nbsp;Re-send</button>
              <button className="sgi-btn sgi-btn-primary" style={{ justifyContent: "center", height: 36 }}>Sign</button>
            </div>

            {/* Audit log */}
            <div style={{ marginTop: 16 }}>
              <Eyebrow>Audit log</Eyebrow>
              <div style={{ marginTop: 8, fontSize: 11.5, color: "var(--ink-3)" }}>
                {[
                  "21 May · 09:14 · Sent to schmidt.a@gmail.com · IP 89.x.x.x",
                  "21 May · 09:13 · Generated from proposal P-2418 by Yasmine K.",
                  "20 May · 17:30 · Proposal accepted by Anna Schmidt",
                ].map((t, i) => (
                  <div key={i} className="font-mono" style={{ padding: "4px 0", fontSize: 10.5, borderTop: i ? "1px dashed var(--line)" : "none" }}>{t}</div>
                ))}
              </div>
            </div>
          </div>
        </aside>}
      </main>
    </div>
  );
}
