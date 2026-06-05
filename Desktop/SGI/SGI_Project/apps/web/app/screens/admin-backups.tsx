"use client";

/**
 * Écran App-Admin « Sauvegardes » — câblé sur le module plateforme backend :
 *   GET /api/admin/platform/backups          → liste des runs (data: BackupRun[])
 *   GET /api/admin/platform/backups/summary  → résumé par cible (data: BackupTargetSummary[])
 *
 * Résumé par cible (DB / MinIO) : dernier statut, âge, taille, santé.
 * Tailles en chiffres latins. CSS logique uniquement (Loi 3 RTL). i18n local (useLang).
 *
 * NB : ces endpoints plateforme sont volontairement cross-tenant (super-admin),
 * la frontière d'accès est posée au niveau routeur backend (require_platform_admin).
 */

import React from "react";

import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";

type Lang = "ar" | "en" | "fr";

/** Une cible de sauvegarde résumée (renvoyée par .../backups/summary). */
type TargetSummary = {
  target: string; // "database" | "object_storage" | autre
  label?: string | null;
  last_status?: string | null; // "success" | "failed" | "running" | null
  last_run_at?: string | null; // ISO timestamp du dernier run
  last_size_bytes?: number | string | null;
  health?: string | null; // "healthy" | "stale" | "failing" | "unknown"
};

/** Un run de sauvegarde individuel (renvoyé par .../backups). */
type BackupRun = {
  id: string;
  target: string;
  status: string; // "success" | "failed" | "running"
  started_at?: string | null;
  finished_at?: string | null;
  size_bytes?: number | string | null;
  message?: string | null;
};

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Sauvegardes",
    summary: "État par cible",
    runs: "Historique des runs",
    target: "Cible",
    status: "Statut",
    age: "Ancienneté",
    size: "Taille",
    health: "Santé",
    started: "Démarré",
    finished: "Terminé",
    message: "Message",
    loading: "Chargement…",
    empty: "Aucune sauvegarde enregistrée.",
    error: "Échec du chargement des sauvegardes.",
    never: "Jamais",
    database: "Base de données",
    object_storage: "Stockage objets (MinIO)",
    success: "Réussie",
    failed: "Échouée",
    running: "En cours",
    healthy: "Saine",
    stale: "Obsolète",
    failing: "En échec",
    unknown: "Inconnue",
    justNow: "à l'instant",
    minutesAgo: "min",
    hoursAgo: "h",
    daysAgo: "j",
  },
  en: {
    title: "Backups",
    summary: "Status per target",
    runs: "Run history",
    target: "Target",
    status: "Status",
    age: "Age",
    size: "Size",
    health: "Health",
    started: "Started",
    finished: "Finished",
    message: "Message",
    loading: "Loading…",
    empty: "No backups recorded.",
    error: "Failed to load backups.",
    never: "Never",
    database: "Database",
    object_storage: "Object storage (MinIO)",
    success: "Success",
    failed: "Failed",
    running: "Running",
    healthy: "Healthy",
    stale: "Stale",
    failing: "Failing",
    unknown: "Unknown",
    justNow: "just now",
    minutesAgo: "min",
    hoursAgo: "h",
    daysAgo: "d",
  },
  ar: {
    title: "النسخ الاحتياطية",
    summary: "الحالة حسب الهدف",
    runs: "سجل العمليات",
    target: "الهدف",
    status: "الحالة",
    age: "العمر",
    size: "الحجم",
    health: "الصحة",
    started: "بدأت",
    finished: "انتهت",
    message: "رسالة",
    loading: "جارٍ التحميل…",
    empty: "لا توجد نسخ احتياطية مسجّلة.",
    error: "فشل تحميل النسخ الاحتياطية.",
    never: "أبدًا",
    database: "قاعدة البيانات",
    object_storage: "تخزين الكائنات (MinIO)",
    success: "ناجحة",
    failed: "فاشلة",
    running: "قيد التنفيذ",
    healthy: "سليمة",
    stale: "قديمة",
    failing: "متعثّرة",
    unknown: "غير معروفة",
    justNow: "الآن",
    minutesAgo: "دق",
    hoursAgo: "س",
    daysAgo: "ي",
  },
};

const STATUS_COLOR: Record<string, { c: string; b: string }> = {
  success: { c: "var(--emerald)", b: "rgba(16,185,129,0.12)" },
  healthy: { c: "var(--emerald)", b: "rgba(16,185,129,0.12)" },
  running: { c: "var(--gold-deep)", b: "rgba(212,160,55,0.14)" },
  stale: { c: "var(--gold-deep)", b: "rgba(212,160,55,0.14)" },
  failed: { c: "var(--rose)", b: "var(--rose-soft)" },
  failing: { c: "var(--rose)", b: "var(--rose-soft)" },
};

/** Taille humaine en chiffres latins (binaire). */
function humanSize(raw: number | string | null | undefined): string {
  const n = Number(raw);
  if (!raw || Number.isNaN(n) || n <= 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  const fmt = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: v < 10 && i > 0 ? 1 : 0,
  });
  return `${fmt.format(v)} ${units[i]}`;
}

/** Ancienneté relative à partir d'un timestamp ISO. */
function ageOf(
  iso: string | null | undefined,
  L: (k: string) => string,
): string {
  if (!iso) return L("never");
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return L("never");
  const diffMs = Date.now() - then;
  if (diffMs < 60_000) return L("justNow");
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} ${L("minutesAgo")}`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ${L("hoursAgo")}`;
  const days = Math.floor(hours / 24);
  return `${days} ${L("daysAgo")}`;
}

