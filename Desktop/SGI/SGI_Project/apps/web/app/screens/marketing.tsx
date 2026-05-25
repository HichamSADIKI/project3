"use client";

import React, { useState } from "react";
import { Topbar, IcMarketing, IcFilter, IcPlus, IcTrend, IcMail, IcChat, IcPhone } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useLang } from "@/components/language-provider";

/* ─── Types ──────────────────────────────────────────────────────── */
type CampaignStatus = "active" | "draft" | "paused" | "completed";
type CampaignChannel = "email" | "whatsapp" | "sms" | "social";

interface Campaign {
  id: string;
  name: string;
  channel: CampaignChannel;
  status: CampaignStatus;
  audience: number;
  sent: number;
  openRate: number;
  clickRate: number;
  leads: number;
  budget: number;
  spent: number;
  startDate: string;
  endDate: string;
}

/* ─── Mock data ──────────────────────────────────────────────────── */
const CAMPAIGNS: Campaign[] = [
  { id: "MKT-001", name: "Golden Visa Q2 2026", channel: "email", status: "active", audience: 2840, sent: 2840, openRate: 34.2, clickRate: 8.7, leads: 47, budget: 15000, spent: 8200, startDate: "2026-05-01", endDate: "2026-06-30" },
  { id: "MKT-002", name: "Résidences Palm Jumeirah", channel: "whatsapp", status: "active", audience: 1200, sent: 1200, openRate: 68.4, clickRate: 22.1, leads: 89, budget: 8000, spent: 5100, startDate: "2026-05-10", endDate: "2026-05-31" },
  { id: "MKT-003", name: "Offres tourisme été 2026", channel: "email", status: "draft", audience: 3500, sent: 0, openRate: 0, clickRate: 0, leads: 0, budget: 12000, spent: 0, startDate: "2026-06-01", endDate: "2026-08-31" },
  { id: "MKT-004", name: "Assurance habitation Dubai", channel: "sms", status: "completed", audience: 960, sent: 960, openRate: 91.3, clickRate: 14.5, leads: 32, budget: 4500, spent: 4500, startDate: "2026-04-01", endDate: "2026-04-30" },
  { id: "MKT-005", name: "Consultants entreprises UAE", channel: "social", status: "paused", audience: 18000, sent: 9400, openRate: 5.2, clickRate: 1.8, leads: 24, budget: 20000, spent: 9800, startDate: "2026-04-15", endDate: "2026-06-15" },
  { id: "MKT-006", name: "Health Check — Abu Dhabi", channel: "whatsapp", status: "active", audience: 780, sent: 780, openRate: 72.1, clickRate: 18.9, leads: 41, budget: 5000, spent: 3200, startDate: "2026-05-15", endDate: "2026-06-15" },
  { id: "MKT-007", name: "Banques — Compte Premium", channel: "email", status: "active", audience: 2100, sent: 2100, openRate: 28.7, clickRate: 6.4, leads: 19, budget: 9000, spent: 6100, startDate: "2026-05-01", endDate: "2026-06-30" },
];

/* ─── Config ─────────────────────────────────────────────────────── */
const STATUS_CFG: Record<CampaignStatus, { label_en: string; label_ar: string; label_fr: string; color: string; bg: string }> = {
  active:    { label_en: "Active",     label_ar: "نشطة",     label_fr: "Active",    color: "var(--emerald)", bg: "var(--emerald-soft)" },
  draft:     { label_en: "Draft",      label_ar: "مسودة",    label_fr: "Brouillon", color: "var(--ink-4)",   bg: "var(--bg-ivory)" },
  paused:    { label_en: "Paused",     label_ar: "موقوفة",   label_fr: "En pause",  color: "var(--gold)",    bg: "var(--gold-ghost)" },
  completed: { label_en: "Completed",  label_ar: "مكتملة",   label_fr: "Terminée",  color: "var(--azure)",   bg: "var(--azure-soft)" },
};

