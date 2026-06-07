"use client";
import React, { useState } from "react";
import { Wordmark, IcChevR, IcLock } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";
import { apiLogin } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";

const inputStyle: React.CSSProperties = {
  height: 46, padding: "0 14px", width: "100%", boxSizing: "border-box",
  background: "var(--bg-ivory)", border: "1px solid var(--line)",
  borderRadius: "var(--r)", fontSize: 14, color: "var(--ink)",
  outline: "none", fontFamily: "Roboto, system-ui, sans-serif",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 11.5, letterSpacing: "0.06em",
  color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 500, marginBottom: 6,
};

/* ─── Background geometric pattern ──────────────────────────────────── */
function BgPattern() {
  return (
    <svg
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0.045, pointerEvents: "none" }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="geo" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="60" height="60" fill="none" />
          <line x1="0" y1="30" x2="60" y2="30" stroke="var(--gold)" strokeWidth="0.5" />
          <line x1="30" y1="0" x2="30" y2="60" stroke="var(--gold)" strokeWidth="0.5" />
          <circle cx="30" cy="30" r="1.5" fill="var(--gold)" />
          <circle cx="0"  cy="0"  r="1"   fill="var(--gold)" />
          <circle cx="60" cy="0"  r="1"   fill="var(--gold)" />
          <circle cx="0"  cy="60" r="1"   fill="var(--gold)" />
          <circle cx="60" cy="60" r="1"   fill="var(--gold)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#geo)" />
    </svg>
  );
}

