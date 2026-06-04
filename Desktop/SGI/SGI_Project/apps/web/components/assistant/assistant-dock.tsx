"use client";

/**
 * Assistant in-app (chatbot robot) VIVANT & MOBILE.
 *
 * L'avatar robot se déplace de façon fluide dans la page (moteur
 * `useAssistantRoaming`) : il suit le curseur, se colle au champ en cours de
 * saisie, patrouille au repos, et ACCOURT comme une ambulance vers la zone
 * fautive quand un problème est détecté (champ invalide, erreur). Son regard
 * suit toujours la souris. Au clic, il ouvre le panneau de discussion (ancré au
 * coin, stable) câblé sur le module AI Copilot :
 *   POST /api/admin/copilot/chat  body { messages, locale, screen? }
 *
 * Historique ÉPHÉMÈRE (state local). CSS strictement logique (Loi 3 RTL).
 * Respecte prefers-reduced-motion + bouton « figer » (pinned, persisté).
 */

import React, { useEffect, useRef, useState } from "react";

import { IcClose } from "@/components/sgi-ui";
import { useT, useLang } from "@/components/language-provider";
import { postJson } from "@/lib/api-client";

import { useAssistantRoaming, type RoamMode } from "./use-assistant-roaming";

type NavSuggestion = { screen: string; label: string };
type ChatMessage = { role: "user" | "assistant"; content: string; nav?: NavSuggestion[] };
type ChatResponse = {
  data?: { reply: string; engine: string; suggested_navigation: NavSuggestion[] };
};

const PIN_KEY = "sgi_assistant_pinned";

/** Couleur du halo d'état selon le mode de déplacement. */
function haloColor(mode: RoamMode): string {
  if (mode === "rescue") return "var(--rose, #d6455d)";
  if (mode === "follow") return "var(--emerald, #2f9e6e)";
  return "var(--gold)";
}

