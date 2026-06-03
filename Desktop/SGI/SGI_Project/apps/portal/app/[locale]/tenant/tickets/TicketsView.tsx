"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";

export interface TenantTicket {
  id: string;
  reference: string;
  subject: string;
  description: string | null;
  category: string | null;
  priority: string;
  status: string;
  sla_due_at: string | null;
  resolved_at: string | null;
  created_at: string | null;
}

interface TicketEvent {
  id: string;
  event_type: string;
  body: string | null;
  created_at: string | null;
}

interface TicketDetail extends TenantTicket {
  events: TicketEvent[];
}

const STATUS_BADGE: Record<string, string> = {
  open: "sgi-badge-info",
  in_progress: "sgi-badge-pending",
  pending: "sgi-badge-pending",
  resolved: "sgi-badge-active",
  closed: "sgi-badge-active",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#DC2626",
  high: "#F59E0B",
  medium: "#3B82F6",
  low: "#6B7280",
};

const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export function TicketsView({
  tickets,
  dateLocale,
  statusLabels,
  priorityLabels,
  labels,
}: {
  tickets: TenantTicket[];
  dateLocale: string;
  statusLabels: Record<string, string>;
  priorityLabels: Record<string, string>;
  labels: {
    empty: string;
    newTicket: string;
    subject: string;
    description: string;
    priority: string;
    submit: string;
    submitting: string;
    createError: string;
    createdOn: string;
    comment: string;
    commentPlaceholder: string;
    send: string;
    timeline: string;
  };
}) {
  const [rows, setRows] = useState<TenantTicket[]>(tickets);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("medium");

  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [commentBody, setCommentBody] = useState("");
  const [commenting, setCommenting] = useState(false);

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(dateLocale) : "—";

  const submit = async () => {
    if (!subject.trim()) return;
    setError(null);
    setBusy(true);
    try {
      const created = await apiClient<TenantTicket>(`/api/proxy/tenant/tickets`, {
        method: "POST",
        json: { subject: subject.trim(), description: description.trim() || null, priority },
      });
      setRows((prev) => [created, ...prev]);
      setSubject("");
      setDescription("");
      setPriority("medium");
      setCreating(false);
    } catch {
      setError(labels.createError);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id: string) => {
    if (openId === id) {
      setOpenId(null);
      setDetail(null);
      return;
    }
    setOpenId(id);
    setDetail(null);
    try {
      const d = await apiClient<TicketDetail>(`/api/proxy/tenant/tickets/${id}`);
      setDetail(d);
    } catch {
      setDetail(null);
    }
  };

  const addComment = async (id: string) => {
    if (!commentBody.trim()) return;
    setCommenting(true);
    try {
      const ev = await apiClient<TicketEvent>(`/api/proxy/tenant/tickets/${id}/comments`, {
        method: "POST",
        json: { body: commentBody.trim() },
      });
      setDetail((prev) => (prev ? { ...prev, events: [...prev.events, ev] } : prev));
      setCommentBody("");
    } catch {
      /* silencieux : l'agent réessaiera */
    } finally {
      setCommenting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <div>
        <button
          type="button"
          className="sgi-button sgi-button-primary"
          onClick={() => setCreating((v) => !v)}
        >
          {labels.newTicket}
        </button>
      </div>

      {error ? (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      ) : null}

      {creating ? (
        <div className="sgi-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>{labels.subject}</span>
            <input
              className="sgi-input"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={255}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>{labels.description}</span>
            <textarea
              className="sgi-input"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            <span style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>{labels.priority}</span>
            <select
              className="sgi-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {priorityLabels[p]}
                </option>
              ))}
            </select>
          </label>
          <div>
            <button
              type="button"
              className="sgi-button sgi-button-primary"
              disabled={busy || !subject.trim()}
              onClick={submit}
            >
              {busy ? labels.submitting : labels.submit}
            </button>
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
          {labels.empty}
        </div>
      ) : (
        rows.map((tk) => {
          const open = openId === tk.id;
          return (
            <div key={tk.id} className="sgi-card">
              <button
                type="button"
                onClick={() => toggle(tk.id)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "1rem",
                  width: "100%",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <strong style={{ color: "var(--ink)" }}>{tk.subject}</strong>
                  <span style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
                    {tk.reference} · {labels.createdOn} {fmtDate(tk.created_at)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      color: PRIORITY_COLOR[tk.priority] ?? "#6B7280",
                    }}
                  >
                    {priorityLabels[tk.priority] ?? tk.priority}
                  </span>
                  <span className={`sgi-badge ${STATUS_BADGE[tk.status] ?? "sgi-badge-info"}`}>
                    {statusLabels[tk.status] ?? tk.status}
                  </span>
                </div>
              </button>

              {open ? (
                <div
                  style={{
                    marginBlockStart: "0.75rem",
                    paddingBlockStart: "0.75rem",
                    borderBlockStart: "1px solid var(--line, #e5e7eb)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  {tk.description ? (
                    <p style={{ margin: 0, color: "var(--ink-2, var(--ink))", fontSize: "0.9rem" }}>
                      {tk.description}
                    </p>
                  ) : null}

                  <div style={{ fontSize: "0.8rem", color: "var(--ink-3)", fontWeight: 600 }}>
                    {labels.timeline}
                  </div>
                  {detail?.events?.length ? (
                    <ul style={{ margin: 0, paddingInlineStart: "1rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      {detail.events.map((ev) => (
                        <li key={ev.id} style={{ fontSize: "0.85rem", color: "var(--ink-2, var(--ink))" }}>
                          <span style={{ color: "var(--ink-3)" }}>{fmtDate(ev.created_at)} · </span>
                          {ev.body ?? ev.event_type}
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  <div style={{ display: "flex", gap: "0.5rem", marginBlockStart: "0.5rem" }}>
                    <input
                      className="sgi-input"
                      style={{ flex: 1 }}
                      placeholder={labels.commentPlaceholder}
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                    />
                    <button
                      type="button"
                      className="sgi-button sgi-button-primary"
                      disabled={commenting || !commentBody.trim()}
                      onClick={() => addComment(tk.id)}
                    >
                      {labels.send}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
