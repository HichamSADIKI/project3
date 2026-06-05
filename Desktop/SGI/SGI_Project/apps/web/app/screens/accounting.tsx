"use client";

/**
 * Écran Comptabilité — câblé sur le module backend `accounting` (grand-livre en
 * partie double) :
 *   GET/POST /api/admin/accounting/accounts        → plan de comptes
 *   GET/POST /api/admin/accounting/entries         → écritures (≥2 lignes équilibrées)
 *   POST     /api/admin/accounting/entries/{id}/post|void
 *   GET      /api/admin/accounting/trial-balance   → balance générale
 *
 * Montants AED, chiffres latins. CSS logique (Loi 3 RTL). i18n local (useLang).
 */

import React, { useEffect, useState } from "react";

import { Topbar, IcPlus } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

type Lang = "ar" | "en" | "fr";
const ACCOUNT_TYPES = ["asset", "liability", "equity", "revenue", "expense"] as const;

type Account = { id: string; code: string; name_en: string; type: string; is_active: boolean };
type EntryItem = {
  id: string; reference: string; entry_date: string; description: string | null; status: string;
};
type TrialRow = {
  account_id: string; code: string; name_en: string; type: string;
  total_debit: string; total_credit: string; balance: string;
};
type Trial = { rows: TrialRow[]; total_debit: string; total_credit: string };
type LineForm = { account_id: string; debit: string; credit: string };

const aed = (n: string | number): string =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 }).format(
    Number(n) || 0,
  );

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Comptabilité", accounts: "Plan de comptes", entries: "Écritures", balance: "Balance générale",
    add: "Ajouter", newAccount: "Nouveau compte", newEntry: "Nouvelle écriture", code: "Code", name: "Libellé",
    type: "Type", date: "Date", description: "Description", account: "Compte", debit: "Débit", credit: "Crédit",
    line: "Ligne", addLine: "+ Ligne", totals: "Totaux", balanced: "Équilibrée", unbalanced: "Déséquilibrée",
    reference: "Référence", status: "Statut", action: "Action", post: "Comptabiliser", void: "Annuler",
    loading: "Chargement…", empty: "Aucune donnée.", save: "Enregistrer", grandTotal: "Total général",
    asset: "Actif", liability: "Passif", equity: "Capitaux", revenue: "Produits", expense: "Charges",
    draft: "Brouillon", posted: "Comptabilisée", void_s: "Annulée", needBalance: "Débits et crédits doivent s'équilibrer (et > 0).",
    active: "Actif", inactive: "Inactif",
  },
  en: {
    title: "Accounting", accounts: "Chart of accounts", entries: "Journal entries", balance: "Trial balance",
    add: "Add", newAccount: "New account", newEntry: "New entry", code: "Code", name: "Name",
    type: "Type", date: "Date", description: "Description", account: "Account", debit: "Debit", credit: "Credit",
    line: "Line", addLine: "+ Line", totals: "Totals", balanced: "Balanced", unbalanced: "Unbalanced",
    reference: "Reference", status: "Status", action: "Action", post: "Post", void: "Void",
    loading: "Loading…", empty: "No data.", save: "Save", grandTotal: "Grand total",
    asset: "Asset", liability: "Liability", equity: "Equity", revenue: "Revenue", expense: "Expense",
    draft: "Draft", posted: "Posted", void_s: "Void", needBalance: "Debits and credits must balance (and be > 0).",
    active: "Active", inactive: "Inactive",
  },
  ar: {
    title: "المحاسبة", accounts: "دليل الحسابات", entries: "القيود", balance: "ميزان المراجعة",
    add: "إضافة", newAccount: "حساب جديد", newEntry: "قيد جديد", code: "الرمز", name: "الاسم",
    type: "النوع", date: "التاريخ", description: "الوصف", account: "الحساب", debit: "مدين", credit: "دائن",
    line: "سطر", addLine: "+ سطر", totals: "الإجماليات", balanced: "متوازن", unbalanced: "غير متوازن",
    reference: "المرجع", status: "الحالة", action: "إجراء", post: "ترحيل", void: "إلغاء",
    loading: "جارٍ التحميل…", empty: "لا بيانات.", save: "حفظ", grandTotal: "الإجمالي العام",
    asset: "أصول", liability: "خصوم", equity: "حقوق ملكية", revenue: "إيرادات", expense: "مصروفات",
    draft: "مسودة", posted: "مُرحّل", void_s: "ملغى", needBalance: "يجب أن يتوازن المدين والدائن (وأكبر من صفر).",
    active: "نشط", inactive: "غير نشط",
  },
};

