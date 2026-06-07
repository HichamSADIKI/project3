import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { StatCard } from "@/components/stat-card";

interface PartnerDashboard {
  active_mandates: number;
  pending_submissions: number;
  active_leads: number;
  converted_leads: number;
  commissions_pending_aed: string;
  commissions_paid_aed: string;
  active_services: number;
}

function fmtAed(raw: string | number, locale: string): string {
  const n = typeof raw === "string" ? parseFloat(raw) : raw;
  const numberLocale = locale === "ar" ? "en-AE" : locale === "en" ? "en-AE" : "fr-FR";
  return new Intl.NumberFormat(numberLocale, {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);
}

export default async function PartnerDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("fournisseur", lc);
  const tc = makeT("common", lc);

  let data: PartnerDashboard | null = null;
  let error: string | null = null;
  try {
    data = await apiServer<PartnerDashboard>("/api/v1/fournisseur/dashboard");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "var(--h1-size)", color: "var(--ink)" }}>
        {t("nav.dashboard")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "clamp(0.85rem, 1.8vw, 0.95rem)" }}>
        {t("dashboard.subtitle")}
      </p>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {tc("common.unavailable")} ({error}).
        </div>
      )}

      {data && (
        <div className="sgi-grid-auto">
          <StatCard label={t("dashboard.activeMandates")} value={data.active_mandates} />
          <StatCard label={t("dashboard.pendingSubmissions")} value={data.pending_submissions} />
          <StatCard label={t("dashboard.pendingLeads")} value={data.active_leads} />
          <StatCard label={t("dashboard.convertedLeads")} value={data.converted_leads} />
          <StatCard
            label={t("dashboard.monthCommissionsAED")}
            value={fmtAed(data.commissions_pending_aed, lc)}
            hint={t("dashboard.commissionsPendingHint")}
          />
          <StatCard
            label={t("commissions.totalPaid")}
            value={fmtAed(data.commissions_paid_aed, lc)}
          />
          <StatCard label={t("nav.services")} value={data.active_services} hint={t("services.active")} />
        </div>
      )}
    </>
  );
}
