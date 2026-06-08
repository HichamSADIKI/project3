"use client";

/**
 * Bouton flottant « Self-Defense » DÉPLAÇABLE + menu en demi-cercle (radar/avion/dôme).
 *
 * - DRAG (souris + tactile via Pointer Events) : l'utilisateur déplace le bouton ; la
 *   position (insetInlineEnd / insetBlockEnd — RTL-safe) est clampée à l'écran (responsive)
 *   et mémorisée en localStorage. Le menu demi-cercle suit le bouton.
 * - Distinction drag vs clic : un déplacement > 4px ne déclenche PAS l'action du bouton.
 * - Protégé : au clic, si un code est requis (statut serveur), la modale s'ouvre d'abord.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

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

const FAB = 56;
const POS_KEY = "sgi_sd_fab_pos_v2";
// À GAUCHE du robot/softphone (qui sont à insetInlineEnd:20) pour être bien distinct.
const DEFAULT_ANCHOR = { ie: 88, be: 88 };

// Offsets de l'arc, relatifs à l'ancre du FAB (préservent la forme en demi-cercle).
const ARC: { mode: SelfDefenseMode; die: number; dbe: number }[] = [
  { mode: "radar", die: 0, dbe: 12 },
  { mode: "avion", die: 54, dbe: -6 },
  { mode: "dome", die: 80, dbe: -58 },
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
  const [anchor, setAnchor] = useState(DEFAULT_ANCHOR);

  const drag = useRef<{ sx: number; sy: number; ie0: number; be0: number; moved: boolean; rtl: boolean } | null>(
    null,
  );
  const justDragged = useRef(false);

  useEffect(() => {
    void fetchStatus().then((s) => setReq({ armRequired: s.arm_required, disarmRequired: s.disarm_required }));
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { ie?: number; be?: number };
        if (typeof p.ie === "number" && typeof p.be === "number") setAnchor({ ie: p.ie, be: p.be });
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Responsive : reclamper dans l'écran au redimensionnement.
  useEffect(() => {
    function onResize(): void {
      setAnchor((a) => ({
        ie: Math.min(Math.max(8, a.ie), window.innerWidth - FAB - 8),
        be: Math.min(Math.max(8, a.be), window.innerHeight - FAB - 8),
      }));
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    const sign = d.rtl ? -1 : 1; // en RTL, l'axe inline-end est inversé
    const ie = Math.min(Math.max(8, d.ie0 - sign * dx), window.innerWidth - FAB - 8);
    const be = Math.min(Math.max(8, d.be0 - dy), window.innerHeight - FAB - 8);
    setAnchor({ ie, be });
  }, []);

  const onUp = useCallback(() => {
    const d = drag.current;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (d?.moved) {
      justDragged.current = true;
      setAnchor((a) => {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(a));
        } catch {
          /* ignore */
        }
        return a;
      });
      window.setTimeout(() => {
        justDragged.current = false;
      }, 60);
    }
    drag.current = null;
  }, [onMove]);

  const onDown = useCallback(
    (e: React.PointerEvent) => {
      const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
      drag.current = { sx: e.clientX, sy: e.clientY, ie0: anchor.ie, be0: anchor.be, moved: false, rtl };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [anchor.ie, anchor.be, onMove, onUp],
  );

  if (locked) return null;

  function pick(m: SelfDefenseMode): void {
    setMode(m);
    setMenuOpen(false);
  }

  function onFab(): void {
    if (justDragged.current) return; // c'était un drag, pas un clic
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
              insetBlockEnd: menuOpen ? anchor.be + o.dbe : anchor.be,
              insetInlineEnd: menuOpen ? anchor.ie + o.die : anchor.ie,
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
        onPointerDown={onDown}
        onClick={onFab}
        style={{
          position: "fixed",
          insetBlockEnd: anchor.be,
          insetInlineEnd: anchor.ie,
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
          cursor: "grab",
          touchAction: "none", // le drag tactile ne fait pas défiler la page
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