const card: React.CSSProperties = {
  background: "var(--bg-paper)",
  border: "1px solid var(--line-soft)",
  borderRadius: 12,
  overflow: "hidden",
};
const th: React.CSSProperties = {
  textAlign: "start",
  padding: "12px 16px",
  fontWeight: 600,
};
const td: React.CSSProperties = { padding: "12px 16px", color: "var(--ink-2)" };

function Badge({
  kind,
  label,
}: {
  kind: string;
  label: string;
}): React.ReactNode {
  const c = STATUS_COLOR[kind] ?? { c: "var(--ink-3)", b: "var(--line-soft)" };
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 10px",
        borderRadius: 999,
        background: c.b,
        color: c.c,
      }}
    >
      {label}
    </span>
  );
}

export function ScreenAppAdminBackups(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;
  const targetLabel = (t: string, fallback?: string | null): string =>
    TR[lg][t] ?? fallback ?? t;
  const statusLabel = (s: string | null | undefined): string =>
    s ? (TR[lg][s] ?? s) : "—";

  const summary = useApiList<TargetSummary>(
    "/api/admin/platform/backups/summary",
  );
  const runs = useApiList<BackupRun>("/api/admin/platform/backups?limit=100");

  const sectionTitle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: "var(--ink-3)",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        overflow: "hidden",
      }}
    >
      <Topbar title={L("title")} />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 28px",
          background: "var(--bg-cream)",
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        {/* ── Résumé par cible (cartes DB / MinIO) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={sectionTitle}>{L("summary")}</span>

          {summary.loading && (
            <div
              style={{
                ...card,
                padding: 20,
                color: "var(--ink-4)",
                fontSize: 13,
              }}
            >
              {L("loading")}
            </div>
          )}
          {!summary.loading && summary.error && (
            <div
              style={{
                ...card,
                padding: 20,
                color: "var(--rose)",
                fontSize: 13,
              }}
            >
              {L("error")}
            </div>
          )}
          {!summary.loading && !summary.error && summary.items.length === 0 && (
            <div
              style={{
                ...card,
                padding: 20,
                color: "var(--ink-4)",
                fontSize: 13,
              }}
            >
              {L("empty")}
            </div>
          )}
          {!summary.loading && !summary.error && summary.items.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 14,
              }}
            >
              {summary.items.map((s) => {
                const health = s.health ?? "unknown";
                return (
                  <div
                    key={s.target}
                    style={{
                      ...card,
                      padding: 18,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: 14,
                          color: "var(--ink-1)",
                        }}
                      >
                        {targetLabel(s.target, s.label)}
                      </span>
                      <Badge kind={health} label={statusLabel(health)} />
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        fontSize: 12.5,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "var(--ink-4)" }}>
                          {L("status")}
                        </span>
                        <Badge
                          kind={s.last_status ?? "unknown"}
                          label={statusLabel(s.last_status)}
                        />
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "var(--ink-4)" }}>
                          {L("age")}
                        </span>
                        <span
                          className="tnum"
                          style={{ color: "var(--ink-2)", fontWeight: 600 }}
                        >
                          {ageOf(s.last_run_at, L)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span style={{ color: "var(--ink-4)" }}>
                          {L("size")}
                        </span>
                        <span
                          className="tnum"
                          style={{ color: "var(--ink-2)", fontWeight: 600 }}
                        >
                          {humanSize(s.last_size_bytes)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Historique des runs ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={sectionTitle}>{L("runs")}</span>
          <div style={card}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 13,
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-cream)",
                    color: "var(--ink-4)",
                    fontSize: 11.5,
                    textTransform: "uppercase",
                  }}
                >
                  <th style={th}>{L("target")}</th>
                  <th style={th}>{L("status")}</th>
                  <th style={th}>{L("started")}</th>
                  <th style={th}>{L("finished")}</th>
                  <th style={{ ...th, textAlign: "end" }}>{L("size")}</th>
                  <th style={th}>{L("message")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.loading && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        ...td,
                        textAlign: "center",
                        color: "var(--ink-4)",
                      }}
                    >
                      {L("loading")}
                    </td>
                  </tr>
                )}
                {!runs.loading && runs.error && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        ...td,
                        textAlign: "center",
                        color: "var(--rose)",
                      }}
                    >
                      {L("error")}
                    </td>
                  </tr>
                )}
                {!runs.loading && !runs.error && runs.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        ...td,
                        textAlign: "center",
                        color: "var(--ink-4)",
                      }}
                    >
                      {L("empty")}
                    </td>
                  </tr>
                )}
                {!runs.loading &&
                  !runs.error &&
                  runs.items.map((r) => (
                    <tr
                      key={r.id}
                      style={{ borderTop: "1px solid var(--line-soft)" }}
                    >
                      <td
                        style={{
                          ...td,
                          fontWeight: 600,
                          color: "var(--ink-1)",
                        }}
                      >
                        {targetLabel(r.target)}
                      </td>
                      <td style={td}>
                        <Badge kind={r.status} label={statusLabel(r.status)} />
                      </td>
                      <td className="tnum" style={td}>
                        {r.started_at ?? "—"}
                      </td>
                      <td className="tnum" style={td}>
                        {r.finished_at ?? "—"}
                      </td>
                      <td className="tnum" style={{ ...td, textAlign: "end" }}>
                        {humanSize(r.size_bytes)}
                      </td>
                      <td style={{ ...td, color: "var(--ink-3)" }}>
                        {r.message ?? "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
