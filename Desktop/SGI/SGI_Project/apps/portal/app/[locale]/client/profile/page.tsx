import { apiServer, ApiError } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { ProfileForm, type ClientMeProfile } from "./ProfileForm";

export default async function ClientProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("client", lc);
  const tc = makeT("common", lc);

  let initial: ClientMeProfile | null = null;
  let error: string | null = null;
  try {
    initial = await apiServer<ClientMeProfile>("/api/v1/client/me/profile");
  } catch (e) {
    error = e instanceof ApiError ? e.detail : (e as Error).message;
  }

  return (
    <>
      <h1
        style={{
          margin: "0 0 0.5rem",
          fontSize: "var(--h1-size)",
          color: "var(--ink)",
        }}
      >
        {t("profile.title")}
      </h1>
      <p
        style={{
          margin: "0 0 1.5rem",
          color: "var(--ink-3)",
          fontSize: "clamp(0.85rem, 1.8vw, 0.95rem)",
        }}
      >
        {t("profile.subtitle")}
      </p>

      {error && (
        <div
          className="sgi-card"
          style={{ background: "var(--rose-soft)", color: "var(--rose)" }}
        >
          {tc("common.unavailable")} ({error}).
        </div>
      )}

      {initial && (
        <ProfileForm
          initial={initial}
          locale={lc}
          texts={{
            sectionIdentity: t("profile.section.identity"),
            sectionContact: t("profile.section.contact"),
            firstName: t("profile.field.firstName"),
            lastName: t("profile.field.lastName"),
            companyName: t("profile.field.companyName"),
            email: t("profile.field.email"),
            emailLocked: t("profile.field.emailLocked"),
            phone: t("profile.field.phone"),
            phone2: t("profile.field.phone2"),
            nationality: t("profile.field.nationality"),
            countryOfResidence: t("profile.field.countryOfResidence"),
            submit: t("profile.submit"),
            submitting: t("profile.submitting"),
            success: t("profile.success"),
            errorGeneric: t("profile.errorGeneric"),
          }}
        />
      )}
    </>
  );
}
