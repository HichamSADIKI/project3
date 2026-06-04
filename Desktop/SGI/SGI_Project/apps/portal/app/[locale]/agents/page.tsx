import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isValidLocale, makeT, type Locale } from "@/lib/i18n";
import { PublicShell } from "@/components/public-shell";
import { Ic, Svg } from "@/components/zoi/icons";
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
      <section
        className="z-container"
        style={{
          paddingBlock: "56px",
          display: "flex",
          flexDirection: "column",
          gap: 36,
        }}
      >
        <div className="z-sec-head" style={{ marginBottom: 0 }}>
          <span className="z-eyebrow">{t("agents.title")}</span>
          <h1
            className="z-sec-title"
            style={{ marginTop: 12, fontSize: "clamp(30px,4vw,52px)" }}
          >
            {t("agents.title")}
          </h1>
          <p className="z-sec-sub">{t("agents.subtitle")}</p>
        </div>

        {agents.length === 0 ? (
          <p style={{ color: "var(--z-muted)" }}>{t("agents.empty")}</p>
        ) : (
          <div className="z-agents-grid">
            {agents.map((a) => (
              <Link
                key={a.slug}
                href={`/${lc}/agent/${a.slug}`}
                className="z-acard"
              >
                <div className="z-avatar">
                  {a.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.photo_url} alt={a.name} />
                  ) : (
                    <Svg d={Ic.user} w={40} />
                  )}
                </div>
                <div className="z-aname">{a.name}</div>
                {a.title ? <div className="z-atitle">{a.title}</div> : null}
                <span
                  className="z-btn z-btn-ghost"
                  style={{ fontSize: 13, padding: "9px 18px", marginTop: 4 }}
                >
                  {t("agents.viewProfile")}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicShell>
  );
}
