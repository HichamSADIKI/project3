"use client";

/**
 * Modale de validation Self-Defense : saisie du code avant d'activer un mode
 * (radar/avion/dôme) ou de désarmer. Délègue à `submitCode` (store). Affiche les
 * essais restants ; succès ou verrouillage → ferme (l'overlay réagit à l'état).
 */

import React, { useEffect, useState } from "react";

import { useLang } from "@/components/language-provider";
import {
  type SelfDefenseMode,
  submitCode,
  SELF_DEFENSE_MAX_ATTEMPTS,
} from "@/lib/use-self-defense";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Code de validation",
    hint: "Saisis le code pour confirmer cette action de défense.",
    placeholder: "Code",
    confirm: "Confirmer",
    cancel: "Annuler",
    wrong: "Code incorrect.",
    left: "essai(s) restant(s)",
    activate: "Activer le mode",
    disarm: "Désarmer",
  },
  en: {
    title: "Validation code",
    hint: "Enter the code to confirm this defense action.",
    placeholder: "Code",
    confirm: "Confirm",
    cancel: "Cancel",
    wrong: "Wrong code.",
    left: "attempt(s) left",
    activate: "Activate mode",
    disarm: "Disarm",
  },
  ar: {
    title: "رمز التحقق",
    hint: "أدخل الرمز لتأكيد إجراء الدفاع.",
    placeholder: "الرمز",
    confirm: "تأكيد",
    cancel: "إلغاء",
    wrong: "رمز غير صحيح.",
    left: "محاولة متبقية",
    activate: "تفعيل الوضع",
    disarm: "نزع التفعيل",
  },
};

const MODE_LABEL: Record<SelfDefenseMode, string> = {
  radar: "📡 Radar",
  avion: "✈️ Avion",
  dome: "🛡️ Dôme de fer",
};

export function ValidationDialog({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: SelfDefenseMode | null;
  onClose: () => void;
}): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(SELF_DEFENSE_MAX_ATTEMPTS);

  // Réinitialise à chaque ouverture.
  useEffect(() => {
    if (open) {
      setCode("");
      setError(null);
      setLeft(SELF_DEFENSE_MAX_ATTEMPTS);
    }
  }, [open]);

  if (!open) return null;

  function confirm(): void {
    const res = submitCode(target, code);
    if (res.ok || res.locked) {
      onClose(); // succès → applique ; verrouillé → l'overlay prend le relais
      return;
    }
    setLeft((n) => Math.max(0, n - 1));
    setCode("");
    setError(L("wrong"));
  }

  const subtitle = target ? `${L("activate")} ${MODE_LABEL[target]}` : L("disarm");

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
        <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginBlock: "6px 4px" }}>
          {subtitle}
        </div>
        <div style={{ fontSize: 12, color: "var(--ink-4)", marginBlockEnd: 14 }}>{L("hint")}</div>

        <input
          autoFocus
          type="password"
          inputMode="numeric"
          value={code}
          placeholder={L("placeholder")}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") confirm();
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
            {error} — {left} {L("left")}
          </div>
        )}

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginBlockStart: 18 }}>
          <button
            type="button"
            onClick={onClose}
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
            onClick={confirm}
            style={{
              padding: "8px 18px",
              borderRadius: 10,
              border: "none",
              background: "var(--ink)",
              color: "#fff",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {L("confirm")}
          </button>
        </div>
      </div>
    </div>
  );
}
