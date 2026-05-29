"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type CSSProperties } from "react";
import { login } from "@/lib/auth";
import { useTheme } from "@/components/theme-provider";

type ProfileKind = "client" | "fournisseur";

export interface LoginFormLabels {
  title: string;
  subtitle: string;
  email: string;
  password: string;
  submit: string;
  submitting: string;
  becomeClient: string;
  becomeFournisseur: string;
  developedBy: string;
  versionLabel: string;
  callCenter: string;
  needHelp: string;
  callUs: string;
  available247: string;
  callAction: string;
  whatsappAction: string;
  followUs: string;
  snapchatAction: string;
  instagramAction: string;
  demoTitle: string;
  demoClient: string;
  demoFournisseur: string;
  profileTitle: string;
  profileSubtitle: string;
  profileClient: string;
  profileClientDesc: string;
  profileFournisseur: string;
  profileFournisseurDesc: string;
  back: string;
  companySlug: string;
  companySlugPlaceholder: string;
  companySlugHint: string;
  brand: string;
  tagline: string;
  errors: {
    invalid_credentials: string;
    account_not_active: string;
    use_backoffice_portal: string;
    company_required: string;
    company_mismatch: string;
    generic: string;
  };
}

const DEMO_CLIENT_EMAIL =
  process.env.NEXT_PUBLIC_DEMO_CLIENT_EMAIL ?? "demo-client@example.com";
const DEMO_CLIENT_PASSWORD =
  process.env.NEXT_PUBLIC_DEMO_CLIENT_PASSWORD ?? "DemoPass!23";
const DEMO_FOURNISSEUR_EMAIL =
  process.env.NEXT_PUBLIC_DEMO_FOURNISSEUR_EMAIL ?? "demo-partner@example.com";
const DEMO_FOURNISSEUR_PASSWORD =
  process.env.NEXT_PUBLIC_DEMO_FOURNISSEUR_PASSWORD ?? "DemoPass!23";
const DEMO_COMPANY_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_SLUG ?? "infinity-uae";

const SUPPORT_PHONE_TEL = process.env.NEXT_PUBLIC_SUPPORT_PHONE ?? "8002000";
const SUPPORT_PHONE_DISPLAY =
  process.env.NEXT_PUBLIC_SUPPORT_PHONE_DISPLAY ?? "800 2000";
const SUPPORT_WHATSAPP_E164 =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "971500000000";
const SUPPORT_WHATSAPP_DISPLAY =
  process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_DISPLAY ?? "+971 50 000 0000";
const SUPPORT_SNAPCHAT_HANDLE =
  process.env.NEXT_PUBLIC_SUPPORT_SNAPCHAT ?? "infinity.uae";
const SUPPORT_INSTAGRAM_HANDLE =
  process.env.NEXT_PUBLIC_SUPPORT_INSTAGRAM ?? "infinity.uae";

const LOCALES: { code: "ar" | "en" | "fr"; flag: string; label: string }[] = [
  { code: "ar", flag: "🇦🇪", label: "العربية" },
  { code: "en", flag: "🇬🇧", label: "English" },
  { code: "fr", flag: "🇫🇷", label: "Français" },
];

const labelStyle: CSSProperties = {
  display: "block",
  fontSize: 11.5,
  letterSpacing: "0.06em",
  color: "var(--ink-3)",
  textTransform: "uppercase",
  fontWeight: 500,
  marginBottom: 6,
};

const inputStyle: CSSProperties = {
  height: 46,
  padding: "0 14px",
  width: "100%",
  boxSizing: "border-box",
  background: "var(--bg-ivory)",
  border: "1px solid var(--line)",
  borderRadius: "var(--r)",
  fontSize: 14,
  color: "var(--ink)",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color var(--transition-base), background-color var(--transition-base)",
};

/* ─── Background geometric pattern ──────────────────────────────────── */
function BgPattern() {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity: 0.05,
        pointerEvents: "none",
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="sgi-geo" x="0" y="0" width="60" height="60" patternUnits="userSpaceOnUse">
          <rect x="0" y="0" width="60" height="60" fill="none" />
          <line x1="0" y1="30" x2="60" y2="30" stroke="var(--gold)" strokeWidth="0.5" />
          <line x1="30" y1="0" x2="30" y2="60" stroke="var(--gold)" strokeWidth="0.5" />
          <circle cx="30" cy="30" r="1.5" fill="var(--gold)" />
          <circle cx="0" cy="0" r="1" fill="var(--gold)" />
          <circle cx="60" cy="0" r="1" fill="var(--gold)" />
          <circle cx="0" cy="60" r="1" fill="var(--gold)" />
          <circle cx="60" cy="60" r="1" fill="var(--gold)" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#sgi-geo)" />
    </svg>
  );
}

