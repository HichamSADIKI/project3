"use client";

/**
 * NavHub — hub de navigation « lanceur ».
 *
 * Affiche les rubriques (L1) puis les sous-catégories (L2) sous forme de cartes
 * centrées, pour inviter l'utilisateur à choisir. Au clic sur une feuille, le
 * shell bascule en niveau page (L3) avec la sidebar limitée à la rubrique.
 *
 * Source unique = NAV_ENTRIES (components/sgi-ui.tsx) — pas de duplication.
 * Gating IAM via useNavGate (défense en profondeur ; le backend reste l'autorité).
 * Libellés des cartes = navLabelFor (i18n partagé) ; chrome du hub = local (évite
 * de toucher i18n.ts, fichier chaud). CSS strictement logique (Loi 3 RTL).
 */

import React, { useState } from "react";

import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";
import { useNavGate, useCurrentUser } from "@/lib/permissions";
import { useFavorites } from "@/hooks/use-favorites";
import {
  NAV_ENTRIES,
  navLabelFor,
  navSectionLabelFor,
  type NavItem,
} from "@/components/sgi-ui";
import { topLevelEntries, findGroup, groupBySection } from "@/lib/nav-model";

type Lang = "ar" | "en" | "fr";

const HUB_TR: Record<Lang, Record<string, string>> = {
  fr: {
    greeting: "Bonjour", pick: "Choisissez une rubrique", pickSub: "Choisissez une fonction",
    functions: "fonctions", function1: "fonction", home: "Accueil",
    search: "Rechercher une rubrique…", empty: "Aucune rubrique accessible.",
  },
  en: {
    greeting: "Hello", pick: "Choose a section", pickSub: "Choose a function",
    functions: "functions", function1: "function", home: "Home",
    search: "Search a section…", empty: "No accessible section.",
  },
  ar: {
    greeting: "مرحبًا", pick: "اختر القسم", pickSub: "اختر وظيفة",
    functions: "وظائف", function1: "وظيفة", home: "الرئيسية",
    search: "ابحث عن قسم…", empty: "لا يوجد قسم متاح.",
  },
};

function cols(bp: "mobile" | "tablet" | "desktop"): number {
  return bp === "mobile" ? 2 : bp === "tablet" ? 3 : 4;
}

// Couleur d'identité par rubrique — rend le hub vivant et la navigation intuitive
// (repère couleur mémorisable). Tons soutenus mais accordés au thème.
const CAT_COLOR: Record<string, string> = {
  dash: "#6366F1",        // indigo
  fournisseurs: "#F59E0B",// ambre
  clients: "#2563EB",     // bleu
  realestate: "#10B981",  // émeraude
  tourisme: "#06B6D4",    // cyan
  sante: "#EF4444",       // rouge
  assurance: "#8B5CF6",   // violet
  banques: "#0EA5E9",     // azur
  amazon: "#FB923C",      // orange
  consultants: "#A855F7", // pourpre
  admin: "#64748B",       // ardoise
  travail: "#D97706",     // ambre foncé
  callcenter: "#EC4899",  // rose
  backoffice: "#3B82F6",  // bleu vif
  appadmin: "#DC2626",    // rouge profond
  report: "#16A34A",      // vert
  parametres: "#6B7280",  // gris
};
const FALLBACK_ACCENT = "#B8924F"; // or
function accentFor(id: string): string {
  return CAT_COLOR[id] ?? FALLBACK_ACCENT;
}

