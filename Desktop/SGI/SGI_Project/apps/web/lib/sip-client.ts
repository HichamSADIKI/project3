"use client";

/**
 * Client SIP / WebRTC (softphone) basé sur JsSIP.
 *
 * Se connecte au WSS Asterisk (NEXT_PUBLIC_SIP_WS_URL, ex. wss://localhost:8089/ws),
 * s'enregistre avec l'extension + le secret de l'agent, et gère un appel à la fois
 * (entrant ou sortant) : mute, hold, raccrocher, DTMF.
 *
 * ⚠️ Sécurité : le secret SIP n'est JAMAIS codé en dur ni persisté. Il est fourni
 * par l'agent au moment de la connexion (formulaire du dock) et reste en mémoire
 * le temps de la session de l'onglet. Le backend n'émet pas ces credentials.
 *
 * JsSIP est chargé dynamiquement (import() côté navigateur) pour ne pas alourdir
 * le bundle initial des Server Components et rester compatible SSR.
 */

// ── Types publics du softphone ─────────────────────────────────────────────

export type SipRegistrationState =
  | "disconnected"
  | "connecting"
  | "registered"
  | "registration_failed";

export type SipCallState =
  | "idle"
  | "ringing" // entrant qui sonne
  | "outgoing" // sortant en cours d'établissement
  | "answered" // décroché / actif
  | "held"
  | "ended";

export type SipCallDirection = "inbound" | "outbound";

export interface SipCallSnapshot {
  state: SipCallState;
  direction: SipCallDirection;
  /** Numéro distant (appelant pour un entrant, appelé pour un sortant). */
  remoteIdentity: string;
  muted: boolean;
  onHold: boolean;
  /** Horodatage du décroché (ms epoch), pour calculer la durée côté UI. */
  answeredAt: number | null;
}

export interface SipClientEvents {
  onRegistrationState?: (state: SipRegistrationState, reason?: string) => void;
  onCallState?: (snapshot: SipCallSnapshot | null) => void;
  /** Émis dès qu'un appel ENTRANT sonne — sert à déclencher le screen pop. */
  onIncoming?: (remoteIdentity: string) => void;
}

export interface SipConnectConfig {
  /** Extension de l'agent (ex. "6001"). */
  extension: string;
  /** Secret SIP de l'extension. Jamais persisté. */
  secret: string;
  /** URL WSS du serveur SIP. Défaut : NEXT_PUBLIC_SIP_WS_URL. */
  wsUri?: string;
  /** Domaine SIP (realm). Défaut : hostname du WSS. */
  domain?: string;
}

// ── Interfaces minimales JsSIP (évitent `any` sans dépendre des types installés) ──

interface JsSipRtcSession {
  direction: "incoming" | "outgoing";
  remote_identity: { uri: { user: string } };
  connection: RTCPeerConnection;
  on(event: string, listener: (e?: unknown) => void): void;
  answer(options?: unknown): void;
  terminate(options?: unknown): void;
  hold(): void;
  unhold(): void;
  mute(options?: { audio?: boolean }): void;
  unmute(options?: { audio?: boolean }): void;
  sendDTMF(tones: string): void;
}

interface JsSipUA {
  start(): void;
  stop(): void;
  register(): void;
  on(event: string, listener: (e: unknown) => void): void;
  call(target: string, options: unknown): JsSipRtcSession;
}

interface JsSipModule {
  UA: new (config: unknown) => JsSipUA;
  WebSocketInterface: new (uri: string) => unknown;
  debug: { enable(ns: string): void; disable(): void };
}

// ── Implémentation ──────────────────────────────────────────────────────────

const DEFAULT_WS = process.env.NEXT_PUBLIC_SIP_WS_URL ?? "wss://localhost:8089/ws";

/** Déduit le domaine SIP (host) depuis l'URI WSS. */
function deriveDomain(wsUri: string): string {
  try {
    return new URL(wsUri).hostname;
  } catch {
    return "localhost";
  }
}

export class SipClient {
  private ua: JsSipUA | null = null;
  private session: JsSipRtcSession | null = null;
  private readonly events: SipClientEvents;
  private snapshot: SipCallSnapshot | null = null;
  private readonly remoteAudio: HTMLAudioElement | null;

  constructor(events: SipClientEvents, remoteAudio: HTMLAudioElement | null) {
    this.events = events;
    this.remoteAudio = remoteAudio;
  }

  /** Connecte + enregistre l'extension. Idempotent : reconnecte si déjà actif. */
  async connect(config: SipConnectConfig): Promise<void> {
    await this.disconnect();
    const wsUri = config.wsUri ?? DEFAULT_WS;
    const domain = config.domain ?? deriveDomain(wsUri);

    const JsSIP = (await import("jssip")) as unknown as JsSipModule;
    const socket = new JsSIP.WebSocketInterface(wsUri);

    this.events.onRegistrationState?.("connecting");

    const ua = new JsSIP.UA({
      sockets: [socket],
      uri: `sip:${config.extension}@${domain}`,
      password: config.secret,
      register: true,
      session_timers: false,
      // Le display name aide à l'identification côté Asterisk.
      display_name: config.extension,
    });

    ua.on("registered", () => this.events.onRegistrationState?.("registered"));
    ua.on("unregistered", () => this.events.onRegistrationState?.("disconnected"));
    ua.on("registrationFailed", (e: unknown) => {
      const reason = (e as { cause?: string } | undefined)?.cause;
      this.events.onRegistrationState?.("registration_failed", reason);
    });
    ua.on("disconnected", () => this.events.onRegistrationState?.("disconnected"));

    ua.on("newRTCSession", (e: unknown) => {
      const data = e as { session: JsSipRtcSession };
      this.attachSession(data.session);
    });

    this.ua = ua;
    ua.start();
  }

