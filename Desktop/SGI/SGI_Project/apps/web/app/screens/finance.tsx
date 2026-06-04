"use client";

/**
 * Écran Finance — câblé sur le backend `finance` (remplace l'ancien mock) :
 *   GET  /api/admin/finance/summary        → KPIs agrégés du tenant
 *   GET  /api/admin/finance/transactions   → ledger paginé (filtres type/statut)
 *   POST /api/admin/finance/transactions   → création de transaction
 *
 * Montants en AED, chiffres latins. CSS strictement logique (Loi 3 RTL).
 * Libellés localisés en local (via useLang) pour ne pas toucher i18n.ts partagé.
 */

import React, { useEffect, useState } from "react";

import { Topbar, IcPlus } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";

type Lang = "ar" | "en" | "fr";
type Txn = {
  id: string;
  reference: string;
  type: string;
  direction: string;
  amount: string;
  currency: string;
  status: string;
  description_en: string | null;
  description_ar: string | null;
  description_fr: string | null;
  due_date: string | null;
  created_at: string;
};
type Summary = {
  total_revenue: string;
  total_expenses: string;
  net: string;
  pending_invoices: number;
  pending_amount: string;
  paid_this_month: string;
};

const aed = (n: string | number): string =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(
    Number(n) || 0,
  );

