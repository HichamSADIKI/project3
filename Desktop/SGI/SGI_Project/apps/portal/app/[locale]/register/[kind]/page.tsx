import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { RegisterForm } from "./RegisterForm";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string; kind: string }>;
}) {
  const { locale, kind } = await params;
  if (!isValidLocale(locale)) notFound();
  if (kind !== "client" && kind !== "fournisseur") notFound();
  const lc: Locale = locale;
  const t = makeT("common", lc);

  const title = kind === "client" ? t("register.clientTitle") : t("register.fournisseurTitle");
  const subtitle =
    kind === "client" ? t("register.clientSubtitle") : t("register.fournisseurSubtitle");

  return (
    <PublicShell locale={lc}>
      <section style={{ display: "grid", placeItems: "center", padding: "3rem 1.5rem" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>
          <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
            {title}
          </h1>
          <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "0.9rem" }}>
            {subtitle}
          </p>
          <div className="sgi-card">
            <RegisterForm
              kind={kind as "client" | "fournisseur"}
              locale={lc}
              labels={{
                fullName: t("register.fullName"),
                companyName: t("register.companyName"),
                email: t("register.email"),
                password: t("register.password"),
                passwordHint: t("register.passwordHint"),
                companySlug: t("register.companySlug"),
                companySlugPlaceholder: t("register.companySlugPlaceholder"),
                clientTypeLabel: t("register.clientTypeLabel"),
                clientTypePerson: t("register.clientTypePerson"),
                clientTypeCompany: t("register.clientTypeCompany"),
                trn: t("register.trn"),
                trnPlaceholder: t("register.trnPlaceholder"),
                trnHint: t("register.trnHint"),
                address: t("register.address"),
                addressPlaceholder: t("register.addressPlaceholder"),
                addressHint: t("register.addressHint"),
                categoryLabel: t("register.categoryLabel"),
                categoryHint: t("register.categoryHint"),
                categoryPlaceholder: t("register.categoryPlaceholder"),
                license: t("register.license"),
                licenseHint: t("register.licenseHint"),
                vendorTypes: {
                  maintenance: t("register.vendorTypes.maintenance"),
                  cleaning: t("register.vendorTypes.cleaning"),
                  security: t("register.vendorTypes.security"),
                  landscaping: t("register.vendorTypes.landscaping"),
                  pest_control: t("register.vendorTypes.pest_control"),
                  elevator: t("register.vendorTypes.elevator"),
                  moving: t("register.vendorTypes.moving"),
                  hvac: t("register.vendorTypes.hvac"),
                  electrical: t("register.vendorTypes.electrical"),
                  plumbing: t("register.vendorTypes.plumbing"),
                  other: t("register.vendorTypes.other"),
                },
                submit: t("register.submit"),
                submitting: t("register.submitting"),
                alreadyAccount: t("register.alreadyAccount"),
                loginLink: t("register.loginLink"),
                success: {
                  title: t("register.success.title"),
                  body: t("register.success.body"),
                  back: t("register.success.back"),
                },
                errors: {
                  email_already_registered: t("register.errors.email_already_registered"),
                  company_not_found: t("register.errors.company_not_found"),
                  invalid_vendor_type: t("register.errors.invalid_vendor_type"),
                  invalid_license: t("register.errors.invalid_license"),
                  generic: t("register.errors.generic"),
                },
              }}
            />
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
