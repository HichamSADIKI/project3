"use client";

/**
 * Builder visuel du Studio (Phase 2) — édite un `SheetSchema` via un arbre
 * feuilles → éléments → actions, sans toucher au JSON. Produit exactement le même
 * `SheetSchema` que la saisie JSON brute ou la génération IA.
 *
 * Composant CONTRÔLÉ : `value` + `onChange`. Logique pure déléguée à
 * `lib/studio-schema` (testée sous vitest). CSS logique uniquement (Loi 3 RTL).
 */

import React from "react";

import {
  BUTTON_ACTIONS,
  ELEMENT_TYPES,
  blankElement,
  blankSheet,
  move,
  removeAt,
  replaceAt,
  uniqueSlug,
  type Element,
  type ElementType,
  type Sheet,
  type SheetSchema,
  type SelectOption,
} from "@/lib/studio-schema";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    addSheet: "+ Feuille",
    addElement: "+ Élément",
    removeSheet: "Supprimer la feuille",
    titleFr: "Titre (FR)",
    titleEn: "Titre (EN)",
    titleAr: "Titre (AR)",
    type: "Type",
    labelFr: "Libellé (FR)",
    labelEn: "Libellé (EN)",
    labelAr: "Libellé (AR)",
    placeholder: "Indication",
    required: "Requis",
    action: "Action",
    options: "Options",
    addOption: "+ Option",
    value: "Valeur",
    up: "↑",
    down: "↓",
    remove: "✕",
    sheet: "Feuille",
  },
  en: {
    addSheet: "+ Sheet",
    addElement: "+ Element",
    removeSheet: "Remove sheet",
    titleFr: "Title (FR)",
    titleEn: "Title (EN)",
    titleAr: "Title (AR)",
    type: "Type",
    labelFr: "Label (FR)",
    labelEn: "Label (EN)",
    labelAr: "Label (AR)",
    placeholder: "Placeholder",
    required: "Required",
    action: "Action",
    options: "Options",
    addOption: "+ Option",
    value: "Value",
    up: "↑",
    down: "↓",
    remove: "✕",
    sheet: "Sheet",
  },
  ar: {
    addSheet: "+ صفحة",
    addElement: "+ عنصر",
    removeSheet: "حذف الصفحة",
    titleFr: "العنوان (FR)",
    titleEn: "العنوان (EN)",
    titleAr: "العنوان (AR)",
    type: "النوع",
    labelFr: "التسمية (FR)",
    labelEn: "التسمية (EN)",
    labelAr: "التسمية (AR)",
    placeholder: "تلميح",
    required: "مطلوب",
    action: "إجراء",
    options: "خيارات",
    addOption: "+ خيار",
    value: "القيمة",
    up: "↑",
    down: "↓",
    remove: "✕",
    sheet: "صفحة",
  },
};

const fld: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--line-soft)",
  background: "var(--bg-cream)",
  color: "var(--ink)",
  fontSize: 12.5,
  outline: "none",
  boxSizing: "border-box",
};
const miniBtn: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: "4px 9px",
  borderRadius: 7,
  border: "1px solid var(--line-soft)",
  background: "var(--bg-paper)",
  color: "var(--ink-2)",
  cursor: "pointer",
};

function Lbl({ text, children }: { text: string; children: React.ReactNode }): React.ReactNode {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3, fontSize: 11.5, flex: 1, minWidth: 120 }}>
      <span style={{ color: "var(--ink-4)" }}>{text}</span>
      {children}
    </label>
  );
}

