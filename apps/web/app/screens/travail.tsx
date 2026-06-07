"use client";

import React, { useState } from "react";
import { IcSearch, IcFilter, IcPlus, IcMore, IcClock, IcCheck } from "@/components/sgi-ui";

/* ─── Types ─────────────────────────────────────────────────────────── */
type JobStatus = "open" | "in_review" | "interview" | "offered" | "closed";
type JobType   = "full_time" | "part_time" | "contract" | "internship";
type Dept      = "realestate" | "crm" | "finance" | "it" | "hr" | "legal" | "marketing";

interface JobOffer {
  id: string;
  title: string;
  title_ar: string;
  dept: Dept;
  type: JobType;
  location: string;
  salary_min: number;
  salary_max: number;
  status: JobStatus;
  applicants: number;
  posted: string;
  deadline: string;
  agent: string;
}

/* ─── Mock data ──────────────────────────────────────────────────────── */
const JOBS: JobOffer[] = [
  { id: "J-001", title: "Senior Property Consultant", title_ar: "مستشار عقاري أول", dept: "realestate", type: "full_time", location: "Dubai Marina", salary_min: 15000, salary_max: 25000, status: "open", applicants: 24, posted: "2026-05-10", deadline: "2026-06-10", agent: "Ahmed Al-Rashid" },
  { id: "J-002", title: "CRM Specialist", title_ar: "متخصص إدارة العملاء", dept: "crm", type: "full_time", location: "Downtown Dubai", salary_min: 10000, salary_max: 16000, status: "in_review", applicants: 38, posted: "2026-05-05", deadline: "2026-05-30", agent: "Sara Ben Youssef" },
  { id: "J-003", title: "Financial Analyst", title_ar: "محلل مالي", dept: "finance", type: "full_time", location: "DIFC", salary_min: 18000, salary_max: 28000, status: "interview", applicants: 12, posted: "2026-04-28", deadline: "2026-05-28", agent: "Khalid Al-Mansoori" },
  { id: "J-004", title: "IT Infrastructure Engineer", title_ar: "مهندس بنية تحتية", dept: "it", type: "contract", location: "Remote / Dubai", salary_min: 20000, salary_max: 30000, status: "open", applicants: 9, posted: "2026-05-18", deadline: "2026-06-18", agent: "Priya Nair" },
  { id: "J-005", title: "HR Generalist", title_ar: "موظف موارد بشرية", dept: "hr", type: "full_time", location: "Business Bay", salary_min: 9000, salary_max: 13000, status: "offered", applicants: 31, posted: "2026-04-15", deadline: "2026-05-15", agent: "Fatima Al-Zaabi" },
  { id: "J-006", title: "Legal Counsel", title_ar: "مستشار قانوني", dept: "legal", type: "full_time", location: "Abu Dhabi", salary_min: 22000, salary_max: 35000, status: "open", applicants: 7, posted: "2026-05-20", deadline: "2026-06-20", agent: "Ahmed Al-Rashid" },
  { id: "J-007", title: "Digital Marketing Manager", title_ar: "مدير التسويق الرقمي", dept: "marketing", type: "full_time", location: "Dubai Media City", salary_min: 14000, salary_max: 20000, status: "closed", applicants: 52, posted: "2026-04-01", deadline: "2026-05-01", agent: "Sara Ben Youssef" },
  { id: "J-008", title: "Real Estate Intern", title_ar: "متدرب عقاري", dept: "realestate", type: "internship", location: "Dubai Marina", salary_min: 3000, salary_max: 5000, status: "open", applicants: 18, posted: "2026-05-22", deadline: "2026-06-22", agent: "Khalid Al-Mansoori" },
];

/* ─── Config ─────────────────────────────────────────────────────────── */
const STATUS_CFG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  open:      { label: "Open",      color: "#059669", bg: "#D1FAE5" },
  in_review: { label: "In Review", color: "#D97706", bg: "#FEF3C7" },
  interview: { label: "Interview", color: "#2563EB", bg: "#DBEAFE" },
  offered:   { label: "Offered",   color: "#7C3AED", bg: "#EDE9FE" },
  closed:    { label: "Closed",    color: "#6B7280", bg: "#F3F4F6" },
};

const DEPT_LABELS: Record<Dept, string> = {
  realestate: "Real Estate", crm: "CRM", finance: "Finance",
  it: "IT", hr: "HR", legal: "Legal", marketing: "Marketing",
};

