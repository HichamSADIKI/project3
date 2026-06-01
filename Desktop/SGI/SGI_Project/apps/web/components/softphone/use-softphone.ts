"use client";

/**
 * Hook React qui pilote le softphone : instancie le SipClient, ouvre la
 * WebSocket Téléphonie (events serveur call.ringing/answered/ended), et lance
 * le screen pop (lookup client) sur appel entrant.
 *
 * Multi-tenant (Loi 1) : tous les appels HTTP passent par les route handlers
 * `/api/admin/telephony/**` qui injectent le JWT (company_id) côté serveur. La WS
 * est scopée tenant + extension côté backend.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import { getJson } from "@/lib/api-client";
import {
  SipClient,
  type SipCallSnapshot,
  type SipConnectConfig,
  type SipRegistrationState,
} from "@/lib/sip-client";

export interface ScreenPopMatch {
  client_id: string;
  display_name: string;
  phone: string | null;
  type: string;
}

interface AgentState {
  extension: string | null;
  status: string;
}

/** Base WS backend : NEXT_PUBLIC_WS_URL sinon même origine (nginx proxifie /api/v1). */
function wsVoiceUrl(token: string, extension: string): string {
  const base =
    process.env.NEXT_PUBLIC_WS_URL ??
    `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}`;
  const q = new URLSearchParams({ token, extension });
  return `${base.replace(/\/$/, "")}/api/v1/telephony/ws?${q.toString()}`;
}

export interface SoftphoneController {
  registration: SipRegistrationState;
  registrationReason: string | null;
  call: SipCallSnapshot | null;
  screenPop: ScreenPopMatch[] | null;
  screenPopLoading: boolean;
  serverLive: boolean;
  extension: string | null;
  /** Connecte le softphone (extension + secret saisis par l'agent). */
  connect: (config: SipConnectConfig) => Promise<void>;
  disconnect: () => Promise<void>;
  dial: (target: string) => void;
  answer: () => void;
  hangup: () => void;
  toggleMute: () => void;
  toggleHold: () => void;
  sendDtmf: (tone: string) => void;
  dismissScreenPop: () => void;
}

export function useSoftphone(): SoftphoneController {
  const [registration, setRegistration] = useState<SipRegistrationState>("disconnected");
  const [registrationReason, setRegistrationReason] = useState<string | null>(null);
  const [call, setCall] = useState<SipCallSnapshot | null>(null);
  const [screenPop, setScreenPop] = useState<ScreenPopMatch[] | null>(null);
  const [screenPopLoading, setScreenPopLoading] = useState(false);
  const [serverLive, setServerLive] = useState(false);
  const [extension, setExtension] = useState<string | null>(null);

  const clientRef = useRef<SipClient | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Élément <audio> caché pour le flux distant (créé une fois).
  useEffect(() => {
    const el = document.createElement("audio");
    el.autoplay = true;
    el.hidden = true;
    document.body.appendChild(el);
    audioRef.current = el;
    return () => {
      el.remove();
      audioRef.current = null;
    };
  }, []);

  // Screen pop : résout les fiches clients d'un numéro entrant.
  const runScreenPop = useCallback((phone: string) => {
    if (!phone || phone === "inconnu") return;
    setScreenPopLoading(true);
    setScreenPop(null);
    getJson<{ data: ScreenPopMatch[] }>(
      `/api/admin/telephony/lookup?phone=${encodeURIComponent(phone)}`,
    )
      .then((r) => setScreenPop(r.data ?? []))
      .catch(() => setScreenPop([]))
      .finally(() => setScreenPopLoading(false));
  }, []);

  // Ouvre la WS serveur (events d'appel temps réel : doublons le SIP, sert de
  // source pour le screen pop côté serveur — qui peut porter les matches).
  const openServerWs = useCallback(
    async (ext: string) => {
      try {
        const { token } = await getJson<{ token: string }>(
          "/api/admin/telephony/ws-token",
        );
        if (!token) return;
        const ws = new WebSocket(wsVoiceUrl(token, ext));
        wsRef.current = ws;
        ws.onopen = () => setServerLive(true);
        ws.onclose = () => setServerLive(false);
        ws.onerror = () => setServerLive(false);
        ws.onmessage = (ev) => {
          try {
            const evt = JSON.parse(ev.data) as {
              type: string;
              data?: { from?: string; phone?: string };
            };
            if (evt.type === "call.ringing") {
              const num = evt.data?.from ?? evt.data?.phone;
              if (num) runScreenPop(num);
            }
          } catch {
            /* ping/pong & frames non-JSON ignorés */
          }
        };
      } catch {
        setServerLive(false);
      }
    },
    [runScreenPop],
  );

  const connect = useCallback(
    async (config: SipConnectConfig) => {
      setRegistrationReason(null);
      const client = new SipClient(
        {
          onRegistrationState: (state, reason) => {
            setRegistration(state);
            setRegistrationReason(reason ?? null);
          },
          onCallState: (snap) => setCall(snap),
          onIncoming: (remote) => runScreenPop(remote),
        },
        audioRef.current,
      );
      clientRef.current = client;
      setExtension(config.extension);
      await client.connect(config);
      void openServerWs(config.extension);
    },
    [runScreenPop, openServerWs],
  );

  const disconnect = useCallback(async () => {
    if (wsRef.current) {
      wsRef.current.onmessage = null;
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
    setServerLive(false);
    await clientRef.current?.disconnect();
    clientRef.current = null;
    setExtension(null);
    setCall(null);
    setScreenPop(null);
  }, []);

  // Nettoyage au démontage.
  useEffect(() => {
    return () => {
      void clientRef.current?.disconnect();
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const dial = useCallback((target: string) => clientRef.current?.call(target), []);
  const answer = useCallback(() => clientRef.current?.answer(), []);
  const hangup = useCallback(() => clientRef.current?.hangup(), []);
  const toggleMute = useCallback(() => clientRef.current?.toggleMute(), []);
  const toggleHold = useCallback(() => clientRef.current?.toggleHold(), []);
  const sendDtmf = useCallback((tone: string) => clientRef.current?.sendDtmf(tone), []);
  const dismissScreenPop = useCallback(() => setScreenPop(null), []);

  return {
    registration,
    registrationReason,
    call,
    screenPop,
    screenPopLoading,
    serverLive,
    extension,
    connect,
    disconnect,
    dial,
    answer,
    hangup,
    toggleMute,
    toggleHold,
    sendDtmf,
    dismissScreenPop,
  };
}

/** Récupère l'extension pré-enregistrée de l'agent (agent_state), si présente. */
export async function fetchMyExtension(): Promise<AgentState | null> {
  try {
    const r = await getJson<{ data: AgentState }>("/api/admin/telephony/agents/me");
    return r.data ?? null;
  } catch {
    return null;
  }
}
