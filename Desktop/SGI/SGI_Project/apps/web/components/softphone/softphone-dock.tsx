"use client";

/**
 * Dock softphone : widget persistant fixé en bas (inline-end), partagé via
 * SoftphoneProvider. Affiche l'état d'enregistrement, l'appel courant (entrant /
 * sortant / actif) avec mute · hold · raccrocher · DTMF, et le screen pop des
 * fiches clients résolues sur appel entrant.
 *
 * RTL-safe : uniquement du CSS logique (inset-inline-end, marginInlineStart…).
 * Numéros affichés en chiffres latins (UAE).
 */

import React, { useEffect, useRef, useState } from "react";

import { IcPhone, IcClose } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

import { useSoftphoneContext } from "./softphone-provider";
import { fetchMyExtension } from "./use-softphone";

const DTMF_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

/** Durée mm:ss depuis un epoch ms (chiffres latins). */
function elapsed(since: number): string {
  const s = Math.max(0, Math.floor((Date.now() - since) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function SoftphoneDock() {
  const t = useT();
  const sp = useSoftphoneContext();
  const [open, setOpen] = useState(false);
  const [ext, setExt] = useState("");
  const [secret, setSecret] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [, forceTick] = useState(0);
  const audioCheckRef = useRef(false);

  // Pré-remplit l'extension depuis l'agent_state (si l'agent en a une).
  useEffect(() => {
    if (audioCheckRef.current) return;
    audioCheckRef.current = true;
    void fetchMyExtension().then((s) => {
      if (s?.extension) setExt(s.extension);
    });
  }, []);

  // Tic 1 s pour rafraîchir le chrono d'appel.
  useEffect(() => {
    if (sp.call?.state !== "answered") return;
    const id = window.setInterval(() => forceTick((k) => k + 1), 1000);
    return () => window.clearInterval(id);
  }, [sp.call?.state]);

  // Ouvre le dock automatiquement sur un appel entrant ou un screen pop.
  useEffect(() => {
    if (sp.call?.state === "ringing" || sp.screenPop) setOpen(true);
  }, [sp.call?.state, sp.screenPop]);

  const registered = sp.registration === "registered";
  const call = sp.call;

  const regColor =
    sp.registration === "registered"
      ? "var(--emerald)"
      : sp.registration === "connecting"
        ? "var(--gold)"
        : "var(--rose)";
  const regLabel =
    sp.registration === "registered"
      ? t.tel_registered
      : sp.registration === "connecting"
        ? t.tel_connecting
        : sp.registration === "registration_failed"
          ? t.tel_reg_failed
          : t.tel_offline;

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    if (!ext.trim() || !secret) return;
    await sp.connect({ extension: ext.trim(), secret });
    setSecret(""); // ne pas garder le secret dans le state plus que nécessaire
  }

  return (
    <>
      {/* Bouton flottant */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={t.tel_softphone}
        style={{
          position: "fixed",
          insetBlockEnd: 20,
          insetInlineEnd: 20,
          width: 52,
          height: 52,
          borderRadius: 999,
          border: "none",
          background: call ? "var(--emerald)" : "var(--gold)",
          color: "#1A1610",
          cursor: "pointer",
          boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1200,
        }}
      >
        <IcPhone />
        {/* Pastille d'état d'enregistrement */}
        <span
          style={{
            position: "absolute",
            insetBlockStart: 6,
            insetInlineEnd: 6,
            width: 10,
            height: 10,
            borderRadius: 999,
            background: regColor,
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
            width: 320,
            maxHeight: "70vh",
            overflowY: "auto",
            background: "var(--bg-paper)",
            border: "1px solid var(--line)",
            borderRadius: 14,
            boxShadow: "0 12px 40px rgba(0,0,0,0.3)",
            zIndex: 1200,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* En-tête */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 16px",
              borderBottom: "1px solid var(--line-soft)",
            }}
          >
            <span style={{ color: "var(--gold)" }}>
              <IcPhone />
            </span>
            <span className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              {t.tel_softphone}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, marginInlineStart: "auto" }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, background: regColor }} />
              <span style={{ fontSize: 11, color: regColor, fontWeight: 600 }}>{regLabel}</span>
            </span>
          </div>

          {/* Connexion */}
          {!registered && !call && (
            <form onSubmit={handleConnect} style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
              <label style={{ fontSize: 11, color: "var(--ink-4)" }}>{t.tel_extension}</label>
              <input
                value={ext}
                onChange={(e) => setExt(e.target.value)}
                inputMode="numeric"
                style={inputStyle}
                placeholder="6001"
              />
              <label style={{ fontSize: 11, color: "var(--ink-4)" }}>{t.tel_secret}</label>
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                type="password"
                autoComplete="off"
                style={inputStyle}
              />
              {sp.registration === "registration_failed" && sp.registrationReason && (
                <div style={{ fontSize: 11, color: "var(--rose)" }}>{sp.registrationReason}</div>
              )}
              <button type="submit" disabled={!ext.trim() || !secret} style={primaryBtn(!ext.trim() || !secret)}>
                {sp.registration === "connecting" ? t.tel_connecting : t.tel_connect}
              </button>
            </form>
          )}

          {/* Appel courant */}
          {call && (
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {call.direction === "inbound" ? t.tel_incoming : t.tel_outgoing}
                </div>
                <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)", direction: "ltr" }}>
                  {call.remoteIdentity === "inconnu" ? t.tel_unknown_caller : call.remoteIdentity}
                </div>
                <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>
                  {call.state === "answered" && call.answeredAt
                    ? elapsed(call.answeredAt)
                    : call.state === "held"
                      ? t.tel_on_hold
                      : call.state === "ringing"
                        ? "…"
                        : t.tel_outgoing}
                </div>
              </div>

              {/* Boutons d'appel */}
              <div style={{ display: "flex", justifyContent: "center", gap: 10 }}>
                {call.state === "ringing" && call.direction === "inbound" && (
                  <button onClick={sp.answer} style={roundBtn("var(--emerald)")} title={t.tel_answer}>
                    <IcPhone />
                  </button>
                )}
                {(call.state === "answered" || call.state === "held") && (
                  <>
                    <button onClick={sp.toggleMute} style={roundBtn(call.muted ? "var(--rose)" : "var(--line)")} title={call.muted ? t.tel_unmute : t.tel_mute}>
                      <span style={{ fontSize: 12, color: "var(--ink)" }}>{call.muted ? "🔇" : "🎤"}</span>
                    </button>
                    <button onClick={sp.toggleHold} style={roundBtn(call.onHold ? "var(--gold)" : "var(--line)")} title={call.onHold ? t.tel_resume : t.tel_hold}>
                      <span style={{ fontSize: 12, color: "var(--ink)" }}>{call.onHold ? "▶" : "⏸"}</span>
                    </button>
                    <button onClick={() => setShowKeypad((k) => !k)} style={roundBtn("var(--line)")} title={t.tel_keypad}>
                      <span style={{ fontSize: 12, color: "var(--ink)" }}>⌨</span>
                    </button>
                  </>
                )}
                <button onClick={sp.hangup} style={roundBtn("var(--rose)")} title={t.tel_hangup}>
                  <span style={{ transform: "rotate(135deg)", display: "inline-flex", color: "#fff" }}>
                    <IcPhone />
                  </span>
                </button>
              </div>

              {/* DTMF keypad */}
              {showKeypad && (call.state === "answered") && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                  {DTMF_KEYS.map((k) => (
                    <button key={k} onClick={() => sp.sendDtmf(k)} style={keypadBtn}>
                      {k}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Screen pop */}
          {(sp.screenPop || sp.screenPopLoading) && (
            <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                  {t.tel_screen_pop}
                </span>
                <button onClick={sp.dismissScreenPop} style={{ marginInlineStart: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)" }} aria-label="close">
                  <IcClose />
                </button>
              </div>
              {sp.screenPopLoading && <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{t.tel_searching}</div>}
              {!sp.screenPopLoading && sp.screenPop?.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{t.tel_no_match}</div>
              )}
              {sp.screenPop?.map((m) => (
                <div key={m.client_id} style={{ padding: "8px 10px", borderRadius: 10, background: "var(--bg-cream)", marginBottom: 6 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{m.display_name}</div>
                  <div style={{ fontSize: 11.5, color: "var(--ink-4)", direction: "ltr" }}>{m.phone ?? "—"}</div>
                </div>
              ))}
            </div>
          )}

          {/* Déconnexion */}
          {registered && !call && (
            <div style={{ padding: "0 16px 16px" }}>
              <button onClick={() => void sp.disconnect()} style={secondaryBtn}>
                {t.tel_disconnect}
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ── Styles inline (cohérents avec le reste de l'app) ────────────────────────

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--bg-cream)",
  fontSize: 13,
  color: "var(--ink)",
};

function primaryBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "9px 14px",
    background: "var(--gold)",
    color: "#1A1610",
    border: "none",
    borderRadius: 999,
    fontWeight: 600,
    fontSize: 13,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.6 : 1,
  };
}

const secondaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "8px 14px",
  background: "transparent",
  color: "var(--ink-4)",
  border: "1px solid var(--line)",
  borderRadius: 999,
  fontSize: 12.5,
  cursor: "pointer",
};

function roundBtn(bg: string): React.CSSProperties {
  return {
    width: 46,
    height: 46,
    borderRadius: 999,
    border: "1px solid var(--line-soft)",
    background: bg,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

const keypadBtn: React.CSSProperties = {
  padding: "10px 0",
  border: "1px solid var(--line-soft)",
  borderRadius: 8,
  background: "var(--bg-cream)",
  fontSize: 15,
  fontWeight: 600,
  color: "var(--ink)",
  cursor: "pointer",
};
