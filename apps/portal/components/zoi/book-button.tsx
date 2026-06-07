"use client";

import type { PublicListing } from "@/lib/realestate";
import { Ic, Svg } from "./icons";
import { useBooking } from "./booking-modal";

/**
 * Bouton « Réserver une visite » — ouvre la modal de réservation pour l'annonce.
 * Variantes visuelles : gold (CTA fort) ou green (carte).
 */
export function BookButton({
  listing,
  label,
  variant = "green",
  large = false,
  withIcon = true,
  className,
}: {
  listing: PublicListing;
  label: string;
  variant?: "gold" | "green";
  large?: boolean;
  withIcon?: boolean;
  className?: string;
}) {
  const { open } = useBooking();
  return (
    <button
      type="button"
      className={`z-btn z-btn-${variant} ${large ? "z-btn-lg" : ""} ${className ?? ""}`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        open(listing);
      }}
    >
      {withIcon ? <Svg d={Ic.pin} w={large ? 18 : 16} /> : null}
      {label}
    </button>
  );
}
