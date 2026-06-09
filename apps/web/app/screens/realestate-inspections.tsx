"use client";

/**
 * Écran États des lieux (inspections) — câblé sur le backend `inspections` :
 *   GET   /api/admin/inspections                 → liste paginée (filtres type/statut)
 *   POST  /api/admin/inspections                 → création
 *   POST  /api/admin/inspections/{id}/start|complete|sign  → cycle de vie
 *
 * Cycle : draft/scheduled → in_progress → completed → signed. CSS logique (Loi 3 RTL).
 * Libellés localisés en local (via useLang) pour ne pas toucher i18n.ts partagé.
 */

import React, { useEffect, useMemo, useState } from "react";

import { Topbar, IcPlus } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";
import {
  type Inspection,
  type UnitLite,
  INSP_TYPES,
  INSP_STATUSES,
  unitLabel,
  inspectionActions,
} from "@/lib/inspections";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "États des lieux", newInsp: "Nouvel état des lieux", total: "Total", scheduled: "Planifiés",
    inProgress: "En cours", completed: "Terminés", signed: "Signés", allTypes: "Tous types", allStatus: "Tous statuts",
    unit: "Unité", ref: "Réf.", type: "Type", status: "Statut", schedule: "Date prévue", done: "Terminé le",
    actions: "Actions", start: "Démarrer", complete: "Clôturer", sign: "Signer", empty: "Aucun état des lieux",
    loading: "Chargement…", selectUnit: "Sélectionner une unité", notes: "Notes", save_failed: "Échec",
    required: "Unité requise", signPrompt: "Nom du signataire :",
    t_check_in: "Entrée", t_check_out: "Sortie", t_periodic: "Périodique", t_pre_sale: "Avant-vente",
    s_draft: "Brouillon", s_scheduled: "Planifié", s_in_progress: "En cours", s_completed: "Terminé",
    s_signed: "Signé", s_cancelled: "Annulé",
  },
  en: {
    title: "Inspections", newInsp: "New inspection", total: "Total", scheduled: "Scheduled",
    inProgress: "In progress", completed: "Completed", signed: "Signed", allTypes: "All types", allStatus: "All statuses",
    unit: "Unit", ref: "Ref.", type: "Type", status: "Status", schedule: "Scheduled", done: "Completed",
    actions: "Actions", start: "Start", complete: "Complete", sign: "Sign", empty: "No inspections",
    loading: "Loading…", selectUnit: "Select a unit", notes: "Notes", save_failed: "Failed",
    required: "Unit required", signPrompt: "Signatory name:",
    t_check_in: "Check-in", t_check_out: "Check-out", t_periodic: "Periodic", t_pre_sale: "Pre-sale",
    s_draft: "Draft", s_scheduled: "Scheduled", s_in_progress: "In progress", s_completed: "Completed",
    s_signed: "Signed", s_cancelled: "Cancelled",
  },
  ar: {
    title: "محاضر المعاينة", newInsp: "محضر جديد", total: "الإجمالي", scheduled: "مجدولة",
    inProgress: "جارية", completed: "مكتملة", signed: "موقّعة", allTypes: "كل الأنواع", allStatus: "كل الحالات",
    unit: "الوحدة", ref: "المرجع", type: "النوع", status: "الحالة", schedule: "التاريخ المقرّر", done: "اكتمل في",
    actions: "إجراءات", start: "بدء", complete: "إنهاء", sign: "توقيع", empty: "لا توجد محاضر",
    loading: "جارٍ التحميل…", selectUnit: "اختر وحدة", notes: "ملاحظات", save_failed: "فشل",
    required: "الوحدة مطلوبة", signPrompt: "اسم الموقّع:",
    t_check_in: "دخول", t_check_out: "خروج", t_periodic: "دوري", t_pre_sale: "قبل البيع",
    s_draft: "مسودة", s_scheduled: "مجدول", s_in_progress: "جارٍ", s_completed: "مكتمل",
    s_signed: "موقّع", s_cancelled: "ملغى",
  },
};

const STATUS_TONE: Record<string, { c: string; bg: string }> = {
  draft: { c: "var(--ink-4)", bg: "var(--line-soft)" },
  scheduled: { c: "var(--azure, #2563eb)", bg: "rgba(37,99,235,0.12)" },
  in_progress: { c: "var(--gold)", bg: "var(--gold-ghost, rgba(197,160,89,0.18))" },
  completed: { c: "var(--emerald)", bg: "var(--emerald-soft, rgba(47,158,110,0.14))" },
  signed: { c: "var(--emerald)", bg: "var(--emerald-soft, rgba(47,158,110,0.14))" },
  cancelled: { c: "var(--rose)", bg: "var(--rose-soft, rgba(214,69,93,0.12))" },
};

