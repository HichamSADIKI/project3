"use client";

import React, { useMemo, useState } from "react";
import { Eyebrow } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useFavorites } from "@/hooks/use-favorites";
import { SEARCH_INDEX, type SearchItem } from "@/lib/search-index";

/**
 * Panneau « Favoris » affiché en haut du dashboard.
 *
 * - Vide : message d'accueil + bouton « Ajouter des favoris ».
 * - Rempli : grille de tuiles cliquables → navigation immédiate.
 * - Bouton « Gérer » → modal de sélection / désélection.
 *
 * RTL-safe : utilise marginInlineEnd / insetInlineStart, ms-/me-, jamais ml-/mr-.
 * Multilingue via useLang() (ar / fr / en).
 */

const T = {
  title:     { en: "Favorites",                ar: "المفضّلة",                fr: "Favoris" },
  eyebrow:   { en: "Quick access",             ar: "وصول سريع",               fr: "Accès rapide" },
  manage:    { en: "Manage",                   ar: "إدارة",                   fr: "Gérer" },
  add:       { en: "Add favorites",            ar: "إضافة مفضّلة",            fr: "Ajouter des favoris" },
  empty:     { en: "No favorites yet — pin the screens you use most.",
               ar: "لا توجد مفضلات بعد — ثبّت الشاشات التي تستخدمها أكثر.",
               fr: "Aucun favori — épinglez les écrans que vous utilisez le plus." },
  done:      { en: "Done",                     ar: "تم",                      fr: "Terminé" },
  selected:  { en: "Selected",                 ar: "محدّد",                   fr: "Sélectionné" },
  picker_h:  { en: "Pin your favorite screens",ar: "ثبّت الشاشات المفضّلة لديك",fr: "Épinglez vos écrans favoris" },
  max_reached: { en: "Maximum reached",        ar: "بلغ الحد الأقصى",          fr: "Maximum atteint" },
} as const;

type L3 = { en: string; ar: string; fr: string };

