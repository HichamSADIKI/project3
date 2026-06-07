import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

interface Favorite {
  id: string;
  property_id: string;
  created_at: string;
}

export default async function FavoritesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("client", lc);

  let favorites: Favorite[] = [];
  let error: string | null = null;
  try {
    favorites = await apiServer<Favorite[]>("/api/v1/client/favorites");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const dateLocale = lc === "ar" ? "ar-AE" : lc === "en" ? "en-AE" : "fr-FR";

  return (
    <>
      <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("nav.favorites")}
      </h1>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
          {t("favorites.empty")}
        </div>
      ) : (
        <div className="sgi-card">
          <div className="sgi-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "start" }}>
                <th style={{ padding: "0.5rem", textAlign: "start", fontSize: "0.8rem", color: "var(--ink-3)" }}>
                  {t("favorites.cols.propertyId")}
                </th>
                <th style={{ padding: "0.5rem", textAlign: "start", fontSize: "0.8rem", color: "var(--ink-3)" }}>
                  {t("favorites.cols.addedOn")}
                </th>
              </tr>
            </thead>
            <tbody>
              {favorites.map((f) => (
                <tr key={f.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "0.625rem 0.5rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
                    {f.property_id.slice(0, 8)}…
                  </td>
                  <td style={{ padding: "0.625rem 0.5rem", color: "var(--ink-3)", fontSize: "0.85rem" }}>
                    {new Date(f.created_at).toLocaleDateString(dateLocale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </>
  );
}