// ── i18n local (évite de toucher le i18n.ts partagé, sujet à conflits) ──────
const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Finance", revenue: "Revenus encaissés", expenses: "Dépenses", net: "Résultat net",
    pending: "Factures en attente", paidMonth: "Encaissé ce mois", newTxn: "Nouvelle transaction",
    type: "Type", direction: "Sens", amount: "Montant (AED)", description: "Description", dueDate: "Échéance",
    allTypes: "Tous types", allStatus: "Tous statuts", empty: "Aucune transaction", ref: "Réf.",
    status: "Statut", date: "Date", invalidAmount: "Montant invalide", loading: "Chargement…",
    credit: "Crédit", debit: "Débit",
  },
  en: {
    title: "Finance", revenue: "Revenue collected", expenses: "Expenses", net: "Net result",
    pending: "Pending invoices", paidMonth: "Collected this month", newTxn: "New transaction",
    type: "Type", direction: "Direction", amount: "Amount (AED)", description: "Description", dueDate: "Due date",
    allTypes: "All types", allStatus: "All statuses", empty: "No transactions", ref: "Ref.",
    status: "Status", date: "Date", invalidAmount: "Invalid amount", loading: "Loading…",
    credit: "Credit", debit: "Debit",
  },
  ar: {
    title: "المالية", revenue: "الإيرادات المحصّلة", expenses: "المصروفات", net: "صافي النتيجة",
    pending: "فواتير معلّقة", paidMonth: "محصّل هذا الشهر", newTxn: "معاملة جديدة",
    type: "النوع", direction: "الاتجاه", amount: "المبلغ (درهم)", description: "الوصف", dueDate: "تاريخ الاستحقاق",
    allTypes: "كل الأنواع", allStatus: "كل الحالات", empty: "لا توجد معاملات", ref: "المرجع",
    status: "الحالة", date: "التاريخ", invalidAmount: "مبلغ غير صالح", loading: "جارٍ التحميل…",
    credit: "دائن", debit: "مدين",
  },
};
const TYPES = ["invoice", "payment", "expense", "commission", "refund"] as const;
const STATUSES = ["pending", "paid", "overdue", "cancelled"] as const;
const TYPE_LABEL: Record<Lang, Record<string, string>> = {
  fr: { invoice: "Facture", payment: "Paiement", expense: "Dépense", commission: "Commission", refund: "Remboursement" },
  en: { invoice: "Invoice", payment: "Payment", expense: "Expense", commission: "Commission", refund: "Refund" },
  ar: { invoice: "فاتورة", payment: "دفعة", expense: "مصروف", commission: "عمولة", refund: "استرداد" },
};
const STATUS_LABEL: Record<Lang, Record<string, string>> = {
  fr: { pending: "En attente", paid: "Payé", overdue: "En retard", cancelled: "Annulé" },
  en: { pending: "Pending", paid: "Paid", overdue: "Overdue", cancelled: "Cancelled" },
  ar: { pending: "معلّق", paid: "مدفوع", overdue: "متأخر", cancelled: "ملغى" },
};
const STATUS_COLOR: Record<string, { c: string; bg: string }> = {
  pending: { c: "var(--ink-4)", bg: "var(--line-soft)" },
  paid: { c: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  overdue: { c: "var(--rose)", bg: "var(--rose-soft, rgba(214,69,93,0.12))" },
  cancelled: { c: "var(--ink-4)", bg: "var(--line-soft)" },
};

export function ScreenFinance(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const [typeF, setTypeF] = useState("");
  const [statusF, setStatusF] = useState("");
  const qs = new URLSearchParams({
    limit: "50",
    ...(typeF ? { type: typeF } : {}),
    ...(statusF ? { status: statusF } : {}),
  }).toString();
  const { items, loading, error, reload } = useApiList<Txn>(`/api/admin/finance/transactions?${qs}`);

  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    getJson<Summary>("/api/admin/finance/summary")
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [items]);

  // Création
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState({ type: "invoice", direction: "credit", amount: "", description: "", due_date: "" });

  async function submit(): Promise<void> {
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError(L("invalidAmount"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await postJson("/api/admin/finance/transactions", {
        type: form.type,
        direction: form.direction,
        amount: Number(form.amount),
        [`description_${lg}`]: form.description || undefined,
        due_date: form.due_date || undefined,
      });
      if (!res.ok) {
        setFormError(await extractError(res, "save_failed"));
        return;
      }
      setForm({ type: "invoice", direction: "credit", amount: "", description: "", due_date: "" });
      setOpen(false);
      reload();
    } catch {
      setFormError("save_failed");
    } finally {
      setSaving(false);
    }
  }

  const kpi = (label: string, value: string, accent?: string): React.ReactNode => (
    <div style={{ flex: "1 1 150px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBlockEnd: 6 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: accent ?? "var(--ink)" }}>{value}</div>
    </div>
  );

  const desc = (tx: Txn): string =>
    (lg === "ar" ? tx.description_ar : lg === "en" ? tx.description_en : tx.description_fr) ??
    tx.description_en ??
    tx.description_fr ??
    "—";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title={L("title")}>
        <button onClick={() => { setOpen(true); setFormError(null); }} className="sgi-btn sgi-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <IcPlus />&nbsp;{L("newTxn")}
        </button>
      </Topbar>

      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16, background: "var(--bg-cream)" }}>
        {/* KPIs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {kpi(L("revenue"), summary ? aed(summary.total_revenue) : "—", "var(--emerald)")}
          {kpi(L("expenses"), summary ? aed(summary.total_expenses) : "—", "var(--rose)")}
          {kpi(L("net"), summary ? aed(summary.net) : "—")}
          {kpi(L("pending"), summary ? `${summary.pending_invoices} · ${aed(summary.pending_amount)}` : "—")}
          {kpi(L("paidMonth"), summary ? aed(summary.paid_this_month) : "—")}
        </div>

        {/* Filtres */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} style={{ ...fieldInput, width: "auto" }}>
            <option value="">{L("allTypes")}</option>
            {TYPES.map((ty) => (<option key={ty} value={ty}>{TYPE_LABEL[lg][ty]}</option>))}
          </select>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={{ ...fieldInput, width: "auto" }}>
            <option value="">{L("allStatus")}</option>
            {STATUSES.map((s) => (<option key={s} value={s}>{STATUS_LABEL[lg][s]}</option>))}
          </select>
        </div>

        {/* Ledger */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, overflow: "hidden" }}>
          {error && <div style={{ padding: 16, color: "var(--rose)", fontSize: 12.5 }}>{error}</div>}
          {loading && !items.length ? (
            <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>{L("loading")}</div>
          ) : items.length === 0 ? (
            <div style={{ padding: 16, color: "var(--ink-4)", fontSize: 12.5 }}>{L("empty")}</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: "var(--ink-4)" }}>
                  <th style={{ padding: "10px 14px", textAlign: "start", fontWeight: 600 }}>{L("ref")}</th>
                  <th style={{ padding: "10px 14px", textAlign: "start", fontWeight: 600 }}>{L("type")}</th>
                  <th style={{ padding: "10px 14px", textAlign: "start", fontWeight: 600 }}>{L("description")}</th>
                  <th style={{ padding: "10px 14px", textAlign: "end", fontWeight: 600 }}>{L("amount")}</th>
                  <th style={{ padding: "10px 14px", textAlign: "start", fontWeight: 600 }}>{L("status")}</th>
                  <th style={{ padding: "10px 14px", textAlign: "start", fontWeight: 600 }}>{L("date")}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((tx) => {
                  const sc = STATUS_COLOR[tx.status] ?? STATUS_COLOR.pending;
                  const credit = tx.direction === "credit";
                  return (
                    <tr key={tx.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                      <td style={{ padding: "10px 14px", color: "var(--ink-3)", direction: "ltr", textAlign: "start" }}>{tx.reference}</td>
                      <td style={{ padding: "10px 14px", color: "var(--ink)" }}>{TYPE_LABEL[lg][tx.type] ?? tx.type}</td>
                      <td style={{ padding: "10px 14px", color: "var(--ink-3)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{desc(tx)}</td>
                      <td style={{ padding: "10px 14px", textAlign: "end", fontWeight: 600, color: credit ? "var(--emerald)" : "var(--rose)" }}>
                        {credit ? "+" : "−"}{aed(tx.amount)}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: sc.c, background: sc.bg, borderRadius: 999, padding: "2px 9px" }}>
                          {STATUS_LABEL[lg][tx.status] ?? tx.status}
                        </span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "var(--ink-4)", direction: "ltr", textAlign: "start" }}>{tx.created_at.slice(0, 10)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <CreateModal title={L("newTxn")} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={() => void submit()}>
        <Field label={L("type")}>
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} style={fieldInput}>
            {TYPES.map((ty) => (<option key={ty} value={ty}>{TYPE_LABEL[lg][ty]}</option>))}
          </select>
        </Field>
        <Field label={L("direction")}>
          <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} style={fieldInput}>
            <option value="credit">{L("credit")}</option>
            <option value="debit">{L("debit")}</option>
          </select>
        </Field>
        <Field label={L("amount")}>
          <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="145000" style={fieldInput} />
        </Field>
        <Field label={L("description")}>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={L("dueDate")}>
          <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} style={fieldInput} />
        </Field>
      </CreateModal>
    </div>
  );
}
