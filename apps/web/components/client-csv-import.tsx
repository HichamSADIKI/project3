"use client";

/**
 * Import CSV de clients — bouton + sélecteur de fichier + rapport de résultat.
 * Auto-suffisant : POST multipart vers /api/admin/clients/import, affiche
 * créés / échecs / erreurs par ligne. CSS logique (Loi 3). i18n local.
 */
import React, { useRef, useState } from "react";

import { useLang } from "@/components/language-provider";
import { postForm } from "@/lib/api-client";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: { btn: "Importer (CSV)", importing: "Import…", title: "Résultat de l'import", created: "Créés", failed: "Échecs", line: "Ligne", close: "Fermer", failedMsg: "Échec de l'import" },
  en: { btn: "Import (CSV)", importing: "Importing…", title: "Import result", created: "Created", failed: "Failed", line: "Line", close: "Close", failedMsg: "Import failed" },
  ar: { btn: "استيراد (CSV)", importing: "جارٍ الاستيراد…", title: "نتيجة الاستيراد", created: "أُنشئت", failed: "فشل", line: "سطر", close: "إغلاق", failedMsg: "فشل الاستيراد" },
};

type ImportReport = { created: number; failed: number; total: number; errors: { line: number; error: string }[] };

export function ClientCsvImport({ onDone }: { onDone?: () => void }): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = ""; // permet de réimporter le même fichier
    if (!file) return;
    setBusy(true);
    setError(null);
    setReport(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await postForm("/api/admin/clients/import", fd);
      if (!res.ok) {
        setError(L("failedMsg"));
        return;
      }
      const body = (await res.json()) as { data: ImportReport };
      setReport(body.data);
      onDone?.();
    } catch {
      setError(L("failedMsg"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px",
          borderRadius: "var(--r)", border: "1px solid var(--line)", background: "var(--bg-paper)",
          color: "var(--ink-2)", fontSize: 13, fontWeight: 600, cursor: busy ? "default" : "pointer",
          opacity: busy ? 0.6 : 1,
        }}
      >
        ⤒ {busy ? L("importing") : L("btn")}
      </button>
      <input ref={inputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onFile} />

      {(report || error) && (
        <div
          role="dialog"
          aria-label={L("title")}
          onClick={() => { setReport(null); setError(null); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
        >
          <div onClick={(ev) => ev.stopPropagation()} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 14, width: "min(480px,100%)", maxHeight: "80vh", overflow: "auto", padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBlockEnd: 12 }}>
              <strong style={{ fontSize: 15 }}>{L("title")}</strong>
              <button type="button" onClick={() => { setReport(null); setError(null); }} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-4)", fontSize: 13 }}>{L("close")}</button>
            </div>
            {error && <div style={{ color: "var(--rose)", fontSize: 13 }}>{error}</div>}
            {report && (
              <>
                <div style={{ display: "flex", gap: 16, marginBlockEnd: 12 }}>
                  <span style={{ color: "var(--emerald)", fontWeight: 700 }}>{L("created")}: {report.created}</span>
                  <span style={{ color: report.failed ? "var(--rose)" : "var(--ink-4)", fontWeight: 700 }}>{L("failed")}: {report.failed}</span>
                </div>
                {report.errors.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {report.errors.map((er, i) => (
                      <div key={i} style={{ fontSize: 12, color: "var(--ink-3)", borderBlockEnd: "1px solid var(--line-soft)", paddingBlock: 4 }}>
                        <span style={{ color: "var(--ink-4)" }}>{L("line")} {er.line}:</span> {er.error}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
