import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

export default async function OwnerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("owner", lc);
  const tc = makeT("common", lc);

  const nav = [
    { href: `/${lc}/owner`, label: t("nav.dashboard") },
    { href: `/${lc}/owner/properties`, label: t("nav.properties") },
    { href: `/${lc}/owner/revenues`, label: t("nav.revenues") },
  ];

  return (
    <PortalShell
      locale={lc}
      title={t("dashboard.title")}
      badgeLabel={t("dashboard.title")}
      variant="client"
      nav={nav}
      logoutLabel={tc("shell.logout")}
    >
      {children}
    </PortalShell>
  );
}
