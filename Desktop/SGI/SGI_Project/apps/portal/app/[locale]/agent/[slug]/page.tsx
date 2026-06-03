import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { PropertyGrid } from "@/components/property-grid";
import { apiServerPublic } from "@/lib/api-server";
import { waMeLink, type PublicAgentProfile, type PublicListing } from "@/lib/realestate";

interface AgentDetailResponse {
  success?: boolean;
  data?: PublicAgentProfile;
  listings?: PublicListing[];
}

async function fetchAgent(slug: string): Promise<AgentDetailResponse | null> {
  return apiServerPublic<AgentDetailResponse>(`/api/v1/public/agents/${encodeURIComponent(slug)}`);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const res = await fetchAgent(slug);
  const a = res?.data;
  const t = makeT("realestate", lc);
  return {
    title: a ? `${a.name}${a.title ? ` — ${a.title}` : ""}` : t("agents.title"),
    description: a?.bio ?? t("agents.subtitle"),
    openGraph: a?.photo_url ? { images: [a.photo_url] } : undefined,
  };
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!isValidLocale(locale)) notFound();
  const lc: Locale = locale;
  const t = makeT("realestate", lc);

  const res = await fetchAgent(slug);
  const a = res?.data;
  if (!a) notFound();
  const listings = res?.listings ?? [];

  return (
    <PublicShell locale={lc}>
      <section className="sgi-container" style={{ paddingBlock: "var(--page-py)", display: "flex", flexDirection: "column", gap: "var(--section-gap)" }}>
        {/* Profil */}
        <div className="sgi-card" style={{ display: "flex", gap: "1.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ width: 120, height: 120, borderRadius: "var(--r-full)", overflow: "hidden", background: "var(--bg-cream)", border: "2px solid var(--gold-soft)", flexShrink: 0 }}>
            {a.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.photo_url} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : null}
          </div>
          <div style={{ flex: 1, minWidth: 220, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <h1 style={{ margin: 0, fontSize: "1.5rem", color: "var(--ink)" }}>{a.name}</h1>
            {a.title ? <div style={{ color: "var(--gold-deep)", fontWeight: 600 }}>{a.title}</div> : null}
            {a.bio ? <p style={{ margin: "0.3rem 0 0", color: "var(--ink-3)", fontSize: "0.9rem", lineHeight: 1.5 }}>{a.bio}</p> : null}
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginBlockStart: "0.5rem" }}>
              {a.whatsapp ? (
                <a href={waMeLink(a.whatsapp ?? "") ?? "#"} target="_blank" rel="noopener noreferrer" className="sgi-button sgi-button-primary" style={{ fontSize: "0.82rem" }}>
                  {t("agents.whatsapp")}
                </a>
              ) : null}
              {a.phone ? (
                <a href={`tel:${a.phone}`} className="sgi-button sgi-button-secondary" style={{ fontSize: "0.82rem" }}>
                  {t("agents.call")} <span className="tnum" style={{ marginInlineStart: 4 }}>{a.phone}</span>
                </a>
              ) : null}
              {a.email ? (
                <a href={`mailto:${a.email}`} className="sgi-button sgi-button-secondary" style={{ fontSize: "0.82rem" }}>
                  {t("agents.email")}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {/* Annonces de l'agence */}
        <div>
          <h2 style={{ margin: "0 0 0.75rem", fontSize: "1.15rem", color: "var(--ink)" }}>{t("agents.listings")}</h2>
          <PropertyGrid listings={listings} locale={lc} />
        </div>
      </section>
    </PublicShell>
  );
}
