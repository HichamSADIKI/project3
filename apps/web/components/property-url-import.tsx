"use client";

/**
 * Import d'un bien depuis une URL d'annonce (Bayut / PropertyFinder / Dubizzle).
 * Auto-suffisant : valide la source côté client (UX), POST JSON vers
 * /api/admin/scraping/property, affiche un aperçu des champs extraits, puis
 * permet de CRÉER la fiche (POST /api/admin/properties, mapping pur). Le scrape
 * ne fournit pas de coordonnées → fiche créée en brouillon, à géolocaliser
 * ensuite sur la carte. CSS logique (Loi 3). i18n local.
 */
import React, { useState } from "react";

import { useLang } from "@/components/language-provider";
import { postJson } from "@/lib/api-client";
import { detectScrapeSource } from "@/lib/scrape-source";
import { scrapedToPropertyDraft, type ScrapedProperty } from "@/lib/scraped-to-property";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    btn: "Importer depuis URL", title: "Importer une annonce", placeholder: "Lien Bayut, PropertyFinder ou Dubizzle…",
    fetch: "Analyser", fetching: "Analyse…", close: "Fermer", preview: "Aperçu extrait",
    badUrl: "Site non supporté (Bayut, PropertyFinder, Dubizzle uniquement).", failed: "Extraction impossible depuis cette URL.",
    type: "Type", price: "Prix", beds: "Chambres", baths: "SDB", area: "Surface (sqft)", emirate: "Émirat",
    community: "Communauté", images: "Images", fields: "Champs trouvés", source: "Source",
    create: "Créer la fiche", creating: "Création…", createErr: "Création impossible.",
    noPrice: "Prix introuvable dans l'annonce — création impossible.",
    created: "Fiche créée", locNote: "Localisation à définir sur la carte.",
  },
  en: {
    btn: "Import from URL", title: "Import a listing", placeholder: "Bayut, PropertyFinder or Dubizzle link…",
    fetch: "Analyze", fetching: "Analyzing…", close: "Close", preview: "Extracted preview",
    badUrl: "Unsupported site (Bayut, PropertyFinder, Dubizzle only).", failed: "Could not extract data from this URL.",
    type: "Type", price: "Price", beds: "Beds", baths: "Baths", area: "Area (sqft)", emirate: "Emirate",
    community: "Community", images: "Images", fields: "Fields found", source: "Source",
    create: "Create listing", creating: "Creating…", createErr: "Could not create the listing.",
    noPrice: "No price found in the listing — cannot create.",
    created: "Listing created", locNote: "Location to be set on the map.",
  },
  ar: {
    btn: "استيراد من رابط", title: "استيراد إعلان", placeholder: "رابط Bayut أو PropertyFinder أو Dubizzle…",
    fetch: "تحليل", fetching: "جارٍ التحليل…", close: "إغلاق", preview: "معاينة مُستخرجة",
    badUrl: "موقع غير مدعوم (Bayut، PropertyFinder، Dubizzle فقط).", failed: "تعذّر استخراج البيانات من هذا الرابط.",
    type: "النوع", price: "السعر", beds: "غرف", baths: "حمّامات", area: "المساحة (قدم²)", emirate: "الإمارة",
    community: "المجتمع", images: "صور", fields: "حقول موجودة", source: "المصدر",
    create: "إنشاء العقار", creating: "جارٍ الإنشاء…", createErr: "تعذّر إنشاء العقار.",
    noPrice: "لا يوجد سعر في الإعلان — تعذّر الإنشاء.",
    created: "تم إنشاء العقار", locNote: "حدِّد الموقع على الخريطة.",
  },
};

const cell: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", gap: 12,
  paddingBlock: 6, borderBlockEnd: "1px solid var(--line-soft)", fontSize: 13,
};

export function PropertyUrlImport({ onCreated }: { onCreated?: () => void } = {}): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ScrapedProperty | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdRef, setCreatedRef] = useState<string | null>(null);

  function reset(): void {
    setOpen(false);
    setUrl("");
    setError(null);
    setResult(null);
    setBusy(false);
    setCreating(false);
    setCreatedRef(null);
  }

  async function analyze(): Promise<void> {
    setError(null);
    setResult(null);
    setCreatedRef(null);
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

  async function create(): Promise<void> {
    if (!result) return;
    setError(null);
    const mapped = scrapedToPropertyDraft(result);
    if ("error" in mapped) {
      setError(L("noPrice"));
      return;
    }
    setCreating(true);
    try {
      const res = await postJson("/api/admin/properties", mapped.draft);
      if (!res.ok) {
        setError(L("createErr"));
        return;
      }
      const body = (await res.json()) as { data?: { reference?: string } };
      setCreatedRef(body.data?.reference ?? "—");
      onCreated?.();
    } catch {
      setError(L("createErr"));
    } finally {
      setCreating(false);
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

                {createdRef ? (
                  <div style={{ marginBlockStart: 14, padding: 12, borderRadius: 8, background: "var(--emerald-ghost, rgba(16,185,129,0.12))", color: "var(--emerald)", fontSize: 13 }}>
                    <div style={{ fontWeight: 700 }}>✓ {L("created")} · <span className="tnum">{createdRef}</span></div>
                    <div style={{ color: "var(--ink-3)", marginBlockStart: 4 }}>{L("locNote")}</div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void create()}
                    disabled={creating}
                    style={{ marginBlockStart: 14, width: "100%", paddingBlock: 10, borderRadius: 8, border: "none", background: "var(--gold)", color: "#1A1610", fontWeight: 600, fontSize: 13, cursor: creating ? "default" : "pointer", opacity: creating ? 0.6 : 1 }}
                  >
                    {creating ? L("creating") : L("create")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
