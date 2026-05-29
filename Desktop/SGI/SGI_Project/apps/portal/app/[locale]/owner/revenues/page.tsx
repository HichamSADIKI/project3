import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

interface Revenue {
  id: string;
  reference: string;
  payment_type: string;
  status: string;
  amount_aed: string;
  due_date: string | null;
  paid_at: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "sgi-badge-pending", paid: "sgi-badge-active",
  overdue: "sgi-badge-rejected", cancelled: "sgi-badge-rejected",
};

export default async function OwnerRevenues({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("owner", lc);

  let rows: Revenue[] = [];
  let error: string | null = null;
  try {
    rows = await apiServer<Revenue[]>("/api/v1/owner/revenues");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const dateLocale = lc === "ar" ? "ar-AE" : lc === "en" ? "en-AE" : "fr-FR";
  const money = new Intl.NumberFormat("en-AE", {
    style: "currency", currency: "AED", maximumFractionDigits: 0,
  });

  return (
    <>
      <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("revenues.title")}
      </h1>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      {!error && rows.length === 0 ? (
        <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
          {t("revenues.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {rows.map((r) => (
            <div key={r.id} className="sgi-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color: "var(--gold, var(--ink))" }}>
                    {r.reference}
                  </span>
                  <span style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
                    {t(`revenues.typeLabels.${r.payment_type}`)}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <strong className="tnum" style={{ color: "var(--ink)" }}>
                    {money.format(Number(r.amount_aed))}
                  </strong>
                  <span className={`sgi-badge ${STATUS_BADGE[r.status] ?? ""}`}>
                    {t(`revenues.statusLabels.${r.status}`)}
                  </span>
                </div>
              </div>
              {r.due_date && (
                <div style={{ fontSize: "0.78rem", color: "var(--ink-4)", marginTop: "0.4rem" }}>
                  {t("revenues.dueDate")} : {new Date(r.due_date).toLocaleDateString(dateLocale)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
