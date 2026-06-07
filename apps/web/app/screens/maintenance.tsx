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

interface Quote {
  id: string;
  ticket_id: string;
  vendor_party_id: string;
  amount_aed: string;
  valid_until: string | null;
  status: string;
  notes: string | null;
}

const QUOTE_STATUS: Record<string, { color: string; bg: string }> = {
  pending:  { color: "#D97706", bg: "#FEF3C7" },
  approved: { color: "#059669", bg: "#D1FAE5" },
  rejected: { color: "#DC2626", bg: "#FEE2E2" },
};

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

  // Panneau « devis » d'un ticket (S2 wiring).
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [actBusy, setActBusy] = useState<string | null>(null);
  const [actErr, setActErr] = useState<string | null>(null);

  const loadTickets = () =>
    fetch("/api/admin/maintenance/tickets?limit=100")
      .then(r => r.json())
      .then(d => setTickets(d.data ?? []))
      .catch(() => setTickets([]))
      .finally(() => setLoading(false));

  useEffect(() => { loadTickets(); }, []);

  const loadQuotes = (ticketId: string) => {
    setQuotesLoading(true);
    setActErr(null);
    // L'endpoint renvoie un tableau brut (list[QuoteOut]), pas d'enveloppe {data}.
    fetch(`/api/admin/maintenance/tickets/${ticketId}/quotes`)
      .then(r => r.json())
      .then(d => setQuotes(Array.isArray(d) ? d : (d.data ?? [])))
      .catch(() => setQuotes([]))
      .finally(() => setQuotesLoading(false));
  };

  const openTicket = (t: Ticket) => { setSelected(t); setQuotes([]); loadQuotes(t.id); };

  const quoteAction = async (quoteId: string, action: "approve" | "reject") => {
    setActBusy(quoteId);
    setActErr(null);
    try {
      const res = await fetch(`/api/admin/maintenance/quotes/${quoteId}/${action}`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setActErr(body?.detail ?? body?.error?.code ?? `${action}_failed`);
        return;
      }
      if (selected) loadQuotes(selected.id);
      loadTickets(); // l'approbation met à jour le coût estimé du ticket
    } catch {
      setActErr(`${action}_failed`);
    } finally {
      setActBusy(null);
    }
  };

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
                  <div key={t.id} onClick={() => openTicket(t)} style={{
                    background: "var(--bg-paper)", borderRadius: 8,
                    border: `1px solid ${isSlaBreached(t) ? "#DC2626" : "var(--line-soft)"}`,
                    padding: "10px 12px", cursor: "pointer",
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

      {/* Panneau latéral : devis du ticket sélectionné */}
      {selected && (
        <div onClick={() => setSelected(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50, display: "flex", justifyContent: "flex-end" }}>
          <div onClick={e => e.stopPropagation()} style={{ width: 420, maxWidth: "92vw", height: "100%", background: "var(--bg-paper)", borderInlineStart: "1px solid var(--line-soft)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: "var(--gold, #C9A84C)" }}>{selected.reference}</span>
                <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--ink-4)" }}>×</button>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginTop: 4 }}>{selected.title}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 6 }}>{cl("Quotes", "عروض الأسعار", "Devis")}</div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
              {actErr && <div style={{ padding: "10px 12px", borderRadius: 6, background: "#FEE2E2", color: "#DC2626", fontSize: 12.5 }}>{cl("Refused", "مرفوض", "Refusé")} : {actErr}</div>}
              {quotesLoading && <div style={{ color: "var(--ink-4)", fontSize: 13 }}>{cl("Loading…", "جارٍ التحميل…", "Chargement…")}</div>}
              {!quotesLoading && quotes.length === 0 && <div style={{ color: "var(--ink-4)", fontSize: 13 }}>{cl("No quote.", "لا يوجد عرض.", "Aucun devis.")}</div>}
              {quotes.map(q => {
                const qs = QUOTE_STATUS[q.status] ?? { color: "#6B7280", bg: "#F3F4F6" };
                return (
                  <div key={q.id} style={{ border: "1px solid var(--line-soft)", borderRadius: 8, padding: "12px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="tnum" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>{fmtAed(Number(q.amount_aed))}</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999, background: qs.bg, color: qs.color }}>{q.status}</span>
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 5 }}>
                      {cl("Vendor", "المورّد", "Fournisseur")} {q.vendor_party_id.slice(0, 8)}…
                      {q.valid_until && <> · {cl("valid until", "صالح حتى", "valide jusqu'au")} {q.valid_until}</>}
                    </div>
                    {q.notes && <div style={{ fontSize: 12, color: "var(--ink-3)", marginTop: 6 }}>{q.notes}</div>}
                    {q.status === "pending" && (
                      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                        {actBusy === q.id ? <span style={{ color: "var(--ink-4)", fontSize: 12 }}>…</span> : (<>
                          <button onClick={() => quoteAction(q.id, "approve")} style={{ flex: 1, padding: "6px 10px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#D1FAE5", color: "#059669" }}>{cl("Approve", "اعتماد", "Approuver")}</button>
                          <button onClick={() => quoteAction(q.id, "reject")} style={{ flex: 1, padding: "6px 10px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, background: "#FEE2E2", color: "#DC2626" }}>{cl("Reject", "رفض", "Rejeter")}</button>
                        </>)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
