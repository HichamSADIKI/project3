"use client";
import React, { useState, useRef } from "react";
import { Topbar, Eyebrow, Chip, IcFilter, IcPlus, IcCheck, IcClock, IcPhone, IcMail, IcSearch } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint, type Breakpoint } from "@/lib/hooks";

/* ─── Stages ────────────────────────────────────────────────────────── */

const STAGES = [
  { key: "new",         ar: "جديد",       en: "New",         fr: "Nouveau",     color: "var(--ink-4)" },
  { key: "contacted",   ar: "تم التواصل", en: "Contacted",   fr: "Contacté",    color: "var(--azure)" },
  { key: "qualified",   ar: "مؤهَّل",      en: "Qualified",   fr: "Qualifié",    color: "var(--gold)" },
  { key: "proposal",    ar: "عرض سعر",   en: "Proposal",    fr: "Proposition", color: "var(--gold-deep)" },
  { key: "negotiation", ar: "تفاوض",     en: "Negotiation", fr: "Négociation", color: "var(--ink)" },
  { key: "won",         ar: "مغلق",      en: "Won",         fr: "Conclu",      color: "var(--emerald)" },
];

/* ─── Types ─────────────────────────────────────────────────────────── */

type FollowUpStep = "pending" | "done" | "late";
type FollowUp = { j1: FollowUpStep; j2: FollowUpStep; j4: FollowUpStep; j7: FollowUpStep };
type ActivityType = "call" | "whatsapp" | "email" | "visit" | "note";
type Activity = { id: string; type: ActivityType; text: string; at: string; by?: string };

type FilterState = {
  query: string;
  agent: "all" | "YK" | "OB";
  scoreMin: number;
  goldOnly: boolean;
  coldOnly: boolean;
};

const DEFAULT_FILTER: FilterState = { query: "", agent: "all", scoreMin: 0, goldOnly: false, coldOnly: false };

function isFilterActive(f: FilterState) {
  return f.query !== "" || f.agent !== "all" || f.scoreMin > 0 || f.goldOnly || f.coldOnly;
}

function applyFilters(all: Record<string, Lead[]>, f: FilterState): Record<string, Lead[]> {
  if (!isFilterActive(f)) return all;
  const q = f.query.toLowerCase().trim();
  return Object.fromEntries(
    Object.entries(all).map(([stage, leads]) => [
      stage,
      leads.filter(l => {
        if (q) {
          const hit =
            l.name.toLowerCase().includes(q) ||
            (l.email ?? "").toLowerCase().includes(q) ||
            (l.phone ?? "").toLowerCase().includes(q) ||
            l.ctry.toLowerCase().includes(q) ||
            l.prop.toLowerCase().includes(q);
          if (!hit) return false;
        }
        if (f.agent !== "all" && l.agent !== f.agent) return false;
        if (f.scoreMin > 0 && l.score < f.scoreMin) return false;
        if (f.goldOnly && !l.gold) return false;
        if (f.coldOnly && (l.lastContactDays ?? 0) <= 5) return false;
        return true;
      }),
    ])
  );
}

type Lead = {
  id: string; name: string; ctry: string; budget: number; prop: string; score: number;
  days: string; agent: string; channel: string; gold?: boolean; proposal?: string; final?: string;
  phone?: string; email?: string; notes?: string;
  followUp?: FollowUp;
  activities?: Activity[];
  lastContactDays?: number;
  lostReason?: string;
};

/* ─── Constants ─────────────────────────────────────────────────────── */

const DEFAULT_FOLLOW_UP: FollowUp = { j1: "pending", j2: "pending", j4: "pending", j7: "pending" };

const FOLLOW_UP_STEPS: { key: keyof FollowUp; day: string; label: string; actType: ActivityType }[] = [
  { key: "j1", day: "J+1", label: "Phone call",      actType: "call" },
  { key: "j2", day: "J+2", label: "WhatsApp",        actType: "whatsapp" },
  { key: "j4", day: "J+4", label: "Email",           actType: "email" },
  { key: "j7", day: "J+7", label: "Push + WhatsApp", actType: "whatsapp" },
];

const ACTIVITY_META: Record<ActivityType, { label: string; color: string; bg: string; defaultText: string }> = {
  call:     { label: "Call",     color: "var(--ink)",       bg: "var(--bg-inset)",       defaultText: "Outbound call" },
  whatsapp: { label: "WhatsApp", color: "#25d366",          bg: "rgba(37,211,102,0.08)", defaultText: "WhatsApp message sent" },
  email:    { label: "Email",    color: "var(--azure)",     bg: "var(--bg-inset)",       defaultText: "Email sent" },
  visit:    { label: "Visit",    color: "var(--gold-deep)", bg: "var(--gold-ghost)",     defaultText: "Property visit" },
  note:     { label: "Note",     color: "var(--ink-3)",     bg: "var(--bg-inset)",       defaultText: "Note" },
};

/* ─── Data ───────────────────────────────────────────────────────────── */

