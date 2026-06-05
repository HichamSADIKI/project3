"use client";

/**
 * Écran Administration application · Serveurs & réseau (infra-admin, PLATEFORME).
 *
 * Câblé sur le sous-routeur backend `admin.platform.infra` (cross-tenant, super-admin) :
 *   GET /api/admin/platform/servers  → liste des services supervisés + état live Prometheus
 *   GET /api/admin/platform/network  → métriques réseau instantanées (rx/tx + connexions)
 *
 * Visible uniquement pour un super-admin plateforme (le backend renvoie 403 sinon).
 * Dégradation propre : si Prometheus est injoignable, le backend renvoie
 * `meta.prometheus_available=false` (servers) / `meta.available=false` (network) et
 * des `live_state`/`metrics` nuls — l'écran affiche alors un bandeau « métriques
 * indisponibles » au lieu de planter.
 *
 * États gérés : loading · error · empty. Montants/débits en chiffres latins.
 * CSS LOGIQUE uniquement (Loi 3 RTL) · i18n AR/EN/FR via useLang.
 */

import React, { useEffect, useState } from "react";

import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { getJson, postJson, extractError } from "@/lib/api-client";

type Lang = "ar" | "en" | "fr";

type InfraService = {
  id: string;
  name: string;
  kind: string;
  description: string | null;
  last_known_state: string | null;
  last_checked_at: string | null;
  is_controllable: boolean;
  live_state: string | null;
};

type ServerList = {
  success: boolean;
  data: InfraService[];
  meta: { total: number; prometheus_available: boolean };
};

type NetworkMetrics = {
  rx_bytes_per_sec: number | null;
  tx_bytes_per_sec: number | null;
  active_connections: number | null;
};

type Network = {
  success: boolean;
  data: NetworkMetrics;
  meta: { available: boolean };
};

type InfraAlert = {
  name: string;
  severity: string | null;
  state: string | null;
  summary: string | null;
  active_at: string | null;
};

type AlertList = {
  success: boolean;
  data: InfraAlert[];
  meta: { available: boolean; total: number };
};

type ServerAction = "start" | "stop" | "restart" | "suspend";

type ActionRow = {
  id: string;
  service_id: string;
  action: string;
  status: string;
  detail: string | null;
  created_at: string;
};

type ActionList = {
  success: boolean;
  data: ActionRow[];
  meta: { total: number };
};