export function AssistantDock({
  screen,
  onNavigate,
}: {
  screen?: string;
  onNavigate?: (screen: string) => void;
}): React.ReactNode {
  const t = useT();
  const { lang } = useLang();

  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  // Restaure la préférence « figé ».
  useEffect(() => {
    try {
      setPinned(localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* storage indisponible : ignore */
    }
  }, []);

  function togglePin(): void {
    setPinned((p) => {
      const next = !p;
      try {
        localStorage.setItem(PIN_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  // Ouvre le panneau, éventuellement en pré-remplissant la saisie (depuis une
  // bulle de secours → l'utilisateur relit puis envoie).
  function summon(prompt?: string): void {
    setOpen(true);
    if (prompt) {
      setDraft(prompt);
      setTimeout(() => inputRef.current?.focus(), 60);
    }
  }

  const { containerRef, pupilLRef, pupilRRef, mode, tip, dismissTip, tipBelow } =
    useAssistantRoaming({ open, pinned, t, screen, onSummon: summon });

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
        messages: next.map((m) => ({ role: m.role, content: m.content })),
        locale: lang,
        screen,
      });
      if (!res.ok) {
        setError(true);
        return;
      }
      const body = (await res.json()) as ChatResponse;
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: body.data?.reply ?? "",
          nav: body.data?.suggested_navigation ?? [],
        },
      ]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  function goTo(s: string): void {
    onNavigate?.(s);
    setOpen(false);
  }

  const halo = haloColor(mode);

  return (
    <>
      {/* Animations (keyframes) — injectées une fois. */}
      <style>{ASSISTANT_CSS}</style>

      {/* Conteneur mobile : translaté par le moteur ; transparent aux clics
          sauf sur l'avatar et la bulle (pointer-events). */}
      <div
        ref={containerRef}
        style={{
          position: "fixed",
          insetBlockStart: 0,
          insetInlineStart: 0,
          width: 52,
          height: 52,
          zIndex: 1250,
          pointerEvents: "none",
          willChange: "transform",
        }}
        aria-hidden={false}
      >
        {/* Avatar robot cliquable */}
        <button
          onClick={() => setOpen((o) => !o)}
          aria-label={open ? t.assistant_close : t.assistant_open}
          title={t.assistant_title}
          className={`sgia-face${mode === "rescue" ? " sgia-rescue" : ""}`}
          style={{
            pointerEvents: "auto",
            width: 52,
            height: 52,
            borderRadius: 999,
            border: "none",
            background: "var(--gold)",
            color: "#1A1610",
            cursor: "pointer",
            boxShadow: `0 6px 20px rgba(0,0,0,0.28), 0 0 0 0 ${halo}`,
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
        >
          {/* Halo d'état */}
          <span
            className="sgia-halo"
            style={{
              position: "absolute",
              inset: -3,
              borderRadius: 999,
              border: `2px solid ${halo}`,
            }}
          />
          {/* Antenne */}
          <span
            style={{
              position: "absolute",
              insetBlockStart: -7,
              width: 2,
              height: 7,
              background: "#1A1610",
              borderRadius: 2,
            }}
          />
          <span
            style={{
              position: "absolute",
              insetBlockStart: -11,
              width: 6,
              height: 6,
              borderRadius: 999,
              background: mode === "rescue" ? "var(--rose)" : "var(--emerald)",
            }}
          />
          {/* Visière + yeux suiveurs */}
          <span
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: 34,
              height: 17,
              borderRadius: 9,
              background: "#1A1610",
            }}
          >
            <span className="sgia-eye">
              <span ref={pupilLRef} className="sgia-pupil" />
            </span>
            <span className="sgia-eye">
              <span ref={pupilRRef} className="sgia-pupil" />
            </span>
          </span>
          {/* Bouche */}
          <span
            style={{
              position: "absolute",
              insetBlockEnd: 9,
              width: 12,
              height: 2,
              borderRadius: 2,
              background: "rgba(26,22,16,0.55)",
            }}
          />
        </button>

        {/* Bulle proactive (suit l'avatar : enfant du conteneur translaté) */}
        {tip && (
          <div
            role="status"
            style={{
              pointerEvents: "auto",
              position: "absolute",
              insetInlineEnd: 0,
              ...(tipBelow ? { insetBlockStart: 60 } : { insetBlockEnd: 60 }),
              width: "max-content",
              maxWidth: 240,
              background: "var(--bg-paper)",
              border: `1px solid ${tip.tone === "rescue" ? "var(--rose)" : "var(--line)"}`,
              borderRadius: 12,
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <span style={{ fontSize: 12.5, color: "var(--ink)", lineHeight: 1.4, textAlign: "start" }}>
                {tip.text}
              </span>
              <button
                onClick={dismissTip}
                aria-label={t.assistant_close}
                style={{
                  marginInlineStart: "auto",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--ink-4)",
                  display: "inline-flex",
                  flexShrink: 0,
                }}
              >
                <IcClose />
              </button>
            </div>
            <button
              onClick={() => {
                summon(tip.prompt);
                dismissTip();
              }}
              style={{
                alignSelf: "flex-start",
                padding: "5px 12px",
                border: "none",
                borderRadius: 999,
                background: "var(--gold)",
                color: "#1A1610",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t.assistant_goto}
            </button>
          </div>
        )}
      </div>

      {/* Panneau de discussion — ancré au coin (stable, ne roame pas) */}
      {open && (
        <div
          data-assistant-ui
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
            zIndex: 1260,
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
                fontSize: 18,
              }}
            >
              🤖
            </span>
            <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                {t.assistant_title}
              </span>
              <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{t.assistant_subtitle}</span>
            </span>
            <span style={{ display: "flex", gap: 4, marginInlineStart: "auto" }}>
              <button
                onClick={togglePin}
                title={pinned ? t.assistant_unpin : t.assistant_pin}
                aria-pressed={pinned}
                style={{
                  background: pinned ? "var(--gold-ghost, rgba(197,160,89,0.18))" : "none",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "3px 8px",
                  fontSize: 13,
                  color: pinned ? "var(--gold)" : "var(--ink-4)",
                  cursor: "pointer",
                }}
              >
                {pinned ? "📌" : "📍"}
              </button>
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

          {/* Fil */}
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
              ref={inputRef}
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

// Keyframes : respiration, clignement, sirène (secours). Désactivés si
// l'utilisateur préfère un mouvement réduit.
const ASSISTANT_CSS = `
.sgia-face { animation: sgia-breathe 3s ease-in-out infinite; transition: box-shadow .3s ease; }
.sgia-eye {
  position: relative; width: 9px; height: 9px; border-radius: 999px;
  background: #fff; display: inline-flex; align-items: center; justify-content: center;
  animation: sgia-blink 4.6s infinite;
}
.sgia-pupil {
  width: 4px; height: 4px; border-radius: 999px; background: #1A1610; display: block;
}
.sgia-halo { animation: sgia-pulse 2.6s ease-in-out infinite; opacity: .5; }
.sgia-rescue { animation: sgia-shake .5s ease-in-out infinite; }
.sgia-rescue .sgia-halo { animation: sgia-siren .7s ease-in-out infinite; }
@keyframes sgia-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.05); } }
@keyframes sgia-blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
@keyframes sgia-pulse { 0%,100% { opacity: .35; transform: scale(1); } 50% { opacity: .7; transform: scale(1.08); } }
@keyframes sgia-siren { 0%,100% { opacity: .4; transform: scale(1); } 50% { opacity: 1; transform: scale(1.16); } }
@keyframes sgia-shake { 0%,100% { } 25% { margin-block-start: -1px; } 75% { margin-block-start: 1px; } }
@media (prefers-reduced-motion: reduce) {
  .sgia-face, .sgia-eye, .sgia-halo, .sgia-rescue, .sgia-rescue .sgia-halo { animation: none !important; }
}
`;
