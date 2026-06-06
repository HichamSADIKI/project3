import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { LoginForm } from "./LoginForm";
import pkg from "../../../package.json";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const lc: Locale = locale;
  const t = makeT("common", lc);

  return (
    <LoginForm
      locale={lc}
      version={pkg.version}
      labels={{
        title: t("login.title"),
        subtitle: t("login.subtitle"),
        email: t("login.email"),
        password: t("login.password"),
        submit: t("login.submit"),
        submitting: t("login.submitting"),
        becomeClient: t("login.becomeClient"),
        becomeFournisseur: t("login.becomeFournisseur"),
        developedBy: t("login.developedBy"),
        versionLabel: t("login.versionLabel"),
        callCenter: t("login.callCenter"),
        needHelp: t("login.needHelp"),
        callUs: t("login.callUs"),
        available247: t("login.available247"),
        callAction: t("login.callAction"),
        whatsappAction: t("login.whatsappAction"),
        followUs: t("login.followUs"),
        snapchatAction: t("login.snapchatAction"),
        instagramAction: t("login.instagramAction"),
        demoTitle: t("login.demoTitle"),
        demoClient: t("login.demoClient"),
        demoFournisseur: t("login.demoFournisseur"),
        profileTitle: t("login.profileTitle"),
        profileSubtitle: t("login.profileSubtitle"),
        profileClient: t("login.profileClient"),
        profileClientDesc: t("login.profileClientDesc"),
        profileFournisseur: t("login.profileFournisseur"),
        profileFournisseurDesc: t("login.profileFournisseurDesc"),
        back: t("login.back"),
        companySlug: t("login.companySlug"),
        companySlugPlaceholder: t("login.companySlugPlaceholder"),
        companySlugHint: t("login.companySlugHint"),
        brand: t("brand.name"),
        tagline: t("brand.tagline"),
        errors: {
          invalid_credentials: t("login.errors.invalid_credentials"),
          account_not_active: t("login.errors.account_not_active"),
          use_backoffice_portal: t("login.errors.use_backoffice_portal"),
          company_required: t("login.errors.company_required"),
          company_mismatch: t("login.errors.company_mismatch"),
          generic: t("login.errors.generic"),
        },
      }}
    />
  );
}
