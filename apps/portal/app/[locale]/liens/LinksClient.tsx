"use client";

import { useState } from "react";

export interface LinksLabels {
  demoAccounts: string;
  demoNote: string;
  backend: string;
  frontClient: string;
  frontServer: string;
  languages: string;
  open: string;
  copy: string;
  copied: string;
  demoClient: string;
  demoFournisseur: string;
}

interface LinkItem {
  label: string;
  url: string;
  method?: string;
  note?: string;
}

interface LinkSection {
  title: string;
  color: string;
  items: LinkItem[];
}

const PORTAL_ORIGIN =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3001";
const BACKEND_ORIGIN =
  process.env.NEXT_PUBLIC_API_PUBLIC_URL ?? "http://localhost:8000";
const WEB_ORIGIN =
  process.env.NEXT_PUBLIC_WEB_URL ?? "http://localhost:3000";

export function LinksClient({
  locale,
  labels,
}: {
  locale: string;
  labels: LinksLabels;
}) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* no-op */
    }
  }

  const portal = (path: string) => `${PORTAL_ORIGIN}/${locale}${path}`;
  const api = (path: string) => `${BACKEND_ORIGIN}${path}`;
  const web = (path: string) => `${WEB_ORIGIN}${path}`;

  const sections: LinkSection[] = [
    {
      title: labels.frontClient,
      color: "var(--azure)",
      items: [
        { label: "Accueil portal", url: portal("") },
        { label: "Connexion", url: portal("/login") },
        { label: "Inscription Client", url: portal("/register/client") },
        { label: "Inscription Fournisseur", url: portal("/register/fournisseur") },
        { label: "Dashboard Client", url: portal("/client"), note: "Requiert un compte client connecté" },
        { label: "Favoris Client", url: portal("/client/favorites") },
        { label: "Visites Client", url: portal("/client/visits") },
        { label: "Messages Client", url: portal("/client/messages") },
        { label: "Dashboard Fournisseur", url: portal("/fournisseur"), note: "Requiert un compte fournisseur connecté" },
        { label: "Mes soumissions", url: portal("/fournisseur/submissions") },
        { label: "Mes leads", url: portal("/fournisseur/leads") },
        { label: "Mes commissions", url: portal("/fournisseur/commissions") },
        { label: "Mes prestations", url: portal("/fournisseur/services") },
        { label: "Cette page (sitemap)", url: portal("/liens") },
      ],
    },
    {
      title: labels.frontServer,
      color: "var(--emerald)",
      items: [
        { label: "Backoffice racine (login)", url: web("/") },
        { label: "Validation inscriptions en attente", url: web("/pending-users"), note: "Requiert admin/manager/agent" },
        { label: "Dashboard agent (registry screens)", url: web("/?screen=dash") },
      ],
    },
    {
      title: labels.backend,
      color: "var(--gold-deep)",
      items: [
        { label: "Health", url: api("/health"), method: "GET" },
        { label: "Swagger UI", url: api("/docs"), note: "DEBUG=true requis" },
        { label: "OpenAPI JSON", url: api("/openapi.json") },
        { label: "Auth — Login", url: api("/api/v1/auth/login"), method: "POST" },
        { label: "Auth — Register Client", url: api("/api/v1/auth/register/client"), method: "POST" },
        { label: "Auth — Register Fournisseur", url: api("/api/v1/auth/register/fournisseur"), method: "POST" },
        { label: "Auth — Me", url: api("/api/v1/auth/me"), method: "GET" },
        { label: "Auth — Pending users (admin)", url: api("/api/v1/auth/pending-users"), method: "GET" },
        { label: "Client — Dashboard", url: api("/api/v1/client/dashboard"), method: "GET" },
        { label: "Client — Favoris", url: api("/api/v1/client/favorites"), method: "GET" },
        { label: "Client — Visites", url: api("/api/v1/client/visits"), method: "GET" },
        { label: "Client — Messages", url: api("/api/v1/client/messages"), method: "GET" },
        { label: "Fournisseur — Dashboard", url: api("/api/v1/fournisseur/dashboard"), method: "GET" },
        { label: "Fournisseur — Soumissions", url: api("/api/v1/fournisseur/submissions"), method: "GET" },
        { label: "Fournisseur — Leads", url: api("/api/v1/fournisseur/leads"), method: "GET" },
        { label: "Fournisseur — Commissions", url: api("/api/v1/fournisseur/commissions"), method: "GET" },
        { label: "Fournisseur — Services", url: api("/api/v1/fournisseur/services"), method: "GET" },
      ],
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
      <DemoCard labels={labels} />

      {sections.map((sec) => (
        <div key={sec.title} className="sgi-card">
          <h2
            style={{
              margin: "0 0 1rem",
              fontSize: "1.125rem",
              color: "var(--ink)",
              display: "flex",
              alignItems: "center",
              gap: "0.625rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: 4,
                background: sec.color,
              }}
            />
            {sec.title}
          </h2>
          <div className="sgi-table-wrap">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {sec.items.map((it) => (
                <tr key={it.url} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "0.625rem 0.5rem", color: "var(--ink)", fontSize: "0.9rem", minWidth: 200 }}>
                    {it.label}
                    {it.note && (
                      <div style={{ fontSize: "0.75rem", color: "var(--ink-3)", marginTop: 2 }}>
                        {it.note}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: "0.625rem 0.5rem" }}>
                    {it.method && (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "0.0625rem 0.5rem",
                          marginInlineEnd: "0.5rem",
                          background: "var(--bg-inset)",
                          color: "var(--ink-2)",
                          borderRadius: 4,
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          fontFamily: "monospace",
                        }}
                      >
                        {it.method}
                      </span>
                    )}
                    <code style={{ fontSize: "0.78rem", color: "var(--ink-2)", wordBreak: "break-all" }}>
                      {it.url}
                    </code>
                  </td>
                  <td style={{ padding: "0.625rem 0.5rem", textAlign: "end", whiteSpace: "nowrap" }}>
                    <button
                      type="button"
                      onClick={() => copy(it.url)}
                      className="sgi-button sgi-button-ghost"
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem", marginInlineEnd: "0.25rem" }}
                    >
                      {copied === it.url ? labels.copied : labels.copy}
                    </button>
                    <a
                      href={it.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sgi-button sgi-button-secondary"
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.625rem", display: "inline-block" }}
                    >
                      {labels.open}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      ))}

      <div
        style={{
          fontSize: "0.8rem",
          color: "var(--ink-3)",
          padding: "0.875rem 1rem",
          background: "var(--bg-inset)",
          borderRadius: "var(--r)",
          borderInlineStart: "3px solid var(--gold)",
        }}
      >
        <strong>{labels.languages}:</strong> /fr · /en · /ar (RTL)
      </div>
    </div>
  );
}