/* ─── Language switcher (compact, centred) ───────────────────────────── */
function LangSwitcher() {
  const { lang, setLang } = useLang();
  const opts: { code: Lang; flag: string; label: string }[] = [
    { code: "ar", flag: "🇦🇪", label: "العربية" },
    { code: "en", flag: "🇬🇧", label: "English" },
    { code: "fr", flag: "🇫🇷", label: "Français" },
  ];
  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
      {opts.map(o => (
        <button
          key={o.code}
          type="button"
          onClick={() => setLang(o.code)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            padding: "5px 10px", borderRadius: "var(--r-sm)",
            fontSize: 11.5, fontWeight: lang === o.code ? 600 : 400,
            border: "1px solid",
            borderColor: lang === o.code ? "var(--gold)" : "var(--line-soft)",
            background: lang === o.code ? "var(--gold-ghost)" : "transparent",
            color: lang === o.code ? "var(--gold-deep)" : "var(--ink-3)",
            cursor: "pointer", transition: "all 0.15s",
          }}
        >
          <span>{o.flag}</span>
          <span className={o.code === "ar" ? "font-ar" : undefined}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Main screen ────────────────────────────────────────────────────── */
export function ScreenLogin({ onLogin }: { onLogin: () => void }) {
  const t = useT();
  const { lang } = useLang();

  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");

  // Pré-remplissage démo : explicite via NEXT_PUBLIC_DEMO_ADMIN_EMAIL / _PASSWORD,
  // sinon le compte de démo SEULEMENT hors production. En prod sans ces env, les
  // champs restent vides — aucun identifiant n'est exposé dans le bundle client.
  const demoFallback = process.env.NODE_ENV !== "production";
  const [loginVal,     setLoginVal]     = useState(
    process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? (demoFallback ? "admin@infinity-uae.com" : ""),
  );
  const [password,     setPassword]     = useState(
    process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD ?? (demoFallback ? "Admin123!" : ""),
  );
  const [loginError,   setLoginError]   = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [ssoNotice,    setSsoNotice]    = useState("");

  const [resetEmail,   setResetEmail]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const loginTitle =
    lang === "ar" ? "تسجيل الدخول" :
    lang === "fr" ? "Connexion"     :
    "Sign in";

  const loginSubtitle =
    lang === "ar" ? "مرحباً بك في INFINITY Workspace" :
    lang === "fr" ? "Bienvenue dans INFINITY Workspace" :
    "Welcome to INFINITY Workspace";

  const googleLabel =
    lang === "ar" ? "تسجيل الدخول عبر Google" :
    lang === "fr" ? "Se connecter avec Google"  :
    "Sign in with Google";

  const icloudLabel =
    lang === "ar" ? "تسجيل الدخول عبر iCloud" :
    lang === "fr" ? "Se connecter avec iCloud"  :
    "Sign in with iCloud";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setLoginLoading(true);
    try {
      await apiLogin(loginVal.trim(), password);
      localStorage.setItem("sgi_last_login", new Date().toISOString());
      onLogin();
    } catch {
      setLoginError(t.error_creds);
    } finally {
      setLoginLoading(false);
    }
  }

  // Fournisseurs d'identité externes (UAE Infinity PASS / Google / iCloud) :
  // le flux OAuth/IdP n'est pas encore branché côté backend. On affiche un message
  // neutre au lieu de soumettre silencieusement le formulaire mot de passe.
  function handleSso(provider: string) {
    setLoginError("");
    setSsoNotice(
      lang === "ar" ? `تسجيل الدخول عبر ${provider} غير متاح بعد.` :
      lang === "fr" ? `Connexion via ${provider} bientôt disponible.` :
      `${provider} sign-in is not available yet.`,
    );
  }

  function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setResetLoading(true);
    setTimeout(() => {
      setResetLoading(false);
      setMode("sent");
    }, 1200);
  }

  return (
    <div style={{
      width: "100%", height: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg-base)", color: "var(--ink)",
      position: "relative", overflow: "hidden",
    }}>
      {/* Subtle geometric background */}
      <BgPattern />

      {/* Centred card */}
      <div style={{
        position: "relative", zIndex: 1,
        width: "min(420px, 90vw)",
        padding: "clamp(28px, 5vw, 40px)",
        background: "var(--bg-paper)",
        border: "1px solid var(--line-soft)",
        borderRadius: 16,
        boxShadow: "var(--shadow-3)",
        display: "flex", flexDirection: "column", gap: 0,
      }}>

        {/* ── Card header: logo + subtitle + lang switcher ── */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, marginBottom: 20 }}>
          <Wordmark />
          <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>
            INFINITY Workspace
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <LangSwitcher />
        </div>

        <div style={{ height: 1, background: "var(--line-soft)", marginBottom: 24 }} />

        {/* ═══════════════════════════════════════════════
            MODE: login
        ════════════════════════════════════════════════ */}
        {mode === "login" && (
          <form onSubmit={handleLogin}>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div
                className={lang === "ar" ? "font-ar" : "font-display"}
                style={{ fontSize: 28, lineHeight: 1.15, color: "var(--ink)" }}
              >
                {loginTitle}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6 }}>
                {loginSubtitle}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Login */}
              <div>
                <label style={labelStyle}>{t.login_label}</label>
                <input
                  type="text"
                  value={loginVal}
                  onChange={e => setLoginVal(e.target.value)}
                  placeholder={t.login_ph}
                  autoComplete="username"
                  style={{ ...inputStyle, borderColor: loginError ? "var(--rose)" : "var(--line)" }}
                />
              </div>

              {/* Password */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <label style={{ ...labelStyle, marginBottom: 0 }}>{t.pass_label}</label>
                  <button
                    type="button"
                    onClick={() => { setLoginError(""); setMode("forgot"); }}
                    style={{ background: "none", border: "none", padding: 0, color: "var(--gold-deep)", fontSize: 11, letterSpacing: "0.04em", cursor: "pointer" }}
                  >
                    {t.forgot}
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  style={{ ...inputStyle, borderColor: loginError ? "var(--rose)" : "var(--line)" }}
                />
              </div>

              {loginError && (
                <div style={{ padding: "10px 14px", background: "var(--rose-soft)", border: "1px solid var(--rose)", borderRadius: "var(--r)", fontSize: 12, color: "var(--rose)", lineHeight: 1.4 }}>
                  {loginError}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={loginLoading}
                className="sgi-btn sgi-btn-primary"
                style={{ height: 48, justifyContent: "center", marginTop: 4, fontSize: 13.5, letterSpacing: "0.04em", opacity: loginLoading ? 0.7 : 1, width: "100%" }}
              >
                {loginLoading ? t.signing_in : <>{t.continue_ws} <IcChevR /></>}
              </button>

              {/* OR divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-4)", fontSize: 11, letterSpacing: "0.18em", margin: "2px 0" }}>
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                {t.or}
                <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
              </div>

              {/* UAE Infinity PASS (Infinity ID) — IdP interne SGI, niveaux d'assurance L0–L3 */}
              <button
                type="button"
                onClick={() => handleSso("UAE Infinity PASS")}
                disabled={loginLoading}
                className="sgi-btn sgi-btn-ghost"
                style={{ height: 46, justifyContent: "center", fontSize: 12.5, width: "100%", gap: 8, borderColor: "var(--gold-deep)", color: "var(--gold-deep)", fontWeight: 600 }}
                title="UAE Infinity PASS — Infinity ID (identité interne, niveaux d'assurance L0–L3)"
              >
                <span style={{ display: "inline-flex" }}><IcLock /></span>
                {t.login_uaepass}
              </button>

              {/* Connexion Google */}
              <button
                type="button"
                onClick={() => handleSso("Google")}
                disabled={loginLoading}
                className="sgi-btn sgi-btn-ghost"
                style={{ height: 46, justifyContent: "center", fontSize: 12.5, width: "100%", gap: 10 }}
              >
                <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0 }}>
                  <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
                  <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
                  <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34A21.99 21.99 0 0 0 2 24c0 3.55.85 6.91 2.34 9.88l7.35-5.7z" />
                  <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
                </svg>
                {googleLabel}
              </button>

              {/* Connexion iCloud (Apple ID) */}
              <button
                type="button"
                onClick={() => handleSso("iCloud")}
                disabled={loginLoading}
                className="sgi-btn sgi-btn-ghost"
                style={{ height: 46, justifyContent: "center", fontSize: 12.5, width: "100%", gap: 10 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ display: "inline-flex", flexShrink: 0 }}>
                  <path d="M16.36 1.43c.05 1.08-.37 2.13-1.08 2.9-.74.82-1.95 1.45-3.04 1.36-.13-1.04.41-2.15 1.07-2.85.74-.79 2.01-1.38 3.05-1.41zM20.5 17.13c-.55 1.27-.82 1.84-1.53 2.96-.99 1.56-2.38 3.51-4.11 3.52-1.53.01-1.93-1-4.01-.99-2.08.01-2.51 1.01-4.05.99-1.73-.02-3.05-1.78-4.04-3.34-2.77-4.36-3.06-9.48-1.35-12.2 1.21-1.93 3.12-3.06 4.92-3.06 1.83 0 2.98 1 4.49 1 1.47 0 2.36-1 4.48-1 1.6 0 3.3.87 4.51 2.38-3.96 2.17-3.32 7.82.49 8.78z" />
                </svg>
                {icloudLabel}
              </button>

              {ssoNotice && (
                <div style={{ padding: "10px 14px", background: "var(--gold-ghost)", border: "1px solid var(--gold)", borderRadius: "var(--r)", fontSize: 12, color: "var(--gold-deep)", lineHeight: 1.4 }}>
                  {ssoNotice}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ marginTop: 28, paddingTop: 18, borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-4)", flexWrap: "wrap", gap: 6 }}>
              <span>{t.need_access} <span style={{ color: "var(--gold-deep)", cursor: "pointer" }}>{t.contact_manager}</span></span>
              <span>v 2.4 · stable</span>
            </div>
          </form>
        )}

        {/* ═══════════════════════════════════════════════
            MODE: forgot
        ════════════════════════════════════════════════ */}
        {mode === "forgot" && (
          <form onSubmit={handleForgot}>
            <button
              type="button"
              onClick={() => setMode("login")}
              style={{ background: "none", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-4)", cursor: "pointer", marginBottom: 24, letterSpacing: "0.04em" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              {t.forgot_back}
            </button>

            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div className="font-display" style={{ fontSize: 26, lineHeight: 1.15, color: "var(--ink)" }}>
                {t.forgot_title}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 8, lineHeight: 1.6 }}>
                {t.forgot_sub}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={labelStyle}>{t.email_label}</label>
                <input
                  type="email"
                  value={resetEmail}
                  onChange={e => setResetEmail(e.target.value)}
                  placeholder={t.email_ph}
                  required
                  autoFocus
                  autoComplete="email"
                  style={inputStyle}
                />
              </div>

              <button
                type="submit"
                disabled={resetLoading || !resetEmail.trim()}
                className="sgi-btn sgi-btn-primary"
                style={{ height: 48, justifyContent: "center", fontSize: 13.5, letterSpacing: "0.04em", opacity: (resetLoading || !resetEmail.trim()) ? 0.65 : 1, width: "100%" }}
              >
                {resetLoading ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation: "spin 0.8s linear infinite" }}>
                      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                    </svg>
                    {t.sending}
                  </span>
                ) : t.send_link}
              </button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--line-soft)", fontSize: 11, color: "var(--ink-4)" }}>
              {t.remember_pw}{" "}
              <button type="button" onClick={() => setMode("login")} style={{ background: "none", border: "none", padding: 0, color: "var(--gold-deep)", cursor: "pointer", fontSize: 11 }}>
                {t.sign_in}
              </button>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </form>
        )}

        {/* ═══════════════════════════════════════════════
            MODE: sent
        ════════════════════════════════════════════════ */}
        {mode === "sent" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, marginBottom: 24 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 28,
                background: "var(--emerald-soft)", border: "1px solid var(--emerald)",
                display: "grid", placeItems: "center", color: "var(--emerald)",
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                  <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                </svg>
              </div>
              <div style={{ textAlign: "center" }}>
                <div className="font-display" style={{ fontSize: 26, color: "var(--ink)" }}>{t.sent_title}</div>
                <div style={{ marginTop: 10, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.7 }}>
                  {t.sent_sub}{" "}
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>{resetEmail}</span>.
                  <br />
                  {t.sent_link_valid}
                </div>
              </div>
            </div>

            <div style={{
              padding: "14px 16px",
              background: "var(--emerald-soft)", border: "1px solid var(--emerald)",
              borderRadius: "var(--r)", fontSize: 12.5, color: "var(--emerald)", lineHeight: 1.6,
              marginBottom: 20,
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.sent_no_email}</div>
              {t.sent_check_spam}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button
                type="button"
                onClick={() => { setResetLoading(true); handleForgot(new Event("submit") as unknown as React.FormEvent); }}
                className="sgi-btn sgi-btn-ghost"
                style={{ height: 44, justifyContent: "center", fontSize: 12.5, width: "100%" }}
              >
                {t.resend}
              </button>
              <button
                type="button"
                onClick={() => { setMode("login"); setResetEmail(""); }}
                className="sgi-btn sgi-btn-primary"
                style={{ height: 44, justifyContent: "center", fontSize: 12.5, width: "100%" }}
              >
                {t.back_login}
              </button>
            </div>

            <div style={{ marginTop: 24, paddingTop: 18, borderTop: "1px solid var(--line-soft)", fontSize: 11, color: "var(--ink-4)" }}>
              {t.need_help} <span style={{ color: "var(--gold-deep)", cursor: "pointer" }}>{t.contact_support}</span>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