export function StudioBuilder({
  value,
  onChange,
  lang,
}: {
  value: SheetSchema;
  onChange: (next: SheetSchema) => void;
  lang: Lang;
}): React.ReactNode {
  const L = (k: string): string => TR[lang][k] ?? TR.fr[k] ?? k;
  const sheets = value.sheets;

  const setSheets = (next: Sheet[]): void => onChange({ schema_version: 1, sheets: next });
  const patchSheet = (si: number, partial: Partial<Sheet>): void =>
    setSheets(replaceAt(sheets, si, { ...sheets[si], ...partial }));
  const patchElement = (si: number, ei: number, partial: Partial<Element>): void => {
    const els = sheets[si].elements;
    patchSheet(si, { elements: replaceAt(els, ei, { ...els[ei], ...partial }) });
  };

  const addSheet = (): void => {
    const s = blankSheet(sheets.length);
    s.id = uniqueSlug(s.id, sheets.map((x) => x.id));
    setSheets([...sheets, s]);
  };
  const addElement = (si: number, type: ElementType): void => {
    const els = sheets[si].elements;
    const el = blankElement(type);
    el.id = uniqueSlug(el.label_en || type, els.map((x) => x.id));
    patchSheet(si, { elements: [...els, el] });
  };
  const changeType = (si: number, ei: number, type: ElementType): void => {
    const cur = sheets[si].elements[ei];
    const fresh = blankElement(type);
    patchElement(si, ei, {
      type,
      options: fresh.options,
      action: fresh.action,
    });
    void cur;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {sheets.map((sheet, si) => (
        <div
          key={sheet.id || si}
          style={{
            border: "1px solid var(--line-soft)",
            borderRadius: 10,
            background: "var(--bg-paper)",
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {/* En-tête feuille */}
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase" }}>
              {L("sheet")} {si + 1}
            </span>
            <Lbl text={L("titleFr")}>
              <input style={fld} value={sheet.title_fr} onChange={(e) => patchSheet(si, { title_fr: e.target.value })} />
            </Lbl>
            <Lbl text={L("titleEn")}>
              <input style={fld} value={sheet.title_en} onChange={(e) => patchSheet(si, { title_en: e.target.value })} />
            </Lbl>
            <Lbl text={L("titleAr")}>
              <input style={fld} value={sheet.title_ar} onChange={(e) => patchSheet(si, { title_ar: e.target.value })} />
            </Lbl>
            <button type="button" style={miniBtn} title={L("up")} onClick={() => setSheets(move(sheets, si, si - 1))}>
              {L("up")}
            </button>
            <button type="button" style={miniBtn} title={L("down")} onClick={() => setSheets(move(sheets, si, si + 1))}>
              {L("down")}
            </button>
            {sheets.length > 1 && (
              <button
                type="button"
                style={{ ...miniBtn, color: "var(--rose)" }}
                title={L("removeSheet")}
                onClick={() => setSheets(removeAt(sheets, si))}
              >
                {L("remove")}
              </button>
            )}
          </div>

          {/* Éléments */}
          {sheet.elements.map((el, ei) => (
            <ElementRow
              key={el.id || ei}
              el={el}
              L={L}
              onPatch={(p) => patchElement(si, ei, p)}
              onChangeType={(t) => changeType(si, ei, t)}
              onUp={() => patchSheet(si, { elements: move(sheet.elements, ei, ei - 1) })}
              onDown={() => patchSheet(si, { elements: move(sheet.elements, ei, ei + 1) })}
              onRemove={
                sheet.elements.length > 1
                  ? () => patchSheet(si, { elements: removeAt(sheet.elements, ei) })
                  : null
              }
            />
          ))}

          {/* Ajout d'élément */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {ELEMENT_TYPES.map((t) => (
              <button key={t} type="button" style={miniBtn} onClick={() => addElement(si, t)}>
                {L("addElement")} · {t}
              </button>
            ))}
          </div>
        </div>
      ))}

      <div>
        <button type="button" style={{ ...miniBtn, padding: "6px 14px" }} onClick={addSheet}>
          {L("addSheet")}
        </button>
      </div>
    </div>
  );
}

function ElementRow({
  el,
  L,
  onPatch,
  onChangeType,
  onUp,
  onDown,
  onRemove,
}: {
  el: Element;
  L: (k: string) => string;
  onPatch: (p: Partial<Element>) => void;
  onChangeType: (t: ElementType) => void;
  onUp: () => void;
  onDown: () => void;
  onRemove: (() => void) | null;
}): React.ReactNode {
  return (
    <div
      style={{
        border: "1px solid var(--line-soft)",
        borderRadius: 8,
        background: "var(--bg-cream)",
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <Lbl text={L("type")}>
          <select style={fld} value={el.type} onChange={(e) => onChangeType(e.target.value as ElementType)}>
            {ELEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Lbl>
        <Lbl text={L("labelFr")}>
          <input style={fld} value={el.label_fr} onChange={(e) => onPatch({ label_fr: e.target.value })} />
        </Lbl>
        <Lbl text={L("labelEn")}>
          <input style={fld} value={el.label_en} onChange={(e) => onPatch({ label_en: e.target.value })} />
        </Lbl>
        <Lbl text={L("labelAr")}>
          <input style={fld} value={el.label_ar} onChange={(e) => onPatch({ label_ar: e.target.value })} />
        </Lbl>
        <button type="button" style={miniBtn} onClick={onUp}>
          {L("up")}
        </button>
        <button type="button" style={miniBtn} onClick={onDown}>
          {L("down")}
        </button>
        {onRemove && (
          <button type="button" style={{ ...miniBtn, color: "var(--rose)" }} onClick={onRemove}>
            {L("remove")}
          </button>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {el.type !== "label" && el.type !== "button" && el.type !== "checkbox" && (
          <Lbl text={L("placeholder")}>
            <input
              style={fld}
              value={el.placeholder ?? ""}
              onChange={(e) => onPatch({ placeholder: e.target.value || null })}
            />
          </Lbl>
        )}
        {el.type !== "label" && el.type !== "button" && (
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-2)" }}>
            <input
              type="checkbox"
              checked={!!el.required}
              onChange={(e) => onPatch({ required: e.target.checked })}
            />
            {L("required")}
          </label>
        )}
        {el.type === "button" && (
          <Lbl text={L("action")}>
            <select
              style={fld}
              value={el.action ?? "submit"}
              onChange={(e) => onPatch({ action: e.target.value as Element["action"] })}
            >
              {BUTTON_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </Lbl>
        )}
      </div>

      {el.type === "select" && <OptionsEditor el={el} L={L} onPatch={onPatch} />}
    </div>
  );
}

function OptionsEditor({
  el,
  L,
  onPatch,
}: {
  el: Element;
  L: (k: string) => string;
  onPatch: (p: Partial<Element>) => void;
}): React.ReactNode {
  const options = el.options ?? [];
  const patchOpt = (i: number, p: Partial<SelectOption>): void =>
    onPatch({ options: replaceAt(options, i, { ...options[i], ...p }) });
  const addOpt = (): void =>
    onPatch({
      options: [...options, { value: `opt_${options.length + 1}`, label_ar: "خيار", label_en: "Option", label_fr: "Option" }],
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)" }}>{L("options")}</span>
      {options.map((o, i) => (
        <div key={i} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input
            style={{ ...fld, maxWidth: 120 }}
            placeholder={L("value")}
            value={o.value}
            onChange={(e) => patchOpt(i, { value: e.target.value })}
          />
          <input style={{ ...fld, maxWidth: 140 }} value={o.label_fr} onChange={(e) => patchOpt(i, { label_fr: e.target.value })} />
          <input style={{ ...fld, maxWidth: 140 }} value={o.label_en} onChange={(e) => patchOpt(i, { label_en: e.target.value })} />
          <input style={{ ...fld, maxWidth: 140 }} value={o.label_ar} onChange={(e) => patchOpt(i, { label_ar: e.target.value })} />
          <button type="button" style={{ ...miniBtn, color: "var(--rose)" }} onClick={() => onPatch({ options: removeAt(options, i) })}>
            {L("remove")}
          </button>
        </div>
      ))}
      <div>
        <button type="button" style={miniBtn} onClick={addOpt}>
          {L("addOption")}
        </button>
      </div>
    </div>
  );
}
