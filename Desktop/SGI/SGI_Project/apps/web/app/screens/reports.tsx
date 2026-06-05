"use client";

/**
 * Écran Rapports — câblé sur le module backend `reporting` (remplace le mock) :
 *   GET /api/admin/reporting/overview     → KPIs transverses du tenant
 *   GET /api/admin/reporting/financial    → revenus/dépenses/net + par type
 *   GET /api/admin/reporting/rentals      → baux actifs, rent-roll, expirations
 *   GET /api/admin/reporting/maintenance  → tickets ouverts par statut/priorité
 *
 * Le backend ne fournit que des AGRÉGATS (pas de bibliothèque de documents) :
 * l'écran présente donc des synthèses réelles, pas une liste de PDF fictifs.
 * Montants AED, chiffres latins. CSS logique (Loi 3 RTL). i18n local (via useLang).
 */

import React, { useEffect, useState } from "react";

import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { getJson } from "@/lib/api-client";

type Lang = "ar" | "en" | "fr";
type Overview = {
  properties_total: number;
  clients_total: number;
  active_rentals: number;
  open_maintenance: number;
  golden_visa_pending: number;
  net_revenue: string;
};
type Financial = {
  total_revenue: string;
  total_expenses: string;
  net: string;
  pending_amount: string;
  paid_by_type: Record<string, string>;
};
type Rentals = {
  active_count: number;
  by_status: Record<string, number>;
  monthly_rent_roll: string;
  expiring_soon: number;
};
type Maintenance = {
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  open_count: number;
};

const aed = (n: string | number): string =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(
    Number(n) || 0,
  );

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Rapports", overview: "Vue d'ensemble", properties: "Biens", clients: "Clients",
    activeRentals: "Baux actifs", openMaint: "Maintenance ouverte", gvPending: "Golden Visa en attente",
    netRevenue: "Revenu net", financial: "Finances", revenue: "Revenus", expenses: "Dépenses", net: "Net",
    pending: "En attente", byType: "Par type", rentals: "Locations", rentRoll: "Rent-roll mensuel",
    expiring: "Expirent bientôt", maintenance: "Maintenance", openTickets: "Tickets ouverts",
    byStatus: "Par statut", byPriority: "Par priorité", loading: "Chargement…", none: "—",
  },
  en: {
    title: "Reports", overview: "Overview", properties: "Properties", clients: "Clients",
    activeRentals: "Active rentals", openMaint: "Open maintenance", gvPending: "Golden Visa pending",
    netRevenue: "Net revenue", financial: "Financial", revenue: "Revenue", expenses: "Expenses", net: "Net",
    pending: "Pending", byType: "By type", rentals: "Rentals", rentRoll: "Monthly rent-roll",
    expiring: "Expiring soon", maintenance: "Maintenance", openTickets: "Open tickets",
    byStatus: "By status", byPriority: "By priority", loading: "Loading…", none: "—",
  },
  ar: {
    title: "التقارير", overview: "نظرة عامة", properties: "العقارات", clients: "العملاء",
    activeRentals: "عقود نشطة", openMaint: "صيانة مفتوحة", gvPending: "الإقامة الذهبية معلّقة",
    netRevenue: "صافي الإيراد", financial: "المالية", revenue: "الإيرادات", expenses: "المصروفات", net: "الصافي",
    pending: "معلّق", byType: "حسب النوع", rentals: "الإيجارات", rentRoll: "إجمالي الإيجار الشهري",
    expiring: "تنتهي قريباً", maintenance: "الصيانة", openTickets: "تذاكر مفتوحة",
    byStatus: "حسب الحالة", byPriority: "حسب الأولوية", loading: "جارٍ التحميل…", none: "—",
  },
};

const card: React.CSSProperties = {
  flex: "1 1 300px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)",
  borderRadius: 12, padding: 16,
};

