"use client";
import React, { useState, useEffect } from "react";
import { Eyebrow, IcChevR, IcCheck, IcLock, IcClock } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";
import { apiLogin } from "@/lib/auth";
import type { Lang } from "@/lib/i18n";

const inputStyle: React.CSSProperties = {
  height: 46, padding: "0 14px", width: "100%", boxSizing: "border-box",
  background: "var(--bg-ivory)", border: "1px solid var(--line)",
  borderRadius: "var(--r)", fontSize: 14, color: "var(--ink)",
  outline: "none", fontFamily: "Inter, system-ui, sans-serif",
};

/* ─── Language picker bar ────────────────────────────────────────── */
function LangBar() {
  const { lang, setLang } = useLang();
  const t = useT();
  const opts: { code: Lang; flag: string; label: string }[] = [
    { code: "ar", flag: "🇦🇪", label: t.lang_ar },
    { code: "en", flag: "🇬🇧", label: t.lang_en },
    { code: "fr", flag: "🇫🇷", label: t.lang_fr },
  ];
  return (
    <div style={{
      height: 48, flexShrink: 0, paddingInlineStart: 24, paddingInlineEnd: 24,
      background: "var(--bg-base)", borderBottom: "1px solid var(--line-soft)",
      display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 6,
    }}>
      {opts.map(o => (
        <button
          key={o.code}
          onClick={() => setLang(o.code)}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "5px 12px", borderRadius: "var(--r-sm)",
            fontSize: 12, fontWeight: lang === o.code ? 600 : 400,
            border: "1px solid",
            borderColor: lang === o.code ? "var(--gold)" : "var(--line-soft)",
            background: lang === o.code ? "var(--gold-ghost)" : "transparent",
            color: lang === o.code ? "var(--gold-deep)" : "var(--ink-3)",
            cursor: "pointer",
          }}
        >
          <span>{o.flag}</span>
          <span className={o.code === "ar" ? "font-ar" : undefined}>{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Corner frame decoration (Image #2 style) ────────────────────── */
const FRAME_COLOR = "#C9A870";
const FRAME_LEN   = 72; /* px length of each arm */

function CornerFrame({ pos, size = FRAME_LEN, offset = 28 }: {
  pos: "tl" | "tr" | "bl" | "br";
  size?: number;
  offset?: number;
}) {
  const top    = pos === "tl" || pos === "tr";
  const left   = pos === "tl" || pos === "bl";
  const style: React.CSSProperties = {
    position: "absolute",
    top:    top  ? offset : undefined,
    bottom: !top ? offset : undefined,
    insetInlineStart: left ? offset : undefined,
    insetInlineEnd:  !left ? offset : undefined,
    pointerEvents: "none",
  };
  let d = "";
  if (pos === "tl") d = `M${size} 0 L0 0 L0 ${size}`;
  if (pos === "tr") d = `M0 0 L${size} 0 L${size} ${size}`;
  if (pos === "bl") d = `M${size} ${size} L0 ${size} L0 0`;
  if (pos === "br") d = `M0 ${size} L${size} ${size} L${size} 0`;
  return (
    <div style={style}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none" overflow="visible">
        <path d={d} stroke={FRAME_COLOR} strokeWidth="1.3" strokeLinecap="square" />
      </svg>
    </div>
  );
}

/* ─── Mobile / tablet brand banner (replaces LeftPanel on compact) ─── */
function MobileBrandBanner() {
  return (
    <div style={{
      position: "relative",
      background: "#F5EDE0",
      padding: "22px 16px 20px",
      marginBottom: 28,
      borderRadius: "var(--r)",
      border: "1px solid rgba(201,168,112,0.35)",
      overflow: "hidden",
      flexShrink: 0,
    }}>
      <CornerFrame pos="tl" size={44} offset={14} />
      <CornerFrame pos="tr" size={44} offset={14} />
      <CornerFrame pos="bl" size={44} offset={14} />
      <CornerFrame pos="br" size={44} offset={14} />
      <div style={{ display: "flex", justifyContent: "center", position: "relative", zIndex: 1 }}>
        <img
          src="/logo-infinity.png"
          alt="Infinity International Facilities Management — Proud of UAE"
          style={{ maxWidth: 260, width: "72%", objectFit: "contain" }}
        />
      </div>
    </div>
  );
}

/* ─── Left panel — desktop only ──────────────────────────────────── */
function LeftPanel() {
  const t = useT();
  const { lang } = useLang();
  const [now, setNow] = useState<Date>(() => new Date());
  const [lastLoginRaw, setLastLoginRaw] = useState<string | null>(null);

  useEffect(() => {
    setLastLoginRaw(localStorage.getItem("sgi_last_login"));
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const locale = lang === "ar" ? "ar-AE" : lang === "fr" ? "fr-FR" : "en-AE";
  const timeStr = now.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const dateStr = now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  function formatLastLogin(iso: string): string {
    const d = new Date(iso);
    const t2 = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
    const today    = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const loginDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = Math.round((today.getTime() - loginDay.getTime()) / 86400000);
    if (diff === 0) return lang === "ar" ? `اليوم · ${t2}` : lang === "fr" ? `Aujourd'hui · ${t2}` : `Today · ${t2}`;
    if (diff === 1) return lang === "ar" ? `أمس · ${t2}` : lang === "fr" ? `Hier · ${t2}` : `Yesterday · ${t2}`;
    return `${d.toLocaleDateString(locale, { day: "numeric", month: "short" })} · ${t2}`;
  }

  return (
    <div style={{
      flex: 1.05,
      padding: "64px 72px",
      display: "flex",
      flexDirection: "column",
      background: "#F5EDE0",          /* warm cream — Image #2 */
      borderInlineEnd: "1px solid var(--line-soft)",
      position: "relative",
      overflow: "hidden",
    }}>

      {/* ── 4 corner frames (Image #2) ── */}
      <CornerFrame pos="tl" />
      <CornerFrame pos="tr" />
      <CornerFrame pos="bl" />
      <CornerFrame pos="br" />

      {/* ── Infinity International logo ── */}
      <div style={{ display: "flex", justifyContent: "center", flexShrink: 0, marginBottom: 48, position: "relative", zIndex: 1 }}>
        <img
          src="/logo-infinity.png"
          alt="Infinity International Facilities Management — Proud of UAE"
          style={{ maxWidth: 360, width: "88%", objectFit: "contain" }}
        />
      </div>

      {/* ── Hero text + stats ── */}
      <div style={{ marginTop: "auto", marginBottom: "auto", display: "flex", flexDirection: "column", gap: 24, maxWidth: 500, position: "relative", zIndex: 1 }}>
        <Eyebrow>{t.hero_eyebrow}</Eyebrow>
        <div>
          <div className={lang === "ar" ? "font-ar" : "font-display"}
            style={{ fontSize: lang === "ar" ? 40 : 50, lineHeight: 1.06, letterSpacing: "-0.01em", color: "#2C2417" }}>
            {lang === "ar"
              ? t.hero_title
              : <>{t.hero_title.replace(".", "")} <i style={{ color: "#A07B3C" }}>{lang === "fr" ? "d'exception." : "elevated."}</i></>
            }
          </div>
          <div style={{ fontSize: 13.5, color: "#6B5B47", lineHeight: 1.75, marginTop: 16, maxWidth: 440 }}>
            {t.hero_sub}
          </div>
        </div>

        <div style={{ display: "flex", gap: 24, paddingTop: 20, borderTop: "1px solid rgba(180,150,110,0.35)" }}>
          {[
            { n: t.hero_s1_n, l: t.hero_s1_l },
            { n: t.hero_s2_n, l: t.hero_s2_l },
            { n: t.hero_s3_n, l: t.hero_s3_l },
          ].map(s => (
            <div key={s.l}>
              <div className="font-display tnum" style={{ fontSize: 24, color: "#2C2417" }}>{s.n}</div>
              <div style={{ fontSize: 10, letterSpacing: "0.16em", color: "#8C7560", textTransform: "uppercase", marginTop: 3 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Live clock */}
        <div style={{
          padding: "14px 18px",
          background: "rgba(255,255,255,0.55)",
          backdropFilter: "blur(6px)",
          borderRadius: "var(--r)",
          border: "1px solid rgba(180,150,110,0.3)",
          display: "flex", flexDirection: "column", gap: 10,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ color: "#A07B3C", flexShrink: 0 }}><IcClock /></span>
            <div>
              <div className="font-display tnum" style={{ fontSize: 22, color: "#2C2417", letterSpacing: "0.06em", lineHeight: 1.1 }}>
                {timeStr}
              </div>
              <div style={{ fontSize: 10.5, color: "#8C7560", marginTop: 2, textTransform: "capitalize" }}>
                {dateStr}
              </div>
            </div>
          </div>
          {lastLoginRaw && (
            <div style={{
              paddingTop: 10, borderTop: "1px solid rgba(180,150,110,0.2)",
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 11, color: "#6B5B47",
            }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--emerald)", flexShrink: 0, display: "inline-block" }} />
              <span>
                {lang === "ar" ? "آخر تسجيل دخول: " : lang === "fr" ? "Dernière connexion : " : "Last login: "}
                <span style={{ color: "#2C2417", fontWeight: 500 }}>{formatLastLogin(lastLoginRaw)}</span>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer ── */}
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "#A09080", letterSpacing: "0.1em", position: "relative", zIndex: 1 }}>
        <span>© 2026 · Infinity International FM</span>
        <span>DUBAI · ABU DHABI · SHARJAH</span>
      </div>
    </div>
  );
}

/* ─── Main screen ────────────────────────────────────────────────── */
export function ScreenLogin({ onLogin }: { onLogin: () => void }) {
  const t = useT();
  const [mode, setMode] = useState<"login" | "forgot" | "sent">("login");

  const [loginVal,     setLoginVal]     = useState("login");
  const [password,     setPassword]     = useState("password");
  const [loginError,   setLoginError]   = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [resetEmail,   setResetEmail]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const { lang, setLang } = useLang();

  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isCompact = bp !== "desktop";

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
    <div style={{ width: "100%", height: "100vh", display: "flex", flexDirection: "column", background: "var(--bg-base)", color: "var(--ink)" }}>
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left panel: visible on desktop only */}
        {!isCompact && <LeftPanel />}

        {/* Right panel */}
        <div style={{
          flex: 1,
          padding: isMob ? "28px 20px" : isCompact ? "48px" : "80px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          alignItems: "stretch",
          background: "var(--bg-paper)",
          overflow: "auto",
        }}>
          {/* Brand banner replaces the hidden left panel on compact */}
          {isCompact && <MobileBrandBanner />}

          {/* Inner centering wrapper */}
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            justifyContent: isCompact ? "flex-start" : "center",
            maxWidth: 380,
            width: "100%",
            alignSelf: isCompact ? undefined : "center",
          }}>

            {/* Language switcher */}
            <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
              {([
                { code: "ar" as const, flag: "🇦🇪", label: "العربية" },
                { code: "en" as const, flag: "🇬🇧", label: "English" },
                { code: "fr" as const, flag: "🇫🇷", label: "Français" },
              ]).map(o => (
                <button
                  key={o.code}
                  type="button"
                  onClick={() => setLang(o.code)}
                  style={{
                    flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6,
                    padding: "8px 0", borderRadius: "var(--r)",
                    fontSize: 12, fontWeight: lang === o.code ? 600 : 400,
                    border: "1px solid",
                    borderColor: lang === o.code ? "var(--gold)" : "var(--line-soft)",
                    background: lang === o.code ? "var(--gold-ghost)" : "var(--bg-ivory)",
                    color: lang === o.code ? "var(--gold-deep)" : "var(--ink-3)",
                    cursor: "pointer",
                    transition: "all 0.15s",
                  }}
                >
                  <span>{o.flag}</span>
                  <span className={o.code === "ar" ? "font-ar" : undefined}>{o.label}</span>
                </button>
              ))}
            </div>

            {/* ── Login ─────────────────────────────────────────────── */}
            {mode === "login" && (
              <form onSubmit={handleLogin} style={{ width: "100%" }}>
                <Eyebrow>{t.login_title}</Eyebrow>
                <div className="font-display" style={{ fontSize: isMob ? 26 : 36, marginTop: 12, color: "var(--ink)" }}>
                  {t.login_sub}
                </div>

                <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 500, marginBottom: 6 }}>
                      {t.login_label}
                    </label>
                    <input
                      type="text"
                      value={loginVal}
                      onChange={e => setLoginVal(e.target.value)}
                      placeholder={t.login_ph}
                      autoComplete="username"
                      style={{ ...inputStyle, borderColor: loginError ? "var(--rose)" : "var(--line)" }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                      <label style={{ fontSize: 11.5, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 500 }}>
                        {t.pass_label}
                      </label>
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

                  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-3)" }}>
                    <span style={{ width: 14, height: 14, borderRadius: 3, border: "1px solid var(--gold)", background: "var(--gold-ghost)", display: "grid", placeItems: "center", color: "var(--gold-deep)", flexShrink: 0 }}>
                      <IcCheck />
                    </span>
                    {t.keep_signed}
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="sgi-btn sgi-btn-primary"
                    style={{ height: 46, justifyContent: "center", marginTop: 4, fontSize: 13.5, letterSpacing: "0.04em", opacity: loginLoading ? 0.7 : 1 }}
                  >
                    {loginLoading ? t.signing_in : <>{t.continue_ws} <IcChevR /></>}
                  </button>

                  <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-4)", fontSize: 11, letterSpacing: "0.18em", margin: "6px 0" }}>
                    <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                    {t.or}
                    <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
                  </div>

                  <button type="button" className="sgi-btn sgi-btn-ghost" style={{ height: 44, justifyContent: "center", fontSize: 12.5 }}>
                    <span style={{ color: "var(--gold-deep)", display: "inline-flex" }}><IcLock /></span>&nbsp;
                    {t.sso}
                  </button>
                </div>

                <div style={{ marginTop: 40, paddingTop: 22, borderTop: "1px solid var(--line)", display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--ink-4)", flexWrap: "wrap", gap: 8 }}>
                  <span>{t.need_access} <span style={{ color: "var(--gold-deep)", cursor: "pointer" }}>{t.contact_manager}</span></span>
                  <span>v 2.4 · stable</span>
                </div>
              </form>
            )}

            {/* ── Forgot password ───────────────────────────────────── */}
            {mode === "forgot" && (
              <form onSubmit={handleForgot} style={{ width: "100%" }}>
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  style={{ background: "none", border: "none", padding: 0, display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-4)", cursor: "pointer", marginBottom: 28, letterSpacing: "0.04em" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  {t.forgot_back}
                </button>

                <Eyebrow>{t.forgot_title}</Eyebrow>
                <div className="font-display" style={{ fontSize: isMob ? 26 : 34, marginTop: 12, color: "var(--ink)" }}>{t.forgot_title}</div>
                <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 8, lineHeight: 1.65 }}>{t.forgot_sub}</div>

                <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 18 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11.5, letterSpacing: "0.06em", color: "var(--ink-3)", textTransform: "uppercase", fontWeight: 500, marginBottom: 6 }}>
                      {t.email_label}
                    </label>
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
                    style={{ height: 46, justifyContent: "center", fontSize: 13.5, letterSpacing: "0.04em", opacity: (resetLoading || !resetEmail.trim()) ? 0.65 : 1 }}
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

                <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-4)" }}>
                  {t.remember_pw}{" "}
                  <button type="button" onClick={() => setMode("login")} style={{ background: "none", border: "none", padding: 0, color: "var(--gold-deep)", cursor: "pointer", fontSize: 11 }}>
                    {t.sign_in}
                  </button>
                </div>

                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </form>
            )}

            {/* ── Sent confirmation ─────────────────────────────────── */}
            {mode === "sent" && (
              <div style={{ width: "100%" }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 28,
                  background: "var(--emerald-soft)", border: "1px solid var(--emerald)",
                  display: "grid", placeItems: "center", color: "var(--emerald)", marginBottom: 24,
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
                    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
                  </svg>
                </div>

                <Eyebrow>{t.sent_title}</Eyebrow>
                <div className="font-display" style={{ fontSize: isMob ? 26 : 34, marginTop: 12, color: "var(--ink)" }}>{t.sent_title}</div>

                <div style={{ marginTop: 14, fontSize: 13, color: "var(--ink-3)", lineHeight: 1.7 }}>
                  {t.sent_sub}{" "}
                  <span style={{ color: "var(--ink)", fontWeight: 600 }}>{resetEmail}</span>.
                  <br />
                  {t.sent_link_valid}
                </div>

                <div style={{
                  marginTop: 24, padding: "14px 16px",
                  background: "var(--emerald-soft)", border: "1px solid var(--emerald)",
                  borderRadius: "var(--r)", fontSize: 12.5, color: "var(--emerald)", lineHeight: 1.6,
                }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{t.sent_no_email}</div>
                  {t.sent_check_spam}
                </div>

                <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
                  <button
                    type="button"
                    onClick={() => { setResetLoading(true); handleForgot(new Event("submit") as unknown as React.FormEvent); }}
                    className="sgi-btn sgi-btn-ghost"
                    style={{ height: 44, justifyContent: "center", fontSize: 12.5 }}
                  >
                    {t.resend}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMode("login"); setResetEmail(""); }}
                    className="sgi-btn sgi-btn-primary"
                    style={{ height: 44, justifyContent: "center", fontSize: 12.5 }}
                  >
                    {t.back_login}
                  </button>
                </div>

                <div style={{ marginTop: 32, paddingTop: 20, borderTop: "1px solid var(--line)", fontSize: 11, color: "var(--ink-4)" }}>
                  {t.need_help} <span style={{ color: "var(--gold-deep)", cursor: "pointer" }}>{t.contact_support}</span>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
