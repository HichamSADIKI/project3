import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { ServiceForm } from "./ServiceForm";

interface Service {
  id: string;
  service_type: string;
  title: string;
  description: string | null;
  fee_aed: string | null;
  is_active: boolean;
  created_at: string;
}

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("fournisseur", lc);
  const numberLocale = lc === "ar" ? "en-AE" : lc === "en" ? "en-AE" : "fr-FR";

  let items: Service[] = [];
  let error: string | null = null;
  try {
    items = await apiServer<Service[]>("/api/v1/fournisseur/services");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("nav.services")}
      </h1>
      <p style={{ margin: "0 0 2rem", color: "var(--ink-3)", fontSize: "0.95rem" }}>
        {t("services.subtitle")}
      </p>

      <div className="sgi-card" style={{ marginBottom: "2rem" }}>
        <ServiceForm
          labels={{
            type: t("services.form.type"),
            title: t("services.form.title"),
            description: t("services.form.description"),
            fee: t("services.form.fee"),
            submit: t("services.form.submit"),
            submitting: t("services.form.submitting"),
            successMessage: t("services.successMessage"),
            types: {
              notary: t("services.types.notary"),
              bank: t("services.types.bank"),
              insurance: t("services.types.insurance"),
              legal: t("services.types.legal"),
              translation: t("services.types.translation"),
              valuation: t("services.types.valuation"),
              other: t("services.types.other"),
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
          {t("services.empty")}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {items.map((s) => (
            <div key={s.id} className="sgi-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--ink)" }}>{s.title}</strong>
                <span className={`sgi-badge ${s.is_active ? "sgi-badge-active" : "sgi-badge-rejected"}`}>
                  {s.is_active ? t("services.active") : t("services.inactive")}
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--gold-deep)", textTransform: "uppercase", letterSpacing: "0.04em", fontWeight: 600 }}>
                {t(`services.types.${s.service_type}`)}
              </div>
              {s.description && (
                <p style={{ margin: "0.625rem 0 0", color: "var(--ink-2)", fontSize: "0.85rem", lineHeight: 1.5 }}>{s.description}</p>
              )}
              {s.fee_aed && (
                <div style={{ marginTop: "0.75rem", color: "var(--ink)", fontWeight: 600 }}>
                  {parseFloat(s.fee_aed).toLocaleString(numberLocale)} AED
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