export function ScreenRealEstateInspections(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;
  const stLabel = (s: string): string => L(`s_${s}`) || s;
  const tyLabel = (t: string): string => L(`t_${t}`) || t;

  const [typeF, setTypeF] = useState("");
  const [statusF, setStatusF] = useState("");
  const qs = new URLSearchParams({
    limit: "100",
    ...(typeF ? { inspection_type: typeF } : {}),
    ...(statusF ? { status: statusF } : {}),
  }).toString();
  const { items, loading, error, reload } = useApiList<Inspection>(`/api/admin/inspections?${qs}`);

  // Unités (dropdown + map id→n°).
  const [units, setUnits] = useState<UnitLite[]>([]);
  useEffect(() => {
    getJson<{ data: UnitLite[] }>("/api/admin/units?limit=100")
      .then((r) => setUnits(r.data ?? []))
      .catch(() => setUnits([]));
  }, []);
  const unitMap = useMemo(() => new Map(units.map((u) => [u.id, u])), [units]);

  const counts = useMemo(() => {
    const by = (s: string): number => items.filter((i) => i.status === s).length;
    return {
      total: items.length,
      scheduled: by("scheduled"),
      inProgress: by("in_progress"),
      completed: by("completed"),
      signed: by("signed"),
    };
  }, [items]);

  // Création
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const blank = { unit_id: "", inspection_type: "check_in", scheduled_date: "", notes: "" };
  const [form, setForm] = useState(blank);

  async function submit(): Promise<void> {
    if (!form.unit_id) {
      setFormError(L("required"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await postJson("/api/admin/inspections", {
        unit_id: form.unit_id,
        inspection_type: form.inspection_type,
        scheduled_date: form.scheduled_date || undefined,
        notes: form.notes || undefined,
      });
      if (!res.ok) {
        setFormError(await extractError(res, L("save_failed")));
        return;
      }
      setForm(blank);
      setOpen(false);
      reload();
    } catch {
      setFormError(L("save_failed"));
    } finally {
      setSaving(false);
    }
  }

  async function act(insp: Inspection, action: "start" | "complete" | "sign"): Promise<void> {
    let body: unknown = {};
    if (action === "sign") {
      const name = typeof window !== "undefined" ? window.prompt(L("signPrompt")) : null;
      if (!name) return;
      body = { signed_by: name };
    }
    const res = await postJson(`/api/admin/inspections/${insp.id}/${action}`, body);
    if (res.ok) reload();
  }

  const kpi = (label: string, value: number, accent?: string): React.ReactNode => (
    <div style={{ flex: "1 1 130px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBlockEnd: 6 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: accent ?? "var(--ink)" }}>{value}</div>
    </div>
  );

  return (
    <div data-testid="screen-inspections" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title={L("title")}>
        <button onClick={() => { setOpen(true); setFormError(null); }} className="sgi-btn sgi-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <IcPlus />&nbsp;{L("newInsp")}
        </button>
      </Topbar>

      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16, background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {kpi(L("total"), counts.total)}
          {kpi(L("scheduled"), counts.scheduled, "var(--azure, #2563eb)")}
          {kpi(L("inProgress"), counts.inProgress, "var(--gold)")}
          {kpi(L("completed"), counts.completed, "var(--emerald)")}
          {kpi(L("signed"), counts.signed, "var(--emerald)")}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} style={{ ...fieldInput, width: "auto" }}>
            <option value="">{L("allTypes")}</option>
            {INSP_TYPES.map((t) => (<option key={t} value={t}>{tyLabel(t)}</option>))}
          </select>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={{ ...fieldInput, width: "auto" }}>
            <option value="">{L("allStatus")}</option>
            {INSP_STATUSES.map((s) => (<option key={s} value={s}>{stLabel(s)}</option>))}
          </select>
        </div>

        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)" }}>
                {[L("ref"), L("unit"), L("type"), L("status"), L("schedule"), L("actions")].map((h) => (
                  <th key={h} style={{ padding: "9px 12px", textAlign: "start", fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: "var(--ink-4)" }}>{L("loading")}</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} style={{ padding: 18, textAlign: "center", color: "var(--ink-4)" }}>{error ?? L("empty")}</td></tr>
              ) : (
                items.map((i) => {
                  const tone = STATUS_TONE[i.status] ?? STATUS_TONE.draft;
                  return (
                    <tr key={i.id} style={{ borderBlockStart: "1px solid var(--line-soft)" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>{i.reference}</td>
                      <td style={{ padding: "9px 12px" }}>{unitLabel(unitMap.get(i.unit_id), i.unit_id)}</td>
                      <td style={{ padding: "9px 12px", color: "var(--ink-3)" }}>{tyLabel(i.inspection_type)}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: tone.c, background: tone.bg }}>
                          {stLabel(i.status)}
                        </span>
                      </td>
                      <td style={{ padding: "9px 12px", color: "var(--ink-3)" }}>{i.scheduled_date ?? "—"}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ display: "flex", gap: 6 }}>
                          {inspectionActions(i.status).map((a) => (
                            <button
                              key={a}
                              onClick={() => void act(i, a)}
                              style={{ padding: "3px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--ink-3)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}
                            >
                              {L(a)}
                            </button>
                          ))}
                          {inspectionActions(i.status).length === 0 && <span style={{ color: "var(--ink-4)" }}>—</span>}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateModal title={L("newInsp")} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={() => void submit()}>
        <Field label={L("unit")}>
          <select value={form.unit_id} onChange={(e) => setForm({ ...form, unit_id: e.target.value })} style={fieldInput}>
            <option value="">{L("selectUnit")}</option>
            {units.map((u) => (<option key={u.id} value={u.id}>{unitLabel(u, u.id)}</option>))}
          </select>
        </Field>
        <Field label={L("type")}>
          <select value={form.inspection_type} onChange={(e) => setForm({ ...form, inspection_type: e.target.value })} style={fieldInput}>
            {INSP_TYPES.map((t) => (<option key={t} value={t}>{tyLabel(t)}</option>))}
          </select>
        </Field>
        <Field label={L("schedule")}>
          <input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={L("notes")}>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={fieldInput} />
        </Field>
      </CreateModal>
    </div>
  );
}
