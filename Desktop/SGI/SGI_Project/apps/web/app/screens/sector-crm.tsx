"use client";

import React, { useState } from "react";
import {
  IcSearch, IcPlus, IcPhone, IcMail, IcChat,
  IcArrowUp, IcArrowDown, IcCheck,
} from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import type { ConfirmedDeal } from "@/components/deal-wizard";

/* ─── Local icons (not exported from sgi-ui) ─────────────────────────── */
function IcX()     { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function IcChevD() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="m6 9 6 6 6-6" /></svg>; }
function IcEdit()  { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>; }

/* ─── Sector config ──────────────────────────────────────────────────── */
export type Sector =
  | "realestate" | "tourisme" | "sante" | "assurance"
  | "banques" | "amazon" | "consultants" | "admin" | "travail";

type PipelineStage = "new" | "contacted" | "qualified" | "proposal" | "won" | "lost";

interface SectorMeta {
  label: string; label_ar: string; label_fr: string;
  color: string;
  services_en: string[]; services_ar: string[]; services_fr: string[];
  budgetRange: [number, number];
}

const SECTORS: Record<Sector, SectorMeta> = {
  realestate: {
    label: "Real Estate", label_ar: "العقارات", label_fr: "Immobilier", color: "#C9A84C",
    services_en: ["Villa purchase", "Apartment purchase", "Long-term rental", "Short-term rental", "Off-plan investment", "Resale"],
    services_ar: ["شراء فيلا", "شراء شقة", "إيجار طويل الأمد", "إيجار قصير الأمد", "استثمار على الخارطة", "إعادة بيع"],
    services_fr: ["Achat villa", "Achat appartement", "Location longue durée", "Location courte durée", "Investissement off-plan", "Revente"],
    budgetRange: [500000, 5000000],
  },
  tourisme: {
    label: "Tourism", label_ar: "السياحة", label_fr: "Tourisme", color: "#0EA5E9",
    services_en: ["Hotel stay", "Tour package", "Tourist visa", "VIP transfer", "Yacht charter", "Excursion"],
    services_ar: ["إقامة فندقية", "باقة سياحية", "تأشيرة سياحة", "نقل VIP", "استئجار يخت", "رحلة"],
    services_fr: ["Séjour hôtelier", "Circuit touristique", "Visa touriste", "Transfer VIP", "Yacht charter", "Excursion"],
    budgetRange: [5000, 80000],
  },
  sante: {
    label: "Health", label_ar: "الصحة", label_fr: "Santé", color: "#10B981",
    services_en: ["Medical check-up", "Surgery", "Telemedicine", "Health insurance", "Medical repatriation", "Premium check-up"],
    services_ar: ["فحص طبي", "جراحة", "طب عن بعد", "تأمين صحي", "إعادة توطين طبي", "فحص بريميوم"],
    services_fr: ["Bilan médical", "Chirurgie", "Télémédecine", "Assurance santé", "Rapatriement médical", "Check-up premium"],
    budgetRange: [3000, 200000],
  },
  assurance: {
    label: "Insurance", label_ar: "التأمين", label_fr: "Assurance", color: "#8B5CF6",
    services_en: ["Home insurance", "Car insurance", "Life insurance", "Travel insurance", "Liability", "Multi-risk"],
    services_ar: ["تأمين منزل", "تأمين سيارة", "تأمين حياة", "تأمين سفر", "مسؤولية مدنية", "تأمين شامل"],
    services_fr: ["Assurance habitation", "Assurance auto", "Assurance vie", "Assurance voyage", "Responsabilité civile", "Multirisque"],
    budgetRange: [2000, 50000],
  },
  banques: {
    label: "Banking", label_ar: "البنوك", label_fr: "Banques", color: "#3B82F6",
    services_en: ["Account opening", "Mortgage", "Personal loan", "Investment", "Premium card", "Wealth management"],
    services_ar: ["فتح حساب", "قرض عقاري", "قرض شخصي", "استثمار", "بطاقة بريميوم", "إدارة الثروة"],
    services_fr: ["Ouverture compte", "Crédit immobilier", "Prêt personnel", "Investissement", "Carte premium", "Gestion patrimoniale"],
    budgetRange: [10000, 2000000],
  },
  amazon: {
    label: "Amazon / E-com", label_ar: "أمازون", label_fr: "Amazon / E-com", color: "#F59E0B",
    services_en: ["FBA logistics", "Store creation", "Product marketing", "Stock management", "SEO optimisation", "Seller training"],
    services_ar: ["لوجستيات FBA", "إنشاء متجر", "تسويق المنتجات", "إدارة المخزون", "تحسين SEO", "تدريب البائع"],
    services_fr: ["Logistique FBA", "Création boutique", "Marketing produits", "Gestion stocks", "Optimisation SEO", "Formation vendeur"],
    budgetRange: [5000, 150000],
  },
  consultants: {
    label: "Consultants", label_ar: "المستشارون", label_fr: "Consultants", color: "#EC4899",
    services_en: ["Strategic consulting", "Operational audit", "Team training", "Digital transformation", "Due diligence", "Restructuring"],
    services_ar: ["استشارة استراتيجية", "تدقيق تشغيلي", "تدريب فريق", "تحول رقمي", "العناية الواجبة", "إعادة هيكلة"],
    services_fr: ["Conseil stratégique", "Audit opérationnel", "Formation équipe", "Transformation digitale", "Due diligence", "Restructuration"],
    budgetRange: [15000, 500000],
  },
  admin: {
    label: "Administrations", label_ar: "الإدارات", label_fr: "Administrations", color: "#6366F1",
    services_en: ["Company setup", "Residence visa", "Work permit", "PRO services", "Notary", "Document legalisation"],
    services_ar: ["تأسيس شركة", "تأشيرة إقامة", "تصريح عمل", "خدمات PRO", "توثيق", "تشريع وثائق"],
    services_fr: ["Création société", "Visa résidence", "Permis travail", "PRO services", "Notariat", "Légalisation documents"],
    budgetRange: [2000, 30000],
  },
  travail: {
    label: "Employment", label_ar: "التوظيف", label_fr: "Emploi", color: "#14B8A6",
    services_en: ["Executive recruitment", "Temp placement", "Headhunting", "HR audit", "Training", "Outplacement"],
    services_ar: ["توظيف تنفيذي", "توظيف مؤقت", "صيد الرؤوس", "تدقيق HR", "تدريب", "إعادة توظيف"],
    services_fr: ["Recrutement cadre", "Placement temporaire", "Chasseur de tête", "Audit RH", "Formation", "Outplacement"],
    budgetRange: [10000, 120000],
  },
};

