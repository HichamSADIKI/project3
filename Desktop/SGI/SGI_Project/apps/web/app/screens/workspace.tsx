"use client";
import React, { useState } from "react";
import { Topbar, IcArrowUp } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const KPIS = [
  { key: "docs",    color: "var(--azure)",   value: "1 847", delta: "+43 today",      up: true, label_en: "Documents",       label_ar: "الوثائق",        label_fr: "Documents" },
  { key: "tasks",   color: "var(--emerald)", value: "284",   delta: "68 due today",   up: null, label_en: "Open tasks",      label_ar: "المهام المفتوحة", label_fr: "Tâches en cours" },
  { key: "meet",    color: "var(--gold)",    value: "12",    delta: "this week",      up: null, label_en: "Meetings",        label_ar: "الاجتماعات",      label_fr: "Réunions" },
  { key: "members", color: "var(--azure)",   value: "52",    delta: "+3 this month",  up: true, label_en: "Team members",    label_ar: "أعضاء الفريق",   label_fr: "Membres" },
];

const RECENT_DOCS = [
  { name: "Contrat Vente Al Maktoum Q2 2026",       type: "contract", modified: "2h ago",    author: "S. Hicham",  shared: 4 },
  { name: "Rapport financier Mai 2026",              type: "report",   modified: "5h ago",    author: "L. Karim",   shared: 8 },
  { name: "Procédure onboarding clients VIP",       type: "guide",    modified: "Yesterday", author: "N. Amira",   shared: 12 },
  { name: "Plan marketing Q3 2026",                 type: "plan",     modified: "2d ago",    author: "R. Fatiha",  shared: 6 },
  { name: "Grille tarifaire propriétés Dubai 2026", type: "sheet",    modified: "3d ago",    author: "S. Hicham",  shared: 3 },
  { name: "Checklist Golden Visa Documents",        type: "checklist",modified: "1w ago",    author: "M. Youssef", shared: 22 },
];

const TASKS = [
  { title: "Réviser contrat Al Rashid",       assignee: "S. Hicham",  due: "Today",    priority: "high",   done: false },
  { title: "Envoyer devis propriété Reem",    assignee: "L. Karim",   due: "Today",    priority: "high",   done: false },
  { title: "Mise à jour fiche client VIP",    assignee: "N. Amira",   due: "Tomorrow", priority: "medium", done: false },
  { title: "Préparer présentation Q3",        assignee: "R. Fatiha",  due: "May 28",   priority: "medium", done: true  },
  { title: "Formation nouveaux agents",       assignee: "M. Youssef", due: "Jun 1",    priority: "low",    done: false },
];

const PRIORITY_STYLE: Record<string, { bg: string; color: string }> = {
  high:   { bg: "rgba(239,68,68,0.1)",    color: "var(--rose)" },
  medium: { bg: "rgba(200,160,60,0.15)",  color: "var(--gold)" },
  low:    { bg: "rgba(120,120,120,0.1)",  color: "var(--ink-4)" },
};

const TYPE_COLOR: Record<string, string> = {
  contract: "var(--azure)", report: "var(--emerald)", guide: "var(--gold)",
  plan: "var(--rose)", sheet: "var(--azure)", checklist: "var(--emerald)",
};

export function ScreenWorkspace() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const [tab, setTab] = useState<"docs" | "tasks">("docs");

  const title = lang === "ar" ? "بيئة العمل" : lang === "fr" ? "Espace de travail" : "Workspace";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title} />
      <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "16px 12px" : "28px 32px", background: "var(--bg-cream)" }}>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
          {KPIS.map(k => (
            <div key={k.key} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
              <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginBottom: 6 }}>
                {lang === "ar" ? k.label_ar : lang === "fr" ? k.label_fr : k.label_en}
              </div>
              <div className="tnum font-display" style={{ fontSize: 26, color: k.color, lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
              <div style={{ fontSize: 10.5, display: "flex", alignItems: "center", gap: 4, color: k.up === null ? "var(--ink-4)" : "var(--emerald)" }}>
                {k.up === true && <IcArrowUp />}{k.delta}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid var(--line-soft)", paddingBottom: 0 }}>
          {(["docs","tasks"] as const).map(t => {
            const labels = { docs: { en: "Documents", ar: "الوثائق", fr: "Documents" }, tasks: { en: "Tasks", ar: "المهام", fr: "Tâches" } };
            return (
              <button key={t} onClick={() => setTab(t)} style={{
                padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                border: "none", background: "none",
                color: tab === t ? "var(--gold)" : "var(--ink-4)",
                borderBottom: `2px solid ${tab === t ? "var(--gold)" : "transparent"}`,
                marginBottom: -1,
              }}>
                {labels[t][lang as "en" | "ar" | "fr"]}
              </button>
            );
          })}
        </div>

        {/* Documents */}
        {tab === "docs" && (
          <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-cream)" }}>
                  {[
                    lang === "ar" ? "الوثيقة" : lang === "fr" ? "Document" : "Document",
                    lang === "ar" ? "النوع" : lang === "fr" ? "Type" : "Type",
                    lang === "ar" ? "المؤلف" : lang === "fr" ? "Auteur" : "Author",
                    lang === "ar" ? "مشترك مع" : lang === "fr" ? "Partagé" : "Shared",
                    lang === "ar" ? "تعديل" : lang === "fr" ? "Modifié" : "Modified",
                  ].map(h => (
                    <th key={h} style={{ padding: "9px 18px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT_DOCS.map((d, i) => (
                  <tr key={d.name} style={{ borderBottom: i < RECENT_DOCS.length - 1 ? "1px solid var(--line-soft)" : "none", cursor: "pointer" }}
                    onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-cream)"}
                    onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ""}
                  >
                    <td style={{ padding: "12px 18px", fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{d.name}</td>
                    <td style={{ padding: "12px 18px" }}>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${TYPE_COLOR[d.type]}18`, color: TYPE_COLOR[d.type] }}>
                        {d.type}
                      </span>
                    </td>
                    <td style={{ padding: "12px 18px", fontSize: 12, color: "var(--ink-4)" }}>{d.author}</td>
                    <td style={{ padding: "12px 18px", fontSize: 12, color: "var(--ink-4)" }} className="tnum">{d.shared} {lang === "fr" ? "pers." : lang === "ar" ? "أشخاص" : "people"}</td>
                    <td style={{ padding: "12px 18px", fontSize: 12, color: "var(--ink-4)" }}>{d.modified}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Tasks */}
        {tab === "tasks" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TASKS.map(task => (
              <div key={task.title} style={{
                background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)",
                padding: "14px 20px", display: "flex", alignItems: "center", gap: 14,
                opacity: task.done ? 0.55 : 1,
              }}>
                <div style={{ width: 20, height: 20, borderRadius: 6, border: `2px solid ${task.done ? "var(--emerald)" : "var(--line-soft)"}`, background: task.done ? "var(--emerald)" : "transparent", flexShrink: 0, display: "grid", placeItems: "center" }}>
                  {task.done && <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="m5 12 5 5L20 7"/></svg>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", textDecoration: task.done ? "line-through" : "none" }}>{task.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{task.assignee} · {task.due}</div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: PRIORITY_STYLE[task.priority].bg, color: PRIORITY_STYLE[task.priority].color }}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
