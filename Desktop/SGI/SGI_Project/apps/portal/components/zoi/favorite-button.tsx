"use client";

import { useState } from "react";
import { Ic, Svg } from "./icons";

/**
 * Bouton favori (cœur) — état local côté client. À brancher sur le compte
 * utilisateur en production. Empêche la navigation du lien parent au clic.
 */
export function FavoriteButton({ label }: { label: string }) {
  const [on, setOn] = useState(false);
  return (
    <button
      type="button"
      className={`z-fav ${on ? "on" : ""}`}
      aria-pressed={on}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOn((v) => !v);
      }}
    >
      <Svg d={Ic.heart} w={18} fill={on} />
    </button>
  );
}
