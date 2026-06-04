"use client";

/**
 * Assistant in-app (chatbot robot) : FAB persistant fixé en bas, JUSTE à côté
 * du dock softphone (inline-end décalé pour ne pas le recouvrir). Ouvre un
 * panneau de discussion qui aide l'utilisateur à utiliser l'application :
 * navigation, questions sur ses données (KPI tenant), conversation libre, et
 * actions guidées (boutons « Ouvrir » vers l'écran pertinent).
 *
 * Câblé sur le module AI Copilot via le proxy :
 *   POST /api/admin/copilot/chat  body { messages, locale, screen? }
 * Mode SYNCHRONE (MVP) : un appel → réponse (Gemini, repli heuristique sinon).
 * Historique ÉPHÉMÈRE (state local, rien en base). CSS strictement logique
 * (Loi 3 RTL) ; chiffres latins.
 */

import React, { useEffect, useRef, useState } from "react";

import { IcClose } from "@/components/sgi-ui";
import { useT, useLang } from "@/components/language-provider";
import { postJson } from "@/lib/api-client";

type NavSuggestion = { screen: string; label: string };

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  nav?: NavSuggestion[];
};

type ChatResponse = {
  data?: { reply: string; engine: string; suggested_navigation: NavSuggestion[] };
};

// Icône robot (assistant). Tracé simple, hérite de currentColor.
const IcRobot = (): React.ReactNode => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 2v3" />
    <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
    <rect x="4" y="8" width="16" height="11" rx="3" />
    <circle cx="9" cy="13" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="13" r="1.2" fill="currentColor" stroke="none" />
    <path d="M9.5 16h5" />
    <path d="M2 12v3" />
    <path d="M22 12v3" />
  </svg>
);

