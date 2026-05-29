"use client";

import Link from "next/link";
import { useState } from "react";
import { register } from "@/lib/auth";

type ClientType = "person" | "company";

export interface RegisterFormLabels {
  fullName: string;
  companyName: string;
  email: string;
  password: string;
  passwordHint: string;
  companySlug: string;
  companySlugPlaceholder: string;
  clientTypeLabel: string;
  clientTypePerson: string;
  clientTypeCompany: string;
  trn: string;
  trnPlaceholder: string;
  trnHint: string;
  address: string;
  addressPlaceholder: string;
  addressHint: string;
  categoryLabel: string;
  categoryHint: string;
  categoryPlaceholder: string;
  license: string;
  licenseHint: string;
  vendorTypes: Record<string, string>;
  submit: string;
  submitting: string;
  alreadyAccount: string;
  loginLink: string;
  success: { title: string; body: string; back: string };
  errors: {
    email_already_registered: string;
    company_not_found: string;
    invalid_vendor_type: string;
    invalid_license: string;
    generic: string;
  };
}

// Ordre d'affichage des catégories prestataire (aligné sur VendorType backend).
const VENDOR_TYPE_ORDER = [
  "maintenance",
  "cleaning",
  "security",
  "landscaping",
  "pest_control",
  "elevator",
  "moving",
  "hvac",
  "electrical",
  "plumbing",
  "other",
] as const;

const DEFAULT_CLIENT_COMPANY_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_COMPANY_SLUG ?? "infinity-uae";

