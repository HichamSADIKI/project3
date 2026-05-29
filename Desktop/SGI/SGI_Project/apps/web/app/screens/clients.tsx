"use client";
import React from "react";
import { Topbar, IcPersonne, IcSociete, IcArrowUp, IcArrowDown } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const aed = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const KPIS = [
  { key: "personne", color: "var(--azure)",   value: "342", label_en: "Individual Clients",  label_ar: "عملاء أفراد",  label_fr: "Clients particuliers", delta: "+18 this month", up: true  },
  { key: "societe",  color: "var(--emerald)", value: "87",  label_en: "Companies",           label_ar: "شركات",        label_fr: "Sociétés",             delta: "+5 this month",  up: true  },
  { key: "active",   color: "var(--gold)",    value: "214", label_en: "Active clients",      label_ar: "عملاء نشطون",  label_fr: "Clients actifs",       delta: "50% of total",   up: null  },
  { key: "volume",   color: "var(--gold)",    value: "AED 124M", label_en: "Lifetime volume", label_ar: "حجم مدى الحياة", label_fr: "Volume total",      delta: "+22% vs 2025",   up: true  },
];

const TOP_CLIENTS = [
  { name: "Ahmed Al Demo",         type: "personne", country: "🇦🇪", volume: 12_000_000, deals: 3, status: "VIP" },
  { name: "Al Maktoum Holding",    type: "societe",  country: "🇦🇪", volume: 18_400_000, deals: 4, status: "VIP" },
  { name: "Reem Al Hashemi",       type: "personne", country: "🇦🇪", volume: 11_200_000, deals: 2, status: "VIP" },
  { name: "Abdullah Al Rashid",    type: "personne", country: "🇸🇦", volume: 8_500_000,  deals: 3, status: "Active" },
  { name: "Gulf Properties LLC",   type: "societe",  country: "🇦🇪", volume: 7_800_000,  deals: 6, status: "VIP" },
  { name: "Fatima Al Zaabi",       type: "personne", country: "🇦🇪", volume: 6_400_000,  deals: 1, status: "Active" },
  { name: "Invest Maroc SARL",     type: "societe",  country: "🇲🇦", volume: 5_200_000,  deals: 3, status: "Active" },
];

