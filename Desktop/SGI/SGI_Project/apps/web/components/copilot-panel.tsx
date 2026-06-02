"use client";

import React, { useEffect, useRef, useState } from "react";

import { useT, useLang } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { postJson } from "@/lib/api-client";

// Panneau « AI Copilot » réutilisable (inbox + tickets). Câblé sur le module
// AI Copilot via le proxy :
//   POST /api/admin/copilot/assist  body { context_type, context_id, locale? }
// Mode SYNCHRONE (MVP) : un appel → réponse directe affichée (pas de push WS).
// CSS strictement logique (Loi 3 RTL) ; chiffres latins.

type Sentiment = "positive" | "neutral" | "negative";
type Intent = "buy" | "rent" | "complaint" | "visit" | "payment" | "info";
type NextBestAction =
  | "schedule_visit"
  | "send_listing"
  | "escalate"
  | "request_payment"
  | "share_info"
  | "follow_up";

type CopilotSuggestion = {
  context_type: "inbox" | "ticket";
  context_id: string;
  channel: string;
  summary: string;
  suggested_reply: string;
  sentiment: Sentiment | string;
  intent: Intent | string;
  next_best_actions: (NextBestAction | string)[];
  engine: string;
};

export type CopilotPanelProps = {
  contextType: "inbox" | "ticket";
  contextId: string;
  /** Injecte le brouillon de réponse dans la zone de composition de l'écran hôte.
   *  Si absent, le bouton « Insérer » copie le texte dans le presse-papier. */
  onInsertReply?: (text: string) => void;
};

const sentimentLabel = (t: Translations, s: string): string =>
  (
    {
      positive: t.copilot_sentiment_positive,
      neutral: t.copilot_sentiment_neutral,
      negative: t.copilot_sentiment_negative,
    } as Record<string, string>
  )[s] ?? s;

const sentimentColor = (s: string): string =>
  (
    {
      positive: "var(--emerald, #2f9e6e)",
      neutral: "var(--ink-4)",
      negative: "var(--rose, #d6455d)",
    } as Record<string, string>
  )[s] ?? "var(--ink-4)";

const intentLabel = (t: Translations, i: string): string =>
  (
    {
      buy: t.copilot_intent_buy,
      rent: t.copilot_intent_rent,
      complaint: t.copilot_intent_complaint,
      visit: t.copilot_intent_visit,
      payment: t.copilot_intent_payment,
      info: t.copilot_intent_info,
    } as Record<string, string>
  )[i] ?? i;

const actionLabel = (t: Translations, a: string): string =>
  (
    {
      schedule_visit: t.copilot_action_schedule_visit,
      send_listing: t.copilot_action_send_listing,
      escalate: t.copilot_action_escalate,
      request_payment: t.copilot_action_request_payment,
      share_info: t.copilot_action_share_info,
      follow_up: t.copilot_action_follow_up,
    } as Record<string, string>
  )[a] ?? a;

const IcSparkle = (): React.ReactNode => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6z" />
    <path d="M19 14l.7 2.1L22 17l-2.3.9L19 20l-.7-2.1L16 17l2.3-.9z" />
  </svg>
);