const LEADS_INIT: Record<string, Lead[]> = {
  new: [
    { id: "l1", name: "Khalid Al-Hashimi", ctry: "🇦🇪 UAE", budget: 6500000,  prop: "2–3BR Marina",    score: 42, days: "today", agent: "YK", channel: "WhatsApp", phone: "+971 50 234 5678", email: "k.hashimi@gmail.com",  lastContactDays: 0, followUp: { j1: "pending", j2: "pending", j4: "pending", j7: "pending" } },
    { id: "l2", name: "Maria Petrova",     ctry: "🇷🇺 RUS", budget: 3200000,  prop: "Studio Downtown", score: 28, days: "today", agent: "OB", channel: "Web",       phone: "+7 916 234 5678",  email: "m.petrova@mail.ru",    lastContactDays: 0, followUp: { j1: "pending", j2: "pending", j4: "pending", j7: "pending" } },
    { id: "l3", name: "Liam O'Connor",     ctry: "🇮🇪 IRL", budget: 1800000,  prop: "Rent JBR",        score: 22, days: "1d",    agent: "—",  channel: "Form",      phone: "+353 87 234 5678",                                lastContactDays: 6, followUp: { j1: "late",    j2: "pending", j4: "pending", j7: "pending" } },
  ],
  contacted: [
    { id: "l4", name: "Aisha Mohammed",  ctry: "🇸🇦 KSA", budget: 12000000, prop: "Villa Bluewaters", score: 78, days: "2d", agent: "YK", channel: "Phone",    phone: "+966 55 234 5678", email: "aisha.m@outlook.com",  gold: true, lastContactDays: 2, followUp: { j1: "done", j2: "pending", j4: "pending", j7: "pending" }, activities: [{ id: "a4a", type: "call",     text: "Initial qualifying call — interested in Bluewaters villa",          at: "2026-05-21T10:30:00", by: "YK" }] },
    { id: "l5", name: "Pierre Lemaire",  ctry: "🇫🇷 FRA", budget: 4500000,  prop: "Marina duplex",   score: 56, days: "3d", agent: "OB", channel: "WhatsApp", phone: "+33 6 12 34 56 78", email: "p.lemaire@gmail.com",  lastContactDays: 1, followUp: { j1: "done", j2: "done",    j4: "pending", j7: "pending" }, activities: [{ id: "a5a", type: "whatsapp", text: "WhatsApp sent — Marina duplex brochure shared",                     at: "2026-05-22T14:00:00", by: "OB" }, { id: "a5b", type: "call", text: "First contact call — confirmed budget AED 4.5M", at: "2026-05-21T10:00:00", by: "OB" }] },
    { id: "l6", name: "Hu Wei",          ctry: "🇨🇳 CHN", budget: 8000000,  prop: "Palm view",       score: 64, days: "4d", agent: "YK", channel: "Email",    phone: "+86 138 0013 8000", email: "hu.wei@163.com",       gold: true, lastContactDays: 7, followUp: { j1: "done", j2: "done",    j4: "late",    j7: "pending" }, activities: [{ id: "a6a", type: "email",    text: "Introduction email with Palm listings sent",                       at: "2026-05-19T09:00:00", by: "YK" }, { id: "a6b", type: "call", text: "First contact call", at: "2026-05-20T11:00:00", by: "YK" }] },
  ],
  qualified: [
    { id: "l7", name: "Sofia Russo",     ctry: "🇮🇹 ITA", budget: 5800000,  prop: "Downtown 2BR",   score: 71, days: "5d", agent: "OB", channel: "Phone",    phone: "+39 333 234 5678", email: "sofia.r@gmail.com",   gold: true, lastContactDays: 5, followUp: { j1: "done", j2: "done",    j4: "pending", j7: "pending" }, activities: [{ id: "a7a", type: "whatsapp", text: "Sent shortlist of 3 Downtown properties",                          at: "2026-05-19T15:30:00", by: "OB" }, { id: "a7b", type: "call", text: "Qualifying call — budget AED 5.8M confirmed, prefers Downtown 2BR", at: "2026-05-18T11:00:00", by: "OB" }] },
    { id: "l8", name: "Mohammed Bin S.", ctry: "🇸🇦 KSA", budget: 22000000, prop: "Saadiyat Villa", score: 92, days: "8d", agent: "YK", channel: "Referral", phone: "+966 50 234 5678", email: "mbs@binsa.ae",        gold: true, lastContactDays: 2, followUp: { j1: "done", j2: "done",    j4: "done",    j7: "pending" }, activities: [{ id: "a8a", type: "email",    text: "Formal proposal email with financial breakdown",                   at: "2026-05-18T09:00:00", by: "YK" }, { id: "a8b", type: "whatsapp", text: "Sent Saadiyat Villa brochure", at: "2026-05-16T12:00:00", by: "YK" }, { id: "a8c", type: "call", text: "First contact — referred by Al-Maktoum family", at: "2026-05-15T10:00:00", by: "YK" }] },
  ],
  proposal: [
    { id: "l9",  name: "Anna Schmidt", ctry: "🇩🇪 DEU", budget: 7400000, prop: "Marina Gate T2", score: 84, days: "12d", agent: "YK", channel: "Visit", phone: "+49 176 234 5678", email: "anna.schmidt@gmail.com", gold: true, proposal: "AED 4.75M", lastContactDays: 1, followUp: { j1: "done", j2: "done", j4: "done", j7: "done" }, activities: [{ id: "a9a", type: "email",   text: "Sent formal purchase proposal at AED 4.75M",                        at: "2026-05-14T10:00:00", by: "YK" }, { id: "a9b", type: "visit", text: "Property visit — Marina Gate Tower 2 #4502", at: "2026-05-12T14:00:00", by: "YK" }] },
    { id: "l10", name: "Rahul Mehta",  ctry: "🇮🇳 IND", budget: 3900000, prop: "Burj Vista 1",   score: 67, days: "9d",  agent: "OB", channel: "Email", phone: "+91 98200 12345",  email: "rahul.m@hotmail.com",   proposal: "AED 2.1M",              lastContactDays: 8, followUp: { j1: "done", j2: "done", j4: "done", j7: "late" },    activities: [{ id: "a10a", type: "email",   text: "Proposal sent — Burj Vista unit 1, AED 2.1M",                       at: "2026-05-15T11:00:00", by: "OB" }] },
  ],
  negotiation: [
    { id: "l11", name: "Family Tanaka", ctry: "🇯🇵 JPN", budget: 11000000, prop: "Bluewaters #B12", score: 88, days: "18d", agent: "YK", channel: "Visit", phone: "+81 90 2345 6789", email: "tanaka.family@gmail.com", gold: true, proposal: "AED 12.5M → 11.8M", lastContactDays: 1, followUp: { j1: "done", j2: "done", j4: "done", j7: "done" }, activities: [{ id: "a11a", type: "whatsapp", text: "Revised proposal — AED 12.5M → 11.8M accepted in principle",       at: "2026-05-18T09:30:00", by: "YK" }, { id: "a11b", type: "call",    text: "Negotiation call — counter at AED 11.8M",                    at: "2026-05-08T15:00:00", by: "YK" }, { id: "a11c", type: "visit",   text: "Property visit — Bluewaters #B12",                           at: "2026-05-05T10:00:00", by: "YK" }] },
  ],
  won: [
    { id: "l12", name: "Yusuf Demir", ctry: "🇹🇷 TUR", budget: 6500000, prop: "Marina Gate #4502", score: 95, days: "22d", agent: "YK", channel: "Signed", phone: "+90 532 234 5678", email: "y.demir@gmail.com", gold: true, final: "AED 4.75M", lastContactDays: 0, followUp: { j1: "done", j2: "done", j4: "done", j7: "done" }, activities: [{ id: "a12a", type: "note",  text: "Contract signed! AED 4.75M. Golden Visa eligible — launching GV workflow.", at: "2026-05-12T16:00:00", by: "YK" }, { id: "a12b", type: "call",  text: "Contract discussion and final agreement",                                    at: "2026-05-05T14:00:00", by: "YK" }, { id: "a12c", type: "visit", text: "Property visit — Marina Gate #4502",                                         at: "2026-05-01T11:00:00", by: "YK" }] },
  ],
};

/* ─── Utils ─────────────────────────────────────────────────────────── */

function calcScore(budget: number, hasPhone: boolean, hasEmail: boolean, prop: string): number {
  let s = 10;
  if (budget >= 2_000_000) s += 25;
  else if (budget >= 500_000) s += 15;
  if (prop.trim()) s += 15;
  if (hasPhone && hasEmail) s += 10;
  return Math.min(100, s);
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const day = d.getDate();
    const month = d.toLocaleString("en-AE", { month: "short" });
    const time = d.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit", hour12: false });
    return `${day} ${month} · ${time}`;
  } catch {
    return iso;
  }
}

