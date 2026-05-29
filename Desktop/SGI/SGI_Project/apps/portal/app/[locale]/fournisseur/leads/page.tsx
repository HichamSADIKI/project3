import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { LeadForm } from "./LeadForm";

interface Lead {
  id: string;
  prospect_first_name: string;
  prospect_last_name: string | null;
  prospect_email: string | null;
  prospect_phone: string;
  interest_type: string;
  budget_aed: string | null;
  status: string;
  commission_rate: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  new: "sgi-badge-pending",
  contacted: "sgi-badge-info",
  qualified: "sgi-badge-info",
  converted: "sgi-badge-active",
  lost: "sgi-badge-rejected",
};

export default async function LeadsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("fournisseur", lc);
  const numberLocale = lc === "ar" ? "en-AE" : lc === "en" ? "en-AE" : "fr-FR";

  let items: Lead[] = [];
  let error: string | null = null;
  try {
    items = await apiServer<Lead[]>("/api/v1/fournisseur/leads");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("leads.title")}
      </h1>
      <p style={{ margin: "0 0 2rem", color: "var(--ink-3)", fontSize: "0.95rem" }}>
        {t("leads.subtitle")}
      </p>

      <div className="sgi-card" style={{ marginBottom: "2rem" }}>
        <LeadForm
          labels={{
            firstName: t("leads.form.firstName"),
            lastName: t("leads.form.lastName"),
            email: t("leads.form.email"),
            phone: t("leads.form.phone"),
            interest: t("leads.form.interest"),
            budget: t("leads.form.budget"),
            notes: t("leads.form.notes"),
            submit: t("leads.form.submit"),
            submitting: t("leads.form.submitting"),
            successMessage: t("leads.successMessage"),
            interestOptions: {
              buy: t("leads.interest.buy"),
              rent: t("leads.interest.rent"),
              golden_visa: t("leads.interest.golden_visa"),
              commercial: t("leads.interest.commercial"),
            },
          }}
        />
      </div>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
          {t("leads.empty")}
        </div>
      ) : (
        <div className="sgi-card sgi-table-wrap" style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--bg-paper)" }}>
              <tr>
                {[t("leads.cols.prospect"), t("leads.cols.contact"), t("leads.cols.interest"), t("leads.cols.budget"), t("leads.cols.status")].map((h) => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "0.75rem", color: "var(--ink-3)", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink)" }}>
                    {l.prospect_first_name} {l.prospect_last_name ?? ""}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink-2)", fontSize: "0.85rem" }}>
                    {l.prospect_phone}
                    {l.prospect_email && <div style={{ color: "var(--ink-3)", fontSize: "0.8rem" }}>{l.prospect_email}</div>}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink-2)", fontSize: "0.85rem" }}>
                    {t(`leads.interest.${l.interest_type}`)}
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink-2)", fontSize: "0.85rem" }}>
                    {l.budget_aed ? `${parseFloat(l.budget_aed).toLocaleString(numberLocale)} AED` : "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span className={`sgi-badge ${STATUS_BADGE[l.status] ?? ""}`}>
                      {t(`leads.status.${l.status}`)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
