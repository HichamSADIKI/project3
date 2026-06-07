"use client";

/**
 * Écran App-Admin — Journal d'audit (tenant).
 *
 * Câblé sur le backend admin app-admin (scopé company_id, Loi 1) :
 *   GET /api/admin/appadmin/audit              → journal paginé + filtres
 *   GET /api/admin/appadmin/audit/export.csv   → export CSV (téléchargement)
 *
 * Filtres : action · acteur (email) · plage de dates (from/to) · recherche libre.
 * CSS strictement logique (Loi 3 RTL). Libellés localisés en local (useLang)
 * pour ne pas toucher le i18n.ts partagé. Chiffres latins.
 */

import React, { useEffect, useMemo, useState } from "react";

import { Topbar, IcSearch, IcDownload, IcFilter } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";
import { getJson } from "@/lib/api-client";

type Lang = "ar" | "en" | "fr";

type AuditRow = {
  id: string;
  action: string;
  resource: string;
  resource_id: string | null;
  user_email: string | null;
  ip_address: string | null;
  created_at: string;
};

type AuditResponse = {
  success: boolean;
  data: AuditRow[];
  meta: { total: number; page: number; limit: number };
};

// ── i18n local ──────────────────────────────────────────────────────────────
const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Journal d'audit",
    subtitle: "Traçabilité des actions sensibles du tenant",
    search: "Rechercher (ressource, e-mail, IP…)",
    action: "Action",
    actor: "Acteur",
    from: "Du",
    to: "Au",
    allActions: "Toutes les actions",
    allActors: "Tous les acteurs",
    apply: "Filtrer",
    reset: "Réinitialiser",
    exportCsv: "Exporter CSV",
    colTime: "Horodatage",
    colAction: "Action",
    colResource: "Ressource",
    colActor: "Acteur",
    colIp: "Adresse IP",
    loading: "Chargement…",
    empty: "Aucun événement d'audit pour ces critères",
    errorTitle: "Échec du chargement",
    retry: "Réessayer",
    total: "événements",
    page: "Page",
    prev: "Précédent",
    next: "Suivant",
    none: "—",
  },
  en: {
    title: "Audit log",
    subtitle: "Traceability of sensitive tenant actions",
    search: "Search (resource, email, IP…)",
    action: "Action",
    actor: "Actor",
    from: "From",
    to: "To",
    allActions: "All actions",
    allActors: "All actors",
    apply: "Filter",
    reset: "Reset",
    exportCsv: "Export CSV",
    colTime: "Timestamp",
    colAction: "Action",
    colResource: "Resource",
    colActor: "Actor",
    colIp: "IP address",
    loading: "Loading…",
    empty: "No audit events for these criteria",
    errorTitle: "Failed to load",
    retry: "Retry",
    total: "events",
    page: "Page",
    prev: "Previous",
    next: "Next",
    none: "—",
  },
  ar: {
    title: "سجل المراجعة",
    subtitle: "تتبّع الإجراءات الحساسة للمستأجر",
    search: "بحث (مورد، بريد، IP…)",
    action: "الإجراء",
    actor: "الفاعل",
    from: "من",
    to: "إلى",
    allActions: "كل الإجراءات",
    allActors: "كل الفاعلين",
    apply: "تصفية",
    reset: "إعادة ضبط",
    exportCsv: "تصدير CSV",
    colTime: "الطابع الزمني",
    colAction: "الإجراء",
    colResource: "المورد",
    colActor: "الفاعل",
    colIp: "عنوان IP",
    loading: "جارٍ التحميل…",
    empty: "لا توجد أحداث مراجعة لهذه المعايير",
    errorTitle: "فشل التحميل",
    retry: "إعادة المحاولة",
    total: "حدث",
    page: "صفحة",
    prev: "السابق",
    next: "التالي",
    none: "—",
  },
};

const LIMIT = 25;

// Palette d'actions usuelles (couleur du badge selon le verbe).
const ACTION_COLOR: Record<string, string> = {
  create: "var(--emerald)",
  update: "var(--azure)",
  delete: "var(--rose)",
  login: "var(--gold)",
  logout: "var(--ink-4)",
  export: "var(--azure)",
};

