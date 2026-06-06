import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { PaymentsView, type TenantPayment } from "./PaymentsView";

interface PaymentsResponse {
  items: TenantPayment[];
  total: number;
}

const STATUSES = ["pending", "paid", "overdue", "cancelled"] as const;
const TYPES = [
  "rent",
  "charges",
  "deposit",
  "deposit_return",
  "owner_payout",
  "other",
] as const;

export default async function TenantPaymentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("tenant", lc);

  let items: TenantPayment[] = [];
  let error: string | null = null;
  try {
    const data = await apiServer<PaymentsResponse>("/api/v1/tenant/payments?limit=100");
    items = data.items;
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const dateLocale = lc === "ar" ? "ar-AE" : lc === "en" ? "en-AE" : "fr-FR";
  const statusLabels = Object.fromEntries(
    STATUSES.map((s) => [s, t(`payments.statusLabels.${s}`)]),
  );
  const typeLabels = Object.fromEntries(TYPES.map((ty) => [ty, t(`payments.typeLabels.${ty}`)]));

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("payments.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "0.9rem" }}>
        {t("payments.subtitle")}
      </p>

      {error ? (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      ) : (
        <PaymentsView
          payments={items}
          dateLocale={dateLocale}
          statusLabels={statusLabels}
          typeLabels={typeLabels}
          labels={{
            empty: t("payments.empty"),
            reference: t("payments.reference"),
            type: t("payments.type"),
            amount: t("payments.amount"),
            dueDate: t("payments.dueDate"),
            status: t("payments.status"),
            pay: t("payments.pay"),
            paying: t("payments.paying"),
            payError: t("payments.payError"),
          }}
        />
      )}
    </>
  );
}