const STAGE_CFG: Record<PipelineStage, { label_fr: string; label_ar: string; label_en: string; color: string; bg: string }> = {
  new:       { label_fr: "Nouveau",     label_ar: "جديد",       label_en: "New",        color: "#6B7280", bg: "#F3F4F6" },
  contacted: { label_fr: "Contacté",    label_ar: "تم التواصل", label_en: "Contacted",  color: "#2563EB", bg: "#DBEAFE" },
  qualified: { label_fr: "Qualifié",    label_ar: "مؤهَّل",     label_en: "Qualified",  color: "#D97706", bg: "#FEF3C7" },
  proposal:  { label_fr: "Proposition", label_ar: "عرض",        label_en: "Proposal",   color: "#7C3AED", bg: "#EDE9FE" },
  won:       { label_fr: "Gagné",       label_ar: "فائز",       label_en: "Won",        color: "#059669", bg: "#D1FAE5" },
  lost:      { label_fr: "Perdu",       label_ar: "خاسر",       label_en: "Lost",       color: "#DC2626", bg: "#FEE2E2" },
};
const ALL_STAGES: PipelineStage[] = ["new", "contacted", "qualified", "proposal", "won", "lost"];
const PIPELINE_STAGES: PipelineStage[] = ["new", "contacted", "qualified", "proposal", "won"];

const AGENTS = ["Ahmed Al-Rashid", "Sara Ben Youssef", "Khalid Al-Mansoori", "Priya Nair", "Fatima Al-Zaabi", "Omar Qassem"];
const NAMES: [string, string, string][] = [
  ["Mohammed Al-Hamdan", "محمد الحمدان", "🇦🇪"], ["Jean-Pierre Leblanc", "جان بيار لوبلان", "🇫🇷"],
  ["Vikram Patel", "فيكرام باتيل", "🇮🇳"], ["Sarah Thompson", "سارة تومبسون", "🇬🇧"],
  ["Li Wei", "لي وي", "🇨🇳"], ["Fatima Al-Zaabi", "فاطمة الزعابي", "🇦🇪"],
  ["Carlos Mendez", "كارلوس مندز", "🇪🇸"], ["Anna Kowalski", "آنا كوفالسكي", "🇵🇱"],
  ["Rashid Al-Mansoori", "راشد المنصوري", "🇦🇪"], ["Nina Hoffmann", "نينا هوفمان", "🇩🇪"],
  ["Tariq Hassan", "طارق حسن", "🇯🇴"], ["Elena Popescu", "إيلينا بوبيسكو", "🇷🇴"],
];

/* ─── Lead type ──────────────────────────────────────────────────────── */
interface Lead {
  id: string; name: string; name_ar: string; flag: string;
  service: string; budget: number; stage: PipelineStage;
  score: number; agent: string; date: string;
  phone: string; email: string; notes: string;
  isFromClient?: boolean;
}

/* ─── Mock generators ────────────────────────────────────────────────── */
const INIT_STAGES: PipelineStage[] = ["new", "new", "contacted", "contacted", "qualified", "qualified", "proposal", "won", "won", "lost", "contacted", "qualified"];

