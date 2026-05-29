import { apiServer, ApiError } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { MissionActions } from "./MissionActions";

interface Mission {
  id: string;
  title: string;
  description: string | null;
  status: "assigned" | "accepted" | "in_progress" | "done" | "cancelled" | string;
  scheduled_date: string | null;
  location_text: string | null;
  amount_aed: string | null;
  completed_at: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
  assigned: { bg: "var(--gold-soft, #f5ecd6)", fg: "var(--gold-deep, #8a6d2f)" },
  accepted: { bg: "var(--azure-soft, #e3edf3)", fg: "var(--azure, #4a6b82)" },
  in_progress: { bg: "var(--azure-soft, #e3edf3)", fg: "var(--azure, #4a6b82)" },
  done: { bg: "var(--emerald-soft)", fg: "var(--emerald)" },
  cancelled: { bg: "var(--rose-soft)", fg: "var(--rose)" },
};

export default async function FournisseurMissionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("fournisseur", lc);
  const tc = makeT("common", lc);

  let missions: Mission[] = [];
  let noProfile = false;
  let error: string | null = null;
  try {
    missions = await apiServer<Mission[]>("/api/v1/fournisseur/missions");
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) noProfile = true;
    else error = e instanceof Error ? e.message : "unavailable";
  }

  const actionLabels = {
    accept: t("missions.actions.accept"),
    in_progress: t("missions.actions.in_progress"),
    done: t("missions.actions.done"),
    cancel: t("missions.actions.cancel"),
    updating: t("missions.updating"),
  };

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "var(--h1-size)", color: "var(--ink)" }}>
        {t("missions.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "clamp(0.85rem, 1.8vw, 0.95rem)" }}>
        {t("missions.subtitle")}
      </p>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {tc("common.unavailable")} ({error}).
        </div>
      )}

      {noProfile ? (
        <div className="sgi-card" style={{ color: "var(--ink-3)" }}>{t("profile.noProfile")}</div>
      ) : missions.length === 0 ? (
        <div className="sgi-card" style={{ color: "var(--ink-3)" }}>{t("missions.empty")}</div>
      ) : (
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {missions.map((m) => {
            const sc = STATUS_COLOR[m.status] ?? STATUS_COLOR.assigned;
            return (
              <div key={m.id} className="sgi-card" style={{ display: "grid", gap: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 600, color: "var(--ink)" }}>{m.title}</div>
                  <span style={{ padding: "0.15rem 0.6rem", borderRadius: 999, fontSize: "0.72rem", fontWeight: 700, background: sc.bg, color: sc.fg }}>
                    {t(`missions.status.${m.status}`) || m.status}
                  </span>
                </div>
                {m.description && (
                  <p style={{ margin: 0, color: "var(--ink-3)", fontSize: "0.85rem" }}>{m.description}</p>
                )}
                <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", fontSize: "0.8rem", color: "var(--ink-3)" }}>
                  {m.scheduled_date && <span>{t("missions.scheduled")}: {m.scheduled_date}</span>}
                  {m.location_text && <span>{t("missions.location")}: {m.location_text}</span>}
                  {m.amount_aed && <span>{t("missions.amount")}: {m.amount_aed} AED</span>}
                </div>
                <MissionActions missionId={m.id} status={m.status} labels={actionLabels} />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
