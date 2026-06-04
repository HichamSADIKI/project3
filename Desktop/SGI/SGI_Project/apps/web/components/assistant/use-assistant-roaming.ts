"use client";

/**
 * Moteur de déplacement « vivant » de l'avatar assistant.
 *
 * Anime la position de l'avatar (ressort/easing via requestAnimationFrame, DOM
 * piloté en direct par refs — aucun re-render par frame) selon un automate de
 * priorité :
 *   parked (chat ouvert) > rescue (problème détecté) > field (champ focus) >
 *   follow (souris active) > idle (retour au coin / patrouille douce)
 *
 * Le regard (pupilles) suit toujours le curseur → effet vivant. Détection de
 * problème PROACTIVE MAIS MESURÉE (anti-spam) : champ invalide à la soumission,
 * apparition d'une alerte (role="alert"), inactivité prolongée.
 *
 * Respecte `prefers-reduced-motion` (désactive le roaming, l'avatar reste au
 * coin) et un mode « figé » (pinned) contrôlé par l'appelant.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Translations } from "@/lib/i18n";

export type RoamMode = "idle" | "follow" | "field" | "rescue" | "parked";
export type AssistantTip = { text: string; tone: "info" | "rescue"; prompt?: string } | null;

const SIZE = 52;
const HALF = SIZE / 2;
const EDGE = 8;
// Décalage du coin « maison » (à côté du dock softphone, inline-end).
const HOME_INLINE_END = 84;
const HOME_BLOCK_END = 20;
// Fenêtres temporelles (ms).
const FOLLOW_WINDOW = 2500; // souris considérée « active »
const RESCUE_HOLD = 6000; // durée d'un secours
const IDLE_DELAY = 30000; // inactivité avant nudge
const PROACTIVE_COOLDOWN = 18000; // anti-spam entre bulles proactives

type XY = { x: number; y: number };

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function isField(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "TEXTAREA") return true;
  if (tag === "INPUT") {
    const type = (el as HTMLInputElement).type;
    return !["checkbox", "radio", "button", "submit", "file", "range", "color"].includes(type);
  }
  return (el as HTMLElement).isContentEditable;
}

export function useAssistantRoaming(opts: {
  open: boolean;
  pinned: boolean;
  t: Translations;
  onSummon: (prompt?: string) => void;
}): {
  containerRef: React.RefObject<HTMLDivElement | null>;
  pupilLRef: React.RefObject<HTMLSpanElement | null>;
  pupilRRef: React.RefObject<HTMLSpanElement | null>;
  mode: RoamMode;
  tip: AssistantTip;
  dismissTip: () => void;
  tipBelow: boolean;
} {
  const { open, pinned, t } = opts;

  const containerRef = useRef<HTMLDivElement | null>(null);
  const pupilLRef = useRef<HTMLSpanElement | null>(null);
  const pupilRRef = useRef<HTMLSpanElement | null>(null);

  const [mode, setMode] = useState<RoamMode>("idle");
  const [tip, setTip] = useState<AssistantTip>(null);
  const [tipBelow, setTipBelow] = useState(false);

  // État runtime (refs → pas de re-render par frame).
  const pos = useRef<XY>({ x: 0, y: 0 });
  const seeded = useRef(false);
  const mouse = useRef<{ x: number; y: number; t: number }>({ x: 0, y: 0, t: 0 });
  const lastActivity = useRef<number>(0);
  const focused = useRef<HTMLElement | null>(null);
  const rescue = useRef<{ el: HTMLElement | null; until: number; prompt?: string } | null>(null);
  const lastProactive = useRef<number>(0);
  const lastMsg = useRef<string>("");
  const modeRef = useRef<RoamMode>("idle");
  const tipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduced = useRef(false);

  const home = useCallback(
    (): XY => ({
      x: window.innerWidth - HOME_INLINE_END - HALF,
      y: window.innerHeight - HOME_BLOCK_END - SIZE,
    }),
    [],
  );

  const dismissTip = useCallback(() => {
    if (tipTimer.current) clearTimeout(tipTimer.current);
    setTip(null);
  }, []);

  // Affiche une bulle proactive (anti-spam : même message rapproché ignoré).
  const showTip = useCallback(
    (text: string, tone: "info" | "rescue", prompt?: string) => {
      const now = performance.now();
      if (text === lastMsg.current && now - lastProactive.current < PROACTIVE_COOLDOWN) return;
      lastProactive.current = now;
      lastMsg.current = text;
      setTipBelow(pos.current.y < 150);
      setTip({ text, tone, prompt });
      if (tipTimer.current) clearTimeout(tipTimer.current);
      tipTimer.current = setTimeout(() => setTip(null), RESCUE_HOLD);
    },
    [],
  );

  // Ancre un élément cible : à côté de son bord inline-end, centré verticalement,
  // clampé dans le viewport (RTL → on se place du côté inline-start).
  const anchorOf = useCallback((el: HTMLElement): XY => {
    const r = el.getBoundingClientRect();
    const rtl = document.documentElement.dir === "rtl";
    const x = rtl ? r.left - SIZE - 12 : r.right + 12;
    const y = r.top + r.height / 2 - HALF;
    return {
      x: clamp(x, EDGE, window.innerWidth - SIZE - EDGE),
      y: clamp(y, EDGE, window.innerHeight - SIZE - EDGE),
    };
  }, []);

  // ── Écouteurs globaux (activité, focus, problèmes) ──────────────────────
  useEffect(() => {
    reduced.current =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onMove = (e: MouseEvent): void => {
      mouse.current = { x: e.clientX, y: e.clientY, t: performance.now() };
      lastActivity.current = performance.now();
    };
    const onKey = (): void => {
      lastActivity.current = performance.now();
    };
    const onFocusIn = (e: FocusEvent): void => {
      const el = e.target as Element | null;
      // Ignore le propre textarea de l'assistant (data-assistant).
      if (el && (el as HTMLElement).closest?.("[data-assistant-ui]")) return;
      focused.current = isField(el) ? (el as HTMLElement) : null;
    };
    const onFocusOut = (): void => {
      focused.current = null;
    };
    // Champ invalide à la soumission (contrainte HTML5) → secours ciblé.
    const onInvalid = (e: Event): void => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      rescue.current = { el, until: performance.now() + RESCUE_HOLD };
      showTip(t.assistant_tip_field, "rescue", t.assistant_tip_field);
    };

    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("keydown", onKey, { passive: true });
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    window.addEventListener("invalid", onInvalid, true);

    // Apparition d'une alerte (toast / message d'erreur) → secours.
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const node of Array.from(m.addedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          const alert =
            node.matches?.('[role="alert"]') ? node : node.querySelector?.('[role="alert"]');
          if (alert instanceof HTMLElement) {
            rescue.current = { el: alert, until: performance.now() + RESCUE_HOLD };
            showTip(t.assistant_tip_error, "rescue", t.assistant_tip_error);
            return;
          }
        }
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });

    // Nudge d'inactivité (proactif mesuré).
    const idleTimer = window.setInterval(() => {
      if (open || pinned || reduced.current) return;
      if (performance.now() - lastActivity.current > IDLE_DELAY) {
        showTip(t.assistant_tip_idle, "info");
        lastActivity.current = performance.now(); // ne pas répéter en boucle
      }
    }, 5000);

    lastActivity.current = performance.now();

    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("invalid", onInvalid, true);
      obs.disconnect();
      window.clearInterval(idleTimer);
    };
  }, [open, pinned, t, showTip]);

  // ── Boucle d'animation ──────────────────────────────────────────────────
  useEffect(() => {
    if (!seeded.current) {
      pos.current = home();
      seeded.current = true;
    }

    const place = (): void => {
      const c = containerRef.current;
      if (c) c.style.transform = `translate3d(${pos.current.x}px, ${pos.current.y}px, 0)`;
    };

    const updateEyes = (): void => {
      const cx = pos.current.x + HALF;
      const cy = pos.current.y + HALF;
      const dx = mouse.current.x - cx;
      const dy = mouse.current.y - cy;
      const a = Math.atan2(dy, dx);
      const d = Math.min(2.2, Math.hypot(dx, dy) / 40);
      const px = Math.cos(a) * d;
      const py = Math.sin(a) * d;
      if (pupilLRef.current)
        pupilLRef.current.style.transform = `translate(${px}px, ${py}px)`;
      if (pupilRRef.current)
        pupilRRef.current.style.transform = `translate(${px}px, ${py}px)`;
    };

    // Mouvement réduit ou figé : on reste au coin, regard seul.
    if (reduced.current || pinned) {
      pos.current = open ? home() : home();
      place();
      let raf = 0;
      const eyesOnly = (): void => {
        updateEyes();
        raf = requestAnimationFrame(eyesOnly);
      };
      raf = requestAnimationFrame(eyesOnly);
      if (modeRef.current !== "idle") {
        modeRef.current = "idle";
        setMode("idle");
      }
      return () => cancelAnimationFrame(raf);
    }

    let raf = 0;
    const loop = (): void => {
      const now = performance.now();
      let m: RoamMode;
      let target: XY;
      let ease: number;

      if (open) {
        m = "parked";
        target = home();
        ease = 0.14;
      } else if (rescue.current && now < rescue.current.until && rescue.current.el?.isConnected) {
        m = "rescue";
        target = anchorOf(rescue.current.el);
        ease = 0.17;
      } else if (focused.current && focused.current.isConnected && isField(focused.current)) {
        m = "field";
        target = anchorOf(focused.current);
        ease = 0.1;
      } else if (now - mouse.current.t < FOLLOW_WINDOW) {
        m = "follow";
        // À côté du curseur (décalé inline + bas) pour ne jamais le recouvrir.
        const rtl = document.documentElement.dir === "rtl";
        target = { x: mouse.current.x + (rtl ? -SIZE - 24 : 24), y: mouse.current.y + 24 };
        ease = 0.08;
      } else {
        m = "idle";
        target = home();
        ease = 0.03;
      }

      pos.current.x += (target.x - pos.current.x) * ease;
      pos.current.y += (target.y - pos.current.y) * ease;
      pos.current.x = clamp(pos.current.x, EDGE, window.innerWidth - SIZE - EDGE);
      pos.current.y = clamp(pos.current.y, EDGE, window.innerHeight - SIZE - EDGE);
      place();
      updateEyes();

      if (m !== modeRef.current) {
        modeRef.current = m;
        setMode(m);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [open, pinned, home, anchorOf]);

  return { containerRef, pupilLRef, pupilRRef, mode, tip, dismissTip, tipBelow };
}