function makeActivity(type: ActivityType, agent: string, text?: string): Activity {
  return {
    id: `act_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type,
    text: text ?? ACTIVITY_META[type].defaultText,
    at: new Date().toISOString(),
    by: agent !== "—" ? agent : undefined,
  };
}

/* ─── Icons ─────────────────────────────────────────────────────────── */

function IcWhatsApp() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function activityIcon(type: ActivityType) {
  if (type === "call")     return <IcPhone />;
  if (type === "whatsapp") return <IcWhatsApp />;
  if (type === "email")    return <IcMail />;
  if (type === "visit")    return <span style={{ fontSize: 11 }}>🏠</span>;
  return <span style={{ fontSize: 11 }}>📝</span>;
}


/* ─── Export CSV ────────────────────────────────────────────────────── */

const LOST_REASONS = ["Budget", "Timeline", "Competitor", "Unreachable", "Out of market", "Other"];

function exportCSV(filteredLeads: Record<string, Lead[]>) {
  const rows: string[][] = [["Name", "Country", "Budget (AED)", "Score", "Agent", "Stage", "Channel", "Lost reason"]];
  for (const [stage, leads] of Object.entries(filteredLeads)) {
    for (const l of leads) {
      rows.push([
        l.name,
        l.ctry.replace(/\p{Emoji}/gu, "").trim(),
        String(l.budget),
        String(l.score),
        l.agent,
        stage,
        l.channel,
        l.lostReason ?? "",
      ]);
    }
  }
  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `crm-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─── FilterBar ─────────────────────────────────────────────────────── */

const SCORE_STEPS = [0, 40, 60, 75, 90];

function FilterBar({ filter, onChange, totalCount, filteredCount }: {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}) {
  const bp    = useBreakpoint();
  const isMob = bp === "mobile";
  const active = isFilterActive(filter);
  const nextScore = () => {
    const idx = SCORE_STEPS.indexOf(filter.scoreMin);
    onChange({ ...filter, scoreMin: SCORE_STEPS[(idx + 1) % SCORE_STEPS.length] });
  };

  const chipBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 10px", borderRadius: 999, fontSize: 11,
    fontFamily: "Inter, sans-serif", cursor: "pointer", border: "1px solid var(--line-soft)",
    background: "var(--bg-paper)", color: "var(--ink-3)", whiteSpace: "nowrap", flexShrink: 0,
  };
  const chipOn: React.CSSProperties = {
    ...chipBase, background: "var(--ink)", color: "var(--gold)", borderColor: "var(--ink)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-cream)", borderBottom: "1px solid var(--line-soft)", flexShrink: 0 }}>

      {/* Search row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isMob ? "8px 12px" : "8px 24px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, border: "1px solid " + (filter.query ? "var(--ink)" : "var(--line-soft)"), background: "var(--bg-paper)", flex: 1 }}>
          <IcSearch />
          <input
            value={filter.query}
            onChange={e => onChange({ ...filter, query: e.target.value })}
            placeholder="Name, email, country, property…"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: "var(--ink)", fontFamily: "Inter, sans-serif", width: "100%" }}
          />
          {filter.query && (
            <button onClick={() => onChange({ ...filter, query: "" })}
              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-4)", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
          )}
        </div>
        {/* Count — mobile: inline with search */}
        {isMob && (
          <div style={{ fontSize: 11, color: active ? "var(--ink)" : "var(--ink-4)", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }} className="tnum">
            {active ? `${filteredCount}/${totalCount}` : totalCount}
          </div>
        )}
      </div>

      {/* Chips row — scrollable on mobile */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: isMob ? "4px 12px 8px" : "0 24px 8px", overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>

        {/* Agent toggle */}
        <div style={{ display: "flex", gap: 2, background: "var(--bg-inset)", borderRadius: 999, padding: 2, flexShrink: 0 }}>
          {(["all", "YK", "OB"] as const).map(a => (
            <button key={a} onClick={() => onChange({ ...filter, agent: a })}
              style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11, fontFamily: "Inter, sans-serif", border: "none", cursor: "pointer", fontWeight: filter.agent === a ? 700 : 400, background: filter.agent === a ? "var(--ink)" : "transparent", color: filter.agent === a ? "var(--gold)" : "var(--ink-3)", transition: "all 0.15s", whiteSpace: "nowrap" }}>
              {a === "all" ? "All" : a}
            </button>
          ))}
        </div>

        <button onClick={nextScore} style={filter.scoreMin > 0 ? chipOn : chipBase}>
          Score ≥ {filter.scoreMin > 0 ? filter.scoreMin : "—"}
        </button>

        <button onClick={() => onChange({ ...filter, goldOnly: !filter.goldOnly })}
          style={filter.goldOnly ? chipOn : chipBase}>
          ★ Gold
        </button>

        <button onClick={() => onChange({ ...filter, coldOnly: !filter.coldOnly })}
          style={filter.coldOnly ? { ...chipOn, color: "#ea580c", borderColor: "#ea580c", background: "rgba(234,88,12,0.08)" } : chipBase}>
          ❄ Cold
        </button>

        {active && (
          <button onClick={() => onChange(DEFAULT_FILTER)}
            style={{ ...chipBase, color: "var(--rose)", borderColor: "var(--rose)" }}>
            Reset
          </button>
        )}

        {/* Count — desktop/tablet */}
        {!isMob && (
          <div style={{ marginInlineStart: "auto", fontSize: 11, color: active ? "var(--ink)" : "var(--ink-4)", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }} className="tnum">
            {active ? `${filteredCount} / ${totalCount}` : `${totalCount}`} leads
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── FollowUpTimeline ───────────────────────────────────────────────── */

function FollowUpTimeline({ followUp, mode, onMark }: {
  followUp: FollowUp;
  mode: "compact" | "detailed";
  onMark?: (step: keyof FollowUp) => void;
}) {
  if (mode === "compact") {
    return (
      <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
        {FOLLOW_UP_STEPS.map(s => {
          const status = followUp[s.key];
          const bg = status === "done" ? "var(--emerald)" : status === "late" ? "var(--rose)" : "var(--line-strong)";
          return (
            <div key={s.key} title={`${s.day} ${s.label}: ${status}`}
              style={{ width: 7, height: 7, borderRadius: "50%", background: bg, flexShrink: 0 }} />
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {FOLLOW_UP_STEPS.map(s => {
        const status = followUp[s.key];
        const dotColor = status === "done" ? "var(--emerald)" : status === "late" ? "var(--rose)" : "var(--line-strong)";
        const labelColor = status === "done" ? "var(--emerald)" : status === "late" ? "var(--rose)" : "var(--ink-4)";
        return (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: status === "late" ? "rgba(220,50,50,0.04)" : "var(--bg-cream)", borderRadius: 6, border: "1px solid " + (status === "late" ? "rgba(220,50,50,0.15)" : "var(--line-soft)") }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.08em" }}>{s.day}</span>
              <span style={{ fontSize: 11, color: "var(--ink-4)", marginInlineStart: 6 }}>{s.label}</span>
            </div>
            {status === "done" ? (
              <span style={{ fontSize: 10, color: "var(--emerald)", fontWeight: 600 }}>✓ Done</span>
            ) : (
              <span style={{ fontSize: 10, color: labelColor, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {status === "late" ? "⚠ Late" : "Pending"}
              </span>
            )}
            {status !== "done" && onMark && (
              <button onClick={() => onMark(s.key)}
                style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "var(--ink)", color: "var(--gold)", border: "none", cursor: "pointer", fontFamily: "Inter, sans-serif" }}>
                Mark done
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── LeadCard ─────────────────────────────────────────────────────── */

function LeadCard({ l, stageKey, onDragStart, onDragEnd, draggingId, onSelect }: {
  l: Lead; stageKey: string;
  onDragStart: (e: React.DragEvent, id: string, fromStage: string) => void;
  onDragEnd: () => void;
  draggingId: string | null;
  onSelect: (l: Lead, stage: string) => void;
}) {
  const scoreColor = l.score >= 80 ? "var(--emerald)" : l.score >= 50 ? "var(--gold)" : "var(--ink-4)";
  const isDragging = draggingId === l.id;
  const isCold = (l.lastContactDays ?? 0) > 5;

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, l.id, stageKey)}
      onDragEnd={onDragEnd}
      onClick={() => onSelect(l, stageKey)}
      style={{
        background: "var(--bg-ivory)",
        border: "1px solid " + (l.gold ? "var(--gold-line, var(--gold))" : "var(--line-soft)"),
        borderRadius: "var(--r)", padding: 11,
        display: "flex", flexDirection: "column", gap: 7,
        boxShadow: "var(--shadow-1)", cursor: "pointer",
        opacity: isDragging ? 0.35 : 1,
        transform: isDragging ? "scale(0.97)" : "scale(1)",
        transition: "opacity 0.15s ease, transform 0.15s ease",
        userSelect: "none",
      }}
    >
      {/* Name + score */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}>{l.name}</div>
          <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 1 }}>{l.ctry}</div>
        </div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 5px", borderRadius: 4, background: scoreColor, color: "#fff", minWidth: 24, textAlign: "center" }} className="tnum">
          {l.score}
        </span>
      </div>

      <div style={{ fontSize: 11, color: "var(--ink-2)", lineHeight: 1.35 }}>{l.prop}</div>

      <div className="font-display tnum" style={{ fontSize: 14, color: l.gold ? "var(--gold-deep)" : "var(--ink)" }}>
        AED {(l.budget / 1_000_000).toFixed(2)}M
      </div>

      {/* Follow-up compact timeline */}
      {l.followUp && <FollowUpTimeline followUp={l.followUp} mode="compact" />}

      {l.proposal && (
        <div style={{ fontSize: 10, color: "var(--ink-4)", borderTop: "1px dashed var(--line)", paddingTop: 5 }}>
          Proposal: <span style={{ color: "var(--ink-2)" }}>{l.proposal}</span>
        </div>
      )}
      {l.final && (
        <div className="tnum" style={{ fontSize: 11, color: "var(--emerald)", borderTop: "1px dashed var(--line)", paddingTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
          <IcCheck /> {l.final} signed
        </div>
      )}

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: "var(--ink-4)" }}>
          <IcClock />{l.days}
          {l.gold && <Chip tone="gold">GV</Chip>}
          {isCold && (
            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "rgba(234,88,12,0.1)", color: "#ea580c", border: "1px solid rgba(234,88,12,0.2)" }}>
              COLD
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          {l.phone && (
            <a href={`tel:${l.phone}`} onClick={e => e.stopPropagation()}
              style={{ width: 22, height: 22, borderRadius: 11, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", color: "var(--ink-3)", textDecoration: "none" }}>
              <IcPhone />
            </a>
          )}
          {l.phone && (
            <a href={`https://wa.me/${l.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
              style={{ width: 22, height: 22, borderRadius: 11, background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.25)", display: "grid", placeItems: "center", color: "#25d366", textDecoration: "none" }}>
              <IcWhatsApp />
            </a>
          )}
          {l.email && (
            <a href={`mailto:${l.email}`} onClick={e => e.stopPropagation()}
              style={{ width: 22, height: 22, borderRadius: 11, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", color: "var(--azure)", textDecoration: "none" }}>
              <IcMail />
            </a>
          )}
          {l.agent !== "—" ? (
            <div style={{ width: 22, height: 22, borderRadius: 11, background: "var(--ink)", color: "var(--gold)", fontSize: 9.5, display: "grid", placeItems: "center", fontWeight: 600 }}>{l.agent}</div>
          ) : (
            <div style={{ width: 22, height: 22, borderRadius: 11, border: "1px dashed var(--line-strong)", color: "var(--ink-4)", fontSize: 14, display: "grid", placeItems: "center" }}>?</div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── KanbanCol ────────────────────────────────────────────────────── */

function KanbanCol({ stage, leads, onDragStart, onDragEnd, onDrop, draggingId, draggingFromStage, onSelect, isFiltered }: {
  stage: typeof STAGES[0]; leads: Lead[];
  onDragStart: (e: React.DragEvent, id: string, fromStage: string) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, toStage: string) => void;
  draggingId: string | null; draggingFromStage: string | null;
  onSelect: (l: Lead, stage: string) => void;
  isFiltered: boolean;
}) {
  const { lang } = useLang();
  const [isDragOver, setIsDragOver] = useState(false);
  const enterCount = useRef(0);
  const stageLabel = lang === "ar" ? stage.ar : lang === "fr" ? stage.fr : stage.en;
  const total = leads.reduce((a, l) => a + l.budget, 0);
  const isSource = draggingFromStage === stage.key;
  const coldCount = leads.filter(l => (l.lastContactDays ?? 0) > 5).length;

  function handleDragEnter(e: React.DragEvent) { e.preventDefault(); enterCount.current++; setIsDragOver(true); }
  function handleDragLeave() { enterCount.current--; if (enterCount.current === 0) setIsDragOver(false); }
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }
  function handleDrop(e: React.DragEvent) { e.preventDefault(); enterCount.current = 0; setIsDragOver(false); onDrop(e, stage.key); }

  return (
    <div
      onDragEnter={handleDragEnter} onDragLeave={handleDragLeave}
      onDragOver={handleDragOver} onDrop={handleDrop}
      style={{
        background: isDragOver ? "var(--gold-ghost)" : "var(--bg-paper)",
        border: isDragOver ? "2px solid var(--gold)" : isSource ? "1.5px dashed var(--line-strong)" : "1px solid var(--line-soft)",
        borderRadius: "var(--r-md)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden",
        transition: "background 0.15s ease, border 0.15s ease",
      }}
    >
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line-soft)", position: "relative", flexShrink: 0 }}>
        <div style={{ position: "absolute", insetInlineStart: 0, top: 0, bottom: 0, width: isDragOver ? 4 : 3, background: isDragOver ? "var(--gold)" : stage.color, transition: "all 0.15s ease" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div className={lang === "ar" ? "font-ar" : undefined} style={{ fontSize: lang === "ar" ? 13 : 11, letterSpacing: lang === "ar" ? 0 : "0.12em", textTransform: lang === "ar" ? undefined : "uppercase", color: isDragOver ? "var(--gold-deep)" : "var(--ink-3)", fontWeight: 600 }}>
            {stageLabel}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {coldCount > 0 && (
              <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "rgba(234,88,12,0.1)", color: "#ea580c", border: "1px solid rgba(234,88,12,0.2)" }}>
                {coldCount} cold
              </span>
            )}
            <span className="tnum" style={{ fontSize: 11, color: "var(--ink-4)", padding: "1px 7px", background: "var(--bg-inset)", borderRadius: 999 }}>{leads.length}</span>
          </div>
        </div>
        <div className="tnum" style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 4 }}>AED {(total / 1_000_000).toFixed(1)}M</div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 8, display: "flex", flexDirection: "column", gap: 8 }}>
        {leads.map(l => (
          <LeadCard key={l.id} l={l} stageKey={stage.key}
            onDragStart={onDragStart} onDragEnd={onDragEnd}
            draggingId={draggingId} onSelect={onSelect}
          />
        ))}
        {leads.length === 0 && (
          <div style={{ flex: 1, minHeight: 64, borderRadius: "var(--r)", border: "2px dashed " + (isDragOver ? "var(--gold)" : "var(--line)"), display: "grid", placeItems: "center", color: isDragOver ? "var(--gold-deep)" : "var(--ink-5)", fontSize: 11, transition: "all 0.15s ease", background: isDragOver ? "rgba(217,183,119,0.08)" : "transparent", textAlign: "center", padding: 8 }}>
            {isDragOver ? "↓ Drop here" : isFiltered ? "No match" : "—"}
          </div>
        )}
        <button style={{ padding: "10px 8px", borderRadius: 6, fontSize: 11, background: "transparent", border: "1px dashed var(--line)", color: "var(--ink-4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0 }}>
          <IcPlus /> Add
        </button>
      </div>
    </div>
  );
}

/* ─── LeadDetailDrawer ──────────────────────────────────────────────── */

function LeadDetailDrawer({ lead, stage, onClose, onNotesChange, onActivityAdd, onFollowUpMark, onMarkLost }: {
  lead: Lead; stage: string;
  onClose: () => void;
  onNotesChange: (id: string, stage: string, notes: string) => void;
  onActivityAdd: (id: string, stage: string, a: Activity) => void;
  onFollowUpMark: (id: string, stage: string, step: keyof FollowUp) => void;
  onMarkLost: () => void;
}) {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const [noteMode, setNoteMode] = useState(false);
  const [noteText, setNoteText] = useState("");

  const drawerWidth = bp === "mobile" ? "100vw" : bp === "tablet" ? 360 : 440;
  const scoreColor = lead.score >= 80 ? "var(--emerald)" : lead.score >= 50 ? "var(--gold)" : "var(--ink-4)";
  const stageObj = STAGES.find(s => s.key === stage);
  const stageLabel = stageObj ? (lang === "ar" ? stageObj.ar : lang === "fr" ? stageObj.fr : stageObj.en) : stage;
  const isCold = (lead.lastContactDays ?? 0) > 5;
  const followUp = lead.followUp ?? DEFAULT_FOLLOW_UP;
  const activities = lead.activities ?? [];

  function quickLog(type: ActivityType) {
    if (type === "note") { setNoteMode(v => !v); return; }
    onActivityAdd(lead.id, stage, makeActivity(type, lead.agent));
  }

  function submitNote() {
    if (!noteText.trim()) return;
    onActivityAdd(lead.id, stage, makeActivity("note", lead.agent, noteText.trim()));
    setNoteText("");
    setNoteMode(false);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,22,16,0.35)", zIndex: 200, backdropFilter: "blur(2px)" }} />
      <div style={{ position: "fixed", insetInlineEnd: 0, top: 0, bottom: 0, width: drawerWidth, background: "var(--bg-ivory)", zIndex: 201, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.14)", borderInlineStart: "1px solid var(--line-soft)" }}>

        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{lead.name}</span>
              {lead.gold && <Chip tone="gold">GV</Chip>}
              {isCold && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "rgba(234,88,12,0.1)", color: "#ea580c", border: "1px solid rgba(234,88,12,0.2)" }}>COLD · {lead.lastContactDays}d</span>}
            </div>
            <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{lead.ctry} · {lead.channel}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: scoreColor, color: "#fff" }} className="tnum">{lead.score}</span>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 6, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 18, lineHeight: 1 }}>×</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflow: "auto", padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Quick contact actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {lead.phone && (
              <a href={`tel:${lead.phone}`} style={{ textDecoration: "none" }}>
                <button style={{ width: "100%", padding: "9px 0", borderRadius: "var(--r)", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: "var(--ink)" }}>
                  <IcPhone /><span style={{ fontSize: 10, color: "var(--ink-3)" }}>Call</span>
                </button>
              </a>
            )}
            {lead.phone && (
              <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
                <button style={{ width: "100%", padding: "9px 0", borderRadius: "var(--r)", background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.3)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: "#25d366" }}>
                  <IcWhatsApp /><span style={{ fontSize: 10 }}>WhatsApp</span>
                </button>
              </a>
            )}
            {lead.email && (
              <a href={`mailto:${lead.email}`} style={{ textDecoration: "none" }}>
                <button style={{ width: "100%", padding: "9px 0", borderRadius: "var(--r)", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: "var(--azure)" }}>
                  <IcMail /><span style={{ fontSize: 10, color: "var(--ink-3)" }}>Email</span>
                </button>
              </a>
            )}
          </div>

          {/* Follow-up timeline */}
          <div style={{ padding: 14, background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid var(--line-soft)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <Eyebrow>Follow-up sequence</Eyebrow>
              <span style={{ fontSize: 10, color: "var(--ink-4)" }}>
                {Object.values(followUp).filter(v => v === "done").length} / 4 done
                {Object.values(followUp).some(v => v === "late") && <span style={{ color: "var(--rose)", marginInlineStart: 6 }}>· steps overdue</span>}
              </span>
            </div>
            <FollowUpTimeline
              followUp={followUp}
              mode="detailed"
              onMark={step => onFollowUpMark(lead.id, stage, step)}
            />
          </div>

          {/* Activity log */}
          <div style={{ padding: 14, background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid var(--line-soft)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <Eyebrow>Activity log</Eyebrow>
              <span style={{ fontSize: 10, color: "var(--ink-4)" }}>{activities.length} {activities.length === 1 ? "entry" : "entries"}</span>
            </div>

            {/* Quick-add buttons */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
              {(["call", "whatsapp", "email", "visit", "note"] as ActivityType[]).map(type => {
                const m = ACTIVITY_META[type];
                return (
                  <button key={type} onClick={() => quickLog(type)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontFamily: "Inter, sans-serif", background: noteMode && type === "note" ? "var(--ink)" : m.bg, color: noteMode && type === "note" ? "var(--gold)" : m.color, border: "1px solid " + (noteMode && type === "note" ? "var(--ink)" : "var(--line-soft)"), cursor: "pointer" }}>
                    {activityIcon(type)} {m.label}
                  </button>
                );
              })}
            </div>

            {/* Note input */}
            {noteMode && (
              <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
                <input
                  autoFocus
                  value={noteText}
                  onChange={e => setNoteText(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && submitNote()}
                  placeholder="Write a note and press Enter…"
                  style={{ flex: 1, padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-cream)", fontSize: 12, color: "var(--ink)", fontFamily: "Inter, sans-serif", outline: "none" }}
                />
                <button onClick={submitNote} className="sgi-btn sgi-btn-primary" style={{ height: 32, padding: "0 12px" }}>Add</button>
              </div>
            )}

            {/* Activity list */}
            {activities.length === 0 ? (
              <div style={{ padding: "12px 0", textAlign: "center", fontSize: 11, color: "var(--ink-4)" }}>No activity yet — log the first contact above</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {activities.map((a, i) => {
                  const m = ACTIVITY_META[a.type];
                  return (
                    <div key={a.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: i > 0 ? "1px dashed var(--line)" : "none", alignItems: "flex-start" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 14, background: m.bg, border: "1px solid var(--line-soft)", display: "grid", placeItems: "center", color: m.color, flexShrink: 0, marginTop: 1 }}>
                        {activityIcon(a.type)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500, lineHeight: 1.4 }}>{a.text}</div>
                        <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 2 }} className="font-mono">
                          {formatTime(a.at)}{a.by ? ` · ${a.by}` : ""}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Contact */}
          <div style={{ padding: 14, background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid var(--line-soft)" }}>
            <Eyebrow>Contact</Eyebrow>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
              {lead.phone && <Row label="Phone" value={lead.phone} mono />}
              {lead.email && <Row label="Email" value={lead.email} />}
              <Row label="Source" value={lead.channel} />
              <Row label="Agent" value={lead.agent === "—" ? "Unassigned" : lead.agent} />
            </div>
          </div>

          {/* Property & budget */}
          <div style={{ padding: 14, background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid var(--line-soft)" }}>
            <Eyebrow>Property interest</Eyebrow>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
              <Row label="Property" value={lead.prop} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--ink-4)" }}>Budget</span>
                <span className="font-display tnum" style={{ fontSize: 16, color: lead.gold ? "var(--gold-deep)" : "var(--ink)" }}>AED {(lead.budget / 1_000_000).toFixed(2)}M</span>
              </div>
              {lead.gold && <div style={{ padding: "7px 10px", background: "var(--gold-ghost)", borderRadius: 6, fontSize: 11.5, color: "var(--gold-deep)" }}>★ Golden Visa eligible — budget ≥ AED 2M</div>}
            </div>
          </div>

          {/* Pipeline */}
          <div style={{ padding: 14, background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid var(--line-soft)" }}>
            <Eyebrow>Pipeline</Eyebrow>
            <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8, fontSize: 12.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--ink-4)" }}>Stage</span>
                <Chip tone={stage === "won" ? "emerald" : "gold"}>{stageLabel}</Chip>
              </div>
              <Row label="In pipeline" value={lead.days} />
              {lead.proposal && <Row label="Proposal" value={lead.proposal} />}
              {lead.final && <Row label="Closed" value={lead.final} highlight />}
            </div>
          </div>

          {/* Notes */}
          <div>
            <Eyebrow>Scratchpad</Eyebrow>
            <textarea
              value={lead.notes ?? ""}
              onChange={e => onNotesChange(lead.id, stage, e.target.value)}
              placeholder="Quick notes…"
              style={{ marginTop: 8, width: "100%", minHeight: 72, padding: 10, background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", fontSize: 12, color: "var(--ink)", fontFamily: "Inter, sans-serif", resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box" }}
            />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 18px", borderTop: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="sgi-btn sgi-btn-primary" style={{ flex: 1, justifyContent: "center" }}>Schedule visit</button>
            <button className="sgi-btn sgi-btn-ghost" style={{ flex: 1, justifyContent: "center" }}>Create proposal</button>
          </div>
          {stage !== "won" && (
            <button onClick={onMarkLost}
              style={{ width: "100%", padding: "8px 0", borderRadius: "var(--r)", fontSize: 11.5, fontFamily: "Inter, sans-serif", cursor: "pointer", border: "1px solid rgba(220,50,50,0.3)", background: "rgba(220,50,50,0.04)", color: "var(--rose, #dc2626)", fontWeight: 500 }}>
              Mark as lost…
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, value, mono, highlight }: { label: string; value: string; mono?: boolean; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "var(--ink-4)" }}>{label}</span>
      <span className={mono ? "font-mono tnum" : "tnum"} style={{ fontSize: mono ? 11 : 12.5, fontWeight: 500, color: highlight ? "var(--emerald)" : "var(--ink)" }}>{value}</span>
    </div>
  );
}

/* ─── AddLeadModal ──────────────────────────────────────────────────── */

const CHANNELS = ["WhatsApp", "Web", "Phone", "Referral", "Email", "Visit", "Form", "Social"];
const emptyForm = { name: "", phone: "", email: "", budget: "", prop: "", channel: "WhatsApp", ctry: "", notes: "" };

const inputStyle: React.CSSProperties = {
  padding: "9px 12px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)",
  background: "var(--bg-cream)", fontSize: 13, color: "var(--ink)",
  fontFamily: "Inter, sans-serif", outline: "none", width: "100%", boxSizing: "border-box",
};

function AddLeadModal({ onClose, onAdd }: { onClose: () => void; onAdd: (l: Lead) => void }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSubmit() {
    if (!form.name.trim()) { setError("Name is required"); return; }
    const budget = parseInt(form.budget.replace(/\D/g, ""), 10);
    if (!budget) { setError("Valid budget (AED) is required"); return; }
    onAdd({
      id: `l${Date.now()}`,
      name: form.name.trim(), ctry: form.ctry.trim() || "—",
      budget, prop: form.prop.trim() || "—",
      score: calcScore(budget, !!form.phone, !!form.email, form.prop),
      days: "today", agent: "—", channel: form.channel,
      gold: budget >= 2_000_000,
      phone: form.phone.trim() || undefined, email: form.email.trim() || undefined,
      notes: form.notes.trim() || undefined,
      followUp: DEFAULT_FOLLOW_UP,
      lastContactDays: 0,
    });
    onClose();
  }

  function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <label style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-4)", fontWeight: 600 }}>{label}</label>
        {children}
      </div>
    );
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,22,16,0.45)", zIndex: 200, backdropFilter: "blur(3px)" }} />
      <div style={{ position: "fixed", top: "50%", insetInlineStart: "50%", transform: "translate(-50%,-50%)", width: 480, background: "var(--bg-ivory)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-3)", zIndex: 201, display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "90vh" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Eyebrow>CRM · New lead</Eyebrow>
            <div className="font-display" style={{ fontSize: 20, marginTop: 4 }}>Add a lead</div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 13, overflow: "auto" }}>
          <Field label="Full name *"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Anna Schmidt" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="+971 50 000 0000" /></Field>
            <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="client@email.com" /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Budget (AED) *"><input style={inputStyle} value={form.budget} onChange={set("budget")} placeholder="2 000 000" /></Field>
            <Field label="Country"><input style={inputStyle} value={form.ctry} onChange={set("ctry")} placeholder="🇦🇪 UAE" /></Field>
          </div>
          <Field label="Property interest"><input style={inputStyle} value={form.prop} onChange={set("prop")} placeholder="2BR Marina, Downtown…" /></Field>
          <Field label="Source / Channel">
            <select style={{ ...inputStyle, cursor: "pointer" }} value={form.channel} onChange={set("channel")}>
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Notes"><textarea style={{ ...inputStyle, minHeight: 70, resize: "vertical" }} value={form.notes} onChange={set("notes")} placeholder="Initial contact notes…" /></Field>
          {error && <div style={{ fontSize: 11.5, color: "var(--rose)", padding: "8px 12px", background: "rgba(220,50,50,0.06)", borderRadius: "var(--r)" }}>{error}</div>}
          {form.budget && parseInt(form.budget.replace(/\D/g, ""), 10) > 0 && (() => {
            const b = parseInt(form.budget.replace(/\D/g, ""), 10);
            const s = calcScore(b, !!form.phone, !!form.email, form.prop);
            const c = s >= 80 ? "var(--emerald)" : s >= 50 ? "var(--gold)" : "var(--ink-4)";
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: "var(--bg-inset)", borderRadius: "var(--r)", fontSize: 12 }}>
                <span style={{ color: "var(--ink-4)" }}>Estimated score</span>
                <span style={{ fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: c, color: "#fff" }} className="tnum">{s}</span>
                {b >= 2_000_000 && <Chip tone="gold">Golden Visa eligible</Chip>}
              </div>
            );
          })()}
        </div>
        <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="sgi-btn sgi-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="sgi-btn sgi-btn-primary" onClick={handleSubmit}><IcPlus />&nbsp;Add lead</button>
        </div>
      </div>
    </>
  );
}

/* ─── MobileStageList ───────────────────────────────────────────────── */

function MobileStageList({ filteredLeads, onSelect, isFiltered, addModalOpen, onAdd }: {
  filteredLeads: Record<string, Lead[]>;
  onSelect: (l: Lead, stage: string) => void;
  isFiltered: boolean;
  addModalOpen: boolean;
  onAdd: () => void;
}) {
  const { lang } = useLang();
  const [openStage, setOpenStage] = useState<string>(STAGES[0].key);

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 80px", display: "flex", flexDirection: "column", gap: 8, background: "var(--bg-cream)" }}>
      {STAGES.map(s => {
        const stageLeads = filteredLeads[s.key] ?? [];
        const isOpen     = openStage === s.key;
        const coldCount  = stageLeads.filter(l => (l.lastContactDays ?? 0) > 5).length;
        const stageLabel = lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en;
        const total      = stageLeads.reduce((a, l) => a + l.budget, 0);

        return (
          <div key={s.key} style={{ borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid " + (isOpen ? s.color : "var(--line-soft)"), background: "var(--bg-paper)", transition: "border-color 0.2s" }}>
            <button
              onClick={() => setOpenStage(isOpen ? "" : s.key)}
              style={{ width: "100%", padding: "11px 14px", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "start" }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: lang === "ar" ? undefined : "uppercase" }}
                className={lang === "ar" ? "font-ar" : undefined}>
                {stageLabel}
              </span>
              {coldCount > 0 && (
                <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "rgba(234,88,12,0.1)", color: "#ea580c", border: "1px solid rgba(234,88,12,0.2)" }}>
                  {coldCount} cold
                </span>
              )}
              <span className="tnum" style={{ fontSize: 11, color: "var(--ink-4)", padding: "1px 7px", background: "var(--bg-inset)", borderRadius: 999 }}>{stageLeads.length}</span>
              {total > 0 && <span className="tnum font-display" style={{ fontSize: 11, color: "var(--gold-deep)" }}>AED {(total / 1_000_000).toFixed(1)}M</span>}
              <span style={{ fontSize: 16, color: "var(--ink-4)", transform: isOpen ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>›</span>
            </button>

            {isOpen && (
              <div style={{ borderTop: "1px solid var(--line-soft)", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                {stageLeads.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12, color: "var(--ink-4)" }}>
                    {isFiltered ? "No leads match your filters" : "No leads in this stage"}
                  </div>
                ) : (
                  stageLeads.map(l => (
                    <LeadCard key={l.id} l={l} stageKey={s.key}
                      onDragStart={() => {}} onDragEnd={() => {}}
                      draggingId={null} onSelect={onSelect}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* FAB Add lead */}
      <button
        onClick={onAdd}
        style={{ position: "fixed", bottom: 20, insetInlineEnd: 20, width: 52, height: 52, borderRadius: 26, background: "var(--ink)", color: "var(--gold)", border: "none", display: "grid", placeItems: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", cursor: "pointer", zIndex: 50, fontSize: 26, lineHeight: 1 }}
      >
        <IcPlus />
      </button>
    </div>
  );
}

/* ─── LostReasonModal ───────────────────────────────────────────────── */

function LostReasonModal({ leadName, onConfirm, onClose }: {
  leadName: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<string>("");
  const [other, setOther]       = useState("");

  function confirm() {
    const reason = selected === "Other" && other.trim() ? other.trim() : selected;
    if (!reason) return;
    onConfirm(reason);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,22,16,0.5)", zIndex: 300, backdropFilter: "blur(3px)" }} />
      <div style={{ position: "fixed", top: "50%", insetInlineStart: "50%", transform: "translate(-50%,-50%)", width: 420, background: "var(--bg-ivory)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-3)", zIndex: 301, overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Eyebrow style={{ color: "var(--rose)" }}>Mark as lost</Eyebrow>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 3 }}>{leadName}</div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 6, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 16 }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ fontSize: 12, color: "var(--ink-3)" }}>Select a loss reason to keep your pipeline data accurate.</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {LOST_REASONS.map(r => (
              <button key={r} onClick={() => setSelected(r)}
                style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontFamily: "Inter, sans-serif", cursor: "pointer", border: "1px solid " + (selected === r ? "var(--rose)" : "var(--line-soft)"), background: selected === r ? "rgba(220,50,50,0.08)" : "var(--bg-paper)", color: selected === r ? "var(--rose)" : "var(--ink-3)", fontWeight: selected === r ? 600 : 400, transition: "all 0.12s" }}>
                {r}
              </button>
            ))}
          </div>
          {selected === "Other" && (
            <input
              autoFocus
              value={other}
              onChange={e => setOther(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirm()}
              placeholder="Describe the reason…"
              style={{ padding: "8px 12px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-cream)", fontSize: 12, color: "var(--ink)", fontFamily: "Inter, sans-serif", outline: "none" }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="sgi-btn sgi-btn-ghost" onClick={onClose}>Cancel</button>
          <button onClick={confirm} disabled={!selected}
            style={{ padding: "8px 18px", borderRadius: "var(--r)", fontSize: 12, fontFamily: "Inter, sans-serif", cursor: selected ? "pointer" : "not-allowed", background: selected ? "var(--rose, #dc2626)" : "var(--bg-inset)", color: selected ? "#fff" : "var(--ink-4)", border: "none", fontWeight: 600, transition: "all 0.12s" }}>
            Confirm loss
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── ScreenCRM ─────────────────────────────────────────────────────── */

export function ScreenCRM() {
  const t = useT();
  const { lang } = useLang();
  const bp    = useBreakpoint();
  const isMob = bp === "mobile";

  const [leads, setLeads] = useState<Record<string, Lead[]>>(LEADS_INIT);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingFromStage, setDraggingFromStage] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<{ lead: Lead; stage: string } | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [lostModal, setLostModal] = useState<{ lead: Lead; stage: string } | null>(null);

  const filteredLeads = applyFilters(leads, filter);
  const totalCount    = Object.values(leads).flat().length;
  const filteredCount = Object.values(filteredLeads).flat().length;

  function handleDragStart(e: React.DragEvent, id: string, fromStage: string) {
    e.dataTransfer.setData("leadId", id); e.dataTransfer.setData("fromStage", fromStage);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(id); setDraggingFromStage(fromStage); setSelectedLead(null);
  }
  function handleDragEnd() { setDraggingId(null); setDraggingFromStage(null); }
  function handleDrop(e: React.DragEvent, toStage: string) {
    const id = e.dataTransfer.getData("leadId"), fromStage = e.dataTransfer.getData("fromStage");
    if (!id || fromStage === toStage) return;
    setLeads(prev => {
      const card = prev[fromStage]?.find(l => l.id === id);
      if (!card) return prev;
      return { ...prev, [fromStage]: prev[fromStage].filter(l => l.id !== id), [toStage]: [...(prev[toStage] ?? []), card] };
    });
    setDraggingId(null); setDraggingFromStage(null);
  }

  function handleNotesChange(id: string, stage: string, notes: string) {
    setLeads(prev => ({ ...prev, [stage]: (prev[stage] ?? []).map(l => l.id === id ? { ...l, notes } : l) }));
    setSelectedLead(prev => prev?.lead.id === id ? { ...prev, lead: { ...prev.lead, notes } } : prev);
  }

  function handleActivityAdd(id: string, stage: string, activity: Activity) {
    const sync = (l: Lead): Lead => {
      if (l.id !== id) return l;
      const activities = [activity, ...(l.activities ?? [])];
      const fu = { ...(l.followUp ?? DEFAULT_FOLLOW_UP) };
      if (activity.type === "call"     && fu.j1 !== "done") fu.j1 = "done";
      if (activity.type === "whatsapp" && fu.j2 !== "done") fu.j2 = "done";
      if (activity.type === "email"    && fu.j4 !== "done") fu.j4 = "done";
      return { ...l, activities, followUp: fu, lastContactDays: 0 };
    };
    setLeads(prev => ({ ...prev, [stage]: (prev[stage] ?? []).map(sync) }));
    setSelectedLead(prev => prev?.lead.id === id ? { ...prev, lead: sync(prev.lead) } : prev);
  }

  function handleFollowUpMark(id: string, stage: string, step: keyof FollowUp) {
    const sync = (l: Lead): Lead => {
      if (l.id !== id) return l;
      return { ...l, followUp: { ...(l.followUp ?? DEFAULT_FOLLOW_UP), [step]: "done" }, lastContactDays: 0 };
    };
    setLeads(prev => ({ ...prev, [stage]: (prev[stage] ?? []).map(sync) }));
    setSelectedLead(prev => prev?.lead.id === id ? { ...prev, lead: sync(prev.lead) } : prev);
  }

  function handleAddLead(lead: Lead) {
    setLeads(prev => ({ ...prev, new: [lead, ...(prev.new ?? [])] }));
  }

  function handleMarkLost(reason: string) {
    if (!lostModal) return;
    const { lead, stage } = lostModal;
    const lostLead = { ...lead, lostReason: reason };
    setLeads(prev => ({
      ...prev,
      [stage]: (prev[stage] ?? []).filter(l => l.id !== lead.id),
      lost: [lostLead, ...(prev.lost ?? [])],
    }));
    setSelectedLead(null);
    setLostModal(null);
  }

  const counts      = STAGES.map(s => leads[s.key]?.length ?? 0);
  const lostLeads   = leads.lost ?? [];
  const activeFlat  = Object.entries(leads).filter(([k]) => k !== "lost").flatMap(([, v]) => v);
  const totalBudget = activeFlat.reduce((s, l) => s + l.budget, 0);
  const wonBudget   = (leads.won ?? []).reduce((s, l) => s + l.budget, 0);
  const lostBudget  = lostLeads.reduce((s, l) => s + l.budget, 0);
  const totalDeals  = activeFlat.length + lostLeads.length;
  const convRate    = totalBudget > 0 ? ((wonBudget / totalBudget) * 100).toFixed(1) : "0.0";
  const dropRate    = totalDeals > 0 ? ((lostLeads.length / totalDeals) * 100).toFixed(1) : "0.0";
  const coldTotal   = activeFlat.filter(l => (l.lastContactDays ?? 0) > 5).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={t.t_crm} crumb={[`${counts.reduce((a, b) => a + b, 0)} leads`, "AED " + (totalBudget / 1_000_000).toFixed(1) + "M", coldTotal > 0 ? `${coldTotal} cold` : ""]}>
        {!isMob && <button className="sgi-btn sgi-btn-ghost" onClick={() => exportCSV(filteredLeads)}><IcFilter />&nbsp;Export CSV</button>}
        {!isMob && <button className="sgi-btn sgi-btn-ghost">Automations · 3 active</button>}
        {!isMob && <button className="sgi-btn sgi-btn-primary" onClick={() => setAddModalOpen(true)}><IcPlus />&nbsp;{t.add}</button>}
      </Topbar>

      <FilterBar
        filter={filter} onChange={setFilter}
        totalCount={totalCount} filteredCount={filteredCount}
      />

      {/* ── Mobile layout ── */}
      {isMob ? (
        <>
          {/* Mobile KPI strip */}
          <div style={{ display: "flex", gap: 0, background: "var(--bg-paper)", borderBottom: "1px solid var(--line-soft)", flexShrink: 0 }}>
            {[
              { label: "Conv.", value: convRate + "%", color: "var(--gold-deep)" },
              { label: "Won",   value: (leads.won?.length ?? 0) + " · AED " + (wonBudget / 1_000_000).toFixed(1) + "M", color: "var(--emerald)" },
              { label: "Lost",  value: lostLeads.length + " · " + dropRate + "%", color: lostLeads.length > 0 ? "var(--rose, #dc2626)" : "var(--ink-4)" },
            ].map((k, i) => (
              <div key={k.label} style={{ flex: 1, padding: "10px 12px", borderInlineStart: i > 0 ? "1px solid var(--line-soft)" : "none" }}>
                <Eyebrow>{k.label}</Eyebrow>
                <div className="tnum" style={{ fontSize: 12, fontWeight: 600, color: k.color, marginTop: 3 }}>{k.value}</div>
              </div>
            ))}
          </div>
          <MobileStageList
            filteredLeads={filteredLeads}
            onSelect={(l, stage) => setSelectedLead({ lead: l, stage })}
            isFiltered={isFilterActive(filter)}
            addModalOpen={addModalOpen}
            onAdd={() => setAddModalOpen(true)}
          />
        </>
      ) : (
        /* ── Tablet / Desktop layout ── */
        <main style={{ flex: 1, padding: bp === "tablet" ? 12 : 24, display: "flex", flexDirection: "column", gap: 12, background: "var(--bg-cream)", overflow: "hidden" }}>

          {/* Funnel summary — desktop full / tablet compact */}
          {bp === "desktop" ? (
            <div className="sgi-card" style={{ padding: 16, display: "flex", alignItems: "center", gap: 18, flexShrink: 0 }}>
              <div style={{ minWidth: 110 }}>
                <Eyebrow>Conversion · 30d</Eyebrow>
                <div className="font-display tnum" style={{ fontSize: 22, marginTop: 4, color: "var(--gold-deep)" }}>{convRate}%</div>
              </div>
              <div style={{ width: 1, height: 36, background: "var(--line-soft)" }} />
              <div style={{ display: "flex", gap: 16, flexShrink: 0 }}>
                <div><Eyebrow>Won</Eyebrow><div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--emerald)", marginTop: 3 }}>{leads.won?.length ?? 0} · AED {(wonBudget / 1_000_000).toFixed(1)}M</div></div>
                <div><Eyebrow>Lost</Eyebrow><div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: lostLeads.length > 0 ? "var(--rose, #dc2626)" : "var(--ink-4)", marginTop: 3 }}>{lostLeads.length} · AED {(lostBudget / 1_000_000).toFixed(1)}M</div></div>
                <div><Eyebrow>Drop rate</Eyebrow><div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: lostLeads.length > 0 ? "var(--rose, #dc2626)" : "var(--ink-4)", marginTop: 3 }}>{dropRate}%</div></div>
              </div>
              <div style={{ width: 1, height: 36, background: "var(--line-soft)" }} />
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 4 }}>
                {STAGES.map((s, i) => {
                  const w = counts[i] / Math.max(...counts, 1);
                  return (
                    <React.Fragment key={s.key}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-4)", marginBottom: 4 }}>
                          <span>{(lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en).toUpperCase()}</span>
                          <span className="tnum">{counts[i]}</span>
                        </div>
                        <div style={{ height: 7, background: "var(--bg-inset)", borderRadius: 4, overflow: "hidden" }}>
                          <div style={{ width: `${w * 100}%`, height: "100%", background: s.color, transition: "width 0.3s ease" }} />
                        </div>
                      </div>
                      {i < STAGES.length - 1 && <span style={{ color: "var(--ink-5)", fontSize: 9 }}>›</span>}
                    </React.Fragment>
                  );
                })}
              </div>
              <div style={{ width: 1, height: 36, background: "var(--line-soft)" }} />
              <div style={{ textAlign: "end", minWidth: 110 }}>
                <Eyebrow>Pipeline</Eyebrow>
                <div className="font-display tnum" style={{ fontSize: 20, color: "var(--gold-deep)", marginTop: 4 }}>AED {(totalBudget / 1_000_000).toFixed(1)}M</div>
              </div>
            </div>
          ) : (
            /* Tablet: compact KPI row */
            <div className="sgi-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
              <div><Eyebrow>Conv.</Eyebrow><div className="font-display tnum" style={{ fontSize: 16, color: "var(--gold-deep)", marginTop: 2 }}>{convRate}%</div></div>
              <div style={{ width: 1, height: 28, background: "var(--line-soft)" }} />
              <div><Eyebrow>Won</Eyebrow><div className="tnum" style={{ fontSize: 12, fontWeight: 600, color: "var(--emerald)", marginTop: 2 }}>{leads.won?.length ?? 0} · AED {(wonBudget / 1_000_000).toFixed(1)}M</div></div>
              <div><Eyebrow>Lost</Eyebrow><div className="tnum" style={{ fontSize: 12, fontWeight: 600, color: lostLeads.length > 0 ? "var(--rose, #dc2626)" : "var(--ink-4)", marginTop: 2 }}>{lostLeads.length} · {dropRate}%</div></div>
              <div style={{ marginInlineStart: "auto" }}><Eyebrow>Pipeline</Eyebrow><div className="font-display tnum" style={{ fontSize: 16, color: "var(--gold-deep)", marginTop: 2 }}>AED {(totalBudget / 1_000_000).toFixed(1)}M</div></div>
            </div>
          )}

          {/* Kanban — tablet: horizontal scroll, desktop: grid */}
          <div style={{ flex: 1, overflowX: bp === "tablet" ? "auto" : "visible", overflowY: "hidden", minHeight: 0 }}>
            <div style={{ display: "grid", gridTemplateColumns: bp === "tablet" ? "repeat(6, minmax(200px, 1fr))" : "repeat(6, 1fr)", gap: 10, height: "100%", minHeight: 0 }}>
              {STAGES.map(s => (
                <KanbanCol
                  key={s.key} stage={s} leads={filteredLeads[s.key] ?? []}
                  onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDrop={handleDrop}
                  draggingId={draggingId} draggingFromStage={draggingFromStage}
                  onSelect={(l, stage) => setSelectedLead({ lead: l, stage })}
                  isFiltered={isFilterActive(filter)}
                />
              ))}
            </div>
          </div>
        </main>
      )}

      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead.lead} stage={selectedLead.stage}
          onClose={() => setSelectedLead(null)}
          onNotesChange={handleNotesChange}
          onActivityAdd={handleActivityAdd}
          onFollowUpMark={handleFollowUpMark}
          onMarkLost={() => setLostModal(selectedLead)}
        />
      )}

      {lostModal && (
        <LostReasonModal
          leadName={lostModal.lead.name}
          onConfirm={handleMarkLost}
          onClose={() => setLostModal(null)}
        />
      )}

      {addModalOpen && (
        <AddLeadModal onClose={() => setAddModalOpen(false)} onAdd={handleAddLead} />
      )}
    </div>
  );
}
