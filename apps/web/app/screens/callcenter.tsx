"use client";

import React, { useState } from "react";
import { IcSearch, IcPlus, IcMore, IcPhone, IcChat, IcMail, IcCheck } from "@/components/sgi-ui";

/* ─── Types ─────────────────────────────────────────────────────────── */
type CallStatus  = "queued" | "in_progress" | "completed" | "missed" | "callback";
type CallChannel = "inbound" | "outbound" | "whatsapp" | "email";
type Campaign    =
  | "support"
  | "qualification"
  | "appointment"
  | "after_sales"
  | "survey"
  | "retention";

interface CallRecord {
  id: string;
  client: string;
  client_ar: string;
  phone: string;
  channel: CallChannel;
  campaign: Campaign;
  status: CallStatus;
  agent: string;
  duration_s: number;
  queued_at: string;
  notes: string;
}

interface AgentStat {
  name: string;
  status: "online" | "busy" | "break" | "offline";
  calls_today: number;
  avg_handle_s: number;
  satisfaction: number;
}

/* ─── Mock data ──────────────────────────────────────────────────────── */
const CALLS: CallRecord[] = [
  { id: "CC-1042", client: "Mohammed Al-Hamdan",  client_ar: "محمد الحمدان",     phone: "+971 50 312 4408", channel: "inbound",  campaign: "support",       status: "in_progress", agent: "Sara Ben Youssef",  duration_s: 184, queued_at: "2026-05-29 09:42", notes: "Question on Ejari renewal" },
  { id: "CC-1041", client: "Vikram Patel",        client_ar: "فيكرام باتيل",     phone: "+971 55 412 7733", channel: "outbound", campaign: "qualification", status: "completed",   agent: "Khalid Al-Mansoori", duration_s: 312, queued_at: "2026-05-29 09:21", notes: "Hot lead, follow-up Friday" },
  { id: "CC-1040", client: "Sarah Thompson",      client_ar: "سارة تومبسون",      phone: "+44 20 7946 0958", channel: "whatsapp", campaign: "appointment",   status: "completed",   agent: "Priya Nair",         duration_s: 0,   queued_at: "2026-05-29 09:14", notes: "Visit booked Sat 10:30" },
  { id: "CC-1039", client: "Fatima Al-Zaabi",     client_ar: "فاطمة الزعابي",     phone: "+971 50 887 2210", channel: "inbound",  campaign: "after_sales",   status: "missed",      agent: "—",                  duration_s: 0,   queued_at: "2026-05-29 09:02", notes: "Voicemail left" },
  { id: "CC-1038", client: "Carlos Mendez",       client_ar: "كارلوس مندز",       phone: "+34 91 555 8741",  channel: "outbound", campaign: "retention",     status: "callback",    agent: "Ahmed Al-Rashid",    duration_s: 0,   queued_at: "2026-05-29 08:58", notes: "Asked callback at 14:00" },
  { id: "CC-1037", client: "Li Wei",              client_ar: "لي وي",            phone: "+86 21 5555 0192", channel: "email",    campaign: "survey",        status: "queued",      agent: "—",                  duration_s: 0,   queued_at: "2026-05-29 08:50", notes: "CSAT survey pending" },
  { id: "CC-1036", client: "Nina Hoffmann",       client_ar: "نينا هوفمان",       phone: "+49 30 555 4421",  channel: "outbound", campaign: "qualification", status: "completed",   agent: "Omar Qassem",        duration_s: 248, queued_at: "2026-05-29 08:34", notes: "Budget 1.8M AED, ready Q3" },
  { id: "CC-1035", client: "Rashid Al-Mansoori",  client_ar: "راشد المنصوري",     phone: "+971 50 661 9920", channel: "inbound",  campaign: "support",       status: "completed",   agent: "Sara Ben Youssef",   duration_s: 127, queued_at: "2026-05-29 08:18", notes: "DEWA transfer resolved" },
];

