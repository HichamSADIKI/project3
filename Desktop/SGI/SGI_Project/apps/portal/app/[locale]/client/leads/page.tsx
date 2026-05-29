import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { LeadsView, type MyLead } from "./LeadsView";

const CATEGORIES = [
  "realestate", "tourisme", "sante", "assurance", "banques",
  "amazon", "consultants", "admin", "travail",
] as const;
const STATUSES = [
  "new", "contacted", "qualified", "proposal_sent", "visit_planned",
  "visit_done", "negotiation", "won", "lost",
] as const;

export default async function MyLeadsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("client", lc);

  let leads: MyLead[] = [];
  let error: string | null = null;
  try {
    leads = await apiServer<MyLead[]>("/api/v1/client/leads");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const dateLocale = lc === "ar" ? "ar-AE" : lc === "en" ? "en-AE" : "fr-FR";

  // Libellés calculés côté serveur (passés au composant client interactif).
  const categoryLabels = Object.fromEntries(
    CATEGORIES.map((c) => [c, t(`leads.category.${c}`)]),
  );
  const statusLabels = Object.fromEntries(
    STATUSES.map((s) => [s, t(`leads.status.${s}`)]),
  );

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("leads.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "0.9rem" }}>
        {t("leads.subtitle")}
      </p>

      {error ? (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      ) : (
        <LeadsView
          leads={leads}
          dateLocale={dateLocale}
          categoryLabels={categoryLabels}
          statusLabels={statusLabels}
          labels={{
            empty: t("leads.empty"),
            cta: t("leads.cta"),
            ctaHref: `/${lc}/client/nouveau-besoin`,
            budgetLabel: t("leads.budgetLabel"),
            noBudget: t("leads.noBudget"),
            locationLabel: t("leads.locationLabel"),
            goldenVisa: t("leads.goldenVisa"),
            createdOn: t("leads.createdOn"),
            allSectors: t("leads.allSectors"),
            scoreLabel: t("leads.scoreLabel"),
            detailTitle: t("leads.detailTitle"),
            propertyTypeLabel: t("leads.propertyTypeLabel"),
          }}
        />
      )}
    </>
  );
}
