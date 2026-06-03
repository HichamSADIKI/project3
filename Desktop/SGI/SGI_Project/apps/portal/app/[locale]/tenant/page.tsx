import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

interface Dashboard {
  next_payment_aed: string;
  next_payment_due: string | null;
  pending_payments: number;
  open_tickets: number;
  conversations: number;
}

export default async function TenantDashboard({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("tenant", lc);

  let data: Dashboard | null = null;
  let error: string | null = null;
  try {
    data = await apiServer<Dashboard>("/api/v1/tenant/dashboard");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const money = new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  });
  const dateLocale = lc === "ar" ? "ar-AE" : lc === "en" ? "en-AE" : "fr-FR";
  const due = data?.next_payment_due
    ? new Date(data.next_payment_due).toLocaleDateString(dateLocale)
    : t("dashboard.noNextPayment");

  const cards = data
    ? [
        { label: t("dashboard.nextPayment"), value: money.format(Number(data.next_payment_aed ?? 0)), sub: due, accent: "var(--gold, #C9A84C)" },
        { label: t("dashboard.pendingPayments"), value: String(data.pending_payments), accent: "#D97706" },
        { label: t("dashboard.openTickets"), value: String(data.open_tickets), accent: "#2563EB" },
        { label: t("dashboard.conversations"), value: String(data.conversations), accent: "#059669" },
      ]
    : [];

  const quick = [
    { href: `/${lc}/tenant/payments`, label: t("dashboard.quickPay") },
    { href: `/${lc}/tenant/tickets`, label: t("dashboard.quickTickets") },
    { href: `/${lc}/tenant/chat`, label: t("dashboard.quickChat") },
  ];

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
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "1rem" }}>
            {cards.map((c) => (
              <div key={c.label} className="sgi-card">
                <div style={{ fontSize: "0.8rem", color: "var(--ink-3)", marginBottom: "0.5rem" }}>
                  {c.label}
                </div>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: c.accent }}>{c.value}</div>
                {c.sub ? (
                  <div style={{ fontSize: "0.8rem", color: "var(--ink-3)", marginBlockStart: "0.35rem" }}>
                    {c.sub}
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBlockStart: "1.5rem" }}>
            {quick.map((q) => (
              <a key={q.href} href={q.href} className="sgi-button sgi-button-primary">
                {q.label}
              </a>
            ))}
          </div>
        </>
      )}
    </>
  );
}
