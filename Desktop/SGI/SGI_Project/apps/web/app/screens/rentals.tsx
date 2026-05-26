"use client";
import React, { useState, useRef } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Chip, StatusDot, IcFilter, IcPlus, IcChevR, IcMore, IcDownload, IcMail, IcCheck } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";

type Rental = {
  ref: string;
  unit: string;
  tenant: string;
  nationality: string;
  rent: string;
  rentRaw: number;
  start: string;
  end: string;
  nextPayment: string;
  status: string;
  agent: string;
  highlighted?: boolean;
};

const RENTALS: Rental[] = [
  { ref: "R-0841", unit: "JBR Sadaf · #2206",         tenant: "K. Mubarak",      nationality: "UAE", rent: "AED 220,000", rentRaw: 220000, start: "12 Apr 2026", end: "12 Apr 2027", nextPayment: "12 Jul 2026", status: "active",      agent: "Yasmine K." },
  { ref: "R-0840", unit: "Marina Promenade · #1102",   tenant: "P. Lemaire",      nationality: "FR",  rent: "AED 240,000", rentRaw: 240000, start: "01 Apr 2026", end: "31 Mar 2027", nextPayment: "01 Jul 2026", status: "active",      agent: "Omar R.", highlighted: true },
  { ref: "R-0839", unit: "Burj Vista · T1 #3401",      tenant: "L. Russo",        nationality: "IT",  rent: "AED 180,000", rentRaw: 180000, start: "08 Aug 2025", end: "08 Aug 2026", nextPayment: "08 Jun 2026", status: "expiring",    agent: "Yasmine K." },
  { ref: "R-0838", unit: "Palm Shoreline · #801",      tenant: "H. Wei",           nationality: "CN",  rent: "AED 320,000", rentRaw: 320000, start: "15 Mar 2026", end: "15 Mar 2027", nextPayment: "15 Jun 2026", status: "active",      agent: "Sara M." },
  { ref: "R-0837", unit: "Downtown Blvd · #2010",      tenant: "—",               nationality: "—",   rent: "AED 195,000", rentRaw: 195000, start: "—",           end: "—",           nextPayment: "—",           status: "vacant",      agent: "Omar R." },
  { ref: "R-0836", unit: "Business Bay · Canal #504",  tenant: "T. Nakamura",     nationality: "JP",  rent: "AED 165,000", rentRaw: 165000, start: "20 Jan 2026", end: "20 Jan 2027", nextPayment: "20 Jun 2026", status: "maintenance", agent: "Sara M." },
  { ref: "R-0835", unit: "JVC Bloom · #301",           tenant: "F. Al-Rashidi",   nationality: "UAE", rent: "AED 95,000",  rentRaw: 95000,  start: "01 Jun 2025", end: "01 Jun 2026", nextPayment: "—",           status: "expiring",    agent: "Yasmine K." },
  { ref: "R-0834", unit: "Dubai Hills · Grove #12",    tenant: "S. Sharma",       nationality: "IN",  rent: "AED 280,000", rentRaw: 280000, start: "10 Feb 2026", end: "10 Feb 2027", nextPayment: "10 Aug 2026", status: "active",      agent: "Omar R." },
];

const STATUS_MAP: Record<string, { label_en: string; label_ar: string; label_fr: string; tone: "gold" | "emerald" | "rose" | "azure" | undefined; c: string }> = {
  active:      { label_en: "Active",      label_ar: "نشط",         label_fr: "Actif",        tone: "emerald",   c: "var(--emerald)" },
  expiring:    { label_en: "Expiring",    label_ar: "ينتهي قريباً", label_fr: "Expire",       tone: "rose",      c: "var(--rose)" },
  vacant:      { label_en: "Vacant",      label_ar: "شاغر",        label_fr: "Vacant",       tone: undefined,   c: "var(--ink-4)" },
  maintenance: { label_en: "Maintenance", label_ar: "صيانة",       label_fr: "Maintenance",  tone: "azure",     c: "var(--azure)" },
};

/* ─── Filter types & helpers ─────────────────────────────────────────── */

type RentalFilter = {
  status: "all" | "active" | "expiring" | "vacant" | "maintenance";
  agent: "all" | string;
  rentRange: "all" | "u150k" | "150k-250k" | "o250k";
  nationality: "all" | string;
};

