import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { SubmissionForm } from "./SubmissionForm";

interface Submission {
  id: string;
  title: string;
  type: string;
  district: string | null;
  city: string;
  asking_price: string;
  bedrooms: number | null;
  status: string;
  review_notes: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "sgi-badge-pending",
  approved: "sgi-badge-active",
  rejected: "sgi-badge-rejected",
  converted: "sgi-badge-info",
};

export default async function SubmissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("fournisseur", lc);
  const numberLocale = lc === "ar" ? "en-AE" : lc === "en" ? "en-AE" : "fr-FR";

  let items: Submission[] = [];
  let error: string | null = null;
  try {
    items = await apiServer<Submission[]>("/api/v1/fournisseur/submissions");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("submitProperty.title")}
      </h1>
      <p style={{ margin: "0 0 2rem", color: "var(--ink-3)", fontSize: "0.95rem" }}>
        {t("submitProperty.subtitle")}
      </p>

      <div className="sgi-card" style={{ marginBottom: "2rem" }}>
        <SubmissionForm
          labels={{
            title: t("submitProperty.form.title"),
            type: t("submitProperty.form.type"),
            district: t("submitProperty.form.district"),
            districtPlaceholder: t("submitProperty.form.districtPlaceholder"),
            askingPrice: t("submitProperty.form.askingPrice"),
            bedrooms: t("submitProperty.form.bedrooms"),
            contactPhone: t("submitProperty.form.contactPhone"),
            submit: t("submitProperty.form.submit"),
            submitting: t("submitProperty.form.submitting"),
            successMessage: t("submitProperty.successMessage"),
            types: {
              apartment: t("submitProperty.types.apartment"),
              villa: t("submitProperty.types.villa"),
              townhouse: t("submitProperty.types.townhouse"),
              office: t("submitProperty.types.office"),
              retail: t("submitProperty.types.retail"),
              land: t("submitProperty.types.land"),
            },
          }}
        />
      </div>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      <h2 style={{ margin: "0 0 1rem", fontSize: "1.125rem", color: "var(--ink-2)" }}>
        {t("submitProperty.mySubmissions")}
      </h2>
      {items.length === 0 ? (
        <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
          {t("submitProperty.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {items.map((s) => (
            <div key={s.id} className="sgi-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--ink)" }}>{s.title}</strong>
                <span className={`sgi-badge ${STATUS_BADGE[s.status] ?? ""}`}>
                  {s.status}
                </span>
              </div>
              <div style={{ fontSize: "0.85rem", color: "var(--ink-3)" }}>
                {s.type} · {s.district ?? s.city}
                {s.bedrooms != null && ` · ${s.bedrooms}`} · {parseFloat(s.asking_price).toLocaleString(numberLocale)} AED
              </div>
              {s.review_notes && (
                <p style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--ink-2)" }}>
                  {s.review_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
