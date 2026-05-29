"use client";

import React from "react";
import { Topbar, IcCalendar } from "@/components/sgi-ui";
import { useT, useLang } from "@/components/language-provider";

/**
 * Agenda Google Calendar — sous-catégorie de « Real Estate » (back-office).
 *
 * La source du calendrier est configurée via l'env publique
 * NEXT_PUBLIC_GOOGLE_CALENDAR_SRC (ID/email du calendrier Google, ex.
 * « equipe@group.calendar.google.com »). Aucun ID n'est codé en dur.
 * Fuseau forcé sur Asia/Dubai ; la langue de l'UI Google suit la langue SGI.
 */

const CAL_SRC = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_SRC ?? "";
const TZ = "Asia/Dubai";

function buildEmbedUrl(src: string, hl: string): string {
  const params = new URLSearchParams({
    src,
    ctz: TZ,
    hl,
    wkst: "2",          // semaine commençant le lundi
    mode: "WEEK",
    showPrint: "0",
    showTabs: "1",
    showCalendars: "0",
  });
  return `https://calendar.google.com/calendar/embed?${params.toString()}`;
}

export function ScreenRealEstateAgenda() {
  const t = useT();
  const { lang } = useLang();
  const hl = lang === "ar" ? "ar" : lang === "fr" ? "fr" : "en";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_agenda} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18, color: "var(--ink-3)" }}>
          <IcCalendar />
          <span style={{ fontSize: 13 }}>{TZ} · Google Calendar</span>
        </div>

        {CAL_SRC ? (
          <div
            className="sgi-card"
            style={{ padding: 0, overflow: "hidden", height: "calc(100vh - 200px)", minHeight: 480 }}
          >
            <iframe
              title={t.nav_agenda}
              src={buildEmbedUrl(CAL_SRC, hl)}
              style={{ border: 0, width: "100%", height: "100%", display: "block" }}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </div>
        ) : (
          <div className="sgi-card" style={{ padding: "32px 28px", maxWidth: 640 }}>
            <div className="font-display" style={{ fontSize: 18, marginBottom: 10 }}>
              {t.nav_agenda}
            </div>
            <p style={{ fontSize: 13.5, color: "var(--ink-3)", lineHeight: 1.6, marginBottom: 14 }}>
              {lang === "ar"
                ? "لم تتم تهيئة تقويم Google بعد. أضف معرّف التقويم في متغيّر البيئة التالي ثم أعد تشغيل التطبيق:"
                : lang === "fr"
                ? "L'agenda Google n'est pas encore configuré. Renseignez l'ID du calendrier dans la variable d'environnement suivante, puis redémarrez l'application :"
                : "Google Calendar is not configured yet. Set the calendar ID in the following environment variable, then restart the app:"}
            </p>
            <code
              className="font-mono"
              style={{
                display: "block", padding: "10px 14px", borderRadius: "var(--r)",
                background: "var(--bg-inset)", border: "1px solid var(--line-soft)",
                fontSize: 12.5, color: "var(--ink)", wordBreak: "break-all",
              }}
            >
              NEXT_PUBLIC_GOOGLE_CALENDAR_SRC=equipe@group.calendar.google.com
            </code>
            <p style={{ fontSize: 12, color: "var(--ink-4)", lineHeight: 1.6, marginTop: 14 }}>
              {lang === "ar"
                ? "المعرّف موجود في إعدادات تقويم Google › دمج التقويم › معرّف التقويم."
                : lang === "fr"
                ? "L'ID se trouve dans Google Agenda › Paramètres du calendrier › Intégrer l'agenda › ID de l'agenda."
                : "Find the ID in Google Calendar › Calendar settings › Integrate calendar › Calendar ID."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
