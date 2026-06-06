"use client";

/**
 * Gestion des accès & permissions (IAM) — intégrée à la rubrique Paramètres.
 *
 * 3 onglets :
 *  - Utilisateurs : CRUD staff + affectation groupes/unités + rôle/statut.
 *  - Groupes & Unités : groupes (et leurs unités = sous-groupes).
 *  - Matrice : arbre du catalogue × sujet, cases tri-état (Hériter/Allow/Deny)
 *    avec aperçu de l'effet hérité (cascade) en grisé.
 *
 * CSS strictement logique (Loi 3), chiffres latins. La sécurité réelle est côté
 * backend ; cette UI ne fait que poser/lire des grants via les proxies admin.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/language-provider";

type Lang = "ar" | "en" | "fr";
type Tri = "inherit" | "allow" | "deny";

interface IamUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  group_ids: string[];
  unit_ids: string[];
}
interface IamGroup {
  id: string;
  slug: string;
  name_fr: string | null;
  name_en: string | null;
  name_ar: string | null;
  is_system: boolean;
}
interface IamUnit {
  id: string;
  group_id: string;
  name_fr: string | null;
  name_en: string | null;
  name_ar: string | null;
}
interface IamNode {
  id: string;
  parent_id: string | null;
  key: string;
  type: string;
  label_ar: string | null;
  label_en: string | null;
  label_fr: string | null;
}
interface SubjectGrant {
  node_key: string;
  effect: "allow" | "deny";
  scope: string;
}

const L = (lang: Lang, ar: string, en: string, fr: string) =>
  lang === "ar" ? ar : lang === "fr" ? fr : en;

async function api<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: "no-store", ...init });
    if (!res.ok) return null;
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    return null;
  }
}

function nodeLabel(n: IamNode, lang: Lang): string {
  return (lang === "ar" ? n.label_ar : lang === "fr" ? n.label_fr : n.label_en) ?? n.key;
}
function groupName(g: IamGroup, lang: Lang): string {
  return (lang === "ar" ? g.name_ar : lang === "fr" ? g.name_fr : g.name_en) ?? g.slug;
}
function unitName(u: IamUnit, lang: Lang): string {
  return (lang === "ar" ? u.name_ar : lang === "fr" ? u.name_fr : u.name_en) ?? "—";
}

const card = {
  background: "var(--bg-paper)",
  border: "1px solid var(--line-soft)",
  borderRadius: "var(--r)",
  padding: "14px 18px",
} as const;

export function AccessManager(): React.ReactNode {
  const { lang } = useLang() as { lang: Lang };
  const [tab, setTab] = useState<"users" | "groups" | "matrix">("users");

  const tabs: { key: typeof tab; label: string }[] = [
    { key: "users", label: L(lang, "المستخدمون", "Users", "Utilisateurs") },
    { key: "groups", label: L(lang, "المجموعات والوحدات", "Groups & Units", "Groupes & Unités") },
    { key: "matrix", label: L(lang, "مصفوفة الصلاحيات", "Permission matrix", "Matrice") },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 920 }}>
      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid var(--line-soft)" }}>
        {tabs.map((tb) => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: tab === tb.key ? 600 : 400,
              color: tab === tb.key ? "var(--gold-deep)" : "var(--ink-3)",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === tb.key ? "var(--gold)" : "transparent"}`,
              cursor: "pointer",
              marginBottom: -1,
            }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab lang={lang} />}
      {tab === "groups" && <GroupsTab lang={lang} />}
      {tab === "matrix" && <MatrixTab lang={lang} />}
    </div>
  );
}

// ── Onglet Utilisateurs ──────────────────────────────────────────────────────

function UsersTab({ lang }: { lang: Lang }): React.ReactNode {
  const [users, setUsers] = useState<IamUser[]>([]);
  const [groups, setGroups] = useState<IamGroup[]>([]);
  const [units, setUnits] = useState<IamUnit[]>([]);
  const [editing, setEditing] = useState<IamUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const u = await api<{ data: IamUser[] }>("/api/admin/iam/users?limit=100");
    const g = await api<{ data: IamGroup[] }>("/api/admin/iam/groups");
    const un = await api<{ data: IamUnit[] }>("/api/admin/iam/units");
    if (u) setUsers(u.data);
    if (g) setGroups(g.data);
    if (un) setUnits(un.data);
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
          {users.length} {L(lang, "مستخدم", "users", "utilisateurs")}
        </div>
        <button
          onClick={() => { setCreating(true); setEditing(null); }}
          style={btnPrimary}
        >
          + {L(lang, "مستخدم جديد", "New user", "Nouvel utilisateur")}
        </button>
      </div>
      {msg && <div style={{ fontSize: 12, color: "var(--gold-deep)" }}>{msg}</div>}

      {creating && (
        <UserForm
          lang={lang}
          groups={groups}
          units={units}
          onCancel={() => setCreating(false)}
          onSaved={async () => { setCreating(false); setMsg(L(lang, "تم", "Created", "Créé")); await reload(); }}
        />
      )}

      {users.map((u) => (
        <div key={u.id} style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{u.full_name}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{u.email}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <span style={badge(u.role)}>{u.role}</span>
              <span style={statusBadge(u.status)}>{u.status}</span>
              <button onClick={() => { setEditing(editing?.id === u.id ? null : u); setCreating(false); }} style={btnGhost}>
                {L(lang, "تعديل", "Edit", "Modifier")}
              </button>
            </div>
          </div>
          {editing?.id === u.id && (
            <UserForm
              lang={lang}
              groups={groups}
              units={units}
              user={u}
              onCancel={() => setEditing(null)}
              onSaved={async () => { setEditing(null); setMsg(L(lang, "تم الحفظ", "Saved", "Enregistré")); await reload(); }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function UserForm({
  lang, groups, units, user, onCancel, onSaved,
}: {
  lang: Lang; groups: IamGroup[]; units: IamUnit[]; user?: IamUser;
  onCancel: () => void; onSaved: () => void;
}): React.ReactNode {
  const [email, setEmail] = useState(user?.email ?? "");
  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(user?.role ?? "agent");
  const [status, setStatus] = useState(user?.status ?? "active");
  const [groupIds, setGroupIds] = useState<string[]>(user?.group_ids ?? []);
  const [unitIds, setUnitIds] = useState<string[]>(user?.unit_ids ?? []);
  const [err, setErr] = useState<string | null>(null);

  const toggle = (arr: string[], id: string) =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  const save = async () => {
    setErr(null);
    if (user) {
      const r = await api(`/api/admin/iam/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name: fullName, role, status, group_ids: groupIds, unit_ids: unitIds }),
      });
      if (r === null) { setErr(L(lang, "خطأ", "Error", "Erreur")); return; }
    } else {
      const r = await api("/api/admin/iam/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, full_name: fullName, password, role, group_ids: groupIds, unit_ids: unitIds }),
      });
      if (r === null) { setErr(L(lang, "خطأ (بريد مكرر؟)", "Error (email taken?)", "Erreur (email déjà pris ?)")); return; }
    }
    onSaved();
  };

  return (
    <div style={{ ...card, background: "var(--bg-cream)", display: "flex", flexDirection: "column", gap: 10 }}>
      {!user && (
        <input placeholder={L(lang, "البريد", "Email", "Email")} value={email} onChange={(e) => setEmail(e.target.value)} style={input} />
      )}
      <input placeholder={L(lang, "الاسم", "Full name", "Nom complet")} value={fullName} onChange={(e) => setFullName(e.target.value)} style={input} />
      {!user && (
        <input type="password" placeholder={L(lang, "كلمة المرور", "Password", "Mot de passe")} value={password} onChange={(e) => setPassword(e.target.value)} style={input} />
      )}
      <div style={{ display: "flex", gap: 10 }}>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={input}>
          <option value="agent">agent</option>
          <option value="manager">manager</option>
          <option value="admin">admin</option>
        </select>
        {user && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={input}>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
          </select>
        )}
      </div>

      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>{L(lang, "المجموعات", "Groups", "Groupes")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {groups.map((g) => (
          <button key={g.id} onClick={() => setGroupIds((a) => toggle(a, g.id))} style={chip(groupIds.includes(g.id))}>
            {groupName(g, lang)}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)" }}>{L(lang, "الوحدات", "Units", "Unités")}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {units.map((u) => (
          <button key={u.id} onClick={() => setUnitIds((a) => toggle(a, u.id))} style={chip(unitIds.includes(u.id))}>
            {unitName(u, lang)}
          </button>
        ))}
      </div>

      {err && <div style={{ fontSize: 12, color: "var(--rose)" }}>{err}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={save} style={btnPrimary}>{L(lang, "حفظ", "Save", "Enregistrer")}</button>
        <button onClick={onCancel} style={btnGhost}>{L(lang, "إلغاء", "Cancel", "Annuler")}</button>
      </div>
    </div>
  );
}

// ── Onglet Groupes & Unités ──────────────────────────────────────────────────

function GroupsTab({ lang }: { lang: Lang }): React.ReactNode {
  const [groups, setGroups] = useState<IamGroup[]>([]);
  const [units, setUnits] = useState<IamUnit[]>([]);
  const [newGroup, setNewGroup] = useState("");
  const [newUnit, setNewUnit] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    const g = await api<{ data: IamGroup[] }>("/api/admin/iam/groups");
    const u = await api<{ data: IamUnit[] }>("/api/admin/iam/units");
    if (g) setGroups(g.data);
    if (u) setUnits(u.data);
  }, []);
  useEffect(() => { void reload(); }, [reload]);

  const createGroup = async () => {
    if (!newGroup.trim()) return;
    const slug = newGroup.trim().toLowerCase().replace(/\s+/g, "-").slice(0, 60);
    await api("/api/admin/iam/groups", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, name_fr: newGroup.trim(), name_en: newGroup.trim(), name_ar: newGroup.trim() }),
    });
    setNewGroup(""); await reload();
  };
  const createUnit = async (groupId: string) => {
    const name = (newUnit[groupId] ?? "").trim();
    if (!name) return;
    await api("/api/admin/iam/units", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ group_id: groupId, name_fr: name, name_en: name, name_ar: name }),
    });
    setNewUnit((m) => ({ ...m, [groupId]: "" })); await reload();
  };
  const delGroup = async (id: string) => {
    await api(`/api/admin/iam/groups/${id}`, { method: "DELETE" });
    await reload();
  };
  const delUnit = async (id: string) => {
    await api(`/api/admin/iam/units/${id}`, { method: "DELETE" });
    await reload();
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <input placeholder={L(lang, "اسم المجموعة (مثل: المحاسبة)", "Group name (e.g. Accounting)", "Nom du groupe (ex. Comptabilité)")}
          value={newGroup} onChange={(e) => setNewGroup(e.target.value)} style={{ ...input, flex: 1 }} />
        <button onClick={createGroup} style={btnPrimary}>+ {L(lang, "مجموعة", "Group", "Groupe")}</button>
      </div>

      {groups.map((g) => (
        <div key={g.id} style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
              {groupName(g, lang)}{" "}
              {g.is_system && <span style={{ ...badge("system"), marginInlineStart: 6 }}>{L(lang, "نظام", "system", "système")}</span>}
            </div>
            {!g.is_system && (
              <button onClick={() => delGroup(g.id)} style={btnGhostDanger}>{L(lang, "حذف", "Delete", "Supprimer")}</button>
            )}
          </div>
          {/* Unités (sous-groupes) */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingInlineStart: 12 }}>
            {units.filter((u) => u.group_id === g.id).map((u) => (
              <span key={u.id} style={{ ...chip(true), display: "inline-flex", alignItems: "center", gap: 6 }}>
                {unitName(u, lang)}
                <button onClick={() => delUnit(u.id)} style={{ background: "none", border: "none", color: "var(--rose)", cursor: "pointer", padding: 0, fontSize: 12 }}>×</button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, paddingInlineStart: 12 }}>
            <input placeholder={L(lang, "وحدة (مثل: الصندوق)", "Unit (e.g. Cashier)", "Unité (ex. Caissière)")}
              value={newUnit[g.id] ?? ""} onChange={(e) => setNewUnit((m) => ({ ...m, [g.id]: e.target.value }))}
              style={{ ...input, flex: 1, maxWidth: 280 }} />
            <button onClick={() => createUnit(g.id)} style={btnGhost}>+ {L(lang, "وحدة", "Unit", "Unité")}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Onglet Matrice ───────────────────────────────────────────────────────────

function MatrixTab({ lang }: { lang: Lang }): React.ReactNode {
  const [nodes, setNodes] = useState<IamNode[]>([]);
  const [groups, setGroups] = useState<IamGroup[]>([]);
  const [units, setUnits] = useState<IamUnit[]>([]);
  const [subjectType, setSubjectType] = useState<"group" | "unit" | "user">("group");
  const [subjectId, setSubjectId] = useState<string>("");
  const [local, setLocal] = useState<Record<string, Tri>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const c = await api<{ data: IamNode[] }>("/api/admin/iam/catalogue");
      const g = await api<{ data: IamGroup[] }>("/api/admin/iam/groups");
      const u = await api<{ data: IamUnit[] }>("/api/admin/iam/units");
      if (c) setNodes(c.data);
      if (g) setGroups(g.data);
      if (u) setUnits(u.data);
    })();
  }, []);

  const subjects = subjectType === "group" ? groups.map((g) => ({ id: g.id, label: groupName(g, lang) }))
    : subjectType === "unit" ? units.map((u) => ({ id: u.id, label: unitName(u, lang) }))
    : [];

  const loadGrants = useCallback(async (sid: string) => {
    setMsg(null);
    const r = await api<{ data: SubjectGrant[] }>(`/api/admin/iam/grants?subject_type=${subjectType}&subject_id=${sid}`);
    const map: Record<string, Tri> = {};
    (r?.data ?? []).forEach((gr) => { map[gr.node_key] = gr.effect; });
    setLocal(map);
  }, [subjectType]);

  useEffect(() => { if (subjectId) void loadGrants(subjectId); else setLocal({}); }, [subjectId, loadGrants]);

  // Arbre : enfants par parent.
  const childrenOf = useMemo(() => {
    const m: Record<string, IamNode[]> = {};
    nodes.forEach((n) => {
      const k = n.parent_id ?? "__root__";
      (m[k] ??= []).push(n);
    });
    return m;
  }, [nodes]);
  const idToKey = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n.key])), [nodes]);

  // Effet hérité (cascade) pour ce sujet seul — aperçu grisé.
  const inherited = useMemo(() => {
    const parentKey: Record<string, string | null> = {};
    nodes.forEach((n) => { parentKey[n.key] = n.parent_id ? idToKey[n.parent_id] : null; });
    const resolve = (key: string): Tri => {
      let cur: string | null = key;
      while (cur) {
        const t = local[cur];
        if (t === "allow" || t === "deny") return t;
        cur = parentKey[cur] ?? null;
      }
      return "deny";
    };
    const out: Record<string, Tri> = {};
    nodes.forEach((n) => { out[n.key] = resolve(n.key); });
    return out;
  }, [nodes, local, idToKey]);

  const cycle = (key: string) =>
    setLocal((m) => {
      const cur = m[key] ?? "inherit";
      const next: Tri = cur === "inherit" ? "allow" : cur === "allow" ? "deny" : "inherit";
      const copy = { ...m };
      if (next === "inherit") delete copy[key]; else copy[key] = next;
      return copy;
    });

  const save = async () => {
    if (!subjectId) return;
    const items = Object.entries(local)
      .filter(([, t]) => t === "allow" || t === "deny")
      .map(([node_key, effect]) => ({ node_key, effect, scope: "all" }));
    const r = await api("/api/admin/iam/grants", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject_type: subjectType, subject_id: subjectId, items }),
    });
    setMsg(r === null ? L(lang, "خطأ", "Error", "Erreur") : L(lang, "تم الحفظ", "Saved", "Enregistré"));
  };

  const renderNode = (n: IamNode, depth: number): React.ReactNode => {
    const kids = childrenOf[n.id] ?? [];
    const isOpen = expanded.has(n.id);
    const tri = local[n.key] ?? "inherit";
    const eff = inherited[n.key];
    return (
      <div key={n.id}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0", paddingInlineStart: depth * 18 }}>
          {kids.length > 0 ? (
            <button onClick={() => setExpanded((s) => { const c = new Set(s); c.has(n.id) ? c.delete(n.id) : c.add(n.id); return c; })}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", width: 16 }}>
              {isOpen ? "▾" : "▸"}
            </button>
          ) : <span style={{ width: 16, display: "inline-block" }} />}
          <span style={{ flex: 1, fontSize: 12.5, color: n.type === "action" ? "var(--ink-4)" : "var(--ink)", fontWeight: n.type === "category" ? 600 : 400 }}>
            {nodeLabel(n, lang)}
            <span style={{ fontSize: 10, color: "var(--ink-5, var(--ink-4))", marginInlineStart: 6 }}>{n.type}</span>
          </span>
          {/* Aperçu hérité grisé */}
          <span style={{ fontSize: 10, color: eff === "allow" ? "var(--emerald)" : "var(--rose)", opacity: 0.55, minWidth: 54, textAlign: "end" }}>
            {eff === "allow" ? L(lang, "مسموح", "allow", "autorisé") : L(lang, "ممنوع", "deny", "refusé")}
          </span>
          <TriToggle tri={tri} onClick={() => cycle(n.key)} lang={lang} />
        </div>
        {isOpen && kids.map((c) => renderNode(c, depth + 1))}
      </div>
    );
  };

  const roots = childrenOf["__root__"] ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <select value={subjectType} onChange={(e) => { setSubjectType(e.target.value as typeof subjectType); setSubjectId(""); }} style={input}>
          <option value="group">{L(lang, "مجموعة", "Group", "Groupe")}</option>
          <option value="unit">{L(lang, "وحدة", "Unit", "Unité")}</option>
        </select>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} style={{ ...input, minWidth: 220 }}>
          <option value="">{L(lang, "اختر…", "Select…", "Choisir…")}</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <button onClick={save} disabled={!subjectId} style={{ ...btnPrimary, opacity: subjectId ? 1 : 0.5 }}>
          {L(lang, "حفظ", "Save", "Enregistrer")}
        </button>
        {msg && <span style={{ fontSize: 12, color: "var(--gold-deep)" }}>{msg}</span>}
      </div>
      <div style={{ fontSize: 11, color: "var(--ink-4)" }}>
        {L(lang, "انقر على الحالة للتبديل: وراثة → سماح → منع",
          "Click the state to cycle: Inherit → Allow → Deny",
          "Cliquez l'état pour basculer : Hériter → Autoriser → Refuser")}
      </div>
      <div style={{ ...card, maxHeight: 460, overflowY: "auto" }}>
        {subjectId ? roots.map((r) => renderNode(r, 0))
          : <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{L(lang, "اختر سُبجكت", "Pick a subject", "Choisir un sujet")}</div>}
      </div>
    </div>
  );
}

