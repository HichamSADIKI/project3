"use client";

import React, { useState } from "react";

import { patchJson, extractError } from "@/lib/api-client";

/**
 * Bascule Featured / Urgent d'une annonce vitrine (vente ou location).
 *
 * PATCH optimiste vers le proxy backoffice
 * (`/api/admin/{sales,leasing}/listings/{id}` → `PATCH /api/v1/.../listings/{id}`)
 * avec le seul champ modifié (`{ is_featured }` ou `{ is_urgent }`). Rollback de
 * l'état local si l'upstream refuse. RTL-safe (aucun CSS physique) ; le libellé
 * vient de `label` (clés i18n `st_featured` / `st_urgent`).
 *
 * Contrat backend attendu : le PATCH accepte une mise à jour partielle des deux
 * booléens et renvoie l'enveloppe `{success,data}` (le corps n'est pas relu ici,
 * seul le statut HTTP compte).
 */
export function ListingFlagToggle({
  basePath,
  id,
  flag,
  value,
  label,
  activeColor,
  activeBg,
}: {
  /** Préfixe proxy, ex. `"/api/admin/sales/listings"`. */
  basePath: string;
  id: string;
  flag: "is_featured" | "is_urgent";
  value: boolean;
  label: string;
  activeColor: string;
  activeBg: string;
}) {
  const [on, setOn] = useState(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    if (busy) return;
    const next = !on;
    setBusy(true);
    setErr(null);
    setOn(next); // optimiste
    try {
      const res = await patchJson(`${basePath}/${id}`, { [flag]: next });
      if (!res.ok) {
        setOn(!next); // rollback
        setErr(await extractError(res, "action_failed"));
      }
    } catch {
      setOn(!next);
      setErr("action_failed");
    } finally {
      setBusy(false);
    }
  }

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
        gap: 6,
        border: `1px solid ${on ? activeColor : "var(--line-soft)"}`,
        borderRadius: 999,
        padding: "3px 10px",
        fontSize: 11,
        fontWeight: 600,
        cursor: busy ? "default" : "pointer",
        background: on ? activeBg : "transparent",
        color: on ? activeColor : "var(--ink-4)",
        opacity: busy ? 0.6 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: 999,
          background: on ? activeColor : "var(--line-soft)",
        }}
      />
      {label}
    </button>
  );
}
