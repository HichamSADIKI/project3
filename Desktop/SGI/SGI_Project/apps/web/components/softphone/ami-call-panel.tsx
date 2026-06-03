"use client";

/**
 * Panneau « Mode AMI » (Asterisk 11 / chan_sip, sans softphone WebRTC).
 *
 * L'agent parle sur son téléphone/softphone physique enregistré comme une
 * extension (ex. 1012) ; SGI pilote et trace via l'AMI :
 *  - déclare l'extension + présence : POST /telephony/agents/me/status ;
 *  - ouvre la WebSocket d'événements (/telephony/ws) → screen-pop entrant ;
 *  - click-to-call : POST /telephony/calls/click-to-call {to_number, agent_extension} ;
 *  - journal d'appels : GET /telephony/calls.
 *
 * Volontairement INDÉPENDANT du softphone WebRTC (use-softphone / dock) : le
 * bouton « Appeler » n'est PAS conditionné à une registration JsSIP — il suffit
 * d'être connecté en mode AMI. CSS logique (RTL), chiffres latins (UAE).
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

import { IcPhone } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { getJson, postJson } from "@/lib/api-client";
import { useApiList } from "@/lib/use-api-list";

interface CallRow {
  id: string;
  reference: string;
  direction: string;
  status: string;
  from_number: string | null;
  to_number: string | null;
  duration_seconds: number | null;
  created_at: string;
}

interface LookupMatch {
  client_id: string;
  display_name: string;
  phone: string | null;
  type: string;
}

interface VoiceEvent {
  type?: string;
  data?: { caller_number?: string | null };
}

/** Base WS backend : NEXT_PUBLIC_WS_URL sinon même origine (nginx proxifie /api/v1). */
function wsVoiceUrl(token: string, extension: string): string {
  const fallback =
    typeof window !== "undefined"
      ? window.location.origin.replace(/^http/, "ws")
      : "";
  const base = process.env.NEXT_PUBLIC_WS_URL ?? fallback;
  const q = new URLSearchParams({ token, extension });
  return `${base.replace(/\/$/, "")}/api/v1/telephony/ws?${q.toString()}`;
}

