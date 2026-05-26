"use client";
import React, { useState, useRef } from "react";
import { Topbar, Eyebrow, Chip, IcFilter, IcPlus, IcCheck, IcClock, IcPhone, IcMail, IcSearch, IcList, IcGrid } from "@/components/sgi-ui";
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
  clientLang: string;
  budgetRange: "all" | "u2m" | "2m-5m" | "5m-10m" | "o10m";
};

const DEFAULT_FILTER: FilterState = { query: "", agent: "all", scoreMin: 0, goldOnly: false, coldOnly: false, clientLang: "all", budgetRange: "all" };

function isFilterActive(f: FilterState) {
  return f.query !== "" || f.agent !== "all" || f.scoreMin > 0 || f.goldOnly || f.coldOnly || f.clientLang !== "all" || f.budgetRange !== "all";
}

function langFromCtry(ctry: string): string {
  if (ctry.includes("🇦🇪") || ctry.includes("🇸🇦") || ctry.includes("UAE") || ctry.includes("KSA")) return "ar";
  if (ctry.includes("🇫🇷") || ctry.includes("FRA")) return "fr";
  if (ctry.includes("🇷🇺") || ctry.includes("RUS")) return "ru";
  if (ctry.includes("🇨🇳") || ctry.includes("CHN")) return "zh";
  if (ctry.includes("🇩🇪") || ctry.includes("DEU")) return "de";
  if (ctry.includes("🇮🇹") || ctry.includes("ITA")) return "it";
  if (ctry.includes("🇯🇵") || ctry.includes("JPN")) return "ja";
  if (ctry.includes("🇹🇷") || ctry.includes("TUR")) return "tr";
  return "en";
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
        if (f.clientLang !== "all" && langFromCtry(l.ctry) !== f.clientLang) return false;
        if (f.budgetRange !== "all") {
          const b = l.budget;
          if (f.budgetRange === "u2m"    && b >= 2_000_000) return false;
          if (f.budgetRange === "2m-5m"  && (b < 2_000_000 || b >= 5_000_000)) return false;
          if (f.budgetRange === "5m-10m" && (b < 5_000_000 || b >= 10_000_000)) return false;
          if (f.budgetRange === "o10m"   && b < 10_000_000) return false;
        }
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

/* ─── Profile Enrichment ────────────────────────────────────────────── */

type EnrichmentData = {
  title: string;
  company: string;
  linkedin?: string;
  twitter?: string;
  bio?: string;
  confidence: number;
  source: string;
};

const MOCK_ENRICHMENT: Record<string, EnrichmentData> = {
  l1:  { title: "CEO",                    company: "Al-Hashimi Investment Group",     linkedin: "khalid-alhashimi",      confidence: 91, source: "LinkedIn · Company registry" },
  l2:  { title: "Art Curator",            company: "Moscow Museum of Modern Art",     linkedin: "maria-petrova-art",     twitter: "@MPetrovaArt",    confidence: 78, source: "LinkedIn · Instagram" },
  l3:  { title: "Software Engineer",      company: "Tech Startup Dublin",             linkedin: "liam-oconnor-dev",      confidence: 62, source: "LinkedIn" },
  l4:  { title: "Managing Director",      company: "Al-Mohammed Holding Co.",         linkedin: "aisha-mohammed-ksa",    confidence: 87, source: "LinkedIn · Company registry", bio: "Real estate investor with 15+ years experience across GCC markets." },
  l5:  { title: "Partner",               company: "Lemaire & Associates Architecture", linkedin: "pierre-lemaire-archi", twitter: "@PLemaire_Arch",  confidence: 83, source: "LinkedIn · Twitter" },
  l6:  { title: "Co-founder & CFO",       company: "Hu Wei Capital Management",       linkedin: "hu-wei-capital",        confidence: 76, source: "LinkedIn · Crunchbase" },
  l7:  { title: "Interior Designer",      company: "Studio Russo Milano",             linkedin: "sofia-russo-design",    twitter: "@SofiaRussoDesign", confidence: 81, source: "LinkedIn · Instagram", bio: "Luxury interior design for private residences and hotels." },
  l8:  { title: "Chairman",              company: "Bin Saud Investment Corp.",        linkedin: "mbs-invest",            confidence: 94, source: "LinkedIn · Bloomberg · Company registry", bio: "Diversified portfolio across real estate, energy and technology." },
  l9:  { title: "Senior Architect",       company: "Schmidt + Partner GmbH",          linkedin: "anna-schmidt-arch",     confidence: 85, source: "LinkedIn · XING" },
  l10: { title: "CTO",                    company: "Mehta Digital Solutions",         linkedin: "rahul-mehta-tech",      twitter: "@RahulMehta_CTO",  confidence: 74, source: "LinkedIn · AngelList" },
  l11: { title: "Family Office Manager",  company: "Tanaka Holdings Ltd.",            linkedin: "tanaka-family-office",  confidence: 89, source: "LinkedIn · Bloomberg" },
  l12: { title: "Entrepreneur",           company: "Demir Group Istanbul",            linkedin: "yusuf-demir-ist",       twitter: "@YDemir",          confidence: 92, source: "LinkedIn · Company registry" },
};

function IcGlobe() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function IcLinkedIn() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6zM2 9h4v12H2z" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function IcX() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.742l7.727-8.845L2.25 2.25H8.48l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function ProfileEnrichmentPanel({ lead }: { lead: Lead }) {
  const [enrichState, setEnrichState] = useState<"idle" | "loading" | "done" | "none">("idle");
  const data = MOCK_ENRICHMENT[lead.id];
  const initials = lead.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  function fetchProfile() {
    setEnrichState("loading");
    setTimeout(() => setEnrichState(data ? "done" : "none"), 1800);
  }

  if (enrichState === "idle") {
    return (
      <div style={{ padding: 14, background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px dashed var(--line-strong)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-4)", fontWeight: 600 }}>Profile Enrichment</div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>Fetch public data from LinkedIn, web…</div>
        </div>
        <button onClick={fetchProfile} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: "var(--r)", background: "var(--ink)", color: "var(--gold)", border: "none", fontSize: 11.5, fontFamily: "Roboto, sans-serif", cursor: "pointer", fontWeight: 600 }}>
          <IcGlobe /> Fetch
        </button>
      </div>
    );
  }

  if (enrichState === "loading") {
    return (
      <div style={{ padding: 14, background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", display: "flex", alignItems: "center", gap: 10 }}>
        <style>{`@keyframes sgi-spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--line-strong)", borderTopColor: "var(--gold)", animation: "sgi-spin 0.8s linear infinite", flexShrink: 0 }} />
        <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Searching public profiles…</span>
      </div>
    );
  }

  if (enrichState === "none" || !data) {
    return (
      <div style={{ padding: 14, background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>No public profile found for this contact</span>
        <button onClick={() => setEnrichState("idle")} style={{ fontSize: 10, color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Try again</button>
      </div>
    );
  }

  const matchColor = data.confidence >= 85 ? "var(--emerald)" : "var(--gold-deep)";
  const matchBg    = data.confidence >= 85 ? "rgba(16,185,129,0.1)" : "var(--gold-ghost)";

  return (
    <div style={{ padding: 14, background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid var(--gold-line, var(--gold))", boxShadow: "0 0 0 2px color-mix(in srgb,var(--gold) 12%,transparent)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div style={{ fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-4)", fontWeight: 600 }}>Profile Enrichment</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 9.5, padding: "2px 7px", borderRadius: 999, background: matchBg, color: matchColor, fontWeight: 700 }}>{data.confidence}% match</span>
          <button onClick={() => setEnrichState("idle")} style={{ width: 20, height: 20, borderRadius: 4, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink-4)", fontSize: 13, lineHeight: 1 }}>×</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ width: 44, height: 44, borderRadius: 22, background: "var(--ink)", color: "var(--gold)", fontSize: 15, fontWeight: 700, display: "grid", placeItems: "center", flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink)", lineHeight: 1.2 }}>{lead.name}</div>
          <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 2 }}>{data.title}</div>
          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>{data.company}</div>
        </div>
      </div>

      {data.bio && (
        <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 10, lineHeight: 1.55, padding: "8px 10px", background: "var(--bg-cream)", borderRadius: 6, borderInlineStart: "2px solid var(--gold)", fontStyle: "italic" }}>
          {data.bio}
        </div>
      )}

      <div style={{ display: "flex", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
        {data.linkedin && (
          <a href={`https://linkedin.com/in/${data.linkedin}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, background: "rgba(10,102,194,0.08)", border: "1px solid rgba(10,102,194,0.25)", color: "#0a66c2", fontFamily: "Roboto, sans-serif", cursor: "pointer" }}>
              <IcLinkedIn /> LinkedIn
            </span>
          </a>
        )}
        {data.twitter && (
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, background: "rgba(29,155,240,0.08)", border: "1px solid rgba(29,155,240,0.25)", color: "#1d9bf0", fontFamily: "Roboto, sans-serif" }}>
            <IcX /> {data.twitter}
          </span>
        )}
      </div>

      <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 10 }}>
        Source: {data.source} · {new Date().toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>
  );
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