const ACTIONS: ServerAction[] = ["restart", "stop", "start", "suspend"];

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Serveurs & réseau",
    servers: "Services supervisés",
    network: "Réseau",
    rx: "Débit entrant",
    tx: "Débit sortant",
    conns: "Connexions actives",
    state: "État",
    kind: "Type",
    controllable: "Pilotable",
    lastChecked: "Vérifié",
    loading: "Chargement…",
    error: "Impossible de charger les données",
    emptyServers: "Aucun service supervisé",
    alerts: "Alertes infra (Prometheus)",
    alertsEmpty: "Aucune alerte active",
    firing: "Active",
    pending: "En attente",
    act_restart: "Redémarrer",
    act_stop: "Arrêter",
    act_start: "Démarrer",
    act_suspend: "Suspendre",
    confirmTitle: "Confirmer l'action",
    confirmHint: "Tapez le nom du service pour confirmer :",
    confirm: "Confirmer",
    cancel: "Annuler",
    actionFailed: "Échec de l'action",
    dryRunNote: "Mode simulation — aucune exécution réelle (D1).",
    history: "Historique des actions",
    noActions: "Aucune action",
    metricsUnavailable: "Métriques indisponibles — Prometheus est injoignable.",
    up: "En ligne",
    down: "Hors ligne",
    unknown: "Inconnu",
    yes: "Oui",
    no: "Non",
    none: "—",
  },
  en: {
    title: "Servers & Network",
    servers: "Monitored services",
    network: "Network",
    rx: "Inbound throughput",
    tx: "Outbound throughput",
    conns: "Active connections",
    state: "State",
    kind: "Type",
    controllable: "Controllable",
    lastChecked: "Checked",
    loading: "Loading…",
    error: "Unable to load data",
    emptyServers: "No monitored services",
    alerts: "Infra alerts (Prometheus)",
    alertsEmpty: "No active alerts",
    firing: "Firing",
    pending: "Pending",
    act_restart: "Restart",
    act_stop: "Stop",
    act_start: "Start",
    act_suspend: "Suspend",
    confirmTitle: "Confirm action",
    confirmHint: "Type the service name to confirm:",
    confirm: "Confirm",
    cancel: "Cancel",
    actionFailed: "Action failed",
    dryRunNote: "Dry-run — no real execution (D1).",
    history: "Action history",
    noActions: "No action",
    metricsUnavailable: "Metrics unavailable — Prometheus is unreachable.",
    up: "Up",
    down: "Down",
    unknown: "Unknown",
    yes: "Yes",
    no: "No",
    none: "—",
  },
  ar: {
    title: "الخوادم والشبكة",
    servers: "الخدمات المراقَبة",
    network: "الشبكة",
    rx: "حركة واردة",
    tx: "حركة صادرة",
    conns: "اتصالات نشطة",
    state: "الحالة",
    kind: "النوع",
    controllable: "قابل للتحكم",
    lastChecked: "آخر فحص",
    loading: "جارٍ التحميل…",
    error: "تعذّر تحميل البيانات",
    emptyServers: "لا توجد خدمات مراقَبة",
    alerts: "تنبيهات البنية (Prometheus)",
    alertsEmpty: "لا توجد تنبيهات نشطة",
    firing: "نشط",
    pending: "قيد الانتظار",
    act_restart: "إعادة التشغيل",
    act_stop: "إيقاف",
    act_start: "تشغيل",
    act_suspend: "تعليق",
    confirmTitle: "تأكيد الإجراء",
    confirmHint: "اكتب اسم الخدمة للتأكيد:",
    confirm: "تأكيد",
    cancel: "إلغاء",
    actionFailed: "فشل الإجراء",
    dryRunNote: "وضع المحاكاة — لا تنفيذ فعلي (D1).",
    history: "سجل الإجراءات",
    noActions: "لا إجراءات",
    metricsUnavailable: "المقاييس غير متاحة — تعذّر الوصول إلى Prometheus.",
    up: "متصل",
    down: "غير متصل",
    unknown: "غير معروف",
    yes: "نعم",
    no: "لا",
    none: "—",
  },
};

