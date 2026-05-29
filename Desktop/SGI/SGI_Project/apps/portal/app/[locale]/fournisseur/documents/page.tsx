import { apiServer, ApiError } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { DocumentUploadForm } from "./DocumentUploadForm";

interface VendorDocument {
  id: string;
  doc_type: string;
  original_filename: string | null;
  expiry_date: string | null;
  status: "active" | "expired" | string;
  days_until_expiry: number | null;
  url: string | null;
  created_at: string;
}

export default async function FournisseurDocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("fournisseur", lc);
  const tc = makeT("common", lc);

  let docs: VendorDocument[] = [];
  let noProfile = false;
  let error: string | null = null;
  try {
    docs = await apiServer<VendorDocument[]>("/api/v1/fournisseur/documents");
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) noProfile = true;
    else error = e instanceof Error ? e.message : "unavailable";
  }

  const docLabels = {
    add: t("documents.add"),
    docType: t("documents.docType"),
    expiry: t("documents.expiry"),
    expiryHint: t("documents.expiryHint"),
    file: t("documents.file"),
    fileHint: t("documents.fileHint"),
    send: t("documents.send"),
    sending: t("documents.sending"),
    success: t("documents.success"),
    error: t("documents.error"),
    types: {
      trade_licence: t("documents.types.trade_licence"),
      insurance: t("documents.types.insurance"),
      vat: t("documents.types.vat"),
      id: t("documents.types.id"),
      other: t("documents.types.other"),
    },
  };

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "var(--h1-size)", color: "var(--ink)" }}>
        {t("documents.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "clamp(0.85rem, 1.8vw, 0.95rem)" }}>
        {t("documents.subtitle")}
      </p>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {tc("common.unavailable")} ({error}).
        </div>
      )}

      {noProfile ? (
        <div className="sgi-card" style={{ color: "var(--ink-3)" }}>{t("profile.noProfile")}</div>
      ) : (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {docs.length === 0 ? (
            <div className="sgi-card" style={{ color: "var(--ink-3)" }}>{t("documents.empty")}</div>
          ) : (
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {docs.map((d) => (
                <div
                  key={d.id}
                  className="sgi-card"
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--ink)" }}>
                      {docLabels.types[d.doc_type as keyof typeof docLabels.types] ?? d.doc_type}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
                      {d.original_filename ?? "—"}
                      {d.expiry_date ? ` · ${d.expiry_date}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <span
                      style={{
                        padding: "0.15rem 0.6rem",
                        borderRadius: 999,
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        background: d.status === "expired" ? "var(--rose-soft)" : "var(--emerald-soft)",
                        color: d.status === "expired" ? "var(--rose)" : "var(--emerald)",
                      }}
                    >
                      {d.status === "expired"
                        ? t("documents.expired")
                        : d.days_until_expiry !== null && d.days_until_expiry <= 30
                          ? t("documents.expiresInDays", { n: d.days_until_expiry })
                          : t("documents.active")}
                    </span>
                    {d.url && (
                      <a href={d.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold-deep)", fontWeight: 600, fontSize: "0.85rem" }}>
                        {t("documents.view")} ↗
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <DocumentUploadForm labels={docLabels} />
        </div>
      )}
    </>
  );
}
