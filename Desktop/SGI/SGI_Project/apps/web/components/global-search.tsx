"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLang } from "@/components/language-provider";
import { searchItems, type SearchItem, type SearchCategory } from "@/lib/search-index";

/* ── Category labels ─────────────────────────────────────────── */
const CAT_LABEL: Record<SearchCategory, { en: string; ar: string; fr: string }> = {
  navigation: { en: "Navigation", ar: "التنقل",       fr: "Navigation"    },
  client:     { en: "Clients",    ar: "العملاء",      fr: "Clients"       },
  company:    { en: "Companies",  ar: "الشركات",      fr: "Sociétés"      },
  action:     { en: "Actions",    ar: "إجراءات",      fr: "Actions"       },
};

const CAT_ORDER: SearchCategory[] = ["action", "navigation", "client", "company"];

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: "rgba(200,160,60,0.3)", color: "var(--gold-deep)", borderRadius: 3, padding: "0 1px" }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

interface GlobalSearchProps {
  onNavigate: (screen: string) => void;
  onClientSearch?: (name: string) => void;
}

export function GlobalSearch({ onNavigate, onClientSearch }: GlobalSearchProps) {
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = searchItems(query);

  /* Group results by category */
  const grouped = CAT_ORDER.reduce<{ cat: SearchCategory; items: SearchItem[] }[]>((acc, cat) => {
    const items = results.filter(r => r.category === cat);
    if (items.length) acc.push({ cat, items });
    return acc;
  }, []);

  const flatResults = grouped.flatMap(g => g.items);

  /* Open on ⌘K / Ctrl+K and custom event from Topbar button */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    }
    function onEvent() { setOpen(true); }
    document.addEventListener("keydown", onKey);
    window.addEventListener("open-global-search", onEvent);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("open-global-search", onEvent);
    };
  }, []);

  /* Focus input when opened */
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  /* Keep active item visible */
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  const close = useCallback(() => setOpen(false), []);

  function select(item: SearchItem) {
    if ((item.category === "client" || item.category === "company") && item.initialSearch && onClientSearch) {
      onClientSearch(item.initialSearch);
    }
    onNavigate(item.screen);
    close();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape")  { close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, flatResults.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && flatResults[activeIdx]) { select(flatResults[activeIdx]); }
  }

  const catLabel = (cat: SearchCategory) => {
    const l = CAT_LABEL[cat];
    return lang === "ar" ? l.ar : lang === "fr" ? l.fr : l.en;
  };

  const itemLabel = (item: SearchItem) =>
    lang === "ar" && item.label_ar ? item.label_ar
    : lang === "fr" && item.label_fr ? item.label_fr
    : item.label;

  if (!open) return null;

  let flatIdx = 0;

  return (
    <div
      onClick={close}
      style={{
        position: "fixed", inset: 0, zIndex: 9800,
        background: "rgba(10,7,3,0.6)",
        backdropFilter: "blur(5px)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "clamp(60px, 12vh, 140px)",
        animation: "sgi-fade-in 0.12s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "min(600px, 92vw)",
          background: "var(--bg-paper)",
          border: "1px solid var(--line)",
          borderRadius: 16,
          boxShadow: "var(--shadow-3), 0 0 0 1px rgba(200,160,60,0.08)",
          overflow: "hidden",
          display: "flex", flexDirection: "column",
          maxHeight: "70vh",
        }}
      >
        {/* Input row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px",
          borderBottom: results.length ? "1px solid var(--line-soft)" : "none",
        }}>
          <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--ink-4)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
            onKeyDown={onKeyDown}
            placeholder={lang === "ar" ? "ابحث في كل مكان…" : lang === "fr" ? "Rechercher partout…" : "Search everywhere…"}
            style={{
              flex: 1, background: "none", border: "none", outline: "none",
              fontSize: 15, color: "var(--ink)", fontFamily: "inherit",
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button onClick={() => { setQuery(""); setActiveIdx(0); inputRef.current?.focus(); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", padding: "2px 6px", borderRadius: 6, fontSize: 12 }}>
              ✕
            </button>
          )}
          <kbd style={{ fontSize: 10, padding: "2px 7px", border: "1px solid var(--line)", borderRadius: 5, color: "var(--ink-4)", background: "var(--bg-cream)", boxShadow: "0 1px 0 var(--line)", whiteSpace: "nowrap" }}>
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: "auto", flex: 1 }}>
          {flatResults.length === 0 && query.trim() ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
              {lang === "ar" ? "لا توجد نتائج" : lang === "fr" ? "Aucun résultat pour « " + query + " »" : `No results for "${query}"`}
            </div>
          ) : (
            grouped.map(({ cat, items }) => (
              <div key={cat}>
                {/* Category header */}
                <div style={{
                  padding: "10px 16px 6px",
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                  textTransform: "uppercase", color: "var(--ink-4)",
                  borderTop: flatIdx === 0 ? "none" : "1px solid var(--line-soft)",
                }}>
                  {catLabel(cat)}
                </div>
                {/* Items */}
                {items.map(item => {
                  const thisIdx = flatIdx++;
                  const isActive = activeIdx === thisIdx;
                  return (
                    <div
                      key={item.id}
                      onClick={() => select(item)}
                      onMouseEnter={() => setActiveIdx(thisIdx)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 16px", cursor: "pointer",
                        background: isActive ? "var(--gold-ghost)" : "transparent",
                        borderInlineStart: isActive ? "2px solid var(--gold)" : "2px solid transparent",
                        transition: "background 0.08s ease, border-color 0.08s ease",
                      }}
                    >
                      {/* Icon */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        display: "grid", placeItems: "center", fontSize: 15,
                        background: isActive ? "rgba(200,160,60,0.2)" : "var(--bg-cream)",
                        border: "1px solid var(--line-soft)",
                        transition: "background 0.08s ease",
                      }}>
                        {item.emoji}
                      </div>
                      {/* Label + sub */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: isActive ? "var(--gold-deep)" : "var(--ink)", lineHeight: 1.3 }}>
                          {highlight(itemLabel(item), query)}
                        </div>
                        {item.sub && (
                          <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {item.sub}
                          </div>
                        )}
                      </div>
                      {/* Arrow on hover */}
                      {isActive && (
                        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                          <path d="M5 12h14M12 5l7 7-7 7"/>
                        </svg>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16, padding: "9px 16px",
          borderTop: "1px solid var(--line-soft)",
          background: "var(--bg-cream)",
          fontSize: 10.5, color: "var(--ink-4)",
        }}>
          <span><kbd style={{ fontSize: 9, padding: "1px 5px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--bg-paper)", boxShadow: "0 1px 0 var(--line)" }}>↑↓</kbd> {lang === "fr" ? "naviguer" : lang === "ar" ? "تنقل" : "navigate"}</span>
          <span><kbd style={{ fontSize: 9, padding: "1px 5px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--bg-paper)", boxShadow: "0 1px 0 var(--line)" }}>↵</kbd> {lang === "fr" ? "ouvrir" : lang === "ar" ? "فتح" : "open"}</span>
          <span><kbd style={{ fontSize: 9, padding: "1px 5px", border: "1px solid var(--line)", borderRadius: 4, background: "var(--bg-paper)", boxShadow: "0 1px 0 var(--line)" }}>Esc</kbd> {lang === "fr" ? "fermer" : lang === "ar" ? "إغلاق" : "close"}</span>
          <span style={{ marginInlineStart: "auto" }}>{flatResults.length} {lang === "fr" ? "résultats" : lang === "ar" ? "نتائج" : "results"}</span>
        </div>
      </div>
    </div>
  );
}
