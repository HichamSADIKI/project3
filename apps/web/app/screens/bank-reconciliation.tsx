"use client";

/**
 * Écran Rapprochement bancaire (deux volets) — câblé sur le module backend `bank` :
 *   GET/POST /api/admin/bank/accounts · /accounts/{id}/summary · /accounts/{id}/auto-match
 *   GET/POST /api/admin/bank/lines · /lines/import
 *   GET /lines/{id}/suggestions · POST /lines/{id}/match|unmatch
 *
 * Volet gauche : lignes de relevé ; clic sur une ligne non rapprochée → volet droit
 * montre les transactions finance suggérées à valider. Montants AED signés.
 * CSS logique (Loi 3 RTL). i18n local (useLang).
 */

import React, { useEffect, useRef, useState } from "react";

import { Topbar, IcPlus } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { getJson, postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

type Lang = "ar" | "en" | "fr";
type Account = { id: string; name: string; currency: string };
type Line = {
  id: string; value_date: string; label: string; amount: string; status: string;
  matched_transaction_id: string | null;
};
type Suggestion = {
  transaction_id: string; reference: string; amount: string; direction: string;
  status: string; due_date: string | null; paid_at: string | null;
};
type Summary = {
  reconciled_count: number; unreconciled_count: number;
  reconciled_amount: string; unreconciled_amount: string;
};

const aed = (n: string | number): string =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 }).format(
    Number(n) || 0,
  );
const signed = (n: string): string => (Number(n) >= 0 ? "+" : "") + aed(n);

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Rapprochement", account: "Compte", newAccount: "Nouveau compte", import: "Importer CSV",
    auto: "Tout rapprocher", reconciled: "Rapprochées", unreconciled: "Non rapprochées", name: "Libellé",
    lines: "Lignes de relevé", suggestions: "Suggestions", match: "Rapprocher", unmatch: "Annuler",
    matchedTo: "Rapprochée à", none: "Aucune suggestion.", selectLine: "Choisis une ligne non rapprochée.",
    empty: "Aucune ligne.", loading: "Chargement…", save: "Enregistrer", noAccount: "Crée un compte bancaire.",
    csvHint: "CSV : date,libellé,montant (montant signé : + entrée / − sortie)",
    autoDone: "rapprochement(s) automatique(s)", reconciledBadge: "rapprochée",
  },
  en: {
    title: "Reconciliation", account: "Account", newAccount: "New account", import: "Import CSV",
    auto: "Match all", reconciled: "Reconciled", unreconciled: "Unreconciled", name: "Name",
    lines: "Statement lines", suggestions: "Suggestions", match: "Match", unmatch: "Unmatch",
    matchedTo: "Matched to", none: "No suggestion.", selectLine: "Pick an unreconciled line.",
    empty: "No lines.", loading: "Loading…", save: "Save", noAccount: "Create a bank account.",
    csvHint: "CSV: date,label,amount (signed: + in / − out)",
    autoDone: "auto-match(es)", reconciledBadge: "reconciled",
  },
  ar: {
    title: "التسوية البنكية", account: "الحساب", newAccount: "حساب جديد", import: "استيراد CSV",
    auto: "تسوية الكل", reconciled: "مسوّاة", unreconciled: "غير مسوّاة", name: "الاسم",
    lines: "سطور الكشف", suggestions: "الاقتراحات", match: "تسوية", unmatch: "إلغاء",
    matchedTo: "مسوّاة مع", none: "لا اقتراح.", selectLine: "اختر سطراً غير مسوّى.",
    empty: "لا سطور.", loading: "جارٍ التحميل…", save: "حفظ", noAccount: "أنشئ حساباً بنكياً.",
    csvHint: "CSV: التاريخ,الوصف,المبلغ (موقّع: + وارد / − صادر)",
    autoDone: "تسوية تلقائية", reconciledBadge: "مسوّاة",
  },
};

const card: React.CSSProperties = {
  background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, overflow: "hidden",
};
const chip: React.CSSProperties = {
  background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 10, padding: "8px 14px",
  fontSize: 12.5,
};
const btn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--r)",
  border: "1px solid var(--line)", background: "var(--bg-paper)", color: "var(--ink)", fontSize: 12.5,
  fontWeight: 600, cursor: "pointer",
};

