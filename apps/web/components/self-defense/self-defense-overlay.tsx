"use client";

/**
 * Overlay global Self-Defense (monté au niveau page, frère des docks) :
 * - teinte translucide de toute la page selon le mode (vert/orange/rouge), purement
 *   visuelle (pointer-events: none) → informe l'utilisateur du mode actif ;
 * - mode dôme : calque qui FIGE la page (bloque clics/saisie/navigation) ;
 * - bandeau supérieur indiquant le mode ;
 * - écran de VERROUILLAGE plein écran après 3 codes erronés.
 * Le FAB « Désarmer » (dock) reste au-dessus du gel pour pouvoir revenir au normal.
 */

import React from "react";

import { useLang } from "@/components/language-provider";
import { useSelfDefense, type SelfDefenseMode } from "@/lib/use-self-defense";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    radar: "Mode RADAR actif — surveillance",
    avion: "Mode AVION actif — attaque",
    dome: "Mode DÔME DE FER actif — page protégée (figée)",
    lockedTitle: "Session verrouillée",
    lockedBody: "Trop de codes incorrects. Contactez l'administrateur système.",
  },
  en: {
    radar: "RADAR mode active — surveillance",
    avion: "JET mode active — attack",
    dome: "IRON DOME mode active — page protected (frozen)",
    lockedTitle: "Session locked",
    lockedBody: "Too many wrong codes. Contact the system administrator.",
  },
  ar: {
    radar: "وضع الرادار مفعّل — مراقبة",
    avion: "وضع الطائرة مفعّل — هجوم",
    dome: "وضع القبة الحديدية مفعّل — الصفحة محمية (مجمّدة)",
    lockedTitle: "الجلسة مقفلة",
    lockedBody: "محاولات خاطئة كثيرة. اتصل بمسؤول النظام.",
  },
};

const TINT: Record<SelfDefenseMode, string> = {
  radar: "rgba(5,150,105,0.10)",
  avion: "rgba(234,140,43,0.11)",
  dome: "rgba(220,38,38,0.13)",
};
const BANNER_BG: Record<SelfDefenseMode, string> = {
  radar: "var(--emerald)",
  avion: "#EA8C2B",
  dome: "var(--rose)",
};

export function SelfDefenseOverlay(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const { mode, locked } = useSelfDefense();

  // Écran de VERROUILLAGE — au-dessus de tout, bloque tout.
  if (locked) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1500,
          background: "rgba(120,12,12,0.82)",
          backdropFilter: "blur(3px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "#fff",
          textAlign: "center",
          paddingInline: 24,
        }}
      >
        <div style={{ fontSize: 64 }}>🔒</div>
        <div style={{ fontSize: 24, fontWeight: 800, marginBlockStart: 12 }}>{L("lockedTitle")}</div>
        <div style={{ fontSize: 15, opacity: 0.92, marginBlockStart: 8, maxWidth: 420 }}>
          {L("lockedBody")}
        </div>
      </div>
    );
  }

  if (!mode) return null;

  return (
    <>
      {/* Teinte visuelle (laisse passer les clics) */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 900,
          background: TINT[mode],
          pointerEvents: "none",
          transition: "background 0.4s ease",
        }}
      />

      {/* Mode dôme : calque qui FIGE la page (sous le FAB Désarmer) */}
      {mode === "dome" && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1250,
            background: "transparent",
            pointerEvents: "auto",
            cursor: "not-allowed",
          }}
        />
      )}

      {/* Bandeau supérieur informatif */}
      <div
        style={{
          position: "fixed",
          insetBlockStart: 0,
          insetInlineStart: 0,
          insetInlineEnd: 0,
          zIndex: 1310,
          background: BANNER_BG[mode],
          color: "#fff",
          fontSize: 13,
          fontWeight: 700,
          textAlign: "center",
          paddingBlock: 7,
          letterSpacing: 0.2,
          boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
        }}
      >
        {L(mode)}
      </div>
    </>
  );
}
