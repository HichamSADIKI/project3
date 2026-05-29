"use client";
import React, { useState, useRef } from "react";
import { Ic } from "@/components/sgi-ui";

/* ─── Types ──────────────────────────────────────────────────── */
export type DealCategory =
  | "realestate" | "tourisme" | "sante" | "assurance"
  | "banques" | "amazon" | "consultants" | "admin";

export interface ConfirmedDeal {
  crmRef: string;
  category: DealCategory;
  propType: string;
  area: string;
  budgetMin: number;
  budgetMax: number;
  bedrooms: string;
  surface: string;
  urgency: string;
  notes: string;
  date: string;
  clientName: string;
  clientId: string;
  clientAgent: string;
  // Origine du deal — utilisé pour les deals créés depuis le portal client.
  // "wizard" (par défaut) = créé en backoffice via l'assistant.
  // "portal_voice"        = portal client, dicté au micro (Web Speech / Whisper).
  // "portal_text"         = portal client, saisi au clavier.
  source?: "wizard" | "portal_voice" | "portal_text";
}

/* ─── Categories (8 SGI sectors) ────────────────────────────── */
const CATS: {
  key: DealCategory; icon: string;
  en: string; ar: string; fr: string;
  desc_en: string; desc_ar: string; desc_fr: string;
  color: string;
}[] = [
  { key: "realestate",  icon: "🏠", color: "var(--gold)",    en: "Real Estate",     ar: "عقارات",          fr: "Immobilier",      desc_en: "Sale, rental, commercial & FM",         desc_ar: "بيع، إيجار، تجاري وإدارة",       desc_fr: "Vente, location, commercial & FM"        },
  { key: "tourisme",    icon: "✈️", color: "var(--azure)",   en: "Tourism",         ar: "سياحة",           fr: "Tourisme",        desc_en: "Hotels, tours, events & travel",        desc_ar: "فنادق، جولات، فعاليات وسفر",     desc_fr: "Hôtels, circuits, événements & voyage"   },
  { key: "sante",       icon: "🏥", color: "var(--emerald)", en: "Health",          ar: "صحة",             fr: "Santé",           desc_en: "Medical services, health insurance",    desc_ar: "الخدمات الطبية، التأمين الصحي",   desc_fr: "Services médicaux, assurance santé"      },
  { key: "assurance",   icon: "🛡️", color: "#8B5CF6",        en: "Insurance",       ar: "تأمين",           fr: "Assurance",       desc_en: "Property, vehicle, life & corporate",   desc_ar: "عقارات، مركبات، حياة وشركات",    desc_fr: "Bien, véhicule, vie & entreprise"        },
  { key: "banques",     icon: "🏦", color: "#F59E0B",        en: "Banks",           ar: "بنوك",            fr: "Banques",         desc_en: "Mortgage, accounts & trade finance",    desc_ar: "رهن، حسابات وتمويل تجاري",       desc_fr: "Hypothèque, comptes & financement"       },
  { key: "amazon",      icon: "📦", color: "var(--rose)",    en: "Amazon",          ar: "أمازون",          fr: "Amazon",          desc_en: "E-commerce, logistics & FBA UAE",       desc_ar: "تجارة إلكترونية، لوجستيات وFBA", desc_fr: "E-commerce, logistique & FBA UAE"        },
  { key: "consultants", icon: "💼", color: "var(--azure)",   en: "Consultants",     ar: "مستشارون",        fr: "Consultants",     desc_en: "Strategy, legal, finance & HR",         desc_ar: "استراتيجية، قانوني، مالي وموارد", desc_fr: "Stratégie, juridique, finance & RH"     },
  { key: "admin",       icon: "🏛️", color: "var(--ink-3)",   en: "Administrations", ar: "إدارات",          fr: "Administrations", desc_en: "Licenses, visas, permits & DLD",        desc_ar: "تراخيص، تأشيرات، تصاريح ودائرة", desc_fr: "Licences, visas, permis & DLD"           },
];

