import Link from "next/link";
import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

interface MyLead {
  id: string;
  reference: string | null;
  status: string;
  category: string;
  source: string | null;
  budget: number | null;
  property_type: string | null;
  preferred_location: string | null;
  golden_visa_eligible: boolean;
  score: number;
  created_at: string;
}

// Statuts du pipeline CRM → classes de badge du portail.
const STATUS_BADGE: Record<string, string> = {
  new: "sgi-badge-info",
  contacted: "sgi-badge-pending",
  qualified: "sgi-badge-pending",
  proposal_sent: "sgi-badge-info",
  visit_planned: "sgi-badge-info",
  visit_done: "sgi-badge-info",
  negotiation: "sgi-badge-pending",
  won: "sgi-badge-active",
  lost: "sgi-badge-rejected",
};

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
  // Montants : chiffres latins toujours (règle SGI), devise AED.
  const money = new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  });

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("leads.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "0.9rem" }}>
        {t("leads.subtitle")}
      </p>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      {!error && leads.length === 0 ? (
        <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
          <p style={{ margin: "0 0 1rem" }}>{t("leads.empty")}</p>
          <Link href={`/${lc}/client/nouveau-besoin`} className="sgi-button sgi-button-primary">
            {t("leads.cta")}
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {leads.map((l) => (
            <div key={l.id} className="sgi-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color: "var(--gold, var(--ink))" }}>
                    {l.reference ?? l.id.slice(0, 8)}
                  </span>
                  <span className="sgi-badge sgi-badge-info">
                    {t(`leads.category.${l.category}`)}
                  </span>
                </div>
                <span className={`sgi-badge ${STATUS_BADGE[l.status] ?? ""}`}>
                  {t(`leads.status.${l.status}`)}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1.25rem", fontSize: "0.85rem", color: "var(--ink-2)" }}>
                <span>
                  <span style={{ color: "var(--ink-3)" }}>{t("leads.budgetLabel")} : </span>
                  {l.budget ? money.format(l.budget) : t("leads.noBudget")}
                </span>
                {l.preferred_location && (
                  <span>
                    <span style={{ color: "var(--ink-3)" }}>{t("leads.locationLabel")} : </span>
                    {l.preferred_location}
                  </span>
                )}
                <span style={{ color: "var(--ink-3)" }}>
                  {t("leads.createdOn")} {new Date(l.created_at).toLocaleDateString(dateLocale)}
                </span>
              </div>

              {l.golden_visa_eligible && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span className="sgi-badge sgi-badge-active">★ {t("leads.goldenVisa")}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
