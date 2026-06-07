"use client";

/**
 * Écran Dashboard — Tableau de bord exécutif (BI), câblé sur le backend :
 *   GET /api/admin/reporting/executive → instantané KPI consolidé multi-modules
 *     (finance, trésorerie, créances, ventes, locatif, rent roll, CRM, occupation).
 *
 * Montants en AED (chiffres latins). CSS strictement logique (Loi 3 RTL).
 * Libellés localisés en local (via useLang) pour ne pas toucher i18n.ts partagé.
 */

import React, { useEffect, useState } from "react";

import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Chip } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useCurrentUser } from "@/lib/permissions";
import { getJson } from "@/lib/api-client";
import { FavoritesPanel } from "@/components/favorites-panel";

type Lang = "ar" | "en" | "fr";

type Bucket = { label: string; expected_in: string; expected_out: string; net: string };
type Exec = {
  headline: {
    net_paid: string; pending_amount: string; overdue_total: string; overdue_count: number;
    monthly_rent_roll: string; occupancy_rate_pct: number; active_leads: number;
    sales_completed_value: string; open_offers_amount: string;
  };
  overview: {
    properties_total: number; clients_total: number; active_rentals: number;
    open_maintenance: number; golden_visa_pending: number; net_revenue: string;
  };
  finance: {
    total_revenue: string; total_expenses: string; net: string;
    pending_invoices: number; pending_amount: string; paid_this_month: string;
  };
  cashflow: { buckets: Bucket[]; total_in: string; total_out: string; net: string };
  receivables: {
    buckets: { current: string; d1_30: string; d31_60: string; d61_90: string; d90plus: string };
    total: string; count: number;
  };
  sales: {
    listings?: { active_count?: number };
    offers?: { open_amount_aed?: string };
    transactions?: { completed_value_aed?: string; completed_commission_aed?: string };
  };
  leasing: {
    listings?: { active_count?: number; active_monthly_rent_aed?: string };
    applications?: { in_progress_count?: number; converted_count?: number };
  };
  rentals: { active_count?: number; total_count?: number; monthly_rent_aed?: string; annual_rent_aed?: string };
  crm: Record<string, number>;
  units: { by_status?: Record<string, number>; total_units?: number; occupancy_rate_pct?: number };
};

