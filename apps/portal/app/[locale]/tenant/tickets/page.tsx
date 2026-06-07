import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { TicketsView, type TenantTicket } from "./TicketsView";

interface TicketsResponse {
  items: TenantTicket[];
  total: number;
}

const STATUSES = ["open", "in_progress", "pending", "resolved", "closed"] as const;
const PRIORITIES = ["low", "medium", "high", "urgent"] as const;

export default async function TenantTicketsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("tenant", lc);

  let items: TenantTicket[] = [];
  let error: string | null = null;
  try {
    const data = await apiServer<TicketsResponse>("/api/v1/tenant/tickets?limit=100");
    items = data.items;
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const dateLocale = lc === "ar" ? "ar-AE" : lc === "en" ? "en-AE" : "fr-FR";
  const statusLabels = Object.fromEntries(
    STATUSES.map((s) => [s, t(`tickets.statusLabels.${s}`)]),
  );
  const priorityLabels = Object.fromEntries(
    PRIORITIES.map((p) => [p, t(`tickets.priorityLabels.${p}`)]),
  );

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("tickets.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "0.9rem" }}>
        {t("tickets.subtitle")}
      </p>

      {error ? (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      ) : (
        <TicketsView
          tickets={items}
          dateLocale={dateLocale}
          statusLabels={statusLabels}
          priorityLabels={priorityLabels}
          labels={{
            empty: t("tickets.empty"),
            newTicket: t("tickets.new"),
            subject: t("tickets.subject"),
            description: t("tickets.description"),
            priority: t("tickets.priority"),
            submit: t("tickets.submit"),
            submitting: t("tickets.submitting"),
            createError: t("tickets.createError"),
            createdOn: t("tickets.createdOn"),
            comment: t("tickets.comment"),
            commentPlaceholder: t("tickets.commentPlaceholder"),
            send: t("tickets.send"),
            timeline: t("tickets.timeline"),
          }}
        />
      )}
    </>
  );
}
