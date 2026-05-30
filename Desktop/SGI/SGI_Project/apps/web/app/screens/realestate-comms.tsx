"use client";

import React from "react";
import { Topbar, IcChat, IcCheck, IcClock } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique. Câblage à l'API /api/v1/comms (REST + WebSocket
// temps réel + transcription/traduction IA) prévu lors d'une étape ultérieure.

const CONVERSATIONS = [
  { id: "c1", subject: "Ticket #MNT-2026-000142 — Fuite Marina A", type: "ticket", last: "Le plombier passe demain 10h", unread: 2, active: true },
  { id: "c2", subject: "Bail Business Bay #0901", type: "contract", last: "Merci, document signé ✓", unread: 0, active: false },
  { id: "c3", subject: "O. Haddad — propriétaire", type: "direct", last: "Relevé d'avril reçu", unread: 0, active: false },
];

const MESSAGES = [
  { from: "agent", who: "Sara (agent)", body: "Bonjour, un technicien a été assigné pour la fuite.", kind: "text", time: "09:12", read: true },
  { from: "other", who: "Locataire", body: "Parfait, quand passe-t-il ?", kind: "text", time: "09:15", read: true },
  { from: "other", who: "Locataire", body: "🎙️ note vocale (0:12)", kind: "voice", transcript: "« je suis dispo demain matin »", time: "09:16", read: true },
  { from: "agent", who: "Sara (agent)", body: "Le plombier passe demain 10h.", kind: "text", time: "09:18", read: false },
];

export function ScreenRealEstateComms() {
  const t = useT();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_comms} />

      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-cream)" }}>

        {/* Liste conversations */}
        <div style={{ width: 300, borderInlineEnd: "1px solid var(--line-soft)", background: "var(--bg-paper)", overflowY: "auto" }}>
          <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--gold)" }}><IcChat /></span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t.nav_comms}</span>
          </div>
          {CONVERSATIONS.map(c => (
            <div key={c.id} style={{
              padding: "12px 18px", borderTop: "1px solid var(--line-soft)", cursor: "pointer",
              background: c.active ? "var(--gold-ghost)" : "transparent",
              borderInlineStart: c.active ? "3px solid var(--gold)" : "3px solid transparent",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject}</span>
                {c.unread > 0 && <span style={{ fontSize: 10, fontWeight: 700, color: "#1A1610", background: "var(--gold)", borderRadius: 999, padding: "1px 7px" }}>{c.unread}</span>}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.last}</div>
            </div>
          ))}
        </div>

        {/* Fil de messages */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 26px", display: "flex", flexDirection: "column", gap: 12 }}>
            {MESSAGES.map((m, i) => {
              const mine = m.from === "agent";
              return (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: mine ? "flex-end" : "flex-start" }}>
                  <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginBottom: 2 }}>{m.who} · {m.time}</div>
                  <div style={{
                    maxWidth: "70%", padding: "9px 13px", borderRadius: 12, fontSize: 13,
                    background: mine ? "var(--gold)" : "var(--bg-paper)",
                    color: mine ? "#1A1610" : "var(--ink)",
                    border: mine ? "none" : "1px solid var(--line-soft)",
                  }}>
                    {m.body}
                    {m.kind === "voice" && m.transcript && (
                      <div style={{ fontSize: 11, fontStyle: "italic", color: mine ? "#5a4a20" : "var(--ink-4)", marginTop: 4 }}>
                        IA : {m.transcript}
                      </div>
                    )}
                  </div>
                  {mine && (
                    <span style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                      {m.read ? <><IcCheck /> lu</> : <><IcClock /> envoyé</>}
                    </span>
                  )}
                </div>
              );
            })}
            <div style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic" }}>Locataire est en train d'écrire…</div>
          </div>

          {/* Barre de saisie (maquette) */}
          <div style={{ borderTop: "1px solid var(--line-soft)", padding: "12px 20px", background: "var(--bg-paper)", display: "flex", gap: 10 }}>
            <input
              readOnly
              placeholder="Écrire un message…"
              style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--line)", borderRadius: 999, background: "var(--bg-cream)", fontSize: 13, color: "var(--ink-3)" }}
            />
            <button style={{ padding: "9px 18px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: 999, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              Envoyer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