const AGENTS: AgentStat[] = [
  { name: "Sara Ben Youssef",   status: "busy",   calls_today: 32, avg_handle_s: 168, satisfaction: 4.7 },
  { name: "Khalid Al-Mansoori", status: "online", calls_today: 28, avg_handle_s: 195, satisfaction: 4.5 },
  { name: "Priya Nair",         status: "online", calls_today: 24, avg_handle_s: 142, satisfaction: 4.8 },
  { name: "Ahmed Al-Rashid",    status: "busy",   calls_today: 21, avg_handle_s: 203, satisfaction: 4.4 },
  { name: "Omar Qassem",        status: "break",  calls_today: 18, avg_handle_s: 176, satisfaction: 4.6 },
  { name: "Fatima Al-Zaabi",    status: "offline", calls_today: 14, avg_handle_s: 188, satisfaction: 4.5 },
];

/* ─── Config ─────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<CallStatus, { label: string; color: string; bg: string }> = {
  queued:      { label: "En file",     color: "#6B7280", bg: "#F3F4F6" },
  in_progress: { label: "En cours",    color: "#2563EB", bg: "#DBEAFE" },
  completed:   { label: "Terminé",     color: "#059669", bg: "#D1FAE5" },
  missed:      { label: "Manqué",      color: "#DC2626", bg: "#FEE2E2" },
  callback:    { label: "Rappel",      color: "#D97706", bg: "#FEF3C7" },
};

const CAMPAIGN_LABELS: Record<Campaign, string> = {
  support:       "Support",
  qualification: "Qualification",
  appointment:   "RDV",
  after_sales:   "Après-vente",
  survey:        "Enquête",
  retention:     "Rétention",
};

const CHANNEL_ICON: Record<CallChannel, React.ReactElement> = {
  inbound:  <IcPhone />,
  outbound: <IcPhone />,
  whatsapp: <IcChat />,
  email:    <IcMail />,
};

const CHANNEL_LABEL: Record<CallChannel, string> = {
  inbound:  "Entrant",
  outbound: "Sortant",
  whatsapp: "WhatsApp",
  email:    "Email",
};

const AGENT_STATUS_COLOR: Record<AgentStat["status"], string> = {
  online:  "var(--emerald)",
  busy:    "var(--gold)",
  break:   "#F59E0B",
  offline: "var(--ink-4)",
};

const AGENT_STATUS_LABEL: Record<AgentStat["status"], string> = {
  online:  "En ligne",
  busy:    "Occupé",
  break:   "Pause",
  offline: "Hors ligne",
};

const fmtDur = (s: number) => {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${String(r).padStart(2, "0")}s`;
};

/* ─── Screen ─────────────────────────────────────────────────────────── */
export function ScreenCallCenter() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CallStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<CallChannel | "all">("all");

  const filtered = CALLS.filter(c => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.client.toLowerCase().includes(q) ||
      c.client_ar.includes(q) ||
      c.phone.includes(q) ||
      c.id.toLowerCase().includes(q);
    const matchStatus  = statusFilter === "all"  || c.status  === statusFilter;
    const matchChannel = channelFilter === "all" || c.channel === channelFilter;
    return matchSearch && matchStatus && matchChannel;
  });

  const activeAgents = AGENTS.filter(a => a.status === "online" || a.status === "busy").length;
  const avgHandle    = Math.round(AGENTS.reduce((a, b) => a + b.avg_handle_s, 0) / AGENTS.length);
  const totalToday   = AGENTS.reduce((a, b) => a + b.calls_today, 0);

  const kpis = [
    { label: "Appels aujourd'hui", value: totalToday,                                          color: "var(--azure)" },
    { label: "En file",            value: CALLS.filter(c => c.status === "queued").length,    color: "var(--gold)"  },
    { label: "Agents actifs",      value: `${activeAgents}/${AGENTS.length}`,                  color: "var(--emerald)" },
    { label: "AHT moyen",          value: fmtDur(avgHandle),                                   color: "var(--ink-2)" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-cream)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink-1)" }}>Call Center · Centre de contact</div>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 2 }}>Supervision en temps réel des files, agents et campagnes</div>
          </div>
          <button style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
            background: "var(--gold)", color: "#1A1610", borderRadius: "var(--r)",
            border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            <IcPlus /> Nouvelle campagne
          </button>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: "var(--bg-base)", borderRadius: "var(--r)", padding: "14px 16px", border: "1px solid var(--border)" }}>
              <div className="tnum" style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>{k.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 160 }}>
            <span style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }}><IcSearch /></span>
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un appel, un client, un numéro…"
              style={{ width: "100%", paddingInlineStart: 34, paddingInlineEnd: 10, height: 36, border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--bg-base)", fontSize: 13, color: "var(--ink-1)", boxSizing: "border-box" }}
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as CallStatus | "all")}
            style={{ height: 36, border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--bg-base)", fontSize: 13, color: "var(--ink-2)", paddingInline: 10, cursor: "pointer" }}>
            <option value="all">Tous les statuts</option>
            {(Object.keys(STATUS_CFG) as CallStatus[]).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
          </select>
          <select value={channelFilter} onChange={e => setChannelFilter(e.target.value as CallChannel | "all")}
            style={{ height: 36, border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--bg-base)", fontSize: 13, color: "var(--ink-2)", paddingInline: 10, cursor: "pointer" }}>
            <option value="all">Tous les canaux</option>
            {(Object.keys(CHANNEL_LABEL) as CallChannel[]).map(ch => <option key={ch} value={ch}>{CHANNEL_LABEL[ch]}</option>)}
          </select>
        </div>
      </div>

      {/* Body — calls table + agents panel */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 24px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 320px", gap: 16 }}>
        {/* Calls table */}
        <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden", height: "fit-content" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink-1)" }}>File d'appels en direct</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{filtered.length} entrée{filtered.length !== 1 ? "s" : ""}</div>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", borderBottom: "1px solid var(--border)" }}>
                {["Appel", "Canal", "Campagne", "Agent", "Durée", "Statut", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "start", fontSize: 11.5, fontWeight: 600, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>Aucun appel ne correspond aux filtres</td></tr>
              ) : filtered.map((c, i) => {
                const sc = STATUS_CFG[c.status];
                return (
                  <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", transition: "background .12s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-cream)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink-1)" }}>{c.client}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 1 }}>{c.client_ar} · <span className="tnum">{c.phone}</span></div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>{c.id} · {c.queued_at}</div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--ink-2)", fontSize: 12.5 }}>
                        <span style={{ color: "var(--ink-3)" }}>{CHANNEL_ICON[c.channel]}</span>
                        {CHANNEL_LABEL[c.channel]}
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink-2)" }}>{CAMPAIGN_LABELS[c.campaign]}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>{c.agent}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink-2)" }} className="tnum">{fmtDur(c.duration_s)}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "end" }}>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", padding: 4 }}>
                        <IcMore />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Agents panel */}
        <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden", height: "fit-content" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink-1)" }}>Agents</div>
            <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{AGENTS.length} membres</div>
          </div>
          <div>
            {AGENTS.map((a, i) => (
              <div key={a.name} style={{
                padding: "12px 16px",
                borderBottom: i < AGENTS.length - 1 ? "1px solid var(--border)" : "none",
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 999,
                  background: AGENT_STATUS_COLOR[a.status], flexShrink: 0,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 1 }}>
                    {AGENT_STATUS_LABEL[a.status]} · <span className="tnum">{a.calls_today}</span> appels · AHT <span className="tnum">{fmtDur(a.avg_handle_s)}</span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: "var(--emerald)", fontWeight: 600 }}>
                  <IcCheck />
                  <span className="tnum">{a.satisfaction.toFixed(1)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
