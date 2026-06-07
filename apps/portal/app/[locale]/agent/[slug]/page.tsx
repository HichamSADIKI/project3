import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { PropertyGrid } from "@/components/property-grid";
import { Ic, Svg } from "@/components/zoi/icons";
import { apiServerPublic } from "@/lib/api-server";
import {
  waMeLink,
  type PublicAgentProfile,
  type PublicListing,
} from "@/lib/realestate";

interface AgentDetailResponse {
  success?: boolean;
  data?: PublicAgentProfile;
  listings?: PublicListing[];
}

async function fetchAgent(slug: string): Promise<AgentDetailResponse | null> {
  return apiServerPublic<AgentDetailResponse>(
    `/api/v1/public/agents/${encodeURIComponent(slug)}`,
  );
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
      <section
        className="z-container"
        style={{
          paddingBlock: "40px",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <Link href={`/${lc}/agents`} className="z-back">
          {t("agents.title")}
        </Link>

        {/* Profil */}
        <div className="z-agent-hero">
          <div className="z-avatar">
            {a.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.photo_url} alt={a.name} />
            ) : (
              <Svg d={Ic.user} w={48} />
            )}
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <h1>{a.name}</h1>
            {a.title ? <div className="z-atitle">{a.title}</div> : null}
            {a.bio ? <p className="z-abio">{a.bio}</p> : null}
            <div className="z-actions">
              {a.whatsapp ? (
                <a
                  href={waMeLink(a.whatsapp ?? "") ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="z-btn z-btn-gold"
                >
                  <Svg d={Ic.phone} w={16} /> {t("agents.whatsapp")}
                </a>
              ) : null}
              {a.phone ? (
                <a
                  href={`tel:${a.phone.replace(/[^\d+]/g, "")}`}
                  className="z-btn z-btn-green"
                >
                  <Svg d={Ic.phone} w={16} /> {t("agents.call")}
                </a>
              ) : null}
              {a.email ? (
                <a href={`mailto:${a.email}`} className="z-btn z-btn-ghost">
                  <Svg d={Ic.mail} w={16} /> {t("agents.email")}
                </a>
              ) : null}
            </div>
          </div>
        </div>

        {/* Annonces de l'agence */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div className="z-sec-head" style={{ marginBottom: 0 }}>
            <span className="z-eyebrow">{t("agents.listings")}</span>
            <h2
              className="z-sec-title"
              style={{ marginTop: 12, fontSize: "clamp(26px,3vw,40px)" }}
            >
              {t("agents.listings")}
            </h2>
          </div>
          <PropertyGrid listings={listings} locale={lc} />
        </div>
      </section>
    </PublicShell>
  );
}
