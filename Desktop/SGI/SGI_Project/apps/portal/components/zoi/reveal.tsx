"use client";

import { useEffect } from "react";

/**
 * Anime les éléments `.z-reveal` à l'entrée dans le viewport (fade + translate).
 * Monté une fois dans la coquille vitrine. Réobserve à chaque navigation client.
 * Fallback sûr : si IntersectionObserver indisponible, tout est révélé d'emblée
 * (les `.z-reveal` sont en opacity:0 → sans ce composant ils resteraient cachés).
 */
export function RevealObserver() {
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(".z-reveal:not(.in)"),
    );
    if (!els.length) return;

    if (typeof IntersectionObserver === "undefined") {
      els.forEach((el) => el.classList.add("in"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  });

  return null;
}
