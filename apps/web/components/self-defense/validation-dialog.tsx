"use client";

/**
 * Modale de validation Self-Defense : saisie du code avant d'armer (activer un mode)
 * ou de désarmer. La validation est faite côté **backend** (`verifyBackend` : codes
 * hashés + verrouillage serveur). Succès → `onVerified` ; verrouillage → `setLocked`
 * (l'overlay affiche l'écran de verrouillage) ; échec → essais restants du serveur.
 */

import React, { useEffect, useState } from "react";

import { useLang } from "@/components/language-provider";
import {
  type SelfDefensePurpose,
  setLocked,
  verifyBackend,
} from "@/lib/use-self-defense";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Code de validation",
    armHint: "Saisis le code d'armement pour activer la défense.",
    disarmHint: "Saisis le code de désarmement pour revenir au mode normal.",
    placeholder: "Code",
    confirm: "Confirmer",
    cancel: "Annuler",
    checking: "Vérification…",
    wrong: "Code incorrect.",
    left: "essai(s) restant(s)",
  },
  en: {
    title: "Validation code",
    armHint: "Enter the arming code to enable defense.",
    disarmHint: "Enter the disarming code to return to normal.",
    placeholder: "Code",
    confirm: "Confirm",
    cancel: "Cancel",
    checking: "Checking…",
    wrong: "Wrong code.",
    left: "attempt(s) left",
  },
  ar: {
    title: "رمز التحقق",
    armHint: "أدخل رمز التفعيل لتشغيل الدفاع.",
    disarmHint: "أدخل رمز إلغاء التفعيل للعودة إلى الوضع العادي.",
    placeholder: "الرمز",
    confirm: "تأكيد",
    cancel: "إلغاء",
    checking: "جارٍ التحقق…",
    wrong: "رمز غير صحيح.",
    left: "محاولة متبقية",
  },
};

export function ValidationDialog({
  open,
  purpose,
  onClose,
  onVerified,
}: {
  open: boolean;
  purpose: SelfDefensePurpose;
  onClose: () => void;
  onVerified: () => void;
}): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      setBusy(false);
    }
  }, [open]);

  if (!open) return null;

  async function confirm(): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await verifyBackend(purpose, code);
    setBusy(false);
    if (res.ok) {
      onVerified();
      onClose();
      return;
    }
    if (res.locked) {
      setLocked(true); // l'overlay affiche l'écran de verrouillage
      onClose();
      return;
    }
    setCode("");
    setError(`${L("wrong")} — ${res.attempts_left} ${L("left")}`);
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1400,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 380,
          maxWidth: "92vw",
          background: "var(--bg-paper)",
          border: "1px solid var(--line-soft)",
          borderRadius: 16,
          padding: 22,
          boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>🔐 {L("title")}</div>
        <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginBlock: "8px 14px" }}>
          {purpose === "arm" ? L("armHint") : L("disarmHint")}
        </div>

        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={code}
          placeholder={L("placeholder")}
          disabled={busy}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void confirm();
          }}
          style={{
            width: "100%",
            padding: "10px 12px",
            fontSize: 16,
            letterSpacing: 4,
            textAlign: "center",
            borderRadius: 10,
            border: "1px solid var(--line-soft)",
            background: "var(--bg-ivory)",
            color: "var(--ink)",
          }}
        />

        {error && (
          <div style={{ marginBlockStart: 10, fontSize: 12, color: "var(--rose)", fontWeight: 600 }}>
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBlockStart: 18 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: "1px solid var(--line-soft)",
              background: "var(--bg-paper)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            {L("cancel")}
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              border: "none",
              background: "var(--gold)",
              color: "#1A1610",
              fontWeight: 700,
              cursor: busy ? "wait" : "pointer",
              opacity: busy ? 0.7 : 1,
            }}
          >
            {busy ? L("checking") : L("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