function TriToggle({ tri, onClick, lang }: { tri: Tri; onClick: () => void; lang: Lang }): React.ReactNode {
  const map = {
    inherit: { bg: "var(--bg-cream)", fg: "var(--ink-4)", t: L(lang, "وراثة", "Inherit", "Hériter") },
    allow: { bg: "rgba(16,185,129,0.12)", fg: "var(--emerald)", t: L(lang, "سماح", "Allow", "Autoriser") },
    deny: { bg: "rgba(239,68,68,0.12)", fg: "var(--rose)", t: L(lang, "منع", "Deny", "Refuser") },
  }[tri];
  return (
    <button onClick={onClick} style={{ minWidth: 76, fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 999, border: `1px solid ${map.fg}`, background: map.bg, color: map.fg, cursor: "pointer" }}>
      {map.t}
    </button>
  );
}

// ── Styles partagés ──────────────────────────────────────────────────────────

const input: React.CSSProperties = {
  fontSize: 12.5, padding: "7px 10px", borderRadius: "var(--r)",
  border: "1px solid var(--line-soft)", background: "var(--bg-base)", color: "var(--ink)",
};
const btnPrimary: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: "var(--r)",
  border: "none", background: "var(--gold)", color: "#fff", cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, padding: "6px 12px", borderRadius: "var(--r)",
  border: "1px solid var(--line)", background: "transparent", color: "var(--ink-3)", cursor: "pointer",
};
const btnGhostDanger: React.CSSProperties = { ...btnGhost, color: "var(--rose)", borderColor: "var(--rose)" };

function chip(active: boolean): React.CSSProperties {
  return {
    fontSize: 11.5, padding: "4px 10px", borderRadius: 999, cursor: "pointer",
    border: `1px solid ${active ? "var(--gold)" : "var(--line-soft)"}`,
    background: active ? "var(--gold-ghost)" : "var(--bg-base)",
    color: active ? "var(--gold-deep)" : "var(--ink-3)",
  };
}
function badge(role: string): React.CSSProperties {
  return {
    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
    background: "var(--ink-ghost, rgba(0,0,0,0.05))", color: "var(--ink-3)",
    textTransform: role === "system" ? "none" : "capitalize",
  };
}
function statusBadge(status: string): React.CSSProperties {
  const ok = status === "active";
  return {
    fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
    background: ok ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
    color: ok ? "var(--emerald)" : "var(--rose)",
  };
}