  /** Coupe la connexion et libère toute session en cours. */
  async disconnect(): Promise<void> {
    if (this.session) {
      try {
        this.session.terminate();
      } catch {
        /* déjà terminée */
      }
      this.session = null;
    }
    if (this.ua) {
      try {
        this.ua.stop();
      } catch {
        /* idem */
      }
      this.ua = null;
    }
    this.updateSnapshot(null);
    this.events.onRegistrationState?.("disconnected");
  }

  /** Appel sortant vers un numéro / une extension. */
  call(target: string): void {
    if (!this.ua || this.session) return;
    const domain = this.snapshotDomain();
    const session = this.ua.call(`sip:${target}@${domain}`, {
      mediaConstraints: { audio: true, video: false },
      rtcOfferConstraints: { offerToReceiveAudio: true, offerToReceiveVideo: false },
    });
    this.attachSession(session);
  }

  /** Répond à l'appel entrant courant. */
  answer(): void {
    if (!this.session || this.session.direction !== "incoming") return;
    this.session.answer({
      mediaConstraints: { audio: true, video: false },
    });
  }

  /** Raccroche / refuse l'appel courant. */
  hangup(): void {
    if (!this.session) return;
    try {
      this.session.terminate();
    } catch {
      /* déjà terminée */
    }
  }

  toggleMute(): void {
    if (!this.session || !this.snapshot) return;
    if (this.snapshot.muted) this.session.unmute({ audio: true });
    else this.session.mute({ audio: true });
    this.snapshot = { ...this.snapshot, muted: !this.snapshot.muted };
    this.events.onCallState?.(this.snapshot);
  }

  toggleHold(): void {
    if (!this.session || !this.snapshot) return;
    if (this.snapshot.onHold) this.session.unhold();
    else this.session.hold();
    const onHold = !this.snapshot.onHold;
    this.snapshot = {
      ...this.snapshot,
      onHold,
      state: onHold ? "held" : "answered",
    };
    this.events.onCallState?.(this.snapshot);
  }

  /** Envoie une tonalité DTMF (clavier numérique pendant l'appel). */
  sendDtmf(tone: string): void {
    if (!this.session || this.snapshot?.state !== "answered") return;
    try {
      this.session.sendDTMF(tone);
    } catch {
      /* session non prête */
    }
  }

  // ── Internes ──────────────────────────────────────────────────────────

  private snapshotDomain(): string {
    const wsUri = DEFAULT_WS;
    return deriveDomain(wsUri);
  }

  private attachSession(session: JsSipRtcSession): void {
    // Une seule session active à la fois : on rejette une 2ᵉ entrée.
    if (this.session) {
      try {
        session.terminate({ status_code: 486 });
      } catch {
        /* busy */
      }
      return;
    }
    this.session = session;
    const direction: SipCallDirection =
      session.direction === "incoming" ? "inbound" : "outbound";
    const remote = session.remote_identity?.uri?.user ?? "inconnu";

    this.updateSnapshot({
      state: direction === "inbound" ? "ringing" : "outgoing",
      direction,
      remoteIdentity: remote,
      muted: false,
      onHold: false,
      answeredAt: null,
    });

    if (direction === "inbound") this.events.onIncoming?.(remote);

    session.on("accepted", () => {
      if (!this.snapshot) return;
      this.updateSnapshot({
        ...this.snapshot,
        state: "answered",
        answeredAt: Date.now(),
      });
    });
    session.on("confirmed", () => {
      if (!this.snapshot) return;
      this.updateSnapshot({
        ...this.snapshot,
        state: "answered",
        answeredAt: this.snapshot.answeredAt ?? Date.now(),
      });
    });
    session.on("ended", () => this.cleanupSession());
    session.on("failed", () => this.cleanupSession());

    // Branche le flux audio distant sur l'élément <audio> du dock.
    this.bindRemoteAudio(session);
  }

  private bindRemoteAudio(session: JsSipRtcSession): void {
    const pc = session.connection;
    if (!pc || !this.remoteAudio) return;
    const attach = (): void => {
      const remoteStream = new MediaStream();
      pc.getReceivers().forEach((r) => {
        if (r.track) remoteStream.addTrack(r.track);
      });
      if (this.remoteAudio) {
        this.remoteAudio.srcObject = remoteStream;
        void this.remoteAudio.play().catch(() => undefined);
      }
    };
    pc.addEventListener("track", attach);
  }

  private cleanupSession(): void {
    this.session = null;
    if (this.remoteAudio) this.remoteAudio.srcObject = null;
    // Snapshot transitoire "ended" puis null pour laisser l'UI afficher la fin.
    if (this.snapshot) {
      this.events.onCallState?.({ ...this.snapshot, state: "ended" });
    }
    this.updateSnapshot(null);
  }

  private updateSnapshot(s: SipCallSnapshot | null): void {
    this.snapshot = s;
    this.events.onCallState?.(s);
  }
}
