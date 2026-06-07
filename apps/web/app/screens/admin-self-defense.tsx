"use client";

/**
 * Écran Administration application · Self-Defense (admin/manager).
 *
 *   GET/PUT /api/admin/self-defense/config           → codes (hashés serveur), options
 *   GET     /api/admin/self-defense/lockouts          → utilisateurs verrouillés
 *   POST    /api/admin/self-defense/lockouts/{id}/unlock
 *
 * Les codes ne sont jamais affichés (seulement « défini / non défini »). Les
 * événements (`self_defense:*`) sont consultables dans l'écran Audit. i18n local,
 * CSS logique (Loi 3).
 */

import React, { useCallback, useEffect, useState } from "react";

import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson } from "@/lib/api-client";

type Lang = "ar" | "en" | "fr";

type Config = {
  arm_code_set: boolean;
  disarm_code_set: boolean;
  max_attempts: number;
  armgate_enabled: boolean;
  options: Record<string, unknown>;
};

type Lockout = {
  user_id: string;
  failed_attempts: number;
  locked: boolean;
  locked_at: string | null;
};

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Self-Defense",
    subtitle: "Codes (armer / désarmer), verrouillages et options du panneau de défense.",
    codes: "Codes d'accès",
    armCode: "Code d'armement",
    disarmCode: "Code de désarmement",
    set: "défini",
    unset: "non défini",
    leaveBlank: "Laisser vide = inchangé",
    maxAttempts: "Essais avant verrouillage",
    armgate: "Protection du bouton activée",
    save: "Enregistrer",
    saved: "Enregistré",
    saveFailed: "Échec de l'enregistrement",
    lockouts: "Utilisateurs verrouillés",
    noLockouts: "Aucun utilisateur verrouillé.",
    user: "Utilisateur",
    attempts: "Échecs",
    since: "Depuis",
    unlock: "Déverrouiller",
    options: "Options (à venir)",
    optionsHint: "Section extensible — réglages additionnels à définir ultérieurement.",
    auditNote: "Les événements (armement, échecs, verrouillage) sont tracés dans l'écran Audit.",
    loading: "Chargement…",
  },
  en: {
    title: "Self-Defense",
    subtitle: "Codes (arm / disarm), lockouts and options of the defense panel.",
    codes: "Access codes",
    armCode: "Arming code",
    disarmCode: "Disarming code",
    set: "set",
    unset: "not set",
    leaveBlank: "Leave blank = unchanged",
    maxAttempts: "Attempts before lockout",
    armgate: "Button protection enabled",
    save: "Save",
    saved: "Saved",
    saveFailed: "Save failed",
    lockouts: "Locked users",
    noLockouts: "No locked user.",
    user: "User",
    attempts: "Fails",
    since: "Since",
    unlock: "Unlock",
    options: "Options (coming soon)",
    optionsHint: "Extensible section — additional settings to be defined later.",
    auditNote: "Events (arming, failures, lockout) are tracked in the Audit screen.",
    loading: "Loading…",
  },
  ar: {
    title: "الدفاع الذاتي",
    subtitle: "الرموز (تفعيل/إلغاء)، الأقفال وخيارات لوحة الدفاع.",
    codes: "رموز الوصول",
    armCode: "رمز التفعيل",
    disarmCode: "رمز الإلغاء",
    set: "محدد",
    unset: "غير محدد",
    leaveBlank: "اتركه فارغًا = دون تغيير",
    maxAttempts: "المحاولات قبل القفل",
    armgate: "حماية الزر مفعّلة",
    save: "حفظ",
    saved: "تم الحفظ",
    saveFailed: "فشل الحفظ",
    lockouts: "المستخدمون المقفلون",
    noLockouts: "لا مستخدم مقفل.",
    user: "المستخدم",
    attempts: "إخفاقات",
    since: "منذ",
    unlock: "إلغاء القفل",
    options: "خيارات (قريبًا)",
    optionsHint: "قسم قابل للتوسيع — إعدادات إضافية تُحدد لاحقًا.",
    auditNote: "تُسجَّل الأحداث (التفعيل، الإخفاقات، القفل) في شاشة التدقيق.",
    loading: "جارٍ التحميل…",
  },
};

const card: React.CSSProperties = {
  background: "var(--bg-paper)",
  border: "1px solid var(--line-soft)",
  borderRadius: 12,
  padding: 18,
  marginBlockEnd: 16,
};
const input: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--line-soft)",
  background: "var(--bg-ivory)",
  color: "var(--ink)",
  fontSize: 13,
};
const label: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ink-4)",
  marginBlockEnd: 4,
  display: "block",
};

