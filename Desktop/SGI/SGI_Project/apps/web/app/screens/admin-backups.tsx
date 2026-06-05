"use client";

/**
 * Écran Administration application · Sauvegardes (infra-admin, PLATEFORME).
 * 🧩 STUB Wave 0 — l'agent Wave 1 « front backups » câble cet écran sur
 *    GET /api/admin/platform/backups (état DB/MinIO). Super-admin plateforme only.
 */

import React from "react";

import { useLang } from "@/components/language-provider";

const TITLE: Record<string, string> = {
  ar: "النسخ الاحتياطي",
  en: "Backups",
  fr: "Sauvegardes",
};

export function ScreenAppAdminBackups() {
  const { lang } = useLang();
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", color: "var(--ink-4)", maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>💾</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
          {TITLE[lang] ?? TITLE.en}
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Bientôt · قريباً · Coming soon</div>
      </div>
    </div>
  );
}
