import Link from "next/link";
import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";

export default async function HomePage({
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
        style={{
          padding: "clamp(2.5rem, 8vw, 5rem) var(--page-px)",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "var(--hero-size)",
            margin: 0,
            color: "var(--ink)",
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
          }}
        >
          {t("home.title")}
        </h1>
        <p
          style={{
            fontSize: "clamp(1rem, 2.2vw, 1.125rem)",
            color: "var(--ink-3)",
            maxWidth: 640,
            margin: "1.25rem auto 0",
            lineHeight: 1.6,
          }}
        >
          {t("home.subtitle")}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            gap: "clamp(0.875rem, 2.5vw, 1.25rem)",
            marginTop: "clamp(2rem, 5vw, 3.5rem)",
          }}
        >
          <Link href={`/${lc}/register/client`} className="sgi-card" style={{ textAlign: "start" }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--gold-deep)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {t("home.clientCard.kicker")}
            </div>
            <h3 style={{ margin: "0.75rem 0 0.5rem", fontSize: "clamp(1.1rem, 2vw, 1.25rem)", color: "var(--ink)" }}>
              {t("home.clientCard.title")}
            </h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-3)", lineHeight: 1.55 }}>
              {t("home.clientCard.description")}
            </p>
            <div className="sgi-button sgi-button-primary" style={{ marginTop: "1.25rem", width: "100%" }}>
              {t("home.clientCard.cta")}
            </div>
          </Link>

          <Link href={`/${lc}/register/fournisseur`} className="sgi-card" style={{ textAlign: "start" }}>
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 700,
                color: "var(--gold-deep)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              {t("home.fournisseurCard.kicker")}
            </div>
            <h3 style={{ margin: "0.75rem 0 0.5rem", fontSize: "clamp(1.1rem, 2vw, 1.25rem)", color: "var(--ink)" }}>
              {t("home.fournisseurCard.title")}
            </h3>
            <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--ink-3)", lineHeight: 1.55 }}>
              {t("home.fournisseurCard.description")}
            </p>
            <div className="sgi-button sgi-button-primary" style={{ marginTop: "1.25rem", width: "100%" }}>
              {t("home.fournisseurCard.cta")}
            </div>
          </Link>
        </div>
      </section>
    </PublicShell>
  );
}
