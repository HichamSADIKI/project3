import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { LinksClient } from "./LinksClient";

export const dynamic = "force-dynamic";

export default async function LiensPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const lc: Locale = locale;
  const t = makeT("common", lc);

  return (
    <PublicShell locale={lc}>
      <section
        className="sgi-container"
        style={{ padding: "var(--page-py) var(--page-px)" }}
      >
        <h1 style={{ margin: "0 0 0.5rem", fontSize: "var(--h1-size)", color: "var(--ink)" }}>
          {t("sitemap.title")}
        </h1>
        <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "clamp(0.9rem, 1.8vw, 1rem)", lineHeight: 1.55 }}>
          {t("sitemap.subtitle")}
        </p>
        <LinksClient
          locale={lc}
          labels={{
            demoAccounts: t("sitemap.demoAccounts"),
            demoNote: t("sitemap.demoNote"),
            backend: t("sitemap.backend"),
            frontClient: t("sitemap.frontClient"),
            frontServer: t("sitemap.frontServer"),
            languages: t("sitemap.languages"),
            open: t("sitemap.open"),
            copy: t("sitemap.copy"),
            copied: t("sitemap.copied"),
            demoClient: t("login.demoClient"),
            demoFournisseur: t("login.demoFournisseur"),
          }}
        />
      </section>
    </PublicShell>
  );
}
