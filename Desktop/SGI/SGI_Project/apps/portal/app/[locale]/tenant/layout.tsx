import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("tenant", lc);
  const tc = makeT("common", lc);

  const nav = [
    { href: `/${lc}/tenant`, label: t("nav.dashboard") },
    { href: `/${lc}/tenant/payments`, label: t("nav.payments") },
    { href: `/${lc}/tenant/tickets`, label: t("nav.tickets") },
    { href: `/${lc}/tenant/chat`, label: t("nav.chat") },
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