const DEFAULT_RENTAL_FILTER: RentalFilter = { status: "all", agent: "all", rentRange: "all", nationality: "all" };

function isRentalFilterActive(f: RentalFilter) {
  return f.status !== "all" || f.agent !== "all" || f.rentRange !== "all" || f.nationality !== "all";
}

function applyRentalFilters(rentals: Rental[], f: RentalFilter): Rental[] {
  return rentals.filter(r => {
    if (f.status !== "all" && r.status !== f.status) return false;
    if (f.agent !== "all" && r.agent !== f.agent) return false;
    if (f.rentRange !== "all") {
      if (f.rentRange === "u150k"     && r.rentRaw >= 150_000) return false;
      if (f.rentRange === "150k-250k" && (r.rentRaw < 150_000 || r.rentRaw >= 250_000)) return false;
      if (f.rentRange === "o250k"     && r.rentRaw < 250_000) return false;
    }
    if (f.nationality !== "all" && r.nationality !== f.nationality) return false;
    return true;
  });
}

const RENT_OPTS = [
  { label: "All rents",          value: "all"       },
  { label: "< AED 150K / yr",    value: "u150k"     },
  { label: "AED 150K – 250K",    value: "150k-250k" },
  { label: "> AED 250K / yr",    value: "o250k"     },
];

const STATUS_PILL_OPTS = [
  { label: "All leases",  value: "all"         },
  { label: "Active",      value: "active"      },
  { label: "Expiring",    value: "expiring"    },
  { label: "Vacant",      value: "vacant"      },
  { label: "Maintenance", value: "maintenance" },
];

const ALL_AGENTS      = ["Yasmine K.", "Omar R.", "Sara M."];
const ALL_NATIONALITIES = ["UAE", "FR", "IT", "CN", "JP", "IN"];

function rentRangeLabel(r: RentalFilter["rentRange"]): string {
  switch (r) {
    case "u150k":     return "< 150K";
    case "150k-250k": return "150K – 250K";
    case "o250k":     return "> 250K";
    default:          return "All";
  }
}

/* ─── RentalFilterPill ───────────────────────────────────────────────── */

function RentalFilterPill({
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

/* ─── RentalSnapshotBar ──────────────────────────────────────────────── */

function RentalSnapshotBar({ filter, onChange, total, filtered }: {
  filter: RentalFilter;
  onChange: (f: RentalFilter) => void;
  total: number;
  filtered: number;
}) {
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const active = isRentalFilterActive(filter);
  const activeCount = [filter.status !== "all", filter.agent !== "all", filter.rentRange !== "all", filter.nationality !== "all"].filter(Boolean).length;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isMob ? "8px 12px" : "10px 24px", background: "var(--bg-cream)", borderBottom: "1px solid var(--line-soft)", overflowX: "auto", flexShrink: 0, WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>

      <RentalFilterPill
        label="Status"
        displayValue={filter.status === "all" ? "All leases" : (STATUS_MAP[filter.status]?.label_en ?? filter.status)}
        value={filter.status}
        isActive={filter.status !== "all"}
        opts={STATUS_PILL_OPTS}
        onSelect={v => onChange({ ...filter, status: v as RentalFilter["status"] })}
      />

      <RentalFilterPill
        label="Agent"
        displayValue={filter.agent === "all" ? "All agents" : filter.agent.split(" ")[0]}
        value={filter.agent}
        isActive={filter.agent !== "all"}
        opts={[{ label: "All agents", value: "all" }, ...ALL_AGENTS.map(a => ({ label: a, value: a }))]}
        onSelect={v => onChange({ ...filter, agent: v })}
      />

      <RentalFilterPill
        label="Rent / yr"
        displayValue={rentRangeLabel(filter.rentRange)}
        value={filter.rentRange}
        isActive={filter.rentRange !== "all"}
        opts={RENT_OPTS}
        onSelect={v => onChange({ ...filter, rentRange: v as RentalFilter["rentRange"] })}
      />

      <RentalFilterPill
        label="Nationality"
        displayValue={filter.nationality === "all" ? "All" : filter.nationality}
        value={filter.nationality}
        isActive={filter.nationality !== "all"}
        opts={[{ label: "All nationalities", value: "all" }, ...ALL_NATIONALITIES.map(n => ({ label: n, value: n }))]}
        onSelect={v => onChange({ ...filter, nationality: v })}
      />

      {active && (
        <button onClick={() => onChange(DEFAULT_RENTAL_FILTER)}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, fontSize: 11, fontFamily: "Roboto, sans-serif", cursor: "pointer", border: "1px solid rgba(220,50,50,0.4)", background: "var(--bg-paper)", color: "var(--rose)", whiteSpace: "nowrap", flexShrink: 0 }}>
          Reset
          <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "var(--rose)", color: "#fff" }}>{activeCount}</span>
        </button>
      )}

      {!isMob && (
        <div style={{ marginInlineStart: "auto", fontSize: 11, color: active ? "var(--ink)" : "var(--ink-4)", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }} className="tnum">
          {active ? `${filtered} / ${total}` : `${total}`} leases
        </div>
      )}
    </div>
  );
}

