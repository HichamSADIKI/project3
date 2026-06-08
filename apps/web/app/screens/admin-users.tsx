"use client";

/**
 * Écran « Utilisateurs (App-Admin) » — gestion des utilisateurs du tenant courant.
 *
 *   GET   /api/admin/appadmin/users        → liste des utilisateurs du tenant
 *   PATCH /api/admin/appadmin/users/{id}    → mise à jour rôle / statut / actif
 *
 * Scopé au tenant côté backend (company_id + RLS, Loi 1) ; le front ne fait que
 * relayer. CSS strictement logique (Loi 3 RTL). i18n local AR/EN/FR via useLang
 * pour ne pas toucher le i18n.ts partagé (gelé / sujet à conflits).
 */

import React, { useState } from "react";

import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { patchJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

type Lang = "ar" | "en" | "fr";

type AdminUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  is_active: boolean;
};

const ROLES = ["admin", "manager", "agent", "client", "fournisseur"] as const;
const STATUSES = ["active", "pending", "rejected", "suspended"] as const;

// ── i18n local ──────────────────────────────────────────────────────────────
const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Utilisateurs",
    email: "E-mail",
    name: "Nom",
    role: "Rôle",
    status: "Statut",
    active: "Actif",
    yes: "Oui",
    no: "Non",
    edit: "Modifier",
    editUser: "Modifier l'utilisateur",
    loading: "Chargement…",
    empty: "Aucun utilisateur",
    save: "Enregistrer",
    saveFailed: "Échec de l'enregistrement",
    isActive: "Compte actif",
    search: "Rechercher (e-mail, nom)…",
  },
  en: {
    title: "Users",
    email: "Email",
    name: "Name",
    role: "Role",
    status: "Status",
    active: "Active",
    yes: "Yes",
    no: "No",
    edit: "Edit",
    editUser: "Edit user",
    loading: "Loading…",
    empty: "No users",
    save: "Save",
    saveFailed: "Save failed",
    isActive: "Account active",
    search: "Search (email, name)…",
  },
  ar: {
    title: "المستخدمون",
    email: "البريد الإلكتروني",
    name: "الاسم",
    role: "الدور",
    status: "الحالة",
    active: "نشط",
    yes: "نعم",
    no: "لا",
    edit: "تعديل",
    editUser: "تعديل المستخدم",
    loading: "جارٍ التحميل…",
    empty: "لا يوجد مستخدمون",
    save: "حفظ",
    saveFailed: "فشل الحفظ",
    isActive: "الحساب نشط",
    search: "بحث (البريد، الاسم)…",
  },
};

const ROLE_LABEL: Record<Lang, Record<string, string>> = {
  fr: {
    admin: "Administrateur",
    manager: "Manager",
    agent: "Agent",
    client: "Client",
    fournisseur: "Fournisseur",
  },
  en: {
    admin: "Administrator",
    manager: "Manager",
    agent: "Agent",
    client: "Client",
    fournisseur: "Vendor",
  },
  ar: {
    admin: "مدير النظام",
    manager: "مدير",
    agent: "وكيل",
    client: "عميل",
    fournisseur: "مورّد",
  },
};

const STATUS_LABEL: Record<Lang, Record<string, string>> = {
  fr: {
    active: "Actif",
    pending: "En attente",
    rejected: "Rejeté",
    suspended: "Suspendu",
  },
  en: {
    active: "Active",
    pending: "Pending",
    rejected: "Rejected",
    suspended: "Suspended",
  },
  ar: {
    active: "نشط",
    pending: "قيد الانتظار",
    rejected: "مرفوض",
    suspended: "موقوف",
  },
};