export function ScreenAppAdminSelfDefense(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [cfg, setCfg] = useState<Config | null>(null);
  const [armCode, setArmCode] = useState("");
  const [disarmCode, setDisarmCode] = useState("");
  const [maxAttempts, setMaxAttempts] = useState(3);
  const [armgate, setArmgate] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const lockouts = useApiList<Lockout>("/api/admin/self-defense/lockouts");

  const loadConfig = useCallback(async () => {
    try {
      const r = await getJson<{ data: Config }>("/api/admin/self-defense/config");
      setCfg(r.data);
      setMaxAttempts(r.data.max_attempts);
      setArmgate(r.data.armgate_enabled);
    } catch {
      /* ignore — l'écran reste utilisable */
    }
  }, []);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function save(): Promise<void> {
    setBusy(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = {
        max_attempts: maxAttempts,
        armgate_enabled: armgate,
      };
      if (armCode.trim()) body.arm_code = armCode.trim();
      if (disarmCode.trim()) body.disarm_code = disarmCode.trim();
      const res = await fetch("/api/admin/self-defense/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setMsg(L("saveFailed"));
        return;
      }
      setArmCode("");
      setDisarmCode("");
      setMsg(L("saved"));
      await loadConfig();
    } catch {
      setMsg(L("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function unlock(userId: string): Promise<void> {
    await postJson(`/api/admin/self-defense/lockouts/${userId}/unlock`, {});
    lockouts.reload();
  }

  const badge = (set: boolean): React.ReactNode => (
    <span style={{ fontSize: 11, fontWeight: 700, color: set ? "var(--emerald)" : "var(--ink-4)" }}>
      {set ? `✓ ${L("set")}` : `○ ${L("unset")}`}
    </span>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title={`🛡️ ${L("title")}`} />
      <div style={{ flex: 1, overflowY: "auto", padding: 20, background: "var(--bg-cream)" }}>
        <p style={{ color: "var(--ink-4)", fontSize: 12.5, marginBlockEnd: 16 }}>{L("subtitle")}</p>

        {/* Codes */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBlockEnd: 12 }}>🔐 {L("codes")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={label}>
                {L("armCode")} {cfg && badge(cfg.arm_code_set)}
              </label>
              <input
                type="password"
                style={input}
                value={armCode}
                placeholder={L("leaveBlank")}
                onChange={(e) => setArmCode(e.target.value)}
              />
            </div>
            <div>
              <label style={label}>
                {L("disarmCode")} {cfg && badge(cfg.disarm_code_set)}
              </label>
              <input
                type="password"
                style={input}
                value={disarmCode}
                placeholder={L("leaveBlank")}
                onChange={(e) => setDisarmCode(e.target.value)}
              />
            </div>
            <div>
              <label style={label}>{L("maxAttempts")}</label>
              <input
                type="number"
                min={1}
                max={10}
                style={input}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(Number(e.target.value))}
              />
            </div>
            <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
              <input
                id="sd-armgate"
                type="checkbox"
                checked={armgate}
                onChange={(e) => setArmgate(e.target.checked)}
              />
              <label htmlFor="sd-armgate" style={{ ...label, marginBlockEnd: 0 }}>
                {L("armgate")}
              </label>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBlockStart: 14 }}>
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              style={{
                padding: "8px 18px",
                borderRadius: 10,
                border: "none",
                background: "var(--ink)",
                color: "#fff",
                fontWeight: 700,
                cursor: busy ? "wait" : "pointer",
              }}
            >
              {L("save")}
            </button>
            {msg && <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{msg}</span>}
          </div>
        </div>

        {/* Lockouts */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBlockEnd: 12 }}>🔒 {L("lockouts")}</div>
          {lockouts.loading && !lockouts.items.length ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L("loading")}</div>
          ) : lockouts.items.length === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L("noLockouts")}</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead style={{ color: "var(--ink-4)" }}>
                <tr>
                  <th style={{ textAlign: "start", padding: "6px 8px" }}>{L("user")}</th>
                  <th style={{ textAlign: "start", padding: "6px 8px" }}>{L("attempts")}</th>
                  <th style={{ textAlign: "start", padding: "6px 8px" }}>{L("since")}</th>
                  <th style={{ padding: "6px 8px" }} />
                </tr>
              </thead>
              <tbody>
                {lockouts.items.map((lk) => (
                  <tr key={lk.user_id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td style={{ padding: "6px 8px", fontFamily: "monospace", fontSize: 11 }}>
                      {lk.user_id}
                    </td>
                    <td style={{ padding: "6px 8px" }}>{lk.failed_attempts}</td>
                    <td style={{ padding: "6px 8px" }}>
                      {lk.locked_at ? new Date(lk.locked_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: "6px 8px", textAlign: "end" }}>
                      <button
                        type="button"
                        onClick={() => void unlock(lk.user_id)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: 8,
                          border: "1px solid var(--line-soft)",
                          background: "var(--bg-paper)",
                          color: "var(--emerald)",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {L("unlock")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Options (extensible) + Audit */}
        <div style={card}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBlockEnd: 6 }}>⚙️ {L("options")}</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L("optionsHint")}</div>
        </div>
        <p style={{ fontSize: 12, color: "var(--ink-4)" }}>ℹ️ {L("auditNote")}</p>
      </div>
    </div>
  );
}
