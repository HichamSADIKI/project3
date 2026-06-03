"use client";

// Bascule Liste ↔ Carte réutilisée par les écrans real estate géolocalisés.
// CSS strictement logique (Loi 3), chiffres latins.

export function ViewToggle({
  view,
  onChange,
  listLabel,
  mapLabel,
}: {
  view: "list" | "map";
  onChange: (v: "list" | "map") => void;
  listLabel: string;
  mapLabel: string;
}) {
  const base = {
    padding: "7px 14px",
    fontSize: 12.5,
    fontWeight: 600,
    cursor: "pointer",
    border: "none",
    background: "transparent",
    color: "var(--ink-3)",
  } as const;
  const active = { background: "var(--bg-paper)", color: "var(--ink)", boxShadow: "0 1px 3px rgba(0,0,0,.08)" } as const;
  return (
    <div style={{ display: "inline-flex", padding: 3, gap: 2, background: "var(--bg-cream)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)" }}>
      <button type="button" onClick={() => onChange("list")} style={{ ...base, ...(view === "list" ? active : {}), borderRadius: "calc(var(--r) - 3px)" }}>
        {listLabel}
      </button>
      <button type="button" onClick={() => onChange("map")} style={{ ...base, ...(view === "map" ? active : {}), borderRadius: "calc(var(--r) - 3px)" }}>
        {mapLabel}
      </button>
    </div>
  );
}
