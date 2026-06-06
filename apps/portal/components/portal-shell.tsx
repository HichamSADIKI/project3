"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { LocaleSwitcher } from "./locale-switcher";
import { logout } from "@/lib/auth";

export interface NavItem {
  href: string;
  label: string;
}

export function PortalShell({
  locale,
  title,
  nav,
  logoutLabel,
  badgeLabel,
  variant,
  children,
}: {
  locale: string;
  title: string;
  nav: NavItem[];
  logoutLabel: string;
  /** Optionnel : pastille affichée sous le titre (ex. "Espace Client"). */
  badgeLabel?: string;
  /** Optionnel : accent coloré selon le profil ("client" | "fournisseur"). */
  variant?: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Ferme le drawer dès que la route change
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Évite le scroll de la page quand le drawer est ouvert (mobile)
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  async function onLogout() {
    await logout();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  return (
    <div className="sgi-shell">
      {open && (
        <div
          className="sgi-drawer-backdrop"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside className={`sgi-shell-aside${open ? " is-open" : ""}`}>
        <div
          style={{
            padding: "0 1.25rem 1.25rem",
            borderBottom: "1px solid var(--line-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <Link
            href={`/${locale}`}
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "1.2rem",
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            SGI <span style={{ color: "var(--gold)" }}>·</span> {title}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            style={{
              display: "none",
              width: 32,
              height: 32,
              alignItems: "center",
              justifyContent: "center",
              background: "transparent",
              border: "1px solid var(--line)",
              borderRadius: "var(--r-sm)",
              color: "var(--ink-2)",
              cursor: "pointer",
              fontSize: "1.1rem",
            }}
            className="sgi-aside-close"
          >
            ✕
          </button>
        </div>
        <nav
          style={{
            flex: 1,
            padding: "1rem 0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflowY: "auto",
          }}
        >
          {nav.map((item) => {
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "block",
                  padding: "0.625rem 0.875rem",
                  borderRadius: "var(--r)",
                  fontSize: "0.875rem",
                  fontWeight: active ? 600 : 500,
                  color: active ? "var(--gold-deep)" : "var(--ink-2)",
                  background: active ? "var(--gold-ghost)" : "transparent",
                }}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div
          style={{
            padding: "1rem 1.25rem",
            borderTop: "1px solid var(--line-soft)",
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
          }}
        >
          <LocaleSwitcher current={locale} />
          <button
            type="button"
            onClick={onLogout}
            className="sgi-button sgi-button-ghost"
            style={{ justifyContent: "flex-start", padding: "0.5rem 0.75rem" }}
          >
            {logoutLabel}
          </button>
        </div>
      </aside>

      <main className="sgi-shell-main">
        {/* Barre supérieure mobile uniquement (burger + titre) */}
        <div className="sgi-mobile-topbar">
          <button
            type="button"
            className="sgi-burger"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--ink)",
            }}
          >
            SGI <span style={{ color: "var(--gold)" }}>·</span> {title}
          </span>
        </div>

        {children}
      </main>
    </div>
  );
}
