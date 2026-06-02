"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { Topbar, IcChat, IcMail, IcPhone } from "@/components/sgi-ui";
import { useT, useLang } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson, extractError } from "@/lib/api-client";

// Câblé sur le module Omnichannel Inbox (Ph0-1 + endpoints métier) :
//   GET    /api/admin/inbox/conversations            (liste paginée)
//   GET    /api/admin/inbox/conversations/{id}        (détail)
//   GET    /api/admin/inbox/conversations/{id}/messages (fil REST — socle)
//   POST   /api/admin/inbox/conversations/{id}/messages (réponse sortante)
//   POST   /api/admin/inbox/conversations/{id}/assign   (attribution agent)
//   POST   /api/admin/inbox/conversations/{id}/status   (transition statut)
//   GET/POST /api/admin/inbox/conversations/{id}/notes  (notes internes)
//   GET/POST /api/admin/inbox/conversations/{id}/tags   (étiquettes)
// Le temps réel arrive par WebSocket (event message.created) ; le fil REST sert
// de socle et de fallback. Le token WS vient de /api/admin/inbox/ws-token (le
// cookie httpOnly est illisible par JS — même décision sécu que comms/telephony).
// CSS strictement logique (Loi 3 RTL) ; chiffres latins.

type Channel = "whatsapp" | "email" | "webchat" | "facebook" | "instagram" | string;
type InboxStatus = "new" | "assigned" | "pending" | "resolved" | "closed" | string;

type Conversation = {
  id: string;
  reference: string;
  channel: Channel;
  status: InboxStatus;
  subject: string | null;
  contact_display: string | null;
  assigned_agent_id: string | null;
  last_message_at: string | null;
};

type Message = {
  id: string;
  direction: string; // "inbound" | "outbound"
  channel: Channel;
  sender_user_id: string | null;
  body: string | null;
  created_at: string;
};

type Note = { id: string; agent_user_id: string | null; body: string | null; created_at: string };
type Tag = { id: string; name: string; color: string | null };
// Le détail (GET /conversations/{id}) embarque messages/notes/tags (ConversationDetail).
type Detail = Conversation & { messages: Message[]; notes: Note[]; tags: Tag[] };

const channelIcon = (ch: Channel): React.ReactNode => {
  switch (ch) {
    case "email":
      return <IcMail />;
    case "whatsapp":
      return <IcPhone />;
    default:
      return <IcChat />;
  }
};

const channelLabel = (t: Translations, ch: Channel): string =>
  (
    {
      whatsapp: t.inbox_ch_whatsapp,
      email: t.inbox_ch_email,
      webchat: t.inbox_ch_webchat,
      facebook: t.inbox_ch_facebook,
      instagram: t.inbox_ch_instagram,
    } as Record<string, string>
  )[ch] ?? ch;

const STATUS_OPTIONS: InboxStatus[] = ["new", "assigned", "pending", "resolved", "closed"];

const statusLabel = (t: Translations, s: InboxStatus): string =>
  (
    {
      new: t.inbox_st_new,
      assigned: t.inbox_st_assigned,
      pending: t.inbox_st_pending,
      resolved: t.inbox_st_resolved,
      closed: t.inbox_st_closed,
    } as Record<string, string>
  )[s] ?? s;

const statusColor = (s: InboxStatus): string =>
  (
    {
      new: "var(--gold)",
      assigned: "var(--azure, #2f6fed)",
      pending: "var(--amber, #d99a2b)",
      resolved: "var(--emerald)",
      closed: "var(--ink-4)",
    } as Record<string, string>
  )[s] ?? "var(--ink-4)";

/** Base WS du backend : NEXT_PUBLIC_WS_URL sinon même origine (nginx proxifie /api/v1).
 *
 * Le backend expose un flux WS unique par agent/superviseur (`/api/v1/inbox/ws`),
 * pas un flux par conversation : on filtre côté client sur `conversation_id`. */
function wsUrl(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_WS_URL ??
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  return `${base.replace(/\/$/, "")}/api/v1/inbox/ws?token=${encodeURIComponent(token)}`;
}

