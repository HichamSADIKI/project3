"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Topbar, IcReport, IcPlus } from "@/components/sgi-ui";
import { useT, useLang } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

// Câblé sur /api/admin/tickets → /api/v1/tickets (Ticketing SLA / service desk).

const STATUSES = ["open", "in_progress", "pending", "resolved", "closed"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;
const TERMINAL = new Set(["resolved", "closed"]);

// Couleurs/fonds des badges (labels via t.*).
const STATUS_STYLE: Record<string, { color: string; bg: string }> = {
  open: { color: "var(--azure)", bg: "rgba(56,132,255,0.12)" },
  in_progress: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  pending: { color: "#a259ff", bg: "rgba(162,89,255,0.10)" },
  resolved: { color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  closed: { color: "var(--ink-4)", bg: "var(--line-soft)" },
};
const statusLabel = (t: Translations, k: string): string =>
  ({
    open: t.tks_open, in_progress: t.tks_in_progress, pending: t.tks_pending,
    resolved: t.tks_resolved, closed: t.tks_closed,
  })[k] ?? k;

const PRIORITY_STYLE: Record<string, { color: string; bg: string }> = {
  low: { color: "var(--ink-3)", bg: "var(--line-soft)" },
  medium: { color: "var(--azure)", bg: "rgba(56,132,255,0.12)" },
  high: { color: "var(--gold-deep)", bg: "rgba(212,160,55,0.14)" },
  urgent: { color: "var(--rose)", bg: "var(--rose-soft)" },
};
const priorityLabel = (t: Translations, k: string): string =>
  ({ low: t.tkp_low, medium: t.tkp_medium, high: t.tkp_high, urgent: t.tkp_urgent })[k] ?? k;

type Ticket = {
  id: string; reference: string; subject: string; description: string | null;
  category: string | null; priority: string; status: string;
  assigned_agent_id: string | null; sla_due_at: string | null;
  escalation_level: number;
};
type TicketEvent = {
  id: string; event_type: string; actor_user_id: string | null;
  body: string | null; created_at: string;
};
type Detail = Ticket & { events: TicketEvent[] };

// SLA dépassé côté client (miroir de service.is_sla_breached) : non terminé + échéance passée.
function slaBreached(status: string, slaDueAt: string | null): boolean {
  if (TERMINAL.has(status) || !slaDueAt) return false;
  return new Date(slaDueAt).getTime() < Date.now();
}

export function ScreenTicketing() {
  const t = useT();
  const { lang } = useLang();
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const url =
    "/api/admin/tickets?limit=100" +
    (statusFilter ? `&status=${statusFilter}` : "") +
    (priorityFilter ? `&priority=${priorityFilter}` : "");
  const { items, loading, error, reload } = useApiList<Ticket>(url);

  const [selId, setSelId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actErr, setActErr] = useState<string | null>(null);

  const loadDetail = useCallback((id: string) => {
    setDetailLoading(true);
    getJson<{ data: Detail }>(`/api/admin/tickets/${id}`)
      .then(r => setDetail(r.data ?? null))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, []);

  useEffect(() => { if (selId) loadDetail(selId); else setDetail(null); }, [selId, loadDetail]);

  async function act(path: string, body: Record<string, unknown>, fallback: string) {
    if (!selId) return;
    setActErr(null);
    try {
      const res = await postJson(`/api/admin/tickets/${selId}/${path}`, body);
      if (!res.ok) { setActErr(await extractError(res, fallback)); return; }
      loadDetail(selId); reload();
    } catch { setActErr(fallback); }
  }

  // Commentaire (→ event de timeline)
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  async function addComment() {
    if (!selId || !comment.trim()) return;
    setSending(true); setActErr(null);
    try {
      const res = await postJson(`/api/admin/tickets/${selId}/comments`, { body: comment.trim() });
      if (!res.ok) { setActErr(await extractError(res, "comment_failed")); return; }
      setComment(""); loadDetail(selId);
    } catch { setActErr("comment_failed"); } finally { setSending(false); }
  }

  // Nouveau ticket
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: "", description: "", category: "", priority: "medium" });
  async function create() {
    if (!form.subject.trim()) { setFormError(t.tk_subject_required); return; }
    setSaving(true); setFormError(null);
    try {
      const res = await postJson("/api/admin/tickets", {
        subject: form.subject.trim(),
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        priority: form.priority,
      });
      if (!res.ok) { setFormError(await extractError(res, "create_failed")); return; }
      setOpen(false); setForm({ subject: "", description: "", category: "", priority: "medium" }); reload();
    } catch { setFormError("create_failed"); } finally { setSaving(false); }
  }

  const breachedCount = items.filter(x => slaBreached(x.status, x.sla_due_at)).length;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_ticketing}>
        <button onClick={() => { setOpen(true); setFormError(null); }} className="sgi-btn sgi-btn-primary">
          <IcPlus /> {t.add}
        </button>
      </Topbar>
      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-cream)" }}>
        {/* Liste */}
        <div style={{ width: 340, borderInlineEnd: "1px solid var(--line-soft)", background: "var(--bg-paper)", display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "16px 18px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--gold)" }}><IcReport /></span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t.tk_title}</span>
            <span style={{ fontSize: 11, color: "var(--ink-4)", marginInlineStart: "auto" }}>
              {loading ? "…" : `${items.length}${breachedCount ? ` · ${breachedCount} ${t.tk_sla_breached}` : ""}`}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8, padding: "0 18px 10px" }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-cream)", fontSize: 12, color: "var(--ink)" }}>
              <option value="">{t.tk_filter_all}</option>
              {STATUSES.map(s => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
            </select>
            <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} style={{ flex: 1, padding: "6px 8px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-cream)", fontSize: 12, color: "var(--ink)" }}>
              <option value="">{t.tk_filter_all}</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{priorityLabel(t, p)}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {error && <div style={{ padding: "10px 18px", color: "var(--rose)", fontSize: 12 }}>{t.error_label} : {error}</div>}
            {!loading && items.length === 0 && !error && <div style={{ padding: "16px 18px", color: "var(--ink-4)", fontSize: 13 }}>{t.tk_empty}</div>}
            {items.map(tk => {
              const st = STATUS_STYLE[tk.status] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
              const pr = PRIORITY_STYLE[tk.priority] ?? { color: "var(--ink-3)", bg: "var(--line-soft)" };
              const breached = slaBreached(tk.status, tk.sla_due_at);
              return (
                <div key={tk.id} onClick={() => setSelId(tk.id)} style={{ padding: "12px 18px", borderTop: "1px solid var(--line-soft)", cursor: "pointer", background: selId === tk.id ? "var(--gold-ghost)" : "transparent", borderInlineStart: selId === tk.id ? "3px solid var(--gold)" : "3px solid transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: pr.bg, color: pr.color }}>{priorityLabel(t, tk.priority)}</span>
                    {breached && <span style={{ fontSize: 10, fontWeight: 700, color: "var(--rose)" }}>⚠ {t.tk_sla_breached}</span>}
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: st.bg, color: st.color, marginInlineStart: "auto" }}>{statusLabel(t, tk.status)}</span>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tk.subject}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }} className="tnum">{tk.reference}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Détail */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!selId || !detail ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)", fontSize: 13 }}>
              {detailLoading ? t.loading : t.tk_select}
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 26px", borderBottom: "1px solid var(--line-soft)", background: "var(--bg-paper)", flexWrap: "wrap" }}>
                <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--gold-deep)" }}>{detail.reference}</span>
                <span style={{ fontSize: 13, color: "var(--ink)" }}>{detail.subject}</span>
                <span style={{ fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: (PRIORITY_STYLE[detail.priority] ?? {}).bg, color: (PRIORITY_STYLE[detail.priority] ?? {}).color }}>{priorityLabel(t, detail.priority)}</span>
                <span style={{ display: "inline-flex", gap: 8, marginInlineStart: "auto", alignItems: "center" }}>
                  <button onClick={() => act("assign", {}, "assign_failed")} style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "5px 10px", background: "var(--bg-cream)", fontSize: 12, fontWeight: 600, color: "var(--ink)", cursor: "pointer" }}>{t.tk_assign_me}</button>
                  <select value={detail.status} onChange={e => act("transition", { status: e.target.value }, "status_failed")} style={{ padding: "5px 8px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-cream)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}>
                    {STATUSES.map(s => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
                  </select>
                </span>
              </div>
              {/* SLA */}
              <div style={{ display: "flex", gap: 16, padding: "8px 26px", fontSize: 11.5, color: "var(--ink-4)", borderBottom: "1px solid var(--line-soft)" }}>
                <span>{t.tk_sla} : {detail.sla_due_at ? <span className="tnum" style={{ color: slaBreached(detail.status, detail.sla_due_at) ? "var(--rose)" : "var(--ink-2)" }}>{new Date(detail.sla_due_at).toLocaleString(lang)}</span> : "—"}</span>
                {detail.escalation_level > 0 && <span style={{ color: "var(--rose)", fontWeight: 600 }}>{t.tk_escalation} {detail.escalation_level}</span>}
              </div>
              {actErr && <div style={{ padding: "8px 26px", color: "var(--rose)", fontSize: 12, background: "var(--rose-soft)" }}>{t.action_refused} : {actErr}</div>}

              {/* Timeline */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 26px" }}>
                {detail.description && <div style={{ fontSize: 13, color: "var(--ink-2)", marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid var(--line-soft)" }}>{detail.description}</div>}
                <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 10 }}>{t.tk_timeline}</div>
                {detail.events.length === 0 && <div style={{ color: "var(--ink-4)", fontSize: 12 }}>{t.tk_empty_events}</div>}
                {detail.events.map(ev => (
                  <div key={ev.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderTop: "1px solid var(--line-soft)" }}>
                    <span style={{ fontSize: 10.5, color: "var(--ink-4)", width: 120, flexShrink: 0 }} className="tnum">{new Date(ev.created_at).toLocaleString(lang)}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: "var(--ink-2)" }}>
                      <span style={{ fontWeight: 600, color: "var(--ink-3)" }}>{ev.event_type}</span>{ev.body ? ` — ${ev.body}` : ""}
                    </span>
                  </div>
                ))}
              </div>

              {/* Commentaire */}
              <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 20px", background: "var(--bg-paper)", display: "flex", gap: 10 }}>
                <input value={comment} onChange={e => setComment(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addComment(); }} placeholder={t.tk_comment_placeholder} style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 999, background: "var(--bg-cream)", fontSize: 13, color: "var(--ink)" }} />
                <button onClick={addComment} disabled={sending || !comment.trim()} style={{ padding: "9px 18px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: 999, fontWeight: 600, fontSize: 13, cursor: sending ? "default" : "pointer", opacity: sending || !comment.trim() ? 0.6 : 1 }}>{sending ? "…" : t.tk_comment_add}</button>
              </div>
            </>
          )}
        </div>
      </div>

      <CreateModal title={t.tk_new} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={create}>
        <Field label={`${t.tk_field_subject} *`}><input autoFocus value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} style={fieldInput} /></Field>
        <Field label={t.tk_field_description}><input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={fieldInput} /></Field>
        <Field label={t.tk_field_category}><input value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} style={fieldInput} placeholder="incident · demande · facturation…" /></Field>
        <Field label={t.tk_field_priority}>
          <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} style={fieldInput}>
            {PRIORITIES.map(p => <option key={p} value={p}>{priorityLabel(t, p)}</option>)}
          </select>
        </Field>
      </CreateModal>
    </div>
  );
}
