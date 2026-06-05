"use client";

/**
 * Écran Agenda — câblé sur le backend `agenda` :
 *   GET   /api/admin/agenda            → liste (filtres type/statut)
 *   POST  /api/admin/agenda            → création
 *   PATCH /api/admin/agenda/{id}       → statut (fait / annulé)
 *
 * RDV · visites de biens · tâches · appels. CSS strictement logique (Loi 3 RTL).
 * Libellés localisés en local (via useLang) pour ne pas toucher i18n.ts partagé.
 */

import React, { useEffect, useMemo, useState } from "react";

import { Topbar, IcPlus } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";
import { getJson, postJson, patchJson, extractError } from "@/lib/api-client";
import { CreateModal, Field, fieldInput } from "@/components/create-modal";
import {
  type AgendaEvent,
  type ClientLite,
  AGENDA_TYPES,
  AGENDA_STATUSES,
  clientLabel,
  dayBucket,
  isUpcoming,
  formatWhen,
} from "@/lib/agenda";

type Lang = "ar" | "en" | "fr";

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Agenda", newEvent: "Nouvel événement", total: "Total", today: "Aujourd'hui",
    upcoming: "À venir", done: "Faits", allTypes: "Tous types", allStatus: "Tous statuts",
    event: "Événement", type: "Type", when: "Quand", client: "Client", status: "Statut", actions: "Actions",
    markDone: "Fait", cancel: "Annuler", empty: "Aucun événement", loading: "Chargement…",
    titleField: "Titre", start: "Début", end: "Fin", location: "Lieu", notes: "Notes",
    selectClient: "Client (option.)", noClient: "— Aucun —", required: "Titre et début requis",
    save_failed: "Échec",
    t_appointment: "RDV", t_visit: "Visite", t_task: "Tâche", t_call: "Appel", t_other: "Autre",
    s_scheduled: "Planifié", s_done: "Fait", s_cancelled: "Annulé",
  },
  en: {
    title: "Agenda", newEvent: "New event", total: "Total", today: "Today",
    upcoming: "Upcoming", done: "Done", allTypes: "All types", allStatus: "All statuses",
    event: "Event", type: "Type", when: "When", client: "Client", status: "Status", actions: "Actions",
    markDone: "Done", cancel: "Cancel", empty: "No events", loading: "Loading…",
    titleField: "Title", start: "Start", end: "End", location: "Location", notes: "Notes",
    selectClient: "Client (opt.)", noClient: "— None —", required: "Title and start required",
    save_failed: "Failed",
    t_appointment: "Appointment", t_visit: "Visit", t_task: "Task", t_call: "Call", t_other: "Other",
    s_scheduled: "Scheduled", s_done: "Done", s_cancelled: "Cancelled",
  },
  ar: {
    title: "الأجندة", newEvent: "حدث جديد", total: "الإجمالي", today: "اليوم",
    upcoming: "قادمة", done: "منجزة", allTypes: "كل الأنواع", allStatus: "كل الحالات",
    event: "الحدث", type: "النوع", when: "متى", client: "العميل", status: "الحالة", actions: "إجراءات",
    markDone: "تم", cancel: "إلغاء", empty: "لا أحداث", loading: "جارٍ التحميل…",
    titleField: "العنوان", start: "البداية", end: "النهاية", location: "المكان", notes: "ملاحظات",
    selectClient: "العميل (اختياري)", noClient: "— لا أحد —", required: "العنوان والبداية مطلوبان",
    save_failed: "فشل",
    t_appointment: "موعد", t_visit: "معاينة", t_task: "مهمة", t_call: "اتصال", t_other: "أخرى",
    s_scheduled: "مجدول", s_done: "تم", s_cancelled: "ملغى",
  },
};

const STATUS_TONE: Record<string, { c: string; bg: string }> = {
  scheduled: { c: "var(--azure, #2563eb)", bg: "rgba(37,99,235,0.12)" },
  done: { c: "var(--emerald)", bg: "var(--emerald-soft, rgba(47,158,110,0.14))" },
  cancelled: { c: "var(--ink-4)", bg: "var(--line-soft)" },
};

