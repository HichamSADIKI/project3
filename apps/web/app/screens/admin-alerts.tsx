"use client";

/**
 * Écran Administration application · Alertes (app-admin, tenant) — gestion B1b.
 *
 *   GET/POST   /api/admin/appadmin/alerts/rules         → règles de seuil
 *   PATCH/DEL  /api/admin/appadmin/alerts/rules/{id}     → activer/désactiver, supprimer
 *   GET        /api/admin/appadmin/alerts/events         → alertes déclenchées
 *   POST       /api/admin/appadmin/alerts/events/{id}/ack|resolve
 *
 * Scopé tenant côté backend (Loi 1). i18n local AR/EN/FR. CSS logique (Loi 3 RTL).
 */

import React, { useState } from "react";

import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { postJson, patchJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

type Lang = "ar" | "en" | "fr";

type Rule = {
  id: string;
  name: string;
  metric: string;
  comparator: string;
  threshold: string;
  window_seconds: number;
  severity: string;
  is_active: boolean;
};

type AlertEvent = {
  id: string;
  rule_id: string;
  observed_value: string | null;
  status: string;
  created_at: string;
};

const METRICS = [
  "audit_events",
  "distinct_ips",
  "auth_events",
  "delete_actions",
] as const;
const COMPARATORS = ["gt", "gte", "lt", "lte"] as const;
const SEVERITIES = ["info", "warning", "critical"] as const;

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Alertes",
    tabRules: "Règles",
    tabEvents: "Événements",
    name: "Nom",
    metric: "Métrique",
    comparator: "Opérateur",
    threshold: "Seuil",
    window: "Fenêtre (s)",
    severity: "Sévérité",
    active: "Active",
    actions: "Actions",
    newRule: "Nouvelle règle",
    create: "Créer",
    enable: "Activer",
    disable: "Désactiver",
    delete: "Supprimer",
    confirmDelete: "Supprimer cette règle ?",
    loading: "Chargement…",
    emptyRules: "Aucune règle",
    emptyEvents: "Aucune alerte",
    saveFailed: "Échec",
    observed: "Valeur observée",
    status: "Statut",
    created: "Créée",
    ack: "Acquitter",
    resolve: "Résoudre",
    yes: "Oui",
    no: "Non",
  },
  en: {
    title: "Alerts",
    tabRules: "Rules",
    tabEvents: "Events",
    name: "Name",
    metric: "Metric",
    comparator: "Operator",
    threshold: "Threshold",
    window: "Window (s)",
    severity: "Severity",
    active: "Active",
    actions: "Actions",
    newRule: "New rule",
    create: "Create",
    enable: "Enable",
    disable: "Disable",
    delete: "Delete",
    confirmDelete: "Delete this rule?",
    loading: "Loading…",
    emptyRules: "No rule",
    emptyEvents: "No alert",
    saveFailed: "Failed",
    observed: "Observed value",
    status: "Status",
    created: "Created",
    ack: "Acknowledge",
    resolve: "Resolve",
    yes: "Yes",
    no: "No",
  },
  ar: {
    title: "التنبيهات",
    tabRules: "القواعد",
    tabEvents: "الأحداث",
    name: "الاسم",
    metric: "المقياس",
    comparator: "العامل",
    threshold: "العتبة",
    window: "النافذة (ث)",
    severity: "الخطورة",
    active: "نشطة",
    actions: "إجراءات",
    newRule: "قاعدة جديدة",
    create: "إنشاء",
    enable: "تفعيل",
    disable: "تعطيل",
    delete: "حذف",
    confirmDelete: "حذف هذه القاعدة؟",
    loading: "جارٍ التحميل…",
    emptyRules: "لا قواعد",
    emptyEvents: "لا تنبيهات",
    saveFailed: "فشل",
    observed: "القيمة المرصودة",
    status: "الحالة",
    created: "أُنشئت",
    ack: "إقرار",
    resolve: "حل",
    yes: "نعم",
    no: "لا",
  },
};