/* ─── Step-2 service options per category ────────────────────── */
const SERVICES: Record<DealCategory, string[]> = {
  realestate:  ["Apartment", "Villa", "Penthouse", "Office", "Retail", "Land", "Hotel Apartment"],
  tourisme:    ["Hotel Booking", "Tour Package", "Corporate Travel", "Event Management", "Vacation Rental", "Yacht Charter"],
  sante:       ["Medical Consultation", "Health Insurance", "Medical Tourism", "Clinic Setup", "Lab Services", "Physiotherapy"],
  assurance:   ["Property Insurance", "Health Insurance", "Vehicle Insurance", "Life Insurance", "Corporate Insurance", "Marine Insurance"],
  banques:     ["Mortgage / Home Loan", "Business Account", "Investment Portfolio", "Letter of Credit", "Trade Finance", "Wealth Management"],
  amazon:      ["E-commerce Setup", "Product Listing", "Logistics & FBA", "Brand Management", "Amazon UAE Store", "Amazon Advertising"],
  consultants: ["Business Strategy", "Legal Advisory", "Financial Advisory", "HR Consulting", "IT Consulting", "Market Research"],
  admin:       ["Trade License", "Visa Processing", "Company Registration", "Permit Application", "DLD Services", "Labour Card"],
};

const AREAS    = ["Dubai Marina", "Downtown Dubai", "Palm Jumeirah", "Business Bay", "DIFC", "JBR", "Emirates Hills", "Jumeirah", "Al Barsha", "Saadiyat Island", "Yas Island", "Al Reem Island", "Sharjah — Al Majaz", "Other"];
const BEDROOMS = ["Studio", "1 BR", "2 BR", "3 BR", "4 BR", "5 BR", "5+ BR"];
const URGENCY  = ["ASAP (< 1 month)", "1–3 months", "3–6 months", "6–12 months", "Flexible"];

type Step = 1 | 2 | 3;
interface Form {
  category: DealCategory | null;
  propType: string; area: string;
  budgetMin: string; budgetMax: string;
  bedrooms: string; surface: string;
  urgency: string; notes: string;
}
const EMPTY: Form = { category: null, propType: "", area: "", budgetMin: "", budgetMax: "", bedrooms: "", surface: "", urgency: "", notes: "" };

