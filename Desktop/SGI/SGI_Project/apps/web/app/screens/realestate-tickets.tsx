"use client";

import React, { useCallback, useEffect, useState } from "react";

import { Topbar, IcReport, IcClock } from "@/components/sgi-ui";
import { useT, useLang } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson, extractError } from "@/lib/api-client";

// Câblé sur le module Ticketing SLA (service desk client, socle Ph0-1 + API
// REST Ph2) :
//   GET  /api/admin/tickets                 (liste paginée — filtres status/priority/agent)
//   GET  /api/admin/tickets/{id}            (détail + timeline d'événements embarquée)
//   POST /api/admin/tickets                 (création)
//   POST /api/admin/tickets/{id}/assign     (attribution agent — vide = m'assigner)
//   POST /api/admin/tickets/{id}/transition (changement de statut, machine à états)
//   POST /api/admin/tickets/{id}/comments   (commentaire timeline)
// Vue Kanban : une colonne par statut, drag&drop d'une carte → POST transition.
// CSS strictement logique (Loi 3 RTL) ; chiffres latins (toLocaleString sans
// locale arabe-indien ne s'applique pas aux références/compteurs ASCII).

type Priority = "low" | "medium" | "high" | "urgent";
type TicketStatus = "open" | "in_progress" | "pending" | "resolved" | "closed";

type Ticket = {
  id: string;
  reference: string;
  subject: string;
  description: string | null;
  category: string | null;
  priority: Priority | string;
  status: TicketStatus | string;
  requester_client_id: string | null;
  assigned_agent_id: string | null;
  sla_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  escalation_level: number;
  created_at: string;
  updated_at: string;
};