function actionColor(action: string): string {
  const key = action.toLowerCase().split(/[._\s]/)[0];
  return ACTION_COLOR[key] ?? "var(--ink-3)";
}

function buildQuery(p: {
  action: string;
  actor: string;
  from: string;
  to: string;
  q: string;
  page?: number;
}): string {
  const sp = new URLSearchParams();
  if (p.action) sp.set("action", p.action);
  if (p.actor) sp.set("actor", p.actor);
  if (p.from) sp.set("from", p.from);
  if (p.to) sp.set("to", p.to);
  if (p.q.trim()) sp.set("q", p.q.trim());
  if (p.page) sp.set("page", String(p.page));
  sp.set("limit", String(LIMIT));
  return sp.toString();
}

export function ScreenAppAdminAudit() {
  const { lang } = useLang();
  const L = (k: string): string => TR[lang as Lang][k] ?? k;
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  // Filtres appliqués (déclenchent la requête) vs. champs en cours d'édition.
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => buildQuery({ action, actor, from, to, q, page }),
    [action, actor, from, to, q, page],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getJson<AuditResponse>(`/api/admin/appadmin/audit?${query}`)
      .then((res) => {
        if (cancelled) return;
        setRows(res.data ?? []);
        setTotal(res.meta?.total ?? 0);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "load_failed");
        setRows([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Liste d'actions distinctes présentes dans la page courante (filtre rapide).
  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.action);
    return Array.from(set).sort();
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  function resetFilters() {
    setAction("");
    setActor("");
    setFrom("");
    setTo("");
    setQ("");
    setPage(1);
  }

  function exportCsv() {
    const sp = buildQuery({ action, actor, from, to, q });
    window.open(`/api/admin/appadmin/audit/export.csv?${sp}`, "_blank");
  }

  const fmtTime = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  };

  const inputStyle: React.CSSProperties = {
    height: 38,
    padding: "0 12px",
    borderRadius: "var(--r)",
    border: "1px solid var(--line-soft)",
    background: "var(--bg-paper)",
    color: "var(--ink-1)",
    fontSize: 13,
    minWidth: 0,
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
      <Topbar title={L("title")}>
        <button
          onClick={exportCsv}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            height: 38,
            padding: "0 16px",
            borderRadius: "var(--r)",
            border: "1px solid var(--line-soft)",
            background: "var(--bg-paper)",
            color: "var(--ink-1)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          <IcDownload />
          {L("exportCsv")}
        </button>
      </Topbar>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isMob ? "16px 12px" : "28px 32px",
          background: "var(--bg-cream)",
        }}
      >
        <div
          style={{ fontSize: 12.5, color: "var(--ink-4)", marginBottom: 18 }}
        >
          {L("subtitle")}
        </div>

        {/* Barre de filtres */}
        <div
          style={{
            background: "var(--bg-paper)",
            border: "1px solid var(--line-soft)",
            borderRadius: "var(--r)",
            padding: 16,
            marginBottom: 20,
            display: "grid",
            gridTemplateColumns: isMob ? "1fr" : "2fr 1.4fr 1fr 1fr auto auto",
            gap: 12,
            alignItems: "end",
          }}
        >
          {/* Recherche libre */}
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
              <IcSearch /> {L("search")}
            </span>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder={L("search")}
              style={inputStyle}
            />
          </label>

          {/* Acteur (email) */}
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
              {L("actor")}
            </span>
            <input
              value={actor}
              onChange={(e) => {
                setActor(e.target.value);
                setPage(1);
              }}
              placeholder={L("allActors")}
              style={inputStyle}
            />
          </label>

          {/* Action */}
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
              {L("action")}
            </span>
            <select
              value={action}
              onChange={(e) => {
                setAction(e.target.value);
                setPage(1);
              }}
              style={inputStyle}
            >
              <option value="">{L("allActions")}</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          {/* Dates */}
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
              {L("from")}
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
              style={inputStyle}
            />
          </label>

          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
              {L("to")}
            </span>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
              style={inputStyle}
            />
          </label>

          <button
            onClick={resetFilters}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              height: 38,
              padding: "0 14px",
              borderRadius: "var(--r)",
              border: "1px solid var(--line-soft)",
              background: "var(--bg-cream)",
              color: "var(--ink-2)",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            <IcFilter />
            {L("reset")}
          </button>
        </div>

        {/* États */}
        {error ? (
          <div
            style={{
              background: "var(--bg-paper)",
              border: "1px solid var(--line-soft)",
              borderRadius: "var(--r)",
              padding: 40,
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: 14, color: "var(--rose)", marginBottom: 10 }}
            >
              {L("errorTitle")}
            </div>
            <div
              style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 16 }}
            >
              {error}
            </div>
            <button
              onClick={() => setPage((p) => p)}
              style={{
                height: 36,
                padding: "0 18px",
                borderRadius: "var(--r)",
                border: "1px solid var(--line-soft)",
                background: "var(--bg-cream)",
                color: "var(--ink-1)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              {L("retry")}
            </button>
          </div>
        ) : loading ? (
          <div
            style={{
              background: "var(--bg-paper)",
              border: "1px solid var(--line-soft)",
              borderRadius: "var(--r)",
              padding: 40,
              textAlign: "center",
              fontSize: 13,
              color: "var(--ink-4)",
            }}
          >
            {L("loading")}
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              background: "var(--bg-paper)",
              border: "1px solid var(--line-soft)",
              borderRadius: "var(--r)",
              padding: 48,
              textAlign: "center",
              fontSize: 13,
              color: "var(--ink-4)",
            }}
          >
            {L("empty")}
          </div>
        ) : (
          <>
            <div
              style={{
                background: "var(--bg-paper)",
                border: "1px solid var(--line-soft)",
                borderRadius: "var(--r)",
                overflow: "hidden",
              }}
            >
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 12.5,
                }}
              >
                <thead>
                  <tr style={{ background: "var(--bg-cream)" }}>
                    {[
                      L("colTime"),
                      L("colAction"),
                      L("colResource"),
                      L("colActor"),
                      L("colIp"),
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "start",
                          padding: "12px 16px",
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: "var(--ink-4)",
                          borderBottom: "1px solid var(--line-soft)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      style={{ borderBottom: "1px solid var(--line-soft)" }}
                    >
                      <td
                        className="tnum"
                        style={{
                          padding: "11px 16px",
                          color: "var(--ink-2)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {fmtTime(r.created_at)}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "3px 9px",
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            color: actionColor(r.action),
                            background: "var(--bg-cream)",
                            border: "1px solid var(--line-soft)",
                          }}
                        >
                          {r.action}
                        </span>
                      </td>
                      <td
                        style={{ padding: "11px 16px", color: "var(--ink-1)" }}
                      >
                        {r.resource}
                        {r.resource_id ? (
                          <span
                            className="tnum"
                            style={{ color: "var(--ink-4)", fontSize: 11 }}
                          >
                            {" "}
                            #{r.resource_id.slice(0, 8)}
                          </span>
                        ) : null}
                      </td>
                      <td
                        style={{ padding: "11px 16px", color: "var(--ink-2)" }}
                      >
                        {r.user_email ?? L("none")}
                      </td>
                      <td
                        className="tnum"
                        style={{
                          padding: "11px 16px",
                          color: "var(--ink-3)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.ip_address ?? L("none")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: 16,
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <div
                className="tnum"
                style={{ fontSize: 12, color: "var(--ink-4)" }}
              >
                {total} {L("total")}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: "var(--r)",
                    border: "1px solid var(--line-soft)",
                    background: "var(--bg-paper)",
                    color: page <= 1 ? "var(--ink-4)" : "var(--ink-1)",
                    fontSize: 12.5,
                    cursor: page <= 1 ? "not-allowed" : "pointer",
                  }}
                >
                  {L("prev")}
                </button>
                <span
                  className="tnum"
                  style={{ fontSize: 12.5, color: "var(--ink-2)" }}
                >
                  {L("page")} {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{
                    height: 34,
                    padding: "0 14px",
                    borderRadius: "var(--r)",
                    border: "1px solid var(--line-soft)",
                    background: "var(--bg-paper)",
                    color: page >= totalPages ? "var(--ink-4)" : "var(--ink-1)",
                    fontSize: 12.5,
                    cursor: page >= totalPages ? "not-allowed" : "pointer",
                  }}
                >
                  {L("next")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
