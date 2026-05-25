"use client";

import React, { useState } from "react";
import { IcSearch, IcPlus, IcPhone, IcMail, IcChat, IcMore, IcArrowUp, IcArrowDown, IcCRM } from "@/components/sgi-ui";
import type { ConfirmedDeal } from "@/components/deal-wizard";

/* ─── Sector config ──────────────────────────────────────────────────── */
export type Sector =
  | "realestate" | "tourisme" | "sante" | "assurance"
  | "banques" | "amazon" | "consultants" | "admin" | "travail";

type PipelineStage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

interface SectorMeta {
  label: string;
  label_ar: string;
  color: string;
  services: string[];
  budgetRange: [number, number];
  currency?: string;
}

const SECTORS: Record<Sector, SectorMeta> = {
  realestate:  { label: "Real Estate",    label_ar: "العقارات",           color: "#C9A84C", services: ["Achat villa", "Achat appartement", "Location longue durée", "Location courte durée", "Investissement off-plan", "Revente"], budgetRange: [500000, 5000000] },
  tourisme:    { label: "Tourisme",       label_ar: "السياحة",            color: "#0EA5E9", services: ["Séjour hôtelier", "Circuit touristique", "Visa touriste", "Transfer VIP", "Yacht charter", "Excursion"], budgetRange: [5000, 80000] },
  sante:       { label: "Santé",          label_ar: "الصحة",              color: "#10B981", services: ["Bilan médical", "Chirurgie", "Télémédecine", "Assurance santé", "Rapatriement médical", "Check-up premium"], budgetRange: [3000, 200000] },
  assurance:   { label: "Assurance",      label_ar: "التأمين",            color: "#8B5CF6", services: ["Assurance habitation", "Assurance auto", "Assurance vie", "Assurance voyage", "Responsabilité civile", "Multirisque"], budgetRange: [2000, 50000] },
  banques:     { label: "Banques",        label_ar: "البنوك",             color: "#3B82F6", services: ["Ouverture compte", "Crédit immobilier", "Prêt personnel", "Investissement", "Carte premium", "Gestion patrimoniale"], budgetRange: [10000, 2000000] },
  amazon:      { label: "Amazon",         label_ar: "أمازون",             color: "#F59E0B", services: ["Logistique FBA", "Création boutique", "Marketing produits", "Gestion stocks", "Optimisation SEO", "Formation vendeur"], budgetRange: [5000, 150000] },
  consultants: { label: "Consultants",    label_ar: "المستشارون",         color: "#EC4899", services: ["Conseil stratégique", "Audit opérationnel", "Formation équipe", "Transformation digitale", "Due diligence", "Restructuration"], budgetRange: [15000, 500000] },
  admin:       { label: "Administrations", label_ar: "الإدارات",          color: "#6366F1", services: ["Création société", "Visa résidence", "Permis travail", "PRO services", "Notariat", "Légalisation documents"], budgetRange: [2000, 30000] },
  travail:     { label: "Emploi",         label_ar: "التوظيف",            color: "#14B8A6", services: ["Recrutement cadre", "Placement temporaire", "Chasseur de tête", "Audit RH", "Formation", "Outplacement"], budgetRange: [10000, 120000] },
};

const STAGE_CFG: Record<PipelineStage, { label: string; color: string; bg: string }> = {
  new:       { label: "Nouveau",    color: "#6B7280", bg: "#F3F4F6" },
  contacted: { label: "Contacté",   color: "#2563EB", bg: "#DBEAFE" },
  qualified: { label: "Qualifié",   color: "#D97706", bg: "#FEF3C7" },
  proposal:  { label: "Proposition",color: "#7C3AED", bg: "#EDE9FE" },
  won:       { label: "Gagné",      color: "#059669", bg: "#D1FAE5" },
  lost:      { label: "Perdu",      color: "#DC2626", bg: "#FEE2E2" },
};

const STAGES_PIPELINE: PipelineStage[] = ["new", "contacted", "qualified", "proposal", "won"];