export function AssistantDock({
  screen,
  onNavigate,
}: {
  /** Écran courant (clé de nav) — contexte facultatif envoyé au backend. */
  screen?: string;
  /** Ouvre l'écran demandé (action guidée). */
  onNavigate?: (screen: string) => void;
}): React.ReactNode {
  const t = useT();
  const { lang } = useLang();

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll vers le dernier message à chaque ajout / ouverture.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text || loading) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setDraft("");
    setError(false);
    setLoading(true);
    try {
      const res = await postJson("/api/admin/copilot/chat", {
        // On n'envoie que les tours réels (role+content) — le message d'accueil
        // est purement UI et n'est pas dans `messages`.
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        locale: lang,
        screen,
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      const body = (await res.json()) as ChatResponse;
      const reply = body.data?.reply ?? "";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply, nav: body.data?.suggested_navigation ?? [] },
      ]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    // Entrée = envoyer ; Maj+Entrée = nouvelle ligne.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function goTo(s: string): void {
    onNavigate?.(s);
    setOpen(false);
  }

  return (
    <>
      {/* Bouton flottant robot — à côté du softphone (décalé en inline-end). */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? t.assistant_close : t.assistant_open}
        title={t.assistant_title}
        style={{
          position: "fixed",
          insetBlockEnd: 20,
          insetInlineEnd: 84,
          width: 52,
          height: 52,
          borderRadius: 999,
          border: "none",
          background: "var(--gold)",
          color: "#1A1610",
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1200,
        }}
      >
        <IcRobot />
        {/* Pastille « en ligne » */}
        <span
          style={{
            position: "absolute",
            insetBlockStart: 6,
            insetInlineEnd: 6,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: "var(--emerald)",
            border: "2px solid #1A1610",
          }}
        />
      </button>

      {!open ? null : (
        <div
          style={{
            position: "fixed",
            insetBlockEnd: 84,
            insetInlineEnd: 20,
            width: "min(360px, calc(100vw - 32px))",
            height: "min(70vh, 560px)",
            background: "var(--bg-paper)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
            zIndex: 1200,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* En-tête */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 16px",
              borderBottom: "1px solid var(--line-soft)",
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 999,
                background: "var(--gold-ghost, rgba(197,160,89,0.18))",
                color: "var(--gold)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <IcRobot />
            </span>
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span
                className="font-display"
                style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}
              >
                {t.assistant_title}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{t.assistant_subtitle}</span>
            </span>
            <span style={{ display: "flex", gap: 4, marginInlineStart: "auto" }}>
              {messages.length > 0 && (
                <button
                  onClick={() => {
                    setMessages([]);
                    setError(false);
                  }}
                  title={t.assistant_clear}
                  style={{
                    background: "none",
                    border: "1px solid var(--line)",
                    borderRadius: 8,
                    padding: "3px 8px",
                    fontSize: 11,
                    color: "var(--ink-4)",
                    cursor: "pointer",
                  }}
                >
                  {t.assistant_clear}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                aria-label={t.assistant_close}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-4)",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <IcClose />
              </button>
            </span>
          </div>

          {/* Fil de discussion */}
          <div
            ref={listRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: 14,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {/* Accueil (UI seulement) */}
            <Bubble role="assistant">{t.assistant_welcome}</Bubble>

            {messages.map((m, i) => (
              <React.Fragment key={i}>
                <Bubble role={m.role}>{m.content}</Bubble>
                {m.role === "assistant" && m.nav && m.nav.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      marginInlineEnd: "auto",
                      maxWidth: "85%",
                    }}
                  >
                    {m.nav.map((n) => (
                      <button
                        key={n.screen}
                        onClick={() => goTo(n.screen)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          padding: "5px 11px",
                          border: "1px solid var(--gold)",
                          borderRadius: 999,
                          background: "var(--gold-ghost, rgba(197,160,89,0.14))",
                          color: "var(--ink)",
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {n.label}
                        <span style={{ color: "var(--gold)" }}>→</span>
                      </button>
                    ))}
                  </div>
                )}
              </React.Fragment>
            ))}

            {loading && (
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginInlineEnd: "auto" }}>
                {t.assistant_thinking}
              </div>
            )}
            {error && (
              <div style={{ fontSize: 12, color: "var(--rose)", marginInlineEnd: "auto" }}>
                {t.assistant_error}
              </div>
            )}
          </div>

          {/* Saisie */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              padding: 12,
              borderTop: "1px solid var(--line-soft)",
            }}
          >
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t.assistant_placeholder}
              rows={1}
              style={{
                flex: 1,
                resize: "none",
                maxHeight: 96,
                padding: "9px 11px",
                border: "1px solid var(--line)",
                borderRadius: 10,
                background: "var(--bg-cream)",
                fontSize: 13,
                color: "var(--ink)",
                fontFamily: "inherit",
                textAlign: "start",
              }}
            />
            <button
              onClick={() => void send()}
              disabled={loading || !draft.trim()}
              style={{
                padding: "9px 16px",
                border: "none",
                borderRadius: 10,
                background: "var(--gold)",
                color: "#1A1610",
                fontSize: 13,
                fontWeight: 600,
                cursor: loading || !draft.trim() ? "default" : "pointer",
                opacity: loading || !draft.trim() ? 0.6 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {t.assistant_send}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/** Bulle de message — alignement logique (RTL-safe) selon l'émetteur. */
function Bubble({
  role,
  children,
}: {
  role: "user" | "assistant";
  children: React.ReactNode;
}): React.ReactNode {
  const isUser = role === "user";
  return (
    <div
      style={{
        maxWidth: "85%",
        // user → poussé vers l'inline-end ; assistant → vers l'inline-start.
        marginInlineStart: isUser ? "auto" : undefined,
        marginInlineEnd: isUser ? undefined : "auto",
        padding: "9px 12px",
        borderRadius: 12,
        background: isUser ? "var(--gold)" : "var(--bg-cream)",
        color: isUser ? "#1A1610" : "var(--ink)",
        border: isUser ? "none" : "1px solid var(--line-soft)",
        fontSize: 13,
        lineHeight: 1.5,
        whiteSpace: "pre-wrap",
        textAlign: "start",
        wordBreak: "break-word",
      }}
    >
      {children}
    </div>
  );
}