/* ─── RentalRow ──────────────────────────────────────────────────────── */

function RentalRow({ r, isMob, lang, onSelect }: { r: Rental; isMob?: boolean; lang: string; onSelect?: () => void }) {
  const st = STATUS_MAP[r.status];
  const label = lang === "ar" ? st.label_ar : lang === "fr" ? st.label_fr : st.label_en;

  if (isMob) {
    return (
      <div onClick={onSelect} style={{ padding: "12px 16px", background: r.highlighted ? "var(--gold-ghost)" : "transparent", borderBottom: "1px solid var(--line-soft)", cursor: "pointer", position: "relative" }}>
        {r.highlighted && <div style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 2, background: "var(--gold)" }} />}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="font-mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.ref}</span>
            <Chip tone="azure">Rent</Chip>
          </div>
          <Chip tone={st.tone}><StatusDot tone={st.tone ?? "ink-4"} />&nbsp;{label}</Chip>
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)", marginBottom: 2 }}>{r.tenant}</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginBottom: 4 }}>{r.unit}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span className="font-display tnum" style={{ fontSize: 13 }}>{r.rent} / yr</span>
          <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{r.end}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "60px 1fr 130px 130px 110px 90px 40px",
      padding: "14px 18px",
      background: r.highlighted ? "var(--gold-ghost)" : "transparent",
      borderBottom: "1px solid var(--line-soft)",
      alignItems: "center", cursor: "pointer", fontSize: 12, position: "relative",
    }}>
      {r.highlighted && <div style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: 2, background: "var(--gold)" }} />}
      <span className="font-mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{r.ref}</span>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>{r.tenant}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{r.unit}</div>
      </div>
      <span className="font-display tnum" style={{ fontSize: 14 }}>{r.rent}</span>
      <div>
        <div style={{ fontSize: 11, color: "var(--ink-4)" }}>Until</div>
        <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 1 }}>{r.end}</div>
      </div>
      <Chip tone={st.tone}><StatusDot tone={st.tone ?? "ink-4"} />&nbsp;{label}</Chip>
      <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{r.agent}</span>
      <span style={{ color: "var(--ink-4)", justifySelf: "end" }}><IcChevR /></span>
    </div>
  );
}

function PaymentRow({ date, amount, status }: { date: string; amount: string; status: "paid" | "due" | "upcoming" }) {
  const colors = { paid: "var(--emerald)", due: "var(--rose)", upcoming: "var(--ink-4)" };
  const labels = { paid: "Paid", due: "Due", upcoming: "Scheduled" };
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderTop: "1px dashed var(--line)", fontSize: 11.5 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: colors[status], display: "inline-block", flexShrink: 0 }} />
        <span className="font-mono" style={{ color: "var(--ink-3)", fontSize: 10.5 }}>{date}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span className="tnum font-display" style={{ fontSize: 12 }}>{amount}</span>
        <span style={{ fontSize: 10, color: colors[status], fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{labels[status]}</span>
      </div>
    </div>
  );
}

