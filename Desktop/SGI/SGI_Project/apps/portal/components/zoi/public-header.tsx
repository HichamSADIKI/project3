"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Ic, Svg } from "./icons";
import { useBooking } from "./booking-modal";
import { useTheme } from "@/components/theme-provider";

export interface HeaderLink {
  href: string;
  label: string;
}

export interface HeaderLabels {
  brand: string;
  brandSub: string;
  phone: string;
  email: string;
  links: HeaderLink[];
  bookCta: string;
  dashboard: string;
  themeLight: string;
  themeDark: string;
}

const LOCALES = ["en", "ar", "fr"] as const;

/**
 * En-tête vitrine luxe : barre utilitaire (téléphone/email/réseaux) + nav
 * sticky (logo sérif, liens, « Réserver une visite », toggle thème, langue,
 * Dashboard, burger mobile). RTL : CSS logique uniquement (Loi 3).
 */
export function PublicHeader({
  locale,
  labels,
}: {
  locale: string;
  labels: HeaderLabels;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const { open: openBooking } = useBooking();

  // « Réserver une visite » depuis l'en-tête → demande de rendez-vous générique.
  const genericListing = { title: labels.brand, slug: undefined };

  function isActive(href: string): boolean {
    const clean = href.replace(/\/$/, "");
    if (clean === `/${locale}`)
      return pathname === `/${locale}` || pathname === `/${locale}/`;
    return pathname.startsWith(clean);
  }

  function switchLocale(target: string) {
    if (target === locale) return;
    router.push(pathname.replace(/^\/[a-z]{2}/, `/${target}`));
  }

  return (
    <>
      {/* barre utilitaire */}
      <div className="z-topbar">
        <div className="z-container">
          <div className="z-grp">
            <a className="z-it" href={`tel:${labels.phone.replace(/\s/g, "")}`}>
              <Svg d={Ic.phone} w={15} /> {labels.phone}
            </a>
            <a className="z-it hide" href={`mailto:${labels.email}`}>
              <Svg d={Ic.mail} w={15} /> {labels.email}
            </a>
          </div>
          <div className="z-socials">
            <a href="#" aria-label="Facebook">
              <Svg d={Ic.fb} w={13} fill />
            </a>
            <a href="#" aria-label="Twitter">
              <Svg d={Ic.tw} w={13} fill />
            </a>
          </div>
        </div>
      </div>

      {/* nav principale */}
      <nav className="z-nav">
        <div className="z-container">
          <Link href={`/${locale}`} className="z-logo">
            <span className="z-logo-mark">
              <Svg d={Ic.building} w={22} />
            </span>
            <span>
              {labels.brand}
              <span className="z-logo-sub">{labels.brandSub}</span>
            </span>
          </Link>

          <div className="z-links">
            {labels.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={isActive(l.href) ? "active" : ""}
              >
                {l.label}
              </Link>
            ))}
          </div>

          <div className="z-nav-cta">
            <button
              type="button"
              className="z-icon-btn"
              onClick={toggle}
              aria-label={
                theme === "dark" ? labels.themeLight : labels.themeDark
              }
            >
              <Svg d={theme === "dark" ? Ic.sun : Ic.moon} w={18} />
            </button>

            <div className="z-lang">
              {LOCALES.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={l === locale ? "on" : ""}
                  onClick={() => switchLocale(l)}
                  aria-current={l === locale}
                >
                  {l}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="z-btn z-btn-gold"
              onClick={() => openBooking(genericListing)}
            >
              <Svg d={Ic.pin} w={16} /> {labels.bookCta}
            </button>

            <Link
              href={`/${locale}/login`}
              className="z-btn z-btn-dash z-nav-dash"
            >
              <Svg d={Ic.user} w={15} /> {labels.dashboard}
            </Link>

            <button
              type="button"
              className="z-burger"
              onClick={() => setOpen((o) => !o)}
              aria-label="menu"
            >
              <Svg d={open ? Ic.x : Ic.menu} w={22} />
            </button>
          </div>
        </div>

        {open ? (
          <div className="z-mobile-menu">
            {labels.links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={isActive(l.href) ? "active" : ""}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href={`/${locale}/login`}
              className="z-btn z-btn-dash z-btn-lg"
              style={{ borderRadius: 999 }}
              onClick={() => setOpen(false)}
            >
              <Svg d={Ic.user} w={15} /> {labels.dashboard}
            </Link>
          </div>
        ) : null}
      </nav>
    </>
  );
}