const TYPE_LABELS: Record<JobType, string> = {
  full_time: "Full-time", part_time: "Part-time",
  contract: "Contract", internship: "Internship",
};

const fmt = (n: number) => new Intl.NumberFormat("en-AE").format(n);

/* ─── Screen ─────────────────────────────────────────────────────────── */
export function ScreenTravail() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<JobStatus | "all">("all");
  const [deptFilter, setDeptFilter] = useState<Dept | "all">("all");

  const filtered = JOBS.filter(j => {
    const q = search.toLowerCase();
    const matchSearch = !q || j.title.toLowerCase().includes(q) || j.title_ar.includes(q) || j.location.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || j.status === statusFilter;
    const matchDept   = deptFilter === "all" || j.dept === deptFilter;
    return matchSearch && matchStatus && matchDept;
  });

  const kpis = [
    { label: "Postes ouverts",   value: JOBS.filter(j => j.status === "open").length,      color: "var(--emerald)" },
    { label: "En cours",         value: JOBS.filter(j => ["in_review","interview"].includes(j.status)).length, color: "var(--azure)" },
    { label: "Offres faites",    value: JOBS.filter(j => j.status === "offered").length,   color: "var(--gold)" },
    { label: "Total candidats",  value: JOBS.reduce((acc, j) => acc + j.applicants, 0),    color: "var(--ink-2)" },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-cream)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink-1)" }}>Travail · Recrutement</div>
            <div style={{ fontSize: 13, color: "var(--ink-4)", marginTop: 2 }}>Gestion des offres d'emploi et candidatures</div>
          </div>
          <button style={{
            display: "flex", alignItems: "center", gap: 6, padding: "9px 18px",
            background: "var(--gold)", color: "#1A1610", borderRadius: "var(--r)",
            border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            <IcPlus /> Nouvelle offre
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
              placeholder="Rechercher un poste…"
              style={{ width: "100%", paddingInlineStart: 34, paddingInlineEnd: 10, height: 36, border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--bg-base)", fontSize: 13, color: "var(--ink-1)", boxSizing: "border-box" }}
            />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as JobStatus | "all")}
            style={{ height: 36, border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--bg-base)", fontSize: 13, color: "var(--ink-2)", paddingInline: 10, cursor: "pointer" }}>
            <option value="all">Tous les statuts</option>
            {(Object.keys(STATUS_CFG) as JobStatus[]).map(s => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
          </select>
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value as Dept | "all")}
            style={{ height: 36, border: "1px solid var(--border)", borderRadius: "var(--r)", background: "var(--bg-base)", fontSize: 13, color: "var(--ink-2)", paddingInline: 10, cursor: "pointer" }}>
            <option value="all">Tous les départements</option>
            {(Object.keys(DEPT_LABELS) as Dept[]).map(d => <option key={d} value={d}>{DEPT_LABELS[d]}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 24px" }}>
        <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", borderBottom: "1px solid var(--border)" }}>
                {["Poste", "Département", "Type", "Lieu", "Salaire (AED)", "Candidats", "Statut", "Responsable", ""].map(h => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "start", fontSize: 11.5, fontWeight: 600, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} style={{ padding: 32, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>Aucun résultat</td></tr>
              ) : filtered.map((job, i) => {
                const sc = STATUS_CFG[job.status];
                return (
                  <tr key={job.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--border)" : "none", transition: "background .12s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-cream)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "")}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontWeight: 600, fontSize: 13.5, color: "var(--ink-1)" }}>{job.title}</div>
                      <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 1 }}>{job.title_ar} · {job.id}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink-2)" }}>{DEPT_LABELS[job.dept]}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink-3)" }}>{TYPE_LABELS[job.type]}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink-2)" }}>{job.location}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, color: "var(--ink-2)", whiteSpace: "nowrap" }} className="tnum">
                      {fmt(job.salary_min)} – {fmt(job.salary_max)}
                    </td>
                    <td style={{ padding: "12px 14px", textAlign: "center" }}>
                      <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--azure)" }}>{job.applicants}</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: sc.bg, color: sc.color }}>
                        {sc.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12.5, color: "var(--ink-3)" }}>{job.agent}</td>
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

        <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-4)", paddingInlineStart: 4 }}>
          {filtered.length} offre{filtered.length !== 1 ? "s" : ""} · mis à jour aujourd'hui
        </div>
      </div>
    </div>
  );
}
