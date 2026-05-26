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

  const [loginVal,     setLoginVal]     = useState("login");
  const [password,     setPassword]     = useState("password");
  const [loginError,   setLoginError]   = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

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

              {/* SSO */}
              <button type="button" className="sgi-btn sgi-btn-ghost" style={{ height: 46, justifyContent: "center", fontSize: 12.5, width: "100%" }}>
                <span style={{ color: "var(--gold-deep)", display: "inline-flex" }}><IcLock /></span>&nbsp;
                {t.sso}
              </button>
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