type TicketEvent = {
  id: string;
  ticket_id: string;
  event_type: string;
  actor_user_id: string | null;
  body: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

type Detail = Ticket & { events: TicketEvent[] };

const COLUMNS: TicketStatus[] = ["open", "in_progress", "pending", "resolved", "closed"];
const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const TERMINAL: ReadonlySet<TicketStatus> = new Set<TicketStatus>(["resolved", "closed"]);

// Machine à états (miroir client de ticketing.service._TRANSITIONS) pour
// n'afficher/n'autoriser que les déplacements valides — le backend reste
// l'autorité (409 sinon).
const ALLOWED: Record<TicketStatus, ReadonlySet<TicketStatus>> = {
  open: new Set<TicketStatus>(["in_progress", "pending", "resolved", "closed"]),
  in_progress: new Set<TicketStatus>(["pending", "resolved", "closed"]),
  pending: new Set<TicketStatus>(["in_progress", "resolved", "closed"]),
  resolved: new Set<TicketStatus>(["in_progress", "closed"]),
  closed: new Set<TicketStatus>(["in_progress"]),
};

function canTransition(from: string, to: string): boolean {
  if (from === to) return false;
  return ALLOWED[from as TicketStatus]?.has(to as TicketStatus) ?? false;
}

const statusLabel = (t: Translations, s: string): string =>
  (
    {
      open: t.ticket_st_open,
      in_progress: t.ticket_st_in_progress,
      pending: t.ticket_st_pending,
      resolved: t.ticket_st_resolved,
      closed: t.ticket_st_closed,
    } as Record<string, string>
  )[s] ?? s;

const priorityLabel = (t: Translations, p: string): string =>
  (
    {
      low: t.ticket_pr_low,
      medium: t.ticket_pr_medium,
      high: t.ticket_pr_high,
      urgent: t.ticket_pr_urgent,
    } as Record<string, string>
  )[p] ?? p;

const priorityColor = (p: string): string =>
  (
    {
      low: "var(--ink-4)",
      medium: "var(--azure, #2f6fed)",
      high: "var(--amber, #d99a2b)",
      urgent: "var(--rose, #d6455d)",
    } as Record<string, string>
  )[p] ?? "var(--ink-4)";

const eventLabel = (t: Translations, ev: TicketEvent): string => {
  switch (ev.event_type) {
    case "created":
      return t.ticket_ev_created;
    case "assigned":
      return t.ticket_ev_assigned;
    case "status_changed": {
      const from = ev.payload?.from as string | undefined;
      const to = ev.payload?.to as string | undefined;
      if (from && to) {
        return `${t.ticket_ev_status_changed} : ${statusLabel(t, from)} → ${statusLabel(t, to)}`;
      }
      return t.ticket_ev_status_changed;
    }
    case "commented":
      return t.ticket_ev_commented;
    default:
      return ev.event_type;
  }
};

/** SLA dépassé : échéance passée et ticket non terminé (miroir is_sla_breached). */
function slaBreached(tk: Ticket): boolean {
  if (TERMINAL.has(tk.status as TicketStatus) || !tk.sla_due_at) return false;
  return new Date(tk.sla_due_at).getTime() < Date.now();
}

export function ScreenRealEstateTickets(): React.ReactNode {
  const t = useT();
  const { lang } = useLang();

  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [agentFilter, setAgentFilter] = useState<string>("");
  const listUrl =
    `/api/admin/tickets?limit=100` +
    (priorityFilter ? `&priority=${encodeURIComponent(priorityFilter)}` : "") +
    (agentFilter ? `&assigned_agent_id=${encodeURIComponent(agentFilter)}` : "");
  const { items: tickets, loading, error, reload } = useApiList<Ticket>(listUrl);

  const [selId, setSelId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [agentDraft, setAgentDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Création
  const [showCreate, setShowCreate] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Drag&drop
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TicketStatus | null>(null);

  const loadDetail = useCallback((id: string) => {
    setDetailLoading(true);
    getJson<{ data: Detail }>(`/api/admin/tickets/${id}`)
      .then((r) => setDetail(r.data ?? null))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => {
    if (selId) loadDetail(selId);
    else setDetail(null);
  }, [selId, loadDetail]);

  const transition = useCallback(
    async (id: string, next: TicketStatus): Promise<void> => {
      setBusy(true);
      setActionError(null);
      try {
        const res = await postJson(`/api/admin/tickets/${id}/transition`, { status: next });
        if (!res.ok) {
          setActionError(await extractError(res, "transition_failed"));
          return;
        }
        reload();
        if (selId === id) loadDetail(id);
      } catch {
        setActionError("transition_failed");
      } finally {
        setBusy(false);
      }
    },
    [reload, loadDetail, selId],
  );

  async function assign(): Promise<void> {
    if (!selId) return;
    setBusy(true);
    setActionError(null);
    try {
      const body = agentDraft.trim() ? { agent_user_id: agentDraft.trim() } : {};
      const res = await postJson(`/api/admin/tickets/${selId}/assign`, body);
      if (!res.ok) {
        setActionError(await extractError(res, "assign_failed"));
        return;
      }
      setAgentDraft("");
      reload();
      loadDetail(selId);
    } catch {
      setActionError("assign_failed");
    } finally {
      setBusy(false);
    }
  }

  async function addComment(): Promise<void> {
    if (!selId || !commentDraft.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const res = await postJson(`/api/admin/tickets/${selId}/comments`, {
        body: commentDraft.trim(),
      });
      if (!res.ok) {
        setActionError(await extractError(res, "comment_failed"));
        return;
      }
      setCommentDraft("");
      loadDetail(selId);
    } catch {
      setActionError("comment_failed");
    } finally {
      setBusy(false);
    }
  }

  async function create(): Promise<void> {
    if (!newSubject.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await postJson(`/api/admin/tickets`, {
        subject: newSubject.trim(),
        priority: newPriority,
        description: newDescription.trim() || null,
      });
      if (!res.ok) {
        setCreateError(await extractError(res, "create_failed"));
        return;
      }
      setNewSubject("");
      setNewDescription("");
      setNewPriority("medium");
      setShowCreate(false);
      reload();
    } catch {
      setCreateError("create_failed");
    } finally {
      setCreating(false);
    }
  }

  function onDrop(col: TicketStatus): void {
    setDragOverCol(null);
    const id = dragId;
    setDragId(null);
    if (!id) return;
    const tk = tickets.find((x) => x.id === id);
    if (!tk || tk.status === col || !canTransition(tk.status, col)) return;
    void transition(id, col);
  }

  const byStatus = (s: TicketStatus): Ticket[] => tickets.filter((tk) => tk.status === s);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.ticket_title} />

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-cream)" }}>
        {/* ── Tableau Kanban ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {/* Barre de filtres */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 22px",
              borderBottom: "1px solid var(--line-soft)",
              background: "var(--bg-paper)",
              flexWrap: "wrap",
            }}
          >
            <span style={{ color: "var(--gold)", display: "inline-flex" }}>
              <IcReport />
            </span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
              {t.ticket_title}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
              {loading ? "…" : tickets.length}
            </span>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              style={{
                marginInlineStart: "auto",
                padding: "6px 8px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--bg-cream)",
                fontSize: 12,
                color: "var(--ink)",
              }}
            >
              <option value="">{t.ticket_all_priorities}</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabel(t, p)}
                </option>
              ))}
            </select>
            <input
              value={agentFilter}
              onChange={(e) => setAgentFilter(e.target.value)}
              placeholder={t.ticket_filter_agent}
              style={{
                width: 180,
                padding: "6px 10px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--bg-cream)",
                fontSize: 12,
                color: "var(--ink)",
              }}
            />
            <button
              onClick={() => setShowCreate((v) => !v)}
              style={{
                padding: "7px 14px",
                background: "var(--gold)",
                color: "#1A1610",
                border: "none",
                borderRadius: 999,
                fontWeight: 600,
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {t.ticket_new}
            </button>
          </div>

          {/* Formulaire de création */}
          {showCreate && (
            <div
              style={{
                display: "flex",
                gap: 10,
                padding: "12px 22px",
                borderBottom: "1px solid var(--line-soft)",
                background: "var(--bg-paper)",
                flexWrap: "wrap",
                alignItems: "flex-start",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 220 }}>
                <input
                  value={newSubject}
                  onChange={(e) => setNewSubject(e.target.value)}
                  placeholder={t.ticket_subject}
                  style={{
                    padding: "8px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--bg-cream)",
                    fontSize: 13,
                    color: "var(--ink)",
                  }}
                />
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={t.ticket_description}
                  rows={2}
                  style={{
                    resize: "vertical",
                    padding: "8px 12px",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    background: "var(--bg-cream)",
                    fontSize: 12.5,
                    color: "var(--ink)",
                  }}
                />
              </div>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as Priority)}
                style={{
                  padding: "8px 10px",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  background: "var(--bg-cream)",
                  fontSize: 12.5,
                  color: "var(--ink)",
                }}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {priorityLabel(t, p)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void create()}
                disabled={creating || !newSubject.trim()}
                style={{
                  padding: "8px 16px",
                  background: "var(--gold)",
                  color: "#1A1610",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 12.5,
                  cursor: creating || !newSubject.trim() ? "default" : "pointer",
                  opacity: creating || !newSubject.trim() ? 0.6 : 1,
                }}
              >
                {creating ? "…" : t.ticket_create}
              </button>
              {createError && (
                <span style={{ color: "var(--rose)", fontSize: 12, width: "100%" }}>
                  {t.error_label} : {createError}
                </span>
              )}
            </div>
          )}

          {error && (
            <div style={{ padding: "10px 22px", color: "var(--rose)", fontSize: 12 }}>
              {t.error_label} : {error}
            </div>
          )}

          {/* Colonnes */}
          <div style={{ flex: 1, display: "flex", gap: 12, padding: "16px 22px", overflowX: "auto", minHeight: 0 }}>
            {COLUMNS.map((col) => {
              const items = byStatus(col);
              const over = dragOverCol === col;
              return (
                <div
                  key={col}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverCol(col);
                  }}
                  onDragLeave={() => setDragOverCol((c) => (c === col ? null : c))}
                  onDrop={() => onDrop(col)}
                  style={{
                    width: 264,
                    minWidth: 264,
                    display: "flex",
                    flexDirection: "column",
                    background: over ? "var(--gold-ghost)" : "var(--bg-paper)",
                    border: over ? "1px dashed var(--gold)" : "1px solid var(--line-soft)",
                    borderRadius: 12,
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--line-soft)",
                    }}
                  >
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>
                      {statusLabel(t, col)}
                    </span>
                    <span
                      style={{
                        marginInlineStart: "auto",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "var(--ink-4)",
                        background: "var(--bg-cream)",
                        borderRadius: 999,
                        padding: "1px 8px",
                      }}
                    >
                      {items.length}
                    </span>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 10, minHeight: 0 }}>
                    {items.length === 0 && (
                      <div style={{ color: "var(--ink-4)", fontSize: 12, padding: "8px 4px" }}>
                        {t.ticket_empty_column}
                      </div>
                    )}
                    {items.map((tk) => {
                      const breached = slaBreached(tk);
                      return (
                        <div
                          key={tk.id}
                          draggable
                          onDragStart={() => setDragId(tk.id)}
                          onDragEnd={() => {
                            setDragId(null);
                            setDragOverCol(null);
                          }}
                          onClick={() => setSelId(tk.id)}
                          style={{
                            padding: "11px 13px",
                            borderRadius: 10,
                            background: "var(--bg-cream)",
                            border:
                              selId === tk.id
                                ? "1px solid var(--gold)"
                                : "1px solid var(--line-soft)",
                            cursor: "pointer",
                            opacity: dragId === tk.id ? 0.5 : 1,
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)" }}>
                              {tk.reference}
                            </span>
                            <span
                              style={{
                                marginInlineStart: "auto",
                                fontSize: 10,
                                fontWeight: 700,
                                color: "#1A1610",
                                background: priorityColor(tk.priority),
                                borderRadius: 999,
                                padding: "1px 7px",
                              }}
                            >
                              {priorityLabel(t, tk.priority)}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: "var(--ink)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                            }}
                          >
                            {tk.subject}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                            {breached && (
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                  fontSize: 10.5,
                                  fontWeight: 700,
                                  color: "var(--rose, #d6455d)",
                                }}
                              >
                                <IcClock />
                                {t.ticket_sla_breached}
                              </span>
                            )}
                            {tk.assigned_agent_id && (
                              <span style={{ marginInlineStart: "auto", fontSize: 10.5, color: "var(--ink-4)" }}>
                                {tk.assigned_agent_id.slice(0, 8)}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Panneau détail + timeline ── */}
        {selId && (
          <div
            style={{
              width: 340,
              borderInlineStart: "1px solid var(--line-soft)",
              background: "var(--bg-paper)",
              overflowY: "auto",
              minHeight: 0,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                {t.ticket_detail}
              </span>
              <button
                onClick={() => setSelId(null)}
                style={{
                  marginInlineStart: "auto",
                  border: "none",
                  background: "transparent",
                  color: "var(--ink-4)",
                  fontSize: 16,
                  cursor: "pointer",
                  lineHeight: 1,
                }}
                aria-label={t.cancel}
              >
                ×
              </button>
            </div>

            {actionError && (
              <div style={{ color: "var(--rose)", fontSize: 12 }}>
                {t.error_label} : {actionError}
              </div>
            )}

            {detailLoading && <div style={{ color: "var(--ink-4)", fontSize: 12 }}>{t.loading}</div>}

            {detail && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)" }}>{detail.reference}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "#1A1610",
                        background: priorityColor(detail.priority),
                        borderRadius: 999,
                        padding: "1px 7px",
                      }}
                    >
                      {priorityLabel(t, detail.priority)}
                    </span>
                    {slaBreached(detail) && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                          fontSize: 10.5,
                          fontWeight: 700,
                          color: "var(--rose, #d6455d)",
                        }}
                      >
                        <IcClock />
                        {t.ticket_sla_breached}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{detail.subject}</div>
                  {detail.description && (
                    <div style={{ fontSize: 12.5, color: "var(--ink-3, var(--ink-4))", whiteSpace: "pre-wrap" }}>
                      {detail.description}
                    </div>
                  )}
                  {detail.sla_due_at && (
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>
                      {t.ticket_sla_due} : {new Date(detail.sla_due_at).toLocaleString(lang)}
                    </div>
                  )}
                </div>

                {/* Statut */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.ticket_status_label}</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {COLUMNS.map((s) => {
                      const active = detail.status === s;
                      const allowed = active || canTransition(detail.status, s);
                      return (
                        <button
                          key={s}
                          onClick={() => void transition(detail.id, s)}
                          disabled={busy || !allowed || active}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 999,
                            border: active ? "1px solid var(--gold)" : "1px solid var(--line)",
                            background: active ? "var(--gold-ghost)" : "var(--bg-cream)",
                            fontSize: 11.5,
                            fontWeight: 600,
                            color: "var(--ink)",
                            cursor: busy || !allowed || active ? "default" : "pointer",
                            opacity: !allowed && !active ? 0.4 : 1,
                          }}
                        >
                          {statusLabel(t, s)}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Attribution */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.ticket_assign}</span>
                  {detail.assigned_agent_id && (
                    <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
                      {t.ticket_assigned_to} : {detail.assigned_agent_id.slice(0, 8)}
                    </span>
                  )}
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      value={agentDraft}
                      onChange={(e) => setAgentDraft(e.target.value)}
                      placeholder={t.ticket_agent_id_ph}
                      style={{
                        flex: 1,
                        padding: "6px 10px",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        background: "var(--bg-cream)",
                        fontSize: 12,
                        color: "var(--ink)",
                      }}
                    />
                    <button
                      onClick={() => void assign()}
                      disabled={busy}
                      style={{
                        padding: "6px 12px",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        background: "var(--bg-cream)",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--ink)",
                        cursor: busy ? "default" : "pointer",
                        opacity: busy ? 0.6 : 1,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {agentDraft.trim() ? t.ticket_assign : t.ticket_assign_me}
                    </button>
                  </div>
                </div>

                {/* Timeline */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.ticket_timeline}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {detail.events.length === 0 && (
                      <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{t.ticket_empty_timeline}</span>
                    )}
                    {detail.events.map((ev) => (
                      <div
                        key={ev.id}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "var(--bg-cream)",
                          border: "1px solid var(--line-soft)",
                          borderInlineStart: "3px solid var(--gold)",
                        }}
                      >
                        <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginBottom: 3 }}>
                          {(ev.actor_user_id ?? "—").slice(0, 8)} · {new Date(ev.created_at).toLocaleString(lang)}
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--ink)" }}>{eventLabel(t, ev)}</div>
                        {ev.body && (
                          <div style={{ fontSize: 12.5, color: "var(--ink)", marginTop: 3, whiteSpace: "pre-wrap" }}>
                            {ev.body}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Commentaire */}
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.ticket_comment_label}</span>
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder={t.ticket_write_comment}
                    rows={2}
                    style={{
                      resize: "vertical",
                      padding: "8px 10px",
                      border: "1px solid var(--line)",
                      borderRadius: 8,
                      background: "var(--bg-cream)",
                      fontSize: 12.5,
                      color: "var(--ink)",
                    }}
                  />
                  <button
                    onClick={() => void addComment()}
                    disabled={busy || !commentDraft.trim()}
                    style={{
                      padding: "7px 12px",
                      border: "none",
                      borderRadius: 8,
                      background: "var(--gold)",
                      color: "#1A1610",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: busy || !commentDraft.trim() ? "default" : "pointer",
                      opacity: busy || !commentDraft.trim() ? 0.6 : 1,
                    }}
                  >
                    {t.ticket_add_comment}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
