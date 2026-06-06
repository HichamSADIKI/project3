"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";

export interface TenantConversation {
  id: string;
  type: string;
  subject: string | null;
  last_message_at: string | null;
}

interface ChatMessage {
  id: string;
  sender_user_id: string;
  kind: string;
  body: string | null;
  created_at: string | null;
}

interface ConversationDetail extends TenantConversation {
  messages: ChatMessage[];
  total: number;
}

export function ChatView({
  conversations,
  dateLocale,
  labels,
}: {
  conversations: TenantConversation[];
  dateLocale: string;
  labels: {
    empty: string;
    selectPrompt: string;
    placeholder: string;
    send: string;
    sending: string;
    noSubject: string;
  };
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const fmtTime = (d: string | null) =>
    d ? new Date(d).toLocaleString(dateLocale, { dateStyle: "short", timeStyle: "short" }) : "";

  const open = async (id: string) => {
    setActiveId(id);
    setDetail(null);
    try {
      const d = await apiClient<ConversationDetail>(`/api/proxy/tenant/chat/${id}`);
      setDetail(d);
    } catch {
      setDetail(null);
    }
  };

  const send = async () => {
    if (!body.trim() || !activeId) return;
    setSending(true);
    try {
      const msg = await apiClient<ChatMessage>(`/api/proxy/tenant/chat/${activeId}/messages`, {
        method: "POST",
        json: { body: body.trim() },
      });
      setDetail((prev) => (prev ? { ...prev, messages: [...prev.messages, msg] } : prev));
      setBody("");
    } catch {
      /* silencieux */
    } finally {
      setSending(false);
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
        {labels.empty}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(180px, 280px) 1fr",
        gap: "1rem",
        alignItems: "start",
      }}
    >
      {/* Liste des conversations */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {conversations.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => open(c.id)}
            className="sgi-card"
            style={{
              all: "unset",
              cursor: "pointer",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              border:
                activeId === c.id
                  ? "1px solid var(--gold, #C9A84C)"
                  : "1px solid var(--line, #e5e7eb)",
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: "0.9rem" }}>
              {c.subject || labels.noSubject}
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--ink-3)" }}>
              {fmtTime(c.last_message_at)}
            </div>
          </button>
        ))}
      </div>

      {/* Fil de discussion */}
      <div className="sgi-card" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", minBlockSize: "300px" }}>
        {!activeId ? (
          <div style={{ color: "var(--ink-3)", textAlign: "center", marginBlock: "auto" }}>
            {labels.selectPrompt}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", flex: 1 }}>
              {detail?.messages?.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: "var(--surface-2, #f3f4f6)",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.9rem",
                    color: "var(--ink)",
                  }}
                >
                  <div>{m.body}</div>
                  <div style={{ fontSize: "0.7rem", color: "var(--ink-3)", marginBlockStart: "0.25rem" }}>
                    {fmtTime(m.created_at)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                className="sgi-input"
                style={{ flex: 1 }}
                placeholder={labels.placeholder}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button
                type="button"
                className="sgi-button sgi-button-primary"
                disabled={sending || !body.trim()}
                onClick={send}
              >
                {sending ? labels.sending : labels.send}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
