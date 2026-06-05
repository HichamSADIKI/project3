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
export type AssistantPrefill = { screen: string; fields: Record<string, string | number> };
type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  nav?: NavSuggestion[];
  prefill?: AssistantPrefill;
};
type ChatResponse = {
  data?: {
    reply: string;
    engine: string;
    suggested_navigation: NavSuggestion[];
    prefill?: AssistantPrefill;
  };
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
  onPrefill,
}: {
  screen?: string;
  onNavigate?: (screen: string) => void;
  /** Action guidée profonde : pré-remplit un formulaire de l'écran cible. */
  onPrefill?: (prefill: AssistantPrefill) => void;
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

  // ── Machine d'« activité » (par-dessus les modes de déplacement) ──
  //  rest/offer/search/found + mise en scène au clic :
  //  summon (se lève, marche au centre) → ask (« Que voulez-vous ? ») →
  //  listen (chat ouvert, attend) → understood (« J'ai compris ! ») → wander (déambule).
  type Activity =
    | "rest"
    | "offer"
    | "search"
    | "found"
    | "summon"
    | "ask"
    | "listen"
    | "understood"
    | "wander";
  const [activity, setActivity] = useState<Activity>("rest");
  const [held, setHeld] = useState(false); // pointeur maintenu sur le robot → debout

  // Commande de position envoyée au moteur : centre pour la mise en scène, errance ensuite.
  const command: "center" | "wander" | null =
    activity === "summon" || activity === "ask"
      ? "center"
      : activity === "wander"
        ? "wander"
        : null;

  const { containerRef, pupilLRef, pupilRRef, mode, tip, dismissTip, tipBelow, onAvatarPointerDown, consumeDragClick, resetHome } =
    useAssistantRoaming({ open, pinned, t, screen, onSummon: summon, command });

  // Humeur transitoire : le robot sourit brièvement après une réponse réussie.
  const [mood, setMood] = useState<"neutral" | "happy">("neutral");
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (moodTimer.current) clearTimeout(moodTimer.current); }, []);
  function cheer(): void {
    setMood("happy");
    if (moodTimer.current) clearTimeout(moodTimer.current);
    moodTimer.current = setTimeout(() => setMood("neutral"), 2500);
  }

  const wasLoading = useRef(false);
  const seqTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearSeq = (): void => {
    seqTimers.current.forEach(clearTimeout);
    seqTimers.current = [];
  };
  useEffect(() => clearSeq, []);

  // Mise en scène au clic : se lève → marche au centre → « Que voulez-vous ? »
  // → ouvre le chat et attend la question.
  function startSummon(): void {
    clearSeq();
    setActivity("summon");
    seqTimers.current.push(setTimeout(() => setActivity("ask"), 1500));
    seqTimers.current.push(
      setTimeout(() => {
        setOpen(true);
        setActivity("listen");
      }, 3000),
    );
  }

  // Envoi d'une question → « J'ai compris ! » à la validation, puis marche pendant
  // la recherche, « Trouvé ! » à la réponse, déambulation, puis retour à la chaise.
  useEffect(() => {
    if (loading && !wasLoading.current) {
      clearSeq();
      setActivity("understood");
      seqTimers.current.push(setTimeout(() => setActivity("search"), 1000));
    } else if (!loading && wasLoading.current) {
      clearSeq();
      if (error) {
        setActivity("rest");
      } else {
        setActivity("found");
        seqTimers.current.push(setTimeout(() => setActivity("wander"), 1600));
        seqTimers.current.push(setTimeout(() => setActivity("rest"), 5200));
      }
    }
    wasLoading.current = loading;
  }, [loading, error]);

  // Repos prolongé (90 s, assis & chat fermé) → propose son aide.
  useEffect(() => {
    if (open || mode !== "idle" || activity !== "rest") return;
    const id = setTimeout(() => setActivity("offer"), 90_000);
    return () => clearTimeout(id);
  }, [open, mode, activity]);

  // L'utilisateur redevient actif (ouvre le chat, bouge le robot, il roame) →
  // on retire l'offre d'aide.
  useEffect(() => {
    if (
      activity === "offer" &&
      (open || held || mode === "follow" || mode === "field" || mode === "rescue")
    ) {
      setActivity("rest");
    }
  }, [open, held, mode, activity]);

  // Pointeur maintenu sur le robot (on le bouge) → il se met debout.
  function handleAvatarPointerDown(e: React.PointerEvent<HTMLButtonElement>): void {
    setHeld(true);
    const release = (): void => {
      setHeld(false);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
    };
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    onAvatarPointerDown(e);
  }

  useEffect(() => {
    if (!open) return;
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, open]);

  // Met à jour le contenu du dernier message assistant (streaming des deltas).
  function appendToLastAssistant(delta: string): void {
    setMessages((prev) => {
      const c = [...prev];
      const last = c[c.length - 1];
      if (last && last.role === "assistant") c[c.length - 1] = { ...last, content: last.content + delta };
      return c;
    });
  }
  function finalizeLastAssistant(nav: NavSuggestion[], prefill?: AssistantPrefill): void {
    setMessages((prev) => {
      const c = [...prev];
      const last = c[c.length - 1];
      if (last && last.role === "assistant") c[c.length - 1] = { ...last, nav, prefill };
      return c;
    });
  }

  /** Tente la réponse en streaming (SSE). Lève si le flux est indisponible
   *  AVANT tout affichage (→ repli non-stream). */
  async function streamReply(convo: ChatMessage[]): Promise<void> {
    const res = await fetch("/api/admin/copilot/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: convo.map((m) => ({ role: m.role, content: m.content })),
        locale: lang,
        screen,
      }),
    });
    if (!res.ok || !res.body) throw new Error("stream-unavailable");

    // Placeholder assistant qui se remplit au fil des deltas.
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";
    let nav: NavSuggestion[] = [];
    let prefill: AssistantPrefill | undefined;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split("\n\n");
      buf = events.pop() ?? "";
      for (const evt of events) {
        const data = evt
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("");
        if (!data) continue;
        try {
          const obj = JSON.parse(data) as {
            delta?: string;
            done?: boolean;
            suggested_navigation?: NavSuggestion[];
            prefill?: AssistantPrefill;
          };
          if (typeof obj.delta === "string") appendToLastAssistant(obj.delta);
          else if (obj.done) {
            nav = obj.suggested_navigation ?? [];
            prefill = obj.prefill;
          }
        } catch {
          /* événement partiel/illisible : ignoré */
        }
      }
    }
    finalizeLastAssistant(nav, prefill);
    cheer();
  }

  /** Repli non-streaming (endpoint /chat classique). */
  async function nonStreamReply(convo: ChatMessage[]): Promise<void> {
    const res = await postJson("/api/admin/copilot/chat", {
      messages: convo.map((m) => ({ role: m.role, content: m.content })),
      locale: lang,
      screen,
    });
    if (!res.ok) throw new Error("chat-failed");
    const body = (await res.json()) as ChatResponse;
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: body.data?.reply ?? "",
        nav: body.data?.suggested_navigation ?? [],
        prefill: body.data?.prefill,
      },
    ]);
    cheer();
  }

  async function send(): Promise<void> {
    const text = draft.trim();
    if (!text || loading) return;
    const convo: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(convo);
    setDraft("");
    setError(false);
    setLoading(true);
    try {
      await streamReply(convo);
    } catch {
      // Flux indisponible → repli non-streaming.
      try {
        await nonStreamReply(convo);
      } catch {
        setError(true);
      }
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
          width: 58,
          height: 62,
          zIndex: 1250,
          pointerEvents: "none",
          willChange: "transform",
        }}
        aria-hidden={false}
      >
        {/* Avatar cliquable : robot (avec bras/jambes, marche en assistance) ou
            ambulance (en cas d'anomalie/bug → accourt vers le problème). */}
        <button
          data-testid="assistant-avatar"
          onPointerDown={handleAvatarPointerDown}
          onClick={() => {
            // Un glisser ne doit pas ouvrir/fermer le chat (clic seul).
            if (consumeDragClick()) return;
            if (open) {
              setOpen(false);
              clearSeq();
              setActivity("rest");
            } else {
              // Mise en scène : se lève, marche au centre, demande, puis ouvre le chat.
              startSummon();
            }
          }}
          aria-label={open ? t.assistant_close : t.assistant_open}
          title={t.assistant_title}
          style={{
            pointerEvents: "auto",
            width: 58,
            height: 62,
            border: "none",
            background: "transparent",
            cursor: "grab",
            position: "relative",
            padding: 0,
            display: "block",
            touchAction: "none",
            WebkitUserSelect: "none",
            userSelect: "none",
            // Pulsation d'échelle au chargement (quelques rebonds puis s'arrête)
            // → aide à repérer le robot. Désactivée une fois le chat ouvert.
            animation: open ? undefined : "sgia-pulse 0.9s ease-in-out 6",
          }}
        >
          {mode === "rescue" ? (
            <AmbulanceFigure />
          ) : (
            <RobotFigure
              pose={
                held
                  ? "stand"
                  : activity === "summon" || activity === "wander"
                    ? "walk"
                    : activity === "search"
                      ? "search"
                      : activity === "found"
                        ? "found"
                        : activity === "ask" || activity === "listen" || activity === "understood"
                          ? "stand"
                          : mode === "follow" || mode === "field"
                            ? "walk"
                            : open
                              ? "stand"
                              : activity === "offer"
                                ? "offer"
                                : "sit"
              }
              showChair={!held && mode !== "follow" && mode !== "field"}
              glow={halo}
              mood={mood}
              pupilLRef={pupilLRef}
              pupilRRef={pupilRRef}
            />
          )}
        </button>

        {/* Bulle d'« activité » : propose l'aide (repos), demande ce qu'on veut
            (mise en scène), accuse réception (« compris »), ou annonce la solution.
            Masquée si une bulle proactive du moteur est déjà là. */}
        {!tip &&
          (activity === "offer" ||
            activity === "found" ||
            activity === "ask" ||
            activity === "understood") &&
          (() => {
            const positive = activity === "found" || activity === "understood";
            const clickable = activity === "offer" || activity === "ask";
            const label =
              activity === "found"
                ? t.assistant_found
                : activity === "understood"
                  ? t.assistant_understood
                  : activity === "ask"
                    ? t.assistant_what_help
                    : t.assistant_need_help;
            return (
              <button
                type="button"
                onClick={() => {
                  if (clickable) setOpen(true);
                }}
                style={{
                  pointerEvents: "auto",
                  position: "absolute",
                  insetInlineEnd: 0,
                  insetBlockEnd: 68,
                  width: "max-content",
                  maxWidth: "min(220px, calc(100vw - 32px))",
                  background: positive ? "var(--gold)" : "var(--bg-paper)",
                  color: positive ? "#1A1610" : "var(--ink)",
                  border: `1px solid ${positive ? "var(--gold)" : "var(--line)"}`,
                  borderRadius: 12,
                  padding: "8px 11px",
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  textAlign: "start",
                  cursor: clickable ? "pointer" : "default",
                  boxShadow: "0 6px 18px rgba(0,0,0,.16)",
                  animation: "sgia-bubble-in .25s ease-out both",
                }}
              >
                {label}
              </button>
            );
          })()}

        {/* Bulle proactive (suit l'avatar : enfant du conteneur translaté) */}
        {tip && (
          <div
            role="status"
            style={{
              pointerEvents: "auto",
              position: "absolute",
              insetInlineEnd: 0,
              ...(tipBelow ? { insetBlockStart: 68 } : { insetBlockEnd: 68 }),
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
                onClick={resetHome}
                title={t.assistant_recenter}
                aria-label={t.assistant_recenter}
                style={{
                  background: "none",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  padding: "3px 8px",
                  fontSize: 13,
                  color: "var(--ink-4)",
                  cursor: "pointer",
                }}
              >
                ↺
              </button>
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
                {m.role === "assistant" && m.prefill && (
                  <button
                    onClick={() => {
                      onPrefill?.(m.prefill!);
                      onNavigate?.(m.prefill!.screen);
                      setOpen(false);
                    }}
                    style={{
                      alignSelf: "flex-start",
                      marginInlineEnd: "auto",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "7px 13px",
                      border: "none",
                      borderRadius: 999,
                      background: "var(--gold)",
                      color: "#1A1610",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    ✨ {t.assistant_prefill}
                  </button>
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

/** Robot complet (tête + visière yeux suiveurs, corps, bras, jambes). En
 *  assistance (`walking`), bras et jambes balancent → effet « il marche ». */
type RobotPose = "sit" | "offer" | "stand" | "walk" | "search" | "found";

function RobotFigure({
  pose,
  showChair,
  glow,
  mood,
  pupilLRef,
  pupilRRef,
}: {
  pose: RobotPose;
  showChair: boolean;
  glow: string;
  mood: "neutral" | "happy";
  pupilLRef: React.RefObject<HTMLSpanElement | null>;
  pupilRRef: React.RefObject<HTMLSpanElement | null>;
}): React.ReactNode {
  // Allure : assis (chaise) · réfléchit (assis + tête qui penche) · debout ·
  // marche · recherche (marche + va-et-vient 3 pas D / 4 pas G) · trouvé (bras levé).
  const poseClass =
    pose === "sit"
      ? "sgia-sit"
      : pose === "offer"
        ? "sgia-sit sgia-think"
        : pose === "walk"
          ? "sgia-walk"
          : pose === "search"
            ? "sgia-walk sgia-search"
            : pose === "found"
              ? "sgia-found"
              : ""; // stand
  return (
    <span className={`sgia-robot ${poseClass}`}>
      {showChair && <span className="sgia-chair" aria-hidden />}
      <span className="sgia-shadow" />
      <span className="sgia-leg sgia-leg-l" />
      <span className="sgia-leg sgia-leg-r" />
      <span className="sgia-arm sgia-arm-l" />
      <span className="sgia-arm sgia-arm-r" />
      <span className="sgia-body" style={{ boxShadow: `0 0 10px ${glow}` }} />
      {/* Emblème de marque (symbole seul, recadré) → « Infinity vous assiste ». */}
      <span className="sgia-emblem" title="Infinity" aria-label="Infinity" />
      <span className="sgia-head">
        <span className="sgia-antenna" />
        <span className="sgia-antenna-dot" />
        <span className="sgia-visor">
          <span className="sgia-eye">
            <span ref={pupilLRef} className="sgia-pupil" />
          </span>
          <span className="sgia-eye">
            <span ref={pupilRRef} className="sgia-pupil" />
          </span>
        </span>
        {/* Bouche : sourit après une réponse réussie (mood happy). */}
        <span className={`sgia-mouth${mood === "happy" ? " sgia-smile" : ""}`} />
      </span>
    </span>
  );
}

/** Ambulance : le robot se transforme pour foncer vers l'anomalie. Gyrophare
 *  clignotant rouge↔bleu, roues qui tournent, croix médicale. */
function AmbulanceFigure(): React.ReactNode {
  return (
    <span className="sgia-amb">
      <span className="sgia-shadow" />
      <span className="sgia-amb-body">
        <span className="sgia-amb-window" />
        <span className="sgia-amb-cross" />
      </span>
      <span className="sgia-amb-light" />
      <span className="sgia-wheel sgia-wheel-l" />
      <span className="sgia-wheel sgia-wheel-r" />
    </span>
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

// Keyframes : robot (respiration/bob, clignement, marche bras+jambes) et
// ambulance (gyrophare, roues, conduite). Désactivés si mouvement réduit.
const ASSISTANT_CSS = `
.sgia-robot, .sgia-amb { position: relative; display: block; width: 58px; height: 62px; }
.sgia-robot { animation: sgia-bob 3s ease-in-out infinite; }
.sgia-shadow {
  position: absolute; inset-block-end: 0; inset-inline-start: 15px;
  width: 28px; height: 6px; border-radius: 999px; background: rgba(0,0,0,.18);
}
.sgia-body { position: absolute; inset-block-start: 26px; inset-inline-start: 15px; width: 28px; height: 20px; border-radius: 9px; background: var(--gold); }
.sgia-emblem {
  position: absolute; inset-block-start: 29px; inset-inline-start: 20px; width: 18px; height: 14px;
  border-radius: 4px; background-color: #fff; overflow: hidden; box-shadow: inset 0 0 0 1px rgba(0,0,0,.08);
  background-image: url(/logo-hp-holding.png); background-repeat: no-repeat;
  background-size: 150% auto; background-position: 24% 14%;  /* mark seul, sans 'HOLDING' */
}
.sgia-mouth {
  position: absolute; inset-block-start: 18px; inset-inline-start: 13px; width: 6px; height: 2px;
  border-radius: 2px; background: rgba(26,22,16,.85);
}
.sgia-smile {
  inset-inline-start: 12px; width: 8px; height: 4px; background: transparent;
  border: 1.6px solid rgba(26,22,16,.85); border-top: none; border-radius: 0 0 8px 8px;
}
.sgia-head { position: absolute; inset-block-start: 4px; inset-inline-start: 13px; width: 32px; height: 24px; border-radius: 9px; background: var(--gold); }
.sgia-visor { position: absolute; inset-block-start: 7px; inset-inline-start: 4px; width: 24px; height: 11px; border-radius: 6px; background: #1A1610; display: flex; align-items: center; justify-content: center; gap: 5px; }
.sgia-antenna { position: absolute; inset-block-start: -7px; inset-inline-start: 15px; width: 2px; height: 7px; background: #1A1610; border-radius: 2px; }
.sgia-antenna-dot { position: absolute; inset-block-start: -11px; inset-inline-start: 12px; width: 6px; height: 6px; border-radius: 999px; background: var(--emerald); animation: sgia-pulse 2s ease-in-out infinite; }
.sgia-arm { position: absolute; inset-block-start: 27px; width: 5px; height: 15px; border-radius: 3px; background: var(--gold); transform-origin: top center; }
.sgia-arm-l { inset-inline-start: 9px; }
.sgia-arm-r { inset-inline-end: 9px; }
.sgia-leg { position: absolute; inset-block-start: 44px; width: 6px; height: 14px; border-radius: 3px; background: #c8a45c; transform-origin: top center; }
.sgia-leg-l { inset-inline-start: 19px; }
.sgia-leg-r { inset-inline-end: 19px; }
.sgia-eye {
  position: relative; width: 9px; height: 9px; border-radius: 999px;
  background: #fff; display: inline-flex; align-items: center; justify-content: center;
  animation: sgia-blink 4.6s infinite;
}
.sgia-pupil { width: 4px; height: 4px; border-radius: 999px; background: #1A1610; display: block; }
/* Marche : balancement opposé bras/jambes + léger rebond */
.sgia-walk { animation: sgia-walkbob .5s ease-in-out infinite; }
.sgia-walk .sgia-arm-l, .sgia-walk .sgia-leg-r { animation: sgia-swingA .5s ease-in-out infinite; }
.sgia-walk .sgia-arm-r, .sgia-walk .sgia-leg-l { animation: sgia-swingB .5s ease-in-out infinite; }
/* Ambulance */
.sgia-amb { animation: sgia-drive .35s ease-in-out infinite; }
.sgia-amb-body { position: absolute; inset-block-start: 16px; inset-inline-start: 4px; width: 50px; height: 28px; border-radius: 8px; background: #fff; border: 1px solid var(--line, #d9cdb6); box-shadow: 0 0 12px rgba(214,69,93,.6); }
.sgia-amb-window { position: absolute; inset-block-start: 22px; inset-inline-start: 8px; width: 12px; height: 10px; border-radius: 3px; background: #1A1610; opacity: .8; }
.sgia-amb-cross {
  position: absolute; inset-block-start: 24px; inset-inline-end: 9px; width: 14px; height: 14px;
  background:
    linear-gradient(var(--rose,#d6455d),var(--rose,#d6455d)) center/14px 5px no-repeat,
    linear-gradient(var(--rose,#d6455d),var(--rose,#d6455d)) center/5px 14px no-repeat;
}
.sgia-amb-light { position: absolute; inset-block-start: 9px; inset-inline-start: 21px; width: 16px; height: 7px; border-radius: 3px; background: var(--rose,#d6455d); animation: sgia-siren .5s steps(1) infinite; }
.sgia-wheel { position: absolute; inset-block-end: 4px; width: 13px; height: 13px; border-radius: 999px; background: #1A1610; border: 2px solid #5a5246; animation: sgia-roll .4s linear infinite; }
.sgia-wheel-l { inset-inline-start: 10px; }
.sgia-wheel-r { inset-inline-end: 10px; }
@keyframes sgia-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@keyframes sgia-walkbob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
@keyframes sgia-swingA { 0%,100% { transform: rotate(17deg); } 50% { transform: rotate(-17deg); } }
@keyframes sgia-swingB { 0%,100% { transform: rotate(-17deg); } 50% { transform: rotate(17deg); } }
@keyframes sgia-blink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.1); } }
@keyframes sgia-pulse { 0%,100% { opacity: .55; transform: scale(1); } 50% { opacity: 1; transform: scale(1.18); } }
@keyframes sgia-drive { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1.5px); } }
@keyframes sgia-roll { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes sgia-siren { 0% { background: var(--rose,#d6455d); } 50% { background: #3b6fd6; } }
/* ── États « vivants » : chaise, assise, réflexion, recherche (va-et-vient), trouvé ── */
/* Chaise/tabouret : reste à son coin (sa « maison ») ; le robot la quitte puis y revient. */
.sgia-chair { position: absolute; inset-block-end: 1px; inset-inline-start: 13px; width: 32px; height: 12px; pointer-events: none; }
.sgia-chair::before { content: ""; position: absolute; inset-block-start: 0; inset-inline-start: 0; width: 32px; height: 4px; border-radius: 2px; background: #6c6457; }
.sgia-chair::after { content: ""; position: absolute; inset-block-start: 4px; inset-inline-start: 3px; width: 3px; height: 8px; border-radius: 0 0 1px 1px; background: #544e42; box-shadow: 23px 0 0 0 #544e42; }
/* Assis : descend sur l'assise, jambes repliées vers l'avant, respiration douce. */
.sgia-sit { animation: sgia-breathe 4s ease-in-out infinite; }
.sgia-sit .sgia-leg { height: 9px; inset-block-start: 47px; transform: rotate(72deg); }
.sgia-sit .sgia-arm { inset-block-start: 30px; }
/* Réfléchit (repos prolongé) : la tête penche, pensif. */
.sgia-think .sgia-head { animation: sgia-ponder 1.8s ease-in-out infinite; transform-origin: bottom center; }
/* Recherche : marche sur place + va-et-vient (3 pas droite, 4 pas gauche) puis revient.
   La propriété translate (indépendante de transform) compose avec le rebond de marche. */
.sgia-search { animation: sgia-pace 2.8s ease-in-out infinite, sgia-walkbob .5s ease-in-out infinite; }
/* Trouvé : petit saut + bras droit levé qui salue. */
.sgia-found { animation: sgia-jump .55s ease-in-out 2; }
.sgia-found .sgia-arm-r { animation: sgia-wave .4s ease-in-out 4; }
@keyframes sgia-breathe { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
@keyframes sgia-ponder { 0%,100% { transform: rotate(0); } 50% { transform: rotate(-7deg); } }
@keyframes sgia-jump { 0%,100% { transform: translateY(0); } 35% { transform: translateY(-7px); } 70% { transform: translateY(-2px); } }
@keyframes sgia-wave { 0%,100% { transform: rotate(-150deg); } 50% { transform: rotate(-115deg); } }
@keyframes sgia-pace {
  0% { translate: 0; }
  11% { translate: 8px; } 22% { translate: 16px; } 33% { translate: 24px; }  /* 3 pas → droite */
  39% { translate: 24px; }                                                   /* demi-tour */
  50% { translate: 16px; } 61% { translate: 8px; } 72% { translate: 0; } 83% { translate: -8px; }  /* 4 pas ← gauche */
  89% { translate: -8px; }                                                   /* demi-tour */
  100% { translate: 0; }                                                     /* retour à la chaise */
}
@keyframes sgia-bubble-in { from { opacity: 0; transform: translateY(4px) scale(.96); } to { opacity: 1; transform: none; } }
/* Responsive : robot + chaise + accessoires réduits sur petits écrans
   (scale indépendant de transform — compose avec les animations). */
@media (max-width: 600px) { .sgia-robot, .sgia-amb { scale: .82; } }
@media (max-width: 380px) { .sgia-robot, .sgia-amb { scale: .72; } }
@media (prefers-reduced-motion: reduce) {
  .sgia-robot, .sgia-amb, .sgia-eye, .sgia-antenna-dot, .sgia-walk .sgia-arm-l, .sgia-walk .sgia-arm-r,
  .sgia-walk .sgia-leg-l, .sgia-walk .sgia-leg-r, .sgia-amb-light, .sgia-wheel,
  .sgia-sit, .sgia-think .sgia-head, .sgia-search, .sgia-found, .sgia-found .sgia-arm-r { animation: none !important; }
  .sgia-search { translate: none !important; }
}
`;