/* ─── DealWizard ─────────────────────────────────────────────── */
export function DealWizard({ clientName, clientId, clientAgent, lang, onClose, onConfirm }: {
  clientName: string;
  clientId: string;
  clientAgent: string;
  lang: string;
  onClose: () => void;
  onConfirm: (deal: ConfirmedDeal) => void;
}) {
  const [step, setStep]       = useState<Step>(1);
  const [success, setSuccess] = useState(false);
  const [form, setForm]       = useState<Form>(EMPTY);
  const crmRef = useRef(`CRM-2026-${Math.floor(Math.random() * 9000 + 1000)}`);

  const l   = (en: string, ar: string, fr: string) => lang === "ar" ? ar : lang === "fr" ? fr : en;
  const cat = CATS.find(c => c.key === form.category);
  const isRE = form.category === "realestate";

  const fld: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: "var(--r)",
    border: "1px solid var(--line-soft)", background: "var(--bg-ivory)",
    color: "var(--ink)", fontSize: 13, outline: "none", boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 600, color: "var(--ink-4)",
    textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, display: "block",
  };

  const pill = (active: boolean, azul = false) => ({
    padding: "6px 12px", borderRadius: 999, fontSize: 12, cursor: "pointer" as const,
    background: active ? (azul ? "var(--azure)" : "var(--gold)") : "var(--bg-cream)",
    color: active ? (azul ? "#fff" : "#1A1610") : "var(--ink-3)",
    border: `1px solid ${active ? (azul ? "var(--azure)" : "var(--gold)") : "var(--line-soft)"}`,
    fontWeight: (active ? 600 : 400) as 600 | 400,
  });

  function summaryRows() {
    return [
      form.propType && { k: l("Service / Type", "النوع", "Service / Type"), v: form.propType },
      form.area     && { k: l("Area", "المنطقة", "Zone"),                   v: form.area },
      (form.budgetMin || form.budgetMax) && {
        k: l("Budget", "الميزانية", "Budget"),
        v: `AED ${form.budgetMin ? Number(form.budgetMin).toLocaleString() : "?"} – ${form.budgetMax ? Number(form.budgetMax).toLocaleString() : "?"}`,
      },
      form.bedrooms && { k: l("Bedrooms", "غرف النوم", "Chambres"),          v: form.bedrooms },
      form.surface  && { k: "Surface",                                        v: `${form.surface} m²` },
      form.urgency  && { k: l("Timeline", "الجدول", "Délai"),                v: form.urgency },
      { k: l("Client", "العميل", "Client"),                                  v: clientName },
      { k: l("Agent",  "الوكيل", "Agent"),                                   v: clientAgent },
    ].filter(Boolean) as { k: string; v: string }[];
  }

  function handleConfirm() {
    onConfirm({
      crmRef: crmRef.current,
      category: form.category!,
      propType: form.propType,
      area: form.area,
      budgetMin: Number(form.budgetMin) || 0,
      budgetMax: Number(form.budgetMax) || 0,
      bedrooms: form.bedrooms,
      surface: form.surface,
      urgency: form.urgency,
      notes: form.notes,
      date: new Date().toISOString().slice(0, 10),
      clientName,
      clientId,
      clientAgent,
    });
    setSuccess(true);
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 1100, backdropFilter: "blur(2px)" }} />

      {/* Modal */}
      <div style={{ position: "fixed", inset: 0, zIndex: 1101, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div style={{ background: "var(--bg-paper)", borderRadius: 14, width: "100%", maxWidth: 580, boxShadow: "0 24px 80px rgba(0,0,0,0.28)", display: "flex", flexDirection: "column", maxHeight: "92vh", overflow: "hidden" }}>

          {/* Header */}
          <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div>
              <div className="font-display" style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)" }}>
                {success ? l("Deal added to CRM", "تمت إضافة الصفقة", "Deal ajouté au CRM") : l("New Deal", "صفقة جديدة", "Nouveau deal")}
              </div>
              {!success && <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>{clientName}</div>}
            </div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", display: "grid", placeItems: "center", border: "1px solid var(--line-soft)", background: "none", cursor: "pointer", color: "var(--ink-4)" }}>
              <Ic s={14}><path d="M18 6 6 18M6 6l12 12"/></Ic>
            </button>
          </div>

          {/* Step dots */}
          {!success && (
            <div style={{ padding: "10px 24px 0", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              {([1, 2, 3] as Step[]).map(s => (
                <React.Fragment key={s}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center",
                    fontSize: 11, fontWeight: 700, transition: "all 0.18s",
                    background: step >= s ? "var(--gold)" : "var(--bg-cream)",
                    color: step >= s ? "#1A1610" : "var(--ink-4)",
                    border: `2px solid ${step >= s ? "var(--gold)" : "var(--line-soft)"}`,
                  }}>{s}</div>
                  {s < 3 && <div style={{ flex: 1, height: 2, borderRadius: 1, transition: "background 0.18s", background: step > s ? "var(--gold)" : "var(--line-soft)" }} />}
                </React.Fragment>
              ))}
              <span style={{ marginInlineStart: 10, fontSize: 11, color: "var(--ink-4)", whiteSpace: "nowrap" }}>
                {step === 1 ? l("Choose sector", "اختر القطاع", "Choisir le secteur")
                  : step === 2 ? l("Fill details", "أدخل التفاصيل", "Remplir les détails")
                  : l("Review & confirm", "مراجعة وتأكيد", "Vérifier et confirmer")}
              </span>
            </div>
          )}

          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px 24px" }}>

            {/* SUCCESS */}
            {success && (
              <div style={{ textAlign: "center", padding: "28px 0" }}>
                <div style={{ fontSize: 44, marginBottom: 14 }}>✅</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--emerald)", marginBottom: 6 }}>
                  {l("Added to CRM pipeline", "تمت الإضافة إلى مسار CRM", "Ajouté au pipeline CRM")}
                </div>
                <div className="tnum" style={{ fontSize: 13, color: "var(--azure)", fontWeight: 600, marginBottom: 18 }}>
                  {crmRef.current}
                </div>
                <div style={{ background: "var(--bg-cream)", borderRadius: "var(--r)", padding: "14px 18px", fontSize: 12.5, color: "var(--ink-3)", textAlign: "start", lineHeight: 1.8 }}>
                  {summaryRows().map(r => (
                    <div key={r.k} style={{ display: "flex", gap: 8 }}>
                      <span style={{ color: "var(--ink-4)", minWidth: 80 }}>{r.k}</span>
                      <span style={{ fontWeight: 500, color: "var(--ink)" }}>{r.v}</span>
                    </div>
                  ))}
                </div>
                <button onClick={onClose} style={{ marginTop: 20, padding: "9px 28px", borderRadius: "var(--r)", background: "var(--gold)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#1A1610" }}>
                  {l("Close", "إغلاق", "Fermer")}
                </button>
              </div>
            )}

            {/* STEP 1 — Sector grid (2 cols × 4 rows) */}
            {!success && step === 1 && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {CATS.map(c => {
                  const sel = form.category === c.key;
                  return (
                    <button key={c.key}
                      onClick={() => setForm(f => ({ ...f, category: c.key, propType: "", area: "", bedrooms: "", surface: "" }))}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "flex-start",
                        gap: 6, padding: "16px 18px", borderRadius: "var(--r)",
                        cursor: "pointer", textAlign: "start", transition: "all 0.15s",
                        border: `2px solid ${sel ? c.color : "var(--line-soft)"}`,
                        background: sel ? `${c.color}10` : "var(--bg-cream)",
                      }}>
                      <span style={{ fontSize: 24 }}>{c.icon}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: sel ? c.color : "var(--ink)" }}>
                        {l(c.en, c.ar, c.fr)}
                      </span>
                      <span style={{ fontSize: 11, color: "var(--ink-4)", lineHeight: 1.5 }}>
                        {l(c.desc_en, c.desc_ar, c.desc_fr)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* STEP 2 — Details */}
            {!success && step === 2 && cat && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {/* Sector chip */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", background: `${cat.color}10`, borderRadius: "var(--r)", border: `1px solid ${cat.color}30` }}>
                  <span style={{ fontSize: 18 }}>{cat.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: cat.color }}>{l(cat.en, cat.ar, cat.fr)}</span>
                </div>

                {/* Service / type pills */}
                <div>
                  <label style={labelStyle}>
                    {l("Service / Type", "النوع / الخدمة", "Service / Type")}
                  </label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {(SERVICES[form.category!] ?? []).map(s => (
                      <button key={s} onClick={() => setForm(f => ({ ...f, propType: s }))} style={pill(form.propType === s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Area — only for Real Estate */}
                {isRE && (
                  <div>
                    <label style={labelStyle}>{l("Area / Location", "المنطقة", "Zone / Emplacement")}</label>
                    <select value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))} style={fld}>
                      <option value="">{l("Select area…", "اختر المنطقة…", "Choisir une zone…")}</option>
                      {AREAS.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                )}

                {/* Budget */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={labelStyle}>{l("Budget min (AED)", "الميزانية الدنيا (AED)", "Budget min (AED)")}</label>
                    <input type="number" value={form.budgetMin} onChange={e => setForm(f => ({ ...f, budgetMin: e.target.value }))} placeholder="100 000" style={fld} />
                  </div>
                  <div>
                    <label style={labelStyle}>{l("Budget max (AED)", "الميزانية القصوى (AED)", "Budget max (AED)")}</label>
                    <input type="number" value={form.budgetMax} onChange={e => setForm(f => ({ ...f, budgetMax: e.target.value }))} placeholder="2 000 000" style={fld} />
                  </div>
                </div>

                {/* Bedrooms — Real Estate only */}
                {isRE && (
                  <div>
                    <label style={labelStyle}>{l("Bedrooms (if residential)", "غرف النوم", "Chambres (si résidentiel)")}</label>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {BEDROOMS.map(b => <button key={b} onClick={() => setForm(f => ({ ...f, bedrooms: b }))} style={pill(form.bedrooms === b)}>{b}</button>)}
                    </div>
                  </div>
                )}

                {/* Surface — Real Estate commercial */}
                {isRE && (
                  <div>
                    <label style={labelStyle}>{l("Surface (m², if applicable)", "المساحة (م²، إن انطبق)", "Surface (m², si applicable)")}</label>
                    <input type="number" value={form.surface} onChange={e => setForm(f => ({ ...f, surface: e.target.value }))} placeholder="250" style={fld} />
                  </div>
                )}

                {/* Timeline */}
                <div>
                  <label style={labelStyle}>{l("Desired timeline", "الجدول الزمني", "Délai souhaité")}</label>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {URGENCY.map(u => <button key={u} onClick={() => setForm(f => ({ ...f, urgency: u }))} style={{ ...pill(form.urgency === u, true), fontSize: 11.5 }}>{u}</button>)}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label style={labelStyle}>{l("Additional notes", "ملاحظات إضافية", "Notes complémentaires")}</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    rows={3} placeholder={l("Specific requirements, preferences…", "متطلبات محددة، تفضيلات…", "Exigences spécifiques, préférences…")}
                    style={{ ...fld, resize: "vertical", fontFamily: "inherit" }} />
                </div>
              </div>
            )}

            {/* STEP 3 — Review */}
            {!success && step === 3 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <div style={{ background: "var(--bg-cream)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 20px" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
                    {l("Deal summary", "ملخص الصفقة", "Résumé du deal")}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", marginBottom: 12 }}>
                    {cat && <>{cat.icon} {l(cat.en, cat.ar, cat.fr)}</>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {summaryRows().map(r => (
                      <div key={r.k} style={{ display: "flex", gap: 12, fontSize: 12.5 }}>
                        <span style={{ color: "var(--ink-4)", minWidth: 90, flexShrink: 0 }}>{r.k}</span>
                        <span style={{ color: "var(--ink)", fontWeight: 500 }}>{r.v}</span>
                      </div>
                    ))}
                  </div>
                  {form.notes && (
                    <div style={{ marginTop: 12, padding: "10px 14px", background: "var(--bg-paper)", borderRadius: "var(--r-sm)", fontSize: 12, color: "var(--ink-3)", lineHeight: 1.6, borderInlineStart: "3px solid var(--line-soft)" }}>
                      {form.notes}
                    </div>
                  )}
                </div>
                <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: "var(--r)", padding: "11px 15px", fontSize: 12, color: "var(--emerald)", lineHeight: 1.6 }}>
                  {l(
                    "Once confirmed, this deal will be added to the CRM pipeline with status New and assigned to the client's agent.",
                    "بعد التأكيد، ستُضاف الصفقة إلى مسار CRM بحالة «جديد» وتُسند إلى وكيل العميل.",
                    "Une fois confirmé, ce deal sera ajouté au pipeline CRM avec le statut Nouveau et assigné à l'agent du client.",
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          {!success && (
            <div style={{ padding: "14px 24px", borderTop: "1px solid var(--line-soft)", display: "flex", justifyContent: "space-between", gap: 10, flexShrink: 0 }}>
              <button
                onClick={() => step === 1 ? onClose() : setStep(s => (s - 1) as Step)}
                style={{ padding: "9px 18px", borderRadius: "var(--r)", background: "none", border: "1px solid var(--line-soft)", color: "var(--ink-3)", cursor: "pointer", fontSize: 13 }}>
                {step === 1 ? l("Cancel", "إلغاء", "Annuler") : l("Back", "رجوع", "Retour")}
              </button>

              {step < 3 ? (
                <button
                  onClick={() => setStep(s => (s + 1) as Step)}
                  disabled={step === 1 && !form.category}
                  style={{ padding: "9px 22px", borderRadius: "var(--r)", background: "var(--gold)", border: "none", color: "#1A1610", cursor: step === 1 && !form.category ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600, opacity: step === 1 && !form.category ? 0.5 : 1 }}>
                  {l("Next", "التالي", "Suivant")} →
                </button>
              ) : (
                <button
                  onClick={handleConfirm}
                  style={{ padding: "9px 22px", borderRadius: "var(--r)", background: "var(--emerald)", border: "none", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
                  {l("Confirm & add to CRM", "تأكيد وإضافة إلى CRM", "Confirmer et ajouter au CRM")} ✓
                </button>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
