"use client";

import React from "react";
import { Topbar, IcCalendar } from "@/components/sgi-ui";
import { useT, useLang } from "@/components/language-provider";

/**
 * Calendrier interne SGI — sous-catégorie de « Real Estate » (back-office).
 *
 * Contrairement à l'« Agenda » (embed Google Calendar), ce calendrier agrège
 * les échéances métier internes : visites planifiées, échéances de contrats,
 * chèques post-datés (PDC) à déposer et rappels de mandats. Données de
 * démonstration statiques pour l'instant — un endpoint d'agrégation viendra
 * brancher /api/v1/{crm,contracts,pdc,owners}. Fuseau Asia/Dubai.
 */

const TZ = "Asia/Dubai";

// Mois affiché : mai 2026 (semaine commençant le lundi, comme l'Agenda).
const YEAR = 2026;
const MONTH_INDEX = 4; // 0-based → mai
const DAYS_IN_MONTH = 31;
const FIRST_WEEKDAY_MON0 = 4; // 1er mai 2026 = vendredi → colonne 4 (lun=0)

type EventType = "visit" | "contract" | "pdc" | "mandate";

const TYPE_COLOR: Record<EventType, string> = {
  visit: "var(--azure)",
  contract: "var(--gold)",
  pdc: "var(--emerald)",
  mandate: "var(--rose)",
};

const TYPE_LABEL: Record<EventType, { ar: string; en: string; fr: string }> = {
  visit:    { ar: "معاينة", en: "Visit", fr: "Visite" },
  contract: { ar: "عقد", en: "Contract", fr: "Contrat" },
  pdc:      { ar: "شيك مؤجل", en: "PDC due", fr: "PDC à déposer" },
  mandate:  { ar: "تذكير بالتفويض", en: "Mandate", fr: "Mandat" },
};

type CalEvent = {
  day: number;
  type: EventType;
  time: string;
  ar: string;
  en: string;
  fr: string;
};

// Données de démonstration — agrégation réelle à brancher côté API.
const EVENTS: CalEvent[] = [
  { day: 4,  type: "visit",    time: "10:00", ar: "معاينة فيلا — نخلة جميرا", en: "Villa viewing — Palm Jumeirah", fr: "Visite villa — Palm Jumeirah" },
  { day: 6,  type: "pdc",      time: "09:00", ar: "إيداع شيك PDC-2026-000182", en: "Deposit cheque PDC-2026-000182", fr: "Dépôt chèque PDC-2026-000182" },
  { day: 11, type: "contract", time: "14:30", ar: "نهاية عقد DXB-2024-1175", en: "Contract DXB-2024-1175 expiry", fr: "Échéance contrat DXB-2024-1175" },
  { day: 14, type: "mandate",  time: "—",     ar: "تجديد تفويض المالك — برج وسط المدينة", en: "Owner mandate renewal — Downtown tower", fr: "Renouvellement mandat — tour Downtown" },
  { day: 18, type: "visit",    time: "16:00", ar: "معاينة شقة — الخليج التجاري", en: "Apartment viewing — Business Bay", fr: "Visite appartement — Business Bay" },
  { day: 21, type: "pdc",      time: "09:00", ar: "إيداع شيك PDC-2026-000190", en: "Deposit cheque PDC-2026-000190", fr: "Dépôt chèque PDC-2026-000190" },
  { day: 27, type: "contract", time: "11:00", ar: "توقيع عقد بيع — مرسى دبي", en: "Sale contract signing — Dubai Marina", fr: "Signature contrat de vente — Dubai Marina" },
  { day: 30, type: "visit",    time: "13:00", ar: "معاينة مكتب — مركز دبي المالي", en: "Office viewing — DIFC", fr: "Visite bureau — DIFC" },
];

const TODAY = 30; // 30 mai 2026