const STATUS_COLOR: Record<string, { c: string; bg: string }> = {
  active: { c: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  pending: { c: "var(--ink-4)", bg: "var(--line-soft)" },
  rejected: { c: "var(--rose)", bg: "var(--rose-soft, rgba(214,69,93,0.12))" },
  suspended: { c: "var(--rose)", bg: "var(--rose-soft, rgba(214,69,93,0.12))" },
};

export function ScreenAppAdminUsers(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const { items, loading, error, reload } = useApiList<AdminUser>(
    "/api/admin/appadmin/users?limit=100",
  );

  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = q
    ? items.filter(
        (u) =>
          u.email.toLowerCase().includes(q) ||
          (u.full_name ?? "").toLowerCase().includes(q),
      )
    : items;

  // ── Édition ────────────────────────────────────────────────────────────────
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<{
    role: string;
    status: string;
    is_active: boolean;
  }>({
    role: "agent",
    status: "active",
    is_active: true,
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  function openEdit(u: AdminUser): void {
    setEditing(u);
    setForm({ role: u.role, status: u.status, is_active: u.is_active });
    setFormError(null);
  }

  async function submit(): Promise<void> {
    if (!editing) return;
    setSaving(true);
    setFormError(null);
    try {
      const res = await patchJson(`/api/admin/appadmin/users/${editing.id}`, {
        role: form.role,
        status: form.status,
        is_active: form.is_active,
      });
      if (!res.ok) {
        setFormError(await extractError(res, "save_failed"));
        return;
      }
      setEditing(null);
      reload();
    } catch {
      setFormError(L("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const th: React.CSSProperties = {
    padding: "10px 14px",
    textAlign: "start",
    fontWeight: 600,
  };
  const td: React.CSSProperties = { padding: "10px 14px" };

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
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={L("search")}
          style={{ ...fieldInput, width: 220 }}
        />
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
          {error && (
            <div style={{ padding: 16, color: "var(--rose)", fontSize: 12.5 }}>
              {error}
            </div>
          )}
          {loading && !items.length ? (
            <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>
              {L("loading")}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>
              {L("empty")}
            </div>
          ) : (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12.5,
              }}
            >
              <thead>
                <tr style={{ color: "var(--ink-4)" }}>
                  <th style={th}>{L("email")}</th>
                  <th style={th}>{L("name")}</th>
                  <th style={th}>{L("role")}</th>
                  <th style={th}>{L("status")}</th>
                  <th style={th}>{L("active")}</th>
                  <th style={{ ...th, textAlign: "end" }} />
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const sc = STATUS_COLOR[u.status] ?? STATUS_COLOR.pending;
                  return (
                    <tr
                      key={u.id}
                      style={{ borderTop: "1px solid var(--line-soft)" }}
                    >
                      <td
                        style={{
                          ...td,
                          color: "var(--ink-3)",
                          direction: "ltr",
                          textAlign: "start",
                        }}
                      >
                        {u.email}
                      </td>
                      <td style={{ ...td, color: "var(--ink)" }}>
                        {u.full_name ?? "—"}
                      </td>
                      <td style={{ ...td, color: "var(--ink)" }}>
                        {ROLE_LABEL[lg][u.role] ?? u.role}
                      </td>
                      <td style={td}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 600,
                            color: sc.c,
                            background: sc.bg,
                            borderRadius: 999,
                            padding: "2px 9px",
                          }}
                        >
                          {STATUS_LABEL[lg][u.status] ?? u.status}
                        </span>
                      </td>
                      <td
                        style={{
                          ...td,
                          color: u.is_active
                            ? "var(--emerald)"
                            : "var(--ink-4)",
                          fontWeight: 600,
                        }}
                      >
                        {u.is_active ? L("yes") : L("no")}
                      </td>
                      <td style={{ ...td, textAlign: "end" }}>
                        <button
                          onClick={() => openEdit(u)}
                          style={{
                            padding: "5px 12px",
                            borderRadius: 8,
                            border: "1px solid var(--line)",
                            background: "var(--bg-paper)",
                            color: "var(--ink)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {L("edit")}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateModal
        title={editing ? `${L("editUser")} · ${editing.email}` : L("editUser")}
        open={editing !== null}
        saving={saving}
        error={formError}
        onClose={() => setEditing(null)}
        onSubmit={() => void submit()}
      >
        <Field label={L("role")}>
          <select
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
            style={fieldInput}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABEL[lg][r] ?? r}
              </option>
            ))}
          </select>
        </Field>
        <Field label={L("status")}>
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            style={fieldInput}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[lg][s] ?? s}
              </option>
            ))}
          </select>
        </Field>
        <Field label={L("isActive")}>
          <select
            value={form.is_active ? "1" : "0"}
            onChange={(e) =>
              setForm({ ...form, is_active: e.target.value === "1" })
            }
            style={fieldInput}
          >
            <option value="1">{L("yes")}</option>
            <option value="0">{L("no")}</option>
          </select>
        </Field>
      </CreateModal>
    </div>
  );
}
