"use client";

/**
 * Écran Administration application · Honeytokens (déception sécurité, tenant).
 *
 *   GET    /api/admin/honeytokens          → liste des leurres (avec token-secret)
 *   POST   /api/admin/honeytokens          → créer (kind + label)
 *   DELETE /api/admin/honeytokens/{id}      → soft-delete
 *
 * Le token affiché est le secret à PLANTER (faux credential/URL) ; son usage sur
 * l'endpoint public /api/v1/honeytokens/trip/{token} déclenche une alerte critique
 * (visible dans l'écran Alertes). Scopé tenant côté backend (Loi 1). i18n local
 * AR/EN/FR. CSS logique (Loi 3 RTL).
 */

import React, { useState } from "react";

import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

type Lang = "ar" | "en" | "fr";

type Honeytoken = {
  id: string;
  kind: string;
  label: string;
  token: string;
  is_active: boolean;
  last_triggered_at: string | null;
  trigger_count: number;
  created_at: string;
};

const KINDS = ["api_key", "url", "secret", "record"] as const;

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Honeytokens",
    subtitle: "Leurres de sécurité — toute utilisation déclenche une alerte critique.",
    label: "Libellé",
    kind: "Type",
    token: "Jeton (à planter)",
    triggers: "Déclenchements",
    lastTrigger: "Dernier accès",
    actions: "Actions",
    newToken: "Nouveau leurre",
    create: "Créer",
    delete: "Supprimer",
    copy: "Copier",
    copied: "Copié",
    confirmDelete: "Supprimer ce leurre ?",
    loading: "Chargement…",
    empty: "Aucun leurre — créez-en un et plantez-le là où un attaquant le trouverait.",
    saveFailed: "Échec",
    never: "Jamais",
  },
  en: {
    title: "Honeytokens",
    subtitle: "Security lures — any use raises a critical alert.",
    label: "Label",
    kind: "Type",
    token: "Token (to plant)",
    triggers: "Triggers",
    lastTrigger: "Last access",
    actions: "Actions",
    newToken: "New lure",
    create: "Create",
    delete: "Delete",
    copy: "Copy",
    copied: "Copied",
    confirmDelete: "Delete this lure?",
    loading: "Loading…",
    empty: "No lure — create one and plant it where an attacker would find it.",
    saveFailed: "Failed",
    never: "Never",
  },
  ar: {
    title: "الرموز الخادعة",
    subtitle: "طُعوم أمنية — أي استخدام يُطلق تنبيهًا حرجًا.",
    label: "التسمية",
    kind: "النوع",
    token: "الرمز (للزرع)",
    triggers: "عدد الإطلاقات",
    lastTrigger: "آخر وصول",
    actions: "إجراءات",
    newToken: "طُعم جديد",
    create: "إنشاء",
    delete: "حذف",
    copy: "نسخ",
    copied: "تم النسخ",
    confirmDelete: "حذف هذا الطُعم؟",
    loading: "جارٍ التحميل…",
    empty: "لا طُعوم — أنشئ واحدًا وازرعه حيث قد يجده مهاجم.",
    saveFailed: "فشل",
    never: "أبدًا",
  },
};

export function ScreenAppAdminHoneytokens(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const tokens = useApiList<Honeytoken>("/api/admin/honeytokens?limit=100");

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ kind: KINDS[0] as string, label: "" });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function createToken(): Promise<void> {
    if (!form.label.trim()) {
      setFormErr(L("saveFailed"));
      return;
    }
    setBusy(true);
    setFormErr(null);
    try {
      const res = await postJson("/api/admin/honeytokens", {
        kind: form.kind,
        label: form.label.trim(),
      });
      if (!res.ok) {
        setFormErr(await extractError(res, "save_failed"));
        return;
      }
      setCreating(false);
      setForm({ kind: KINDS[0], label: "" });
      tokens.reload();
    } catch {
      setFormErr(L("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function deleteToken(t: Honeytoken): Promise<void> {
    if (!window.confirm(L("confirmDelete"))) return;
    await fetch(`/api/admin/honeytokens/${t.id}`, { method: "DELETE" });
    tokens.reload();
  }

  function copyToken(t: Honeytoken): void {
    void navigator.clipboard?.writeText(t.token);
    setCopied(t.id);
    window.setTimeout(() => setCopied(null), 1500);
  }

  const th: React.CSSProperties = {
    padding: "10px 12px",
    textAlign: "start",
    fontWeight: 600,
  };
  const td: React.CSSProperties = { padding: "10px 12px" };
  const smallBtn: React.CSSProperties = {
    ...fieldInput,
    width: "auto",
    cursor: "pointer",
    padding: "2px 8px",
  };

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
        <button
          type="button"
          onClick={() => {
            setCreating(true);
            setFormErr(null);
          }}
          style={{ ...fieldInput, width: "auto", cursor: "pointer", fontWeight: 600 }}
        >
          + {L("newToken")}
        </button>
      </Topbar>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: 20,
          background: "var(--bg-cream)",
        }}
      >
        <p style={{ color: "var(--ink-4)", fontSize: 12.5, marginBlockEnd: 14 }}>
          {L("subtitle")}
        </p>

        <div
          style={{
            background: "var(--bg-paper)",
            border: "1px solid var(--line-soft)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {tokens.loading && !tokens.items.length ? (
            <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>
              {L("loading")}
            </div>
          ) : tokens.items.length === 0 ? (
            <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>
              {L("empty")}
            </div>
          ) : (
            <table
              style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}
            >
              <thead
                style={{ background: "var(--bg-cream)", color: "var(--ink-4)" }}
              >
                <tr>
                  <th style={th}>{L("label")}</th>
                  <th style={th}>{L("kind")}</th>
                  <th style={th}>{L("token")}</th>
                  <th style={th}>{L("triggers")}</th>
                  <th style={th}>{L("lastTrigger")}</th>
                  <th style={th}>{L("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {tokens.items.map((t) => (
                  <tr
                    key={t.id}
                    style={{ borderTop: "1px solid var(--line-soft)" }}
                  >
                    <td style={{ ...td, fontWeight: 600 }}>{t.label}</td>
                    <td style={td}>{t.kind}</td>
                    <td
                      style={{
                        ...td,
                        fontFamily: "monospace",
                        fontSize: 11.5,
                        maxWidth: 260,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={t.token}
                    >
                      {t.token}
                    </td>
                    <td
                      style={{
                        ...td,
                        fontWeight: 600,
                        color: t.trigger_count > 0 ? "var(--rose)" : "var(--ink-4)",
                      }}
                    >
                      {t.trigger_count}
                    </td>
                    <td style={td}>
                      {t.last_triggered_at
                        ? new Date(t.last_triggered_at).toLocaleString()
                        : L("never")}
                    </td>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => copyToken(t)}
                          style={smallBtn}
                        >
                          {copied === t.id ? L("copied") : L("copy")}
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteToken(t)}
                          style={{ ...smallBtn, color: "var(--rose)" }}
                        >
                          {L("delete")}
                        </button>
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
        title={L("newToken")}
        open={creating}
        saving={busy}
        error={formErr}
        onClose={() => setCreating(false)}
        onSubmit={createToken}
      >
        <>
          <Field label={L("kind")}>
            <select
              style={fieldInput}
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Field>
          <Field label={L("label")}>
            <input
              style={fieldInput}
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
            />
          </Field>
        </>
      </CreateModal>
    </div>
  );
}
