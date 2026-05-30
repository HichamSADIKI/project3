"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Topbar, IcChat } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson, extractError } from "@/lib/api-client";

// Câblé sur /api/admin/comms/conversations (liste) + .../{id}/messages (fil REST).
// Le temps réel (WebSocket) nécessite l'exposition du token (cookie httpOnly) →
// tâche infra séparée ; ici le fil est rafraîchi à l'envoi / à la sélection.

const TYPE_LABEL: Record<string, string> = { direct: "Direct", group: "Groupe", ticket: "Ticket", contract: "Contrat" };

type Conversation = { id: string; type: string; subject: string | null; last_message_at: string | null };
type Message = { id: string; sender_user_id: string | null; kind: string; body: string | null; transcript: string | null; created_at: string };

export function ScreenRealEstateComms() {
  const t = useT();
  const { items: conversations, loading, error } = useApiList<Conversation>("/api/admin/comms/conversations?limit=100");
  const [selId, setSelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [msgLoading, setMsgLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const loadMessages = useCallback((convId: string) => {
    setMsgLoading(true);
    getJson<{ data: Message[] }>(`/api/admin/comms/conversations/${convId}/messages?limit=100`)
      .then(r => setMessages(r.data ?? []))
      .catch(() => setMessages([]))
      .finally(() => setMsgLoading(false));
  }, []);

  useEffect(() => { if (selId) loadMessages(selId); }, [selId, loadMessages]);

  async function send() {
    if (!selId || !draft.trim()) return;
    setSending(true); setSendError(null);
    try {
      const res = await postJson(`/api/admin/comms/conversations/${selId}/messages`, { body: draft.trim(), kind: "text" });
      if (!res.ok) { setSendError(await extractError(res, "send_failed")); return; }
      setDraft(""); loadMessages(selId);
    } catch { setSendError("send_failed"); } finally { setSending(false); }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_comms} />
      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-cream)" }}>
        {/* Liste conversations */}
        <div style={{ width: 320, borderInlineEnd: "1px solid var(--line-soft)", background: "var(--bg-paper)", overflowY: "auto" }}>
          <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--gold)" }}><IcChat /></span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t.nav_comms}</span>
            <span style={{ fontSize: 11, color: "var(--ink-4)", marginInlineStart: "auto" }}>{loading ? "…" : conversations.length}</span>
          </div>
          {error && <div style={{ padding: "10px 18px", color: "var(--rose)", fontSize: 12 }}>Erreur : {error}</div>}
          {!loading && conversations.length === 0 && !error && <div style={{ padding: "16px 18px", color: "var(--ink-4)", fontSize: 13 }}>Aucune conversation.</div>}
          {conversations.map(c => (
            <div key={c.id} onClick={() => setSelId(c.id)} style={{ padding: "12px 18px", borderTop: "1px solid var(--line-soft)", cursor: "pointer", background: selId === c.id ? "var(--gold-ghost)" : "transparent", borderInlineStart: selId === c.id ? "3px solid var(--gold)" : "3px solid transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject || "(sans objet)"}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-4)", background: "var(--line-soft)", borderRadius: 999, padding: "1px 7px" }}>{TYPE_LABEL[c.type] ?? c.type}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 3 }}>{c.last_message_at ? new Date(c.last_message_at).toLocaleString("fr") : "—"}</div>
            </div>
          ))}
        </div>

        {/* Fil de messages */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {!selId ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)", fontSize: 13 }}>Sélectionnez une conversation.</div>
          ) : (
            <>
              <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
                {msgLoading && <div style={{ color: "var(--ink-4)", fontSize: 12 }}>Chargement…</div>}
                {!msgLoading && messages.length === 0 && <div style={{ color: "var(--ink-4)", fontSize: 12 }}>Aucun message.</div>}
                {messages.map(m => (
                  <div key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
                    <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginBottom: 2 }}>{(m.sender_user_id ?? "système").slice(0, 8)} · {new Date(m.created_at).toLocaleTimeString("fr")}</div>
                    <div style={{ maxWidth: "70%", padding: "9px 13px", borderRadius: 12, fontSize: 13, background: "var(--bg-paper)", color: "var(--ink)", border: "1px solid var(--line-soft)" }}>
                      {m.body || (m.kind === "voice" ? "🎙️ note vocale" : "—")}
                      {m.transcript && <div style={{ fontSize: 11, fontStyle: "italic", color: "var(--ink-4)", marginTop: 4 }}>IA : {m.transcript}</div>}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 20px", background: "var(--bg-paper)" }}>
                {sendError && <div style={{ color: "var(--rose)", fontSize: 12, marginBottom: 6 }}>Erreur : {sendError}</div>}
                <div style={{ display: "flex", gap: 10 }}>
                  <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") send(); }}
                    placeholder="Écrire un message…"
                    style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 999, background: "var(--bg-cream)", fontSize: 13, color: "var(--ink)" }}
                  />
                  <button onClick={send} disabled={sending || !draft.trim()} style={{ padding: "9px 18px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: 999, fontWeight: 600, fontSize: 13, cursor: sending ? "default" : "pointer", opacity: sending || !draft.trim() ? 0.6 : 1 }}>
                    {sending ? "…" : "Envoyer"}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
