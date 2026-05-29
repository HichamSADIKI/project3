"use client";

import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api";

export interface ClientMeProfile {
  id: string;
  type: "individual" | "company";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  phone2: string | null;
  nationality: string | null;
  country_of_residence: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_property_type: string | null;
  preferred_location: string | null;
  preferred_language: string;
}

interface Texts {
  sectionIdentity: string;
  sectionContact: string;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
  emailLocked: string;
  phone: string;
  phone2: string;
  nationality: string;
  countryOfResidence: string;
  submit: string;
  submitting: string;
  success: string;
  errorGeneric: string;
}

// Champs éditables par le client (la section « Préférences immobilières » a été
// retirée : budget / type de bien / quartier sont gérés côté back-office).
interface FormState {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  phone: string | null;
  phone2: string | null;
  nationality: string | null;
  country_of_residence: string | null;
  preferred_language: string;
}

function toForm(p: ClientMeProfile): FormState {
  return {
    first_name: p.first_name,
    last_name: p.last_name,
    company_name: p.company_name,
    phone: p.phone,
    phone2: p.phone2,
    nationality: p.nationality,
    country_of_residence: p.country_of_residence,
    preferred_language: p.preferred_language || "fr",
  };
}

const LANGUAGES: { value: string; label: string }[] = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

function langLabel(locale: string): string {
  return locale === "ar"
    ? "اللغة المفضّلة"
    : locale === "en"
      ? "Preferred language"
      : "Langue préférée";
}

export function ProfileForm({
  initial,
  texts,
  locale = "fr",
}: {
  initial: ClientMeProfile;
  texts: Texts;
  locale?: string;
}) {
  const [form, setForm] = useState<FormState>(toForm(initial));
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<
    { kind: "success" | "error"; message: string } | null
  >(null);
  const isCompany = initial.type === "company";

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(form)) {
        if (v === "" || v === null || v === undefined) continue;
        payload[k] = typeof v === "string" ? v.trim() : v;
      }
      const updated = await apiClient<ClientMeProfile>(
        "/api/proxy/client/me/profile",
        { method: "PATCH", json: payload },
      );
      setForm(toForm(updated));
      setFeedback({ kind: "success", message: texts.success });
    } catch (err) {
      const message =
        err instanceof ApiError ? err.detail : texts.errorGeneric;
      setFeedback({ kind: "error", message });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="sgi-grid-auto" style={{ gap: "1.25rem" }}>
      {/* Identité — adapté individu vs société */}
      <section className="sgi-card" style={{ gridColumn: "1 / -1" }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--ink)" }}>
          {texts.sectionIdentity}
        </h2>
        <div className="sgi-grid-auto-sm" style={{ gap: "0.75rem" }}>
          {!isCompany && (
            <>
              <Field
                label={texts.firstName}
                value={form.first_name ?? ""}
                onChange={(v) => setField("first_name", v)}
                autoComplete="given-name"
              />
              <Field
                label={texts.lastName}
                value={form.last_name ?? ""}
                onChange={(v) => setField("last_name", v)}
                autoComplete="family-name"
              />
            </>
          )}
          {isCompany && (
            <Field
              label={texts.companyName}
              value={form.company_name ?? ""}
              onChange={(v) => setField("company_name", v)}
              autoComplete="organization"
            />
          )}
        </div>
      </section>

      {/* Contact */}
      <section className="sgi-card" style={{ gridColumn: "1 / -1" }}>
        <h2 style={{ margin: "0 0 1rem", fontSize: "1rem", color: "var(--ink)" }}>
          {texts.sectionContact}
        </h2>
        <div className="sgi-grid-auto-sm" style={{ gap: "0.75rem" }}>
          <div>
            <label className="sgi-label">{texts.email}</label>
            <input
              className="sgi-input"
              type="email"
              value={initial.email ?? ""}
              disabled
              readOnly
            />
            <span
              style={{
                display: "block",
                marginTop: "0.25rem",
                fontSize: "0.75rem",
                color: "var(--ink-4)",
              }}
            >
              {texts.emailLocked}
            </span>
          </div>
          <Field
            label={texts.phone}
            value={form.phone ?? ""}
            onChange={(v) => setField("phone", v)}
            type="tel"
            autoComplete="tel"
          />
          <Field
            label={texts.phone2}
            value={form.phone2 ?? ""}
            onChange={(v) => setField("phone2", v)}
            type="tel"
          />
          <Field
            label={texts.nationality}
            value={form.nationality ?? ""}
            onChange={(v) => setField("nationality", v)}
          />
          <Field
            label={texts.countryOfResidence}
            value={form.country_of_residence ?? ""}
            onChange={(v) => setField("country_of_residence", v)}
            autoComplete="country-name"
          />
          {/* Langue préférée — appliquée au compte */}
          <div>
            <label className="sgi-label">{langLabel(locale)}</label>
            <select
              className="sgi-input"
              aria-label={langLabel(locale)}
              value={form.preferred_language}
              onChange={(e) => setField("preferred_language", e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {feedback && (
        <div
          className="sgi-card"
          style={{
            gridColumn: "1 / -1",
            background:
              feedback.kind === "success"
                ? "var(--mint-soft, #e6f7ee)"
                : "var(--rose-soft)",
            color:
              feedback.kind === "success"
                ? "var(--mint-deep, #0f7a48)"
                : "var(--rose)",
          }}
        >
          {feedback.message}
        </div>
      )}

      <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
        <button
          type="submit"
          className="sgi-button sgi-button-primary"
          disabled={submitting}
        >
          {submitting ? texts.submitting : texts.submit}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="sgi-label">{label}</label>
      <input
        className="sgi-input"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        placeholder={placeholder}
      />
    </div>
  );
}