const aed = (n: string | number): string =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(Number(n) || 0);

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Tableau de bord", hello: "Bonjour", loading: "Chargement…", error: "Données indisponibles.",
    netPaid: "Résultat encaissé", rentRoll: "Loyer mensuel récurrent", overdue: "Impayés", occupancy: "Taux d'occupation",
    activeLeads: "Prospects actifs", salesDone: "Ventes clôturées", invoices: "factures", units: "lots",
    finance: "Finance", revenue: "Revenus", expenses: "Dépenses", net: "Net", pending: "En attente",
    cashflow: "Prévision trésorerie", in: "Entrées", out: "Sorties",
    receivables: "Balance âgée (impayés)", current: "Courant", b30: "1-30 j", b60: "31-60 j", b90: "61-90 j", b90p: "90+ j", total: "Total",
    sales: "Pipeline ventes", leasing: "Pipeline locatif", crmTitle: "Pipeline CRM", occTitle: "Occupation",
    listingsActive: "Annonces actives", offersOpen: "Offres en cours", txnValue: "Valeur clôturée", commission: "Commission",
    appsInProgress: "Candidatures en cours", converted: "Converties", leasingRent: "Loyer annonces actives",
    overview: "Aperçu", properties: "Biens", clients: "Clients", rentalsActive: "Baux actifs", maintenance: "Maintenance ouverte", gv: "Golden Visa en cours",
    empty: "—",
  },
  en: {
    title: "Dashboard", hello: "Hello", loading: "Loading…", error: "Data unavailable.",
    netPaid: "Net collected", rentRoll: "Recurring monthly rent", overdue: "Overdue", occupancy: "Occupancy rate",
    activeLeads: "Active leads", salesDone: "Closed sales", invoices: "invoices", units: "units",
    finance: "Finance", revenue: "Revenue", expenses: "Expenses", net: "Net", pending: "Pending",
    cashflow: "Cash-flow forecast", in: "In", out: "Out",
    receivables: "Aged receivables", current: "Current", b30: "1-30 d", b60: "31-60 d", b90: "61-90 d", b90p: "90+ d", total: "Total",
    sales: "Sales pipeline", leasing: "Leasing pipeline", crmTitle: "CRM pipeline", occTitle: "Occupancy",
    listingsActive: "Active listings", offersOpen: "Open offers", txnValue: "Closed value", commission: "Commission",
    appsInProgress: "Applications in progress", converted: "Converted", leasingRent: "Active listings rent",
    overview: "Overview", properties: "Properties", clients: "Clients", rentalsActive: "Active leases", maintenance: "Open maintenance", gv: "Golden Visa pending",
    empty: "—",
  },
  ar: {
    title: "لوحة القيادة", hello: "مرحبًا", loading: "جارٍ التحميل…", error: "البيانات غير متاحة.",
    netPaid: "صافي محصّل", rentRoll: "الإيجار الشهري المتكرر", overdue: "متأخرات", occupancy: "نسبة الإشغال",
    activeLeads: "عملاء محتملون نشطون", salesDone: "مبيعات مُغلقة", invoices: "فواتير", units: "وحدات",
    finance: "المالية", revenue: "الإيرادات", expenses: "المصروفات", net: "الصافي", pending: "معلّق",
    cashflow: "توقّع التدفّق النقدي", in: "داخل", out: "خارج",
    receivables: "أعمار الذمم", current: "جارٍ", b30: "1-30 يوم", b60: "31-60 يوم", b90: "61-90 يوم", b90p: "+90 يوم", total: "الإجمالي",
    sales: "مسار المبيعات", leasing: "مسار التأجير", crmTitle: "مسار العملاء", occTitle: "الإشغال",
    listingsActive: "إعلانات نشطة", offersOpen: "عروض مفتوحة", txnValue: "قيمة مُغلقة", commission: "عمولة",
    appsInProgress: "طلبات قيد المعالجة", converted: "محوّلة", leasingRent: "إيجار الإعلانات النشطة",
    overview: "نظرة عامة", properties: "العقارات", clients: "العملاء", rentalsActive: "عقود نشطة", maintenance: "صيانة مفتوحة", gv: "إقامة ذهبية قيد المعالجة",
    empty: "—",
  },
};

