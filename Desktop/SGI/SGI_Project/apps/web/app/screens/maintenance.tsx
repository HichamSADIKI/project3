"use client";
import React, { useEffect, useState } from "react";
import { useLang } from "@/components/language-provider";

/* ─── Types ─────────────────────────────────────────────────────────── */
interface Ticket {
  id: string;
  reference: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  unit_id: string | null;
  building_id: string | null;
  sla_due_at: string | null;
  cost_estimate_aed: number | null;
  created_at: string;
}

/* ─── Config ─────────────────────────────────────────────────────────── */
type KanbanStatus = "new" | "assigned" | "in_progress" | "on_hold" | "resolved";
const COLUMNS: KanbanStatus[] = ["new", "assigned", "in_progress", "on_hold", "resolved"];

const STATUS_CFG: Record<KanbanStatus, { fr: string; en: string; ar: string; color: string; bg: string }> = {
  new:         { fr: "Nouveau",        en: "New",          ar: "جديد",       color: "#6B7280", bg: "#F3F4F6" },
  assigned:    { fr: "Assigné",        en: "Assigned",     ar: "مُعيَّن",     color: "#2563EB", bg: "#DBEAFE" },
  in_progress: { fr: "En cours",       en: "In progress",  ar: "قيد التنفيذ", color: "#D97706", bg: "#FEF3C7" },
  on_hold:     { fr: "En attente",     en: "On hold",      ar: "معلَّق",      color: "#7C3AED", bg: "#EDE9FE" },
  resolved:    { fr: "Résolu",         en: "Resolved",     ar: "محلول",      color: "#059669", bg: "#D1FAE5" },
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#DC2626", high: "#F59E0B", medium: "#3B82F6", low: "#6B7280",
};

const CATEGORY_ICON: Record<string, string> = {
  plumbing: "🔧", electrical: "⚡", hvac: "❄️",
  appliance: "🏠", structural: "🏗️", cleaning: "🧹", other: "📋",
};

const fmtAed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

/* ─── Composant ─────────────────────────────────────────────────────── */
export function MaintenanceScreen() {
  const { lang } = useLang();
  const isAr = lang === "ar"; const isFr = lang === "fr";
  const cl = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<string>("all");

  useEffect(() => {
    fetch("/api/admin/maintenance/tickets?limit=100")
      .then(r => r.json())
      .then(d => setTickets(d.data ?? []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = tickets.filter(t => {
    const q = search.toLowerCase();
    const matchQ = !q || t.title.toLowerCase().includes(q) || t.reference.toLowerCase().includes(q);
    const matchP = priority === "all" || t.priority === priority;
    return matchQ && matchP;
  });

  const byStatus = (s: KanbanStatus) =>
    filtered.filter(t => t.status === s || (s === "resolved" && ["resolved", "closed"].includes(t.status)));

  const isSlaBreached = (t: Ticket) => {
    if (!t.sla_due_at || ["closed", "cancelled", "resolved"].includes(t.status)) return false;
    return new Date(t.sla_due_at) < new Date();
  };

  if (loading) return (
    <div style={{ padding: 32, color: "var(--ink-4)", textAlign: "center" }}>
      {cl("Loading…", "جارٍ التحميل…", "Chargement…")}
    </div>
  );

  return (
    <div style={{ padding: "1.5rem", minHeight: "100vh", background: "var(--bg-base)" }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
            🔧 {cl("Maintenance", "الصيانة", "Maintenance")}
          </h1>
          <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>
            {filtered.length} {cl("tickets", "تذكرة", "tickets")}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={cl("Search…", "بحث…", "Rechercher…")}
            style={{ height: 34, padding: "0 12px", borderRadius: 6, border: "1px solid var(--line-soft)", background: "var(--bg-ivory)", fontSize: 13, color: "var(--ink)", outline: "none" }}
          />
          <select
            value={priority}
            onChange={e => setPriority(e.target.value)}
            style={{ height: 34, padding: "0 10px", borderRadius: 6, border: "1px solid var(--line-soft)", background: "var(--bg-ivory)", fontSize: 13, color: "var(--ink)" }}
          >
            <option value="all">{cl("All priorities", "كل الأولويات", "Toutes priorités")}</option>
            <option value="urgent">{cl("Urgent", "عاجل", "Urgent")}</option>
            <option value="high">{cl("High", "عالٍ", "Élevée")}</option>
            <option value="medium">{cl("Medium", "متوسط", "Moyenne")}</option>
            <option value="low">{cl("Low", "منخفض", "Basse")}</option>
          </select>
        </div>
      </div>

      {/* Kanban */}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, alignItems: "flex-start" }}>
        {COLUMNS.map(col => {
          const cfg = STATUS_CFG[col];
          const label = isAr ? cfg.ar : isFr ? cfg.fr : cfg.en;
          const items = byStatus(col);
          return (
            <div key={col} style={{ flex: "0 0 240px", minWidth: 220 }}>
              {/* En-tête colonne */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: cfg.bg }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: cfg.color, color: "#fff" }}>{items.length}</span>
              </div>
              {/* Cartes */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map(t => (
                  <div key={t.id} style={{
                    background: "var(--bg-paper)", borderRadius: 8,
                    border: `1px solid ${isSlaBreached(t) ? "#DC2626" : "var(--line-soft)"}`,
                    padding: "10px 12px",
                    boxShadow: isSlaBreached(t) ? "0 0 0 2px #FEE2E2" : "none",
                  }}>
                    {/* Référence + icône */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, color: "var(--gold, #C9A84C)" }}>
                        {t.reference}
                      </span>
                      <span title={t.category}>{CATEGORY_ICON[t.category] ?? "📋"}</span>
                    </div>
                    {/* Titre */}
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6, lineHeight: 1.35 }}>
                      {t.title}
                    </div>
                    {/* Priorité + SLA */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 10 }}>
                      <span style={{ padding: "1px 6px", borderRadius: 999, background: PRIORITY_COLOR[t.priority] + "22", color: PRIORITY_COLOR[t.priority], fontWeight: 700 }}>
                        {t.priority.toUpperCase()}
                      </span>
                      {isSlaBreached(t) && (
                        <span style={{ color: "#DC2626", fontWeight: 700 }}>⚠ SLA</span>
                      )}
                    </div>
                    {/* Coût estimé */}
                    {t.cost_estimate_aed != null && (
                      <div style={{ marginTop: 4, fontSize: 10, color: "var(--ink-4)" }}>
                        {cl("Est.", "تقدير", "Est.")} {fmtAed(t.cost_estimate_aed)}
                      </div>
                    )}
                  </div>
                ))}
                {items.length === 0 && (
                  <div style={{ textAlign: "center", color: "var(--ink-4)", fontSize: 11.5, padding: "16px 0" }}>
                    {cl("Empty", "لا يوجد", "Vide")}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