const STATUS_COLOR: Record<string, { c: string; b: string }> = {
  draft: { c: "var(--gold-deep)", b: "rgba(212,160,55,0.14)" },
  posted: { c: "var(--emerald)", b: "rgba(16,185,129,0.12)" },
  void: { c: "var(--ink-4)", b: "var(--line-soft)" },
};

const card: React.CSSProperties = {
  background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, overflow: "hidden",
};
const th: React.CSSProperties = { textAlign: "start", padding: "12px 16px", fontWeight: 600 };
const td: React.CSSProperties = { padding: "12px 16px", color: "var(--ink-2)" };

export function ScreenAccounting(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;
  const typeLabel = (t: string): string => L(t);
  const statusLabel = (s: string): string => L(s === "void" ? "void_s" : s);

  const [view, setView] = useState<"accounts" | "entries" | "balance">("accounts");
  const accounts = useApiList<Account>("/api/admin/accounting/accounts?limit=200");
  const entries = useApiList<EntryItem>("/api/admin/accounting/entries?limit=100");
  const [trial, setTrial] = useState<Trial | null>(null);

  useEffect(() => {
    if (view === "balance") {
      // L'endpoint renvoie {success, data: TrialBalance} → on extrait `data`.
      getJson<{ data: Trial }>("/api/admin/accounting/trial-balance")
        .then((r) => setTrial(r.data))
        .catch(() => setTrial(null));
    }
  }, [view]);

  // ── Création de compte ──────────────────────────────────────────────
  const [accOpen, setAccOpen] = useState(false);
  const [accSaving, setAccSaving] = useState(false);
  const [accErr, setAccErr] = useState<string | null>(null);
  const [accForm, setAccForm] = useState({ code: "", name_en: "", type: "asset" });

  async function submitAccount() {
    if (!accForm.code || !accForm.name_en) { setAccErr("code/name"); return; }
    setAccSaving(true); setAccErr(null);
    try {
      const res = await postJson("/api/admin/accounting/accounts", accForm);
      if (!res.ok) { setAccErr(await extractError(res, "save_failed")); setAccSaving(false); return; }
      setAccForm({ code: "", name_en: "", type: "asset" }); setAccOpen(false); accounts.reload();
    } catch { setAccErr("save_failed"); } finally { setAccSaving(false); }
  }

  // ── Création d'écriture (≥2 lignes équilibrées) ──────────────────────
  const [entOpen, setEntOpen] = useState(false);
  const [entSaving, setEntSaving] = useState(false);
  const [entErr, setEntErr] = useState<string | null>(null);
  const [entDate, setEntDate] = useState("");
  const [entDesc, setEntDesc] = useState("");
  const [lines, setLines] = useState<LineForm[]>([
    { account_id: "", debit: "", credit: "" },
    { account_id: "", debit: "", credit: "" },
  ]);
  const sumDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
  const sumCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);
  const isBalanced = sumDebit > 0 && Math.abs(sumDebit - sumCredit) < 0.005;

  function setLine(i: number, patch: Partial<LineForm>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function resetEntry() {
    setEntDate(""); setEntDesc("");
    setLines([{ account_id: "", debit: "", credit: "" }, { account_id: "", debit: "", credit: "" }]);
  }

  async function submitEntry() {
    if (!entDate) { setEntErr("date"); return; }
    if (!isBalanced) { setEntErr(L("needBalance")); return; }
    const payloadLines = lines
      .filter((l) => l.account_id && (Number(l.debit) > 0 || Number(l.credit) > 0))
      .map((l) => ({ account_id: l.account_id, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 }));
    if (payloadLines.length < 2) { setEntErr(L("needBalance")); return; }
    setEntSaving(true); setEntErr(null);
    try {
      const res = await postJson("/api/admin/accounting/entries", {
        entry_date: entDate, description: entDesc || null, lines: payloadLines,
      });
      if (!res.ok) { setEntErr(await extractError(res, "save_failed")); setEntSaving(false); return; }
      resetEntry(); setEntOpen(false); entries.reload();
    } catch { setEntErr("save_failed"); } finally { setEntSaving(false); }
  }

  async function entryAction(id: string, action: "post" | "void") {
    const res = await postJson(`/api/admin/accounting/entries/${id}/${action}`, {});
    if (res.ok) entries.reload();
  }

  const tab = (key: typeof view, label: string): React.ReactNode => (
    <button
      onClick={() => setView(key)}
      style={{
        padding: "8px 16px", borderRadius: 999, border: "1px solid var(--line)", cursor: "pointer",
        fontSize: 13, fontWeight: 600,
        background: view === key ? "var(--gold)" : "var(--bg-paper)",
        color: view === key ? "#1A1610" : "var(--ink-3)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={L("title")} />
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px", background: "var(--bg-cream)", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {tab("accounts", L("accounts"))}
          {tab("entries", L("entries"))}
          {tab("balance", L("balance"))}
          <div style={{ marginInlineStart: "auto" }}>
            {view === "accounts" && (
              <button onClick={() => { setAccOpen(true); setAccErr(null); }} style={addBtn}><IcPlus /> {L("newAccount")}</button>
            )}
            {view === "entries" && (
              <button onClick={() => { setEntOpen(true); setEntErr(null); }} style={addBtn}><IcPlus /> {L("newEntry")}</button>
            )}
          </div>
        </div>

        {/* ── Plan de comptes ── */}
        {view === "accounts" && (
          <div style={card}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase" }}>
                <th style={th}>{L("code")}</th><th style={th}>{L("name")}</th><th style={th}>{L("type")}</th><th style={th}>{L("status")}</th>
              </tr></thead>
              <tbody>
                {!accounts.loading && accounts.items.length === 0 && (
                  <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--ink-4)" }}>{L("empty")}</td></tr>
                )}
                {accounts.items.map((a) => (
                  <tr key={a.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td className="tnum" style={{ ...td, fontWeight: 600, color: "var(--gold-deep)" }}>{a.code}</td>
                    <td style={td}>{a.name_en}</td>
                    <td style={td}>{typeLabel(a.type)}</td>
                    <td style={td}>{a.is_active ? L("active") : L("inactive")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Écritures ── */}
        {view === "entries" && (
          <div style={card}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase" }}>
                <th style={th}>{L("reference")}</th><th style={th}>{L("date")}</th><th style={th}>{L("description")}</th>
                <th style={th}>{L("status")}</th><th style={{ ...th, textAlign: "end" }}>{L("action")}</th>
              </tr></thead>
              <tbody>
                {!entries.loading && entries.items.length === 0 && (
                  <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--ink-4)" }}>{L("empty")}</td></tr>
                )}
                {entries.items.map((e) => {
                  const st = STATUS_COLOR[e.status] ?? { c: "var(--ink-3)", b: "var(--line-soft)" };
                  return (
                    <tr key={e.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                      <td className="tnum" style={{ ...td, fontWeight: 600, color: "var(--gold-deep)" }}>{e.reference}</td>
                      <td className="tnum" style={td}>{e.entry_date}</td>
                      <td style={td}>{e.description ?? "—"}</td>
                      <td style={td}><span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.b, color: st.c }}>{statusLabel(e.status)}</span></td>
                      <td style={{ ...td, textAlign: "end" }}>
                        {e.status === "draft" && (
                          <button onClick={() => entryAction(e.id, "post")} style={postBtn}>{L("post")}</button>
                        )}
                        {e.status !== "void" && (
                          <button onClick={() => entryAction(e.id, "void")} style={voidBtn}>{L("void")}</button>
                        )}
                        {e.status === "void" && <span style={{ color: "var(--ink-4)" }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Balance générale ── */}
        {view === "balance" && (
          <div style={card}>
            {!trial || !trial.rows ? (
              <div style={{ padding: 20, color: "var(--ink-4)", fontSize: 13 }}>{L("loading")}</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead><tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase" }}>
                  <th style={th}>{L("code")}</th><th style={th}>{L("name")}</th><th style={th}>{L("type")}</th>
                  <th style={{ ...th, textAlign: "end" }}>{L("debit")}</th><th style={{ ...th, textAlign: "end" }}>{L("credit")}</th>
                </tr></thead>
                <tbody>
                  {trial.rows.length === 0 && (
                    <tr><td colSpan={5} style={{ ...td, textAlign: "center", color: "var(--ink-4)" }}>{L("empty")}</td></tr>
                  )}
                  {trial.rows.map((r) => (
                    <tr key={r.account_id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                      <td className="tnum" style={{ ...td, fontWeight: 600, color: "var(--gold-deep)" }}>{r.code}</td>
                      <td style={td}>{r.name_en}</td>
                      <td style={td}>{typeLabel(r.type)}</td>
                      <td className="tnum" style={{ ...td, textAlign: "end" }}>{aed(r.total_debit)}</td>
                      <td className="tnum" style={{ ...td, textAlign: "end" }}>{aed(r.total_credit)}</td>
                    </tr>
                  ))}
                  <tr style={{ borderTop: "2px solid var(--line)", fontWeight: 700 }}>
                    <td style={td} colSpan={3}>{L("grandTotal")}</td>
                    <td className="tnum" style={{ ...td, textAlign: "end", color: "var(--emerald)" }}>{aed(trial.total_debit)}</td>
                    <td className="tnum" style={{ ...td, textAlign: "end", color: "var(--emerald)" }}>{aed(trial.total_credit)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Modal compte ── */}
      <CreateModal title={L("newAccount")} open={accOpen} saving={accSaving} error={accErr} onClose={() => setAccOpen(false)} onSubmit={() => void submitAccount()}>
        <Field label={L("code")}>
          <input value={accForm.code} onChange={(e) => setAccForm({ ...accForm, code: e.target.value })} placeholder="1000" style={fieldInput} />
        </Field>
        <Field label={L("name")}>
          <input value={accForm.name_en} onChange={(e) => setAccForm({ ...accForm, name_en: e.target.value })} placeholder="Cash" style={fieldInput} />
        </Field>
        <Field label={L("type")}>
          <select value={accForm.type} onChange={(e) => setAccForm({ ...accForm, type: e.target.value })} style={fieldInput}>
            {ACCOUNT_TYPES.map((t) => (<option key={t} value={t}>{typeLabel(t)}</option>))}
          </select>
        </Field>
      </CreateModal>

      {/* ── Modal écriture ── */}
      <CreateModal title={L("newEntry")} open={entOpen} saving={entSaving} error={entErr} onClose={() => setEntOpen(false)} onSubmit={() => void submitEntry()}>
        <Field label={L("date")}>
          <input type="date" value={entDate} onChange={(e) => setEntDate(e.target.value)} style={fieldInput} />
        </Field>
        <Field label={L("description")}>
          <input value={entDesc} onChange={(e) => setEntDesc(e.target.value)} style={fieldInput} />
        </Field>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {lines.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <select value={l.account_id} onChange={(e) => setLine(i, { account_id: e.target.value })} style={{ ...fieldInput, flex: 2 }}>
                <option value="">{L("account")}</option>
                {accounts.items.map((a) => (<option key={a.id} value={a.id}>{a.code} · {a.name_en}</option>))}
              </select>
              <input type="number" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: "" })} placeholder={L("debit")} style={{ ...fieldInput, flex: 1 }} />
              <input type="number" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: "" })} placeholder={L("credit")} style={{ ...fieldInput, flex: 1 }} />
            </div>
          ))}
          <button type="button" onClick={() => setLines((ls) => [...ls, { account_id: "", debit: "", credit: "" }])} style={{ alignSelf: "start", background: "none", border: "none", color: "var(--gold-deep)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>{L("addLine")}</button>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, fontWeight: 600, paddingTop: 6, borderTop: "1px solid var(--line-soft)" }}>
            <span style={{ color: isBalanced ? "var(--emerald)" : "var(--rose)" }}>{isBalanced ? L("balanced") : L("unbalanced")}</span>
            <span className="tnum">{aed(sumDebit)} / {aed(sumCredit)}</span>
          </div>
        </div>
      </CreateModal>
    </div>
  );
}

const addBtn: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "var(--gold)",
  color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer",
};
const postBtn: React.CSSProperties = {
  border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11.5, fontWeight: 600,
  background: "rgba(16,185,129,0.12)", color: "var(--emerald)", marginInlineEnd: 6,
};
const voidBtn: React.CSSProperties = {
  border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 11.5, fontWeight: 600,
  background: "var(--rose-soft)", color: "var(--rose)",
};