const CRM_ORDER = ["new", "contacted", "qualified", "proposal_sent", "visit_planned", "visit_done", "negotiation", "won", "lost"] as const;
const CRM_LABEL: Record<Lang, Record<string, string>> = {
  fr: { new: "Nouveau", contacted: "Contacté", qualified: "Qualifié", proposal_sent: "Proposition", visit_planned: "Visite prévue", visit_done: "Visite faite", negotiation: "Négociation", won: "Gagné", lost: "Perdu" },
  en: { new: "New", contacted: "Contacted", qualified: "Qualified", proposal_sent: "Proposal", visit_planned: "Visit planned", visit_done: "Visit done", negotiation: "Negotiation", won: "Won", lost: "Lost" },
  ar: { new: "جديد", contacted: "تواصل", qualified: "مؤهَّل", proposal_sent: "عرض", visit_planned: "زيارة مجدولة", visit_done: "زيارة تمت", negotiation: "تفاوض", won: "مكسوب", lost: "مفقود" },
};

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }): React.ReactNode {
  return (
    <div className="sgi-card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
      <div>
        <Eyebrow>{title}</Eyebrow>
        {sub && <div className="font-display" style={{ fontSize: 18, marginBlockStart: 3 }}>{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value, tone }: { label: string; value: string; tone?: string }): React.ReactNode {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
      <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{label}</span>
      <span className="tnum font-display" style={{ fontSize: 15, color: tone ?? "var(--ink)" }}>{value}</span>
    </div>
  );
}

export function ScreenDashboard({ onNavigate }: { onNavigate?: (screen: string) => void } = {}) {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isCompact = bp !== "desktop";
  const { fullName } = useCurrentUser();

  const [data, setData] = useState<Exec | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let alive = true;
    getJson<Exec>("/api/admin/reporting/executive")
      .then((d) => { if (alive) { setData(d); setState("ready"); } })
      .catch(() => { if (alive) setState("error"); });
    return () => { alive = false; };
  }, []);

  const kpiCols = isMob ? "repeat(2, 1fr)" : "repeat(3, 1fr)";
  const twoCol = isCompact ? "1fr" : "1fr 1fr";

  function Hero({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }): React.ReactNode {
    return (
      <div className="sgi-card" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 6 }}>
        <Eyebrow>{label}</Eyebrow>
        <div className="font-display tnum" style={{ fontSize: isMob ? 24 : 30, lineHeight: 1.05, color: tone ?? "var(--ink)" }}>{value}</div>
        {sub && <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{sub}</div>}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={L("title")} />
      <main
        data-testid="screen-dashboard"
        style={{ flex: 1, overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable", padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 20, background: "var(--bg-cream)" }}
      >
        <div className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: isMob ? 22 : 30, color: "var(--ink)" }}>
          {L("hello")}{fullName ? `, ${fullName}` : ""} 👋
        </div>

        <FavoritesPanel onNavigate={onNavigate} />

        {state === "loading" && <div style={{ color: "var(--ink-4)", fontSize: 13 }}>{L("loading")}</div>}
        {state === "error" && <div style={{ color: "var(--rose)", fontSize: 13 }}>{L("error")}</div>}

        {state === "ready" && data && (
          <>
            {/* Bannière KPI */}
            <div style={{ display: "grid", gridTemplateColumns: kpiCols, gap: 16 }}>
              <Hero label={L("netPaid")} value={aed(data.headline.net_paid)} tone="var(--gold-deep)" />
              <Hero label={L("rentRoll")} value={aed(data.headline.monthly_rent_roll)} />
              <Hero label={L("overdue")} value={aed(data.headline.overdue_total)} sub={`${data.headline.overdue_count} ${L("invoices")}`} tone={Number(data.headline.overdue_total) > 0 ? "var(--rose)" : undefined} />
              <Hero label={L("occupancy")} value={`${data.headline.occupancy_rate_pct}%`} sub={`${data.units.total_units ?? 0} ${L("units")}`} tone="var(--emerald)" />
              <Hero label={L("activeLeads")} value={String(data.headline.active_leads)} />
              <Hero label={L("salesDone")} value={aed(data.headline.sales_completed_value)} sub={`${L("offersOpen")}: ${aed(data.headline.open_offers_amount)}`} />
            </div>

            {/* Finance + Trésorerie / Créances */}
            <div style={{ display: "grid", gridTemplateColumns: twoCol, gap: 16, alignItems: "start" }}>
              <Card title={L("finance")} sub={aed(data.finance.net)}>
                <StatRow label={L("revenue")} value={aed(data.finance.total_revenue)} tone="var(--emerald)" />
                <StatRow label={L("expenses")} value={aed(data.finance.total_expenses)} tone="var(--rose)" />
                <StatRow label={L("net")} value={aed(data.finance.net)} />
                <StatRow label={`${L("pending")} (${data.finance.pending_invoices} ${L("invoices")})`} value={aed(data.finance.pending_amount)} />
                <div style={{ borderBlockStart: "1px solid var(--line-soft)", marginBlockStart: 4, paddingBlockStart: 10 }}>
                  <Eyebrow>{L("cashflow")}</Eyebrow>
                  <div style={{ marginBlockStart: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                    {data.cashflow.buckets.map((b) => (
                      <div key={b.label} style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, fontSize: 12 }}>
                        <span style={{ color: "var(--ink-4)", minWidth: 64 }}>{b.label}</span>
                        <span className="tnum" style={{ color: "var(--emerald)" }}>+{aed(b.expected_in)}</span>
                        <span className="tnum" style={{ color: "var(--rose)" }}>−{aed(b.expected_out)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              <Card title={L("receivables")} sub={aed(data.receivables.total)}>
                {([["current", "current"], ["d1_30", "b30"], ["d31_60", "b60"], ["d61_90", "b90"], ["d90plus", "b90p"]] as const).map(([k, lbl]) => (
                  <StatRow key={k} label={L(lbl)} value={aed((data.receivables.buckets as Record<string, string>)[k])} tone={k === "d90plus" && Number((data.receivables.buckets as Record<string, string>)[k]) > 0 ? "var(--rose)" : undefined} />
                ))}
                <div style={{ borderBlockStart: "1px solid var(--line-soft)", marginBlockStart: 4, paddingBlockStart: 10 }}>
                  <StatRow label={L("total")} value={`${aed(data.receivables.total)} · ${data.receivables.count}`} />
                </div>
              </Card>
            </div>

            {/* Ventes / Locatif */}
            <div style={{ display: "grid", gridTemplateColumns: twoCol, gap: 16, alignItems: "start" }}>
              <Card title={L("sales")}>
                <StatRow label={L("listingsActive")} value={String(data.sales.listings?.active_count ?? 0)} />
                <StatRow label={L("offersOpen")} value={aed(data.sales.offers?.open_amount_aed ?? 0)} />
                <StatRow label={L("txnValue")} value={aed(data.sales.transactions?.completed_value_aed ?? 0)} tone="var(--emerald)" />
                <StatRow label={L("commission")} value={aed(data.sales.transactions?.completed_commission_aed ?? 0)} tone="var(--gold-deep)" />
              </Card>
              <Card title={L("leasing")}>
                <StatRow label={L("listingsActive")} value={String(data.leasing.listings?.active_count ?? 0)} />
                <StatRow label={L("leasingRent")} value={aed(data.leasing.listings?.active_monthly_rent_aed ?? 0)} />
                <StatRow label={L("appsInProgress")} value={String(data.leasing.applications?.in_progress_count ?? 0)} />
                <StatRow label={L("converted")} value={String(data.leasing.applications?.converted_count ?? 0)} tone="var(--emerald)" />
              </Card>
            </div>

            {/* CRM / Occupation */}
            <div style={{ display: "grid", gridTemplateColumns: twoCol, gap: 16, alignItems: "start" }}>
              <Card title={L("crmTitle")}>
                {(() => {
                  const max = Math.max(1, ...CRM_ORDER.map((s) => data.crm[s] ?? 0));
                  return CRM_ORDER.map((s) => {
                    const n = data.crm[s] ?? 0;
                    const color = s === "won" ? "var(--emerald)" : s === "lost" ? "var(--rose)" : "var(--gold)";
                    return (
                      <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 12, color: "var(--ink-3)", width: isMob ? 84 : 110, flexShrink: 0 }}>{CRM_LABEL[lg][s]}</span>
                        <div style={{ flex: 1, height: 8, borderRadius: 999, background: "var(--bg-inset)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${(n / max) * 100}%`, background: color, borderRadius: 999, transition: "width 0.3s ease" }} />
                        </div>
                        <span className="tnum" style={{ fontSize: 12.5, color: "var(--ink)", width: 32, textAlign: "end" }}>{n}</span>
                      </div>
                    );
                  });
                })()}
              </Card>

              <Card title={L("occTitle")} sub={`${data.units.occupancy_rate_pct ?? 0}%`}>
                {Object.entries(data.units.by_status ?? {}).map(([s, n]) => (
                  <StatRow key={s} label={s} value={String(n)} />
                ))}
                <div style={{ borderBlockStart: "1px solid var(--line-soft)", marginBlockStart: 4, paddingBlockStart: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Chip tone="emerald">{L("overview")}</Chip>
                  <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
                    {L("properties")}: {data.overview.properties_total} · {L("clients")}: {data.overview.clients_total} · {L("rentalsActive")}: {data.overview.active_rentals} · {L("gv")}: {data.overview.golden_visa_pending}
                  </span>
                </div>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