export function CopilotPanel({
  contextType,
  contextId,
  onInsertReply,
}: CopilotPanelProps): React.ReactNode {
  const t = useT();
  const { lang } = useLang();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [result, setResult] = useState<CopilotSuggestion | null>(null);
  const [inserted, setInserted] = useState(false);

  // Compteur de requête : invalide toute réponse en vol quand le contexte change
  // ou qu'un nouvel appel démarre (évite d'afficher/insérer la suggestion d'un
  // autre fil — fuite de contenu inter-conversations).
  const reqRef = useRef(0);

  // Changement de contexte (autre conversation / ticket) → on repart à blanc et
  // on invalide la requête éventuellement en cours.
  useEffect(() => {
    reqRef.current += 1;
    setResult(null);
    setError(false);
    setInserted(false);
    setLoading(false);
  }, [contextId]);

  async function assist(): Promise<void> {
    const reqId = (reqRef.current += 1);
    setLoading(true);
    setError(false);
    setInserted(false);
    try {
      const res = await postJson("/api/admin/copilot/assist", {
        context_type: contextType,
        context_id: contextId,
        locale: lang,
      });
      if (reqId !== reqRef.current) return; // réponse obsolète (contexte changé)
      if (!res.ok) {
        setError(true);
        setResult(null);
        return;
      }
      const body = (await res.json()) as { data?: CopilotSuggestion };
      if (reqId !== reqRef.current) return;
      setResult(body.data ?? null);
    } catch {
      if (reqId === reqRef.current) {
        setError(true);
        setResult(null);
      }
    } finally {
      if (reqId === reqRef.current) setLoading(false);
    }
  }

  function insert(text: string): void {
    if (onInsertReply) {
      onInsertReply(text);
    } else if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(text).catch(() => {
        /* presse-papier indisponible : silencieux */
      });
    }
    setInserted(true);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ color: "var(--gold)", display: "inline-flex" }}>
          <IcSparkle />
        </span>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.copilot_assist}</span>
        <button
          onClick={() => void assist()}
          disabled={loading}
          style={{
            marginInlineStart: "auto",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "6px 12px",
            border: "none",
            borderRadius: 999,
            background: "var(--gold)",
            color: "#1A1610",
            fontSize: 12,
            fontWeight: 600,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "…" : (<><IcSparkle /> {t.copilot_assist}</>)}
        </button>
      </div>

      {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>{t.copilot_error}</div>}

      {result && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Badges sentiment + intention */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{t.copilot_sentiment} :</span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "#fff",
                background: sentimentColor(result.sentiment),
                borderRadius: 999,
                padding: "2px 9px",
              }}
            >
              {sentimentLabel(t, result.sentiment)}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-4)", marginInlineStart: 4 }}>
              {t.copilot_intent} :
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "var(--ink)",
                background: "var(--gold-ghost)",
                border: "1px solid var(--gold)",
                borderRadius: 999,
                padding: "2px 9px",
              }}
            >
              {intentLabel(t, result.intent)}
            </span>
          </div>

          {/* Résumé */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.copilot_summary}</span>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink)",
                whiteSpace: "pre-wrap",
                background: "var(--bg-cream)",
                border: "1px solid var(--line-soft)",
                borderRadius: 8,
                padding: "8px 10px",
                textAlign: "start",
              }}
            >
              {result.summary}
            </div>
          </div>

          {/* Brouillon de réponse */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.copilot_reply}</span>
            <div
              style={{
                fontSize: 12.5,
                color: "var(--ink)",
                whiteSpace: "pre-wrap",
                background: "var(--bg-cream)",
                border: "1px solid var(--line-soft)",
                borderRadius: 8,
                padding: "8px 10px",
                textAlign: "start",
              }}
            >
              {result.suggested_reply}
            </div>
            <button
              onClick={() => insert(result.suggested_reply)}
              style={{
                alignSelf: "flex-start",
                padding: "6px 14px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--bg-cream)",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--ink)",
                cursor: "pointer",
              }}
            >
              {inserted ? t.copilot_inserted : t.copilot_insert}
            </button>
          </div>

          {/* Actions suggérées */}
          {result.next_best_actions.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)" }}>{t.copilot_nba}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {result.next_best_actions.map((a) => (
                  <span
                    key={a}
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--ink)",
                      background: "var(--line-soft)",
                      borderRadius: 999,
                      padding: "3px 10px",
                    }}
                  >
                    {actionLabel(t, a)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Moteur (provenance localisée : IA vs repli heuristique) */}
          <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
            {t.copilot_engine} :{" "}
            {result.engine === "fallback" ? t.copilot_engine_fallback : t.copilot_engine_ai}
          </div>
        </div>
      )}
    </div>
  );
}
