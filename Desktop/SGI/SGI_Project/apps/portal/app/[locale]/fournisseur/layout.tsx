import type { ReactNode } from "react";
import { PortalShell } from "@/components/portal-shell";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

export default async function FournisseurLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("fournisseur", lc);
  const tc = makeT("common", lc);

  const nav = [
    { href: `/${lc}/fournisseur`, label: t("nav.dashboard") },
    { href: `/${lc}/fournisseur/profile`, label: t("nav.profile") },
    { href: `/${lc}/fournisseur/documents`, label: t("nav.documents") },
    { href: `/${lc}/fournisseur/missions`, label: t("nav.missions") },
    { href: `/${lc}/fournisseur/leads`, label: t("nav.leads") },
    { href: `/${lc}/fournisseur/commissions`, label: t("nav.commissions") },
    { href: `/${lc}/fournisseur/services`, label: t("nav.services") },
    { href: `/${lc}/fournisseur/messages`, label: t("nav.messages") },
  ];

  return (
    <PortalShell
      locale={lc}
      title={tc("shell.fournisseurSpace")}
      badgeLabel={tc("shell.fournisseurSpace")}
      variant="fournisseur"
      nav={nav}
      logoutLabel={tc("shell.logout")}
    >
      {children}
    </PortalShell>
  );
}
