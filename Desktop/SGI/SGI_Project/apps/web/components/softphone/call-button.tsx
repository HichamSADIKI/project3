"use client";

/**
 * Bouton « click-to-call » réutilisable pour les écrans clients / CRM.
 *
 * Réutilise le softphone partagé (SoftphoneProvider) : un clic déclenche un
 * originate Asterisk côté backend (le téléphone de l'agent sonne puis se
 * connecte au numéro). Désactivé tant que le softphone n'est pas enregistré.
 *
 * RTL-safe : propriétés logiques uniquement (jamais margin-left/right). Le
 * numéro / libellé est rendu en `direction: ltr` (chiffres latins, UAE).
 */

import React, { useState } from "react";

import { IcPhone } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { postJson, extractError } from "@/lib/api-client";

import { useSoftphoneContext } from "./softphone-provider";

interface CallButtonProps {
  phone?: string | null;
  clientId?: string;
  label?: string;
  compact?: boolean;
}

export function CallButton({
  phone,
  clientId,
  label,
  compact,
}: CallButtonProps) {
  const t = useT();
  const sp = useSoftphoneContext();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!phone) return null;

  const offline = sp.registration !== "registered";
  const disabled = busy || offline;
  const title = offline ? t.tel_offline : (label ?? t.tel_call);

  async function call() {
    setBusy(true);
    setErr(null);
    try {
      const res = await postJson("/api/admin/telephony/calls/click-to-call", {
        to_number: phone,
        client_id: clientId,
      });
      if (!res.ok) {
        setErr(await extractError(res, "dial_failed"));
      }
    } catch {
      setErr("dial_failed");
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => void call()}
        disabled={disabled}
        title={err ? `${title} — ${err}` : title}
        aria-label={title}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          padding: 0,
          background: "var(--emerald)",
          color: "#fff",
          border: "1px solid var(--line)",
          borderRadius: 999,
          cursor: disabled ? "default" : "pointer",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <IcPhone />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void call()}
      disabled={disabled}
      title={err ? `${title} — ${err}` : title}
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
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <IcPhone />
      <span style={{ direction: "ltr" }}>
        {busy ? "…" : (label ?? t.tel_call)}
      </span>
    </button>
  );
}