export function FavoritesPanel({ onNavigate }: { onNavigate?: (screen: string) => void }) {
  const { lang } = useLang();
  const { favorites, hydrated, isFavorite, toggle, isFull, maxFavorites } = useFavorites();
  const [pickerOpen, setPickerOpen] = useState(false);

  const pl = (obj: L3) => (lang === "ar" ? obj.ar : lang === "fr" ? obj.fr : obj.en);

  // Catalogue : navigation uniquement, indexé par screen-key
  const navIndex = useMemo(() => {
    const map = new Map<string, SearchItem>();
    for (const item of SEARCH_INDEX) {
      if (item.category === "navigation") map.set(item.screen, item);
    }
    return map;
  }, []);

  const navItems = useMemo(
    () => SEARCH_INDEX.filter((i) => i.category === "navigation"),
    []
  );

  function localized(item: SearchItem): string {
    if (lang === "ar" && item.label_ar) return item.label_ar;
    if (lang === "fr" && item.label_fr) return item.label_fr;
    return item.label;
  }

  // Avant hydration, on rend le squelette pour éviter le flash SSR/CSR
  if (!hydrated) {
    return (
      <div
        className="sgi-card"
        style={{ padding: 18, minHeight: 96 }}
        aria-busy="true"
      />
    );
  }

  const resolvedFavs = favorites
    .map((k) => navIndex.get(k))
    .filter((x): x is SearchItem => Boolean(x));

  return (
    <>
      <div
        className="sgi-card"
        style={{
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          // Parent = flex column scrollable (dashboard <main>) : sans ceci la
          // carte est compressée et son header (« Quick access ») rogné par le
          // overflow:hidden de .sgi-card.
          flexShrink: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <div>
            <Eyebrow>{pl(T.eyebrow)}</Eyebrow>
            <div
              className={lang === "ar" ? "font-ar" : "font-display"}
              style={{ fontSize: 18, marginTop: 2, color: "var(--ink)" }}
            >
              {pl(T.title)}
            </div>
          </div>
          <button
            className="sgi-btn sgi-btn-ghost"
            onClick={() => setPickerOpen(true)}
            style={{ fontSize: 12, padding: "6px 12px" }}
          >
            {resolvedFavs.length === 0 ? pl(T.add) : pl(T.manage)}
          </button>
        </div>

        {/* Body */}
        {resolvedFavs.length === 0 ? (
          <div
            style={{
              padding: "18px 8px",
              textAlign: "center",
              color: "var(--ink-4)",
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            {pl(T.empty)}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 10,
            }}
          >
            {resolvedFavs.map((item) => (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.screen)}
                title={localized(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderRadius: "var(--r)",
                  border: "1px solid var(--line-soft)",
                  background: "var(--bg-ivory)",
                  cursor: "pointer",
                  textAlign: "start",
                  fontFamily: "inherit",
                  transition: "transform 0.12s, box-shadow 0.12s, border-color 0.12s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--gold)";
                  e.currentTarget.style.boxShadow = "var(--shadow-1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--line-soft)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 18,
                    width: 32,
                    height: 32,
                    display: "grid",
                    placeItems: "center",
                    borderRadius: 6,
                    background: "rgba(217,183,119,0.12)",
                    flexShrink: 0,
                  }}
                >
                  {item.emoji}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    minWidth: 0,
                  }}
                >
                  {localized(item)}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {pickerOpen && (
        <FavoritesPickerModal
          items={navItems}
          isFavorite={isFavorite}
          toggle={toggle}
          isFull={isFull}
          maxFavorites={maxFavorites}
          onClose={() => setPickerOpen(false)}
          localized={localized}
          pl={pl}
        />
      )}
    </>
  );
}

// ─── Modal ───────────────────────────────────────────────────────────────

function FavoritesPickerModal({
  items,
  isFavorite,
  toggle,
  isFull,
  maxFavorites,
  onClose,
  localized,
  pl,
}: {
  items: SearchItem[];
  isFavorite: (key: string) => boolean;
  toggle: (key: string) => void;
  isFull: boolean;
  maxFavorites: number;
  onClose: () => void;
  localized: (item: SearchItem) => string;
  pl: (obj: L3) => string;
}) {
  const selectedCount = items.filter((i) => isFavorite(i.screen)).length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(20,14,8,0.55)",
        display: "grid",
        placeItems: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="sgi-card"
        style={{
          width: "min(640px, 100%)",
          maxHeight: "min(80vh, 720px)",
          padding: 0,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--line-soft)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
          }}
        >
          <div>
            <Eyebrow>{pl(T.picker_h)}</Eyebrow>
            <div
              className="font-display"
              style={{ fontSize: 20, marginTop: 4 }}
            >
              {selectedCount} / {maxFavorites}
            </div>
          </div>
          {isFull && (
            <span style={{ fontSize: 11, color: "var(--gold-deep)" }}>
              {pl(T.max_reached)}
            </span>
          )}
        </div>

        {/* List */}
        <div
          style={{
            overflowY: "auto",
            padding: 12,
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: 4,
            flex: 1,
          }}
        >
          {items.map((item) => {
            const pinned = isFavorite(item.screen);
            const canPin = pinned || !isFull;
            return (
              <button
                key={item.id}
                onClick={() => canPin && toggle(item.screen)}
                disabled={!canPin}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: "var(--r)",
                  border: "1px solid " + (pinned ? "var(--gold)" : "var(--line-soft)"),
                  background: pinned ? "rgba(217,183,119,0.10)" : "transparent",
                  cursor: canPin ? "pointer" : "not-allowed",
                  textAlign: "start",
                  fontFamily: "inherit",
                  opacity: canPin ? 1 : 0.5,
                  transition: "background 0.12s, border-color 0.12s",
                }}
              >
                <span
                  aria-hidden
                  style={{
                    fontSize: 18,
                    width: 28,
                    height: 28,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                  }}
                >
                  {item.emoji}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontSize: 13.5,
                    color: "var(--ink)",
                    minWidth: 0,
                  }}
                >
                  {localized(item)}
                </span>
                <span
                  aria-hidden
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: "50%",
                    border: "1.5px solid " + (pinned ? "var(--gold)" : "var(--ink-4)"),
                    background: pinned ? "var(--gold)" : "transparent",
                    display: "grid",
                    placeItems: "center",
                    fontSize: 11,
                    color: pinned ? "var(--ink)" : "transparent",
                    flexShrink: 0,
                  }}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 22px",
            borderTop: "1px solid var(--line-soft)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
          }}
        >
          <button
            className="sgi-btn sgi-btn-primary"
            onClick={onClose}
          >
            {pl(T.done)}
          </button>
        </div>
      </div>
    </div>
  );
}
