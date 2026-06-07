import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

interface Visit {
  id: string;
  property_id: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  status: string;
  client_notes: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "sgi-badge-pending",
  confirmed: "sgi-badge-info",
  done: "sgi-badge-active",
  cancelled: "sgi-badge-rejected",
  no_show: "sgi-badge-rejected",
};

export default async function VisitsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("client", lc);

  let visits: Visit[] = [];
  let error: string | null = null;
  try {
    visits = await apiServer<Visit[]>("/api/v1/client/visits");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const dateLocale = lc === "ar" ? "ar-AE" : lc === "en" ? "en-AE" : "fr-FR";

  return (
    <>
      <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("nav.visits")}
      </h1>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      {visits.length === 0 ? (
        <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
          {t("visits.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {visits.map((v) => (
            <div key={v.id} className="sgi-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                <strong style={{ color: "var(--ink)" }}>
                  {new Date(v.preferred_date).toLocaleDateString(dateLocale)}
                  {v.preferred_time_slot && ` · ${v.preferred_time_slot}`}
                </strong>
                <span className={`sgi-badge ${STATUS_BADGE[v.status] ?? ""}`}>
                  {t(`visits.status.${v.status}`)}
                </span>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--ink-3)", fontFamily: "monospace" }}>
                {t("visits.propertyLabel")} {v.property_id.slice(0, 8)}…
              </div>
              {v.client_notes && (
                <p style={{ margin: "0.5rem 0 0", fontSize: "0.85rem", color: "var(--ink-2)" }}>
                  {v.client_notes}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