/* ─── Language switcher ──────────────────────────────────────────────── */
function LangSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(target: string) {
    if (target === current) return;
    const next = pathname.replace(/^\/[a-z]{2}/, `/${target}`);
    router.push(next);
  }

  return (
    <div style={{ display: "flex", justifyContent: "center", gap: 6 }}>
      {LOCALES.map((o) => {
        const active = current === o.code;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => switchTo(o.code)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "5px 10px",
              borderRadius: "var(--r-sm)",
              fontSize: 11.5,
              fontWeight: active ? 600 : 400,
              border: "1px solid",
              borderColor: active ? "var(--gold)" : "var(--line-soft)",
              background: active ? "var(--gold-ghost)" : "transparent",
              color: active ? "var(--gold-deep)" : "var(--ink-3)",
              cursor: "pointer",
              transition: "all 0.15s",
            }}
          >
            <span>{o.flag}</span>
            <span className={o.code === "ar" ? "font-ar" : undefined}>{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ─── Theme toggle (sun / moon) ──────────────────────────────────────── */
function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{
        position: "absolute",
        top: 12,
        insetInlineEnd: 12,
        width: 34,
        height: 34,
        borderRadius: "var(--r-full)",
        background: "var(--bg-ivory)",
        border: "1px solid var(--line-soft)",
        color: "var(--ink-2)",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        transition: "all var(--transition-base)",
      }}
    >
      {isDark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

/* ─── Wordmark (brand) ───────────────────────────────────────────────── */
function Wordmark({ brand }: { brand: string }) {
  return (
    <div
      className="font-display"
      style={{
        fontSize: 28,
        fontWeight: 700,
        color: "var(--ink)",
        letterSpacing: "0.02em",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {brand}
      <span style={{ color: "var(--gold)" }}>·</span>
    </div>
  );
}

/* ─── Main login screen ──────────────────────────────────────────────── */
export function LoginForm({
  locale,
  version,
  labels,
}: {
  locale: string;
  version: string;
  labels: LoginFormLabels;
}) {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileKind | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function pickProfile(kind: ProfileKind) {
    setProfile(kind);
    setError(null);
    if (kind === "client") {
      setEmail(DEMO_CLIENT_EMAIL);
      setPassword(DEMO_CLIENT_PASSWORD);
      setCompanySlug("");
    } else {
      setEmail(DEMO_FOURNISSEUR_EMAIL);
      setPassword(DEMO_FOURNISSEUR_PASSWORD);
      setCompanySlug(DEMO_COMPANY_SLUG);
    }
  }

  function back() {
    setProfile(null);
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const slug =
        profile === "fournisseur" ? companySlug : companySlug || undefined;
      const res = await login(email, password, slug);
      const target = res.language ?? locale;
      router.push(`/${target}${res.redirect}`);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "generic";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function renderError(code: string | null): string | null {
    if (!code) return null;
    if (code === "invalid_credentials") return labels.errors.invalid_credentials;
    if (code === "account_not_active") return labels.errors.account_not_active;
    if (code === "use_backoffice_portal") return labels.errors.use_backoffice_portal;
    if (code === "company_required") return labels.errors.company_required;
    if (code === "company_mismatch") return labels.errors.company_mismatch;
    return labels.errors.generic;
  }

  const isFournisseur = profile === "fournisseur";

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--bg-base)",
        color: "var(--ink)",
        position: "relative",
        overflow: "hidden",
        padding: "1.5rem",
      }}
    >
      <BgPattern />

      {/* Centered card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          width: "min(440px, 100%)",
          padding: "clamp(28px, 5vw, 40px)",
          background: "var(--bg-paper)",
          border: "1px solid var(--line-soft)",
          borderRadius: 16,
          boxShadow: "var(--shadow-3)",
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}
      >
        <ThemeToggle />

        {/* Header */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
            marginBottom: 18,
          }}
        >
          <Wordmark brand={labels.brand} />
          <div
            style={{
              fontSize: 11,
              color: "var(--ink-4)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {labels.tagline}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <LangSwitcher current={locale} />
        </div>

        <div
          style={{
            height: 1,
            background: "var(--line-soft)",
            marginBottom: 24,
          }}
        />

        {/* Title + subtitle */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div
            className={locale === "ar" ? "font-ar" : "font-display"}
            style={{ fontSize: 26, lineHeight: 1.2, color: "var(--ink)", fontWeight: 600 }}
          >
            {labels.title}
          </div>
          <div style={{ fontSize: 13, color: "var(--ink-3)", marginTop: 6 }}>
            {labels.subtitle}
          </div>
        </div>

        {/* Step 1 — profile selection */}
        {!profile && (
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 600,
                  color: "var(--ink)",
                  marginBottom: 4,
                }}
              >
                {labels.profileTitle}
              </div>
              <div style={{ fontSize: "0.82rem", color: "var(--ink-3)" }}>
                {labels.profileSubtitle}
              </div>
            </div>
            <ProfileCard
              icon="👤"
              title={labels.profileClient}
              description={labels.profileClientDesc}
              onClick={() => pickProfile("client")}
            />
            <ProfileCard
              icon="🤝"
              title={labels.profileFournisseur}
              description={labels.profileFournisseurDesc}
              onClick={() => pickProfile("fournisseur")}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 12,
                marginTop: 8,
                paddingTop: 16,
                borderTop: "1px solid var(--line-soft)",
                color: "var(--ink-4)",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              <Link
                href={`/${locale}/register/client`}
                style={{ color: "var(--gold-deep)", fontWeight: 500 }}
              >
                {labels.becomeClient}
              </Link>
              <Link
                href={`/${locale}/register/fournisseur`}
                style={{ color: "var(--gold-deep)", fontWeight: 500 }}
              >
                {labels.becomeFournisseur}
              </Link>
            </div>

          </div>
        )}

        {/* Step 2 — login form */}
        {profile && (
          <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.5rem 0.75rem",
                background: "var(--gold-ghost)",
                border: "1px solid var(--gold-line)",
                borderRadius: "var(--r)",
                fontSize: "0.85rem",
              }}
            >
              <span style={{ color: "var(--gold-deep)", fontWeight: 600 }}>
                {isFournisseur ? labels.profileFournisseur : labels.profileClient}
              </span>
              <button
                type="button"
                onClick={back}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--gold-deep)",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {labels.back}
              </button>
            </div>

            <div>
              <label htmlFor="email" style={labelStyle}>{labels.email}</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ ...inputStyle, borderColor: error ? "var(--rose)" : "var(--line)" }}
              />
            </div>

            <div>
              <label htmlFor="password" style={labelStyle}>{labels.password}</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ ...inputStyle, borderColor: error ? "var(--rose)" : "var(--line)" }}
              />
            </div>

            {isFournisseur && (
              <div>
                <label htmlFor="companySlug" style={labelStyle}>{labels.companySlug}</label>
                <input
                  id="companySlug"
                  type="text"
                  required
                  minLength={2}
                  maxLength={100}
                  value={companySlug}
                  onChange={(e) => setCompanySlug(e.target.value)}
                  placeholder={labels.companySlugPlaceholder}
                  style={inputStyle}
                />
                <small
                  style={{
                    display: "block",
                    marginTop: 6,
                    color: "var(--ink-4)",
                    fontSize: "0.72rem",
                    lineHeight: 1.5,
                  }}
                >
                  {labels.companySlugHint}
                </small>
              </div>
            )}

            {error && (
              <div
                role="alert"
                style={{
                  padding: "10px 14px",
                  background: "var(--rose-soft)",
                  border: "1px solid var(--rose)",
                  borderRadius: "var(--r)",
                  fontSize: 12,
                  color: "var(--rose)",
                  lineHeight: 1.5,
                }}
              >
                {renderError(error)}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="sgi-button sgi-button-primary"
              style={{
                height: 48,
                fontSize: 13.5,
                letterSpacing: "0.04em",
                opacity: loading ? 0.7 : 1,
                width: "100%",
              }}
            >
              {loading ? labels.submitting : labels.submit}
            </button>

            <div
              style={{
                marginTop: 8,
                paddingTop: 16,
                borderTop: "1px solid var(--line-soft)",
                fontSize: 12,
                color: "var(--ink-4)",
                textAlign: "center",
              }}
            >
              <Link
                href={`/${locale}/register/${isFournisseur ? "fournisseur" : "client"}`}
                style={{ color: "var(--gold-deep)", fontWeight: 500 }}
              >
                {isFournisseur ? labels.becomeFournisseur : labels.becomeClient}
              </Link>
            </div>
          </form>
        )}

        {/* Help card — call + WhatsApp + socials */}
        <HelpCard
          locale={locale}
          phoneTel={SUPPORT_PHONE_TEL}
          phoneDisplay={SUPPORT_PHONE_DISPLAY}
          whatsappE164={SUPPORT_WHATSAPP_E164}
          whatsappDisplay={SUPPORT_WHATSAPP_DISPLAY}
          snapchatHandle={SUPPORT_SNAPCHAT_HANDLE}
          instagramHandle={SUPPORT_INSTAGRAM_HANDLE}
          needHelp={labels.needHelp}
          available247={labels.available247}
          callAction={labels.callAction}
          whatsappAction={labels.whatsappAction}
          followUs={labels.followUs}
          snapchatAction={labels.snapchatAction}
          instagramAction={labels.instagramAction}
        />

        {/* Footer — credits + version */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 14,
            borderTop: "1px solid var(--line-soft)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
            fontSize: 11,
            color: "var(--ink-4)",
            letterSpacing: "0.04em",
          }}
        >
          <span>{labels.developedBy}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {labels.versionLabel} {version}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Help card — call + WhatsApp + socials ──────────────────────────── */
