"use client";

/**
 * Écran App-Admin « Sécurité » — superviseur de sécurité GLOBAL (3B+ / Phase 4).
 *
 * Dashboard read-only platform-admin : agrège les événements sécu cross-tenant
 * (audit_logs : self_defense / honeytokens / studio) + la gouvernance Studio.
 * GET /api/admin/platform/security/overview. CSS logique RTL, i18n local AR/EN/FR.
 */

import React from "react";

import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { getJson } from "@/lib/api-client";

type Lang = "ar" | "en" | "fr";

type EventBucket = { prefix: string; label: string; count_24h: number; count_7d: number };
type RecentEvent = {
  action: string;
  resource: string;
  user_email: string | null;
  company_id: string | null;
  ip_address: string | null;
  created_at: string;
};
type StudioGovernance = {
  integration_pending: number;
  integration_expired: number;
  jobs_failed: number;
  jobs_running: number;
  modules_total: number;
  modules_by_state: Record<string, number>;
};
type SeriesItem = { prefix: string; label: string; counts: number[] };
type TimeSeries = { days: string[]; series: SeriesItem[] };
type Overview = {
  events: EventBucket[];
  timeseries: TimeSeries;
  recent: RecentEvent[];
  studio: StudioGovernance;
};

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Sécurité",
    events: "Événements de sécurité",
    trend: "Tendance (7 jours)",
    last24h: "24 h",
    last7d: "/ 7 j",
    governance: "Gouvernance Studio",
    pending: "Intégrations en attente",
    expired: "Demandes expirées",
    jobsFailed: "Jobs échoués",
    jobsRunning: "Jobs en cours",
    modules: "Modules",
    byState: "Modules par état",
    recent: "Événements récents",
    action: "Action",
    company: "Société",
    ip: "IP",
    when: "Quand",
    loading: "Chargement…",
    error: "Échec du chargement.",
    none: "—",
    refresh: "Rafraîchir",
    updatedAt: "maj",
    all: "Tous",
  },
  en: {
    title: "Security",
    events: "Security events",
    trend: "Trend (7 days)",
    last24h: "24h",
    last7d: "/ 7d",
    governance: "Studio governance",
    pending: "Pending integrations",
    expired: "Expired requests",
    jobsFailed: "Failed jobs",
    jobsRunning: "Running jobs",
    modules: "Modules",
    byState: "Modules by state",
    recent: "Recent events",
    action: "Action",
    company: "Company",
    ip: "IP",
    when: "When",
    loading: "Loading…",
    error: "Failed to load.",
    none: "—",
    refresh: "Refresh",
    updatedAt: "updated",
    all: "All",
  },
  ar: {
    title: "الأمن",
    events: "أحداث الأمان",
    trend: "الاتجاه (٧ أيام)",
    last24h: "٢٤ س",
    last7d: "/ ٧ أيام",
    governance: "حوكمة الاستوديو",
    pending: "عمليات دمج معلّقة",
    expired: "طلبات منتهية",
    jobsFailed: "مهام فاشلة",
    jobsRunning: "مهام جارية",
    modules: "الوحدات",
    byState: "الوحدات حسب الحالة",
    recent: "أحداث حديثة",
    action: "الإجراء",
    company: "الشركة",
    ip: "IP",
    when: "متى",
    loading: "جارٍ التحميل…",
    error: "فشل التحميل.",
    none: "—",
    refresh: "تحديث",
    updatedAt: "حُدّث",
    all: "الكل",
  },
};

const card: React.CSSProperties = {
  background: "var(--bg-paper)",
  border: "1px solid var(--line-soft)",
  borderRadius: 12,
};
const th: React.CSSProperties = { textAlign: "start", padding: "12px 16px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "12px 16px", color: "var(--ink-2)" };
const sectionTitle: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 700,
  color: "var(--ink-3)",
  textTransform: "uppercase",
  letterSpacing: 0.4,
};

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }): React.ReactNode {
  return (
    <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{label}</span>
      <span className="tnum" style={{ fontSize: 26, fontWeight: 700, color: "var(--ink-1)" }}>
        {value}
        {sub ? <span style={{ fontSize: 12, color: "var(--ink-4)", fontWeight: 500 }}> {sub}</span> : null}
      </span>
    </div>
  );
}

