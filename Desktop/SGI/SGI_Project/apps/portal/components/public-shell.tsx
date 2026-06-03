import type { ReactNode } from "react";
import Link from "next/link";
import { LocaleSwitcher } from "./locale-switcher";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

export function PublicShell({
  locale,
  children,
}: {
  locale: string;
  children: ReactNode;
}) {
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("common", lc);
  const tr = makeT("realestate", lc);

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header className="sgi-public-header">
        <Link
          href={`/${lc}`}
          style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: "clamp(1.15rem, 3vw, 1.4rem)",
            fontWeight: 700,
            color: "var(--ink)",
            letterSpacing: "0.02em",
          }}
        >
          {t("brand.name")} <span style={{ color: "var(--gold)" }}>·</span>{" "}
          {t("brand.tagline")}
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: "1.25rem", flexWrap: "wrap" }}>
          <Link href={`/${lc}/properties`} style={{ fontSize: "0.875rem", color: "var(--ink-2)", fontWeight: 500 }}>
            {tr("nav.properties")}
          </Link>
          <Link href={`/${lc}/agents`} style={{ fontSize: "0.875rem", color: "var(--ink-2)", fontWeight: 500 }}>
            {tr("agents.title")}
          </Link>
          <Link
            href={`/${lc}/login`}
            style={{ fontSize: "0.875rem", color: "var(--ink-2)", fontWeight: 500 }}
          >
            {t("header.login")}
          </Link>
          <LocaleSwitcher current={lc} />
        </nav>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
      <footer
        style={{
          padding: "1.25rem var(--page-px)",
          background: "var(--surface-3)",
          borderTop: "1px solid var(--line-soft)",
          fontSize: "0.78rem",
          color: "var(--ink-3)",
          textAlign: "center",
          lineHeight: 1.5,
        }}
      >
        {t("footer.copyright", { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}