const SEV_COLOR: Record<string, string> = {
  info: "var(--ink-4)",
  warning: "var(--gold-deep)",
  critical: "var(--rose)",
};

export function ScreenAppAdminAlerts(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [tab, setTab] = useState<"rules" | "events">("rules");
  const rules = useApiList<Rule>("/api/admin/appadmin/alerts/rules?limit=100");
  const events = useApiList<AlertEvent>(
    "/api/admin/appadmin/alerts/events?limit=100",
  );

  // ── Création de règle ────────────────────────────────────────────────────────
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    metric: METRICS[0] as string,
    comparator: "gt",
    threshold: "10",
    window_seconds: "300",
    severity: "warning",
  });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function createRule(): Promise<void> {
    if (!form.name.trim()) {
      setFormErr(L("saveFailed"));
      return;
    }
    setBusy(true);
    setFormErr(null);
    try {
      const res = await postJson("/api/admin/appadmin/alerts/rules", {
        name: form.name,
        metric: form.metric,
        comparator: form.comparator,
        threshold: Number(form.threshold),
        window_seconds: Number(form.window_seconds),
        severity: form.severity,
      });
      if (!res.ok) {
        setFormErr(await extractError(res, "save_failed"));
        return;
      }
      setCreating(false);
      setForm({ ...form, name: "" });
      rules.reload();
    } catch {
      setFormErr(L("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function toggleRule(r: Rule): Promise<void> {
    await patchJson(`/api/admin/appadmin/alerts/rules/${r.id}`, {
      is_active: !r.is_active,
    });
    rules.reload();
  }

  async function deleteRule(r: Rule): Promise<void> {
    if (!window.confirm(L("confirmDelete"))) return;
    await fetch(`/api/admin/appadmin/alerts/rules/${r.id}`, {
      method: "DELETE",
    });
    rules.reload();
  }

  async function transition(
    e: AlertEvent,
    op: "ack" | "resolve",
  ): Promise<void> {
    await postJson(`/api/admin/appadmin/alerts/events/${e.id}/${op}`, {});
    events.reload();
  }

  const th: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "start",
    fontWeight: 600,
  };
  const td: React.CSSProperties = { padding: "10px 12px" };
  const tabBtn = (key: "rules" | "events", label: string): React.ReactNode => (
    <button
      type="button"
      onClick={() => setTab(key)}
      style={{
        ...fieldInput,
        width: "auto",
        cursor: "pointer",
        fontWeight: 600,
        background: tab === key ? "var(--ink)" : "var(--bg-paper)",
        color: tab === key ? "#fff" : "var(--ink)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <Topbar title={L("title")}>
        <div style={{ display: "flex", gap: 8 }}>
          {tabBtn("rules", L("tabRules"))}
          {tabBtn("events", L("tabEvents"))}
          {tab === "rules" && (
            <button
              type="button"
              onClick={() => {
                setCreating(true);
                setFormErr(null);
              }}
              style={{
                ...fieldInput,
                width: "auto",
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              + {L("newRule")}
            </button>
          )}
        </div>
      </Topbar>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
          background: "var(--bg-cream)",
        }}
      >
        <div
          style={{
            background: "var(--bg-paper)",
            border: "1px solid var(--line-soft)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {tab === "rules" ? (
            rules.loading && !rules.items.length ? (
              <div
                style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}
              >
                {L("loading")}
              </div>
            ) : rules.items.length === 0 ? (
              <div
                style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}
              >
                {L("emptyRules")}
              </div>
            ) : (
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12.5,
                }}
              >
                <thead
                  style={{
                    background: "var(--bg-cream)",
                    color: "var(--ink-4)",
                  }}
                >
                  <tr>
                    <th style={th}>{L("name")}</th>
                    <th style={th}>{L("metric")}</th>
                    <th style={th}>{L("comparator")}</th>
                    <th style={th}>{L("threshold")}</th>
                    <th style={th}>{L("window")}</th>
                    <th style={th}>{L("severity")}</th>
                    <th style={th}>{L("active")}</th>
                    <th style={th}>{L("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.items.map((r) => (
                    <tr
                      key={r.id}
                      style={{ borderTop: "1px solid var(--line-soft)" }}
                    >
                      <td style={{ ...td, fontWeight: 600 }}>{r.name}</td>
                      <td style={td}>{r.metric}</td>
                      <td style={td}>{r.comparator}</td>
                      <td style={td}>{r.threshold}</td>
                      <td style={td}>{r.window_seconds}</td>
                      <td
                        style={{
                          ...td,
                          color: SEV_COLOR[r.severity],
                          fontWeight: 600,
                        }}
                      >
                        {r.severity}
                      </td>
                      <td style={td}>{r.is_active ? L("yes") : L("no")}</td>
                      <td style={td}>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => toggleRule(r)}
                            style={{
                              ...fieldInput,
                              width: "auto",
                              cursor: "pointer",
                              padding: "2px 8px",
                            }}
                          >
                            {r.is_active ? L("disable") : L("enable")}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteRule(r)}
                            style={{
                              ...fieldInput,
                              width: "auto",
                              cursor: "pointer",
                              padding: "2px 8px",
                              color: "var(--rose)",
                            }}
                          >
                            {L("delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          ) : events.loading && !events.items.length ? (
            <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>
              {L("loading")}
            </div>
          ) : events.items.length === 0 ? (
            <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>
              {L("emptyEvents")}
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12.5,
              }}
            >
              <thead
                style={{ background: "var(--bg-cream)", color: "var(--ink-4)" }}
              >
                <tr>
                  <th style={th}>{L("observed")}</th>
                  <th style={th}>{L("status")}</th>
                  <th style={th}>{L("created")}</th>
                  <th style={th}>{L("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {events.items.map((e) => (
                  <tr
                    key={e.id}
                    style={{ borderTop: "1px solid var(--line-soft)" }}
                  >
                    <td style={td}>{e.observed_value ?? "—"}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{e.status}</td>
                    <td style={td}>
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        {e.status === "open" && (
                          <button
                            type="button"
                            onClick={() => transition(e, "ack")}
                            style={{
                              ...fieldInput,
                              width: "auto",
                              cursor: "pointer",
                              padding: "2px 8px",
                            }}
                          >
                            {L("ack")}
                          </button>
                        )}
                        {e.status !== "resolved" && (
                          <button
                            type="button"
                            onClick={() => transition(e, "resolve")}
                            style={{
                              ...fieldInput,
                              width: "auto",
                              cursor: "pointer",
                              padding: "2px 8px",
                            }}
                          >
                            {L("resolve")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateModal
        title={L("newRule")}
        open={creating}
        saving={busy}
        error={formErr}
        onClose={() => setCreating(false)}
        onSubmit={createRule}
      >
        <>
          <Field label={L("name")}>
            <input
              style={fieldInput}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <Field label={L("metric")}>
            <select
              style={fieldInput}
              value={form.metric}
              onChange={(e) => setForm({ ...form, metric: e.target.value })}
            >
              {METRICS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label={L("comparator")}>
            <select
              style={fieldInput}
              value={form.comparator}
              onChange={(e) => setForm({ ...form, comparator: e.target.value })}
            >
              {COMPARATORS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label={L("threshold")}>
            <input
              type="number"
              style={fieldInput}
              value={form.threshold}
              onChange={(e) => setForm({ ...form, threshold: e.target.value })}
            />
          </Field>
          <Field label={L("window")}>
            <input
              type="number"
              style={fieldInput}
              value={form.window_seconds}
              onChange={(e) =>
                setForm({ ...form, window_seconds: e.target.value })
              }
            />
          </Field>
          <Field label={L("severity")}>
            <select
              style={fieldInput}
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              {SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
        </>
      </CreateModal>
    </div>
  );
}