export function ScreenRentals() {
  const t = useT();
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isCompact = bp !== "desktop";
  const [filter, setFilter] = useState<RentalFilter>(DEFAULT_RENTAL_FILTER);
  const [selRental, setSelRental] = useState<Rental | null>(null);

  const filteredRentals = applyRentalFilters(RENTALS, filter);
  const sel = filteredRentals.find((r) => r.highlighted) ?? filteredRentals[0] ?? RENTALS[0];
  const selSt = STATUS_MAP[sel.status];
  const selLabel = lang === "ar" ? selSt.label_ar : lang === "fr" ? selSt.label_fr : selSt.label_en;
  const monthly = new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency", maximumFractionDigits: 0 }).format(Math.round(sel.rentRaw / 12));

  const counters = [
    { key: "active",      en: "Active",      ar: "نشط",         fr: "Actif",       n: 28, c: "var(--emerald)" },
    { key: "expiring",    en: "Expiring · 90d", ar: "ينتهي قريباً", fr: "Expire · 90j", n: 6, c: "var(--rose)" },
    { key: "vacant",      en: "Vacant",      ar: "شاغر",        fr: "Vacant",      n: 4,  c: "var(--ink-4)" },
    { key: "maintenance", en: "Maintenance", ar: "صيانة",       fr: "Maintenance", n: 2,  c: "var(--azure)" },
    { key: "all",         en: "All",         ar: "الكل",        fr: "Tous",        n: 54, c: "var(--ink-3)" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_rental} crumb={isMob ? [] : [`${filteredRentals.length} leases`, "6 expiring soon"]}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcFilter />&nbsp;{t.filter}</button>}
        <button className="sgi-btn sgi-btn-primary"><IcPlus />&nbsp;{t.new_btn}</button>
      </Topbar>

      <RentalSnapshotBar
        filter={filter} onChange={setFilter}
        total={RENTALS.length} filtered={filteredRentals.length}
      />

      <main style={{ flex: 1, padding: isMob ? 14 : 24, display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 480px", gap: 16, background: "var(--bg-cream)", overflow: "hidden" }}>
        {/* List */}
        <div className="sgi-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Status counters strip — clicking syncs with Status pill */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: isMob ? 8 : 18, overflowX: "auto", flexWrap: "nowrap" }}>
            {counters.map((s) => {
              const label = lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en;
              const isActive = filter.status === s.key;
              const liveCount = s.key === "all" ? RENTALS.length : RENTALS.filter(r => r.status === s.key).length;
              return (
                <div key={s.key}
                  onClick={() => setFilter(f => ({ ...f, status: s.key as RentalFilter["status"] }))}
                  style={{ padding: "6px 12px", borderRadius: 6, background: isActive ? "color-mix(in srgb, " + s.c + " 10%, transparent)" : "transparent", borderInlineStart: "2px solid " + (isActive ? s.c : "var(--line-soft)"), cursor: "pointer", flexShrink: 0, transition: "background 0.15s, border-color 0.15s" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span className="font-display tnum" style={{ fontSize: 22, color: isActive ? s.c : "var(--ink-3)" }}>{liveCount}</span>
                    <span className={lang === "ar" ? "font-ar" : undefined} style={{ fontSize: lang === "ar" ? 13 : 11, color: isActive ? s.c : "var(--ink-4)", fontWeight: isActive ? 600 : 400 }}>{label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Table header — hidden on mobile */}
          {!isMob && (
            <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 130px 130px 110px 90px 40px", padding: "10px 18px", fontSize: 10.5, letterSpacing: "0.1em", color: "var(--ink-4)", textTransform: "uppercase", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-inset)" }}>
              <span>REF</span><span>TENANT · UNIT</span><span>RENT / YR</span><span>END DATE</span><span>STATUS</span><span>AGENT</span><span></span>
            </div>
          )}

          <div style={{ overflow: "auto", flex: 1 }}>
            {filteredRentals.length === 0 ? (
              <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12, color: "var(--ink-4)" }}>No leases match your filters</div>
            ) : (
              filteredRentals.map((r) => <RentalRow key={r.ref} r={r} isMob={isMob} lang={lang} onSelect={isMob ? () => setSelRental(r) : undefined} />)
            )}
          </div>
        </div>

        {/* Mobile rental detail — bottom sheet */}
        {isMob && selRental && (() => {
          const st  = STATUS_MAP[selRental.status];
          const lbl = lang === "ar" ? st.label_ar : lang === "fr" ? st.label_fr : st.label_en;
          const mo  = new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency", maximumFractionDigits: 0 }).format(Math.round(selRental.rentRaw / 12));
          return (
            <>
              <div onClick={() => setSelRental(null)} style={{ position: "fixed", inset: 0, background: "rgba(10,8,6,0.45)", zIndex: 400, backdropFilter: "blur(2px)" }} />
              <div style={{ position: "fixed", insetInlineStart: 0, insetInlineEnd: 0, bottom: 0, zIndex: 401, background: "var(--bg-ivory)", borderRadius: "14px 14px 0 0", boxShadow: "0 -4px 32px rgba(0,0,0,0.18)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* Handle */}
                <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 4px" }}>
                  <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--line-strong)" }} />
                </div>
                {/* Header */}
                <div style={{ padding: "8px 18px 14px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                      <span className="font-mono" style={{ fontSize: 11, color: "var(--ink-3)" }}>{selRental.ref}</span>
                      <Chip tone="azure">Rent</Chip>
                      <Chip tone={st.tone}><StatusDot tone={st.tone ?? "ink-4"} />&nbsp;{lbl}</Chip>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{selRental.unit}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{selRental.tenant} · {selRental.nationality}</div>
                  </div>
                  <button onClick={() => setSelRental(null)} style={{ width: 30, height: 30, borderRadius: 6, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
                </div>
                {/* Body */}
                <div style={{ flex: 1, overflowY: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                  {/* Status banners */}
                  {selRental.status === "expiring" && (
                    <div style={{ padding: "10px 14px", background: "color-mix(in srgb, var(--rose) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--rose) 25%, transparent)", borderRadius: "var(--r)", fontSize: 12, color: "var(--rose)", display: "flex", justifyContent: "space-between" }}>
                      <span>Bail expirant · renouvellement recommandé</span>
                      <span className="tnum">90 j</span>
                    </div>
                  )}
                  {selRental.status === "maintenance" && (
                    <div style={{ padding: "10px 14px", background: "color-mix(in srgb, var(--azure) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--azure) 25%, transparent)", borderRadius: "var(--r)", fontSize: 12, color: "var(--azure)", display: "flex", justifyContent: "space-between" }}>
                      <span>Unité en maintenance · loyers suspendus</span>
                      <span className="tnum">depuis 20 Jan</span>
                    </div>
                  )}
                  {selRental.status === "vacant" && (
                    <div style={{ padding: "10px 14px", background: "var(--bg-inset)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", fontSize: 12, color: "var(--ink-3)", display: "flex", justifyContent: "space-between" }}>
                      <span>Unité vacante · disponible à la relocation</span>
                      <span className="tnum">0 j occupé</span>
                    </div>
                  )}
                  {/* Financial summary */}
                  <div>
                    <Eyebrow style={{ marginBottom: 8 }}>Résumé financier</Eyebrow>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {[
                        ["Loyer annuel",   selRental.rent + " / an"],
                        ["Équiv. mensuel", mo + " / mois"],
                        ["Caution",        mo + " (1 mois)"],
                        ["Prochain pmt",   selRental.nextPayment],
                        ["Début bail",     selRental.start],
                        ["Fin bail",       selRental.end],
                      ].map(([l, v]) => (
                        <div key={l} style={{ padding: "8px 10px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 4 }}>
                          <div className="eyebrow">{l}</div>
                          <div className="tnum" style={{ fontSize: 12, fontWeight: 500, marginTop: 2, color: "var(--ink)" }}>{v}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* Payment history */}
                  <div>
                    <Eyebrow style={{ marginBottom: 8 }}>Historique paiements</Eyebrow>
                    <PaymentRow date="01 Apr 2026" amount={mo} status="paid" />
                    <PaymentRow date="01 Jan 2026" amount={mo} status="paid" />
                    <PaymentRow date="01 Oct 2025" amount={mo} status="paid" />
                    <PaymentRow date={selRental.nextPayment !== "—" ? selRental.nextPayment : "—"} amount={mo} status={selRental.status === "expiring" ? "due" : "upcoming"} />
                  </div>
                  {/* Agent */}
                  <div style={{ padding: "10px 14px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "var(--ink-4)" }}>Agent</span>
                    <span style={{ fontWeight: 500, color: "var(--ink)" }}>{selRental.agent}</span>
                  </div>
                  {/* Actions */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, paddingBottom: 8 }}>
                    <button className="sgi-btn sgi-btn-ghost" style={{ justifyContent: "center", height: 40 }}><IcDownload />&nbsp;PDF</button>
                    <button className="sgi-btn sgi-btn-ghost" style={{ justifyContent: "center", height: 40 }}><IcMail />&nbsp;Notifier</button>
                    <button className="sgi-btn sgi-btn-primary" style={{ justifyContent: "center", height: 40 }}>Renouveler</button>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        {/* Preview panel — hidden on compact */}
        {!isCompact && (
          <aside className="sgi-card-elevated" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: 18, borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg-paper)" }}>
              <div>
                <Eyebrow>Selected · {selLabel.toLowerCase()}</Eyebrow>
                <div className="font-display" style={{ fontSize: 20, marginTop: 4 }}>{sel.ref} · {sel.unit}</div>
              </div>
              <button className="sgi-btn sgi-btn-ghost" style={{ height: 32, padding: "0 10px" }}><IcMore /></button>
            </div>

            <div style={{ flex: 1, padding: 22, overflow: "auto", background: "var(--bg-cream)" }}>
              {/* Status banner */}
              {sel.status === "expiring" && (
                <div style={{ padding: "10px 14px", background: "color-mix(in srgb, var(--rose) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--rose) 25%, transparent)", borderRadius: "var(--r)", fontSize: 12, color: "var(--rose)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span>Lease expiring · renewal recommended</span>
                  <span className="tnum">90 days</span>
                </div>
              )}
              {sel.status === "maintenance" && (
                <div style={{ padding: "10px 14px", background: "color-mix(in srgb, var(--azure) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--azure) 25%, transparent)", borderRadius: "var(--r)", fontSize: 12, color: "var(--azure)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span>Unit under maintenance · rents paused</span>
                  <span className="tnum">since 20 Jan</span>
                </div>
              )}
              {sel.status === "vacant" && (
                <div style={{ padding: "10px 14px", background: "var(--bg-inset)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", fontSize: 12, color: "var(--ink-3)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                  <span>Unit vacant · available for listing</span>
                  <span className="tnum">0 days occupied</span>
                </div>
              )}

              {/* Tenant card */}
              <div style={{ padding: 14, background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 6, marginBottom: 14 }}>
                <Eyebrow>Tenant</Eyebrow>
                <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{sel.tenant}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 2 }}>Nationality: {sel.nationality}</div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>Agent: {sel.agent}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="sgi-btn sgi-btn-ghost" style={{ height: 28, padding: "0 8px" }}><IcMail /></button>
                  </div>
                </div>
              </div>

              {/* Financial summary */}
              <div style={{ marginBottom: 14 }}>
                <Eyebrow style={{ marginBottom: 8 }}>Financial summary</Eyebrow>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {[
                    ["Annual rent",    sel.rent + " / yr"],
                    ["Monthly equiv.", monthly + " / mo"],
                    ["Security dep.",  new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency", maximumFractionDigits: 0 }).format(sel.rentRaw / 12) + " (1 mo)"],
                    ["Next payment",   sel.nextPayment],
                    ["Lease start",    sel.start],
                    ["Lease end",      sel.end],
                  ].map(([l, v]) => (
                    <div key={l} style={{ padding: "8px 10px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 4 }}>
                      <div className="eyebrow">{l}</div>
                      <div className="tnum" style={{ fontSize: 12.5, fontWeight: 500, marginTop: 2, color: "var(--ink)" }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment history */}
              <div style={{ marginBottom: 16 }}>
                <Eyebrow style={{ marginBottom: 8 }}>Payment history</Eyebrow>
                <PaymentRow date="01 Apr 2026" amount={monthly} status="paid" />
                <PaymentRow date="01 Jan 2026" amount={monthly} status="paid" />
                <PaymentRow date="01 Oct 2025" amount={monthly} status="paid" />
                <PaymentRow date={sel.nextPayment !== "—" ? sel.nextPayment : "—"} amount={monthly} status={sel.status === "expiring" ? "due" : "upcoming"} />
              </div>

              {/* Actions */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                <button className="sgi-btn sgi-btn-ghost" style={{ justifyContent: "center", height: 36 }}><IcDownload />&nbsp;PDF</button>
                <button className="sgi-btn sgi-btn-ghost" style={{ justifyContent: "center", height: 36 }}><IcMail />&nbsp;Notify</button>
                <button className="sgi-btn sgi-btn-primary" style={{ justifyContent: "center", height: 36 }}>Renew</button>
              </div>
            </div>
          </aside>
        )}
      </main>
    </div>
  );
}
