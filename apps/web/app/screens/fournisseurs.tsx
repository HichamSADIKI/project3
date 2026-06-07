"use client";
import React from "react";
import { Topbar, IcDoc, IcClients, IcArrowUp } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

/** Vue d'ensemble de la catégorie Fournisseurs (prestataires externes).
 *  Accès rapide vers les fiches fournisseurs (réutilise le module vendors)
 *  et l'écran de validation des comptes inscrits via le portail. */

const KPIS = [
  { key: "total",   color: "var(--azure)",   value: "—",  label_en: "Total suppliers",  label_ar: "إجمالي المورّدين", label_fr: "Total fournisseurs" },
  { key: "active",  color: "var(--emerald)", value: "—",  label_en: "Active",           label_ar: "نشطون",            label_fr: "Actifs" },
  { key: "pending", color: "var(--gold)",    value: "—",  label_en: "Pending approval", label_ar: "بانتظار الاعتماد", label_fr: "En attente de validation" },
  { key: "rating",  color: "var(--gold)",    value: "—",  label_en: "Avg. rating",      label_ar: "متوسط التقييم",    label_fr: "Note moyenne" },
];

export function ScreenFournisseurs({ onNavigate }: { onNavigate?: (k: string) => void }) {
  const { lang } = useLang();
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const cards = [
    {
      key: "fournisseurs_fiches", icon: <IcDoc />, color: "var(--azure)",
      en: "Supplier records", ar: "بطاقات المورّدين", fr: "Fiches fournisseurs",
      sub_en: "Manage external providers — trade licence, insurance, ratings, marketplace eligibility",
      sub_ar: "إدارة مزوّدي الخدمات — الرخصة التجارية والتأمين والتقييمات وأهلية السوق",
      sub_fr: "Gérer les prestataires — licence commerciale, assurance, notes, éligibilité marketplace",
    },
    {
      key: "fournisseurs_validation", icon: <IcClients />, color: "var(--gold)",
      en: "Vendor approval", ar: "اعتماد المورّدين", fr: "Validation fournisseurs",
      sub_en: "Review portal-registered suppliers and approve or reject their accounts",
      sub_ar: "مراجعة المورّدين المسجّلين عبر البوابة واعتماد حساباتهم أو رفضها",
      sub_fr: "Examiner les fournisseurs inscrits via le portail et valider ou rejeter leurs comptes",
    },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_fournisseurs} />

      <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "16px 12px" : "28px 32px", background: "var(--bg-cream)" }}>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
          {KPIS.map(k => (
            <div key={k.key} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
              <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginBottom: 6 }}>
                {lang === "ar" ? k.label_ar : lang === "fr" ? k.label_fr : k.label_en}
              </div>
              <div className="tnum font-display" style={{ fontSize: 26, color: "var(--ink)", lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
              <div style={{ fontSize: 10.5, display: "flex", alignItems: "center", gap: 4, color: "var(--ink-4)" }}>
                <IcArrowUp />{lang === "ar" ? "محدّث آنياً" : lang === "fr" ? "Temps réel" : "Live"}
              </div>
            </div>
          ))}
        </div>

        {/* Quick access cards */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: 16 }}>
          {cards.map(c => (
            <div
              key={c.key}
              onClick={() => onNavigate?.(c.key)}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") onNavigate?.(c.key); }}
              style={{
                background: "var(--bg-paper)", border: `1px solid ${c.color}30`,
                borderRadius: "var(--r)", padding: "22px 24px", cursor: "pointer",
                transition: "box-shadow 0.15s, transform 0.15s",
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-2)";
                (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.boxShadow = "none";
                (e.currentTarget as HTMLDivElement).style.transform = "none";
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: "var(--r)", background: `${c.color}15`, display: "grid", placeItems: "center", color: c.color, marginBottom: 14 }}>
                {c.icon}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                {lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", lineHeight: 1.55 }}>
                {lang === "ar" ? c.sub_ar : lang === "fr" ? c.sub_fr : c.sub_en}
              </div>
              <div style={{ marginTop: 16, fontSize: 11.5, fontWeight: 600, color: c.color, display: "flex", alignItems: "center", gap: 5 }}>
                {lang === "ar" ? "فتح ←" : lang === "fr" ? "Ouvrir →" : "Open →"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
