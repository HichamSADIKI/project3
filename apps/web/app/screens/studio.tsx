"use client";

/**
 * Écran App-Admin « Studio de Modules » — câblé sur le module plateforme backend :
 *   GET  /api/admin/platform/studio/modules                          → liste
 *   POST /api/admin/platform/studio/modules                          → création (draft)
 *   POST /api/admin/platform/studio/modules/{id}/build               → pipeline (dry-run Phase 0)
 *   POST /api/admin/platform/studio/modules/{id}/request-integration → 4-eyes étape 1
 *   POST /api/admin/platform/studio/modules/{id}/approve-integration → 4-eyes étape 2
 *
 * Gouvernance d'intégration à 2 yeux (4-eyes) : un admin demande (raison + ticket),
 * un admin DISTINCT approuve. Aucun mot de passe en dur, aucun auto-merge.
 *
 * Périmètre plateforme (super-admin) : la frontière d'accès est posée au niveau routeur
 * backend (require_platform_admin). CSS logique uniquement (Loi 3 RTL). i18n local (useLang).
 */

import React from "react";

import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson } from "@/lib/api-client";
import { StudioRenderer, type SheetSchema } from "@/components/studio-renderer";

type Lang = "ar" | "en" | "fr";

type StudioModule = {
  id: string;
  key: string;
  title_ar: string;
  title_en: string;
  title_fr: string;
  flavor: string; // lite | code
  mode: string; // ai | manual
  state: string; // draft | built | tested | audited | pr_open | approved | integrated | rejected | failed
  is_integrated: boolean;
  pr_url?: string | null;
  created_at: string;
};

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Studio de Modules",
    newModule: "Nouveau module",
    create: "Créer",
    cancel: "Annuler",
    key: "Clé (a-z, 0-9, _ .)",
    titleFr: "Titre (FR)",
    titleEn: "Titre (EN)",
    titleAr: "Titre (AR)",
    flavor: "Type",
    mode: "Mode",
    lite: "Schéma (lite)",
    code: "Code",
    ai: "IA",
    manual: "Manuel",
    state: "État",
    actions: "Actions",
    build: "Construire",
    request: "Demander l'intégration",
    approve: "Approuver (4-eyes)",
    schema: "Schéma",
    saveSchema: "Enregistrer le schéma",
    preview: "Aperçu",
    invalidJson: "JSON invalide",
    closeEditor: "Fermer",
    schemaHint: "Schéma déclaratif (feuilles → éléments). Donnée, jamais du code.",
    aiGenerate: "✨ Générer (IA)",
    aiPrompt: "Décris l'écran à générer :",
    aiFallback: "IA indisponible — schéma de base généré.",
    reasonPrompt: "Raison de l'intégration (≥ 3 caractères) :",
    ticketPrompt: "Référence ticket (optionnel) :",
    loading: "Chargement…",
    empty: "Aucun module conçu. Créez-en un pour commencer.",
    error: "Échec du chargement des modules.",
    fourEyesNote:
      "Intégration à 2 yeux : un second administrateur distinct doit approuver. Aucun auto-merge.",
  },
  en: {
    title: "Module Studio",
    newModule: "New module",
    create: "Create",
    cancel: "Cancel",
    key: "Key (a-z, 0-9, _ .)",
    titleFr: "Title (FR)",
    titleEn: "Title (EN)",
    titleAr: "Title (AR)",
    flavor: "Type",
    mode: "Mode",
    lite: "Schema (lite)",
    code: "Code",
    ai: "AI",
    manual: "Manual",
    state: "State",
    actions: "Actions",
    build: "Build",
    request: "Request integration",
    approve: "Approve (4-eyes)",
    schema: "Schema",
    saveSchema: "Save schema",
    preview: "Preview",
    invalidJson: "Invalid JSON",
    closeEditor: "Close",
    schemaHint: "Declarative schema (sheets → elements). Data, never code.",
    aiGenerate: "✨ Generate (AI)",
    aiPrompt: "Describe the screen to generate:",
    aiFallback: "AI unavailable — base schema generated.",
    reasonPrompt: "Integration reason (≥ 3 characters):",
    ticketPrompt: "Ticket reference (optional):",
    loading: "Loading…",
    empty: "No modules yet. Create one to get started.",
    error: "Failed to load modules.",
    fourEyesNote:
      "Four-eyes integration: a distinct second administrator must approve. No auto-merge.",
  },
  ar: {
    title: "استوديو الوحدات",
    newModule: "وحدة جديدة",
    create: "إنشاء",
    cancel: "إلغاء",
    key: "المفتاح (a-z، 0-9، _ .)",
    titleFr: "العنوان (FR)",
    titleEn: "العنوان (EN)",
    titleAr: "العنوان (AR)",
    flavor: "النوع",
    mode: "الوضع",
    lite: "مخطط (lite)",
    code: "كود",
    ai: "ذكاء اصطناعي",
    manual: "يدوي",
    state: "الحالة",
    actions: "إجراءات",
    build: "بناء",
    request: "طلب الدمج",
    approve: "موافقة (عينان)",
    schema: "المخطط",
    saveSchema: "حفظ المخطط",
    preview: "معاينة",
    invalidJson: "JSON غير صالح",
    closeEditor: "إغلاق",
    schemaHint: "مخطط تعريفي (صفحات → عناصر). بيانات، ليست كودًا.",
    aiGenerate: "✨ توليد (ذكاء اصطناعي)",
    aiPrompt: "صف الشاشة المراد توليدها:",
    aiFallback: "الذكاء الاصطناعي غير متاح — تم توليد مخطط أساسي.",
    reasonPrompt: "سبب الدمج (٣ أحرف على الأقل):",
    ticketPrompt: "مرجع التذكرة (اختياري):",
    loading: "جارٍ التحميل…",
    empty: "لا توجد وحدات بعد. أنشئ واحدة للبدء.",
    error: "فشل تحميل الوحدات.",
    fourEyesNote: "دمج بعينين: يجب أن يوافق مسؤول ثانٍ مختلف. لا دمج تلقائي.",
  },
};

