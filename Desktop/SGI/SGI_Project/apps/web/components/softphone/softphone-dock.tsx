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
import { postJson, extractError } from "@/lib/api-client";
import type { SipCallSnapshot } from "@/lib/sip-client";

import { CallActions } from "./call-actions";
import { useSoftphoneContext } from "./softphone-provider";
import { fetchMyExtension } from "./use-softphone";

const DTMF_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

/** Codes de disposition (stables, indépendants de la locale) → libellé i18n. */
const DISPOSITION_CODES = [
  "interested",
  "callback",
  "not_interested",
  "no_answer",
  "wrong_number",
  "voicemail",
  "completed",
] as const;

/** Durée mm:ss depuis un epoch ms (chiffres latins). */
function elapsed(since: number): string {
  const s = Math.max(0, Math.floor((Date.now() - since) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function SoftphoneDock({
  onOpenClient,
}: {
  onOpenClient?: (name: string) => void;
}) {
  const t = useT();
  const sp = useSoftphoneContext();
  const [open, setOpen] = useState(false);
  const [ext, setExt] = useState("");
  const [secret, setSecret] = useState("");
  const [showKeypad, setShowKeypad] = useState(false);
  const [, forceTick] = useState(0);
  const audioCheckRef = useRef(false);

  // Workspace appel : notes live + disposition + wrap-up après raccrochage.
  const [notes, setNotes] = useState("");
  const [disposition, setDisposition] = useState("");
  const [wrapUp, setWrapUp] = useState<{
    callId: string | null;
    remote: string;
    clientId: string | null;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const prevCallRef = useRef<SipCallSnapshot | null>(null);

  const dispositions = DISPOSITION_CODES.map((code) => ({
    code,
    label: t[`tel_disp_${code}` as keyof typeof t] as string,
  }));

  // Client lié à l'appel : screen pop (entrant), client click-to-call (sortant),
  // ou snapshot de wrap-up.
  const activeClientId =
    (sp.screenPop && sp.screenPop.length > 0
      ? sp.screenPop[0].client_id
      : null) ??
    sp.pendingClientId ??
    wrapUp?.clientId ??
    null;

  const subject = sp.call?.remoteIdentity ?? wrapUp?.remote ?? "—";

  /** Notes composées : 1re ligne `Résultat: <code>` (marqueur stable) + texte. */
  function composedNotes(): string {
    const marker = disposition ? `Résultat: ${disposition}\n` : "";
    return `${marker}${notes}`.trim();
  }

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

  // Ouvre le dock automatiquement sur un appel entrant, un screen pop, ou un
  // wrap-up à traiter.
  useEffect(() => {
    if (sp.call?.state === "ringing" || sp.screenPop || wrapUp) setOpen(true);
  }, [sp.call?.state, sp.screenPop, wrapUp]);

  // Statut agent automatique + entrée en wrap-up autour d'un appel.
  // - décroché → busy ; - terminé (snapshot transitoire "ended") → wrap_up.
  useEffect(() => {
    const prev = prevCallRef.current;
    prevCallRef.current = sp.call ?? null;
    if (sp.call?.state === "answered" && prev?.state !== "answered") {
      void sp.setStatus("busy");
    }
    if (sp.call?.state === "ended" && !wrapUp) {
      // Fige l'id du CDR ET le client au moment du raccrochage : un nouvel
      // appel entrant remet `currentCallId` à null, on ne doit pas perdre la
      // cible des notes (sinon la disposition serait silencieusement écrite
      // nulle part).
      setWrapUp({
        callId: sp.currentCallId,
        remote: sp.call.remoteIdentity,
        clientId: sp.screenPop?.[0]?.client_id ?? sp.pendingClientId ?? null,
      });
      void sp.setStatus("wrap_up");
    }
  }, [sp.call, sp.screenPop, sp, wrapUp]);

  // Raccourcis clavier (Alt+…), désactivés quand le focus est dans un champ.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const k = e.key.toLowerCase();
      const st = sp.call?.state;
      if (k === "a" && st === "ringing" && sp.call?.direction === "inbound") {
        e.preventDefault();
        sp.answer();
      } else if (k === "h" && sp.call) {
        e.preventDefault();
        sp.hangup();
      } else if (k === "m" && (st === "answered" || st === "held")) {
        e.preventDefault();
        sp.toggleMute();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sp]);

  // Enregistre les notes/disposition sur le CDR (figé à l'entrée en wrap-up)
  // puis repasse l'agent disponible. En cas d'échec, on NE ferme PAS le panneau
  // et on affiche l'erreur — sinon la disposition serait perdue silencieusement.
  async function saveWrapUp() {
    const callId = wrapUp?.callId ?? null;
    const composed = composedNotes();
    setSaveError(null);
    if (callId && composed) {
      setSaving(true);
      try {
        const res = await postJson(
          `/api/admin/telephony/calls/${callId}/notes`,
          { notes: composed },
        );
        if (!res.ok) {
          setSaveError(await extractError(res, "save_failed"));
          setSaving(false);
          return;
        }
      } catch {
        setSaveError("save_failed");
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    await sp.setStatus("available");
    sp.setPendingClient(null);
    setWrapUp(null);
    setNotes("");
    setDisposition("");
  }

  const registered = sp.registration === "registered";
  const call = sp.call;

  // Bloc commun (appel actif + wrap-up) : disposition · notes · actions 1 clic.
  const wrapForm = (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        borderTop: "1px solid var(--line-soft)",
        paddingTop: 10,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--ink-4)",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {t.tel_disposition}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {dispositions.map((d) => (
          <button
            key={d.code}
            onClick={() => setDisposition(d.code === disposition ? "" : d.code)}
            style={chip(d.code === disposition)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder={t.tel_notes}
        rows={2}
        style={{
          width: "100%",
          resize: "vertical",
          padding: "7px 9px",
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "var(--bg-cream)",
          fontSize: 12.5,
          color: "var(--ink)",
          fontFamily: "inherit",
        }}
      />
      <CallActions
        clientId={activeClientId}
        subject={subject}
        notes={composedNotes()}
      />
    </div>
  );

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
            <span
              className="font-display"
              style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}
            >
              {t.tel_softphone}
            </span>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginInlineStart: "auto",
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: regColor,
                }}
              />
              <span style={{ fontSize: 11, color: regColor, fontWeight: 600 }}>
                {regLabel}
              </span>
            </span>
          </div>

          {/* Connexion */}
          {!registered && !call && (
            <form
              onSubmit={handleConnect}
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <label style={{ fontSize: 11, color: "var(--ink-4)" }}>
                {t.tel_extension}
              </label>
              <input
                value={ext}
                onChange={(e) => setExt(e.target.value)}
                inputMode="numeric"
                style={inputStyle}
                placeholder="6001"
              />
              <label style={{ fontSize: 11, color: "var(--ink-4)" }}>
                {t.tel_secret}
              </label>
              <input
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                type="password"
                autoComplete="off"
                style={inputStyle}
              />
              {sp.registration === "registration_failed" &&
                sp.registrationReason && (
                  <div style={{ fontSize: 11, color: "var(--rose)" }}>
                    {sp.registrationReason}
                  </div>
                )}
              <button
                type="submit"
                disabled={!ext.trim() || !secret}
                style={primaryBtn(!ext.trim() || !secret)}
              >
                {sp.registration === "connecting"
                  ? t.tel_connecting
                  : t.tel_connect}
              </button>
            </form>
          )}

          {/* Appel courant */}
          {call && (
            <div
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-4)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {call.direction === "inbound"
                    ? t.tel_incoming
                    : t.tel_outgoing}
                </div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--ink)",
                    direction: "ltr",
                  }}
                >
                  {call.remoteIdentity === "inconnu"
                    ? t.tel_unknown_caller
                    : call.remoteIdentity}
                </div>
                <div
                  style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}
                >
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
              <div
                style={{ display: "flex", justifyContent: "center", gap: 10 }}
              >
                {call.state === "ringing" && call.direction === "inbound" && (
                  <button
                    onClick={sp.answer}
                    style={roundBtn("var(--emerald)")}
                    title={t.tel_answer}
                  >
                    <IcPhone />
                  </button>
                )}
                {(call.state === "answered" || call.state === "held") && (
                  <>
                    <button
                      onClick={sp.toggleMute}
                      style={roundBtn(
                        call.muted ? "var(--rose)" : "var(--line)",
                      )}
                      title={call.muted ? t.tel_unmute : t.tel_mute}
                    >
                      <span style={{ fontSize: 12, color: "var(--ink)" }}>
                        {call.muted ? "🔇" : "🎤"}
                      </span>
                    </button>
                    <button
                      onClick={sp.toggleHold}
                      style={roundBtn(
                        call.onHold ? "var(--gold)" : "var(--line)",
                      )}
                      title={call.onHold ? t.tel_resume : t.tel_hold}
                    >
                      <span style={{ fontSize: 12, color: "var(--ink)" }}>
                        {call.onHold ? "▶" : "⏸"}
                      </span>
                    </button>
                    <button
                      onClick={() => setShowKeypad((k) => !k)}
                      style={roundBtn("var(--line)")}
                      title={t.tel_keypad}
                    >
                      <span style={{ fontSize: 12, color: "var(--ink)" }}>
                        ⌨
                      </span>
                    </button>
                  </>
                )}
                <button
                  onClick={sp.hangup}
                  style={roundBtn("var(--rose)")}
                  title={t.tel_hangup}
                >
                  <span
                    style={{
                      transform: "rotate(135deg)",
                      display: "inline-flex",
                      color: "#fff",
                    }}
                  >
                    <IcPhone />
                  </span>
                </button>
              </div>

              {/* DTMF keypad */}
              {showKeypad && call.state === "answered" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 6,
                  }}
                >
                  {DTMF_KEYS.map((k) => (
                    <button
                      key={k}
                      onClick={() => sp.sendDtmf(k)}
                      style={keypadBtn}
                    >
                      {k}
                    </button>
                  ))}
                </div>
              )}

              {/* Workspace : disposition · notes · actions (dès le décroché) */}
              {(call.state === "answered" || call.state === "held") && wrapForm}

              <div
                style={{
                  fontSize: 10,
                  color: "var(--ink-4)",
                  textAlign: "center",
                  direction: "ltr",
                }}
              >
                {t.tel_shortcuts_hint}
              </div>
            </div>
          )}

          {/* Wrap-up : reste affiché après le raccrochage pour qualifier l'appel */}
          {!call && wrapUp && (
            <div
              style={{
                padding: 16,
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--ink-4)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {t.tel_status_wrap_up}
                </div>
                <div
                  className="font-display"
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--ink)",
                    direction: "ltr",
                  }}
                >
                  {wrapUp.remote === "inconnu"
                    ? t.tel_unknown_caller
                    : wrapUp.remote}
                </div>
              </div>
              {wrapForm}
              {saveError && (
                <div style={{ fontSize: 11, color: "var(--rose)" }}>
                  {t.tel_action_failed} : {saveError}
                </div>
              )}
              <button
                onClick={() => void saveWrapUp()}
                disabled={saving}
                style={primaryBtn(saving)}
              >
                {saving ? "…" : t.tel_save}
              </button>
            </div>
          )}

          {/* Screen pop */}
          {(sp.screenPop || sp.screenPopLoading) && (
            <div
              style={{
                borderTop: "1px solid var(--line-soft)",
                padding: "12px 16px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--ink-4)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {t.tel_screen_pop}
                </span>
                <button
                  onClick={sp.dismissScreenPop}
                  style={{
                    marginInlineStart: "auto",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--ink-4)",
                  }}
                  aria-label="close"
                >
                  <IcClose />
                </button>
              </div>
              {sp.screenPopLoading && (
                <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                  {t.tel_searching}
                </div>
              )}
              {!sp.screenPopLoading && sp.screenPop?.length === 0 && (
                <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
                  {t.tel_no_match}
                </div>
              )}
              {sp.screenPop?.map((m) => (
                <div
                  key={m.client_id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: "var(--bg-cream)",
                    marginBottom: 6,
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                      }}
                    >
                      {m.display_name}
                    </div>
                    <div
                      style={{
                        fontSize: 11.5,
                        color: "var(--ink-4)",
                        direction: "ltr",
                      }}
                    >
                      {m.phone ?? "—"}
                    </div>
                  </div>
                  {onOpenClient && (
                    <button
                      onClick={() => onOpenClient(m.display_name)}
                      style={{
                        background: "none",
                        border: "1px solid var(--line)",
                        borderRadius: 8,
                        padding: "4px 8px",
                        fontSize: 11,
                        color: "var(--ink-4)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      title={t.tel_open_client}
                    >
                      {t.tel_open_client}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Rappeler le dernier numéro (redial) + déconnexion */}
          {registered && !call && !wrapUp && (
            <div
              style={{
                padding: "0 16px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {sp.lastDialed && (
                <button
                  onClick={() => sp.redial()}
                  style={primaryBtn(false)}
                  title={`${t.tel_redial} ${sp.lastDialed}`}
                >
                  {t.tel_redial} ·{" "}
                  <span style={{ direction: "ltr" }}>{sp.lastDialed}</span>
                </button>
              )}
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

function chip(active: boolean): React.CSSProperties {
  return {
    padding: "4px 9px",
    border: `1px solid ${active ? "var(--gold)" : "var(--line)"}`,
    borderRadius: 999,
    background: active ? "var(--gold)" : "var(--bg-cream)",
    color: active ? "#1A1610" : "var(--ink-4)",
    fontSize: 11.5,
    fontWeight: 600,
    cursor: "pointer",
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
