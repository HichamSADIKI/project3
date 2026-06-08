"use client";

/**
 * Formulaire CONTRÔLÉ d'un module généré (3B+ C). Mappe les colonnes (issues du
 * SheetSchema via `fieldColumns`) en inputs contrôlés par type. CSS logique RTL.
 * `StudioRenderer` étant display-only, on a un formulaire dédié ici.
 */

import React from "react";

import type { CrudColumn } from "@/lib/studio-crud";

type Lang = "ar" | "en" | "fr";

type FormValue = string | boolean;

function label(c: CrudColumn, lang: Lang): string {
  return lang === "ar" ? c.label_ar : lang === "fr" ? c.label_fr : c.label_en;
}

const fld: React.CSSProperties = {
  width: "100%",
  padding: "8px 11px",
  borderRadius: 8,
  border: "1px solid var(--line-soft)",
  background: "var(--bg-cream)",
  color: "var(--ink)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

export function StudioCrudForm({
  cols,
  values,
  onChange,
  lang,
}: {
  cols: CrudColumn[];
  values: Record<string, FormValue>;
  onChange: (name: string, value: FormValue) => void;
  lang: Lang;
}): React.ReactNode {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 12,
      }}
    >
      {cols.map((c) => {
        const lbl = label(c, lang);
        if (c.type === "checkbox") {
          return (
            <label
              key={c.name}
              style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}
            >
              <input
                type="checkbox"
                checked={values[c.name] === true}
                onChange={(e) => onChange(c.name, e.target.checked)}
              />
              {lbl}
              {c.required ? <span style={{ color: "var(--rose)" }}> *</span> : null}
            </label>
          );
        }
        const strVal = typeof values[c.name] === "string" ? (values[c.name] as string) : "";
        return (
          <label
            key={c.name}
            style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}
          >
            <span style={{ color: "var(--ink-4)" }}>
              {lbl}
              {c.required ? <span style={{ color: "var(--rose)" }}> *</span> : null}
            </span>
            {c.type === "textarea" ? (
              <textarea
                style={{ ...fld, minHeight: 64, resize: "vertical" }}
                value={strVal}
                onChange={(e) => onChange(c.name, e.target.value)}
              />
            ) : c.type === "select" ? (
              <select style={fld} value={strVal} onChange={(e) => onChange(c.name, e.target.value)}>
                <option value="">—</option>
                {c.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {lang === "ar" ? o.label_ar : lang === "fr" ? o.label_fr : o.label_en}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={c.type === "number" ? "number" : c.type === "date" ? "date" : "text"}
                style={fld}
                value={strVal}
                onChange={(e) => onChange(c.name, e.target.value)}
              />
            )}
          </label>
        );
      })}
    </div>
  );
}
