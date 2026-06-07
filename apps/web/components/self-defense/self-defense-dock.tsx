"use client";

/**
 * Bouton flottant « Self-Defense » + menu en demi-cercle (radar / avion / dôme).
 *
 * Le bouton est PROTÉGÉ : au clic, si un code est requis (statut serveur), la modale
 * de code s'ouvre AVANT toute action.
 * - Désarmé + code armer requis : clic → modale (arm) → succès → ouvre l'arc des modes.
 * - Désarmé sans code requis : clic → ouvre l'arc directement.
 * - Armé : FAB « Désarmer » → modale (disarm) si requis, sinon désarme directement.
 * Position bas-droite, RTL-safe (insetInlineEnd / insetBlockEnd).
 */

import React, { useEffect, useState } from "react";

import { useLang } from "@/components/language-provider";
import {
  fetchStatus,
  type SelfDefenseMode,
  type SelfDefensePurpose,
  useSelfDefense,
} from "@/lib/use-self-defense";
import { ValidationDialog } from "./validation-dialog";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: { armed: "Désarmer", title: "Self-Defense", radar: "Radar", avion: "Avion", dome: "Dôme de fer" },
  en: { armed: "Disarm", title: "Self-Defense", radar: "Radar", avion: "Jet", dome: "Iron Dome" },
  ar: { armed: "نزع التفعيل", title: "الدفاع الذاتي", radar: "رادار", avion: "طائرة", dome: "القبة الحديدية" },
};

const MODE_COLOR: Record<SelfDefenseMode, string> = {
  radar: "var(--emerald)",
  avion: "#EA8C2B",
  dome: "var(--rose)",
};
const MODE_EMOJI: Record<SelfDefenseMode, string> = { radar: "📡", avion: "✈️", dome: "🛡️" };

const ARC: { mode: SelfDefenseMode; be: number; ie: number }[] = [
  { mode: "radar", be: 100, ie: 20 },
  { mode: "avion", be: 82, ie: 74 },
  { mode: "dome", be: 30, ie: 100 },
];

export function SelfDefenseDock(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const { mode, locked, setMode } = useSelfDefense();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<{ open: boolean; purpose: SelfDefensePurpose }>({
    open: false,
    purpose: "arm",
  });
  const [req, setReq] = useState({ armRequired: false, disarmRequired: false });

  useEffect(() => {
    let cancelled = false;
    void fetchStatus().then((s) => {
      if (!cancelled) {
        setReq({ armRequired: s.arm_required, disarmRequired: s.disarm_required });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (locked) return null; // l'overlay affiche l'écran de verrouillage

  function pick(m: SelfDefenseMode): void {
    setMode(m); // déjà autorisé (code armer validé à l'ouverture du menu)
    setMenuOpen(false);
  }

  function onFab(): void {
    if (mode) {
      if (req.disarmRequired) setDialog({ open: true, purpose: "disarm" });
      else setMode(null);
    } else if (req.armRequired) {
      setDialog({ open: true, purpose: "arm" });
    } else {
      setMenuOpen((o) => !o);
    }
  }

  function onVerified(): void {
    if (dialog.purpose === "arm") setMenuOpen(true);
    else setMode(null);
  }

  const fabColor = mode ? MODE_COLOR[mode] : "var(--ink)";

  return (
    <>
      {!mode &&
        ARC.map((o, i) => (
          <button
            key={o.mode}
            type="button"
            aria-label={L(o.mode)}
            title={L(o.mode)}
            onClick={() => pick(o.mode)}
            style={{
              position: "fixed",
              insetBlockEnd: menuOpen ? o.be : 30,
              insetInlineEnd: menuOpen ? o.ie : 20,
              width: 46,
              height: 46,
              borderRadius: "50%",
              border: "2px solid #fff",
              background: MODE_COLOR[o.mode],
              color: "#fff",
              fontSize: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 6px 18px rgba(0,0,0,0.28)",
              opacity: menuOpen ? 1 : 0,
              pointerEvents: menuOpen ? "auto" : "none",
              transform: menuOpen ? "scale(1)" : "scale(0.4)",
              transition: `all 0.22s cubic-bezier(.2,.9,.3,1.2) ${menuOpen ? i * 0.05 : 0}s`,
              zIndex: 1300,
            }}
          >
            {MODE_EMOJI[o.mode]}
          </button>
        ))}

      <button
        type="button"
        aria-label={mode ? L("armed") : L("title")}
        title={mode ? L("armed") : L("title")}
        onClick={onFab}
        style={{
          position: "fixed",
          insetBlockEnd: 88,
          insetInlineEnd: 20,
          minWidth: 56,
          height: 56,
          paddingInline: mode ? 16 : 0,
          width: mode ? "auto" : 56,
          borderRadius: 28,
          border: "2px solid #fff",
          background: fabColor,
          color: "#fff",
          fontSize: mode ? 14 : 24,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: "pointer",
          boxShadow: mode
            ? `0 0 0 4px ${fabColor}33, 0 8px 22px rgba(0,0,0,0.3)`
            : "0 8px 22px rgba(0,0,0,0.3)",
          animation: mode ? "sd-pulse 1.8s ease-in-out infinite" : undefined,
          zIndex: 1301,
        }}
      >
        {mode ? `${MODE_EMOJI[mode]} ${L("armed")}` : "🛡️"}
      </button>

      <style>{`@keyframes sd-pulse{0%,100%{box-shadow:0 0 0 4px ${fabColor}33,0 8px 22px rgba(0,0,0,.3)}50%{box-shadow:0 0 0 10px ${fabColor}11,0 8px 22px rgba(0,0,0,.3)}}`}</style>

      <ValidationDialog
        open={dialog.open}
        purpose={dialog.purpose}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onVerified={onVerified}
      />
    </>
  );
}
