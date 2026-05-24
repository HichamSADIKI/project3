"use client";
import React from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Chip, StatusDot, Wordmark, IcFilter, IcPlus, IcChevR, IcMore, IcDownload, IcMail } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";

type Contract = {
  ref: string; type: string; parties: string; value: string;
  d1: string; d2: string; status: string; sign: string;
  gold?: boolean; highlighted?: boolean;
};

const CONTRACTS: Contract[] = [
  { ref: "C-1284", type: "Sale", parties: "Y. Demir → Marina Gate #4502",    value: "AED 4,750,000",    d1: "Signed 12 May", d2: "Funds 28 May", status: "active",   sign: "2/2", gold: true },
  { ref: "C-1283", type: "Sale", parties: "A. Schmidt → Marina Gate T2",      value: "AED 4,750,000",    d1: "Sent 21 May",   d2: "—",             status: "pending",  sign: "0/2", highlighted: true },
  { ref: "C-1282", type: "Sale", parties: "Family Tanaka → Bluewaters B12",   value: "AED 11,800,000",   d1: "Sent 19 May",   d2: "—",             status: "pending",  sign: "1/2" },
  { ref: "C-1281", type: "Rent", parties: "K. Mubarak → JBR Sadaf #2206",     value: "AED 220,000 / yr", d1: "Active until",  d2: "12 Apr 2027",   status: "active",   sign: "2/2" },
  { ref: "C-1280", type: "Sale", parties: "M. Bin Saud → Saadiyat Villa 32",  value: "AED 28,000,000",   d1: "Signed 04 May", d2: "Funds 22 May",  status: "active",   sign: "2/2", gold: true },
  { ref: "C-1279", type: "Rent", parties: "L. Russo → Burj Vista 1",          value: "AED 180,000 / yr", d1: "Expires",       d2: "08 Aug 2026",   status: "expiring", sign: "2/2" },
  { ref: "C-1278", type: "Sale", parties: "H. Wei → Palm Shoreline 12",       value: "AED 8,400,000",    d1: "Draft",         d2: "—",             status: "draft",    sign: "0/2" },
  { ref: "C-1277", type: "Rent", parties: "P. Lemaire → Marina Promenade",    value: "AED 240,000 / yr", d1: "Active until",  d2: "31 Mar 2027",   status: "active",   sign: "2/2" },
];

const STATUS_MAP: Record<string, { label: string; tone: "gold" | "emerald" | "rose" | undefined; c: string }> = {
  draft:    { label: "Draft",    tone: undefined,  c: "var(--ink-4)" },
  pending:  { label: "Awaiting", tone: "gold",     c: "var(--gold)" },
  active:   { label: "Active",   tone: "emerald",  c: "var(--emerald)" },
  expiring: { label: "Expiring", tone: "rose",     c: "var(--rose)" },
};

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
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_contract} crumb={["48 active", "4 awaiting signature"]}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost"><IcFilter />&nbsp;{t.filter}</button>}
        <button className="sgi-btn sgi-btn-primary"><IcPlus />&nbsp;{t.new_btn}</button>
      </Topbar>

      <main style={{ flex: 1, padding: isMob ? 14 : 24, display: "grid", gridTemplateColumns: isCompact ? "1fr" : "1fr 480px", gap: 16, background: "var(--bg-cream)", overflow: "hidden" }}>
        {/* List */}
        <div className="sgi-card" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Status counters */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: isMob ? 8 : 18, overflowX: "auto", flexWrap: "nowrap" }}>
            {[
              { en: "Draft",          ar: "مسودة",    fr: "Brouillon",     n: 6,   c: "var(--ink-4)" },
              { en: "Awaiting sign",  ar: "بانتظار التوقيع", fr: "En attente",  n: 4,   c: "var(--gold)",    active: true },
              { en: "Active",         ar: "نشط",       fr: "Actif",         n: 32,  c: "var(--emerald)" },
              { en: "Expiring · 90d", ar: "ينتهي",    fr: "Expire · 90j",  n: 8,   c: "var(--rose)" },
              { en: "Closed",         ar: "مغلق",      fr: "Clôturé",       n: 124, c: "var(--ink-3)" },
            ].map((s) => (
              <div key={s.en} style={{ padding: "6px 12px", borderRadius: 6, background: s.active ? "var(--gold-ghost)" : "transparent", borderInlineStart: "2px solid " + s.c, cursor: "pointer", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span className="font-display tnum" style={{ fontSize: 22, color: s.c }}>{s.n}</span>
                  <span className={lang === "ar" ? "font-ar" : undefined} style={{ fontSize: lang === "ar" ? 13 : 11, color: "var(--ink-3)", fontWeight: 500 }}>
                    {lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Table header — hidden on mobile */}
          {!isMob && <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 130px 130px 110px 90px 50px", padding: "10px 18px", fontSize: 10.5, letterSpacing: "0.1em", color: "var(--ink-4)", textTransform: "uppercase", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-inset)" }}>
            <span>REF</span><span>PARTIES · PROPERTY</span><span>VALUE</span><span>DATES</span><span>STATUS</span><span>SIGN</span><span></span>
          </div>}
          <div style={{ overflow: "auto", flex: 1 }}>
            {CONTRACTS.map((c) => <ContractRow key={c.ref} c={c} isMob={isMob} />)}
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