function HelpCard({
  locale,
  phoneTel,
  phoneDisplay,
  whatsappE164,
  whatsappDisplay,
  snapchatHandle,
  instagramHandle,
  needHelp,
  available247,
  callAction,
  whatsappAction,
  followUs,
  snapchatAction,
  instagramAction,
}: {
  locale: string;
  phoneTel: string;
  phoneDisplay: string;
  whatsappE164: string;
  whatsappDisplay: string;
  snapchatHandle: string;
  instagramHandle: string;
  needHelp: string;
  available247: string;
  callAction: string;
  whatsappAction: string;
  followUs: string;
  snapchatAction: string;
  instagramAction: string;
}) {
  const isAr = locale === "ar";
  return (
    <div
      style={{
        marginTop: 20,
        padding: "14px 14px 12px",
        background:
          "linear-gradient(135deg, var(--gold-ghost) 0%, var(--bg-ivory) 100%)",
        border: "1px solid var(--gold-line)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow-1)",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--gold-deep)",
          }}
        >
          {needHelp}
        </div>
        <div style={{ fontSize: 10.5, color: "var(--ink-3)" }}>{available247}</div>
      </div>

      {/* Two CTAs */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 8,
        }}
      >
        <ContactAction
          href={`tel:${phoneTel}`}
          variant="call"
          label={callAction}
          value={phoneDisplay}
          isAr={isAr}
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
            </svg>
          }
        />
        <ContactAction
          href={`https://wa.me/${whatsappE164}`}
          variant="whatsapp"
          label={whatsappAction}
          value={whatsappDisplay}
          isAr={isAr}
          external
          icon={
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.296-.767.966-.94 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347zM12.05 21.785h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884zm8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          }
        />
      </div>

      {/* Social — Snapchat + Instagram */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 2,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            color: "var(--ink-3)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            fontWeight: 500,
            whiteSpace: "nowrap",
          }}
        >
          {followUs}
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--gold-line)" }} />
        <SocialPill
          href={`https://www.snapchat.com/add/${snapchatHandle}`}
          aria-label={`${snapchatAction} @${snapchatHandle}`}
          background="#FFFC00"
          color="#000"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12.166.038c-2.286.05-4.43.99-5.846 2.793-1.36 1.731-1.5 3.918-1.45 5.402.034.95.067 1.901-.084 2.137-.18.28-.91.36-1.49.36-.5 0-.83.123-.85.31-.02.21.31.36.71.482.4.12.95.32 1.35.65 1.07.89.4 2.65-1.17 4.4-.51.56-1.16 1.05-1.85 1.4-.06.04-.13.07-.2.1-.21.1-.43.21-.43.4 0 .15.11.27.32.36.59.26 1.95.39 2.9.39.18 0 .35-.01.5-.03.21-.03.27.16.31.34.04.21.16.43.41.45.05 0 .49.02 1.03-.07.42-.07 1.04-.13 1.78-.13 1.18 0 2.32.13 3.23.81.78.59 2.45 1.05 3.31 1.05.81 0 1.62-.4 2.16-.79.42-.31.79-.5.97-.5.07 0 .17-.01.3-.01.36 0 .76-.04 1.16-.13.5-.11 1.23-.37 1.23-.79 0-.19-.21-.3-.43-.4-.07-.03-.14-.06-.2-.1-.69-.35-1.34-.84-1.85-1.4-1.57-1.75-2.24-3.51-1.17-4.4.4-.33.95-.53 1.35-.65.4-.12.73-.27.71-.48-.02-.19-.35-.31-.85-.31-.58 0-1.31-.08-1.49-.36-.15-.24-.12-1.19-.08-2.14.05-1.48-.09-3.67-1.45-5.4C16.6 1.03 14.456.087 12.17.037l-.004.001z" />
            </svg>
          }
        >
          {snapchatAction}
        </SocialPill>
        <SocialPill
          href={`https://www.instagram.com/${instagramHandle}/`}
          aria-label={`${instagramAction} @${instagramHandle}`}
          background="linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)"
          color="#fff"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98C.014 8.333 0 8.741 0 12s.014 3.668.072 4.948c.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24s3.668-.014 4.948-.072c4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
            </svg>
          }
        >
          {instagramAction}
        </SocialPill>
      </div>

      <style>{`
        .sgi-help-action {
          transition: transform var(--transition-base), box-shadow var(--transition-base), filter var(--transition-base);
        }
        .sgi-help-action:hover {
          transform: translateY(-1px);
          box-shadow: var(--shadow-2);
          filter: brightness(1.04);
        }
        .sgi-social-pill {
          transition: transform var(--transition-base), box-shadow var(--transition-base), filter var(--transition-base);
        }
        .sgi-social-pill:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(0,0,0,0.15);
          filter: brightness(1.05);
        }
      `}</style>
    </div>
  );
}

