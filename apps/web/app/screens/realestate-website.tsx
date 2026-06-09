"use client";

// Administration du site web public (vitrine) — tour de contrôle de la
// publication des annonces Vente + Location. Réutilise les proxies existants :
//   GET   /api/admin/{sales,leasing}/listings        (liste)
//   POST  …/listings/{id}/transition  { status }      (publier / retirer)
//   PATCH …/listings/{id}             { is_featured } (flags vitrine)
// La vraie autorité (machine à états, slug, RLS) reste backend.

import React, { useMemo, useState } from "react";
import { Topbar, IcGlobe, IcContract, IcProp } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useLang } from "@/components/language-provider";
import type { Translations, Lang } from "@/lib/i18n";
import { useApiList } from "@/lib/use-api-list";
import { ListingFlagToggle } from "@/components/listing-flag-toggle";
import { ListingOnlineToggle } from "@/components/listing-online-toggle";
import { SiteDesignPanel } from "@/components/site-design-panel";

const PORTAL = process.env.NEXT_PUBLIC_PORTAL_URL ?? "http://localhost:3001";

const aed = (n: number): string =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

type SaleListing = {
  id: string; reference: string; title_ar: string | null; title_en: string | null; title_fr: string | null;
  list_price: number; status: string; slug: string | null; is_featured?: boolean; is_urgent?: boolean;
};
type RentListing = {
  id: string; reference: string; title_ar: string | null; title_en: string | null; title_fr: string | null;
  monthly_rent: number; annual_rent: number | null; status: string; slug: string | null;
  is_featured?: boolean; is_urgent?: boolean;
};

type Row = {
  id: string; deal: "sale" | "rent"; reference: string; title: string;
  price: number; perYear: boolean; status: string; slug: string | null;
  is_featured: boolean; is_urgent: boolean; basePath: string;
};

function pickTitle(lang: Lang, ar: string | null, en: string | null, fr: string | null, fallback: string): string {
  const order = lang === "ar" ? [ar, en, fr] : lang === "fr" ? [fr, en, ar] : [en, fr, ar];
  return order.find((x): x is string => !!x) ?? fallback;
}

