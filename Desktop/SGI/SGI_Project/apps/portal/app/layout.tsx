import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "SGI — Espace Client & Partenaire",
  description:
    "Plateforme SGI · Infinity International Facilities Management UAE",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
