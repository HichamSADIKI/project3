import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { apiServerPublic } from "@/lib/api-server";
import { type PublicAgentProfile, type PublicEnvelope } from "@/lib/realestate";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("realestate", lc);
  return { title: t("agents.title"), description: t("agents.subtitle") };
}

export default async function AgentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();
  const lc: Locale = locale;
  const t = makeT("realestate", lc);

  const res = await apiServerPublic<PublicEnvelope<PublicAgentProfile[]>>(
    "/api/v1/public/agents",
  );
  const agents = res?.data ?? [];

  return (
    <PublicShell locale={lc}>
      <section className="sgi-container" style={{ paddingBlock: "var(--page-py)", display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
        <div>
          <h1 style={{ margin: "0 0 0.25rem", fontSize: "var(--h1-size)", color: "var(--ink)" }}>{t("agents.title")}</h1>
          <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "0.9rem" }}>{t("agents.subtitle")}</p>
        </div>

        {agents.length === 0 ? (
          <p style={{ color: "var(--ink-4)" }}>{t("agents.empty")}</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "1.25rem" }}>
            {agents.map((a) => (
              <Link key={a.slug} href={`/${lc}/agent/${a.slug}`} className="sgi-card" style={{ textDecoration: "none", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: "0.6rem" }}>
                <div style={{ width: 96, height: 96, borderRadius: "var(--r-full)", overflow: "hidden", background: "var(--bg-cream)", border: "2px solid var(--gold-soft)" }}>
                  {a.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photo_url} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : null}
                </div>
                <div style={{ fontWeight: 700, color: "var(--ink)" }}>{a.name}</div>
                {a.title ? <div style={{ fontSize: "0.8rem", color: "var(--gold-deep)" }}>{a.title}</div> : null}
                <span className="sgi-button sgi-button-secondary" style={{ fontSize: "0.78rem", padding: "0.35rem 0.9rem" }}>{t("agents.viewProfile")}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
