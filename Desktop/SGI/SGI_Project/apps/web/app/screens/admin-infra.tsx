"use client";

/**
 * Écran Administration application · Serveurs & réseau (infra-admin, PLATEFORME).
 * 🧩 STUB Wave 0 — l'agent Wave 1 « front infra » câble cet écran sur
 *    GET /api/admin/platform/servers + /network (Prometheus). Visible seulement
 *    pour un super-admin plateforme (le backend renvoie 403 sinon). CSS logique.
 */

import React from "react";

import { useLang } from "@/components/language-provider";

const TITLE: Record<string, string> = {
  ar: "الخوادم والشبكة",
  en: "Servers & Network",
  fr: "Serveurs & réseau",
};

export function ScreenAppAdminInfra() {
  const { lang } = useLang();
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", color: "var(--ink-4)", maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🖥️</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
          {TITLE[lang] ?? TITLE.en}
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Bientôt · قريباً · Coming soon</div>
      </div>
    </div>
  );
}