export function ScreenBankReconciliation(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountId] = useState<string>("");
  const [lines, setLines] = useState<Line[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selected, setSelected] = useState<Line | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function loadAccounts(): Promise<void> {
    try {
      const r = await getJson<{ data: Account[] }>("/api/admin/bank/accounts?limit=100");
      setAccounts(r.data);
      if (r.data.length && !accountId) setAccountId(r.data[0].id);
    } catch { setAccounts([]); }
  }
  async function loadLines(acc: string): Promise<void> {
    if (!acc) { setLines([]); return; }
    try {
      const r = await getJson<{ data: Line[] }>(`/api/admin/bank/lines?bank_account_id=${acc}&limit=100`);
      setLines(r.data);
    } catch { setLines([]); }
  }
  async function loadSummary(acc: string): Promise<void> {
    if (!acc) { setSummary(null); return; }
    try {
      const r = await getJson<{ data: Summary }>(`/api/admin/bank/accounts/${acc}/summary`);
      setSummary(r.data);
    } catch { setSummary(null); }
  }
  function refresh(acc: string): void {
    void loadLines(acc); void loadSummary(acc); setSelected(null); setSuggestions([]);
  }

  useEffect(() => { void loadAccounts(); }, []);
  useEffect(() => { if (accountId) refresh(accountId); }, [accountId]);

  async function selectLine(line: Line): Promise<void> {
    setSelected(line); setSuggestions([]);
    if (line.status === "reconciled") return;
    try {
      const r = await getJson<{ data: Suggestion[] }>(`/api/admin/bank/lines/${line.id}/suggestions`);
      setSuggestions(r.data);
    } catch { setSuggestions([]); }
  }

  async function doMatch(lineId: string, txnId: string): Promise<void> {
    const res = await postJson(`/api/admin/bank/lines/${lineId}/match`, { transaction_id: txnId });
    if (res.ok) refresh(accountId);
  }
  async function doUnmatch(lineId: string): Promise<void> {
    const res = await postJson(`/api/admin/bank/lines/${lineId}/unmatch`, {});
    if (res.ok) refresh(accountId);
  }
  async function doAutoMatch(): Promise<void> {
    const res = await postJson(`/api/admin/bank/accounts/${accountId}/auto-match`, {});
    if (res.ok) {
      const body = (await res.json()) as { data?: { matched?: number } };
      setNote(`${body.data?.matched ?? 0} ${L("autoDone")}`);
      refresh(accountId);
    }
  }

  // Import CSV : parse client-side (date,libellé,montant) → POST en masse.
  async function onCsv(file: File): Promise<void> {
    const text = await file.text();
    const rows = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(/[;,\t]/).map((c) => c.trim()))
      .filter((cols) => cols.length >= 3 && !Number.isNaN(Number(cols[2])));
    const lines2 = rows.map((c) => ({ value_date: c[0], label: c[1], amount: Number(c[2]) }));
    if (!lines2.length) { setNote("CSV ?"); return; }
    const res = await postJson("/api/admin/bank/lines/import", { bank_account_id: accountId, lines: lines2 });
    if (res.ok) {
      const body = (await res.json()) as { data?: { created?: number } };
      setNote(`+${body.data?.created ?? 0}`);
      refresh(accountId);
    } else {
      setNote(await extractError(res, "import_failed"));
    }
  }

  // Création de compte
  const [accOpen, setAccOpen] = useState(false);
  const [accSaving, setAccSaving] = useState(false);
  const [accErr, setAccErr] = useState<string | null>(null);
  const [accName, setAccName] = useState("");
  async function submitAccount(): Promise<void> {
    if (!accName) { setAccErr("name"); return; }
    setAccSaving(true); setAccErr(null);
    try {
      const res = await postJson("/api/admin/bank/accounts", { name: accName });
      if (!res.ok) { setAccErr(await extractError(res, "save_failed")); setAccSaving(false); return; }
      const body = (await res.json()) as { data: Account };
      setAccName(""); setAccOpen(false);
      await loadAccounts();
      setAccountId(body.data.id);
    } catch { setAccErr("save_failed"); } finally { setAccSaving(false); }
  }

  const statusBadge = (s: string): React.ReactNode => (
    <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999,
      background: s === "reconciled" ? "rgba(16,185,129,0.12)" : "var(--line-soft)",
      color: s === "reconciled" ? "var(--emerald)" : "var(--ink-4)" }}>
      {s === "reconciled" ? L("reconciledBadge") : L("unreconciled")}
    </span>
  );

  return (
    <div data-testid="screen-bank_recon" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={L("title")} />
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", background: "var(--bg-cream)", display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Barre d'actions */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} style={{ ...fieldInput, width: "auto" }}>
            {accounts.length === 0 && <option value="">—</option>}
            {accounts.map((a) => (<option key={a.id} value={a.id}>{a.name}</option>))}
          </select>
          <button onClick={() => { setAccOpen(true); setAccErr(null); }} style={btn}><IcPlus /> {L("newAccount")}</button>
          <button onClick={() => fileRef.current?.click()} disabled={!accountId} style={{ ...btn, opacity: accountId ? 1 : 0.5 }}>⬆ {L("import")}</button>
          <button onClick={() => void doAutoMatch()} disabled={!accountId} style={{ ...btn, background: "var(--gold)", color: "#1A1610", border: "none", opacity: accountId ? 1 : 0.5 }}>⚡ {L("auto")}</button>
          <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void onCsv(f); e.target.value = ""; }} />
          {note && <span style={{ fontSize: 12.5, color: "var(--gold-deep)", fontWeight: 600 }}>{note}</span>}
        </div>

        {/* Puces résumé */}
        {summary && (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <span style={chip}>{L("reconciled")} : <b style={{ color: "var(--emerald)" }}>{summary.reconciled_count}</b> · {aed(summary.reconciled_amount)}</span>
            <span style={chip}>{L("unreconciled")} : <b style={{ color: "var(--rose)" }}>{summary.unreconciled_count}</b> · {aed(summary.unreconciled_amount)}</span>
          </div>
        )}

        {accounts.length === 0 ? (
          <div style={{ ...card, padding: 20, color: "var(--ink-4)", fontSize: 13 }}>{L("noAccount")}</div>
        ) : (
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Volet gauche — lignes */}
            <div style={{ ...card, flex: "1 1 420px", minWidth: 320 }}>
              <div style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--ink-4)", textTransform: "uppercase", borderBottom: "1px solid var(--line-soft)" }}>{L("lines")}</div>
              {lines.length === 0 && <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>{L("empty")}</div>}
              {lines.map((line) => {
                const isSel = selected?.id === line.id;
                return (
                  <div key={line.id} onClick={() => void selectLine(line)}
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                      padding: "10px 14px", borderBottom: "1px solid var(--line-soft)", cursor: "pointer",
                      background: isSel ? "var(--bg-cream)" : "transparent" }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{line.label}</div>
                      <div className="tnum" style={{ fontSize: 11, color: "var(--ink-4)", direction: "ltr", textAlign: "start" }}>{line.value_date}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className="tnum" style={{ fontWeight: 600, color: Number(line.amount) >= 0 ? "var(--emerald)" : "var(--rose)" }}>{signed(line.amount)}</span>
                      {statusBadge(line.status)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Volet droit — suggestions / état */}
            <div style={{ ...card, flex: "1 1 420px", minWidth: 320 }}>
              <div style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--ink-4)", textTransform: "uppercase", borderBottom: "1px solid var(--line-soft)" }}>{L("suggestions")}</div>
              {!selected && <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>{L("selectLine")}</div>}
              {selected && selected.status === "reconciled" && (
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{L("matchedTo")} <b className="tnum">{selected.matched_transaction_id?.slice(0, 8)}</b></div>
                  <button onClick={() => void doUnmatch(selected.id)} style={{ ...btn, alignSelf: "start", background: "var(--rose-soft)", color: "var(--rose)", border: "none" }}>{L("unmatch")}</button>
                </div>
              )}
              {selected && selected.status !== "reconciled" && suggestions.length === 0 && (
                <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>{L("none")}</div>
              )}
              {selected && selected.status !== "reconciled" && suggestions.map((s) => (
                <div key={s.transaction_id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--line-soft)" }}>
                  <div>
                    <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--gold-deep)" }}>{s.reference}</div>
                    <div className="tnum" style={{ fontSize: 11, color: "var(--ink-4)" }}>{aed(s.amount)} · {s.direction} · {s.status}</div>
                  </div>
                  <button onClick={() => void doMatch(selected.id, s.transaction_id)} style={{ ...btn, background: "rgba(16,185,129,0.12)", color: "var(--emerald)", border: "none" }}>✓ {L("match")}</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <CreateModal title={L("newAccount")} open={accOpen} saving={accSaving} error={accErr} onClose={() => setAccOpen(false)} onSubmit={() => void submitAccount()}>
        <Field label={L("name")}>
          <input value={accName} onChange={(e) => setAccName(e.target.value)} placeholder="Emirates NBD" style={fieldInput} />
        </Field>
        <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{L("csvHint")}</div>
      </CreateModal>
    </div>
  );
}