const CLIENT_LANGS = [
  { key: "ar", flag: "🇦🇪", label_en: "Arabic",   label_fr: "Arabe",    label_ar: "عربي"    },
  { key: "en", flag: "🇬🇧", label_en: "English",  label_fr: "Anglais",  label_ar: "إنجليزي" },
  { key: "fr", flag: "🇫🇷", label_en: "French",   label_fr: "Français", label_ar: "فرنسي"   },
  { key: "ru", flag: "🇷🇺", label_en: "Russian",  label_fr: "Russe",    label_ar: "روسي"    },
  { key: "zh", flag: "🇨🇳", label_en: "Chinese",  label_fr: "Chinois",  label_ar: "صيني"    },
  { key: "de", flag: "🇩🇪", label_en: "German",   label_fr: "Allemand", label_ar: "ألماني"  },
  { key: "it", flag: "🇮🇹", label_en: "Italian",  label_fr: "Italien",  label_ar: "إيطالي"  },
  { key: "tr", flag: "🇹🇷", label_en: "Turkish",  label_fr: "Turc",     label_ar: "تركي"    },
  { key: "ja", flag: "🇯🇵", label_en: "Japanese", label_fr: "Japonais", label_ar: "ياباني"  },
];

const SCORE_STEPS = [0, 40, 60, 75, 90];

const BUDGET_OPTS = [
  { label: "All budgets",    value: "all"    },
  { label: "< AED 2M",      value: "u2m"    },
  { label: "AED 2M – 5M",   value: "2m-5m"  },
  { label: "AED 5M – 10M",  value: "5m-10m" },
  { label: "> AED 10M",     value: "o10m"   },
];

const SCORE_OPTS = [
  { label: "Any score",  value: "0"  },
  { label: "Score ≥ 40", value: "40" },
  { label: "Score ≥ 60", value: "60" },
  { label: "Score ≥ 75", value: "75" },
  { label: "Score ≥ 90", value: "90" },
];

function budgetLabel(range: FilterState["budgetRange"]): string {
  switch (range) {
    case "u2m":    return "< AED 2M";
    case "2m-5m":  return "2M – 5M";
    case "5m-10m": return "5M – 10M";
    case "o10m":   return "> AED 10M";
    default:       return "All";
  }
}

/* ─── CrmFilterPill ─────────────────────────────────────────────────── */

function CrmFilterPill({
  label, displayValue, value, opts, isActive, gold, onSelect, renderMenu,
}: {
  label: string; displayValue: string; value?: string;
  opts?: { label: string; value: string }[]; isActive?: boolean; gold?: boolean;
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
          {displayValue}
          <span style={{ color: "var(--ink-4)", fontSize: 10, marginInlineStart: 1 }}>▾</span>
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

/* ─── FilterBar ─────────────────────────────────────────────────────── */

function FilterBar({ filter, onChange, totalCount, filteredCount }: {
  filter: FilterState;
  onChange: (f: FilterState) => void;
  totalCount: number;
  filteredCount: number;
}) {
  const bp    = useBreakpoint();
  const { lang } = useLang();
  const isMob = bp === "mobile";
  const active = isFilterActive(filter);

  const selectedLang = CLIENT_LANGS.find(l => l.key === filter.clientLang);
  const langLabel = selectedLang
    ? (lang === "ar" ? selectedLang.label_ar : lang === "fr" ? selectedLang.label_fr : selectedLang.label_en)
    : (lang === "ar" ? "اللغة" : lang === "fr" ? "Langue" : "Language");

  const coldChipBase: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "4px 10px", borderRadius: 999, fontSize: 11,
    fontFamily: "Roboto, sans-serif", cursor: "pointer", border: "1px solid var(--line-soft)",
    background: "var(--bg-paper)", color: "var(--ink-3)", whiteSpace: "nowrap", flexShrink: 0,
  };

  const activeCount = [
    filter.agent !== "all", filter.budgetRange !== "all", filter.scoreMin > 0,
    filter.goldOnly, filter.coldOnly, filter.clientLang !== "all",
  ].filter(Boolean).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", background: "var(--bg-cream)", borderBottom: "1px solid var(--line-soft)", flexShrink: 0 }}>

      {/* Search row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isMob ? "8px 12px" : "8px 24px 6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 999, border: "1px solid " + (filter.query ? "var(--ink)" : "var(--line-soft)"), background: "var(--bg-paper)", flex: 1 }}>
          <IcSearch />
          <input
            value={filter.query}
            onChange={e => onChange({ ...filter, query: e.target.value })}
            placeholder="Name, email, country, property…"
            style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: "var(--ink)", fontFamily: "Roboto, sans-serif", width: "100%" }}
          />
          {filter.query && (
            <button onClick={() => onChange({ ...filter, query: "" })}
              style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-4)", fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
          )}
        </div>
        {isMob && (
          <div style={{ fontSize: 11, color: active ? "var(--ink)" : "var(--ink-4)", fontWeight: active ? 600 : 400, whiteSpace: "nowrap" }} className="tnum">
            {active ? `${filteredCount}/${totalCount}` : totalCount}
          </div>
        )}
      </div>

      {/* Snapshot pill row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: isMob ? "4px 12px 10px" : "0 24px 10px", overflowX: "auto", WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}>

        {/* Agent */}
        <CrmFilterPill
          label="Agent"
          displayValue={filter.agent === "all" ? "All agents" : filter.agent}
          value={filter.agent}
          isActive={filter.agent !== "all"}
          opts={[
            { label: "All agents", value: "all" },
            { label: "YK",         value: "YK"  },
            { label: "OB",         value: "OB"  },
          ]}
          onSelect={v => onChange({ ...filter, agent: v as FilterState["agent"] })}
        />

        {/* Budget */}
        <CrmFilterPill
          label="Budget"
          displayValue={budgetLabel(filter.budgetRange)}
          value={filter.budgetRange}
          isActive={filter.budgetRange !== "all"}
          opts={BUDGET_OPTS}
          onSelect={v => onChange({ ...filter, budgetRange: v as FilterState["budgetRange"] })}
        />

        {/* Score */}
        <CrmFilterPill
          label="Score"
          displayValue={filter.scoreMin > 0 ? `≥ ${filter.scoreMin}` : "Any"}
          value={String(filter.scoreMin)}
          isActive={filter.scoreMin > 0}
          opts={SCORE_OPTS}
          onSelect={v => onChange({ ...filter, scoreMin: parseInt(v, 10) })}
        />

        {/* Golden Visa */}
        <CrmFilterPill
          label="Golden Visa"
          displayValue={filter.goldOnly ? "Eligible" : "All"}
          value={filter.goldOnly ? "yes" : "all"}
          isActive={filter.goldOnly}
          gold={filter.goldOnly}
          opts={[
            { label: "All leads",          value: "all" },
            { label: "Eligible (≥ 2M AED)", value: "yes" },
          ]}
          onSelect={v => onChange({ ...filter, goldOnly: v === "yes" })}
        />

        {/* Language */}
        <CrmFilterPill
          label="Language"
          displayValue={selectedLang ? `${selectedLang.flag} ${langLabel}` : "All"}
          value={filter.clientLang}
          isActive={filter.clientLang !== "all"}
          renderMenu={close => (
            <>
              <div
                onClick={() => { onChange({ ...filter, clientLang: "all" }); close(); }}
                style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 10, background: filter.clientLang === "all" ? "color-mix(in srgb,var(--gold) 8%,transparent)" : "transparent", color: filter.clientLang === "all" ? "var(--gold-deep)" : "var(--ink)", fontWeight: filter.clientLang === "all" ? 600 : 400 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-inset)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = filter.clientLang === "all" ? "color-mix(in srgb,var(--gold) 8%,transparent)" : "transparent"; }}
              >
                {filter.clientLang === "all" ? <IcCheck /> : <span style={{ width: 14, display: "inline-block" }} />}
                <span style={{ fontSize: 15 }}>🌐</span>
                {lang === "ar" ? "الكل" : lang === "fr" ? "Toutes les langues" : "All languages"}
              </div>
              {CLIENT_LANGS.map(lc => {
                const lbl = lang === "ar" ? lc.label_ar : lang === "fr" ? lc.label_fr : lc.label_en;
                const isOn = filter.clientLang === lc.key;
                return (
                  <div key={lc.key}
                    onClick={() => { onChange({ ...filter, clientLang: isOn ? "all" : lc.key }); close(); }}
                    style={{ padding: "9px 14px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 10, background: isOn ? "color-mix(in srgb,var(--gold) 8%,transparent)" : "transparent", color: isOn ? "var(--gold-deep)" : "var(--ink)", fontWeight: isOn ? 600 : 400 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "var(--bg-inset)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = isOn ? "color-mix(in srgb,var(--gold) 8%,transparent)" : "transparent"; }}
                  >
                    {isOn ? <IcCheck /> : <span style={{ width: 14, display: "inline-block" }} />}
                    <span style={{ fontSize: 15, lineHeight: 1 }}>{lc.flag}</span>
                    {lbl}
                  </div>
                );
              })}
            </>
          )}
        />

        {/* Cold — simple toggle chip */}
        <button onClick={() => onChange({ ...filter, coldOnly: !filter.coldOnly })}
          style={filter.coldOnly
            ? { ...coldChipBase, background: "rgba(234,88,12,0.08)", color: "#ea580c", borderColor: "rgba(234,88,12,0.4)" }
            : coldChipBase}>
          ❄ Cold
        </button>

        {/* Reset with badge */}
        {active && (
          <button onClick={() => onChange(DEFAULT_FILTER)}
            style={{ ...coldChipBase, color: "var(--rose)", borderColor: "rgba(220,50,50,0.4)", gap: 5 }}>
            Reset
            <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: "var(--rose)", color: "#fff" }}>{activeCount}</span>
          </button>
        )}

        {/* Lead count — desktop */}
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
                style={{ fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "var(--ink)", color: "var(--gold)", border: "none", cursor: "pointer", fontFamily: "Roboto, sans-serif" }}>
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

