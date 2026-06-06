import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

interface Dashboard {
  properties_count: number;
  total_received_aed: string;
  pending_aed: string;
  overdue_aed: string;
}

export default async function OwnerDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("owner", lc);

  let data: Dashboard | null = null;
  let error: string | null = null;
  try {
    data = await apiServer<Dashboard>("/api/v1/owner/dashboard");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const money = new Intl.NumberFormat("en-AE", {
    style: "currency", currency: "AED", maximumFractionDigits: 0,
  });
  const fmt = (v: string | undefined) => money.format(Number(v ?? 0));

  const cards = data
    ? [
        { label: t("dashboard.properties"), value: String(data.properties_count), accent: "var(--gold, #C9A84C)" },
        { label: t("dashboard.received"),   value: fmt(data.total_received_aed), accent: "#059669" },
        { label: t("dashboard.pending"),    value: fmt(data.pending_aed),       accent: "#D97706" },
        { label: t("dashboard.overdue"),    value: fmt(data.overdue_aed),       accent: "#DC2626" },
      ]
    : [];

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("dashboard.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "0.9rem" }}>
        {t("dashboard.subtitle")}
      </p>

      {error ? (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
          {cards.map((c) => (
            <div key={c.label} className="sgi-card">
              <div style={{ fontSize: "0.8rem", color: "var(--ink-3)", marginBottom: "0.5rem" }}>
                {c.label}
              </div>
              <div style={{ fontSize: "1.5rem", fontWeight: 700, color: c.accent }}>
                {c.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