const AGENTS = ["Ahmed Al-Rashid", "Sara Ben Youssef", "Khalid Al-Mansoori", "Priya Nair", "Fatima Al-Zaabi", "Omar Qassem"];
const NAMES = [
  ["Mohammed Al-Hamdan", "محمد الحمدان", "🇦🇪"], ["Jean-Pierre Leblanc", "جان بيار", "🇫🇷"],
  ["Vikram Patel", "فيكرام باتيل", "🇮🇳"], ["Sarah Thompson", "سارة تومبسون", "🇬🇧"],
  ["Li Wei", "لي وي", "🇨🇳"], ["Fatima Al-Zaabi", "فاطمة الظاهرية", "🇦🇪"],
  ["Carlos Mendez", "كارلوس مندز", "🇪🇸"], ["Anna Kowalski", "آنا كوفالسكي", "🇵🇱"],
  ["Rashid Al-Mansoori", "راشد المنصوري", "🇦🇪"], ["Nina Hoffmann", "نينا هوفمان", "🇩🇪"],
  ["Tariq Hassan", "طارق حسن", "🇯🇴"], ["Elena Popescu", "إيلينا بوبيسكو", "🇷🇴"],
];

function genLeads(sector: Sector): Lead[] {
  const meta = SECTORS[sector];
  const stages: PipelineStage[] = ["new", "new", "contacted", "contacted", "qualified", "qualified", "proposal", "won", "won", "lost", "contacted", "qualified"];
  return NAMES.map((n, i) => ({
    id: `${sector.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
    name: n[0], name_ar: n[1], flag: n[2],
    service: meta.services[i % meta.services.length],
    budget: Math.round((meta.budgetRange[0] + (meta.budgetRange[1] - meta.budgetRange[0]) * ((i * 7 + 3) % 10) / 10) / 1000) * 1000,
    stage: stages[i],
    score: 30 + (i * 13) % 65,
    agent: AGENTS[i % AGENTS.length],
    date: `2026-0${4 + (i % 2)}-${String(1 + (i * 7) % 28).padStart(2, "0")}`,
    phone: `+971 5${i % 2 === 0 ? "0" : "5"} ${String(200 + i * 37).slice(0, 3)} ${String(4000 + i * 83).slice(0, 4)}`,
  }));
}

interface Lead {
  id: string; name: string; name_ar: string; flag: string;
  service: string; budget: number; stage: PipelineStage;
  score: number; agent: string; date: string; phone: string;
  isFromClient?: boolean;
}

const fmt = (n: number) => new Intl.NumberFormat("en-AE", { notation: n >= 1000000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
const fmtFull = (n: number) => new Intl.NumberFormat("en-AE").format(n);

/* ─── Convert ConfirmedDeal → Lead ──────────────────────────────────── */
function dealToLead(d: ConfirmedDeal): Lead & { isFromClient: true } {
  return {
    id: d.crmRef,
    name: d.clientName,
    name_ar: d.clientName,
    flag: "👤",
    service: d.propType || d.urgency || "—",
    budget: d.budgetMax || d.budgetMin || 0,
    stage: "new" as PipelineStage,
    score: 60,
    agent: d.clientAgent,
    date: d.date,
    phone: "—",
    isFromClient: true,
  };
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
export function ScreenSectorCRM({ sector, confirmedDeals = [] }: { sector: Sector; confirmedDeals?: ConfirmedDeal[] }) {
  const meta = SECTORS[sector];
  const clientLeads = confirmedDeals
    .filter(d => d.category === sector)
    .map(dealToLead);
  const allLeads = [...clientLeads, ...genLeads(sector)];

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
  const [view, setView] = useState<"list" | "pipeline">("list");

  const filtered = allLeads.filter(l => {
    const q = search.toLowerCase();
    const matchQ = !q || l.name.toLowerCase().includes(q) || l.name_ar.includes(q) || l.service.toLowerCase().includes(q);
    const matchS = stageFilter === "all" || l.stage === stageFilter;
    return matchQ && matchS;
  });

  const stageCount = (s: PipelineStage) => allLeads.filter(l => l.stage === s).length;
  const totalPipeline = allLeads.filter(l => !["won", "lost"].includes(l.stage)).reduce((a, l) => a + l.budget, 0);
  const wonValue = allLeads.filter(l => l.stage === "won").reduce((a, l) => a + l.budget, 0);

  const kpis = [
    { label: "Nouveaux leads",  value: stageCount("new"),       color: "var(--ink-2)", delta: +12 },
    { label: "Qualifiés",       value: stageCount("qualified"),  color: "#D97706",     delta: +5  },
    { label: "Gagnés (30j)",    value: stageCount("won"),        color: "#059669",     delta: +2  },
    { label: "Pipeline total",  value: `AED ${fmt(totalPipeline)}`, color: meta.color, delta: +18, isStr: true },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-cream)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 4, height: 28, borderRadius: 2, background: meta.color, flexShrink: 0 }} />
            <div>
              <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink-1)" }}>
                {meta.label} · CRM
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 2 }}>
                {meta.label_ar} · Pipeline commercial
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* View toggle */}
            <div style={{ display: "flex", border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
              {(["list", "pipeline"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: "7px 14px", fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer",
                  background: view === v ? meta.color : "var(--bg-base)",
                  color: view === v ? "#fff" : "var(--ink-3)",
                  transition: "all .15s",
                }}>
                  {v === "list" ? "Liste" : "Pipeline"}
                </button>
              ))}
            </div>
            <button style={{
              display: "flex", alignItems: "center", gap: 6, padding: "9px 16px",
              background: meta.color, color: "#fff", borderRadius: "var(--r)",
              border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer",
            }}>
              <IcPlus /> Nouveau lead
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: "var(--bg-base)", borderRadius: "var(--r)", padding: "14px 16px", border: "1px solid var(--border)" }}>
              <div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.isStr ? k.value : k.value}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{k.label}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: k.delta > 0 ? "#059669" : "#DC2626", display: "flex", alignItems: "center", gap: 2 }}>
                  {k.delta > 0 ? <IcArrowUp /> : <IcArrowDown />}{Math.abs(k.delta)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline stages bar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {STAGES_PIPELINE.map((s, i) => {
            const cfg = STAGE_CFG[s];
            const count = stageCount(s);
            const isLast = i === STAGES_PIPELINE.length - 1;
            return (
              <React.Fragment key={s}>
                <button onClick={() => setStageFilter(p => p === s ? "all" : s)} style={{
                  flex: 1, minWidth: 80, padding: "10px 12px", borderRadius: "var(--r)", border: "none", cursor: "pointer", textAlign: "start",
                  background: stageFilter === s ? cfg.bg : "var(--bg-base)",
                  outline: stageFilter === s ? `2px solid ${cfg.color}` : "1px solid var(--border)",
                  transition: "all .15s",
                }}>
                  <div className="tnum" style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>{count}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, whiteSpace: "nowrap" }}>{cfg.label}</div>
                </button>
                {!isLast && <div style={{ display: "flex", alignItems: "center", color: "var(--ink-5)", fontSize: 16 }}>›</div>}
              </React.Fragment>
            );
          })}
          <button onClick={() => setStageFilter(p => p === "lost" ? "all" : "lost")} style={{
            minWidth: 80, padding: "10px 12px", borderRadius: "var(--r)", border: "none", cursor: "pointer", textAlign: "start",
            background: stageFilter === "lost" ? STAGE_CFG.lost.bg : "var(--bg-base)",
            outline: stageFilter === "lost" ? `2px solid ${STAGE_CFG.lost.color}` : "1px solid var(--border)",
          }}>
            <div className="tnum" style={{ fontSize: 18, fontWeight: 700, color: STAGE_CFG.lost.color }}>{stageCount("lost")}</div>
            <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>Perdus</div>
          </button>
        </div>

        {/* Search bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }}><IcSearch /></span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un lead…"
              style={{ width: "100%", paddingInlineStart: 34, paddingInlineEnd: 10, height: 36, border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--bg-base)", fontSize: 13, color: "var(--ink-1)", boxSizing: "border-box" }} />
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{filtered.length} lead{filtered.length !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 24px" }}>
        {view === "pipeline" ? (
          /* Kanban columns */
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {STAGES_PIPELINE.map(s => {
              const cfg = STAGE_CFG[s];
              const leads = filtered.filter(l => l.stage === s);
              return (
                <div key={s} style={{ minWidth: 220, flex: "0 0 220px" }}>
                  <div style={{ padding: "8px 12px", borderRadius: "var(--r)", marginBottom: 8, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
                    <span className="tnum" style={{ fontSize: 11, background: "#fff", color: cfg.color, borderRadius: 999, padding: "1px 7px", fontWeight: 700 }}>{leads.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {leads.map(l => (
                      <div key={l.id} style={{ background: l.isFromClient ? `${meta.color}08` : "var(--bg-base)", border: `1px solid ${l.isFromClient ? meta.color + "40" : "var(--border)"}`, borderRadius: "var(--r)", padding: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)" }}>{l.flag} {l.name}</span>
                          {l.isFromClient && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: meta.color, color: "#fff" }}>CLIENT</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 0 }}>{l.service}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                          <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>AED {fmtFull(l.budget)}</span>
                          <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{l.agent.split(" ")[0]}</span>
                        </div>
                        <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: "var(--border)" }}>
                          <div style={{ height: "100%", borderRadius: 2, background: meta.color, width: `${l.score}%` }} />
                        </div>
                        <div style={{ fontSize: 10, color: "var(--ink-5)", marginTop: 3 }}>Score {l.score}/100</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* List view */
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-cream)", borderBottom: "1px solid var(--border)" }}>
                  {["Lead", "Besoin", "Budget (AED)", "Étape", "Score", "Agent", "Date", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "start", fontSize: 11.5, fontWeight: 600, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 32, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>Aucun résultat</td></tr>
                ) : filtered.map((lead, i) => {
                  const sc = STAGE_CFG[lead.stage];
                  const rowBg = lead.isFromClient ? `${meta.color}08` : "";
                  return (
                    <tr key={lead.id}
                      style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", background: rowBg }}
                      onMouseEnter={e => (e.currentTarget.style.background = lead.isFromClient ? `${meta.color}14` : "var(--bg-cream)")}
                      onMouseLeave={e => (e.currentTarget.style.background = rowBg)}>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{lead.flag}</span>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink-1)" }}>{lead.name}</span>
                              {lead.isFromClient && (
                                <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: meta.color, color: "#fff", letterSpacing: "0.05em" }}>CLIENT</span>
                              )}
                            </div>
                            <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{lead.id}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px", fontSize: 12.5, color: "var(--ink-2)", maxWidth: 160 }}>{lead.service}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{fmtFull(lead.budget)}</span>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <span style={{ padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: sc.bg, color: sc.color }}>{sc.label}</span>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--border)", minWidth: 40 }}>
                            <div style={{ height: "100%", borderRadius: 2, background: meta.color, width: `${lead.score}%` }} />
                          </div>
                          <span className="tnum" style={{ fontSize: 11, color: "var(--ink-4)", flexShrink: 0 }}>{lead.score}</span>
                        </div>
                      </td>
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--ink-3)" }}>{lead.agent}</td>
                      <td style={{ padding: "11px 14px" }}>
                        <span className="tnum" style={{ fontSize: 12, color: "var(--ink-4)" }}>{lead.date}</span>
                      </td>
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          {[<IcPhone />, <IcMail />, <IcChat />].map((ic, idx) => (
                            <button key={idx} style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "none", border: "1px solid var(--border)", cursor: "pointer", color: "var(--ink-4)" }}>
                              {ic}
                            </button>
                          ))}
                          <button style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "none", border: "1px solid var(--border)", cursor: "pointer", color: "var(--ink-4)" }}>
                            <IcMore />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Won value banner */}
        <div style={{ marginTop: 12, padding: "10px 16px", borderRadius: "var(--r)", border: `1px solid ${meta.color}30`, background: `${meta.color}08`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Chiffre d'affaires clôturé (mois en cours)</span>
          <span className="tnum" style={{ fontSize: 15, fontWeight: 700, color: meta.color }}>AED {fmtFull(wonValue)}</span>
        </div>
      </div>
    </div>
  );
}