export function RegisterForm({
  kind,
  locale,
  labels,
}: {
  kind: "client" | "fournisseur";
  locale: string;
  labels: RegisterFormLabels;
}) {
  const isClient = kind === "client";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companySlug, setCompanySlug] = useState(
    isClient ? DEFAULT_CLIENT_COMPANY_SLUG : DEFAULT_CLIENT_COMPANY_SLUG,
  );
  const [clientType, setClientType] = useState<ClientType>("person");
  const [trn, setTrn] = useState("");
  const [address, setAddress] = useState("");
  const [vendorType, setVendorType] = useState("");
  const [licenseFile, setLicenseFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showCompanyFields = isClient && clientType === "company";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isClient) {
        await register(kind, {
          email,
          password,
          full_name: fullName,
          company_slug: companySlug,
          client_type: clientType,
          ...(address.trim() ? { address: address.trim() } : {}),
          ...(clientType === "company" && trn.trim() ? { trn: trn.trim() } : {}),
        });
      } else {
        // Fournisseur : inscription multipart (compte + profil + licence).
        if (!licenseFile) {
          setError("invalid_license");
          return;
        }
        const fd = new FormData();
        fd.append("email", email);
        fd.append("password", password);
        fd.append("full_name", fullName);
        fd.append("company_slug", companySlug);
        fd.append("vendor_type", vendorType);
        fd.append("preferred_language", locale);
        fd.append("commercial_license", licenseFile);
        const res = await fetch("/api/auth/register/fournisseur-profile", {
          method: "POST",
          body: fd,
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? "generic");
        }
      }
      setSubmitted(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "generic";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function renderError(code: string | null): string | null {
    if (!code) return null;
    if (code === "email_already_registered")
      return labels.errors.email_already_registered;
    if (code === "company_not_found") return labels.errors.company_not_found;
    if (code === "invalid_vendor_type") return labels.errors.invalid_vendor_type;
    if (
      code === "invalid_license" ||
      code === "unsupported_license_type" ||
      code === "empty_license_file" ||
      code === "license_too_large"
    )
      return labels.errors.invalid_license;
    return labels.errors.generic;
  }

  if (submitted) {
    return (
      <div style={{ textAlign: "center" }}>
        <div
          style={{
            display: "inline-flex",
            width: 56,
            height: 56,
            borderRadius: "50%",
            background: "var(--emerald-soft)",
            color: "var(--emerald)",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "1.5rem",
            marginBottom: "1rem",
          }}
        >
          ✓
        </div>
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.25rem", color: "var(--ink)" }}>
          {labels.success.title}
        </h2>
        <p style={{ color: "var(--ink-3)", fontSize: "0.9rem", lineHeight: 1.55 }}>
          {isClient
            ? {
                fr: "Votre compte est actif. Vous pouvez vous connecter dès maintenant.",
                en: "Your account is active. You can log in right now.",
                ar: "حسابك مُفعّل. يمكنك تسجيل الدخول الآن.",
              }[locale]
            : labels.success.body}
        </p>
        <Link
          href={`/${locale}/login`}
          className="sgi-button sgi-button-secondary"
          style={{ marginTop: "1.5rem" }}
        >
          {labels.success.back}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {isClient && (
        <div>
          <span
            className="sgi-label"
            style={{ display: "block", marginBottom: 8 }}
          >
            {labels.clientTypeLabel}
          </span>
          <div
            role="radiogroup"
            aria-label={labels.clientTypeLabel}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              padding: 4,
              background: "var(--bg-ivory)",
              border: "1px solid var(--line)",
              borderRadius: "var(--r)",
            }}
          >
            <ClientTypeOption
              active={clientType === "person"}
              onClick={() => setClientType("person")}
              icon="👤"
              label={labels.clientTypePerson}
            />
            <ClientTypeOption
              active={clientType === "company"}
              onClick={() => setClientType("company")}
              icon="🏢"
              label={labels.clientTypeCompany}
            />
          </div>
        </div>
      )}

      <div>
        <label className="sgi-label" htmlFor="fullName">
          {showCompanyFields ? labels.companyName : labels.fullName}
        </label>
        <input
          id="fullName"
          type="text"
          required
          minLength={2}
          maxLength={255}
          className="sgi-input"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
        />
      </div>

      {showCompanyFields && (
        <div>
          <label className="sgi-label" htmlFor="trn">{labels.trn}</label>
          <input
            id="trn"
            type="text"
            inputMode="numeric"
            pattern="[0-9 ]*"
            maxLength={20}
            className="sgi-input"
            value={trn}
            onChange={(e) => setTrn(e.target.value)}
            placeholder={labels.trnPlaceholder}
          />
          <small
            style={{
              display: "block",
              marginTop: 6,
              color: "var(--ink-3)",
              fontSize: "0.75rem",
            }}
          >
            {labels.trnHint}
          </small>
        </div>
      )}

      {isClient && (
        <div>
          <label className="sgi-label" htmlFor="address">{labels.address}</label>
          <textarea
            id="address"
            className="sgi-input"
            rows={2}
            maxLength={500}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder={labels.addressPlaceholder}
            style={{ resize: "vertical", minHeight: 64, fontFamily: "inherit" }}
          />
          <small
            style={{
              display: "block",
              marginTop: 6,
              color: "var(--ink-3)",
              fontSize: "0.75rem",
            }}
          >
            {labels.addressHint}
          </small>
        </div>
      )}

      <div>
        <label className="sgi-label" htmlFor="email">{labels.email}</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className="sgi-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label className="sgi-label" htmlFor="password">{labels.password}</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="sgi-input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <small style={{ display: "block", marginTop: 6, color: "var(--ink-3)", fontSize: "0.75rem" }}>
          {labels.passwordHint}
        </small>
      </div>

      {!isClient && (
        <div>
          <label className="sgi-label" htmlFor="companySlug">{labels.companySlug}</label>
          <input
            id="companySlug"
            type="text"
            required
            minLength={2}
            maxLength={100}
            className="sgi-input"
            value={companySlug}
            onChange={(e) => setCompanySlug(e.target.value)}
            placeholder={labels.companySlugPlaceholder}
          />
        </div>
      )}

      {!isClient && (
        <div>
          <label className="sgi-label" htmlFor="vendorType">
            {labels.categoryLabel}
          </label>
          <select
            id="vendorType"
            required
            className="sgi-input"
            value={vendorType}
            onChange={(e) => setVendorType(e.target.value)}
          >
            <option value="" disabled>
              {labels.categoryPlaceholder}
            </option>
            {VENDOR_TYPE_ORDER.map((vt) => (
              <option key={vt} value={vt}>
                {labels.vendorTypes[vt] ?? vt}
              </option>
            ))}
          </select>
          <small
            style={{
              display: "block",
              marginTop: 6,
              color: "var(--ink-3)",
              fontSize: "0.75rem",
            }}
          >
            {labels.categoryHint}
          </small>
        </div>
      )}

      {!isClient && (
        <div>
          <label className="sgi-label" htmlFor="commercialLicense">
            {labels.license}
          </label>
          <input
            id="commercialLicense"
            type="file"
            required
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="sgi-input"
            onChange={(e) => setLicenseFile(e.target.files?.[0] ?? null)}
            style={{ padding: "0.5rem" }}
          />
          <small
            style={{
              display: "block",
              marginTop: 6,
              color: "var(--ink-3)",
              fontSize: "0.75rem",
            }}
          >
            {labels.licenseHint}
          </small>
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{
            background: "var(--rose-soft)",
            color: "var(--rose)",
            padding: "0.625rem 0.875rem",
            borderRadius: "var(--r)",
            fontSize: "0.8rem",
          }}
        >
          {renderError(error)}
        </div>
      )}
      <button type="submit" disabled={loading} className="sgi-button sgi-button-primary">
        {loading ? labels.submitting : labels.submit}
      </button>
      <div style={{ fontSize: "0.85rem", textAlign: "center", marginTop: "0.25rem" }}>
        {labels.alreadyAccount}{" "}
        <Link href={`/${locale}/login`} style={{ color: "var(--gold-deep)", fontWeight: 500 }}>
          {labels.loginLink}
        </Link>
      </div>
    </form>
  );
}

function ClientTypeOption({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active ? "true" : "false"}
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        padding: "0.55rem 0.75rem",
        background: active ? "var(--bg-paper)" : "transparent",
        border: "1px solid",
        borderColor: active ? "var(--gold)" : "transparent",
        borderRadius: "var(--r-sm)",
        color: active ? "var(--ink)" : "var(--ink-3)",
        fontSize: "0.875rem",
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        boxShadow: active ? "var(--shadow-1)" : "none",
        transition: "all var(--transition-base)",
      }}
    >
      <span aria-hidden="true" style={{ fontSize: "1.05rem" }}>
        {icon}
      </span>
      <span>{label}</span>
    </button>
  );
}
