import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { MaintenanceView } from "./MaintenanceView";

interface MyTicket {
  id: string;
  reference: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  sla_due_at: string | null;
  cost_estimate_aed: number | null;
  created_at: string;
}

const CATEGORIES = ["plumbing","electrical","hvac","appliance","structural","cleaning","other"] as const;
const STATUSES   = ["new","triaged","assigned","in_progress","on_hold","resolved","closed","cancelled"] as const;

export default async function MaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("client", lc);

  let tickets: MyTicket[] = [];
  let error: string | null = null;
  try {
    tickets = await apiServer<MyTicket[]>("/api/v1/client/maintenance");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const dateLocale = lc === "ar" ? "ar-AE" : lc === "en" ? "en-AE" : "fr-FR";
  const statusLabels   = Object.fromEntries(STATUSES.map(s   => [s, t(`maintenance.status.${s}`)]));
  const categoryLabels = Object.fromEntries(CATEGORIES.map(c => [c, t(`maintenance.category.${c}`)]));
  const priorityLabels = Object.fromEntries(
    ["urgent","high","medium","low"].map(p => [p, t(`maintenance.priority.${p}`)])
  );

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("maintenance.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "0.9rem" }}>
        {t("maintenance.subtitle")}
      </p>

      {error ? (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      ) : (
        <MaintenanceView
          tickets={tickets}
          dateLocale={dateLocale}
          statusLabels={statusLabels}
          categoryLabels={categoryLabels}
          priorityLabels={priorityLabels}
          labels={{
            empty: t("maintenance.empty"),
            cta: t("maintenance.cta"),
            ctaHref: `/${lc}/client/nouveau-besoin`,
            slaBreached: t("maintenance.slaBreached"),
            createdOn: t("maintenance.createdOn"),
          }}
        />
      )}
    </>
  );
}