export function NavHub({
  level,
  categoryId,
  userName,
  onPickCategory,
  onPickScreen,
  onBackHome,
}: {
  level: 1 | 2;
  categoryId: string | null;
  userName?: string;
  onPickCategory: (id: string) => void;
  onPickScreen: (key: string) => void;
  onBackHome: () => void;
}): React.ReactNode {
  const t = useT();
  const { lang } = useLang();
  const lg = (lang as Lang) in HUB_TR ? (lang as Lang) : "fr";
  const L = (k: string): string => HUB_TR[lg][k] ?? HUB_TR.fr[k] ?? k;
  const bp = useBreakpoint();
  const navGate = useNavGate();
  const { fullName } = useCurrentUser();
  // Favoris : étoile sur chaque sous-catégorie du hub pour l'ajouter/retirer.
  const { isFavorite, toggle: toggleFav } = useFavorites();
  // Nom affiché : override explicite > nom de session > rien (salutation neutre).
  const displayName = userName ?? fullName ?? undefined;
  const [query, setQuery] = useState("");

  const countLabel = (n: number): string => `${n} ${n > 1 ? L("functions") : L("function1")}`;

  // Carte générique (icône en pastille colorée + libellé + sous-texte optionnel).
  function HubCard({
    icon, label, sub, onClick, testid, accent, isFav, onToggleFav,
  }: {
    icon: React.ReactElement; label: string; sub?: string; onClick: () => void; testid: string; accent: string;
    isFav?: boolean; onToggleFav?: () => void;
  }): React.ReactNode {
    return (
      <button
        type="button"
        data-testid={testid}
        onClick={onClick}
        className="sgi-animate-in"
        style={{
          position: "relative", overflow: "hidden",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 12, textAlign: "center", padding: "28px 16px",
          background: "var(--bg-paper)", border: "1px solid var(--line-soft)",
          borderRadius: "var(--r-md)", cursor: "pointer", minHeight: 156,
          transition: "box-shadow 0.18s ease, transform 0.18s ease, border-color 0.18s ease",
          color: "var(--ink)", font: "inherit",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.boxShadow = `0 10px 30px ${accent}33, 0 2px 8px ${accent}1f`;
          el.style.transform = "translateY(-3px)";
          el.style.borderColor = accent;
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.boxShadow = "none";
          el.style.transform = "none";
          el.style.borderColor = "var(--line-soft)";
        }}
      >
        {/* Liseré coloré supérieur — signature visuelle de la rubrique. */}
        <span aria-hidden style={{
          position: "absolute", insetBlockStart: 0, insetInlineStart: 0, insetInlineEnd: 0,
          height: 3, background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
        }} />
        {/* Étoile favori — ajoute/retire cette sous-catégorie des favoris (sans naviguer). */}
        {onToggleFav && (
          <span
            role="button"
            tabIndex={0}
            data-testid={`hub-fav-${testid}`}
            aria-label={isFav
              ? (lang === "ar" ? "إزالة من المفضلة" : lang === "fr" ? "Retirer des favoris" : "Remove from favorites")
              : (lang === "ar" ? "أضف إلى المفضلة" : lang === "fr" ? "Ajouter aux favoris" : "Add to favorites")}
            title={isFav
              ? (lang === "ar" ? "إزالة من المفضلة" : lang === "fr" ? "Retirer des favoris" : "Remove from favorites")
              : (lang === "ar" ? "أضف إلى المفضلة" : lang === "fr" ? "Ajouter aux favoris" : "Add to favorites")}
            onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onToggleFav(); } }}
            style={{
              position: "absolute", insetBlockStart: 8, insetInlineEnd: 8, zIndex: 2,
              width: 28, height: 28, display: "grid", placeItems: "center",
              borderRadius: 999, cursor: "pointer",
              color: isFav ? "var(--gold-deep)" : "var(--ink-4)",
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
            </svg>
          </span>
        )}
        <span style={{
          width: 56, height: 56, borderRadius: "var(--r-md)",
          background: `linear-gradient(135deg, ${accent}26, ${accent}0d)`,
          border: `1px solid ${accent}33`,
          display: "grid", placeItems: "center", color: accent,
        }}>
          <span style={{ display: "grid", placeItems: "center", transform: "scale(1.3)" }}>{icon}</span>
        </span>
        <span
          className={lang === "ar" ? "font-ar" : "font-display"}
          style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.25, color: "var(--ink)" }}
        >
          {label}
        </span>
        {sub && (
          <span style={{ fontSize: 11.5, color: accent, fontWeight: 700, letterSpacing: "0.01em" }}>
            {sub} <span aria-hidden>›</span>
          </span>
        )}
      </button>
    );
  }

  function Grid({ children }: { children: React.ReactNode }): React.ReactNode {
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols(bp)}, minmax(0, 1fr))`,
        gap: 16,
      }}>
        {children}
      </div>
    );
  }

  // ── L1 : rubriques ──────────────────────────────────────────────────────
  if (level === 1) {
    const q = query.trim().toLowerCase();
    const cards: React.ReactNode[] = [];
    for (const e of topLevelEntries(NAV_ENTRIES)) {
      if (e.type === "spacer") continue;
      if (e.type === "item") {
        if (!navGate(e.key)) continue;
        const label = navLabelFor(t, e.key);
        if (q && !label.toLowerCase().includes(q)) continue;
        cards.push(
          <HubCard key={e.key} testid={`hub-cat-${e.key}`} icon={e.icon} label={label} accent={accentFor(e.key)} onClick={() => onPickScreen(e.key)} />,
        );
      } else {
        // groupe : visible si au moins un enfant autorisé (ou la clé de groupe).
        const n = e.children.filter((c) => navGate(c.key)).length;
        if (n === 0 && !navGate(e.groupKey)) continue;
        const label = navLabelFor(t, e.groupKey);
        if (q && !label.toLowerCase().includes(q)) continue;
        cards.push(
          <HubCard key={e.id} testid={`hub-cat-${e.id}`} icon={e.icon} label={label} sub={countLabel(n)} accent={accentFor(e.id)} onClick={() => onPickCategory(e.id)} />,
        );
      }
    }

    const hello = `${L("greeting")}${displayName ? `, ${displayName}` : ""} 👋`;
    return (
      <Shell L={L} lang={lang} title={hello} subtitle={L("pick")} query={query} setQuery={setQuery} bp={bp}>
        {cards.length === 0 ? <Empty L={L} /> : <Grid>{cards}</Grid>}
      </Shell>
    );
  }

  // ── L2 : sous-catégories d'une rubrique ─────────────────────────────────
  const group = categoryId ? findGroup(NAV_ENTRIES, categoryId) : null;
  if (!group) {
    // Sécurité : rubrique inconnue → retour accueil.
    return (
      <Shell L={L} lang={lang} title={L("greeting")} subtitle={L("pick")} bp={bp}>
        <Empty L={L} />
      </Shell>
    );
  }

  const visibleChildren = group.children.filter((c) => navGate(c.key));
  const blocks = groupBySection(visibleChildren as NavItem[]);
  const accent = accentFor(group.id);

  return (
    <Shell
      L={L}
      lang={lang}
      title={navLabelFor(t, group.groupKey)}
      subtitle={L("pickSub")}
      onBack={onBackHome}
      bp={bp}
    >
      {visibleChildren.length === 0 ? (
        <Empty L={L} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          {blocks.map((block, i) => (
            <div key={block.section ?? `blk-${i}`}>
              {block.section && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBlockEnd: 10, paddingInlineStart: 2 }}>
                  <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: accent, flexShrink: 0 }} />
                  <span className="eyebrow" style={{ color: accent }}>{navSectionLabelFor(t, block.section)}</span>
                </div>
              )}
              <Grid>
                {block.items.map((child) => (
                  <HubCard
                    key={child.key}
                    testid={`hub-fn-${child.key}`}
                    icon={child.icon}
                    accent={accent}
                    label={child.labelKey ? navLabelFor(t, child.labelKey) : navLabelFor(t, child.key)}
                    onClick={() => onPickScreen(child.key)}
                    isFav={isFavorite(child.key)}
                    onToggleFav={() => toggleFav(child.key)}
                  />
                ))}
              </Grid>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}

// ── Habillage commun (en-tête + recherche + conteneur centré) ─────────────
function Shell({
  L, lang, title, subtitle, query, setQuery, onBack, bp, children,
}: {
  L: (k: string) => string;
  lang: string;
  title: string;
  subtitle: string;
  query?: string;
  setQuery?: (v: string) => void;
  onBack?: () => void;
  bp: "mobile" | "tablet" | "desktop";
  children: React.ReactNode;
}): React.ReactNode {
  const isMob = bp === "mobile";
  return (
    <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-cream)" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", padding: isMob ? "24px 14px 48px" : "44px 28px 64px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBlockEnd: 6 }}>
          {onBack && (
            <button
              type="button"
              data-testid="hub-back"
              onClick={onBack}
              aria-label={L("home")}
              style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "var(--bg-ivory)", border: "1px solid var(--line)",
                borderRadius: "var(--r)", padding: "6px 12px", cursor: "pointer",
                color: "var(--ink-2)", fontSize: 12.5, fontWeight: 600, font: "inherit",
              }}
            >
              <span aria-hidden style={{ display: "inline-block", transform: lang === "ar" ? "scaleX(-1)" : "none" }}>‹</span>
              {L("home")}
            </button>
          )}
        </div>
        <div
          className={lang === "ar" ? "font-ar" : "font-display"}
          style={{ fontSize: isMob ? 22 : 28, fontWeight: 600, color: "var(--ink)", lineHeight: 1.2 }}
        >
          {title}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--ink-4)", marginBlockStart: 4, marginBlockEnd: 22 }}>
          {subtitle}
        </div>

        {setQuery && (
          <div style={{ marginBlockEnd: 22, maxWidth: 360 }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={L("search")}
              aria-label={L("search")}
              data-testid="hub-search"
              style={{
                width: "100%", padding: "10px 14px", fontSize: 13.5,
                background: "var(--bg-ivory)", border: "1px solid var(--line)",
                borderRadius: "var(--r)", color: "var(--ink)", outline: "none", font: "inherit",
              }}
            />
          </div>
        )}

        {children}
      </div>
    </div>
  );
}

function Empty({ L }: { L: (k: string) => string }): React.ReactNode {
  return (
    <div style={{ padding: "40px 0", textAlign: "center", color: "var(--ink-4)", fontSize: 13.5 }}>
      {L("empty")}
    </div>
  );
}