function SocialPill({
  href,
  background,
  color,
  icon,
  children,
  "aria-label": ariaLabel,
}: {
  href: string;
  background: string;
  color: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  "aria-label": string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      className="sgi-social-pill"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        background,
        color,
        borderRadius: "var(--r-full)",
        textDecoration: "none",
        fontSize: 11.5,
        fontWeight: 600,
        boxShadow: "0 2px 5px rgba(0,0,0,0.08)",
      }}
    >
      {icon}
      <span>{children}</span>
    </a>
  );
}

function ContactAction({
  href,
  variant,
  label,
  value,
  isAr,
  icon,
  external,
}: {
  href: string;
  variant: "call" | "whatsapp";
  label: string;
  value: string;
  isAr: boolean;
  icon: React.ReactNode;
  external?: boolean;
}) {
  const isCall = variant === "call";
  const bg = isCall ? "var(--gold)" : "#25D366";
  const fg = "#fff";
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      aria-label={`${label} ${value}`}
      className="sgi-help-action"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 12px",
        background: bg,
        color: fg,
        borderRadius: "var(--r)",
        textDecoration: "none",
        boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
        minWidth: 0,
      }}
    >
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.18)",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <span
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          lineHeight: 1.15,
        }}
      >
        <span
          style={{
            fontSize: 10.5,
            opacity: 0.85,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <span
          className={isAr ? "font-ar" : undefined}
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            fontVariantNumeric: "tabular-nums",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            direction: "ltr",
          }}
        >
          {value}
        </span>
      </span>
    </a>
  );
}

/* ─── Profile card ───────────────────────────────────────────────────── */
function ProfileCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "start",
        background: "var(--bg-ivory)",
        border: "1px solid var(--line)",
        borderRadius: "var(--r-md)",
        padding: "1rem 1.1rem",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: "1rem",
        transition: "all var(--transition-base)",
        color: "var(--ink)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--gold)";
        e.currentTarget.style.background = "var(--gold-ghost)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--line)";
        e.currentTarget.style.background = "var(--bg-ivory)";
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          background: "var(--gold-ghost)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "1.4rem",
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--ink)" }}>
          {title}
        </div>
        <div
          style={{
            fontSize: "0.78rem",
            color: "var(--ink-3)",
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      </div>
      <div
        style={{
          color: "var(--gold-deep)",
          fontSize: "1.2rem",
          fontWeight: 700,
        }}
      >
        →
      </div>
    </button>
  );
}
