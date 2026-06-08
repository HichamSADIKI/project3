"use client";

/**
 * Écran App-Admin « Modules (données) » — UI générique des modules GÉNÉRÉS (3B+ C).
 *
 * UN seul écran qui sert TOUS les modules `flavor=code` : il lit leur SheetSchema
 * (déjà stocké) pour afficher liste + formulaire, et tape leur CRUD via le proxy
 * générique `/api/studio-gen/{slug}/...`. Aucun codegen front, aucun câblage par module.
 *
 * Un module n'est exploitable qu'une fois sa PR mergée + `make migrate` (router monté) :
 * sinon la liste renvoie 404 → message « non déployé ». CSS logique RTL.
 */

import React from "react";

import { Topbar } from "@/components/sgi-ui";
import { StudioCrudForm } from "@/components/studio-crud-form";
import { useLang } from "@/components/language-provider";
import { getJson, patchJson, postJson } from "@/lib/api-client";
import { useApiList } from "@/lib/use-api-list";
import { blankValues, fieldColumns, slugOf, type CrudColumn } from "@/lib/studio-crud";
import type { SheetSchema } from "@/lib/studio-schema";

type Lang = "ar" | "en" | "fr";

type StudioModule = {
  id: string;
  key: string;
  title_ar: string;
  title_en: string;
  title_fr: string;
  flavor: string;
  state: string;
  pr_url?: string | null;
};

type Row = Record<string, unknown>;
type FormValue = string | boolean;

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Modules (données)",
    open: "Ouvrir",
    back: "← Retour",
    create: "Créer",
    edit: "Éditer",
    save: "Enregistrer",
    cancelEdit: "Annuler",
    delete: "Supprimer",
    rows: "Lignes",
    noRows: "Aucune ligne.",
    notDeployed: "Module non déployé : merge sa PR puis lance « make migrate ».",
    loading: "Chargement…",
    empty: "Aucun module de type « code ». Génère-en un depuis le Studio.",
    state: "État",
    key: "Clé",
    actions: "Actions",
    hint: "Modules générés par le Studio. Conçois-les dans « Studio de Modules ».",
  },
  en: {
    title: "Modules (data)",
    open: "Open",
    back: "← Back",
    create: "Create",
    edit: "Edit",
    save: "Save",
    cancelEdit: "Cancel",
    delete: "Delete",
    rows: "Rows",
    noRows: "No rows.",
    notDeployed: "Module not deployed: merge its PR then run “make migrate”.",
    loading: "Loading…",
    empty: "No “code” module yet. Generate one from the Studio.",
    state: "State",
    key: "Key",
    actions: "Actions",
    hint: "Studio-generated modules. Design them in “Module Studio”.",
  },
  ar: {
    title: "الوحدات (البيانات)",
    open: "فتح",
    back: "← رجوع",
    create: "إنشاء",
    edit: "تعديل",
    save: "حفظ",
    cancelEdit: "إلغاء",
    delete: "حذف",
    rows: "السجلات",
    noRows: "لا سجلات.",
    notDeployed: "الوحدة غير منشورة: ادمج طلب السحب ثم نفّذ «make migrate».",
    loading: "جارٍ التحميل…",
    empty: "لا وحدة من نوع «code». أنشئ واحدة من الاستوديو.",
    state: "الحالة",
    key: "المفتاح",
    actions: "إجراءات",
    hint: "وحدات مولّدة بالاستوديو. صمّمها في «استوديو الوحدات».",
  },
};

const card: React.CSSProperties = {
  background: "var(--bg-paper)",
  border: "1px solid var(--line-soft)",
  borderRadius: 12,
  overflow: "hidden",
};
const th: React.CSSProperties = { textAlign: "start", padding: "12px 16px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "12px 16px", color: "var(--ink-2)" };
const btn: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: "6px 14px",
  borderRadius: 8,
  border: "1px solid var(--line-soft)",
  background: "var(--bg-paper)",
  color: "var(--ink)",
  cursor: "pointer",
};

