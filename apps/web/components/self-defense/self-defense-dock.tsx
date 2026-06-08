"use client";

/**
 * Bouton flottant « Self-Defense » DÉPLAÇABLE (ancré en HAUT-droite par défaut) +
 * menu en arc (radar / avion / dôme) qui s'ouvre vers le bas-gauche.
 *
 * - Position via insetBlockStart (haut) + insetInlineEnd (RTL-safe), clampée (responsive),
 *   mémorisée (localStorage). Drag souris + tactile (Pointer Events), drag ≠ clic (>4px).
 * - 3 orbes COLORÉES + libellés, bien espacées sur un quart de cercle (toutes visibles).
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
  fr: { armed: "Désarmer", title: "Self-Defense", radar: "Radar", avion: "Avion", dome: "Dôme" },
  en: { armed: "Disarm", title: "Self-Defense", radar: "Radar", avion: "Jet", dome: "Iron Dome" },
  ar: { armed: "نزع", title: "الدفاع", radar: "رادار", avion: "طائرة", dome: "القبة" },
};

const MODE_COLOR: Record<SelfDefenseMode, string> = {
  radar: "#10b981", // emerald
  avion: "#f59e0b", // amber/orange
  dome: "#ef4444", // red
};
const MODE_EMOJI: Record<SelfDefenseMode, string> = { radar: "📡", avion: "✈️", dome: "🛡️" };

const FAB = 56;
const ORB = 48;
const POS_KEY = "sgi_sd_fab_pos_v3";
// Haut-droite par défaut (sous la barre du haut). top = depuis le haut, ie = depuis la fin.
const DEFAULT_ANCHOR = { top: 76, ie: 24 };

// Quart de cercle ouvrant vers le bas-gauche depuis le FAB (toutes les orbes visibles).
const ARC: { mode: SelfDefenseMode; dtop: number; die: number }[] = [
  { mode: "radar", dtop: 4, die: 78 }, // gauche
  { mode: "avion", dtop: 56, die: 56 }, // bas-gauche
  { mode: "dome", dtop: 78, die: 4 }, // bas
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

  const drag = useRef<{ sx: number; sy: number; top0: number; ie0: number; moved: boolean; rtl: boolean } | null>(
    null,
  );
  const justDragged = useRef(false);

  useEffect(() => {
    void fetchStatus().then((s) => setReq({ armRequired: s.arm_required, disarmRequired: s.disarm_required }));
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { top?: number; ie?: number };
        if (typeof p.top === "number" && typeof p.ie === "number") setAnchor({ top: p.top, ie: p.ie });
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    function onResize(): void {
      setAnchor((a) => ({
        top: Math.min(Math.max(8, a.top), window.innerHeight - FAB - 8),
        ie: Math.min(Math.max(8, a.ie), window.innerWidth - FAB - 8),
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
    const sign = d.rtl ? -1 : 1;
    const ie = Math.min(Math.max(8, d.ie0 - sign * dx), window.innerWidth - FAB - 8);
    const top = Math.min(Math.max(8, d.top0 + dy), window.innerHeight - FAB - 8);
    setAnchor({ top, ie });
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
      drag.current = { sx: e.clientX, sy: e.clientY, top0: anchor.top, ie0: anchor.ie, moved: false, rtl };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [anchor.top, anchor.ie, onMove, onUp],
  );

  if (locked) return null;

  function pick(m: SelfDefenseMode): void {
    setMode(m);
    setMenuOpen(false);
  }

  function onFab(): void {
    if (justDragged.current) return;
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

  const fabColor = mode ? MODE_COLOR[mode] : "#1f2937";

  return (
    <>
      {/* Orbes du menu — montées à l'ouverture (anim d'entrée échelonnée + flair par mode) */}
      {!mode &&
        menuOpen &&
        ARC.map((o, i) => (
          <div
            key={o.mode}
            style={{
              position: "fixed",
              insetBlockStart: anchor.top + o.dtop,
              insetInlineEnd: anchor.ie + o.die,
              width: ORB,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 5,
              transformOrigin: "top center",
              animation: `sd-pop 0.5s cubic-bezier(.2,.9,.3,1.5) ${i * 0.08}s both`,
              zIndex: 1300,
            }}
          >
            <span
              style={{
                position: "relative",
                width: ORB,
                height: ORB,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Onde radar (uniquement pour le mode radar) */}
              {o.mode === "radar" && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    border: `2px solid ${MODE_COLOR.radar}`,
                    animation: "sd-radar-ring 1.6s ease-out infinite",
                    pointerEvents: "none", // l'onde ne doit pas intercepter les clics du bouton
                  }}
                />
              )}
              <button
                type="button"
                aria-label={L(o.mode)}
                onClick={() => pick(o.mode)}
                style={{
                  width: ORB,
                  height: ORB,
                  borderRadius: "50%",
                  border: "none",
                  background: `radial-gradient(circle at 32% 28%, ${MODE_COLOR[o.mode]}, ${MODE_COLOR[o.mode]}cc)`,
                  color: "#fff",
                  fontSize: 21,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: `0 6px 16px ${MODE_COLOR[o.mode]}66, 0 0 0 3px #ffffff22`,
                  animation:
                    o.mode === "avion"
                      ? "sd-fly 2.2s ease-in-out infinite"
                      : o.mode === "dome"
                        ? "sd-glow 2s ease-in-out infinite"
                        : undefined,
                }}
              >
                {MODE_EMOJI[o.mode]}
              </button>
            </span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: "#fff",
                background: "rgba(17,24,39,0.85)",
                padding: "2px 7px",
                borderRadius: 8,
                whiteSpace: "nowrap",
              }}
            >
              {L(o.mode)}
            </span>
          </div>
        ))}

      {/* FAB principal */}
      <button
        type="button"
        aria-label={mode ? L("armed") : L("title")}
        title={mode ? L("armed") : L("title")}
        onPointerDown={onDown}
        onClick={onFab}
        style={{
          position: "fixed",
          insetBlockStart: anchor.top,
          insetInlineEnd: anchor.ie,
          height: FAB,
          minWidth: FAB,
          width: mode ? "auto" : FAB,
          paddingInline: mode ? 18 : 0,
          borderRadius: FAB / 2,
          border: "none",
          background: mode
            ? `radial-gradient(circle at 32% 28%, ${fabColor}, ${fabColor}cc)`
            : "radial-gradient(circle at 32% 28%, #374151, #111827)",
          color: "#fff",
          fontSize: mode ? 14 : 25,
          fontWeight: 800,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          cursor: "grab",
          touchAction: "none",
          boxShadow: mode
            ? `0 0 0 4px ${fabColor}44, 0 10px 26px ${fabColor}66`
            : "0 10px 26px rgba(0,0,0,0.4), 0 0 0 3px #ffffff14",
          animation: mode ? "sd-pulse 1.8s ease-in-out infinite" : undefined,
          zIndex: 1301,
        }}
      >
        {mode ? `${MODE_EMOJI[mode]} ${L("armed")}` : "🛡️"}
      </button>

      <style>{`
        @keyframes sd-pulse{0%,100%{box-shadow:0 0 0 4px ${fabColor}44,0 10px 26px ${fabColor}66}50%{box-shadow:0 0 0 12px ${fabColor}11,0 10px 26px ${fabColor}66}}
        @keyframes sd-pop{0%{opacity:0;transform:scale(.2) translateY(-14px)}55%{opacity:1;transform:scale(1.16) translateY(0)}100%{transform:scale(1)}}
        @keyframes sd-radar-ring{0%{transform:scale(.6);opacity:.8}100%{transform:scale(2.2);opacity:0}}
        @keyframes sd-fly{0%,100%{transform:translateY(0) rotate(-4deg)}50%{transform:translateY(-5px) rotate(4deg)}}
        @keyframes sd-glow{0%,100%{box-shadow:0 6px 16px ${MODE_COLOR.dome}66,0 0 0 3px #ffffff22}50%{box-shadow:0 6px 24px ${MODE_COLOR.dome}aa,0 0 0 7px ${MODE_COLOR.dome}33}}
      `}</style>

      <ValidationDialog
        open={dialog.open}
        purpose={dialog.purpose}
        onClose={() => setDialog((d) => ({ ...d, open: false }))}
        onVerified={onVerified}
      />
    </>
  );
}