function DemoCard({ labels }: { labels: LinksLabels }) {
  const accounts = [
    {
      role: labels.demoClient,
      email: "demo-client@example.com",
      color: "var(--azure)",
    },
    {
      role: labels.demoFournisseur,
      email: "demo-partner@example.com",
      color: "var(--gold-deep)",
    },
  ];
  return (
    <div className="sgi-card" style={{ borderInlineStart: "3px solid var(--gold)" }}>
      <h2 style={{ margin: "0 0 0.5rem", fontSize: "1rem", color: "var(--ink)" }}>
        {labels.demoAccounts}
      </h2>
      <p style={{ margin: "0 0 1rem", fontSize: "0.85rem", color: "var(--ink-3)" }}>
        {labels.demoNote}
      </p>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        {accounts.map((a) => (
          <div
            key={a.email}
            style={{
              flex: "1 1 280px",
              padding: "0.875rem 1rem",
              border: "1px solid var(--line-soft)",
              borderRadius: "var(--r)",
              background: "var(--bg-paper)",
            }}
          >
            <div style={{ fontSize: "0.7rem", color: a.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              {a.role}
            </div>
            <code style={{ fontSize: "0.85rem", color: "var(--ink)", marginTop: 4, display: "block" }}>
              {a.email}
            </code>
          </div>
        ))}
      </div>
    </div>
  );
}
