import { BesoinForm } from "@/components/besoin-form";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

export default async function NouveauBesoinPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("client", lc);

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("need.title")}
      </h1>
      <p style={{ margin: "0 0 2rem", color: "var(--ink-3)", fontSize: "0.95rem" }}>
        {t("need.subtitle")}
      </p>

      <BesoinForm
        locale={lc}
        texts={{
          title: t("need.title"),
          subtitle: t("need.subtitle"),
          textareaLabel: t("need.textareaLabel"),
          textareaPlaceholder: t("need.textareaPlaceholder"),
          micStart: t("need.micStart"),
          micStop: t("need.micStop"),
          micUnsupported: t("need.micUnsupported"),
          listening: t("need.listening"),
          transcribing: t("need.transcribing"),
          categoryLabel: t("need.categoryLabel"),
          categoryAuto: t("need.categoryAuto"),
          submit: t("need.submit"),
          submitting: t("need.submitting"),
          success: t("need.success"),
          errorEmpty: t("need.errorEmpty"),
          errorTooShort: t("need.errorTooShort"),
          errorGeneric: t("need.errorGeneric"),
          errorNotLinked: t("need.errorNotLinked"),
          errorMicDenied: t("need.errorMicDenied"),
          errorTooLargeAudio: t("need.errorTooLargeAudio"),
          errorWhisperUnavailable: t("need.errorWhisperUnavailable"),
          errorEmptyTranscript: t("need.errorEmptyTranscript"),
          parsedTitle: t("need.parsedTitle"),
          parsedCategory: t("need.parsedCategory"),
          parsedBudget: t("need.parsedBudget"),
          parsedLocation: t("need.parsedLocation"),
          parsedUrgency: t("need.parsedUrgency"),
          parsedConfidence: t("need.parsedConfidence"),
          viewDeal: t("need.viewDeal"),
          newOne: t("need.newOne"),
          charsCount: t("need.charsCount"),
        }}
      />
    </>
  );
}