function genLeads(sector: Sector, lang: string): Lead[] {
  const meta = SECTORS[sector];
  const services = lang === "ar" ? meta.services_ar : lang === "fr" ? meta.services_fr : meta.services_en;
  return NAMES.map((n, i) => ({
    id: `${sector.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
    name: n[0], name_ar: n[1], flag: n[2],
    service: services[i % services.length],
    budget: Math.round((meta.budgetRange[0] + (meta.budgetRange[1] - meta.budgetRange[0]) * ((i * 7 + 3) % 10) / 10) / 1000) * 1000,
    stage: INIT_STAGES[i],
    score: 30 + (i * 13) % 65,
    agent: AGENTS[i % AGENTS.length],
    date: `2026-0${4 + (i % 2)}-${String(1 + (i * 7) % 28).padStart(2, "0")}`,
    phone: `+971 5${i % 2 === 0 ? "0" : "5"} ${String(200 + i * 37).slice(0, 3)} ${String(4000 + i * 83).slice(0, 4)}`,
    email: `${n[0].split(" ")[0].toLowerCase()}@client.ae`,
    notes: "",
  }));
}

function dealToLead(d: ConfirmedDeal): Lead {
  return {
    id: d.crmRef, name: d.clientName, name_ar: d.clientName, flag: "👤",
    service: d.propType || d.urgency || "—",
    budget: d.budgetMax || d.budgetMin || 0,
    stage: "new", score: 60,
    agent: d.clientAgent, date: d.date,
    phone: "—", email: "—", notes: d.notes || "",
    isFromClient: true,
  };
}

const fmt = (n: number) => new Intl.NumberFormat("en-AE", { notation: n >= 1_000_000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(n);
const fmtFull = (n: number) => new Intl.NumberFormat("en-AE").format(n);

/* ─── New Lead Modal ─────────────────────────────────────────────────── */
interface NewLeadForm {
  name: string; phone: string; email: string;
  service: string; budget: string; notes: string;
}
const EMPTY_FORM: NewLeadForm = { name: "", phone: "", email: "", service: "", budget: "", notes: "" };

function NewLeadModal({ meta, sector, onClose, onAdd, lang }: {
  meta: SectorMeta; sector: Sector; lang: string;
  onClose: () => void;
  onAdd: (lead: Lead) => void;
}) {
  const isAr = lang === "ar"; const isFr = lang === "fr";
  const cl = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;
  const services = isAr ? meta.services_ar : isFr ? meta.services_fr : meta.services_en;
  const [form, setForm] = useState<NewLeadForm>({ ...EMPTY_FORM, service: services[0] });
  const [agent, setAgent] = useState(AGENTS[0]);
  const set = (k: keyof NewLeadForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const canSubmit = form.name.trim().length >= 2 && Number(form.budget) > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const id = `${sector.slice(0, 3).toUpperCase()}-${String(Date.now()).slice(-4)}`;
    onAdd({
      id, name: form.name, name_ar: form.name, flag: "🆕",
      service: form.service, budget: Number(form.budget),
      stage: "new", score: 30, agent, date: new Date().toISOString().slice(0, 10),
      phone: form.phone, email: form.email, notes: form.notes,
    });
    onClose();
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 36, padding: "0 10px", borderRadius: "var(--r)",
    border: "1px solid var(--line-soft)", background: "var(--bg-ivory)",
    fontSize: 12.5, color: "var(--ink)", boxSizing: "border-box", outline: "none",
  };
  const labelStyle: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4, display: "block" };

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 900, backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "fixed", top: "50%", insetInlineStart: "50%",
        transform: "translate(-50%, -50%)",
        width: 480, maxHeight: "90vh", overflowY: "auto",
        background: "var(--bg-paper)", borderRadius: "var(--r)",
        boxShadow: "var(--shadow-2)", zIndex: 901, padding: 28,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 3, height: 20, background: meta.color, borderRadius: 2 }} />
              <div className="font-display" style={{ fontSize: 18, fontWeight: 700 }}>
                {cl("New lead", "عميل جديد", "Nouveau lead")}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2, paddingInlineStart: 11 }}>
              {isAr ? meta.label_ar : isFr ? meta.label_fr : meta.label} · CRM
            </div>
          </div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "transparent", border: "1px solid var(--line-soft)", cursor: "pointer", color: "var(--ink-4)" }}>
            <IcX />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Name */}
          <div>
            <label style={labelStyle}>{cl("Full name *", "الاسم الكامل *", "Nom complet *")}</label>
            <input value={form.name} onChange={set("name")} placeholder={cl("Mohammed Al-Hamdan", "محمد الحمدان", "Jean Dupont")} style={inputStyle} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Phone */}
            <div>
              <label style={labelStyle}>{cl("Phone", "الهاتف", "Téléphone")}</label>
              <input value={form.phone} onChange={set("phone")} placeholder="+971 50 000 0000" style={inputStyle} />
            </div>
            {/* Email */}
            <div>
              <label style={labelStyle}>{cl("Email", "البريد الإلكتروني", "E-mail")}</label>
              <input value={form.email} onChange={set("email")} placeholder="client@example.com" style={inputStyle} type="email" />
            </div>
          </div>

          {/* Service */}
          <div>
            <label style={labelStyle}>{cl("Service *", "الخدمة *", "Service *")}</label>
            <select value={form.service} onChange={set("service")} style={{ ...inputStyle, cursor: "pointer" }}>
              {services.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* Budget */}
            <div>
              <label style={labelStyle}>{cl("Budget (AED) *", "الميزانية (AED) *", "Budget (AED) *")}</label>
              <input value={form.budget} onChange={set("budget")} placeholder={String(meta.budgetRange[0])} style={inputStyle} type="number" min={0} />
            </div>
            {/* Agent */}
            <div>
              <label style={labelStyle}>{cl("Assigned agent", "الوكيل المسؤول", "Agent assigné")}</label>
              <select value={agent} onChange={e => setAgent(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
                {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label style={labelStyle}>{cl("Notes", "ملاحظات", "Notes")}</label>
            <textarea
              value={form.notes} onChange={set("notes")}
              placeholder={cl("Initial context, preferences…", "السياق الأولي، التفضيلات…", "Contexte initial, préférences…")}
              style={{ ...inputStyle, height: 72, padding: "8px 10px", resize: "none", lineHeight: 1.5 }}
            />
          </div>

          {/* Footer */}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={onClose} style={{ flex: 1, height: 38, borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "transparent", cursor: "pointer", fontSize: 13, color: "var(--ink-3)" }}>
              {cl("Cancel", "إلغاء", "Annuler")}
            </button>
            <button onClick={handleSubmit} disabled={!canSubmit} style={{
              flex: 2, height: 38, borderRadius: "var(--r)", border: "none",
              background: canSubmit ? meta.color : "var(--line-soft)",
              color: canSubmit ? "#fff" : "var(--ink-4)",
              cursor: canSubmit ? "pointer" : "not-allowed",
              fontSize: 13, fontWeight: 600, transition: "all .15s",
            }}>
              {cl("Add to CRM", "إضافة إلى CRM", "Ajouter au CRM")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Lead detail panel ──────────────────────────────────────────────── */
function LeadDetailPanel({ lead, meta, lang, onClose, onStageChange, onNotesChange }: {
  lead: Lead; meta: SectorMeta; lang: string;
  onClose: () => void;
  onStageChange: (id: string, stage: PipelineStage) => void;
  onNotesChange: (id: string, notes: string) => void;
}) {
  const isAr = lang === "ar"; const isFr = lang === "fr";
  const cl = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;
  const stageLabel = (s: PipelineStage) => isAr ? STAGE_CFG[s].label_ar : isFr ? STAGE_CFG[s].label_fr : STAGE_CFG[s].label_en;
  const [notes, setNotes] = useState(lead.notes);
  const [saved, setSaved] = useState(false);

  function saveNotes() { onNotesChange(lead.id, notes); setSaved(true); setTimeout(() => setSaved(false), 1800); }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.3)", zIndex: 800 }} />
      <div style={{
        position: "fixed", insetInlineEnd: 0, top: 0, bottom: 0,
        width: 360, background: "var(--bg-paper)",
        borderInlineStart: "1px solid var(--line-soft)",
        boxShadow: "var(--shadow-2)", zIndex: 801,
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line-soft)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}>{lead.flag} {lead.name}</div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>{lead.id}</div>
            </div>
            <button onClick={onClose} style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "transparent", border: "1px solid var(--line-soft)", cursor: "pointer", color: "var(--ink-4)" }}>
              <IcX />
            </button>
          </div>
          {lead.isFromClient && (
            <span style={{ display: "inline-block", marginTop: 8, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: meta.color, color: "#fff" }}>CLIENT</span>
          )}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Contact */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{cl("Contact", "التواصل", "Contact")}</div>
            <div style={{ display: "flex", flex: 1, gap: 8 }}>
              <a href={`tel:${lead.phone}`} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 34, borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "transparent", color: "var(--ink-2)", textDecoration: "none", fontSize: 12, fontWeight: 500 }}>
                <IcPhone />{cl("Call", "اتصال", "Appeler")}
              </a>
              <a href={`mailto:${lead.email}`} style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 34, borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "transparent", color: "var(--ink-2)", textDecoration: "none", fontSize: 12, fontWeight: 500 }}>
                <IcMail />{cl("Email", "بريد", "E-mail")}
              </a>
              <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" style={{ flex: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, height: 34, borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "transparent", color: "#25D366", textDecoration: "none", fontSize: 12, fontWeight: 500 }}>
                <IcChat />{cl("WhatsApp", "واتساب", "WhatsApp")}
              </a>
            </div>
          </div>

          {/* Info grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: cl("Service", "الخدمة", "Service"), value: lead.service },
              { label: cl("Budget", "الميزانية", "Budget"), value: `AED ${fmtFull(lead.budget)}` },
              { label: cl("Agent", "الوكيل", "Agent"), value: lead.agent },
              { label: cl("Date", "التاريخ", "Date"), value: lead.date },
              { label: cl("Score", "النقاط", "Score"), value: `${lead.score}/100` },
              { label: cl("Phone", "الهاتف", "Téléphone"), value: lead.phone },
            ].map(row => (
              <div key={row.label} style={{ background: "var(--bg-ivory)", borderRadius: "var(--r-sm)", padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 3 }}>{row.label}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>{row.value}</div>
              </div>
            ))}
          </div>

          {/* Stage change */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>{cl("Pipeline stage", "مرحلة المسار", "Étape pipeline")}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ALL_STAGES.map(s => {
                const cfg = STAGE_CFG[s];
                const isActive = lead.stage === s;
                return (
                  <button key={s} onClick={() => onStageChange(lead.id, s)} style={{
                    padding: "5px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, cursor: "pointer", border: "none",
                    background: isActive ? cfg.bg : "var(--bg-ivory)",
                    color: isActive ? cfg.color : "var(--ink-4)",
                    outline: isActive ? `2px solid ${cfg.color}` : "none",
                    transition: "all .15s",
                  }}>
                    {stageLabel(s)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Score bar */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{cl("Lead score", "نقاط العميل", "Score lead")}</div>
              <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{lead.score}/100</span>
            </div>
            <div style={{ height: 6, borderRadius: 3, background: "var(--line-soft)" }}>
              <div style={{ height: "100%", borderRadius: 3, background: meta.color, width: `${lead.score}%`, transition: "width .4s" }} />
            </div>
          </div>

          {/* Notes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{cl("Notes", "ملاحظات", "Notes")}</div>
            <textarea
              value={notes} onChange={e => { setNotes(e.target.value); setSaved(false); }}
              placeholder={cl("Add notes about this lead…", "أضف ملاحظات حول هذا العميل…", "Ajouter des notes sur ce lead…")}
              style={{ width: "100%", height: 90, padding: "8px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-ivory)", fontSize: 12.5, color: "var(--ink)", resize: "none", boxSizing: "border-box", outline: "none", lineHeight: 1.5 }}
            />
            <button onClick={saveNotes} style={{
              height: 34, borderRadius: "var(--r)", border: "none",
              background: saved ? "var(--emerald)" : meta.color,
              color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 600, transition: "background .3s",
            }}>
              {saved ? cl("Saved ✓", "تم الحفظ ✓", "Enregistré ✓") : cl("Save notes", "حفظ الملاحظات", "Enregistrer les notes")}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Main screen ────────────────────────────────────────────────────── */
export function ScreenSectorCRM({ sector, confirmedDeals = [] }: { sector: Sector; confirmedDeals?: ConfirmedDeal[] }) {
  const { lang } = useLang();
  const isAr = lang === "ar"; const isFr = lang === "fr";
  const cl = (en: string, ar: string, fr: string) => isAr ? ar : isFr ? fr : en;
  const stageLabel = (s: PipelineStage) => isAr ? STAGE_CFG[s].label_ar : isFr ? STAGE_CFG[s].label_fr : STAGE_CFG[s].label_en;

  const meta = SECTORS[sector];
  const sectorLabel = isAr ? meta.label_ar : isFr ? meta.label_fr : meta.label;

  /* Mutable lead list — starts with client deals + generated mock data */
  const [leads, setLeads] = useState<Lead[]>(() => {
    const clientLeads = confirmedDeals.filter(d => d.category === sector).map(dealToLead);
    return [...clientLeads, ...genLeads(sector, lang)];
  });

  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<PipelineStage | "all">("all");
  const [view, setView] = useState<"list" | "pipeline">("list");
  const [showNewLead, setShowNewLead] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [stagePicker, setStagePicker] = useState<string | null>(null); // lead id with open picker

  const detailLead = detailId ? leads.find(l => l.id === detailId) ?? null : null;

  const filtered = leads.filter(l => {
    const q = search.toLowerCase();
    const matchQ = !q || l.name.toLowerCase().includes(q) || l.name_ar.includes(q) || l.service.toLowerCase().includes(q) || l.id.toLowerCase().includes(q);
    const matchS = stageFilter === "all" || l.stage === stageFilter;
    return matchQ && matchS;
  });

  function addLead(lead: Lead) { setLeads(p => [lead, ...p]); }
  function changeStage(id: string, stage: PipelineStage) {
    setLeads(p => p.map(l => l.id === id ? { ...l, stage } : l));
    setStagePicker(null);
  }
  function changeNotes(id: string, notes: string) {
    setLeads(p => p.map(l => l.id === id ? { ...l, notes } : l));
  }

  const stageCount = (s: PipelineStage) => leads.filter(l => l.stage === s).length;
  const totalPipeline = leads.filter(l => !["won", "lost"].includes(l.stage)).reduce((a, l) => a + l.budget, 0);
  const wonValue = leads.filter(l => l.stage === "won").reduce((a, l) => a + l.budget, 0);

  const kpis = [
    { label: cl("New leads",      "عملاء جدد",       "Nouveaux leads"),  value: stageCount("new"),           color: "var(--ink-2)",  delta: +12 },
    { label: cl("Qualified",      "مؤهَّلون",        "Qualifiés"),       value: stageCount("qualified"),     color: "#D97706",       delta: +5  },
    { label: cl("Won (30d)",      "فائزون (30 يوم)", "Gagnés (30j)"),    value: stageCount("won"),           color: "#059669",       delta: +2  },
    { label: cl("Pipeline total", "إجمالي المسار",   "Pipeline total"),  value: `AED ${fmt(totalPipeline)}`, color: meta.color,      delta: +18, isStr: true },
  ];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "var(--bg-cream)", overflow: "hidden" }}>

      {/* Header */}
      <div style={{ padding: "20px 28px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 4, height: 28, borderRadius: 2, background: meta.color, flexShrink: 0 }} />
            <div>
              <div className="font-display" style={{ fontSize: 22, fontWeight: 700, color: "var(--ink)" }}>
                {sectorLabel} · CRM
              </div>
              <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginTop: 2 }}>
                {cl("Commercial pipeline", "المسار التجاري", "Pipeline commercial")} · {leads.length} {cl("leads", "عملاء محتملين", "leads")}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {/* View toggle */}
            <div style={{ display: "flex", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
              {(["list", "pipeline"] as const).map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: "7px 14px", fontSize: 12, fontWeight: 500, border: "none", cursor: "pointer",
                  background: view === v ? meta.color : "var(--bg-base)",
                  color: view === v ? "#fff" : "var(--ink-3)",
                  transition: "all .15s",
                }}>
                  {v === "list" ? cl("List", "قائمة", "Liste") : cl("Pipeline", "مسار", "Pipeline")}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowNewLead(true)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "9px 16px",
                background: meta.color, color: "#fff", borderRadius: "var(--r)",
                border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}
            >
              <IcPlus /> {cl("New lead", "عميل جديد", "Nouveau lead")}
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 20 }}>
          {kpis.map(k => (
            <div key={k.label} style={{ background: "var(--bg-base)", borderRadius: "var(--r)", padding: "14px 16px", border: "1px solid var(--line-soft)" }}>
              <div className="tnum" style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
                <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{k.label}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: k.delta > 0 ? "#059669" : "#DC2626", display: "flex", alignItems: "center", gap: 2 }}>
                  {k.delta > 0 ? <IcArrowUp /> : <IcArrowDown />}{Math.abs(k.delta)}%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline stage tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
          {PIPELINE_STAGES.map((s, i) => {
            const cfg = STAGE_CFG[s];
            const count = stageCount(s);
            return (
              <React.Fragment key={s}>
                <button onClick={() => setStageFilter(p => p === s ? "all" : s)} style={{
                  flex: 1, minWidth: 80, padding: "10px 12px", borderRadius: "var(--r)", border: "none", cursor: "pointer", textAlign: "start",
                  background: stageFilter === s ? cfg.bg : "var(--bg-base)",
                  outline: stageFilter === s ? `2px solid ${cfg.color}` : "1px solid var(--line-soft)",
                  transition: "all .15s",
                }}>
                  <div className="tnum" style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>{count}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2, whiteSpace: "nowrap" }}>{stageLabel(s)}</div>
                </button>
                {i < PIPELINE_STAGES.length - 1 && <div style={{ display: "flex", alignItems: "center", color: "var(--ink-5)", fontSize: 16 }}>›</div>}
              </React.Fragment>
            );
          })}
          <button onClick={() => setStageFilter(p => p === "lost" ? "all" : "lost")} style={{
            minWidth: 80, padding: "10px 12px", borderRadius: "var(--r)", border: "none", cursor: "pointer", textAlign: "start",
            background: stageFilter === "lost" ? STAGE_CFG.lost.bg : "var(--bg-base)",
            outline: stageFilter === "lost" ? `2px solid ${STAGE_CFG.lost.color}` : "1px solid var(--line-soft)",
          }}>
            <div className="tnum" style={{ fontSize: 18, fontWeight: 700, color: STAGE_CFG.lost.color }}>{stageCount("lost")}</div>
            <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{stageLabel("lost")}</div>
          </button>
        </div>

        {/* Search */}
        <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <span style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)" }}><IcSearch /></span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={cl("Search a lead…", "بحث عن عميل…", "Rechercher un lead…")}
              style={{ width: "100%", paddingInlineStart: 34, paddingInlineEnd: 10, height: 36, border: "1px solid var(--line-soft)", borderRadius: "var(--r)", background: "var(--bg-base)", fontSize: 13, color: "var(--ink)", boxSizing: "border-box" }}
            />
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-4)", whiteSpace: "nowrap" }}>
            {filtered.length} {cl("leads", "عملاء", "leads")}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 28px 24px" }}>
        {view === "pipeline" ? (
          /* ── Kanban ── */
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {PIPELINE_STAGES.map(s => {
              const cfg = STAGE_CFG[s];
              const colLeads = filtered.filter(l => l.stage === s);
              return (
                <div key={s} style={{ minWidth: 230, flex: "0 0 230px" }}>
                  <div style={{ padding: "8px 12px", borderRadius: "var(--r)", marginBottom: 8, background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: cfg.color }}>{stageLabel(s)}</span>
                    <span className="tnum" style={{ fontSize: 11, background: "#fff", color: cfg.color, borderRadius: 999, padding: "1px 7px", fontWeight: 700 }}>{colLeads.length}</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {colLeads.map(l => (
                      <div
                        key={l.id}
                        onClick={() => setDetailId(l.id)}
                        style={{ background: l.isFromClient ? `${meta.color}08` : "var(--bg-base)", border: `1px solid ${l.isFromClient ? meta.color + "40" : "var(--line-soft)"}`, borderRadius: "var(--r)", padding: 12, cursor: "pointer", transition: "box-shadow .15s" }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,.08)")}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{l.flag} {l.name}</span>
                          {l.isFromClient && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 999, background: meta.color, color: "#fff" }}>CLIENT</span>}
                        </div>
                        <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>{l.service}</div>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                          <span className="tnum" style={{ fontSize: 12, fontWeight: 600, color: meta.color }}>AED {fmtFull(l.budget)}</span>
                          <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{l.agent.split(" ")[0]}</span>
                        </div>
                        <div style={{ marginTop: 6, height: 3, borderRadius: 2, background: "var(--line-soft)" }}>
                          <div style={{ height: "100%", borderRadius: 2, background: meta.color, width: `${l.score}%` }} />
                        </div>
                        <div style={{ fontSize: 10, color: "var(--ink-5)", marginTop: 3 }}>Score {l.score}/100</div>
                        {/* Quick stage advance */}
                        {s !== "won" && (
                          <button
                            onClick={e => { e.stopPropagation(); const idx = PIPELINE_STAGES.indexOf(s); changeStage(l.id, PIPELINE_STAGES[idx + 1] ?? "won"); }}
                            style={{ marginTop: 8, width: "100%", height: 26, borderRadius: "var(--r-sm)", border: `1px solid ${meta.color}40`, background: `${meta.color}10`, color: meta.color, fontSize: 10.5, fontWeight: 600, cursor: "pointer" }}
                          >
                            {cl("Advance →", "تقدم →", "Avancer →")}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── List view ── */
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-cream)", borderBottom: "1px solid var(--line-soft)" }}>
                  {[
                    cl("Lead",         "عميل",           "Lead"),
                    cl("Need",         "الحاجة",         "Besoin"),
                    cl("Budget (AED)", "الميزانية",      "Budget"),
                    cl("Stage",        "المرحلة",        "Étape"),
                    cl("Score",        "النقاط",         "Score"),
                    cl("Agent",        "الوكيل",         "Agent"),
                    cl("Date",         "التاريخ",        "Date"),
                    cl("Actions",      "إجراءات",        "Actions"),
                  ].map(h => (
                    <th key={h} style={{ padding: "10px 14px", textAlign: "start", fontSize: 11, fontWeight: 700, color: "var(--ink-4)", whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.07em" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>{cl("No results", "لا توجد نتائج", "Aucun résultat")}</td></tr>
                ) : filtered.map((lead, i) => {
                  const sc = STAGE_CFG[lead.stage];
                  const rowBg = lead.isFromClient ? `${meta.color}08` : "";
                  const isPickerOpen = stagePicker === lead.id;
                  return (
                    <tr key={lead.id}
                      style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--line-soft)" : "none", background: rowBg, position: "relative" }}
                      onMouseEnter={e => (e.currentTarget.style.background = lead.isFromClient ? `${meta.color}14` : "var(--bg-cream)")}
                      onMouseLeave={e => (e.currentTarget.style.background = rowBg)}
                    >
                      {/* Lead name */}
                      <td style={{ padding: "11px 14px", cursor: "pointer" }} onClick={() => setDetailId(lead.id)}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{lead.flag}</span>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <span style={{ fontWeight: 600, fontSize: 13, color: "var(--ink)" }}>{lead.name}</span>
                              {lead.isFromClient && <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: meta.color, color: "#fff" }}>CLIENT</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{lead.id}</div>
                          </div>
                        </div>
                      </td>
                      {/* Service */}
                      <td style={{ padding: "11px 14px", fontSize: 12.5, color: "var(--ink-2)", maxWidth: 140 }}>
                        <span title={lead.service} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{lead.service}</span>
                      </td>
                      {/* Budget */}
                      <td style={{ padding: "11px 14px" }}>
                        <span className="tnum" style={{ fontSize: 13, fontWeight: 600, color: meta.color }}>{fmtFull(lead.budget)}</span>
                      </td>
                      {/* Stage — clickable picker */}
                      <td style={{ padding: "11px 14px", position: "relative" }}>
                        <button
                          onClick={e => { e.stopPropagation(); setStagePicker(p => p === lead.id ? null : lead.id); }}
                          style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600, background: sc.bg, color: sc.color, border: "none", cursor: "pointer" }}
                        >
                          {stageLabel(lead.stage)} <IcChevD />
                        </button>
                        {isPickerOpen && (
                          <>
                            <div onClick={() => setStagePicker(null)} style={{ position: "fixed", inset: 0, zIndex: 50 }} />
                            <div style={{ position: "absolute", top: "calc(100% - 4px)", insetInlineStart: 14, zIndex: 100, background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", boxShadow: "var(--shadow-2)", overflow: "hidden", minWidth: 140 }}>
                              {ALL_STAGES.map(s => {
                                const cfg = STAGE_CFG[s];
                                return (
                                  <button key={s} onClick={() => changeStage(lead.id, s)} style={{
                                    display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", cursor: "pointer", textAlign: "start", fontSize: 12.5,
                                    background: lead.stage === s ? cfg.bg : "transparent",
                                    color: lead.stage === s ? cfg.color : "var(--ink-2)",
                                  }}>
                                    <span style={{ width: 8, height: 8, borderRadius: 4, background: cfg.color, flexShrink: 0, display: "inline-block" }} />
                                    {stageLabel(s)}
                                    {lead.stage === s && <IcCheck />}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        )}
                      </td>
                      {/* Score */}
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--line-soft)", minWidth: 40 }}>
                            <div style={{ height: "100%", borderRadius: 2, background: meta.color, width: `${lead.score}%` }} />
                          </div>
                          <span className="tnum" style={{ fontSize: 11, color: "var(--ink-4)", flexShrink: 0 }}>{lead.score}</span>
                        </div>
                      </td>
                      {/* Agent */}
                      <td style={{ padding: "11px 14px", fontSize: 12, color: "var(--ink-3)" }}>{lead.agent}</td>
                      {/* Date */}
                      <td style={{ padding: "11px 14px" }}>
                        <span className="tnum" style={{ fontSize: 12, color: "var(--ink-4)" }}>{lead.date}</span>
                      </td>
                      {/* Actions */}
                      <td style={{ padding: "11px 14px" }}>
                        <div style={{ display: "flex", gap: 4 }}>
                          <a href={`tel:${lead.phone}`} title={lead.phone} style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "none", border: "1px solid var(--line-soft)", cursor: "pointer", color: "var(--ink-4)", textDecoration: "none" }}>
                            <IcPhone />
                          </a>
                          <a href={`mailto:${lead.email}`} title={lead.email} style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "none", border: "1px solid var(--line-soft)", cursor: "pointer", color: "var(--ink-4)", textDecoration: "none" }}>
                            <IcMail />
                          </a>
                          <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="WhatsApp" style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "none", border: "1px solid var(--line-soft)", cursor: "pointer", color: "#25D366", textDecoration: "none" }}>
                            <IcChat />
                          </a>
                          <button onClick={() => setDetailId(lead.id)} title={cl("Open", "فتح", "Ouvrir")} style={{ width: 26, height: 26, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "none", border: "1px solid var(--line-soft)", cursor: "pointer", color: "var(--ink-4)" }}>
                            <IcEdit />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Won value banner */}
        <div style={{ marginTop: 12, padding: "10px 16px", borderRadius: "var(--r)", border: `1px solid ${meta.color}30`, background: `${meta.color}08`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>{cl("Closed revenue (current month)", "الإيرادات المُغلقة (الشهر الحالي)", "CA clôturé (mois en cours)")}</span>
          <span className="tnum" style={{ fontSize: 15, fontWeight: 700, color: meta.color }}>AED {fmtFull(wonValue)}</span>
        </div>
      </div>

      {/* New lead modal */}
      {showNewLead && (
        <NewLeadModal meta={meta} sector={sector} lang={lang} onClose={() => setShowNewLead(false)} onAdd={addLead} />
      )}

      {/* Lead detail panel */}
      {detailLead && (
        <LeadDetailPanel
          lead={detailLead} meta={meta} lang={lang}
          onClose={() => setDetailId(null)}
          onStageChange={changeStage}
          onNotesChange={changeNotes}
        />
      )}
    </div>
  );
}