/** Formate un débit en octets/s vers une unité lisible (chiffres latins). */
function fmtBytesPerSec(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  const units = ["B/s", "KB/s", "MB/s", "GB/s", "TB/s"];
  let n = v;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: i === 0 ? 0 : 2 }).format(n)} ${units[i]}`;
}

/** Formate un nombre entier (connexions) en chiffres latins. */
function fmtInt(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(v);
}

/** Couleur d'accent selon l'état live d'un service. */
function stateColor(state: string | null): string {
  if (state === "up") return "var(--emerald)";
  if (state === "down") return "var(--rose)";
  return "var(--ink-4)";
}

const card: React.CSSProperties = {
  flex: "1 1 320px",
  background: "var(--bg-paper)",
  border: "1px solid var(--line-soft)",
  borderRadius: 12,
  padding: 16,
};

const kpiCard: React.CSSProperties = {
  flex: "1 1 180px",
  background: "var(--bg-paper)",
  border: "1px solid var(--line-soft)",
  borderRadius: 12,
  padding: "14px 16px",
};

const actionBtn: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: 6,
  border: "1px solid var(--line-soft)",
  background: "var(--bg-paper)",
  color: "var(--ink)",
  cursor: "pointer",
};

export function ScreenAppAdminInfra(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [servers, setServers] = useState<ServerList | null>(null);
  const [network, setNetwork] = useState<Network | null>(null);
  const [alerts, setAlerts] = useState<AlertList | null>(null);
  const [history, setHistory] = useState<ActionList | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  // Confirmation d'action : on exige la saisie EXACTE du nom du service.
  const [pending, setPending] = useState<{
    id: string;
    name: string;
    action: ServerAction;
  } | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionErr, setActionErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(false);
    Promise.all([
      getJson<ServerList>("/api/admin/platform/servers"),
      getJson<Network>("/api/admin/platform/network"),
      getJson<AlertList>("/api/admin/platform/alerts"),
      getJson<ActionList>("/api/admin/platform/actions?limit=10"),
    ])
      .then(([srv, net, alr, act]) => {
        if (!alive) return;
        setServers(srv);
        setNetwork(net);
        setAlerts(alr);
        setHistory(act);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  async function submitAction(): Promise<void> {
    if (!pending) return;
    setSubmitting(true);
    setActionErr(null);
    try {
      const res = await postJson(
        `/api/admin/platform/servers/${pending.id}/actions`,
        {
          action: pending.action,
          confirmation: confirmText,
        },
      );
      if (!res.ok) {
        setActionErr(await extractError(res, "action_failed"));
        return;
      }
      setPending(null);
      setConfirmText("");
      const act = await getJson<ActionList>(
        "/api/admin/platform/actions?limit=10",
      );
      setHistory(act);
    } catch {
      setActionErr(L("actionFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  const prometheusDown =
    (servers !== null && !servers.meta.prometheus_available) ||
    (network !== null && !network.meta.available);

  const kpi = (
    label: string,
    value: string,
    accent?: string,
  ): React.ReactNode => (
    <div style={kpiCard}>
      <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBlockEnd: 6 }}>
        {label}
      </div>
      <div
        className="font-display"
        style={{ fontSize: 20, fontWeight: 700, color: accent ?? "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );

  const stateBadge = (svc: InfraService): React.ReactNode => {
    const live = svc.live_state ?? svc.last_known_state ?? null;
    const labelKey =
      live === "up" ? "up" : live === "down" ? "down" : "unknown";
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          fontWeight: 600,
          color: stateColor(live),
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: stateColor(live),
            display: "inline-block",
          }}
        />
        {L(labelKey)}
      </span>
    );
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
          padding: 20,
          display: "flex",
          flexDirection: "column",
          gap: 16,
          background: "var(--bg-cream)",
        }}
      >
        {loading ? (
          <div style={{ fontSize: 13, color: "var(--ink-4)" }}>
            {L("loading")}
          </div>
        ) : error ? (
          <div
            style={{
              background: "var(--bg-paper)",
              border: "1px solid var(--rose)",
              borderRadius: 12,
              padding: 16,
              color: "var(--rose)",
              fontSize: 13,
            }}
          >
            {L("error")}
          </div>
        ) : (
          <>
            {/* Bandeau dégradation Prometheus */}
            {prometheusDown && (
              <div
                style={{
                  background:
                    "color-mix(in srgb, var(--gold-deep) 12%, var(--bg-paper))",
                  border: "1px solid var(--gold-deep)",
                  borderRadius: 12,
                  padding: "10px 14px",
                  color: "var(--gold-deep)",
                  fontSize: 12.5,
                  fontWeight: 600,
                  textAlign: "start",
                }}
              >
                ⚠ {L("metricsUnavailable")}
              </div>
            )}

            {/* Métriques réseau — KPIs */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              {kpi(
                L("rx"),
                fmtBytesPerSec(network?.data.rx_bytes_per_sec ?? null),
                "var(--emerald)",
              )}
              {kpi(
                L("tx"),
                fmtBytesPerSec(network?.data.tx_bytes_per_sec ?? null),
              )}
              {kpi(
                L("conns"),
                fmtInt(network?.data.active_connections ?? null),
              )}
            </div>

            {/* Alertes infra Prometheus (B2) */}
            <div style={card}>
              <div
                className="font-display"
                style={{ fontSize: 14, fontWeight: 600, marginBlockEnd: 12 }}
              >
                {L("alerts")}
              </div>
              {alerts && alerts.data.length > 0 ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 0 }}
                >
                  {alerts.data.map((al, i) => (
                    <div
                      key={`${al.name}-${i}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 0",
                        borderBottom: "1px solid var(--line-soft)",
                      }}
                    >
                      <div style={{ minWidth: 0, textAlign: "start" }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--ink)",
                          }}
                        >
                          {al.name}
                        </div>
                        {al.summary && (
                          <div
                            style={{
                              fontSize: 11.5,
                              color: "var(--ink-4)",
                              marginBlockStart: 2,
                            }}
                          >
                            {al.summary}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          flexShrink: 0,
                          fontSize: 11.5,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 600,
                            color:
                              al.severity === "critical"
                                ? "var(--rose)"
                                : al.severity === "warning"
                                  ? "var(--gold-deep)"
                                  : "var(--ink-4)",
                          }}
                        >
                          {al.severity ?? "—"}
                        </span>
                        <span style={{ color: "var(--ink-4)" }}>
                          {al.state === "firing" ? L("firing") : L("pending")}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>
                  {L("alertsEmpty")}
                </div>
              )}
            </div>

            {/* Services supervisés */}
            <div style={card}>
              <div
                className="font-display"
                style={{ fontSize: 14, fontWeight: 600, marginBlockEnd: 12 }}
              >
                {L("servers")}
              </div>
              {servers && servers.data.length > 0 ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 0 }}
                >
                  {servers.data.map((svc) => (
                    <div
                      key={svc.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 0",
                        borderBottom: "1px solid var(--line-soft)",
                      }}
                    >
                      <div style={{ minWidth: 0, textAlign: "start" }}>
                        <div
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--ink)",
                          }}
                        >
                          {svc.name}
                        </div>
                        <div
                          style={{
                            fontSize: 11.5,
                            color: "var(--ink-4)",
                            marginBlockStart: 2,
                          }}
                        >
                          {svc.kind}
                          {svc.description ? ` · ${svc.description}` : ""}
                        </div>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 16,
                          flexShrink: 0,
                          fontSize: 11.5,
                          color: "var(--ink-4)",
                        }}
                      >
                        {stateBadge(svc)}
                        {svc.is_controllable && (
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            {ACTIONS.map((a) => (
                              <button
                                key={a}
                                type="button"
                                style={actionBtn}
                                onClick={() => {
                                  setPending({
                                    id: svc.id,
                                    name: svc.name,
                                    action: a,
                                  });
                                  setConfirmText("");
                                  setActionErr(null);
                                }}
                              >
                                {L(`act_${a}`)}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>
                  {L("emptyServers")}
                </div>
              )}
            </div>

            {/* Historique des actions (D1 — dry-run) */}
            <div style={card}>
              <div
                className="font-display"
                style={{ fontSize: 14, fontWeight: 600, marginBlockEnd: 12 }}
              >
                {L("history")}
              </div>
              {history && history.data.length > 0 ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 0 }}
                >
                  {history.data.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "8px 0",
                        borderBottom: "1px solid var(--line-soft)",
                        fontSize: 12,
                      }}
                    >
                      <span style={{ fontWeight: 600, color: "var(--ink)" }}>
                        {L(`act_${a.action}`) ?? a.action}
                      </span>
                      <span style={{ color: "var(--ink-4)", textAlign: "end" }}>
                        {a.status}
                        {a.detail ? ` · ${a.detail}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>
                  {L("noActions")}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {pending && (
        <div
          onClick={() => !submitting && setPending(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "grid",
            placeItems: "center",
            zIndex: 50,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-paper)",
              border: "1px solid var(--line-soft)",
              borderRadius: 12,
              padding: 20,
              width: "min(420px, 100%)",
              textAlign: "start",
            }}
          >
            <div
              className="font-display"
              style={{ fontSize: 15, fontWeight: 700 }}
            >
              {L("confirmTitle")} · {L(`act_${pending.action}`)}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--gold-deep)",
                marginBlockStart: 6,
              }}
            >
              ⚠ {L("dryRunNote")}
            </div>
            <div
              style={{
                fontSize: 12.5,
                marginBlockStart: 12,
                color: "var(--ink)",
              }}
            >
              {L("confirmHint")} <b>{pending.name}</b>
            </div>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoFocus
              style={{
                width: "100%",
                marginBlockStart: 8,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid var(--line-soft)",
                fontSize: 13,
              }}
            />
            {actionErr && (
              <div
                style={{
                  color: "var(--rose)",
                  fontSize: 12,
                  marginBlockStart: 8,
                }}
              >
                {actionErr}
              </div>
            )}
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginBlockStart: 14,
              }}
            >
              <button
                type="button"
                onClick={() => setPending(null)}
                disabled={submitting}
                style={actionBtn}
              >
                {L("cancel")}
              </button>
              <button
                type="button"
                onClick={submitAction}
                disabled={submitting || confirmText !== pending.name}
                style={{
                  ...actionBtn,
                  background: "var(--rose)",
                  color: "#fff",
                  borderColor: "var(--rose)",
                  opacity: submitting || confirmText !== pending.name ? 0.5 : 1,
                }}
              >
                {L("confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
