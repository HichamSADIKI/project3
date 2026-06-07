/**
 * Icônes inline (paths SVG) pour la vitrine luxe — pas de dépendance externe.
 * Repris du design Claude « ZOI Signature ». `currentColor` → héritent la couleur.
 */
import type { ReactNode } from "react";

export const Ic: Record<string, ReactNode> = {
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
  ),
  mail: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m2 7 10 6 10-6" />
    </>
  ),
  pin: (
    <>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  bed: (
    <path d="M2 9v11M2 13h20v7M22 13V9a2 2 0 0 0-2-2h-6v6M6 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
  ),
  bath: (
    <path d="M4 12V5a2 2 0 0 1 2-2 2 2 0 0 1 2 2M4 12h17a1 1 0 0 1 1 1v3a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4ZM6 20l-1 2M19 20l1 2" />
  ),
  area: (
    <>
      <path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" />
    </>
  ),
  heart: (
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z" />
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  chev: <path d="m6 9 6 6 6-6" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  play: <path d="M6 4l14 8-14 8z" />,
  shield: (
    <>
      <path d="M12 2 4 6v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="m8.2 13.4-1.2 8 5-3 5 3-1.2-8" />
    </>
  ),
  handshake: (
    <path d="m11 17 2 2a1 1 0 0 0 1.4 0l3.6-3.6M3 11l4-4 4 3 3-3 6 6-3 3-3-3" />
  ),
  fb: (
    <path d="M14 9h3V5h-3a4 4 0 0 0-4 4v2H8v4h2v6h4v-6h3l1-4h-4V9a1 1 0 0 1 1-1Z" />
  ),
  tw: (
    <path d="M22 4c-.7.5-1.5.8-2.3 1A3.6 3.6 0 0 0 13.5 8v1A8.5 8.5 0 0 1 4 5s-4 9 5 13a9.6 9.6 0 0 1-6 2c9 5 20 0 20-11.5 0-.3 0-.6-.1-.8A6.6 6.6 0 0 0 22 4Z" />
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  moon: <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  building: (
    <>
      <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3" />
      <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
    </>
  ),
};

export function Svg({
  d,
  w = 20,
  fill = false,
}: {
  d: ReactNode;
  w?: number;
  fill?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={w}
      height={w}
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {d}
    </svg>
  );
}
