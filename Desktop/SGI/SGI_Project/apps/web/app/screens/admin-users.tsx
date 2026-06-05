"use client";

/**
 * Écran Administration application · Utilisateurs & permissions (app-admin, tenant).
 * 🧩 STUB Wave 0 — l'agent Wave 1 « front users » câble cet écran sur
 *    GET/POST /api/admin/appadmin/users (au-dessus d'IAM). CSS logique (Loi 3).
 */

import React from "react";

import { useLang } from "@/components/language-provider";

const TITLE: Record<string, string> = {
  ar: "المستخدمون والصلاحيات",
  en: "Users & Permissions",
  fr: "Utilisateurs & permissions",
};

export function ScreenAppAdminUsers() {
  const { lang } = useLang();
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", color: "var(--ink-4)", maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>👥</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>
          {TITLE[lang] ?? TITLE.en}
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Bientôt · قريباً · Coming soon</div>
      </div>
    </div>
  );
}