export function ScreenRealEstateCalendar() {
  const t = useT();
  const { lang } = useLang();
  const l = (o: { ar: string; en: string; fr: string }) => (lang === "ar" ? o.ar : lang === "fr" ? o.fr : o.en);

  const monthLabel = new Intl.DateTimeFormat(
    lang === "ar" ? "ar-AE" : lang === "fr" ? "fr-FR" : "en-AE",
    { month: "long", year: "numeric", timeZone: TZ },
  ).format(new Date(Date.UTC(YEAR, MONTH_INDEX, 15)));

  const weekdayLabels =
    lang === "ar"
      ? ["إث", "ثل", "أر", "خم", "جم", "سب", "أح"]
      : lang === "fr"
      ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const eventsByDay = new Map<number, CalEvent[]>();
  for (const e of EVENTS) {
    const list = eventsByDay.get(e.day) ?? [];
    list.push(e);
    eventsByDay.set(e.day, list);
  }

  // Cellules de la grille (blancs en tête + jours du mois).
  const cells: (number | null)[] = [];
  for (let i = 0; i < FIRST_WEEKDAY_MON0; i++) cells.push(null);
  for (let d = 1; d <= DAYS_IN_MONTH; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const upcoming = [...EVENTS].filter(e => e.day >= TODAY).sort((a, b) => a.day - b.day);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_calendar} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        {/* En-tête : mois + fuseau + légende */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)" }}>
            <IcCalendar />
            <span className="font-display" style={{ fontSize: 18, textTransform: "capitalize" }}>{monthLabel}</span>
            <span style={{ fontSize: 12, color: "var(--ink-4)" }}>· {TZ}</span>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            {(Object.keys(TYPE_LABEL) as EventType[]).map(type => (
              <div key={type} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 9, height: 9, borderRadius: 999, background: TYPE_COLOR[type], display: "inline-block" }} />
                <span style={{ fontSize: 11.5, color: "var(--ink-3)" }}>{l(TYPE_LABEL[type])}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 320px", gap: 24, alignItems: "start" }}>
          {/* Grille calendrier */}
          <div className="sgi-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--bg-cream)", borderBottom: "1px solid var(--line-soft)" }}>
              {weekdayLabels.map(w => (
                <div key={w} style={{ padding: "10px 0", textAlign: "center", fontSize: 10.5, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-4)" }}>{w}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {cells.map((d, i) => {
                const dayEvents = d ? eventsByDay.get(d) ?? [] : [];
                const isToday = d === TODAY;
                return (
                  <div
                    key={i}
                    style={{
                      minHeight: 92,
                      borderBottom: "1px solid var(--line-soft)",
                      borderInlineEnd: (i % 7 !== 6) ? "1px solid var(--line-soft)" : "none",
                      padding: "6px 8px",
                      background: d ? "var(--bg-paper)" : "var(--bg-inset)",
                      display: "flex", flexDirection: "column", gap: 4,
                    }}
                  >
                    {d && (
                      <span
                        className="tnum"
                        style={{
                          fontSize: 12, fontWeight: isToday ? 700 : 500,
                          alignSelf: "flex-start",
                          color: isToday ? "#fff" : "var(--ink-3)",
                          background: isToday ? "var(--gold)" : "transparent",
                          borderRadius: 999, minWidth: 20, height: 20,
                          display: "inline-flex", alignItems: "center", justifyContent: "center",
                          padding: isToday ? "0 6px" : 0,
                        }}
                      >
                        {d}
                      </span>
                    )}
                    {dayEvents.map((e, j) => (
                      <span
                        key={j}
                        title={l(e)}
                        style={{
                          fontSize: 10.5, lineHeight: 1.3, color: "var(--ink-2)",
                          borderInlineStart: `3px solid ${TYPE_COLOR[e.type]}`,
                          background: `${TYPE_COLOR[e.type]}14`,
                          borderRadius: 4, padding: "2px 6px",
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}
                      >
                        {l(e)}
                      </span>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Événements à venir */}
          <div className="sgi-card" style={{ padding: 0, overflow: "hidden" }}>
            <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--line-soft)" }}>
              <div className="font-display" style={{ fontSize: 14, color: "var(--ink)" }}>
                {lang === "ar" ? "الأحداث القادمة" : lang === "fr" ? "Événements à venir" : "Upcoming events"}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {upcoming.map((e, i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "12px 18px", borderBottom: i < upcoming.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 40 }}>
                    <span className="tnum" style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", lineHeight: 1 }}>{e.day}</span>
                    <span style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{weekdayLabels[(FIRST_WEEKDAY_MON0 + e.day - 1) % 7]}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: TYPE_COLOR[e.type], display: "inline-block" }} />
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: TYPE_COLOR[e.type], textTransform: "uppercase", letterSpacing: "0.04em" }}>{l(TYPE_LABEL[e.type])}</span>
                      <span className="tnum" style={{ fontSize: 11, color: "var(--ink-4)", marginInlineStart: "auto" }}>{e.time}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.4 }}>{l(e)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