export function ScreenRealEstateInbox(): React.ReactNode {
  const t = useT();
  const { lang } = useLang();

  const [channelFilter, setChannelFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const listUrl =
    `/api/admin/inbox/conversations?limit=100` +
    (channelFilter ? `&channel=${encodeURIComponent(channelFilter)}` : "") +
    (statusFilter ? `&status=${encodeURIComponent(statusFilter)}` : "");
  const { items: conversations, loading, error, reload } = useApiList<Conversation>(listUrl);

  const [selId, setSelId] = useState<string | null>(null);
  const [selConv, setSelConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  // Panneau agent
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [noteDraft, setNoteDraft] = useState("");
  const [tagDraft, setTagDraft] = useState("");
  const [panelBusy, setPanelBusy] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  // Le détail renvoie déjà messages/notes/tags embarqués → une seule requête
  // (les GET /conversations/{id}/{messages,notes,tags} n'existent pas : POST-only).
  const loadDetail = useCallback((convId: string) => {
    setMsgLoading(true);
    getJson<{ data: Detail }>(`/api/admin/inbox/conversations/${convId}`)
      .then((r) => {
        const d = r.data;
        setSelConv(d ?? null);
        setMessages(d?.messages ?? []);
        setNotes(d?.notes ?? []);
        setTags(d?.tags ?? []);
      })
      .catch(() => {
        setSelConv(null);
        setMessages([]);
        setNotes([]);
        setTags([]);
      })
      .finally(() => setMsgLoading(false));
  }, []);

  useEffect(() => {
    if (!selId) return;
    loadDetail(selId);
  }, [selId, loadDetail]);

  // WebSocket temps réel, ré-établie à chaque changement de conversation.
  useEffect(() => {
    if (!selId) return;
    let cancelled = false;
    let ws: WebSocket | null = null;
    setLive(false);
    (async () => {
      try {
        const { token } = await getJson<{ token: string }>("/api/admin/inbox/ws-token");
        if (cancelled || !token) return;
        ws = new WebSocket(wsUrl(token));
        wsRef.current = ws;
        ws.onopen = () => {
          if (!cancelled) setLive(true);
        };
        ws.onclose = () => {
          if (!cancelled) setLive(false);
        };
        ws.onerror = () => {
          if (!cancelled) setLive(false);
        };
        ws.onmessage = (ev) => {
          try {
            const evt = JSON.parse(ev.data);
            // Flux tenant/agent : on ne réagit qu'aux events de la conversation
            // ouverte. L'event ne porte qu'un résumé (conversation_id, body…),
            // pas l'objet Message complet : on recharge le fil via REST.
            const convId = evt?.data?.conversation_id as string | undefined;
            if (evt.type === "message.created" && convId === selId) {
              loadDetail(selId);
            }
          } catch {
            /* ping/pong & frames non-JSON ignorés */
          }
        };
      } catch {
        if (!cancelled) setLive(false);
      }
    })();
    return () => {
      cancelled = true;
      setLive(false);
      if (ws) {
        ws.onmessage = null;
        ws.onclose = null;
        ws.close();
      }
      wsRef.current = null;
    };
  }, [selId, loadDetail]);

  async function send(): Promise<void> {
    if (!selId || !draft.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      const res = await postJson(`/api/admin/inbox/conversations/${selId}/messages`, {
        body: draft.trim(),
        direction: "outbound",
      });
      if (!res.ok) {
        setSendError(await extractError(res, "send_failed"));
        return;
      }
      setDraft("");
      // Recharge le fil immédiatement (l'event WS sortant arrivera aussi mais
      // l'agent voit sa réponse sans délai).
      loadDetail(selId);
    } catch {
      setSendError("send_failed");
    } finally {
      setSending(false);
    }
  }

  async function assignToMe(): Promise<void> {
    if (!selId) return;
    setPanelBusy(true);
    setPanelError(null);
    try {
      const res = await postJson(`/api/admin/inbox/conversations/${selId}/assign`, {});
      if (!res.ok) {
        setPanelError(await extractError(res, "assign_failed"));
        return;
      }
      loadDetail(selId);
      reload();
    } catch {
      setPanelError("assign_failed");
    } finally {
      setPanelBusy(false);
    }
  }

  async function changeStatus(next: InboxStatus): Promise<void> {
    if (!selId) return;
    setPanelBusy(true);
    setPanelError(null);
    try {
      const res = await postJson(`/api/admin/inbox/conversations/${selId}/status`, {
        status: next,
      });
      if (!res.ok) {
        setPanelError(await extractError(res, "status_failed"));
        return;
      }
      loadDetail(selId);
      reload();
    } catch {
      setPanelError("status_failed");
    } finally {
      setPanelBusy(false);
    }
  }

  async function addNote(): Promise<void> {
    if (!selId || !noteDraft.trim()) return;
    setPanelBusy(true);
    setPanelError(null);
    try {
      const res = await postJson(`/api/admin/inbox/conversations/${selId}/notes`, {
        body: noteDraft.trim(),
      });
      if (!res.ok) {
        setPanelError(await extractError(res, "note_failed"));
        return;
      }
      setNoteDraft("");
      loadDetail(selId);
    } catch {
      setPanelError("note_failed");
    } finally {
      setPanelBusy(false);
    }
  }

  async function addTag(): Promise<void> {
    if (!selId || !tagDraft.trim()) return;
    setPanelBusy(true);
    setPanelError(null);
    try {
      const res = await postJson(`/api/admin/inbox/conversations/${selId}/tags`, {
        name: tagDraft.trim(),
      });
      if (!res.ok) {
        setPanelError(await extractError(res, "tag_failed"));
        return;
      }
      setTagDraft("");
      loadDetail(selId);
    } catch {
      setPanelError("tag_failed");
    } finally {
      setPanelBusy(false);
    }
  }

  const current = selConv;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.inbox_title} />

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-cream)" }}>
        {/* ── Liste des conversations ── */}
        <div
          style={{
            width: 320,
            borderInlineEnd: "1px solid var(--line-soft)",
            background: "var(--bg-paper)",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div style={{ padding: "16px 18px 10px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--gold)" }}>
              <IcChat />
            </span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
              {t.inbox_title}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-4)", marginInlineStart: "auto" }}>
              {loading ? "…" : conversations.length}
            </span>
          </div>

          {/* Filtres */}
          <div style={{ display: "flex", gap: 8, padding: "0 18px 10px" }}>
            <select
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value)}
              style={{
                flex: 1,
                padding: "6px 8px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--bg-cream)",
                fontSize: 12,
                color: "var(--ink)",
              }}
            >
              <option value="">{t.inbox_all_channels}</option>
              {(["whatsapp", "email", "webchat", "facebook", "instagram"] as Channel[]).map((c) => (
                <option key={c} value={c}>
                  {channelLabel(t, c)}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{
                flex: 1,
                padding: "6px 8px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--bg-cream)",
                fontSize: 12,
                color: "var(--ink)",
              }}
            >
              <option value="">{t.inbox_all_statuses}</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {statusLabel(t, s)}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
            {error && (
              <div style={{ padding: "10px 18px", color: "var(--rose)", fontSize: 12 }}>
                {t.error_label} : {error}
              </div>
            )}
            {!loading && conversations.length === 0 && !error && (
              <div style={{ padding: "16px 18px", color: "var(--ink-4)", fontSize: 13 }}>
                {t.inbox_empty_conversations}
              </div>
            )}
            {conversations.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelId(c.id)}
                style={{
                  padding: "12px 18px",
                  borderTop: "1px solid var(--line-soft)",
                  cursor: "pointer",
                  background: selId === c.id ? "var(--gold-ghost)" : "transparent",
                  borderInlineStart: selId === c.id ? "3px solid var(--gold)" : "3px solid transparent",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "var(--ink-4)", display: "inline-flex" }}>{channelIcon(c.channel)}</span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--ink)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      flex: 1,
                    }}
                  >
                    {c.contact_display || c.subject || t.inbox_no_subject}
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: "#1A1610",
                      background: statusColor(c.status),
                      borderRadius: 999,
                      padding: "1px 7px",
                    }}
                  >
                    {statusLabel(t, c.status)}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3, gap: 8 }}>
                  <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{c.reference}</span>
                  <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
                    {c.last_message_at ? new Date(c.last_message_at).toLocaleString(lang) : "—"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Fil de messages ── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!selId ? (
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--ink-4)",
                fontSize: 13,
              }}
            >
              {t.inbox_select_conversation}
            </div>
          ) : (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 26px",
                  borderBottom: "1px solid var(--line-soft)",
                  background: "var(--bg-paper)",
                }}
              >
                <span style={{ color: "var(--gold)", display: "inline-flex" }}>
                  {current ? channelIcon(current.channel) : <IcChat />}
                </span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                  {current?.contact_display || current?.subject || t.inbox_no_subject}
                </span>
                {current && (
                  <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
                    {channelLabel(t, current.channel)} · {current.reference}
                  </span>
                )}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginInlineStart: "auto" }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: live ? "var(--emerald)" : "var(--ink-4)",
                    }}
                  />
                  <span style={{ fontSize: 11.5, color: live ? "var(--emerald)" : "var(--ink-4)", fontWeight: 600 }}>
                    {live ? t.inbox_live : t.inbox_offline}
                  </span>
                </span>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "20px 26px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {msgLoading && <div style={{ color: "var(--ink-4)", fontSize: 12 }}>{t.loading}</div>}
                {!msgLoading && messages.length === 0 && (
                  <div style={{ color: "var(--ink-4)", fontSize: 12 }}>{t.inbox_empty_messages}</div>
                )}
                {messages.map((m) => {
                  const outbound = m.direction === "outbound";
                  return (
                    <div
                      key={m.id}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: outbound ? "flex-end" : "flex-start",
                      }}
                    >
                      <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginBottom: 2 }}>
                        {outbound ? t.inbox_out : t.inbox_in} · {new Date(m.created_at).toLocaleTimeString(lang)}
                      </div>
                      <div
                        style={{
                          maxWidth: "70%",
                          padding: "9px 13px",
                          borderRadius: 12,
                          fontSize: 13,
                          background: outbound ? "var(--gold-ghost)" : "var(--bg-paper)",
                          color: "var(--ink)",
                          border: "1px solid var(--line-soft)",
                        }}
                      >
                        {m.body || "—"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 20px", background: "var(--bg-paper)" }}>
                {sendError && (
                  <div style={{ color: "var(--rose)", fontSize: 12, marginBottom: 6 }}>
                    {t.error_label} : {sendError}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void send();
                    }}
                    placeholder={t.inbox_write_reply}
                    style={{
                      flex: 1,
                      padding: "9px 12px",
                      border: "1px solid var(--line)",
                      borderRadius: 999,
                      background: "var(--bg-cream)",
                      fontSize: 13,
                      color: "var(--ink)",
                    }}
                  />
                  <button
                    onClick={() => void send()}
                    disabled={sending || !draft.trim()}
                    style={{
                      padding: "9px 18px",
                      background: "var(--gold)",
                      color: "#1A1610",
                      border: "none",
                      borderRadius: 999,
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: sending ? "default" : "pointer",
                      opacity: sending || !draft.trim() ? 0.6 : 1,
                    }}
                  >
                    {sending ? "…" : t.inbox_send}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── Panneau agent ── */}
        {selId && (
          <div
            style={{
              width: 300,
              borderInlineStart: "1px solid var(--line-soft)",
              background: "var(--bg-paper)",
              overflowY: "auto",
              minHeight: 0,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              {t.inbox_agent_panel}
            </div>

            {panelError && (
              <div style={{ color: "var(--rose)", fontSize: 12 }}>
                {t.error_label} : {panelError}
              </div>
            )}

            {/* Attribution */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.inbox_assign}</span>
              <button
                onClick={() => void assignToMe()}
                disabled={panelBusy}
                style={{
                  padding: "8px 12px",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  background: "var(--bg-cream)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  color: "var(--ink)",
                  cursor: panelBusy ? "default" : "pointer",
                  opacity: panelBusy ? 0.6 : 1,
                }}
              >
                {t.inbox_assign_me}
              </button>
              {current?.assigned_agent_id && (
                <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
                  {current.assigned_agent_id.slice(0, 8)}
                </span>
              )}
            </div>

            {/* Statut */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.inbox_status_label}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {STATUS_OPTIONS.map((s) => {
                  const active = current?.status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => void changeStatus(s)}
                      disabled={panelBusy || active}
                      style={{
                        padding: "5px 10px",
                        borderRadius: 999,
                        border: active ? "1px solid var(--gold)" : "1px solid var(--line)",
                        background: active ? "var(--gold-ghost)" : "var(--bg-cream)",
                        fontSize: 11.5,
                        fontWeight: 600,
                        color: "var(--ink)",
                        cursor: panelBusy || active ? "default" : "pointer",
                      }}
                    >
                      {statusLabel(t, s)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Étiquettes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.inbox_tags_label}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {tags.length === 0 && (
                  <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{t.inbox_empty_tags}</span>
                )}
                {tags.map((tag) => (
                  <span
                    key={tag.id}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: tag.color ?? "var(--line-soft)",
                      color: "var(--ink)",
                    }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={tagDraft}
                  onChange={(e) => setTagDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addTag();
                  }}
                  placeholder={t.inbox_add_tag}
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
                  onClick={() => void addTag()}
                  disabled={panelBusy || !tagDraft.trim()}
                  style={{
                    padding: "6px 10px",
                    border: "none",
                    borderRadius: 8,
                    background: "var(--gold)",
                    color: "#1A1610",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: panelBusy || !tagDraft.trim() ? "default" : "pointer",
                    opacity: panelBusy || !tagDraft.trim() ? 0.6 : 1,
                  }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Notes internes */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.inbox_notes_label}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {notes.length === 0 && (
                  <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{t.inbox_empty_notes}</span>
                )}
                {notes.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "var(--bg-cream)",
                      border: "1px solid var(--line-soft)",
                    }}
                  >
                    <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginBottom: 3 }}>
                      {(n.agent_user_id ?? "—").slice(0, 8)} · {new Date(n.created_at).toLocaleString(lang)}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink)" }}>{n.body || "—"}</div>
                  </div>
                ))}
              </div>
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                placeholder={t.inbox_write_note}
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
                onClick={() => void addNote()}
                disabled={panelBusy || !noteDraft.trim()}
                style={{
                  padding: "7px 12px",
                  border: "none",
                  borderRadius: 8,
                  background: "var(--gold)",
                  color: "#1A1610",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: panelBusy || !noteDraft.trim() ? "default" : "pointer",
                  opacity: panelBusy || !noteDraft.trim() ? 0.6 : 1,
                }}
              >
                {t.inbox_add_note}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