export function ScreenRealEstateWebsite() {
  const t = useT();
  const { lang } = useLang();

  // limit=100 = plafond de pagination de l'API (Query le=100) — au-delà → 422.
  const sales = useApiList<SaleListing>("/api/admin/sales/listings?limit=100");
  const rents = useApiList<RentListing>("/api/admin/leasing/listings?limit=100");
  const reloadAll = () => { sales.reload(); rents.reload(); };

  const [deal, setDeal] = useState<"all" | "sale" | "rent">("all");
  const [status, setStatus] = useState<"all" | "online" | "draft">("all");

  const rows: Row[] = useMemo(() => {
    const s: Row[] = sales.items.map((x) => ({
      id: x.id, deal: "sale", reference: x.reference,
      title: pickTitle(lang, x.title_ar, x.title_en, x.title_fr, x.reference),
      price: x.list_price, perYear: false, status: x.status, slug: x.slug ?? null,
      is_featured: !!x.is_featured, is_urgent: !!x.is_urgent, basePath: "/api/admin/sales/listings",
    }));
    const r: Row[] = rents.items.map((x) => ({
      id: x.id, deal: "rent", reference: x.reference,
      title: pickTitle(lang, x.title_ar, x.title_en, x.title_fr, x.reference),
      price: x.annual_rent ?? x.monthly_rent * 12, perYear: true, status: x.status, slug: x.slug ?? null,
      is_featured: !!x.is_featured, is_urgent: !!x.is_urgent, basePath: "/api/admin/leasing/listings",
    }));
    return [...s, ...r];
  }, [sales.items, rents.items, lang]);

  const kpis = useMemo(() => ({
    online: rows.filter((x) => x.status === "published").length,
    draft: rows.filter((x) => x.status === "draft").length,
    featured: rows.filter((x) => x.is_featured && x.status === "published").length,
    urgent: rows.filter((x) => x.is_urgent && x.status === "published").length,
  }), [rows]);

  const filtered = rows.filter((x) => {
    if (deal !== "all" && x.deal !== deal) return false;
    if (status === "online" && x.status !== "published") return false;
    if (status === "draft" && x.status !== "draft") return false;
    return true;
  });

  const loading = sales.loading || rents.loading;
  const error = sales.error || rents.error;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_re_website} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        {/* En-tête : sous-titre + « Voir le site » */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ display: "inline-flex", color: "var(--gold-deep)" }}><IcGlobe /></span>
            <div style={{ fontSize: 13.5, color: "var(--ink-3)" }}>{t.web_subtitle}</div>
          </div>
          <a href={`${PORTAL}/${lang}/properties`} target="_blank" rel="noopener noreferrer"
             style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)", color: "#1A1610", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, textDecoration: "none" }}>
            <IcGlobe /> {t.web_view_site}
          </a>
        </div>

        {/* Pilotage du design du site public (3 modèles · manuel / rotation auto) */}
        <SiteDesignPanel lang={lang} />

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 24 }}>
          <Kpi label={t.web_kpi_online} value={kpis.online} color="var(--emerald)" />
          <Kpi label={t.web_kpi_draft} value={kpis.draft} color="var(--ink-3)" />
          <Kpi label={t.web_kpi_featured} value={kpis.featured} color="var(--gold-deep)" />
          <Kpi label={t.web_kpi_urgent} value={kpis.urgent} color="var(--rose)" />
        </div>

        {/* Filtres segmentés */}
        <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 18 }}>
          <Segmented value={deal} onChange={setDeal} options={[["all", t.web_all], ["sale", t.web_sale], ["rent", t.web_rent]]} />
          <Segmented value={status} onChange={setStatus} options={[["all", t.web_all], ["online", t.web_kpi_online], ["draft", t.web_kpi_draft]]} />
        </div>

        {error && <div style={{ padding: "12px 16px", marginBottom: 16, borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>{t.error_label} : {error}</div>}

        {/* Liste des annonces */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {loading && <div style={{ color: "var(--ink-4)", fontSize: 13 }}>{t.loading}</div>}
          {!loading && filtered.length === 0 && (
            <div style={{ padding: "40px 16px", textAlign: "center", color: "var(--ink-4)", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)" }}>{t.web_empty}</div>
          )}
          {filtered.map((x) => (
            <ListingCard key={`${x.deal}-${x.id}`} t={t} lang={lang} row={x} onChanged={reloadAll} />
          ))}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "16px 18px" }}>
      <div className="tnum" style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Segmented<V extends string>({ value, onChange, options }: { value: V; onChange: (v: V) => void; options: ReadonlyArray<readonly [V, string]> }) {
  return (
    <div style={{ display: "inline-flex", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 999, padding: 3 }}>
      {options.map(([key, label]) => (
        <button key={key} onClick={() => onChange(key)}
          style={{
            border: "none", borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
            background: value === key ? "var(--gold)" : "transparent",
            color: value === key ? "#1A1610" : "var(--ink-4)",
          }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function ListingCard({ t, lang, row, onChanged }: {
  t: Translations; lang: Lang; row: Row; onChanged: () => void;
}) {
  const online = row.status === "published";
  const isDealSale = row.deal === "sale";
  const toggleable = row.status === "draft" || row.status === "published" || row.status === "withdrawn";

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "14px 18px" }}>
      {/* Pastille deal */}
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: isDealSale ? "rgba(212,160,55,0.14)" : "rgba(16,185,129,0.12)", color: isDealSale ? "var(--gold-deep)" : "var(--emerald)" }}>
        {isDealSale ? <IcContract /> : <IcProp />} {isDealSale ? t.web_sale : t.web_rent}
      </span>

      {/* Titre + référence */}
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{row.title}</div>
        <div className="tnum" style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>{row.reference}</div>
      </div>

      {/* Prix */}
      <div className="tnum" style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-2)", whiteSpace: "nowrap" }}>
        {aed(row.price)}{row.perYear ? <span style={{ color: "var(--ink-4)", fontWeight: 400 }}>/an</span> : null}
      </div>

      {/* Interrupteur En ligne / Hors ligne (publie ou retire du site) */}
      {toggleable ? (
        <ListingOnlineToggle basePath={row.basePath} id={row.id} status={row.status} labelOn={t.web_badge_online} labelOff={t.web_offline} onChanged={onChanged} />
      ) : (
        <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: "var(--line-soft)", color: "var(--ink-4)" }}>{row.status}</span>
      )}

      {/* Flags vitrine (uniquement quand en ligne) */}
      {online && (
        <span style={{ display: "inline-flex", gap: 6 }}>
          <ListingFlagToggle basePath={row.basePath} id={row.id} flag="is_featured" value={row.is_featured} label={t.st_featured} activeColor="var(--gold-deep)" activeBg="rgba(212,160,55,0.14)" />
          <ListingFlagToggle basePath={row.basePath} id={row.id} flag="is_urgent" value={row.is_urgent} label={t.st_urgent} activeColor="var(--rose)" activeBg="var(--rose-soft)" />
        </span>
      )}

      {/* Action : Voir la page publique (quand en ligne) */}
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center", justifyContent: "flex-end", minWidth: 64 }}>
        {online && row.slug && (
          <a href={`${PORTAL}/${lang}/property/${row.slug}`} target="_blank" rel="noopener noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, fontWeight: 600, color: "var(--gold-deep)", textDecoration: "none" }}>
            <IcGlobe /> {t.web_view}
          </a>
        )}
      </span>
    </div>
  );
}
