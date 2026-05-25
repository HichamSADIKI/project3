"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Chip, StatusDot, IcFilter, IcPlus, IcChevR, IcMore, IcDownload, IcMail } from "@/components/sgi-ui";
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

function RentalRow({ r, isMob, lang }: { r: Rental; isMob?: boolean; lang: string }) {
  const st = STATUS_MAP[r.status];
  const label = lang === "ar" ? st.label_ar : lang === "fr" ? st.label_fr : st.label_en;

  if (isMob) {
    return (
      <div style={{ padding: "12px 16px", background: r.highlighted ? "var(--gold-ghost)" : "transparent", borderBottom: "1px solid var(--line-soft)", cursor: "pointer", position: "relative" }}>
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
  const [activeFilter, setActiveFilter] = useState("active");

  const sel = RENTALS.find((r) => r.highlighted) ?? RENTALS[0];
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
      <Topbar title={t.t_rental} crumb={["54 leases", "6 expiring soon"]}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcFilter />&nbsp;{t.filter}</button>}
        <button className="sgi-btn sgi-btn-primary"><IcPlus />&nbsp;{t.new_btn}</button>
      </Topbar>

      <main style={{ flex: 1, padding: isMob ? 14 : 24, display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 480px", gap: 16, background: "var(--bg-cream)", overflow: "hidden" }}>
        {/* List */}
        <div className="sgi-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Status counters strip */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: isMob ? 8 : 18, overflowX: "auto", flexWrap: "nowrap" }}>
            {counters.map((s) => {
              const label = lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en;
              const isActive = activeFilter === s.key;
              return (
                <div key={s.key} onClick={() => setActiveFilter(s.key)} style={{ padding: "6px 12px", borderRadius: 6, background: isActive ? "color-mix(in srgb, " + s.c + " 10%, transparent)" : "transparent", borderInlineStart: "2px solid " + s.c, cursor: "pointer", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span className="font-display tnum" style={{ fontSize: 22, color: s.c }}>{s.n}</span>
                    <span className={lang === "ar" ? "font-ar" : undefined} style={{ fontSize: lang === "ar" ? 13 : 11, color: "var(--ink-3)", fontWeight: 500 }}>{label}</span>
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
            {RENTALS.map((r) => <RentalRow key={r.ref} r={r} isMob={isMob} lang={lang} />)}
          </div>
        </div>

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
