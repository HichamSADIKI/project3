"use client";

/**
 * Import d'un bien depuis une URL d'annonce (Bayut / PropertyFinder / Dubizzle).
 * Auto-suffisant : valide la source côté client (UX), POST JSON vers
 * /api/admin/scraping/property, puis affiche une carte d'aperçu des champs
 * extraits. MVP « aperçu » — la création de fiche est un follow-up. CSS logique
 * (Loi 3). i18n local.
 */
import React, { useState } from "react";

import { useLang } from "@/components/language-provider";
import { postJson } from "@/lib/api-client";
import { detectScrapeSource } from "@/lib/scrape-source";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    btn: "Importer depuis URL", title: "Importer une annonce", placeholder: "Lien Bayut, PropertyFinder ou Dubizzle…",
    fetch: "Analyser", fetching: "Analyse…", close: "Fermer", preview: "Aperçu extrait",
    badUrl: "Site non supporté (Bayut, PropertyFinder, Dubizzle uniquement).", failed: "Extraction impossible depuis cette URL.",
    type: "Type", price: "Prix", beds: "Chambres", baths: "SDB", area: "Surface (sqft)", emirate: "Émirat",
    community: "Communauté", images: "Images", fields: "Champs trouvés", source: "Source",
  },
  en: {
    btn: "Import from URL", title: "Import a listing", placeholder: "Bayut, PropertyFinder or Dubizzle link…",
    fetch: "Analyze", fetching: "Analyzing…", close: "Close", preview: "Extracted preview",
    badUrl: "Unsupported site (Bayut, PropertyFinder, Dubizzle only).", failed: "Could not extract data from this URL.",
    type: "Type", price: "Price", beds: "Beds", baths: "Baths", area: "Area (sqft)", emirate: "Emirate",
    community: "Community", images: "Images", fields: "Fields found", source: "Source",
  },
  ar: {
    btn: "استيراد من رابط", title: "استيراد إعلان", placeholder: "رابط Bayut أو PropertyFinder أو Dubizzle…",
    fetch: "تحليل", fetching: "جارٍ التحليل…", close: "إغلاق", preview: "معاينة مُستخرجة",
    badUrl: "موقع غير مدعوم (Bayut، PropertyFinder، Dubizzle فقط).", failed: "تعذّر استخراج البيانات من هذا الرابط.",
    type: "النوع", price: "السعر", beds: "غرف", baths: "حمّامات", area: "المساحة (قدم²)", emirate: "الإمارة",
    community: "المجتمع", images: "صور", fields: "حقول موجودة", source: "المصدر",
  },
};

type ScrapedProperty = {
  title_en: string;
  price: string;
  prop_type: string;
  bedrooms: string;
  bathrooms: string;
  sqft: string;
  emirate: string;
  community: string;
  description: string;
  images: string[];
  source: string;
  fields_found: number;
};

const cell: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", gap: 12,
  paddingBlock: 6, borderBlockEnd: "1px solid var(--line-soft)", fontSize: 13,
};

export function PropertyUrlImport(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapedProperty | null>(null);

  function reset(): void {
    setOpen(false);
    setUrl("");
    setError(null);
    setResult(null);
    setBusy(false);
  }

  async function analyze(): Promise<void> {
    setError(null);
    setResult(null);
    if (detectScrapeSource(url) === null) {
      setError(L("badUrl"));
      return;
    }
    setBusy(true);
    try {
      const res = await postJson("/api/admin/scraping/property", { url: url.trim() });
      if (!res.ok) {
        setError(L("failed"));
        return;
      }
      setResult((await res.json()) as ScrapedProperty);
    } catch {
      setError(L("failed"));
    } finally {
      setBusy(false);
    }
  }

  const rows = (r: ScrapedProperty): { k: string; v: string }[] => [
    { k: L("type"), v: r.prop_type || "—" },
    { k: L("price"), v: r.price || "—" },
    { k: L("beds"), v: r.bedrooms || "—" },
    { k: L("baths"), v: r.bathrooms || "—" },
    { k: L("area"), v: r.sqft || "—" },
    { k: L("emirate"), v: r.emirate || "—" },
    { k: L("community"), v: r.community || "—" },
    { k: L("images"), v: String(r.images?.length ?? 0) },
    { k: L("source"), v: r.source || "—" },
    { k: L("fields"), v: String(r.fields_found) },
  ];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, paddingBlock: 9, paddingInline: 16,
          borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--bg-paper)",
          color: "var(--ink-2)", fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        ⤓ {L("btn")}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={L("title")}
          onClick={reset}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div onClick={(ev) => ev.stopPropagation()} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 14, width: "min(520px,100%)", maxHeight: "85vh", overflow: "auto", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBlockEnd: 12 }}>
              <strong style={{ fontSize: 15 }}>{L("title")}</strong>
              <button type="button" onClick={reset} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-4)", fontSize: 13 }}>{L("close")}</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBlockEnd: 12 }}>
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !busy) void analyze(); }}
                placeholder={L("placeholder")}
                dir="ltr"
                style={{ flex: 1, paddingBlock: 9, paddingInline: 12, borderRadius: 8, border: "1px solid var(--line-soft)", background: "var(--bg-cream)", fontSize: 13, color: "var(--ink)" }}
              />
              <button
                type="button"
                onClick={() => void analyze()}
                disabled={busy || url.trim() === ""}
                style={{ paddingBlock: 9, paddingInline: 16, borderRadius: 8, border: "none", background: "var(--gold)", color: "#1A1610", fontWeight: 600, fontSize: 13, cursor: busy ? "default" : "pointer", opacity: busy || url.trim() === "" ? 0.6 : 1 }}
              >
                {busy ? L("fetching") : L("fetch")}
              </button>
            </div>

            {error && <div style={{ color: "var(--rose)", fontSize: 13, marginBlockEnd: 8 }}>{error}</div>}

            {result && (
              <div>
                <div style={{ fontWeight: 600, color: "var(--ink)", marginBlockEnd: 6 }}>{result.title_en || L("preview")}</div>
                <div>
                  {rows(result).map((r) => (
                    <div key={r.k} style={cell}>
                      <span style={{ color: "var(--ink-4)" }}>{r.k}</span>
                      <span className="tnum" style={{ color: "var(--ink-2)", fontWeight: 600, textAlign: "end" }}>{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