export function ScreenRealEstateAgenda(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;
  const tyLabel = (t: string): string => L(`t_${t}`) || t;
  const stLabel = (s: string): string => L(`s_${s}`) || s;

  const [typeF, setTypeF] = useState("");
  const [statusF, setStatusF] = useState("");
  const qs = new URLSearchParams({
    limit: "200",
    ...(typeF ? { event_type: typeF } : {}),
    ...(statusF ? { status: statusF } : {}),
  }).toString();
  const { items, loading, error, reload } = useApiList<AgendaEvent>(`/api/admin/agenda?${qs}`);

  const [clients, setClients] = useState<ClientLite[]>([]);
  useEffect(() => {
    getJson<{ data: ClientLite[] }>("/api/admin/clients?limit=200")
      .then((r) => setClients(r.data ?? []))
      .catch(() => setClients([]));
  }, []);
  const clientMap = useMemo(() => new Map(clients.map((c) => [c.id, c])), [clients]);

  const counts = useMemo(() => {
    const now = new Date();
    let today = 0;
    let upcoming = 0;
    let done = 0;
    for (const e of items) {
      if (e.status === "done") done += 1;
      if (e.status !== "cancelled" && dayBucket(e.start_at, now) === "today") today += 1;
      if (e.status === "scheduled" && isUpcoming(e.start_at, now)) upcoming += 1;
    }
    return { total: items.length, today, upcoming, done };
  }, [items]);

  // Création
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const blank = {
    title: "",
    event_type: "appointment",
    start_at: "",
    end_at: "",
    location: "",
    client_id: "",
    notes: "",
  };
  const [form, setForm] = useState(blank);

  async function submit(): Promise<void> {
    if (!form.title.trim() || !form.start_at) {
      setFormError(L("required"));
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await postJson("/api/admin/agenda", {
        title: form.title.trim(),
        event_type: form.event_type,
        start_at: form.start_at,
        end_at: form.end_at || undefined,
        location: form.location || undefined,
        client_id: form.client_id || undefined,
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

  async function setStatus(ev: AgendaEvent, status: string): Promise<void> {
    const res = await patchJson(`/api/admin/agenda/${ev.id}`, { status });
    if (res.ok) reload();
  }

  const kpi = (label: string, value: number, accent?: string): React.ReactNode => (
    <div style={{ flex: "1 1 130px", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginBlockEnd: 6 }}>{label}</div>
      <div className="font-display" style={{ fontSize: 20, fontWeight: 700, color: accent ?? "var(--ink)" }}>{value}</div>
    </div>
  );

  return (
    <div data-testid="screen-agenda" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <Topbar title={L("title")}>
        <button onClick={() => { setOpen(true); setFormError(null); }} className="sgi-btn sgi-btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <IcPlus />&nbsp;{L("newEvent")}
        </button>
      </Topbar>

      <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16, background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {kpi(L("total"), counts.total)}
          {kpi(L("today"), counts.today, "var(--gold)")}
          {kpi(L("upcoming"), counts.upcoming, "var(--azure, #2563eb)")}
          {kpi(L("done"), counts.done, "var(--emerald)")}
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <select value={typeF} onChange={(e) => setTypeF(e.target.value)} style={{ ...fieldInput, width: "auto" }}>
            <option value="">{L("allTypes")}</option>
            {AGENDA_TYPES.map((t) => (<option key={t} value={t}>{tyLabel(t)}</option>))}
          </select>
          <select value={statusF} onChange={(e) => setStatusF(e.target.value)} style={{ ...fieldInput, width: "auto" }}>
            <option value="">{L("allStatus")}</option>
            {AGENDA_STATUSES.map((s) => (<option key={s} value={s}>{stLabel(s)}</option>))}
          </select>
        </div>

        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 12, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)" }}>
                {[L("event"), L("type"), L("when"), L("client"), L("status"), L("actions")].map((h) => (
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
                items.map((e) => {
                  const tone = STATUS_TONE[e.status] ?? STATUS_TONE.scheduled;
                  return (
                    <tr key={e.id} style={{ borderBlockStart: "1px solid var(--line-soft)" }}>
                      <td style={{ padding: "9px 12px", fontWeight: 600 }}>
                        {e.title}
                        {e.location && <span style={{ color: "var(--ink-4)", fontWeight: 400 }}> · {e.location}</span>}
                      </td>
                      <td style={{ padding: "9px 12px", color: "var(--ink-3)" }}>{tyLabel(e.event_type)}</td>
                      <td style={{ padding: "9px 12px", color: "var(--ink-3)" }}>{formatWhen(e.start_at, e.all_day)}</td>
                      <td style={{ padding: "9px 12px" }}>{clientLabel(clientMap.get(e.client_id ?? ""), e.client_id)}</td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, color: tone.c, background: tone.bg }}>
                          {stLabel(e.status)}
                        </span>
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{ display: "flex", gap: 6 }}>
                          {e.status === "scheduled" ? (
                            <>
                              <button onClick={() => void setStatus(e, "done")} style={{ padding: "3px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--emerald)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>{L("markDone")}</button>
                              <button onClick={() => void setStatus(e, "cancelled")} style={{ padding: "3px 10px", borderRadius: 8, border: "1px solid var(--line)", background: "transparent", color: "var(--ink-4)", fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>{L("cancel")}</button>
                            </>
                          ) : (
                            <span style={{ color: "var(--ink-4)" }}>—</span>
                          )}
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

      <CreateModal title={L("newEvent")} open={open} saving={saving} error={formError} onClose={() => setOpen(false)} onSubmit={() => void submit()}>
        <Field label={L("titleField")}>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={L("type")}>
          <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} style={fieldInput}>
            {AGENDA_TYPES.map((t) => (<option key={t} value={t}>{tyLabel(t)}</option>))}
          </select>
        </Field>
        <Field label={L("start")}>
          <input type="datetime-local" value={form.start_at} onChange={(e) => setForm({ ...form, start_at: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={L("end")}>
          <input type="datetime-local" value={form.end_at} onChange={(e) => setForm({ ...form, end_at: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={L("location")}>
          <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} style={fieldInput} />
        </Field>
        <Field label={L("client")}>
          <select value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} style={fieldInput}>
            <option value="">{L("noClient")}</option>
            {clients.map((c) => (<option key={c.id} value={c.id}>{clientLabel(c, c.id)}</option>))}
          </select>
        </Field>
        <Field label={L("notes")}>
          <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={fieldInput} />
        </Field>
      </CreateModal>
    </div>
  );
}
