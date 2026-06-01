"use client";

/**
 * Panneau « Appels » de l'écran Communication : journal d'appels (GET
 * /telephony/calls), click-to-call (POST /telephony/calls/click-to-call) et
 * sélecteur de statut agent (POST /telephony/agents/me/status).
 *
 * Réutilise le softphone partagé (SoftphoneProvider) : un click-to-call passe
 * par l'API (originate Asterisk) ET le dock affiche l'appel en cours.
 *
 * RTL-safe (CSS logique). Numéros en chiffres latins (UAE).
 */

import React, { useState } from "react";

import { IcPhone } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { postJson, extractError } from "@/lib/api-client";

import { useSoftphoneContext } from "./softphone-provider";

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

const AGENT_STATUSES = ["available", "busy", "wrap_up", "paused", "offline"] as const;

function fmtDuration(s: number | null): string {
  if (!s || s <= 0) return "—";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function CallsPanel() {
  const t = useT();
  const sp = useSoftphoneContext();
  const { items: calls, loading, error, reload } = useApiList<CallRow>(
    "/api/admin/telephony/calls?limit=50",
  );
  const [target, setTarget] = useState("");
  const [dialing, setDialing] = useState(false);
  const [dialError, setDialError] = useState<string | null>(null);
  const [agentStatus, setAgentStatus] = useState<string>("offline");

  const statusLabel: Record<string, string> = {
    available: t.tel_status_available,
    busy: t.tel_status_busy,
    wrap_up: t.tel_status_wrap_up,
    paused: t.tel_status_paused,
    offline: t.tel_status_offline,
  };
  const dirLabel: Record<string, string> = {
    inbound: t.tel_inbound,
    outbound: t.tel_outbound,
    internal: t.tel_internal,
  };

  async function clickToCall() {
    if (!target.trim()) return;
    setDialing(true);
    setDialError(null);
    try {
      const res = await postJson("/api/admin/telephony/calls/click-to-call", {
        to_number: target.trim(),
      });
      if (!res.ok) {
        setDialError(await extractError(res, "dial_failed"));
        return;
      }
      setTarget("");
      reload();
    } catch {
      setDialError("dial_failed");
    } finally {
      setDialing(false);
    }
  }

  async function changeStatus(next: string) {
    setAgentStatus(next);
    const res = await postJson("/api/admin/telephony/agents/me/status", { status: next });
    if (!res.ok) reload(); // remet l'UI cohérente si refus
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto", background: "var(--bg-cream)" }}>
      {/* Barre d'actions : statut agent + click-to-call */}
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
        <label style={{ fontSize: 12, color: "var(--ink-4)" }}>{t.tel_agent_status}</label>
        <select
          value={agentStatus}
          onChange={(e) => void changeStatus(e.target.value)}
          style={{ padding: "7px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--bg-cream)", fontSize: 13, color: "var(--ink)" }}
        >
          {AGENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>

        <div style={{ display: "flex", gap: 8, marginInlineStart: "auto" }}>
          <input
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void clickToCall(); }}
            placeholder={t.tel_dial_ph}
            inputMode="tel"
            style={{ padding: "8px 12px", border: "1px solid var(--line)", borderRadius: 999, background: "var(--bg-cream)", fontSize: 13, color: "var(--ink)", direction: "ltr", width: 180 }}
          />
          <button
            onClick={() => void clickToCall()}
            disabled={dialing || !target.trim() || sp.registration !== "registered"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              background: "var(--emerald)",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              fontWeight: 600,
              fontSize: 13,
              cursor: dialing || !target.trim() ? "default" : "pointer",
              opacity: dialing || !target.trim() || sp.registration !== "registered" ? 0.6 : 1,
            }}
            title={sp.registration !== "registered" ? t.tel_offline : t.tel_dial}
          >
            <IcPhone />
            {dialing ? "…" : t.tel_dial}
          </button>
        </div>
      </div>

      {dialError && <div style={{ padding: "8px 26px", color: "var(--rose)", fontSize: 12 }}>Erreur : {dialError}</div>}

      {/* Journal d'appels */}
      <div style={{ padding: "16px 26px" }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", marginBottom: 10 }}>{t.tel_call_log}</div>
        {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>Erreur : {error}</div>}
        {loading && <div style={{ color: "var(--ink-4)", fontSize: 12 }}>…</div>}
        {!loading && calls.length === 0 && !error && (
          <div style={{ color: "var(--ink-4)", fontSize: 13 }}>{t.tel_no_calls}</div>
        )}
        {calls.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "start", color: "var(--ink-4)", fontSize: 11, textTransform: "uppercase" }}>
                <th style={{ textAlign: "start", padding: "6px 8px" }}>{t.tel_direction}</th>
                <th style={{ textAlign: "start", padding: "6px 8px" }}>De / À</th>
                <th style={{ textAlign: "start", padding: "6px 8px" }}>{t.tel_duration}</th>
                <th style={{ textAlign: "start", padding: "6px 8px" }}>Statut</th>
                <th style={{ textAlign: "start", padding: "6px 8px" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "8px", color: "var(--ink)" }}>{dirLabel[c.direction] ?? c.direction}</td>
                  <td style={{ padding: "8px", color: "var(--ink)", direction: "ltr" }}>
                    {c.direction === "outbound" ? c.to_number : c.from_number}
                  </td>
                  <td style={{ padding: "8px", color: "var(--ink-4)", direction: "ltr" }}>{fmtDuration(c.duration_seconds)}</td>
                  <td style={{ padding: "8px", color: "var(--ink-4)" }}>{c.status}</td>
                  <td style={{ padding: "8px", color: "var(--ink-4)" }}>{new Date(c.created_at).toLocaleString("fr")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
