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
import { useNavGate } from "@/lib/permissions";
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
    greeting: "Bonjour 👋", pick: "Choisissez une rubrique", pickSub: "Choisissez une fonction",
    functions: "fonctions", function1: "fonction", home: "Accueil",
    search: "Rechercher une rubrique…", empty: "Aucune rubrique accessible.",
  },
  en: {
    greeting: "Hello 👋", pick: "Choose a section", pickSub: "Choose a function",
    functions: "functions", function1: "function", home: "Home",
    search: "Search a section…", empty: "No accessible section.",
  },
  ar: {
    greeting: "مرحبًا 👋", pick: "اختر القسم", pickSub: "اختر وظيفة",
    functions: "وظائف", function1: "وظيفة", home: "الرئيسية",
    search: "ابحث عن قسم…", empty: "لا يوجد قسم متاح.",
  },
};

function cols(bp: "mobile" | "tablet" | "desktop"): number {
  return bp === "mobile" ? 2 : bp === "tablet" ? 3 : 4;
}

export function NavHub({
  level,
  categoryId,
  onPickCategory,
  onPickScreen,
  onBackHome,
}: {
  level: 1 | 2;
  categoryId: string | null;
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
  const [query, setQuery] = useState("");

  const countLabel = (n: number): string => `${n} ${n > 1 ? L("functions") : L("function1")}`;

  // Carte générique (icône en pastille + libellé + sous-texte optionnel).
  function HubCard({
    icon, label, sub, onClick, testid,
  }: {
    icon: React.ReactElement; label: string; sub?: string; onClick: () => void; testid: string;
  }): React.ReactNode {
    return (
      <button
        type="button"
        data-testid={testid}
        onClick={onClick}
        className="sgi-animate-in"
        style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          gap: 12, textAlign: "center", padding: "26px 16px",
          background: "var(--bg-paper)", border: "1px solid var(--line-soft)",
          borderRadius: "var(--r-md)", cursor: "pointer", minHeight: 150,
          transition: "box-shadow 0.15s ease, transform 0.15s ease, border-color 0.15s ease",
          color: "var(--ink)", font: "inherit",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.boxShadow = "var(--shadow-2)";
          el.style.transform = "translateY(-2px)";
          el.style.borderColor = "var(--gold-line)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.boxShadow = "none";
          el.style.transform = "none";
          el.style.borderColor = "var(--line-soft)";
        }}
      >
        <span style={{
          width: 54, height: 54, borderRadius: "var(--r-md)",
          background: "var(--gold-ghost)", display: "grid", placeItems: "center",
          color: "var(--gold)",
        }}>
          <span style={{ display: "grid", placeItems: "center", transform: "scale(1.25)" }}>{icon}</span>
        </span>
        <span
          className={lang === "ar" ? "font-ar" : "font-display"}
          style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.25 }}
        >
          {label}
        </span>
        {sub && (
          <span style={{ fontSize: 11.5, color: "var(--gold-deep)", fontWeight: 600 }}>
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
          <HubCard key={e.key} testid={`hub-cat-${e.key}`} icon={e.icon} label={label} onClick={() => onPickScreen(e.key)} />,
        );
      } else {
        // groupe : visible si au moins un enfant autorisé (ou la clé de groupe).
        const n = e.children.filter((c) => navGate(c.key)).length;
        if (n === 0 && !navGate(e.groupKey)) continue;
        const label = navLabelFor(t, e.groupKey);
        if (q && !label.toLowerCase().includes(q)) continue;
        cards.push(
          <HubCard key={e.id} testid={`hub-cat-${e.id}`} icon={e.icon} label={label} sub={countLabel(n)} onClick={() => onPickCategory(e.id)} />,
        );
      }
    }

    return (
      <Shell L={L} lang={lang} title={L("greeting")} subtitle={L("pick")} query={query} setQuery={setQuery} bp={bp}>
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
                <div
                  className="eyebrow"
                  style={{ marginBlockEnd: 10, paddingInlineStart: 2 }}
                >
                  {navSectionLabelFor(t, block.section)}
                </div>
              )}
              <Grid>
                {block.items.map((child) => (
                  <HubCard
                    key={child.key}
                    testid={`hub-fn-${child.key}`}
                    icon={child.icon}
                    label={child.labelKey ? navLabelFor(t, child.labelKey) : navLabelFor(t, child.key)}
                    onClick={() => onPickScreen(child.key)}
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