const STATE_COLOR: Record<string, { c: string; b: string }> = {
  draft: { c: "var(--ink-3)", b: "var(--line-soft)" },
  audited: { c: "var(--gold-deep)", b: "rgba(212,160,55,0.14)" },
  pr_open: { c: "var(--gold-deep)", b: "rgba(212,160,55,0.14)" },
  approved: { c: "var(--emerald)", b: "rgba(16,185,129,0.12)" },
  integrated: { c: "var(--emerald)", b: "rgba(16,185,129,0.12)" },
  rejected: { c: "var(--rose)", b: "var(--rose-soft)" },
  failed: { c: "var(--rose)", b: "var(--rose-soft)" },
};

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
const fld: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--line-soft)",
  background: "var(--bg-cream)",
  color: "var(--ink)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};
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

function Badge({ kind, label }: { kind: string; label: string }): React.ReactNode {
  const c = STATE_COLOR[kind] ?? { c: "var(--ink-3)", b: "var(--line-soft)" };
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

/** POST helper : surface l'erreur backend (`detail`) en alerte, sinon recharge. */
async function act(url: string, body: unknown, onOk: () => void): Promise<void> {
  const res = await postJson(url, body);
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { detail?: string };
    window.alert(j.detail ?? `HTTP ${res.status}`);
    return;
  }
  onOk();
}

