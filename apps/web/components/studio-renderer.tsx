"use client";

/**
 * Moteur de rendu générique des modules « lite » du Studio.
 *
 * Lit un `SheetSchema` (donnée déclarative, JAMAIS du code) et affiche les feuilles
 * et leurs éléments (text, select, bouton, …). **Aucun eval** : les actions de bouton
 * sont une liste blanche de chaînes connues, rendues inertes en mode aperçu.
 *
 * Présentation pure (aucun appel réseau). CSS logique uniquement (Loi 3 RTL).
 * i18n par `lang` (ar/en/fr).
 */

import React from "react";

type Lang = "ar" | "en" | "fr";

type SelectOption = {
  value: string;
  label_ar: string;
  label_en: string;
  label_fr: string;
};

type Element = {
  id: string;
  type: "text" | "textarea" | "number" | "select" | "checkbox" | "date" | "label" | "button";
  label_ar: string;
  label_en: string;
  label_fr: string;
  placeholder?: string | null;
  required?: boolean;
  options?: SelectOption[];
  action?: "submit" | "reset" | "navigate" | null;
};

type Sheet = {
  id: string;
  title_ar: string;
  title_en: string;
  title_fr: string;
  elements: Element[];
};

export type SheetSchema = {
  schema_version: number;
  sheets: Sheet[];
};

function labelOf(o: { label_ar: string; label_en: string; label_fr: string }, lang: Lang): string {
  return lang === "ar" ? o.label_ar : lang === "fr" ? o.label_fr : o.label_en;
}
function titleOf(s: Sheet, lang: Lang): string {
  return lang === "ar" ? s.title_ar : lang === "fr" ? s.title_fr : s.title_en;
}

const fld: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid var(--line-soft)",
  background: "var(--bg-cream)",
  color: "var(--ink)",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

function FieldShell({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}): React.ReactNode {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
      <span style={{ color: "var(--ink-4)" }}>
        {label}
        {required ? <span style={{ color: "var(--rose)" }}> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function ElementView({ el, lang }: { el: Element; lang: Lang }): React.ReactNode {
  const label = labelOf(el, lang);
  const ph = el.placeholder ?? "";
  switch (el.type) {
    case "label":
      return <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-2)" }}>{label}</div>;
    case "button":
      return (
        <button
          type="button"
          disabled
          style={{
            fontSize: 12,
            fontWeight: 600,
            padding: "8px 16px",
            borderRadius: 8,
            border: "1px solid var(--line-soft)",
            background: "var(--bg-paper)",
            color: "var(--ink-2)",
            cursor: "not-allowed",
            alignSelf: "flex-start",
          }}
          title={el.action ?? undefined}
        >
          {label}
        </button>
      );
    case "textarea":
      return (
        <FieldShell label={label} required={el.required}>
          <textarea style={{ ...fld, minHeight: 72, resize: "vertical" }} placeholder={ph} />
        </FieldShell>
      );
    case "select":
      return (
        <FieldShell label={label} required={el.required}>
          <select style={fld} defaultValue="">
            <option value="" disabled>
              {ph || "—"}
            </option>
            {(el.options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {labelOf(o, lang)}
              </option>
            ))}
          </select>
        </FieldShell>
      );
    case "checkbox":
      return (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input type="checkbox" />
          <span style={{ color: "var(--ink-2)" }}>{label}</span>
        </label>
      );
    case "number":
      return (
        <FieldShell label={label} required={el.required}>
          <input type="number" style={fld} placeholder={ph} />
        </FieldShell>
      );
    case "date":
      return (
        <FieldShell label={label} required={el.required}>
          <input type="date" style={fld} />
        </FieldShell>
      );
    case "text":
    default:
      return (
        <FieldShell label={label} required={el.required}>
          <input type="text" style={fld} placeholder={ph} />
        </FieldShell>
      );
  }
}

export function StudioRenderer({
  schema,
  lang,
}: {
  schema: SheetSchema;
  lang: Lang;
}): React.ReactNode {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {schema.sheets.map((sheet) => (
        <div
          key={sheet.id}
          style={{
            border: "1px solid var(--line-soft)",
            borderRadius: 12,
            background: "var(--bg-paper)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              padding: "10px 16px",
              borderBottom: "1px solid var(--line-soft)",
              fontWeight: 700,
              fontSize: 13.5,
              color: "var(--ink-1)",
              background: "var(--bg-cream)",
            }}
          >
            {titleOf(sheet, lang)}
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            {sheet.elements.map((el) => (
              <ElementView key={el.id} el={el} lang={lang} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
