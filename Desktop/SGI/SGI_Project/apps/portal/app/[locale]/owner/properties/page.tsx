import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

interface Property {
  id: string;
  name: string | null;
}

export default async function OwnerProperties({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("owner", lc);

  let props: Property[] = [];
  let error: string | null = null;
  try {
    props = await apiServer<Property[]>("/api/v1/owner/properties");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  return (
    <>
      <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("properties.title")}
      </h1>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      {!error && props.length === 0 ? (
        <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
          {t("properties.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {props.map((p) => (
            <div key={p.id} className="sgi-card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <span style={{ fontSize: "1.2rem" }}>🏢</span>
                <strong style={{ color: "var(--ink)" }}>{p.name ?? p.id.slice(0, 8)}</strong>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--ink-4)", fontFamily: "monospace", marginTop: "0.25rem" }}>
                {p.id}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