export function ScreenAppAdminStudio(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;
  const titleOf = (m: StudioModule): string =>
    lg === "ar" ? m.title_ar : lg === "fr" ? m.title_fr : m.title_en;

  const modules = useApiList<StudioModule>("/api/admin/platform/studio/modules?limit=100");

  const [showForm, setShowForm] = React.useState(false);
  const [form, setForm] = React.useState({
    key: "",
    title_fr: "",
    title_en: "",
    title_ar: "",
    flavor: "lite",
    mode: "manual",
  });

  async function createModule(): Promise<void> {
    await act("/api/admin/platform/studio/modules", form, () => {
      setShowForm(false);
      setForm({ key: "", title_fr: "", title_en: "", title_ar: "", flavor: "lite", mode: "manual" });
      modules.reload();
    });
  }

  async function buildModule(m: StudioModule): Promise<void> {
    await act(`/api/admin/platform/studio/modules/${m.id}/build`, {}, modules.reload);
  }

  async function requestIntegration(m: StudioModule): Promise<void> {
    const reason = window.prompt(L("reasonPrompt"));
    if (!reason || reason.trim().length < 3) return;
    const ticket = window.prompt(L("ticketPrompt")) ?? "";
    await act(
      `/api/admin/platform/studio/modules/${m.id}/request-integration`,
      { reason: reason.trim(), ticket_ref: ticket.trim() || null },
      modules.reload,
    );
  }

  async function approveIntegration(m: StudioModule): Promise<void> {
    await act(`/api/admin/platform/studio/modules/${m.id}/approve-integration`, {}, modules.reload);
  }

  // ── Éditeur de schéma (modules lite) ──
  const STARTER: SheetSchema = {
    schema_version: 1,
    sheets: [
      {
        id: "main",
        title_ar: "الرئيسية",
        title_en: "Main",
        title_fr: "Principale",
        elements: [
          {
            id: "name",
            type: "text",
            label_ar: "الاسم",
            label_en: "Name",
            label_fr: "Nom",
          },
        ],
      },
    ],
  };
  const [editor, setEditor] = React.useState<{ id: string; json: string } | null>(null);

  async function openSchema(m: StudioModule): Promise<void> {
    let initial: SheetSchema = STARTER;
    try {
      const r = await getJson<{ data: SheetSchema | null }>(
        `/api/admin/platform/studio/modules/${m.id}/schema`,
      );
      if (r.data) initial = r.data;
    } catch {
      /* pas de schéma encore → gabarit de départ */
    }
    setEditor({ id: m.id, json: JSON.stringify(initial, null, 2) });
  }

  async function saveSchema(): Promise<void> {
    if (!editor) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(editor.json);
    } catch {
      window.alert(L("invalidJson"));
      return;
    }
    await act(`/api/admin/platform/studio/modules/${editor.id}/schema`, parsed, () => {
      modules.reload();
    });
  }

  async function generateSchema(): Promise<void> {
    if (!editor) return;
    const prompt = window.prompt(L("aiPrompt"));
    if (!prompt || prompt.trim().length < 3) return;
    const res = await postJson(
      `/api/admin/platform/studio/modules/${editor.id}/generate-schema`,
      { prompt: prompt.trim(), locale: lg },
    );
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { detail?: string };
      window.alert(j.detail ?? `HTTP ${res.status}`);
      return;
    }
    const body = (await res.json()) as { data: SheetSchema; engine: string };
    setEditor({ id: editor.id, json: JSON.stringify(body.data, null, 2) });
    if (body.engine === "fallback_heuristic") window.alert(L("aiFallback"));
  }

  // Aperçu live : parse du JSON courant de l'éditeur (null si invalide).
  const previewSchema: SheetSchema | null = React.useMemo(() => {
    if (!editor) return null;
    try {
      return JSON.parse(editor.json) as SheetSchema;
    } catch {
      return null;
    }
  }, [editor]);

  const labelInput = (k: string, field: keyof typeof form): React.ReactNode => (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
      <span style={{ color: "var(--ink-4)" }}>{L(k)}</span>
      <input
        style={fld}
        value={form[field]}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
      />
    </label>
  );

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
        <button type="button" onClick={() => setShowForm((s) => !s)} style={btn}>
          {showForm ? L("cancel") : L("newModule")}
        </button>
      </Topbar>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 28px",
          background: "var(--bg-cream)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            ...card,
            padding: "10px 16px",
            fontSize: 12.5,
            color: "var(--ink-3)",
            background: "var(--bg-paper)",
          }}
        >
          {L("fourEyesNote")}
        </div>

        {/* ── Formulaire de création ── */}
        {showForm && (
          <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: 12,
              }}
            >
              {labelInput("key", "key")}
              {labelInput("titleFr", "title_fr")}
              {labelInput("titleEn", "title_en")}
              {labelInput("titleAr", "title_ar")}
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--ink-4)" }}>{L("flavor")}</span>
                <select
                  style={fld}
                  value={form.flavor}
                  onChange={(e) => setForm({ ...form, flavor: e.target.value })}
                >
                  <option value="lite">{L("lite")}</option>
                  <option value="code">{L("code")}</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
                <span style={{ color: "var(--ink-4)" }}>{L("mode")}</span>
                <select
                  style={fld}
                  value={form.mode}
                  onChange={(e) => setForm({ ...form, mode: e.target.value })}
                >
                  <option value="manual">{L("manual")}</option>
                  <option value="ai">{L("ai")}</option>
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  void createModule();
                }}
                style={{ ...btn, background: "var(--gold-deep)", color: "#fff", borderColor: "transparent" }}
              >
                {L("create")}
              </button>
            </div>
          </div>
        )}

        {/* ── Liste des modules ── */}
        <div style={card}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr
                style={{
                  background: "var(--bg-cream)",
                  color: "var(--ink-4)",
                  fontSize: 11.5,
                  textTransform: "uppercase",
                }}
              >
                <th style={th}>{L("key")}</th>
                <th style={th}>{L("flavor")}</th>
                <th style={th}>{L("mode")}</th>
                <th style={th}>{L("state")}</th>
                <th style={{ ...th, textAlign: "end" }}>{L("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {modules.loading && (
                <tr>
                  <td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--ink-4)" }}>
                    {L("loading")}
                  </td>
                </tr>
              )}
              {!modules.loading && modules.error && (
                <tr>
                  <td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--rose)" }}>
                    {L("error")}
                  </td>
                </tr>
              )}
              {!modules.loading && !modules.error && modules.items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--ink-4)" }}>
                    {L("empty")}
                  </td>
                </tr>
              )}
              {!modules.loading &&
                !modules.error &&
                modules.items.map((m) => (
                  <tr key={m.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td style={{ ...td, color: "var(--ink-1)" }}>
                      <div style={{ fontWeight: 600 }}>{titleOf(m)}</div>
                      <div className="tnum" style={{ fontSize: 11.5, color: "var(--ink-4)" }}>
                        {m.key}
                      </div>
                    </td>
                    <td style={td}>{L(m.flavor)}</td>
                    <td style={td}>{L(m.mode)}</td>
                    <td style={td}>
                      <Badge kind={m.state} label={m.state} />
                    </td>
                    <td style={{ ...td, textAlign: "end" }}>
                      <div style={{ display: "inline-flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        {m.state === "draft" && m.flavor === "lite" && (
                          <button
                            type="button"
                            onClick={() => {
                              void openSchema(m);
                            }}
                            style={btn}
                          >
                            {L("schema")}
                          </button>
                        )}
                        {m.state === "draft" && (
                          <button
                            type="button"
                            onClick={() => {
                              void buildModule(m);
                            }}
                            style={btn}
                          >
                            {L("build")}
                          </button>
                        )}
                        {(m.state === "audited" || m.state === "pr_open") && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                void requestIntegration(m);
                              }}
                              style={btn}
                            >
                              {L("request")}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                void approveIntegration(m);
                              }}
                              style={{ ...btn, background: "var(--emerald)", color: "#fff", borderColor: "transparent" }}
                            >
                              {L("approve")}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {/* ── Éditeur de schéma + aperçu live (modules lite) ── */}
        {editor && (
          <div style={{ ...card, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>
                {L("schema")}
              </span>
              <button type="button" onClick={() => setEditor(null)} style={btn}>
                {L("closeEditor")}
              </button>
            </div>
            <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{L("schemaHint")}</span>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: 14,
                alignItems: "start",
              }}
            >
              <textarea
                value={editor.json}
                onChange={(e) => setEditor({ ...editor, json: e.target.value })}
                spellCheck={false}
                style={{
                  ...fld,
                  minHeight: 320,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 12,
                  lineHeight: 1.5,
                  resize: "vertical",
                  direction: "ltr",
                }}
              />
              <div
                style={{
                  border: "1px solid var(--line-soft)",
                  borderRadius: 10,
                  padding: 14,
                  background: "var(--bg-cream)",
                  minHeight: 320,
                }}
              >
                <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBottom: 10, textTransform: "uppercase" }}>
                  {L("preview")}
                </div>
                {previewSchema ? (
                  <StudioRenderer schema={previewSchema} lang={lg} />
                ) : (
                  <div style={{ color: "var(--rose)", fontSize: 13 }}>{L("invalidJson")}</div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => {
                  void generateSchema();
                }}
                style={btn}
              >
                {L("aiGenerate")}
              </button>
              <button
                type="button"
                onClick={() => {
                  void saveSchema();
                }}
                style={{ ...btn, background: "var(--gold-deep)", color: "#fff", borderColor: "transparent" }}
              >
                {L("saveSchema")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