function Sparkline({ item, days }: { item: SeriesItem; days: string[] }): React.ReactNode {
  const max = Math.max(1, ...item.counts);
  return (
    <div style={{ ...card, padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" }}>{item.label}</span>
        <span className="tnum" style={{ fontSize: 11.5, color: "var(--ink-4)" }}>
          Σ {item.counts.reduce((a, b) => a + b, 0)}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 44 }}>
        {item.counts.map((c, i) => (
          <div
            key={days[i] ?? i}
            title={`${days[i] ?? ""} : ${c}`}
            style={{
              flex: 1,
              height: `${Math.round((c / max) * 100)}%`,
              minHeight: 2,
              borderRadius: 3,
              background: c > 0 ? "var(--gold-deep)" : "var(--line-soft)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function ScreenAppAdminSecurity(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [data, setData] = React.useState<Overview | null>(null);
  const [state, setState] = React.useState<"loading" | "ok" | "error">("loading");
  const [updatedAt, setUpdatedAt] = React.useState<string>("");
  const [recentFilter, setRecentFilter] = React.useState<string | null>(null);

  const load = React.useCallback(async (): Promise<void> => {
    try {
      const r = await getJson<{ data: Overview }>("/api/admin/platform/security/overview");
      setData(r.data);
      setState("ok");
      setUpdatedAt(new Date().toLocaleTimeString(lg, { hour: "2-digit", minute: "2-digit" }));
    } catch {
      setState("error");
    }
  }, [lg]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const recent = data
    ? recentFilter
      ? data.recent.filter((e) => e.action.startsWith(recentFilter))
      : data.recent
    : [];

  const grid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))",
    gap: 14,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={L("title")}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
          {updatedAt && (
            <span className="tnum" style={{ fontSize: 11.5, color: "var(--ink-4)" }}>
              {L("updatedAt")} {updatedAt}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              void load();
            }}
            style={{
              fontSize: 12,
              fontWeight: 600,
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid var(--line-soft)",
              background: "var(--bg-paper)",
              color: "var(--ink)",
              cursor: "pointer",
            }}
          >
            ↻ {L("refresh")}
          </button>
        </div>
      </Topbar>
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
        {state === "loading" && <div style={{ color: "var(--ink-4)", fontSize: 13 }}>{L("loading")}</div>}
        {state === "error" && <div style={{ color: "var(--rose)", fontSize: 13 }}>{L("error")}</div>}
        {state === "ok" && data && (
          <>
            {/* Événements sécu */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={sectionTitle}>{L("events")}</span>
              <div style={grid}>
                {data.events.map((b) => (
                  <Kpi key={b.prefix} label={b.label} value={b.count_24h} sub={`${L("last24h")} · ${b.count_7d} ${L("last7d")}`} />
                ))}
              </div>
            </div>

            {/* Tendance (7 jours) */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={sectionTitle}>{L("trend")}</span>
              <div style={grid}>
                {data.timeseries.series.map((s) => (
                  <Sparkline key={s.prefix} item={s} days={data.timeseries.days} />
                ))}
              </div>
            </div>

            {/* Gouvernance Studio */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={sectionTitle}>{L("governance")}</span>
              <div style={grid}>
                <Kpi label={L("pending")} value={data.studio.integration_pending} />
                <Kpi label={L("expired")} value={data.studio.integration_expired} />
                <Kpi label={L("jobsFailed")} value={data.studio.jobs_failed} />
                <Kpi label={L("jobsRunning")} value={data.studio.jobs_running} />
                <Kpi label={L("modules")} value={data.studio.modules_total} />
              </div>
              <div style={{ ...card, padding: 14, fontSize: 12.5, color: "var(--ink-3)" }}>
                {L("byState")} :{" "}
                {Object.entries(data.studio.modules_by_state)
                  .map(([s, c]) => `${s} ${c}`)
                  .join(" · ") || L("none")}
              </div>
            </div>

            {/* Événements récents */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span style={sectionTitle}>{L("recent")}</span>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {[{ prefix: null, label: L("all") }, ...data.events.map((e) => ({ prefix: e.prefix, label: e.label }))].map(
                  (chip) => {
                    const active = recentFilter === chip.prefix;
                    return (
                      <button
                        key={chip.prefix ?? "all"}
                        type="button"
                        onClick={() => setRecentFilter(chip.prefix)}
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "5px 12px",
                          borderRadius: 999,
                          cursor: "pointer",
                          border: "1px solid var(--line-soft)",
                          background: active ? "var(--ink-1)" : "var(--bg-paper)",
                          color: active ? "#fff" : "var(--ink-2)",
                        }}
                      >
                        {chip.label}
                      </button>
                    );
                  },
                )}
              </div>
              <div style={{ ...card, overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5 }}>
                      <th style={th}>{L("action")}</th>
                      <th style={th}>{L("company")}</th>
                      <th style={th}>{L("ip")}</th>
                      <th style={th}>{L("when")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recent.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--ink-4)" }}>
                          {L("none")}
                        </td>
                      </tr>
                    )}
                    {recent.map((e, i) => (
                      <tr key={i} style={{ borderTop: "1px solid var(--line-soft)" }}>
                        <td style={{ ...td, color: "var(--ink-1)", fontWeight: 600 }}>{e.action}</td>
                        <td className="tnum" style={{ ...td, fontSize: 11.5 }}>
                          {e.company_id ? e.company_id.slice(0, 8) : L("none")}
                        </td>
                        <td className="tnum" style={td}>
                          {e.ip_address ?? L("none")}
                        </td>
                        <td className="tnum" style={td}>
                          {e.created_at}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
