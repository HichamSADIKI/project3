import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

interface Commission {
  id: string;
  source_type: string;
  source_id: string;
  base_amount_aed: string;
  commission_rate: string;
  commission_amount_aed: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "sgi-badge-pending",
  payable: "sgi-badge-info",
  paid: "sgi-badge-active",
  cancelled: "sgi-badge-rejected",
};

function fmtAed(raw: string | number): string {
  const n = typeof raw === "string" ? parseFloat(raw) : raw;
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  }).format(isFinite(n) ? n : 0);
}

export default async function CommissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("fournisseur", lc);

  let items: Commission[] = [];
  let error: string | null = null;
  try {
    items = await apiServer<Commission[]>("/api/v1/fournisseur/commissions");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  return (
    <>
      <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("nav.commissions")}
      </h1>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
          Aucune commission à afficher.
        </div>
      ) : (
        <div className="sgi-card sgi-table-wrap" style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--bg-paper)" }}>
              <tr>
                {["Source", "Base", "Taux", "Commission", "Statut", "Date"].map((h) => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "0.75rem", color: "var(--ink-3)", textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink-2)" }}>{c.source_type}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink-2)" }}>{fmtAed(c.base_amount_aed)}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink-2)" }}>{c.commission_rate}%</td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink)", fontWeight: 600 }}>
                    {fmtAed(c.commission_amount_aed)}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span className={`sgi-badge ${STATUS_BADGE[c.status] ?? ""}`}>{c.status}</span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink-3)", fontSize: "0.85rem" }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