function LeadCard({ l, stageKey, onDragStart, onDragEnd, draggingId, onSelect, onMetaSearch }: {
  l: Lead; stageKey: string;
  onDragStart: (e: React.DragEvent, id: string, fromStage: string) => void;
  onDragEnd: () => void;
  draggingId: string | null;
  onSelect: (l: Lead, stage: string) => void;
  onMetaSearch?: (name: string) => void;
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
          {l.phone && (
            <a href={`sms:${l.phone}`} onClick={e => e.stopPropagation()}
              style={{ width: 22, height: 22, borderRadius: 11, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", display: "grid", placeItems: "center", color: "#3B82F6", textDecoration: "none" }}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </a>
          )}
          {onMetaSearch && (
            <button
              onClick={e => { e.stopPropagation(); onMetaSearch(l.name); }}
              title="Meta Snapshot — rechercher ce contact"
              style={{ width: 22, height: 22, borderRadius: 11, background: "linear-gradient(135deg,#0081fb,#a259ff)", border: "none", display: "grid", placeItems: "center", cursor: "pointer", color: "#fff", fontSize: 10, fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>
              M
            </button>
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

function KanbanCol({ stage, leads, onDragStart, onDragEnd, onDrop, draggingId, draggingFromStage, onSelect, isFiltered, onAddInStage, onMetaSearch }: {
  stage: typeof STAGES[0]; leads: Lead[];
  onDragStart: (e: React.DragEvent, id: string, fromStage: string) => void;
  onDragEnd: () => void;
  onDrop: (e: React.DragEvent, toStage: string) => void;
  draggingId: string | null; draggingFromStage: string | null;
  onSelect: (l: Lead, stage: string) => void;
  isFiltered: boolean;
  onAddInStage: (stage: string) => void;
  onMetaSearch: (name: string) => void;
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
            onMetaSearch={onMetaSearch}
          />
        ))}
        {leads.length === 0 && (
          <div style={{ flex: 1, minHeight: 64, borderRadius: "var(--r)", border: "2px dashed " + (isDragOver ? "var(--gold)" : "var(--line)"), display: "grid", placeItems: "center", color: isDragOver ? "var(--gold-deep)" : "var(--ink-5)", fontSize: 11, transition: "all 0.15s ease", background: isDragOver ? "rgba(217,183,119,0.08)" : "transparent", textAlign: "center", padding: 8 }}>
            {isDragOver ? "↓ Drop here" : isFiltered ? "No match" : "—"}
          </div>
        )}
        <button onClick={() => onAddInStage(stage.key)} style={{ padding: "10px 8px", borderRadius: 6, fontSize: 11, background: "transparent", border: "1px dashed var(--line)", color: "var(--ink-4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, flexShrink: 0 }}>
          <IcPlus /> Add
        </button>
      </div>
    </div>
  );
}

/* ─── LeadDetailDrawer ──────────────────────────────────────────────── */

function LeadDetailDrawer({ lead, stage, onClose, onNotesChange, onActivityAdd, onFollowUpMark, onMarkLost, onMetaSearch, onNavigateToClient }: {
  lead: Lead; stage: string;
  onClose: () => void;
  onNotesChange: (id: string, stage: string, notes: string) => void;
  onActivityAdd: (id: string, stage: string, a: Activity) => void;
  onFollowUpMark: (id: string, stage: string, step: keyof FollowUp) => void;
  onMarkLost: () => void;
  onMetaSearch: (name: string) => void;
  onNavigateToClient?: (name: string) => void;
}) {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const [noteMode,    setNoteMode]    = useState(false);
  const [noteText,    setNoteText]    = useState("");
  const [metaQuery,   setMetaQuery]   = useState(lead.name);
  const [metaResults, setMetaResults] = useState<MetaProfile[]>([]);
  const [metaLoading, setMetaLoading] = useState(false);
  const [metaSearched,setMetaSearched]= useState(false);
  const [metaAdded,   setMetaAdded]   = useState<Set<string>>(new Set());

  function runMetaSearch() {
    if (!metaQuery.trim() || metaLoading) return;
    setMetaLoading(true); setMetaSearched(false); setMetaResults([]);
    setTimeout(() => {
      setMetaResults(mockMetaSearch(metaQuery.trim()));
      setMetaLoading(false); setMetaSearched(true);
    }, 1200);
  }

  function addMetaToCRM(p: MetaProfile) {
    onMetaSearch(p.name);
    setMetaAdded(prev => new Set([...prev, p.id]));
  }

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
              {onNavigateToClient ? (
                <button
                  onClick={() => { onClose(); onNavigateToClient(lead.name); }}
                  style={{ fontSize: 15, fontWeight: 700, color: "var(--gold-deep)", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline dotted", textUnderlineOffset: 3 }}
                  title="Voir la fiche client"
                >
                  {lead.name}
                </button>
              ) : (
                <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{lead.name}</span>
              )}
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8 }}>
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
            {lead.phone && (
              <a href={`sms:${lead.phone}`} style={{ textDecoration: "none" }}>
                <button style={{ width: "100%", padding: "9px 0", borderRadius: "var(--r)", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "pointer", color: "#3B82F6" }}>
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  <span style={{ fontSize: 10 }}>SMS</span>
                </button>
              </a>
            )}
          </div>

          {/* ── Meta Snapshot Connector (Communication) ── */}
          <div style={{ background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid rgba(162,89,255,0.25)", overflow: "hidden" }}>

            {/* Header */}
            <div style={{ padding: "10px 14px", background: "linear-gradient(135deg,rgba(162,89,255,0.07),rgba(0,129,251,0.05))", borderBottom: "1px solid rgba(162,89,255,0.15)", display: "flex", alignItems: "center", gap: 8 }}>
              <IcMetaLogo />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>Meta Snapshot Connector</div>
                <div style={{ fontSize: 9.5, color: "var(--ink-4)", marginTop: 1 }}>Facebook · Instagram · WhatsApp</div>
              </div>
            </div>

            {/* Search bar */}
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: 6 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: "var(--r)", border: "1.5px solid " + (metaQuery ? "var(--ink)" : "var(--line-soft)"), background: "var(--bg-cream)" }}>
                <IcSearch />
                <input
                  value={metaQuery}
                  onChange={e => setMetaQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && runMetaSearch()}
                  placeholder="Nom du contact…"
                  style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12, color: "var(--ink)", fontFamily: "Roboto, sans-serif" }}
                />
                {metaQuery && (
                  <button onClick={() => { setMetaQuery(""); setMetaResults([]); setMetaSearched(false); }} style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-4)", fontSize: 15, lineHeight: 1, padding: 0 }}>×</button>
                )}
              </div>
              <button
                onClick={runMetaSearch}
                disabled={!metaQuery.trim() || metaLoading}
                style={{ padding: "0 12px", borderRadius: "var(--r)", background: metaQuery.trim() && !metaLoading ? "var(--ink)" : "var(--bg-inset)", color: metaQuery.trim() && !metaLoading ? "var(--gold)" : "var(--ink-4)", border: "none", fontSize: 11.5, fontFamily: "Roboto, sans-serif", cursor: metaQuery.trim() && !metaLoading ? "pointer" : "not-allowed", fontWeight: 600, flexShrink: 0 }}>
                {metaLoading ? "…" : "Chercher"}
              </button>
            </div>

            {/* Results area */}
            <div style={{ maxHeight: 320, overflowY: "auto", padding: metaResults.length || metaLoading || metaSearched ? "10px 12px" : 0, display: "flex", flexDirection: "column", gap: 8 }}>

              {/* Loading */}
              {metaLoading && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "16px 0", justifyContent: "center" }}>
                  <style>{`@keyframes sgi-spin2{to{transform:rotate(360deg)}}`}</style>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid var(--line-strong)", borderTopColor: "#0081fb", animation: "sgi-spin2 0.8s linear infinite" }} />
                  <div style={{ fontSize: 11, color: "var(--ink-4)" }}>Recherche Meta en cours…</div>
                </div>
              )}

              {/* No results */}
              {!metaLoading && metaSearched && metaResults.length === 0 && (
                <div style={{ padding: "14px 0", textAlign: "center", fontSize: 11, color: "var(--ink-4)" }}>
                  Aucun profil trouvé pour « {metaQuery} »
                </div>
              )}

              {/* Idle hint */}
              {!metaLoading && !metaSearched && (
                <div style={{ padding: "12px 0", textAlign: "center", fontSize: 11, color: "var(--ink-4)" }}>
                  Appuyez sur Chercher pour trouver les profils Meta de ce contact
                </div>
              )}

              {/* Result cards */}
              {!metaLoading && metaResults.map((p, i) => {
                const initials  = p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
                const isAdded   = metaAdded.has(p.id);
                const confColor = p.confidence >= 80 ? "var(--emerald)" : p.confidence >= 60 ? "var(--gold-deep)" : "var(--ink-4)";
                const confBg    = p.confidence >= 80 ? "rgba(16,185,129,0.1)" : p.confidence >= 60 ? "var(--gold-ghost)" : "var(--bg-inset)";
                return (
                  <div key={p.id} style={{ padding: 10, background: "var(--bg-ivory)", borderRadius: "var(--r)", border: "1px solid " + (i === 0 ? "var(--gold-line,var(--gold))" : "var(--line-soft)"), display: "flex", flexDirection: "column", gap: 8, boxShadow: i === 0 ? "0 0 0 2px color-mix(in srgb,var(--gold) 8%,transparent)" : "none" }}>
                    {/* Profile row */}
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <div style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0, background: i === 0 ? "linear-gradient(135deg,#0081fb,#a259ff)" : "var(--bg-inset)", color: i === 0 ? "#fff" : "var(--ink-4)", fontSize: 12, fontWeight: 700, display: "grid", placeItems: "center", border: i > 0 ? "1px solid var(--line-soft)" : "none" }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{p.name}</span>
                          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 999, background: confBg, color: confColor, fontWeight: 700 }}>{p.confidence}% match</span>
                          {i === 0 && <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 999, background: "rgba(162,89,255,0.1)", color: "#a259ff", border: "1px solid rgba(162,89,255,0.2)", fontWeight: 700 }}>Meilleur résultat</span>}
                        </div>
                        <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.location} · {p.bio}</div>
                        {p.mutualInterests && <div style={{ fontSize: 10, color: "var(--azure)", marginTop: 1 }}>Intérêts: {p.mutualInterests}</div>}
                      </div>
                    </div>
                    {/* Platform badges */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {p.platforms.map(pl => <PlatformBadge key={pl} p={pl} name={p.name} phone={p.phone} />)}
                      {p.phone && <span className="tnum" style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", color: "var(--ink-3)" }}>{p.phone}</span>}
                    </div>
                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {p.platforms.includes("whatsapp") && p.phone && (
                        <a href={`https://wa.me/${p.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: 1, minWidth: 80 }}>
                          <button style={{ width: "100%", padding: "7px 0", borderRadius: "var(--r)", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25d366", fontSize: 11, fontFamily: "Roboto, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><IcWhatsApp /> WhatsApp</button>
                        </a>
                      )}
                      {p.platforms.includes("facebook") && (
                        <a href={`https://m.me/${metaSlug(p.name)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: 1, minWidth: 80 }}>
                          <button style={{ width: "100%", padding: "7px 0", borderRadius: "var(--r)", background: "rgba(24,119,242,0.08)", border: "1px solid rgba(24,119,242,0.25)", color: "#1877f2", fontSize: 11, fontFamily: "Roboto, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><IcMessenger /> Messenger</button>
                        </a>
                      )}
                      {p.platforms.includes("instagram") && (
                        <a href={`https://ig.me/m/${metaSlug(p.name)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: 1, minWidth: 80 }}>
                          <button style={{ width: "100%", padding: "7px 0", borderRadius: "var(--r)", background: "rgba(225,48,108,0.08)", border: "1px solid rgba(225,48,108,0.25)", color: "#e1306c", fontSize: 11, fontFamily: "Roboto, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}><IcInstagramDM /> Instagram</button>
                        </a>
                      )}
                      <button
                        onClick={() => addMetaToCRM(p)}
                        disabled={isAdded}
                        style={{ flex: 1, minWidth: 90, padding: "7px 0", borderRadius: "var(--r)", fontSize: 11, fontFamily: "Roboto, sans-serif", cursor: isAdded ? "default" : "pointer", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 4, background: isAdded ? "var(--bg-inset)" : "var(--ink)", color: isAdded ? "var(--emerald)" : "var(--gold)", border: isAdded ? "1px solid rgba(16,185,129,0.3)" : "none" }}>
                        {isAdded ? <>✓ Ajouté</> : <><IcPlus /> Ajouter au CRM</>}
                      </button>
                    </div>
                  </div>
                );
              })}

              {metaSearched && metaResults.length > 0 && (
                <div style={{ fontSize: 9.5, color: "var(--ink-4)", textAlign: "center", paddingBottom: 4 }}>
                  Via Meta Snapshot · Profils publics · Conforme RGPD
                </div>
              )}
            </div>

            {/* Quick links footer — always visible */}
            <div style={{ padding: "8px 12px", borderTop: "1px solid var(--line-soft)", display: "flex", gap: 5, flexWrap: "wrap", background: "var(--bg-cream)" }}>
              {lead.phone && (
                <a href={`https://wa.me/${lead.phone.replace(/\D/g,"")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: 1, minWidth: 72 }}>
                  <button style={{ width: "100%", padding: "6px 0", borderRadius: "var(--r)", background: "rgba(37,211,102,0.08)", border: "1px solid rgba(37,211,102,0.25)", color: "#25d366", fontSize: 10.5, fontFamily: "Roboto, sans-serif", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><IcWhatsApp /><span style={{ fontSize: 9 }}>WhatsApp</span></button>
                </a>
              )}
              <a href={`https://m.me/${metaSlug(lead.name)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: 1, minWidth: 72 }}>
                <button style={{ width: "100%", padding: "6px 0", borderRadius: "var(--r)", background: "rgba(24,119,242,0.07)", border: "1px solid rgba(24,119,242,0.2)", color: "#1877f2", fontSize: 10.5, fontFamily: "Roboto, sans-serif", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><IcMessenger /><span style={{ fontSize: 9 }}>Messenger</span></button>
              </a>
              <a href={`https://ig.me/m/${metaSlug(lead.name)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: 1, minWidth: 72 }}>
                <button style={{ width: "100%", padding: "6px 0", borderRadius: "var(--r)", background: "rgba(225,48,108,0.07)", border: "1px solid rgba(225,48,108,0.2)", color: "#e1306c", fontSize: 10.5, fontFamily: "Roboto, sans-serif", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><IcInstagramDM /><span style={{ fontSize: 9 }}>Instagram</span></button>
              </a>
              <a href={`https://www.facebook.com/search/people/?q=${encodeURIComponent(lead.name)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: 1, minWidth: 72 }}>
                <button style={{ width: "100%", padding: "6px 0", borderRadius: "var(--r)", background: "rgba(24,119,242,0.05)", border: "1px solid rgba(24,119,242,0.18)", color: "#1877f2", fontSize: 10.5, fontFamily: "Roboto, sans-serif", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  <span style={{ fontSize: 9 }}>Facebook</span>
                </button>
              </a>
            </div>
          </div>

          {/* Profile Enrichment */}
          <ProfileEnrichmentPanel lead={lead} />

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
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", borderRadius: 6, fontSize: 11, fontFamily: "Roboto, sans-serif", background: noteMode && type === "note" ? "var(--ink)" : m.bg, color: noteMode && type === "note" ? "var(--gold)" : m.color, border: "1px solid " + (noteMode && type === "note" ? "var(--ink)" : "var(--line-soft)"), cursor: "pointer" }}>
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
                  style={{ flex: 1, padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-cream)", fontSize: 12, color: "var(--ink)", fontFamily: "Roboto, sans-serif", outline: "none" }}
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
              style={{ marginTop: 8, width: "100%", minHeight: 72, padding: 10, background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", fontSize: 12, color: "var(--ink)", fontFamily: "Roboto, sans-serif", resize: "vertical", outline: "none", lineHeight: 1.6, boxSizing: "border-box" }}
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
              style={{ width: "100%", padding: "8px 0", borderRadius: "var(--r)", fontSize: 11.5, fontFamily: "Roboto, sans-serif", cursor: "pointer", border: "1px solid rgba(220,50,50,0.3)", background: "rgba(220,50,50,0.04)", color: "var(--rose, #dc2626)", fontWeight: 500 }}>
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
  fontFamily: "Roboto, sans-serif", outline: "none", width: "100%", boxSizing: "border-box",
};

function AddLeadModal({ onClose, onAdd, targetStage }: { onClose: () => void; onAdd: (l: Lead) => void; targetStage?: string }) {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const bp    = useBreakpoint();
  const isMob = bp === "mobile";
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
      <div style={{ position: "fixed", top: "50%", insetInlineStart: "50%", transform: "translate(-50%,-50%)", width: isMob ? "calc(100vw - 28px)" : 480, background: "var(--bg-ivory)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-3)", zIndex: 201, display: "flex", flexDirection: "column", overflow: "hidden", maxHeight: "90vh" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Eyebrow>CRM · New lead</Eyebrow>
            <div className="font-display" style={{ fontSize: 20, marginTop: 4 }}>
            Add a lead
            {targetStage && targetStage !== "new" && (
              <span style={{ fontSize: 12, fontWeight: 400, color: "var(--ink-4)", marginInlineStart: 8 }}>
                → {STAGES.find(s => s.key === targetStage)?.en ?? targetStage}
              </span>
            )}
          </div>
          </div>
          <button onClick={onClose} style={{ width: 32, height: 32, borderRadius: 6, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 13, overflow: "auto" }}>
          <Field label="Full name *"><input style={inputStyle} value={form.name} onChange={set("name")} placeholder="Anna Schmidt" /></Field>
          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: 12 }}>
            <Field label="Phone"><input style={inputStyle} value={form.phone} onChange={set("phone")} placeholder="+971 50 000 0000" /></Field>
            <Field label="Email"><input style={inputStyle} type="email" value={form.email} onChange={set("email")} placeholder="client@email.com" /></Field>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: 12 }}>
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

function MobileStageList({ filteredLeads, onSelect, isFiltered, addModalOpen, onAdd, onMetaSearch }: {
  filteredLeads: Record<string, Lead[]>;
  onSelect: (l: Lead, stage: string) => void;
  isFiltered: boolean;
  addModalOpen: boolean;
  onAdd: () => void;
  onMetaSearch: (name: string) => void;
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
                      onMetaSearch={onMetaSearch}
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
      <div style={{ position: "fixed", top: "50%", insetInlineStart: "50%", transform: "translate(-50%,-50%)", width: "min(420px, calc(100vw - 28px))", background: "var(--bg-ivory)", borderRadius: "var(--r-md)", boxShadow: "var(--shadow-3)", zIndex: 301, overflow: "hidden" }}>
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
                style={{ padding: "6px 14px", borderRadius: 999, fontSize: 12, fontFamily: "Roboto, sans-serif", cursor: "pointer", border: "1px solid " + (selected === r ? "var(--rose)" : "var(--line-soft)"), background: selected === r ? "rgba(220,50,50,0.08)" : "var(--bg-paper)", color: selected === r ? "var(--rose)" : "var(--ink-3)", fontWeight: selected === r ? 600 : 400, transition: "all 0.12s" }}>
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
              style={{ padding: "8px 12px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-cream)", fontSize: 12, color: "var(--ink)", fontFamily: "Roboto, sans-serif", outline: "none" }}
            />
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="sgi-btn sgi-btn-ghost" onClick={onClose}>Cancel</button>
          <button onClick={confirm} disabled={!selected}
            style={{ padding: "8px 18px", borderRadius: "var(--r)", fontSize: 12, fontFamily: "Roboto, sans-serif", cursor: selected ? "pointer" : "not-allowed", background: selected ? "var(--rose, #dc2626)" : "var(--bg-inset)", color: selected ? "#fff" : "var(--ink-4)", border: "none", fontWeight: 600, transition: "all 0.12s" }}>
            Confirm loss
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── LeadListView ───────────────────────────────────────────────────── */

function LeadListView({ leads, onSelect }: {
  leads: Record<string, Lead[]>;
  onSelect: (l: Lead, stage: string) => void;
}) {
  const { lang } = useLang();
  const [sortKey, setSortKey] = useState<"budget" | "score" | "name" | "days">("score");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  type FlatLead = Lead & { stageKey: string; stageObj: typeof STAGES[0] };
  const allLeads: FlatLead[] = STAGES.flatMap(s =>
    (leads[s.key] ?? []).map(l => ({ ...l, stageKey: s.key, stageObj: s }))
  );

  const sorted = [...allLeads].sort((a, b) => {
    const dir = sortDir === "desc" ? -1 : 1;
    if (sortKey === "budget") return dir * (a.budget - b.budget);
    if (sortKey === "score")  return dir * (a.score  - b.score);
    if (sortKey === "days")   return dir * ((a.lastContactDays ?? 0) - (b.lastContactDays ?? 0));
    return dir * a.name.localeCompare(b.name);
  });

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir("desc"); }
  }

  const hdrStyle = (k?: typeof sortKey): React.CSSProperties => ({
    fontSize: 10.5, letterSpacing: "0.1em", color: k && sortKey === k ? "var(--ink)" : "var(--ink-4)",
    textTransform: "uppercase", cursor: k ? "pointer" : "default",
    userSelect: "none", display: "inline-flex", alignItems: "center", gap: 3,
  });

  const COLS = "2fr 100px 110px 50px 120px 50px 80px 60px";

  return (
    <div style={{ overflow: "auto", flex: 1 }}>
      {/* Header row */}
      <div style={{ display: "grid", gridTemplateColumns: COLS, padding: "10px 18px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-inset)", position: "sticky", top: 0, zIndex: 1 }}>
        {(["Name · Country", "Budget", "Property", "Score", "Stage", "Agent", "Contact", "Follow-up"] as const).map((label, i) => {
          const keyMap: (typeof sortKey | undefined)[] = ["name", "budget", undefined, "score", undefined, undefined, "days", undefined];
          const k = keyMap[i];
          return (
            <span key={label} onClick={k ? () => toggleSort(k) : undefined} style={hdrStyle(k)}>
              {label}
              {k && sortKey === k && <span style={{ fontSize: 9 }}>{sortDir === "desc" ? "↓" : "↑"}</span>}
            </span>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12, color: "var(--ink-4)" }}>No leads match your filters</div>
      )}

      {sorted.map(l => {
        const scoreColor = l.score >= 80 ? "var(--emerald)" : l.score >= 50 ? "var(--gold)" : "var(--ink-4)";
        const isCold = (l.lastContactDays ?? 0) > 5;
        const stageLabel = lang === "ar" ? l.stageObj.ar : lang === "fr" ? l.stageObj.fr : l.stageObj.en;
        return (
          <div
            key={l.id}
            onClick={() => onSelect(l, l.stageKey)}
            onMouseEnter={() => setHoveredId(l.id)}
            onMouseLeave={() => setHoveredId(null)}
            style={{
              display: "grid", gridTemplateColumns: COLS, padding: "11px 18px",
              borderBottom: "1px solid var(--line-soft)", alignItems: "center",
              cursor: "pointer", fontSize: 12,
              background: hoveredId === l.id ? "var(--bg-inset)" : "transparent",
              transition: "background 0.1s",
            }}
          >
            {/* Name + country */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 600, color: "var(--ink)" }}>{l.name}</span>
                {l.gold && <Chip tone="gold">GV</Chip>}
                {isCold && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3, background: "rgba(234,88,12,0.1)", color: "#ea580c", border: "1px solid rgba(234,88,12,0.2)" }}>COLD</span>
                )}
              </div>
              <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 1 }}>{l.ctry} · {l.channel}</div>
            </div>

            {/* Budget */}
            <span className="font-display tnum" style={{ fontSize: 12.5, color: l.gold ? "var(--gold-deep)" : "var(--ink)" }}>
              AED {(l.budget / 1_000_000).toFixed(1)}M
            </span>

            {/* Property */}
            <span style={{ fontSize: 11, color: "var(--ink-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.prop}</span>

            {/* Score badge */}
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: scoreColor, color: "#fff", display: "inline-block" }} className="tnum">
              {l.score}
            </span>

            {/* Stage pill */}
            <span style={{ fontSize: 10, padding: "3px 8px", borderRadius: 999, border: "1.5px solid " + l.stageObj.color, color: l.stageObj.color, fontWeight: 600, display: "inline-block", whiteSpace: "nowrap" }}>
              {stageLabel}
            </span>

            {/* Agent avatar */}
            <div style={{ width: 24, height: 24, borderRadius: 12, background: l.agent !== "—" ? "var(--ink)" : "var(--bg-inset)", color: l.agent !== "—" ? "var(--gold)" : "var(--ink-4)", fontSize: 9.5, display: "grid", placeItems: "center", fontWeight: 600, border: l.agent === "—" ? "1px dashed var(--line-strong)" : "none", flexShrink: 0 }}>
              {l.agent === "—" ? "?" : l.agent}
            </div>

            {/* Last contact */}
            <span style={{ fontSize: 11, color: isCold ? "#ea580c" : "var(--ink-4)" }} className="tnum">
              {l.lastContactDays !== undefined ? (l.lastContactDays === 0 ? "Today" : `${l.lastContactDays}d ago`) : l.days}
            </span>

            {/* Follow-up dots */}
            {l.followUp ? <FollowUpTimeline followUp={l.followUp} mode="compact" /> : <span />}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Meta Contact Search ────────────────────────────────────────────── */

type MetaProfile = {
  id: string;
  name: string;
  location: string;
  bio: string;
  platforms: ("facebook" | "instagram" | "whatsapp")[];
  phone?: string;
  confidence: number;
  mutualInterests?: string;
};

const META_SURNAMES = [
  ["Al-Rashid", "Al-Mansoori", "Al-Farsi", "Hassan", "Ahmed"],
  ["Al-Khoury", "Bin Ali", "Khalil", "Nasser", "Salem"],
  ["Al-Zaabi", "Al-Marri", "Al-Nuaimi", "Bin Hamad", "Al-Qubaisi"],
];
const META_LOCS = ["Dubai, UAE", "Abu Dhabi, UAE", "Sharjah, UAE", "Ajman, UAE", "Ras Al Khaimah, UAE"];
const META_BIOS = [
  "Real estate investor · Private",
  "Entrepreneur · Business owner",
  "Family office · Private",
  "Director — private holding",
  "Investor · Luxury assets",
];

function mockMetaSearch(query: string): MetaProfile[] {
  if (!query.trim()) return [];
  const q = query.trim();
  const first = q.split(" ")[0];
  const seed  = Array.from(q).reduce((a, c) => a + c.charCodeAt(0), 0);
  function pick<T>(arr: T[], off = 0): T { return arr[(seed + off) % arr.length]; }
  function ph(pfx: string) {
    return `+971 ${pfx} ${String(100 + (seed % 900)).slice(0, 3)} ${String(1000 + (seed * 7 % 9000)).slice(0, 4)}`;
  }
  return [
    {
      id: "mp1", name: q,
      location: pick(META_LOCS, 0), bio: pick(META_BIOS, 0),
      platforms: ["facebook", "instagram", "whatsapp"],
      phone: ph("50"), confidence: 91,
      mutualInterests: "Real estate · Luxury properties",
    },
    {
      id: "mp2", name: `${first} ${pick(META_SURNAMES[0], 1)}`,
      location: pick(META_LOCS, 1), bio: pick(META_BIOS, 2),
      platforms: ["facebook", "whatsapp"],
      phone: ph("55"), confidence: 74,
    },
    {
      id: "mp3", name: `${first} ${pick(META_SURNAMES[1], 2)}`,
      location: pick(META_LOCS, 2), bio: pick(META_BIOS, 4),
      platforms: ["instagram"],
      confidence: 55,
    },
    {
      id: "mp4", name: `${first} ${pick(META_SURNAMES[2], 3)}`,
      location: pick(META_LOCS, 3), bio: pick(META_BIOS, 3),
      platforms: ["facebook"],
      confidence: 39,
    },
  ];
}

/* Génère un slug URL à partir d'un nom (ex: "Khalid Al-Hashimi" → "khalid.al-hashimi") */
function metaSlug(name: string): string {
  return name.toLowerCase().replace(/[\s']+/g, ".").replace(/[^a-z0-9.]/g, "").replace(/\.{2,}/g, ".");
}

function IcMetaLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 28 28" fill="none">
      <defs>
        <linearGradient id="mg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0081fb" />
          <stop offset="100%" stopColor="#a259ff" />
        </linearGradient>
      </defs>
      <circle cx="14" cy="14" r="14" fill="url(#mg)" />
      <path d="M8 18c0-3 1.5-5.5 4-7l2-1.5 2 1.5c2.5 1.5 4 4 4 7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="14" cy="9.5" r="1.8" fill="#fff" />
    </svg>
  );
}

function IcMessenger() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.145 2 11.243c0 2.908 1.46 5.5 3.75 7.19v3.067l2.873-1.575A10.23 10.23 0 0 0 12 21.25c5.523 0 10-4.145 10-9.243S17.477 2 12 2zm1.018 12.352-2.545-2.712-4.97 2.712 5.507-5.843 2.609 2.712 4.908-2.712-5.509 5.843z"/>
    </svg>
  );
}

function IcInstagramDM() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
    </svg>
  );
}

/* Badge cliquable pointant vers le profil ou la recherche de la personne */
function PlatformBadge({ p, name, phone }: { p: MetaProfile["platforms"][0]; name: string; phone?: string }) {
  const cfg = {
    facebook:  { label: "Facebook",  bg: "rgba(24,119,242,0.1)",  color: "#1877f2", border: "rgba(24,119,242,0.3)"  },
    instagram: { label: "Instagram", bg: "rgba(225,48,108,0.1)",  color: "#e1306c", border: "rgba(225,48,108,0.3)"  },
    whatsapp:  { label: "WhatsApp",  bg: "rgba(37,211,102,0.1)",  color: "#25d366", border: "rgba(37,211,102,0.3)"  },
  }[p];

  const slug = metaSlug(name);
  const href =
    p === "facebook"  ? `https://www.facebook.com/search/people/?q=${encodeURIComponent(name)}` :
    p === "instagram" ? `https://www.instagram.com/${slug}/` :
    phone             ? `https://wa.me/${phone.replace(/\D/g, "")}` : undefined;

  const badge = (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, fontWeight: 600, cursor: href ? "pointer" : "default" }}>
      {cfg.label}
    </span>
  );
  return href
    ? <a href={href} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>{badge}</a>
    : badge;
}

function MetaContactSearchPanel({ onClose, onAddToCRM, initialQuery }: {
  onClose: () => void;
  onAddToCRM: (p: MetaProfile) => void;
  initialQuery?: string;
}) {
  const [query,    setQuery]    = useState(initialQuery ?? "");
  const [results,  setResults]  = useState<MetaProfile[]>([]);
  const [loading,  setLoading]  = useState(!!initialQuery?.trim());
  const [searched, setSearched] = useState(false);
  const [added,    setAdded]    = useState<Set<string>>(new Set());

  /* Auto-search when opened from a lead card */
  React.useEffect(() => {
    if (initialQuery?.trim()) {
      setTimeout(() => {
        setResults(mockMetaSearch(initialQuery.trim()));
        setLoading(false); setSearched(true);
      }, 1400);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function doSearch() {
    if (!query.trim() || loading) return;
    setLoading(true); setSearched(false); setResults([]);
    const q = query.trim();
    setTimeout(() => {
      setResults(mockMetaSearch(q));
      setLoading(false); setSearched(true);
    }, 1400);
  }

  function handleAdd(p: MetaProfile) {
    onAddToCRM(p);
    setAdded(prev => new Set([...prev, p.id]));
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(26,22,16,0.45)", zIndex: 300, backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "fixed", top: "50%", insetInlineStart: "50%",
        transform: "translate(-50%,-50%)",
        width: "min(560px, calc(100vw - 24px))", maxHeight: "85vh",
        background: "var(--bg-ivory)", borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-3)", zIndex: 301,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>

        {/* ── Header ── */}
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <IcMetaLogo />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>Meta Snapshot Connector</div>
              <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 1 }}>Recherche contacts · Facebook · Instagram · WhatsApp</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 6, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--ink-3)", fontSize: 18, lineHeight: 1 }}>×</button>
        </div>

        {/* ── Search bar ── */}
        <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-cream)", display: "flex", gap: 8 }}>
          <div style={{
            flex: 1, display: "flex", alignItems: "center", gap: 8,
            padding: "9px 14px", borderRadius: "var(--r)",
            border: "1.5px solid " + (query ? "var(--ink)" : "var(--line-soft)"),
            background: "var(--bg-paper)",
          }}>
            <IcSearch />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && doSearch()}
              placeholder="Nom du client (ex: Khalid Al-Hashimi, Maria Petrova…)"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--ink)", fontFamily: "Roboto, sans-serif" }}
            />
            {query && (
              <button onClick={() => { setQuery(""); setResults([]); setSearched(false); }}
                style={{ border: "none", background: "none", cursor: "pointer", color: "var(--ink-4)", fontSize: 17, lineHeight: 1, padding: 0 }}>×</button>
            )}
          </div>
          <button onClick={doSearch} disabled={!query.trim() || loading}
            style={{
              padding: "0 20px", borderRadius: "var(--r)",
              background: query.trim() && !loading ? "var(--ink)" : "var(--bg-inset)",
              color: query.trim() && !loading ? "var(--gold)" : "var(--ink-4)",
              border: "none", fontSize: 12.5, fontFamily: "Roboto, sans-serif",
              cursor: query.trim() && !loading ? "pointer" : "not-allowed", fontWeight: 600,
              transition: "background 0.12s",
            }}>
            {loading ? "…" : "Chercher"}
          </button>
        </div>

        {/* ── Results ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 22px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "36px 0" }}>
              <style>{`@keyframes sgi-spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ width: 26, height: 26, borderRadius: "50%", border: "2.5px solid var(--line-strong)", borderTopColor: "#0081fb", animation: "sgi-spin 0.8s linear infinite" }} />
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>Connexion Meta Snapshot · recherche en cours…</div>
            </div>
          )}

          {/* Idle hint */}
          {!loading && !searched && (
            <div style={{ padding: "44px 0", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <div style={{ opacity: 0.35, fontSize: 32 }}>🔍</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", maxWidth: 320, lineHeight: 1.7 }}>
                Saisissez le nom d'un prospect pour retrouver ses profils Facebook, Instagram ou WhatsApp Business via le connecteur Meta Snapshot.
              </div>
            </div>
          )}

          {/* No results */}
          {!loading && searched && results.length === 0 && (
            <div style={{ padding: "40px 0", textAlign: "center", fontSize: 12, color: "var(--ink-4)" }}>
              Aucun profil trouvé pour &laquo; {query} &raquo;
            </div>
          )}

          {/* Result cards */}
          {!loading && results.map((p, i) => {
            const initials  = p.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
            const isAdded   = added.has(p.id);
            const confColor = p.confidence >= 80 ? "var(--emerald)" : p.confidence >= 60 ? "var(--gold-deep)" : "var(--ink-4)";
            const confBg    = p.confidence >= 80 ? "rgba(16,185,129,0.1)" : p.confidence >= 60 ? "var(--gold-ghost)" : "var(--bg-inset)";

            return (
              <div key={p.id} style={{
                padding: 14, background: "var(--bg-paper)", borderRadius: "var(--r)",
                border: "1px solid " + (i === 0 ? "var(--gold-line, var(--gold))" : "var(--line-soft)"),
                boxShadow: i === 0 ? "0 0 0 2px color-mix(in srgb,var(--gold) 10%,transparent)" : "none",
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                {/* Profile info */}
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: 21, flexShrink: 0,
                    background: i === 0 ? "linear-gradient(135deg,#0081fb,#a259ff)" : "var(--bg-inset)",
                    color: i === 0 ? "#fff" : "var(--ink-4)",
                    fontSize: 14, fontWeight: 700, display: "grid", placeItems: "center",
                    border: i > 0 ? "1px solid var(--line-soft)" : "none",
                  }}>
                    {initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{p.name}</span>
                      <span style={{ fontSize: 9.5, padding: "1px 7px", borderRadius: 999, background: confBg, color: confColor, fontWeight: 700 }}>
                        {p.confidence}% match
                      </span>
                      {i === 0 && (
                        <span style={{ fontSize: 9.5, padding: "1px 7px", borderRadius: 999, background: "rgba(162,89,255,0.1)", color: "#a259ff", border: "1px solid rgba(162,89,255,0.25)", fontWeight: 700 }}>
                          Meilleur résultat
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 3 }}>{p.location} · {p.bio}</div>
                    {p.mutualInterests && (
                      <div style={{ fontSize: 10.5, color: "var(--azure)", marginTop: 2 }}>Intérêts communs: {p.mutualInterests}</div>
                    )}
                  </div>
                </div>

                {/* Platforms + phone — badges cliquables */}
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                  {p.platforms.map(pl => <PlatformBadge key={pl} p={pl} name={p.name} phone={p.phone} />)}
                  {p.phone && (
                    <a href={`tel:${p.phone}`} style={{ textDecoration: "none" }}>
                      <span className="tnum" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 999, background: "var(--bg-inset)", border: "1px solid var(--line-soft)", color: "var(--ink-3)", cursor: "pointer" }}>
                        {p.phone}
                      </span>
                    </a>
                  )}
                </div>

                {/* Actions — tous actifs */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {/* WhatsApp */}
                  {p.platforms.includes("whatsapp") && p.phone && (
                    <a href={`https://wa.me/${p.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: 1, minWidth: 100 }}>
                      <button style={{ width: "100%", padding: "8px 0", borderRadius: "var(--r)", background: "rgba(37,211,102,0.1)", border: "1px solid rgba(37,211,102,0.3)", color: "#25d366", fontSize: 11.5, fontFamily: "Roboto, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <IcWhatsApp /> WhatsApp
                      </button>
                    </a>
                  )}

                  {/* Messenger */}
                  {p.platforms.includes("facebook") && (
                    <a href={`https://m.me/${metaSlug(p.name)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: 1, minWidth: 100 }}>
                      <button style={{ width: "100%", padding: "8px 0", borderRadius: "var(--r)", background: "rgba(24,119,242,0.08)", border: "1px solid rgba(24,119,242,0.25)", color: "#1877f2", fontSize: 11.5, fontFamily: "Roboto, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <IcMessenger /> Messenger
                      </button>
                    </a>
                  )}

                  {/* Instagram DM */}
                  {p.platforms.includes("instagram") && (
                    <a href={`https://ig.me/m/${metaSlug(p.name)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none", flex: 1, minWidth: 100 }}>
                      <button style={{ width: "100%", padding: "8px 0", borderRadius: "var(--r)", background: "rgba(225,48,108,0.08)", border: "1px solid rgba(225,48,108,0.25)", color: "#e1306c", fontSize: 11.5, fontFamily: "Roboto, sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                        <IcInstagramDM /> Instagram
                      </button>
                    </a>
                  )}

                  {/* Ajouter au CRM */}
                  <button
                    onClick={() => handleAdd(p)}
                    disabled={isAdded}
                    style={{
                      flex: 1, minWidth: 110, padding: "8px 0", borderRadius: "var(--r)", fontSize: 11.5,
                      fontFamily: "Roboto, sans-serif", cursor: isAdded ? "default" : "pointer",
                      fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      background: isAdded ? "var(--bg-inset)" : "var(--ink)",
                      color: isAdded ? "var(--emerald)" : "var(--gold)",
                      border: isAdded ? "1px solid rgba(16,185,129,0.3)" : "none",
                      transition: "all 0.15s",
                    }}>
                    {isAdded ? <>✓ Ajouté</> : <><IcPlus /> Ajouter au CRM</>}
                  </button>
                </div>
              </div>
            );
          })}

          {searched && results.length > 0 && (
            <div style={{ fontSize: 10, color: "var(--ink-4)", textAlign: "center", padding: "6px 0 2px" }}>
              Via Meta Snapshot Connector · Profils publics uniquement · Conforme RGPD
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── ScreenCRM ─────────────────────────────────────────────────────── */

export function ScreenCRM({ onNavigateToClient }: { onNavigateToClient?: (name: string) => void } = {}) {
  const t = useT();
  const { lang } = useLang();
  const bp    = useBreakpoint();
  const isMob = bp === "mobile";

  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [leads, setLeads] = useState<Record<string, Lead[]>>(LEADS_INIT);
  const [addTargetStage, setAddTargetStage] = useState<string>("new");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingFromStage, setDraggingFromStage] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<{ lead: Lead; stage: string } | null>(null);
  const [addModalOpen,   setAddModalOpen]   = useState(false);
  const [metaSearchOpen, setMetaSearchOpen] = useState(false);
  const [metaQuery,      setMetaQuery]      = useState("");
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [lostModal, setLostModal] = useState<{ lead: Lead; stage: string } | null>(null);

  function openMetaSearch(name?: string) {
    setMetaQuery(name ?? "");
    setMetaSearchOpen(true);
  }

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
    setLeads(prev => ({ ...prev, [addTargetStage]: [lead, ...(prev[addTargetStage] ?? [])] }));
  }

  function handleAddFromMeta(profile: MetaProfile) {
    const newLead: Lead = {
      id:   `l${Date.now()}`,
      name: profile.name,
      ctry: profile.location.includes("UAE") ? "🇦🇪 UAE" : profile.location,
      budget: 2_000_000,
      prop:  "—",
      score: Math.round(profile.confidence * 0.55),
      days:  "today",
      agent: "—",
      channel: profile.platforms.includes("facebook")
        ? "Facebook"
        : profile.platforms.includes("instagram")
          ? "Instagram"
          : "WhatsApp",
      phone:         profile.phone,
      gold:          false,
      followUp:      DEFAULT_FOLLOW_UP,
      lastContactDays: 0,
    };
    setLeads(prev => ({ ...prev, new: [newLead, ...(prev.new ?? [])] }));
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
        {!isMob && (
          <button
            onClick={() => openMetaSearch()}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--r)", border: "1px solid rgba(162,89,255,0.4)", background: "rgba(162,89,255,0.07)", color: "#a259ff", fontSize: 12, fontFamily: "Roboto, sans-serif", cursor: "pointer", fontWeight: 600 }}>
            <IcMetaLogo />
            Meta Snapshot
          </button>
        )}
        {!isMob && (
          <div style={{ display: "flex", gap: 2, padding: 3, background: "var(--bg-inset)", borderRadius: "var(--r)" }}>
            <button onClick={() => setView("kanban")} style={{ padding: "4px 8px", borderRadius: 4, border: "none", cursor: "pointer", display: "flex", alignItems: "center", background: view === "kanban" ? "var(--bg-ivory)" : "transparent", color: view === "kanban" ? "var(--ink)" : "var(--ink-3)", boxShadow: view === "kanban" ? "var(--shadow-1)" : "none" }}>
              <IcGrid />
            </button>
            <button onClick={() => setView("list")} style={{ padding: "4px 8px", borderRadius: 4, border: "none", cursor: "pointer", display: "flex", alignItems: "center", background: view === "list" ? "var(--bg-ivory)" : "transparent", color: view === "list" ? "var(--ink)" : "var(--ink-3)", boxShadow: view === "list" ? "var(--shadow-1)" : "none" }}>
              <IcList />
            </button>
          </div>
        )}
        {!isMob && <button className="sgi-btn sgi-btn-primary" onClick={() => { setAddTargetStage("new"); setAddModalOpen(true); }}><IcPlus />&nbsp;{t.add}</button>}
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
            onMetaSearch={openMetaSearch}
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

          {/* Kanban OR List view */}
          {view === "kanban" ? (
            <div style={{ flex: 1, overflowX: bp === "tablet" ? "auto" : "visible", overflowY: "hidden", minHeight: 0 }}>
              <div style={{ display: "grid", gridTemplateColumns: bp === "tablet" ? "repeat(6, minmax(200px, 1fr))" : "repeat(6, 1fr)", gap: 10, height: "100%", minHeight: 0 }}>
                {STAGES.map(s => (
                  <KanbanCol
                    key={s.key} stage={s} leads={filteredLeads[s.key] ?? []}
                    onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDrop={handleDrop}
                    draggingId={draggingId} draggingFromStage={draggingFromStage}
                    onSelect={(l, stage) => setSelectedLead({ lead: l, stage })}
                    isFiltered={isFilterActive(filter)}
                    onAddInStage={(stg) => { setAddTargetStage(stg); setAddModalOpen(true); }}
                    onMetaSearch={openMetaSearch}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="sgi-card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                <div>
                  <Eyebrow>All leads · {Object.values(filteredLeads).flat().length} showing</Eyebrow>
                  <div className="font-display" style={{ fontSize: 18, marginTop: 2 }}>Pipeline list</div>
                </div>
                <div style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
                  Click a row to open the detail drawer
                </div>
              </div>
              <LeadListView
                leads={filteredLeads}
                onSelect={(l, stage) => setSelectedLead({ lead: l, stage })}
              />
            </div>
          )}
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
          onMetaSearch={openMetaSearch}
          onNavigateToClient={onNavigateToClient}
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
        <AddLeadModal onClose={() => setAddModalOpen(false)} onAdd={handleAddLead} targetStage={addTargetStage} />
      )}

      {metaSearchOpen && (
        <MetaContactSearchPanel
          onClose={() => { setMetaSearchOpen(false); setMetaQuery(""); }}
          onAddToCRM={handleAddFromMeta}
          initialQuery={metaQuery}
        />
      )}
    </div>
  );
}