function fmtDuration(s: number | null): string {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function AmiCallPanel(): React.ReactNode {
  const t = useT();
  const [extension, setExtension] = useState("1012");
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connError, setConnError] = useState(false);
  const [screenPop, setScreenPop] = useState<LookupMatch[] | null>(null);
  const [target, setTarget] = useState("");
  const [dialing, setDialing] = useState(false);
  const [dialError, setDialError] = useState<"none" | "failed" | "offline">("none");

  const { items: calls, loading, error, reload } = useApiList<CallRow>(
    "/api/admin/telephony/calls?limit=50",
  );
  const wsRef = useRef<WebSocket | null>(null);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  const runScreenPop = useCallback((phone: string | null | undefined) => {
    if (!phone) return;
    getJson<{ data: LookupMatch[] }>(
      `/api/admin/telephony/lookup?phone=${encodeURIComponent(phone)}`,
    )
      .then((r) => setScreenPop(r.data ?? []))
      .catch(() => setScreenPop([]));
  }, []);

  // Ferme proprement la WS au démontage.
  useEffect(() => {
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  async function connect(): Promise<void> {
    const ext = extension.trim();
    if (!ext) return;
    setConnecting(true);
    setConnError(false);
    try {
      // 1) Déclare l'extension + présence (anti-spoof WS côté backend).
      const res = await postJson("/api/admin/telephony/agents/me/status", {
        status: "available",
        extension: ext,
      });
      if (!res.ok) {
        setConnError(true);
        return;
      }
      // 2) Ouvre la WebSocket d'événements d'appel pour cette extension.
      const { token } = await getJson<{ token: string }>("/api/admin/telephony/ws-token");
      const ws = new WebSocket(wsVoiceUrl(token, ext));
      ws.onopen = () => setConnected(true);
      ws.onclose = () => setConnected(false);
      ws.onmessage = (e: MessageEvent) => {
        try {
          const evt = JSON.parse(e.data as string) as VoiceEvent;
          if (evt.type === "call.ringing") runScreenPop(evt.data?.caller_number);
          if (evt.type === "call.ended") {
            window.setTimeout(() => setScreenPop(null), 4000);
          }
          reloadRef.current();
        } catch {
          /* frames ping/pong ou non-JSON ignorées */
        }
      };
      wsRef.current = ws;
    } catch {
      setConnError(true);
    } finally {
      setConnecting(false);
    }
  }

  function disconnect(): void {
    wsRef.current?.close();
    wsRef.current = null;
    setConnected(false);
    setScreenPop(null);
  }

  async function clickToCall(): Promise<void> {
    const num = target.trim();
    if (!num) return;
    setDialing(true);
    setDialError("none");
    try {
      const res = await postJson("/api/admin/telephony/calls/click-to-call", {
        to_number: num,
        agent_extension: extension.trim(),
      });
      if (!res.ok) {
        setDialError(res.status === 503 ? "offline" : "failed");
        return;
      }
      setTarget("");
      reload();
    } catch {
      setDialError("failed");
    } finally {
      setDialing(false);
    }
  }

  const dirLabel: Record<string, string> = {
    inbound: t.tel_inbound,
    outbound: t.tel_outbound,
    internal: t.tel_internal,
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        overflowY: "auto",
        background: "var(--bg-cream)",
      }}
    >
      {/* Barre : connexion mode AMI + click-to-call */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 12,
          padding: "14px 26px",
          borderBottom: "1px solid var(--line-soft)",
          background: "var(--bg-paper)",
        }}
      >
        <label style={{ fontSize: 12, color: "var(--ink-4)" }}>{t.tel_ami_ext_label}</label>
        <input
          value={extension}
          onChange={(e) => setExtension(e.target.value)}
          disabled={connected}
          inputMode="numeric"
          style={{
            padding: "7px 10px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: connected ? "var(--line-soft)" : "var(--bg-cream)",
            fontSize: 13,
            color: "var(--ink)",
            width: 90,
            direction: "ltr",
          }}
        />
        {connected ? (
          <button
            onClick={disconnect}
            style={{
              padding: "7px 14px",
              border: "1px solid var(--line)",
              borderRadius: 999,
              background: "var(--bg-cream)",
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            {t.tel_ami_disconnect}
          </button>
        ) : (
          <button
            onClick={() => void connect()}
            disabled={connecting || !extension.trim()}
            style={{
              padding: "7px 14px",
              border: "none",
              borderRadius: 999,
              background: "var(--gold)",
              fontSize: 12,
              fontWeight: 600,
              color: "#1A1610",
              cursor: connecting ? "default" : "pointer",
              opacity: connecting ? 0.6 : 1,
            }}
          >
            {connecting ? "…" : t.tel_ami_connect}
          </button>
        )}
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: connected ? "var(--emerald)" : "var(--ink-4)",
          }}
        >
          {connected ? t.tel_ami_connected : t.tel_ami_disconnected}
        </span>

        <div style={{ display: "flex", gap: 8, marginInlineStart: "auto" }}>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void clickToCall();
            }}
            placeholder={t.tel_dial_ph}
            inputMode="tel"
            style={{
              padding: "8px 12px",
              border: "1px solid var(--line)",
              borderRadius: 999,
              background: "var(--bg-cream)",
              fontSize: 13,
              color: "var(--ink)",
              direction: "ltr",
              width: 180,
            }}
          />
          <button
            onClick={() => void clickToCall()}
            disabled={dialing || !target.trim() || !connected}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              background: "var(--emerald)",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              cursor: dialing || !connected ? "default" : "pointer",
              opacity: dialing || !connected ? 0.6 : 1,
            }}
          >
            <IcPhone />
            {t.tel_dial}
          </button>
        </div>
      </div>

      {/* Aide + erreurs */}
      <div style={{ padding: "8px 26px 0", fontSize: 11.5, color: "var(--ink-4)" }}>
        {t.tel_ami_hint}
      </div>
      {connError && (
        <div style={{ padding: "4px 26px", color: "var(--rose)", fontSize: 12 }}>
          {t.tel_ami_connect_failed}
        </div>
      )}
      {dialError !== "none" && (
        <div style={{ padding: "4px 26px", color: "var(--rose)", fontSize: 12 }}>
          {dialError === "offline" ? t.tel_ami_offline : t.tel_dial_failed}
        </div>
      )}

      {/* Screen-pop appel entrant */}
      {screenPop && (
        <div style={{ padding: "10px 26px" }}>
          <div
            style={{
              border: "1px solid var(--gold)",
              background: "var(--gold-ghost)",
              borderRadius: 10,
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)" }}>
              {t.tel_ami_incoming}
            </div>
            {screenPop.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--ink)" }}>{t.tel_ami_unknown_caller}</div>
            ) : (
              screenPop.map((m) => (
                <div key={m.client_id} style={{ fontSize: 13, color: "var(--ink)" }}>
                  👤 {m.display_name}
                  {m.phone ? <span style={{ direction: "ltr" }}> · {m.phone}</span> : null}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Journal d'appels */}
      <div style={{ padding: "10px 26px 26px" }}>
        {loading && <div style={{ fontSize: 12, color: "var(--ink-4)" }}>…</div>}
        {error && <div style={{ fontSize: 12, color: "var(--rose)" }}>{t.error_label}</div>}
        {!loading && calls.length === 0 && (
          <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{t.tel_ami_no_calls}</div>
        )}
        {calls.map((c) => (
          <div
            key={c.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "9px 0",
              borderBottom: "1px solid var(--line-soft)",
              fontSize: 13,
              color: "var(--ink)",
            }}
          >
            <span style={{ fontSize: 11, color: "var(--ink-4)", width: 90 }}>
              {dirLabel[c.direction] ?? c.direction}
            </span>
            <span style={{ direction: "ltr", flex: 1, minWidth: 0 }}>
              {c.direction === "outbound" ? c.to_number : c.from_number}
            </span>
            <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{c.status}</span>
            <span style={{ fontSize: 11, color: "var(--ink-4)", width: 48, textAlign: "end" }}>
              {fmtDuration(c.duration_seconds)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
