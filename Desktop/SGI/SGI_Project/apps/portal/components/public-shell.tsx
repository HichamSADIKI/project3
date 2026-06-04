import type { ReactNode } from "react";
import Link from "next/link";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { BookingProvider, type BookingLabels } from "./zoi/booking-modal";
import { PublicHeader, type HeaderLabels } from "./zoi/public-header";
import { Ic, Svg } from "./zoi/icons";

const PHONE = "+971 2 203 1000";
const EMAIL = "info@sgi.ae";
const ADDRESS = "Al Maryah Island, Abu Dhabi";

/**
 * Coquille publique — direction luxe (design Claude « ZOI Signature »), adaptée
 * à la marque SGI. Barre utilitaire + nav sérif + modal de réservation +
 * footer vert dégradé. Tout est scopé sous `.zoi-site` ; les portails
 * authentifiés gardent la palette Slate Pro. RTL : CSS logique (Loi 3).
 */
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

  const headerLabels: HeaderLabels = {
    brand: t("brand.name"),
    brandSub: t("brand.tagline"),
    phone: PHONE,
    email: EMAIL,
    links: [
      { href: `/${lc}`, label: tr("nav.home") },
      { href: `/${lc}/properties`, label: tr("nav.properties") },
      { href: `/${lc}/agents`, label: tr("agents.title") },
      { href: `/${lc}/contact`, label: tr("nav.contact") },
    ],
    bookCta: tr("book.cta"),
    dashboard: t("header.login"),
    themeLight: tr("theme.light"),
    themeDark: tr("theme.dark"),
  };

  const bookingLabels: BookingLabels = {
    title: tr("book.title"),
    subtitle: tr("book.subtitle"),
    name: tr("book.name"),
    namePlaceholder: tr("book.namePlaceholder"),
    phone: tr("book.phone"),
    date: tr("book.date"),
    slot: tr("book.slot"),
    confirm: tr("book.confirm"),
    sending: tr("book.sending"),
    booked: tr("book.booked"),
    bookedSub: tr("book.bookedSub"),
    property: tr("book.property"),
    when: tr("book.when"),
    close: tr("book.close"),
    bedrooms: tr("detail.bedrooms"),
    bathrooms: tr("detail.bathrooms"),
    perYear: tr("card.perYear"),
    reference: tr("detail.reference"),
    errorValidation: tr("book.errorValidation"),
    errorNetwork: tr("book.errorNetwork"),
  };

  const propertyTypes: Array<[string, string]> = [
    ["villa", tr("portfolio.villa")],
    ["apartment", tr("portfolio.apartment")],
    ["office", tr("portfolio.office")],
    ["land", tr("portfolio.land")],
  ];

  return (
    <div className="zoi-site" dir={lc === "ar" ? "rtl" : "ltr"}>
      <BookingProvider locale={lc} labels={bookingLabels}>
        <PublicHeader locale={lc} labels={headerLabels} />

        <main style={{ flex: 1 }}>{children}</main>

        <footer className="z-footer">
          <div className="z-container">
            <div>
              <div className="z-flogo">{t("brand.name")}</div>
              <p style={{ maxWidth: 280 }}>{tr("footer.tagline")}</p>
              <div className="z-fnews">
                <input
                  placeholder={EMAIL}
                  aria-label={tr("footer.newsletter")}
                />
                <button type="button">{tr("footer.subscribe")}</button>
              </div>
            </div>
            <div>
              <h4>{tr("footer.explore")}</h4>
              {propertyTypes.map(([key, label]) => (
                <Link key={key} href={`/${lc}/properties?unit_type=${key}`}>
                  {label}
                </Link>
              ))}
            </div>
            <div>
              <h4>{tr("footer.company")}</h4>
              <Link href={`/${lc}/properties`}>{tr("nav.properties")}</Link>
              <Link href={`/${lc}/agents`}>{tr("agents.title")}</Link>
              <Link href={`/${lc}/contact`}>{tr("nav.contact")}</Link>
            </div>
            <div>
              <h4>{tr("footer.contact")}</h4>
              <p className="z-fcontact">
                <Svg d={Ic.phone} w={16} /> {PHONE}
              </p>
              <p className="z-fcontact">
                <Svg d={Ic.mail} w={16} /> {EMAIL}
              </p>
              <p className="z-fcontact">
                <Svg d={Ic.pin} w={16} /> {ADDRESS}
              </p>
            </div>
          </div>
          <div className="z-footer-bottom">
            <div className="z-container">
              <span>
                {t("footer.copyright", { year: new Date().getFullYear() })}
              </span>
              <span>Abu Dhabi · United Arab Emirates</span>
            </div>
          </div>
        </footer>
      </BookingProvider>
    </div>
  );
}