export function ScreenAppAdminCrudGen(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;
  const titleOf = (m: StudioModule): string =>
    lg === "ar" ? m.title_ar : lg === "fr" ? m.title_fr : m.title_en;

  const modules = useApiList<StudioModule>("/api/admin/platform/studio/modules?limit=100");
  const codeModules = modules.items.filter((m) => m.flavor === "code");

  const [sel, setSel] = React.useState<{ module: StudioModule; slug: string; cols: CrudColumn[] } | null>(
    null,
  );
  const [rows, setRows] = React.useState<Row[]>([]);
  const [rowsState, setRowsState] = React.useState<"loading" | "ok" | "notDeployed">("loading");
  const [form, setForm] = React.useState<Record<string, FormValue>>({});
  const [editId, setEditId] = React.useState<string | null>(null);

  async function loadRows(slug: string): Promise<void> {
    setRowsState("loading");
    try {
      const r = await getJson<{ data: Row[] }>(`/api/studio-gen/${slug}/`);
      setRows(r.data ?? []);
      setRowsState("ok");
    } catch {
      setRows([]);
      setRowsState("notDeployed");
    }
  }

  async function open(m: StudioModule): Promise<void> {
    const slug = slugOf(m.key);
    let cols: CrudColumn[] = [];
    try {
      const r = await getJson<{ data: SheetSchema | null }>(
        `/api/admin/platform/studio/modules/${m.id}/schema`,
      );
      if (r.data) cols = fieldColumns(r.data);
    } catch {
      /* pas de schéma → colonnes vides (création limitée) */
    }
    setSel({ module: m, slug, cols });
    setForm(blankValues(cols));
    setEditId(null);
    void loadRows(slug);
  }

  async function submitRow(): Promise<void> {
    if (!sel) return;
    const payload: Record<string, FormValue> = {};
    for (const c of sel.cols) {
      const v = form[c.name];
      if (c.type === "checkbox") payload[c.name] = v === true;
      else if (typeof v === "string" && v !== "") payload[c.name] = v;
    }
    const url = editId
      ? `/api/studio-gen/${sel.slug}/${encodeURIComponent(editId)}`
      : `/api/studio-gen/${sel.slug}/`;
    const res = editId ? await patchJson(url, payload) : await postJson(url, payload);
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { detail?: string };
      window.alert(j.detail ?? `HTTP ${res.status}`);
      return;
    }
    setForm(blankValues(sel.cols));
    setEditId(null);
    void loadRows(sel.slug);
  }

  function startEdit(row: Row): void {
    if (!sel || typeof row.id !== "string") return;
    const vals = blankValues(sel.cols);
    for (const c of sel.cols) {
      const v = row[c.name];
      if (c.type === "checkbox") vals[c.name] = v === true;
      else if (v !== null && v !== undefined) vals[c.name] = String(v);
    }
    setForm(vals);
    setEditId(row.id);
  }

  function cancelEdit(): void {
    if (!sel) return;
    setForm(blankValues(sel.cols));
    setEditId(null);
  }

  async function deleteRow(id: unknown): Promise<void> {
    if (!sel || typeof id !== "string") return;
    const res = await fetch(`/api/studio-gen/${sel.slug}/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok || res.status === 204) void loadRows(sel.slug);
  }

  const scroll: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "24px 28px",
    background: "var(--bg-cream)",
    display: "flex",
    flexDirection: "column",
    gap: 18,
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={L("title")}>
        {sel && (
          <button type="button" onClick={() => setSel(null)} style={btn}>
            {L("back")}
          </button>
        )}
      </Topbar>

      {!sel ? (
        <div style={scroll}>
          <span style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L("hint")}</span>
          <div style={card}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5 }}>
                  <th style={th}>{L("title")}</th>
                  <th style={th}>{L("key")}</th>
                  <th style={th}>{L("state")}</th>
                  <th style={{ ...th, textAlign: "end" }}>{L("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {modules.loading && (
                  <tr>
                    <td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--ink-4)" }}>
                      {L("loading")}
                    </td>
                  </tr>
                )}
                {!modules.loading && codeModules.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--ink-4)" }}>
                      {L("empty")}
                    </td>
                  </tr>
                )}
                {codeModules.map((m) => (
                  <tr key={m.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td style={{ ...td, color: "var(--ink-1)", fontWeight: 600 }}>{titleOf(m)}</td>
                    <td className="tnum" style={{ ...td, fontSize: 12 }}>
                      {m.key}
                    </td>
                    <td style={td}>{m.state}</td>
                    <td style={{ ...td, textAlign: "end" }}>
                      <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end" }}>
                        {m.pr_url && (
                          <a
                            href={m.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ ...btn, color: "var(--gold-deep)", textDecoration: "none" }}
                          >
                            PR ↗
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            void open(m);
                          }}
                          style={btn}
                        >
                          {L("open")}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div style={scroll}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink-1)" }}>
            {titleOf(sel.module)} <span className="tnum" style={{ color: "var(--ink-4)", fontSize: 12 }}>· {sel.slug}</span>
          </span>

          {rowsState === "notDeployed" ? (
            <div style={{ ...card, padding: 18, color: "var(--gold-deep)", fontSize: 13 }}>
              {L("notDeployed")}
            </div>
          ) : (
            <>
              {/* Formulaire de création */}
              <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
                <StudioCrudForm
                  cols={sel.cols}
                  values={form}
                  lang={lg}
                  onChange={(name, value) => setForm((f) => ({ ...f, [name]: value }))}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => {
                      void submitRow();
                    }}
                    style={{ ...btn, background: "var(--gold-deep)", color: "#fff", borderColor: "transparent" }}
                  >
                    {editId ? L("save") : L("create")}
                  </button>
                  {editId && (
                    <button type="button" onClick={cancelEdit} style={btn}>
                      {L("cancelEdit")}
                    </button>
                  )}
                </div>
              </div>

              {/* Liste des lignes */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
                  {L("rows")}
                </span>
                <div style={card}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5 }}>
                        {sel.cols.map((c) => (
                          <th key={c.name} style={th}>
                            {lg === "ar" ? c.label_ar : lg === "fr" ? c.label_fr : c.label_en}
                          </th>
                        ))}
                        <th style={{ ...th, textAlign: "end" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {rowsState === "loading" && (
                        <tr>
                          <td colSpan={sel.cols.length + 1} style={{ ...td, textAlign: "center", color: "var(--ink-4)" }}>
                            {L("loading")}
                          </td>
                        </tr>
                      )}
                      {rowsState === "ok" && rows.length === 0 && (
                        <tr>
                          <td colSpan={sel.cols.length + 1} style={{ ...td, textAlign: "center", color: "var(--ink-4)" }}>
                            {L("noRows")}
                          </td>
                        </tr>
                      )}
                      {rowsState === "ok" &&
                        rows.map((r, idx) => (
                          <tr key={(r.id as string) ?? idx} style={{ borderTop: "1px solid var(--line-soft)" }}>
                            {sel.cols.map((c) => (
                              <td key={c.name} style={td}>
                                {String(r[c.name] ?? "—")}
                              </td>
                            ))}
                            <td style={{ ...td, textAlign: "end" }}>
                              <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end" }}>
                                <button type="button" onClick={() => startEdit(r)} style={btn}>
                                  {L("edit")}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void deleteRow(r.id);
                                  }}
                                  style={{ ...btn, color: "var(--rose)" }}
                                >
                                  {L("delete")}
                                </button>
                              </div>
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
      )}
    </div>
  );
}
