import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { dirFor, isValidLocale, LOCALES, type Locale } from "@/lib/i18n";
import { ThemeProvider } from "@/components/theme-provider";

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

// Évite le FOUC : applique la classe `dark` avant l'hydratation React.
const NO_FOUC_SCRIPT = `(() => {
  try {
    const stored = localStorage.getItem('sgi-portal-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const mode = stored ?? (prefersDark ? 'dark' : 'light');
    if (mode === 'dark') document.documentElement.classList.add('dark');
  } catch (_) {}
})();`;

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isValidLocale(locale)) notFound();

  return (
    <html lang={locale} dir={dirFor(locale as Locale)} suppressHydrationWarning>
      <head>
        {/* Polices vitrine luxe : Cormorant Garamond (serif display) · Jost (UI) · Cairo (AR) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Jost:wght@400;500;600;700&family=Cairo:wght@500;600;700&display=swap"
        />
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: NO_FOUC_SCRIPT }}
        />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