export function ScreenReports(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [ov, setOv] = useState<Overview | null>(null);
  const [fin, setFin] = useState<Financial | null>(null);
  const [rent, setRent] = useState<Rentals | null>(null);
  const [maint, setMaint] = useState<Maintenance | null>(null);

  useEffect(() => {
    getJson<Overview>("/api/admin/reporting/overview").then(setOv).catch(() => setOv(null));
    getJson<Financial>("/api/admin/reporting/financial").then(setFin).catch(() => setFin(null));
    getJson<Rentals>("/api/admin/reporting/rentals?expiring_days=120").then(setRent).catch(() => setRent(null));
    getJson<Maintenance>("/api/admin/reporting/maintenance").then(setMaint).catch(() => setMaint(null));
  }, []);

  const kpi = (label: string, value: string | number, accent?: string): React.ReactNode => (
    <div style={{ flex: "1 1 130px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBlockEnd: 6 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: accent ?? "var(--ink)" }}>{value}</div>
    </div>
  );
  const row = (label: string, value: string, accent?: string): React.ReactNode => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", fontSize: 12.5 }}>
      <span style={{ color: "var(--ink-3)", textAlign: "start" }}>{label}</span>
      <span style={{ fontWeight: 600, color: accent ?? "var(--ink)" }}>{value}</span>
    </div>
  );
  const dist = (m: Record<string, number> | undefined): React.ReactNode =>
    m && Object.keys(m).length ? (
      <>{Object.entries(m).map(([k, v]) => row(k, String(v)))}</>
    ) : (
      <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L("none")}</div>
    );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={L("title")} />
      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16, background: "var(--bg-cream)" }}>
        {/* Vue d'ensemble — KPIs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {kpi(L("properties"), ov ? ov.properties_total : "—")}
          {kpi(L("clients"), ov ? ov.clients_total : "—")}
          {kpi(L("activeRentals"), ov ? ov.active_rentals : "—")}
          {kpi(L("openMaint"), ov ? ov.open_maintenance : "—", "var(--rose)")}
          {kpi(L("gvPending"), ov ? ov.golden_visa_pending : "—")}
          {kpi(L("netRevenue"), ov ? aed(ov.net_revenue) : "—", "var(--emerald)")}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {/* Finances */}
          <div style={card}>
            <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBlockEnd: 10 }}>{L("financial")}</div>
            {fin ? (
              <>
                {row(L("revenue"), aed(fin.total_revenue), "var(--emerald)")}
                {row(L("expenses"), aed(fin.total_expenses), "var(--rose)")}
                {row(L("net"), aed(fin.net))}
                {row(L("pending"), aed(fin.pending_amount))}
                <div style={{ borderTop: "1px solid var(--line-soft)", margin: "8px 0" }} />
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBlockEnd: 4 }}>{L("byType")}</div>
                {Object.keys(fin.paid_by_type).length
                  ? Object.entries(fin.paid_by_type).map(([k, v]) => row(k, aed(v)))
                  : <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L("none")}</div>}
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L("loading")}</div>
            )}
          </div>

          {/* Locations */}
          <div style={card}>
            <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBlockEnd: 10 }}>{L("rentals")}</div>
            {rent ? (
              <>
                {row(L("activeRentals"), String(rent.active_count))}
                {row(L("rentRoll"), aed(rent.monthly_rent_roll), "var(--emerald)")}
                {row(L("expiring"), String(rent.expiring_soon), "var(--gold-deep)")}
                <div style={{ borderTop: "1px solid var(--line-soft)", margin: "8px 0" }} />
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBlockEnd: 4 }}>{L("byStatus")}</div>
                {dist(rent.by_status)}
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L("loading")}</div>
            )}
          </div>

          {/* Maintenance */}
          <div style={card}>
            <div className="font-display" style={{ fontSize: 14, fontWeight: 600, marginBlockEnd: 10 }}>{L("maintenance")}</div>
            {maint ? (
              <>
                {row(L("openTickets"), String(maint.open_count), "var(--rose)")}
                <div style={{ borderTop: "1px solid var(--line-soft)", margin: "8px 0" }} />
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBlockEnd: 4 }}>{L("byStatus")}</div>
                {dist(maint.by_status)}
                <div style={{ borderTop: "1px solid var(--line-soft)", margin: "8px 0" }} />
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBlockEnd: 4 }}>{L("byPriority")}</div>
                {dist(maint.by_priority)}
              </>
            ) : (
              <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L("loading")}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
