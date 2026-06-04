"use client";

import React, { useState } from "react";

import { postJson, extractError } from "@/lib/api-client";

/**
 * Interrupteur **En ligne / Hors ligne** d'une annonce vitrine (vente ou location).
 *
 * « En ligne » = `status === "published"` (visible sur le site public).
 * - OFF → ON : POST transition `{ status: "published" }` (depuis `draft` ou `withdrawn`).
 * - ON → OFF : POST transition `{ status: "withdrawn" }`.
 *
 * La machine à états + la génération du slug restent l'autorité backend. On
 * recharge la liste parente (`onChanged`) après succès car d'autres éléments de
 * la ligne dépendent du statut (lien « Voir », flags, progression). RTL-safe
 * (aucun CSS physique : le knob se positionne via `order` flex selon `on`).
 */
export function ListingOnlineToggle({
  basePath,
  id,
  status,
  labelOn,
  labelOff,
  onChanged,
}: {
  /** Préfixe proxy, ex. `"/api/admin/sales/listings"`. */
  basePath: string;
  id: string;
  status: string;
  labelOn: string;
  labelOff: string;
  onChanged: () => void;
}) {
  const on = status === "published";
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      const next = on ? "withdrawn" : "published";
      const res = await postJson(`${basePath}/${id}/transition`, { status: next });
      if (!res.ok) {
        setErr(await extractError(res, "action_failed"));
      } else {
        onChanged();
      }
    } catch {
      setErr("action_failed");
    } finally {
      setBusy(false);
    }
  }

  const accent = on ? "var(--emerald)" : "var(--ink-4)";
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={on}
      title={err ?? undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        border: `1px solid ${on ? "var(--emerald)" : "var(--line-soft)"}`,
        borderRadius: 999,
        padding: "3px 10px 3px 6px",
        fontSize: 11.5,
        fontWeight: 600,
        cursor: busy ? "default" : "pointer",
        background: on ? "rgba(16,185,129,0.12)" : "transparent",
        color: accent,
        opacity: busy ? 0.6 : 1,
      }}
    >
      {/* Piste + knob (le knob glisse via justify-content selon l'état) */}
      <span
        aria-hidden
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: on ? "flex-end" : "flex-start",
          width: 26,
          height: 15,
          borderRadius: 999,
          padding: 2,
          background: on ? "var(--emerald)" : "var(--line)",
          transition: "background .15s",
        }}
      >
        <span style={{ width: 11, height: 11, borderRadius: 999, background: "#fff" }} />
      </span>
      {busy ? "…" : on ? labelOn : labelOff}
    </button>
  );
}
