"use client";

import { useState } from "react";

export interface ContactFormLabels {
  title: string;
  subtitle: string;
  name: string;
  namePlaceholder: string;
  email: string;
  emailPlaceholder: string;
  phone: string;
  phonePlaceholder: string;
  message: string;
  messagePlaceholder: string;
  submit: string;
  submitting: string;
  success: string;
  error: string;
  validation: string;
}

/**
 * Formulaire de contact / demande de visite — Client Component.
 * POST → /api/public/lead (relai non authentifié vers le backend public).
 * Validation côté client (nom + téléphone OU email) doublée côté serveur.
 * RTL strict (CSS logique).
 */
export function ContactForm({
  labels,
  listingSlug,
}: {
  labels: ContactFormLabels;
  listingSlug?: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim() || (!phone.trim() && !email.trim())) {
      setError(labels.validation);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/public/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          message: message.trim() || undefined,
          listing_slug: listingSlug,
        }),
      });
      if (!res.ok) {
        setError(labels.error);
        return;
      }
      setSuccess(true);
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sgi-card" style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <h3 style={{ margin: "0 0 0.25rem", fontSize: "1.05rem", color: "var(--ink)" }}>{labels.title}</h3>
        <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--ink-3)" }}>{labels.subtitle}</p>
      </div>

      <div>
        <label className="sgi-label" htmlFor="cf-name">{labels.name}</label>
        <input
          id="cf-name"
          required
          maxLength={120}
          className="sgi-input"
          value={name}
          placeholder={labels.namePlaceholder}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}>
        <div>
          <label className="sgi-label" htmlFor="cf-phone">{labels.phone}</label>
          <input
            id="cf-phone"
            type="tel"
            maxLength={40}
            className="sgi-input"
            value={phone}
            placeholder={labels.phonePlaceholder}
            onChange={(e) => setPhone(e.target.value)}
          />
        </div>
        <div>
          <label className="sgi-label" htmlFor="cf-email">{labels.email}</label>
          <input
            id="cf-email"
            type="email"
            maxLength={254}
            className="sgi-input"
            value={email}
            placeholder={labels.emailPlaceholder}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
      </div>

      <div>
        <label className="sgi-label" htmlFor="cf-msg">{labels.message}</label>
        <textarea
          id="cf-msg"
          rows={4}
          maxLength={2000}
          className="sgi-input"
          value={message}
          placeholder={labels.messagePlaceholder}
          onChange={(e) => setMessage(e.target.value)}
        />
      </div>

      {error ? (
        <div role="alert" style={{ background: "var(--rose-soft)", color: "var(--rose)", padding: "0.625rem 0.875rem", borderRadius: "var(--r)", fontSize: "0.85rem" }}>
          {error}
        </div>
      ) : null}
      {success ? (
        <div role="status" style={{ background: "var(--emerald-soft)", color: "var(--emerald)", padding: "0.625rem 0.875rem", borderRadius: "var(--r)", fontSize: "0.85rem" }}>
          {labels.success}
        </div>
      ) : null}

      <button type="submit" disabled={loading} className="sgi-button sgi-button-primary">
        {loading ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
