import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { StatCard } from "@/components/stat-card";

interface ClientDashboard {
  favorites_count: number;
  active_contracts: number;
  upcoming_payments: number;
  pending_visits: number;
  unread_messages: number;
}

export default async function ClientDashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("client", lc);
  const tc = makeT("common", lc);

  let data: ClientDashboard | null = null;
  let error: string | null = null;
  try {
    data = await apiServer<ClientDashboard>("/api/v1/client/dashboard");
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
          <StatCard label={t("dashboard.myFavorites")} value={data.favorites_count} />
          <StatCard label={t("dashboard.activeContracts")} value={data.active_contracts} />
          <StatCard label={t("dashboard.upcomingPayments")} value={data.upcoming_payments} />
          <StatCard label={t("dashboard.scheduledVisits")} value={data.pending_visits} />
          <StatCard
            label={t("dashboard.unreadMessages")}
            value={data.unread_messages}
            hint={t("dashboard.unreadHint")}
          />
        </div>
      )}
    </>
  );
}
