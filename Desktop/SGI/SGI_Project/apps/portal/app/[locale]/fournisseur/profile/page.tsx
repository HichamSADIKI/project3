import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

interface VendorProfile {
  party_id: string;
  vendor_type: string;
  verification_status: "pending" | "verified" | "rejected" | string;
  specialities: string[];
  service_areas: string[];
  trade_licence_number: string | null;
  trade_licence_expiry: string | null;
  trade_licence_authority: string | null;
  insurance_policy_number: string | null;
  insurance_expiry: string | null;
  rating_avg: string | number;
  rating_count: number;
  emergency_24_7: boolean;
  is_active: boolean;
  commercial_license_url: string | null;
  commercial_license_extracted: Record<string, unknown>;
  rejection_reason: string | null;
  verified_at: string | null;
}

interface FournisseurProfile {
  email: string;
  full_name: string;
  role: string;
  status: "active" | "pending" | "rejected" | "suspended" | string;
  profile: VendorProfile | null;
}

const VERIF_COLOR: Record<string, { bg: string; fg: string }> = {
  pending: { bg: "var(--gold-soft, #f5ecd6)", fg: "var(--gold-deep, #8a6d2f)" },
  verified: { bg: "var(--emerald-soft)", fg: "var(--emerald)" },
  rejected: { bg: "var(--rose-soft)", fg: "var(--rose)" },
};

export default async function FournisseurProfilePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("fournisseur", lc);
  const tc = makeT("common", lc);

  let data: FournisseurProfile | null = null;
  let error: string | null = null;
  try {
    data = await apiServer<FournisseurProfile>("/api/v1/fournisseur/profile");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const p = data?.profile ?? null;
  const verif = p?.verification_status ?? "pending";
  const verifColor = VERIF_COLOR[verif] ?? VERIF_COLOR.pending;
  const categoryLabel = p
    ? tc(`register.vendorTypes.${p.vendor_type}`) || p.vendor_type
    : "—";

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "var(--h1-size)", color: "var(--ink)" }}>
        {t("profile.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "clamp(0.85rem, 1.8vw, 0.95rem)" }}>
        {t("profile.subtitle")}
      </p>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {tc("common.unavailable")} ({error}).
        </div>
      )}

      {data && (
        <div style={{ display: "grid", gap: "1.25rem" }}>
          {/* Compte */}
          <section className="sgi-card">
            <SectionTitle>{t("profile.account")}</SectionTitle>
            <Grid>
              <Field label={t("profile.name")} value={data.full_name} />
              <Field label={t("profile.email")} value={data.email} />
              <Field
                label={t("profile.accountStatus")}
                value={<Badge {...badgeForStatus(data.status, verifColor)}>{t(`profile.acct.${data.status}`)}</Badge>}
              />
            </Grid>
          </section>

          {/* Profil prestataire */}
          {p ? (
            <section className="sgi-card">
              <SectionTitle>{t("profile.profileSection")}</SectionTitle>
              <Grid>
                <Field label={t("profile.category")} value={categoryLabel} />
                <Field
                  label={t("profile.verificationStatus")}
                  value={
                    <Badge bg={verifColor.bg} fg={verifColor.fg}>
                      {t(`profile.verif.${verif}`) || verif}
                    </Badge>
                  }
                />
                <Field
                  label={t("profile.rating")}
                  value={`${Number(p.rating_avg).toFixed(1)} ★ (${p.rating_count} ${t("profile.reviews")})`}
                />
              </Grid>
              {verif === "rejected" && p.rejection_reason && (
                <p style={{ marginTop: "0.75rem", color: "var(--rose)", fontSize: "0.85rem" }}>
                  {t("profile.rejectionReason")} : {p.rejection_reason}
                </p>
              )}
            </section>
          ) : (
            <section className="sgi-card" style={{ color: "var(--ink-3)" }}>
              {t("profile.noProfile")}
            </section>
          )}

          {/* Licence commerciale */}
          {p && (
            <section className="sgi-card">
              <SectionTitle>{t("profile.licence")}</SectionTitle>
              <Grid>
                <Field label={t("profile.licenceNumber")} value={p.trade_licence_number || "—"} />
                <Field label={t("profile.licenceExpiry")} value={p.trade_licence_expiry || "—"} />
                <Field label={t("profile.licenceAuthority")} value={p.trade_licence_authority || "—"} />
              </Grid>
              <div style={{ marginTop: "0.85rem" }}>
                {p.commercial_license_url ? (
                  <a
                    href={p.commercial_license_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sgi-button sgi-button-secondary"
                  >
                    {t("profile.viewDoc")} ↗
                  </a>
                ) : (
                  <span style={{ color: "var(--ink-4)", fontSize: "0.85rem" }}>{t("profile.noDoc")}</span>
                )}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  );
}

function badgeForStatus(
  status: string,
  verifColor: { bg: string; fg: string },
): { bg: string; fg: string } {
  if (status === "active") return { bg: "var(--emerald-soft)", fg: "var(--emerald)" };
  if (status === "rejected" || status === "suspended") return { bg: "var(--rose-soft)", fg: "var(--rose)" };
  return verifColor;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: "0 0 0.85rem", fontSize: "1.05rem", color: "var(--ink)" }}>{children}</h2>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
        gap: "0.9rem",
      }}
    >
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.72rem",
          color: "var(--ink-4)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "0.9rem", color: "var(--ink)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}

function Badge({ children, bg, fg }: { children: React.ReactNode; bg: string; fg: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.18rem 0.65rem",
        borderRadius: 999,
        background: bg,
        color: fg,
        fontSize: "0.75rem",
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}
