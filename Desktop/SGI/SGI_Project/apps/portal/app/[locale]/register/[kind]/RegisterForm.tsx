"use client";

import Link from "next/link";
import { useState } from "react";
import { register } from "@/lib/auth";

export interface RegisterFormLabels {
  fullName: string;
  email: string;
  password: string;
  passwordHint: string;
  companySlug: string;
  companySlugPlaceholder: string;
  submit: string;
  submitting: string;
  alreadyAccount: string;
  loginLink: string;
  success: { title: string; body: string; back: string };
  errors: {
    email_already_registered: string;
    company_not_found: string;
    generic: string;
  };
}

export function RegisterForm({
  kind,
  locale,
  labels,
}: {
  kind: "client" | "fournisseur";
  locale: string;
  labels: RegisterFormLabels;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companySlug, setCompanySlug] = useState(
    process.env.NEXT_PUBLIC_DEFAULT_COMPANY_SLUG ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(kind, {
        email,
        password,
        full_name: fullName,
        company_slug: companySlug,
      });
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
          {labels.success.body}
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
      <div>
        <label className="sgi-label" htmlFor="fullName">{labels.fullName}</label>
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