export function ScreenClients({ onNavigate }: { onNavigate?: (k: string) => void }) {
  const { lang } = useLang();
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const title = lang === "ar" ? t.nav_clients : lang === "fr" ? "Clients" : "Clients";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title} />

      <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "16px 12px" : "28px 32px", background: "var(--bg-cream)" }}>

        {/* KPI row */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
          {KPIS.map(k => (
            <div key={k.key} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
              <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginBottom: 6 }}>
                {lang === "ar" ? k.label_ar : lang === "fr" ? k.label_fr : k.label_en}
              </div>
              <div className="tnum font-display" style={{ fontSize: 26, color: "var(--ink)", lineHeight: 1, marginBottom: 6 }}>{k.value}</div>
              <div style={{ fontSize: 10.5, display: "flex", alignItems: "center", gap: 4, color: k.up === null ? "var(--ink-4)" : k.up ? "var(--emerald)" : "var(--rose)" }}>
                {k.up === true && <IcArrowUp />}{k.up === false && <IcArrowDown />}{k.delta}
              </div>
            </div>
          ))}
        </div>

        {/* Quick access cards */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 28 }}>
          {[
            { key: "personne", icon: <IcPersonne />, color: "var(--azure)", count: 342,
              en: "Individual Clients", ar: "عملاء الأفراد", fr: "Clients Particuliers",
              sub_en: "Natural persons — buyers, investors, Golden Visa applicants",
              sub_ar: "أشخاص طبيعيون — مشترون ومستثمرون وطالبو تأشيرة ذهبية",
              sub_fr: "Personnes physiques — acheteurs, investisseurs, demandeurs Visa Doré" },
            { key: "societe", icon: <IcSociete />, color: "var(--emerald)", count: 87,
              en: "Companies", ar: "الشركات", fr: "Sociétés",
              sub_en: "Legal entities — real estate companies, investment funds, corporates",
              sub_ar: "كيانات قانونية — شركات عقارية وصناديق استثمار وشركات كبرى",
              sub_fr: "Personnes morales — sociétés immobilières, fonds d'investissement, entreprises" },
          ].map(c => (
            <div
              key={c.key}
              onClick={() => onNavigate?.(c.key)}
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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ width: 42, height: 42, borderRadius: "var(--r)", background: `${c.color}15`, display: "grid", placeItems: "center", color: c.color }}>
                  {c.icon}
                </div>
                <div className="tnum font-display" style={{ fontSize: 30, color: c.color }}>{c.count}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                {lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", lineHeight: 1.55 }}>
                {lang === "ar" ? c.sub_ar : lang === "fr" ? c.sub_fr : c.sub_en}
              </div>
              <div style={{ marginTop: 16, fontSize: 11.5, fontWeight: 600, color: c.color, display: "flex", alignItems: "center", gap: 5 }}>
                {lang === "ar" ? "عرض الكل ←" : lang === "fr" ? "Voir tout →" : "View all →"}
              </div>
            </div>
          ))}
        </div>

        {/* Top clients table */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div className="font-display" style={{ fontSize: 14, color: "var(--ink)" }}>
              {lang === "ar" ? "كبار العملاء" : lang === "fr" ? "Meilleurs clients" : "Top Clients"}
            </div>
            <span
              onClick={() => onNavigate?.("personne")}
              style={{ fontSize: 11, color: "var(--gold)", cursor: "pointer" }}
            >
              {t.view_all}
            </span>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)" }}>
                {[
                  lang === "ar" ? "العميل" : lang === "fr" ? "Client" : "Client",
                  lang === "ar" ? "النوع" : lang === "fr" ? "Type" : "Type",
                  lang === "ar" ? "الصفقات" : lang === "fr" ? "Deals" : "Deals",
                  lang === "ar" ? "الحجم" : lang === "fr" ? "Volume" : "Volume",
                  lang === "ar" ? "الحالة" : lang === "fr" ? "Statut" : "Status",
                ].map(h => (
                  <th key={h} style={{ padding: "9px 18px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOP_CLIENTS.map((c, i) => (
                <tr key={c.name} style={{ borderBottom: i < TOP_CLIENTS.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                  <td style={{ padding: "12px 18px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                        background: c.type === "societe" ? "var(--emerald-soft, rgba(16,185,129,0.12))" : "rgba(59,130,246,0.12)",
                        display: "grid", placeItems: "center",
                        color: c.type === "societe" ? "var(--emerald)" : "var(--azure)",
                        fontSize: 12, fontWeight: 700,
                      }}>
                        {c.name[0]}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{c.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{c.country}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 18px" }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999,
                      background: c.type === "societe" ? "rgba(16,185,129,0.1)" : "rgba(59,130,246,0.1)",
                      color: c.type === "societe" ? "var(--emerald)" : "var(--azure)",
                    }}>
                      {c.type === "societe"
                        ? (lang === "ar" ? "شركة" : lang === "fr" ? "Société" : "Company")
                        : (lang === "ar" ? "شخص" : lang === "fr" ? "Personne" : "Individual")}
                    </span>
                  </td>
                  <td style={{ padding: "12px 18px", fontSize: 13, color: "var(--ink-2)" }} className="tnum">{c.deals}</td>
                  <td style={{ padding: "12px 18px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }} className="tnum">{aed(c.volume)}</td>
                  <td style={{ padding: "12px 18px" }}>
                    <span style={{
                      fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999,
                      background: c.status === "VIP" ? "rgba(200,160,60,0.15)" : "rgba(16,185,129,0.1)",
                      color: c.status === "VIP" ? "var(--gold-deep)" : "var(--emerald)",
                    }}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