const CHANNEL_CFG: Record<CampaignChannel, { label_en: string; label_ar: string; label_fr: string; icon: React.ReactElement; color: string }> = {
  email:     { label_en: "Email",    label_ar: "البريد الإلكتروني", label_fr: "E-mail",    icon: <IcMail />,  color: "var(--azure)" },
  whatsapp:  { label_en: "WhatsApp", label_ar: "واتساب",            label_fr: "WhatsApp",  icon: <IcChat />,  color: "var(--emerald)" },
  sms:       { label_en: "SMS",      label_ar: "رسالة نصية",        label_fr: "SMS",       icon: <IcPhone />, color: "var(--ink-3)" },
  social:    { label_en: "Social",   label_ar: "وسائل التواصل",     label_fr: "Réseaux",   icon: <IcTrend />, color: "#8B5CF6" },
};

/* ─── KPI card ───────────────────────────────────────────────────── */
function KpiCard({ label, value, sub, color = "var(--gold)" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{sub}</div>}
    </div>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────── */
export function ScreenMarketing() {
  const t = useT();
  const { lang } = useLang();
  const isAr = lang === "ar";
  const isFr = lang === "fr";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [channelFilter, setChannelFilter] = useState<CampaignChannel | "all">("all");

  const filtered = CAMPAIGNS.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.id.toLowerCase().includes(q) || c.name.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchChannel = channelFilter === "all" || c.channel === channelFilter;
    return matchSearch && matchStatus && matchChannel;
  });

  const totalLeads   = CAMPAIGNS.reduce((s, c) => s + c.leads, 0);
  const totalBudget  = CAMPAIGNS.reduce((s, c) => s + c.budget, 0);
  const totalSpent   = CAMPAIGNS.reduce((s, c) => s + c.spent, 0);
  const activeCamps  = CAMPAIGNS.filter(c => c.status === "active").length;
  const avgOpen      = (CAMPAIGNS.filter(c => c.sent > 0).reduce((s, c) => s + c.openRate, 0) / CAMPAIGNS.filter(c => c.sent > 0).length).toFixed(1);

  const title = isAr ? "التسويق" : isFr ? "Marketing" : "Marketing";
  const colLabel = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "var(--bg-base)" }}>
      <Topbar title={title}>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 7, height: 36, padding: "0 14px", borderRadius: "var(--r)", background: "var(--gold)", color: "#1A1610", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          <IcPlus />
          {colLabel("New campaign", "حملة جديدة", "Nouvelle campagne")}
        </button>
      </Topbar>

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
          <KpiCard label={colLabel("Active Campaigns", "الحملات النشطة", "Campagnes actives")} value={activeCamps} color="var(--emerald)" />
          <KpiCard label={colLabel("Total Leads", "إجمالي العملاء المحتملين", "Total leads")} value={totalLeads} color="var(--gold)" />
          <KpiCard label={colLabel("Avg. Open Rate", "متوسط معدل الفتح", "Taux d'ouverture moy.")} value={`${avgOpen}%`} color="var(--azure)" />
          <KpiCard label={colLabel("Budget Spent", "الميزانية المُنفقة", "Budget dépensé")} value={`AED ${totalSpent.toLocaleString("en-AE")}`} sub={`/ AED ${totalBudget.toLocaleString("en-AE")}`} color="var(--ink-2)" />
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200, background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "0 12px", height: 36 }}>
            <IcFilter />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={colLabel("Search campaigns…", "بحث…", "Rechercher…")}
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 12.5, color: "var(--ink)", outline: "none" }}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as CampaignStatus | "all")}
            style={{ height: 36, padding: "0 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", fontSize: 12.5, color: "var(--ink-2)", cursor: "pointer" }}
          >
            <option value="all">{colLabel("All statuses", "كل الحالات", "Tous les statuts")}</option>
            {(Object.keys(STATUS_CFG) as CampaignStatus[]).map(s => (
              <option key={s} value={s}>{isAr ? STATUS_CFG[s].label_ar : isFr ? STATUS_CFG[s].label_fr : STATUS_CFG[s].label_en}</option>
            ))}
          </select>
          <select
            value={channelFilter}
            onChange={e => setChannelFilter(e.target.value as CampaignChannel | "all")}
            style={{ height: 36, padding: "0 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", fontSize: 12.5, color: "var(--ink-2)", cursor: "pointer" }}
          >
            <option value="all">{colLabel("All channels", "كل القنوات", "Tous les canaux")}</option>
            {(Object.keys(CHANNEL_CFG) as CampaignChannel[]).map(ch => (
              <option key={ch} value={ch}>{isAr ? CHANNEL_CFG[ch].label_ar : isFr ? CHANNEL_CFG[ch].label_fr : CHANNEL_CFG[ch].label_en}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--line-soft)", background: "var(--bg-ivory)" }}>
                  {[
                    colLabel("Campaign", "الحملة", "Campagne"),
                    colLabel("Channel", "القناة", "Canal"),
                    colLabel("Status", "الحالة", "Statut"),
                    colLabel("Audience", "الجمهور", "Audience"),
                    colLabel("Open %", "معدل الفتح", "Ouverture %"),
                    colLabel("Click %", "معدل النقر", "Clic %"),
                    colLabel("Leads", "العملاء", "Leads"),
                    colLabel("Spent / Budget", "المُنفق / الميزانية", "Dépensé / Budget"),
                    colLabel("Period", "الفترة", "Période"),
                  ].map((h, i) => (
                    <th key={i} style={{ padding: "10px 14px", textAlign: "start", fontWeight: 600, color: "var(--ink-4)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => {
                  const st = STATUS_CFG[c.status];
                  const ch = CHANNEL_CFG[c.channel];
                  const statusLabel = isAr ? st.label_ar : isFr ? st.label_fr : st.label_en;
                  const spentPct = c.budget > 0 ? Math.round((c.spent / c.budget) * 100) : 0;
                  return (
                    <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--line-soft)" : "none", transition: "background 0.12s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-ivory)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ fontWeight: 600, color: "var(--ink)" }}>{c.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 2 }}>{c.id}</div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, color: ch.color, fontWeight: 500 }}>
                          {ch.icon}
                          {isAr ? ch.label_ar : isFr ? ch.label_fr : ch.label_en}
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600, background: st.bg, color: st.color }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ padding: "12px 14px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                        {c.audience.toLocaleString("en-AE")}
                      </td>
                      <td style={{ padding: "12px 14px", color: c.openRate > 50 ? "var(--emerald)" : "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                        {c.sent > 0 ? `${c.openRate}%` : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                        {c.sent > 0 ? `${c.clickRate}%` : "—"}
                      </td>
                      <td style={{ padding: "12px 14px" }}>
                        <span style={{ fontWeight: 700, color: "var(--gold-deep)", fontSize: 13 }}>{c.leads}</span>
                      </td>
                      <td style={{ padding: "12px 14px", minWidth: 160 }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <div style={{ fontSize: 11.5, color: "var(--ink-2)", fontVariantNumeric: "tabular-nums" }}>
                            AED {c.spent.toLocaleString("en-AE")} / {c.budget.toLocaleString("en-AE")}
                          </div>
                          <div style={{ height: 4, borderRadius: 2, background: "var(--line-soft)", overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(spentPct, 100)}%`, background: spentPct > 90 ? "var(--rose)" : "var(--gold)", borderRadius: 2, transition: "width 0.3s" }} />
                          </div>
                          <div style={{ fontSize: 10, color: "var(--ink-4)" }}>{spentPct}%</div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 14px", color: "var(--ink-4)", fontSize: 11.5, whiteSpace: "nowrap" }}>
                        {c.startDate} → {c.endDate}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: "40px 14px", textAlign: "center", color: "var(--ink-4)" }}>
                      {colLabel("No campaigns found.", "لا توجد حملات.", "Aucune campagne trouvée.")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
