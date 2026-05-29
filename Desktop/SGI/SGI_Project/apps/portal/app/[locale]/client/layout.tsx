import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

export default async function ClientLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("client", lc);
  const tc = makeT("common", lc);

  const nav = [
    { href: `/${lc}/client`, label: t("nav.dashboard") },
    { href: `/${lc}/client/nouveau-besoin`, label: t("nav.newNeed") },
    { href: `/${lc}/client/favorites`, label: t("nav.favorites") },
    { href: `/${lc}/client/visits`, label: t("nav.visits") },
    { href: `/${lc}/client/messages`, label: t("nav.messages") },
    { href: `/${lc}/client/profile`, label: t("nav.profile") },
  ];

  return (
    <PortalShell
      locale={lc}
      title={tc("shell.clientSpace")}
      badgeLabel={tc("shell.clientSpace")}
      variant="client"
      nav={nav}
      logoutLabel={tc("shell.logout")}
    >
      {children}
    </PortalShell>
  );
}
