"use client";
import React, { useState } from "react";
import { Topbar, Ic, IcPhone, IcMail, IcArrowUp } from "@/components/sgi-ui";
import { DealWizard, type ConfirmedDeal } from "@/components/deal-wizard";
import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const IcSearch2  = () => <Ic s={15}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ic>;
const IcPlus2    = () => <Ic s={15}><path d="M12 5v14M5 12h14"/></Ic>;
const IcBack     = () => <Ic s={16}><path d="m15 18-6-6 6-6"/></Ic>;
const IcDoc2     = () => <Ic s={15}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></Ic>;
const IcInvoice  = () => <Ic s={15}><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/></Ic>;
const IcPayment  = () => <Ic s={15}><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></Ic>;
const IcDeal     = () => <Ic s={15}><path d="M3 21V10l9-7 9 7v11"/><path d="M9 21v-6h6v6"/></Ic>;
const IcOrder    = () => <Ic s={15}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></Ic>;

type Status = "active" | "prospect" | "vip" | "inactive";
type Nat    = "ae" | "sa" | "ma" | "fr" | "gb" | "in" | "ru" | "cn";

interface Person {
  id: string;
  name: string; name_ar: string;
  nat: Nat; flag: string;
  phone: string; email: string;
  budget: number;
  status: Status;
  deals: number;
  lastContact: string;
  agent: string;
  visa: boolean;
  address?: string;
  dob?: string;
  passportNo?: string;
}

const NAT_LABELS: Record<Nat, string> = { ae: "Emirati", sa: "Saudi", ma: "Moroccan", fr: "French", gb: "British", in: "Indian", ru: "Russian", cn: "Chinese" };

const STATUS_CFG: Record<Status, { en: string; ar: string; fr: string; color: string }> = {
  active:   { en: "Active",   ar: "نشط",        fr: "Actif",    color: "var(--emerald)" },
  prospect: { en: "Prospect", ar: "عميل محتمل",  fr: "Prospect", color: "var(--azure)"   },
  vip:      { en: "VIP",      ar: "VIP",          fr: "VIP",      color: "var(--gold)"    },
  inactive: { en: "Inactive", ar: "غير نشط",      fr: "Inactif",  color: "var(--ink-4)"  },
};

const aed = (n: number) => new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const PERSONS: Person[] = [
  { id: "p001", name: "Reem Al Hashemi",    name_ar: "ريم الهاشمي",     nat: "ae", flag: "🇦🇪", phone: "+971 50 123 4567", email: "reem@email.ae",       budget: 11_200_000, status: "vip",      deals: 2, lastContact: "2026-05-24", agent: "Yasmine K.", visa: true,  address: "Dubai Hills Estate, Dubai", dob: "1985-03-14", passportNo: "AE123456" },
  { id: "p002", name: "Abdullah Al Rashid", name_ar: "عبدالله الراشد",   nat: "sa", flag: "🇸🇦", phone: "+966 55 987 6543", email: "a.rashid@gmail.com",  budget: 8_500_000,  status: "vip",      deals: 3, lastContact: "2026-05-22", agent: "Omar B.",    visa: true,  address: "Al Olaya District, Riyadh", dob: "1978-07-22", passportNo: "SA987654" },
  { id: "p003", name: "Sophie Martin",      name_ar: "صوفي مارتان",      nat: "fr", flag: "🇫🇷", phone: "+33 6 12 34 56 78", email: "s.martin@gmail.com", budget: 6_400_000,  status: "active",   deals: 1, lastContact: "2026-05-20", agent: "Reem M.",    visa: false, address: "JBR, Dubai Marina, Dubai",  dob: "1990-11-05", passportNo: "FR456789" },
  { id: "p004", name: "Fatima Al Zaabi",    name_ar: "فاطمة الزعابي",    nat: "ae", flag: "🇦🇪", phone: "+971 52 456 7890", email: "fatima@email.ae",     budget: 6_400_000,  status: "active",   deals: 1, lastContact: "2026-05-19", agent: "Yasmine K.", visa: false, address: "Khalifa City, Abu Dhabi",   dob: "1992-02-28" },
  { id: "p005", name: "James Thornton",     name_ar: "جيمس ثورنتون",     nat: "gb", flag: "🇬🇧", phone: "+44 7700 900000",  email: "j.thornton@uk.com",   budget: 5_800_000,  status: "active",   deals: 2, lastContact: "2026-05-18", agent: "Nadia K.",   visa: true,  address: "Downtown Dubai",            dob: "1982-09-17", passportNo: "GB234567" },
  { id: "p006", name: "Priya Sharma",       name_ar: "بريا شارما",        nat: "in", flag: "🇮🇳", phone: "+971 54 321 0987", email: "priya@email.in",      budget: 3_200_000,  status: "prospect", deals: 0, lastContact: "2026-05-15", agent: "Adel H.",    visa: false },
  { id: "p007", name: "Youssef El Amrani",  name_ar: "يوسف العمراني",    nat: "ma", flag: "🇲🇦", phone: "+212 6 12 34 56 78", email: "y.amrani@ma.com",   budget: 4_100_000,  status: "active",   deals: 1, lastContact: "2026-05-14", agent: "Omar B.",    visa: true,  address: "Maarif, Casablanca",        dob: "1988-04-09", passportNo: "MA345678" },
  { id: "p008", name: "Dmitri Volkov",      name_ar: "ديمتري فولكوف",    nat: "ru", flag: "🇷🇺", phone: "+971 50 876 5432", email: "d.volkov@ru.com",      budget: 9_000_000,  status: "vip",      deals: 2, lastContact: "2026-05-13", agent: "Yasmine K.", visa: true,  address: "Palm Jumeirah, Dubai",       dob: "1975-12-01", passportNo: "RU678901" },
  { id: "p009", name: "Li Wei",             name_ar: "لي وي",             nat: "cn", flag: "🇨🇳", phone: "+971 55 654 3210", email: "liwei@cn.com",        budget: 7_500_000,  status: "active",   deals: 1, lastContact: "2026-05-10", agent: "Reem M.",    visa: true,  address: "DIFC, Dubai",               dob: "1986-06-30" },
  { id: "p010", name: "Hessa Al Mansouri",  name_ar: "حصة المنصوري",     nat: "ae", flag: "🇦🇪", phone: "+971 56 789 0123", email: "hessa@email.ae",      budget: 2_500_000,  status: "prospect", deals: 0, lastContact: "2026-05-08", agent: "Nadia K.",   visa: false },
  { id: "p011", name: "Karim Benali",       name_ar: "كريم بن علي",       nat: "ma", flag: "🇲🇦", phone: "+212 6 98 76 54 32", email: "k.benali@ma.com",  budget: 2_100_000,  status: "prospect", deals: 0, lastContact: "2026-05-05", agent: "Adel H.",    visa: false },
  { id: "p012", name: "Sara Al Nuaimi",     name_ar: "سارة النعيمي",      nat: "ae", flag: "🇦🇪", phone: "+971 50 111 2233", email: "sara@email.ae",       budget: 15_000_000, status: "vip",      deals: 4, lastContact: "2026-05-25", agent: "Yasmine K.", visa: true,  address: "Emirates Hills, Dubai",     dob: "1980-08-15", passportNo: "AE789012" },
];

const AGENTS = ["All agents", "Yasmine K.", "Omar B.", "Reem M.", "Adel H.", "Nadia K."];

/* ── Mock detail data generators ─────────────────────────────────────── */
function mockDeals(p: Person) {
  const base = [
    { id: "D-001", property: "Villa — Palm Jumeirah",      type: "Sale",   amount: 8_200_000, status: "signed",   date: "2026-03-12" },
    { id: "D-002", property: "Apt 3BR — Downtown Dubai",   type: "Sale",   amount: 3_100_000, status: "progress", date: "2026-05-02" },
    { id: "D-003", property: "Studio — JBR",               type: "Rental", amount: 120_000,   status: "active",   date: "2025-11-01" },
    { id: "D-004", property: "Penthouse — DIFC",           type: "Sale",   amount: 12_000_000,status: "signed",   date: "2024-09-20" },
  ];
  return base.slice(0, Math.max(1, p.deals || 1));
}

function mockDocuments(p: Person) {
  return [
    { name: `Passport — ${p.name}`,            type: "ID",       status: "valid",   date: "2026-01-10", size: "1.2 MB" },
    { name: "Emirates ID",                      type: "ID",       status: p.nat === "ae" ? "valid" : "na", date: "2026-02-05", size: "0.8 MB" },
    { name: "DLD Certificate",                  type: "Property", status: p.deals > 0 ? "valid" : "pending", date: "2026-03-15", size: "2.4 MB" },
    { name: "Sale & Purchase Agreement",        type: "Contract", status: p.deals > 0 ? "signed" : "draft", date: "2026-04-01", size: "3.1 MB" },
    { name: "Golden Visa Application",          type: "Visa",     status: p.visa ? "submitted" : "na",       date: "2026-05-10", size: "4.8 MB" },
    { name: "Bank Statement (6 months)",        type: "Finance",  status: "valid",   date: "2026-05-20", size: "0.5 MB" },
  ].filter(d => d.status !== "na");
}

function mockInvoices(p: Person) {
  return [
    { id: "INV-2026-041", desc: "Commission vente Palm Jumeirah", amount: 246_000, status: "paid",    date: "2026-03-20" },
    { id: "INV-2026-028", desc: "Frais dossier DLD",              amount: 16_400,  status: "paid",    date: "2026-02-14" },
    { id: "INV-2026-052", desc: "Commission vente Downtown",       amount: 93_000,  status: "pending", date: "2026-05-10" },
    { id: "INV-2025-189", desc: "Renouvellement contrat location", amount: 12_000,  status: "paid",    date: "2025-11-05" },
  ].slice(0, Math.max(2, p.deals + 1));
}

function mockOrders(p: Person) {
  return [
    { id: `ORD-${p.id}-001`, desc_en: "Property Viewing — Marina Gate T3",   desc_ar: "جولة عقارية — بوابة المارينا",     desc_fr: "Visite — Marina Gate T3",    amount: 0,          status: "completed", date: "2026-04-10", type_en: "Viewing",         type_ar: "جولة",         type_fr: "Visite"         },
    { id: `ORD-${p.id}-002`, desc_en: "SPA — Palm Jumeirah Villa",            desc_ar: "عقد بيع وشراء — فلة النخلة",       desc_fr: "Contrat SPA — Palm Jumeirah", amount: p.budget,    status: "signed",    date: "2026-03-18", type_en: "SPA Contract",    type_ar: "عقد SPA",      type_fr: "Contrat SPA"    },
    { id: `ORD-${p.id}-003`, desc_en: "DLD Registration",                     desc_ar: "تسجيل دائرة الأراضي",              desc_fr: "Enregistrement DLD",          amount: 16_400,      status: "completed", date: "2026-03-25", type_en: "DLD Reg.",        type_ar: "تسجيل DLD",    type_fr: "Enregistrement" },
    { id: `ORD-${p.id}-004`, desc_en: "Golden Visa Application",              desc_ar: "طلب التأشيرة الذهبية",             desc_fr: "Demande Visa Doré",           amount: 4_200,        status: p.visa ? "completed" : "pending", date: "2026-04-02", type_en: "Visa",       type_ar: "تأشيرة",       type_fr: "Visa"           },
  ].slice(0, Math.max(2, p.deals + 1));
}

function mockPayments(p: Person) {
  return [
    { id: "PAY-0081", method: "Bank Transfer", amount: 246_000, status: "cleared",   date: "2026-03-22", ref: "ENBD-TRF-98234" },
    { id: "PAY-0065", method: "Cheque",         amount: 16_400,  status: "cleared",   date: "2026-02-16", ref: "CHQ-004521" },
    { id: "PAY-0094", method: "Bank Transfer",  amount: 50_000,  status: "pending",   date: "2026-05-12", ref: "ENBD-TRF-10211" },
    { id: "PAY-0043", method: "Bank Transfer",  amount: 12_000,  status: "cleared",   date: "2025-11-06", ref: "ENBD-TRF-71289" },
  ].slice(0, Math.max(2, p.deals + 1));
}

const DEAL_STATUS: Record<string, { en: string; ar: string; fr: string; color: string; bg: string }> = {
  signed:   { en: "Signed",      ar: "موقّع",       fr: "Signé",      color: "var(--emerald)", bg: "rgba(16,185,129,0.1)"  },
  progress: { en: "In progress", ar: "جارٍ",         fr: "En cours",   color: "var(--gold)",    bg: "rgba(200,160,60,0.15)" },
  active:   { en: "Active",      ar: "نشط",          fr: "Actif",      color: "var(--azure)",   bg: "rgba(59,130,246,0.1)"  },
};
const DOC_STATUS: Record<string, { en: string; fr: string; ar: string; color: string }> = {
  valid:     { en: "Valid",      fr: "Valide",     ar: "صالح",    color: "var(--emerald)" },
  signed:    { en: "Signed",     fr: "Signé",      ar: "موقّع",    color: "var(--emerald)" },
  pending:   { en: "Pending",    fr: "En attente", ar: "معلّق",    color: "var(--gold)"    },
  submitted: { en: "Submitted",  fr: "Soumis",     ar: "مُقدَّم",   color: "var(--azure)"   },
  draft:     { en: "Draft",      fr: "Brouillon",  ar: "مسودة",   color: "var(--ink-4)"   },
};
const INV_STATUS: Record<string, { en: string; fr: string; ar: string; color: string; bg: string }> = {
  paid:    { en: "Paid",    fr: "Payée",       ar: "مدفوعة",    color: "var(--emerald)", bg: "rgba(16,185,129,0.1)"  },
  pending: { en: "Pending", fr: "En attente",  ar: "معلّقة",    color: "var(--gold)",    bg: "rgba(200,160,60,0.15)" },
  overdue: { en: "Overdue", fr: "En retard",   ar: "متأخرة",    color: "var(--rose)",    bg: "rgba(239,68,68,0.1)"   },
};
const ORD_STATUS: Record<string, { en: string; fr: string; ar: string; color: string; bg: string }> = {
  completed: { en: "Completed", fr: "Complété",   ar: "مكتمل",   color: "var(--emerald)", bg: "rgba(16,185,129,0.1)"  },
  signed:    { en: "Signed",    fr: "Signé",      ar: "موقّع",    color: "var(--azure)",   bg: "rgba(59,130,246,0.1)"  },
  pending:   { en: "Pending",   fr: "En attente", ar: "معلّق",    color: "var(--gold)",    bg: "rgba(200,160,60,0.15)" },
  cancelled: { en: "Cancelled", fr: "Annulé",     ar: "ملغى",    color: "var(--rose)",    bg: "rgba(239,68,68,0.1)"   },
};
const PAY_STATUS: Record<string, { en: string; fr: string; ar: string; color: string; bg: string }> = {
  cleared: { en: "Cleared", fr: "Validé",      ar: "مُصفَّى",    color: "var(--emerald)", bg: "rgba(16,185,129,0.1)"  },
  pending: { en: "Pending", fr: "En attente",  ar: "معلّق",     color: "var(--gold)",    bg: "rgba(200,160,60,0.15)" },
};

/* ── Detail view ─────────────────────────────────────────────────────── */
function PersonDetail({ person, onBack, lang, onDealConfirmed }: { person: Person; onBack: () => void; lang: string; onDealConfirmed?: (deal: ConfirmedDeal) => void }) {
  const [tab, setTab]           = useState<"deals" | "documents" | "orders" | "invoices" | "payments">("deals");
  const [showWizard, setShowWizard] = useState(false);
  const [addedDeals, setAddedDeals] = useState<ConfirmedDeal[]>([]);
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const scfg = STATUS_CFG[person.status];

  const TABS = [
    { key: "deals",    icon: <IcDeal />,    en: "Deals",     ar: "الصفقات",   fr: "Deals"      },
    { key: "documents",icon: <IcDoc2 />,    en: "Documents", ar: "الوثائق",   fr: "Documents"  },
    { key: "orders",   icon: <IcOrder />,   en: "Orders",    ar: "الطلبات",   fr: "Commandes"  },
    { key: "invoices", icon: <IcInvoice />, en: "Invoices",  ar: "الفواتير",  fr: "Factures"   },
    { key: "payments", icon: <IcPayment />, en: "Payments",  ar: "المدفوعات", fr: "Paiements"  },
  ] as const;

  const deals    = mockDeals(person);
  const docs     = mockDocuments(person);
  const orders   = mockOrders(person);
  const invoices = mockInvoices(person);
  const payments = mockPayments(person);

  const tl = (o: {en:string;ar:string;fr:string}) => lang === "ar" ? o.ar : lang === "fr" ? o.fr : o.en;

  const tdStyle: React.CSSProperties = { padding: "11px 16px", fontSize: 12.5, color: "var(--ink-2)" };
  const thStyle: React.CSSProperties = { padding: "9px 16px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar
        title={lang === "ar" ? person.name_ar : person.name}
        crumb={[lang === "ar" ? "العملاء" : "Clients", lang === "ar" ? "الأشخاص" : lang === "fr" ? "Personnes" : "Individuals"]}
      >
        <button onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: "var(--r)", background: "transparent", border: "1px solid var(--line-soft)", color: "var(--ink-3)", cursor: "pointer", fontSize: 12 }}>
          <IcBack />{lang === "ar" ? "رجوع" : lang === "fr" ? "Retour" : "Back"}
        </button>
      </Topbar>

      <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "14px 12px" : "24px 32px", background: "var(--bg-cream)" }}>

        {/* Info card */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "22px 26px", marginBottom: 22 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap" }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--gold-ghost)", display: "grid", placeItems: "center", fontSize: 22, fontWeight: 700, color: "var(--gold-deep)", flexShrink: 0 }}>
              {person.name[0]}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                <span className="font-display" style={{ fontSize: 18, color: "var(--ink)" }}>{lang === "ar" ? person.name_ar : person.name}</span>
                <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 999, background: `${scfg.color}18`, color: scfg.color }}>{tl(scfg)}</span>
                {person.visa && <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "rgba(200,160,60,0.15)", color: "var(--gold-deep)" }}>⭐ Golden Visa</span>}
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 14 }}>
                {person.flag} {NAT_LABELS[person.nat]} · {lang === "ar" ? "الميزانية" : lang === "fr" ? "Budget" : "Budget"} : <strong style={{ color: "var(--ink)" }}>{aed(person.budget)}</strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(3,1fr)", gap: 10 }}>
                {[
                  { icon: <IcPhone />, label: person.phone },
                  { icon: <IcMail />,  label: person.email },
                  person.address && { icon: <Ic s={14}><path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></Ic>, label: person.address },
                  person.passportNo && { icon: <IcDoc2 />, label: `Passport: ${person.passportNo}` },
                  { icon: <Ic s={14}><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></Ic>, label: `Agent: ${person.agent}` },
                  person.dob && { icon: <Ic s={14}><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Ic>, label: `DOB: ${person.dob}` },
                ].filter(Boolean).map((row, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: "var(--ink-3)" }}>
                    <span style={{ color: "var(--ink-4)", flexShrink: 0 }}>{(row as {icon:React.ReactNode;label:string}).icon}</span>
                    {(row as {icon:React.ReactNode;label:string}).label}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, textAlign: "end" }}>
              <div className="tnum font-display" style={{ fontSize: 26, color: "var(--gold)" }}>{person.deals}</div>
              <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{lang === "ar" ? "صفقات" : lang === "fr" ? "deals" : "deals"}</div>
              <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 4 }}>
                {lang === "ar" ? "آخر تواصل" : lang === "fr" ? "Dernier contact" : "Last contact"}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>{person.lastContact}</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 18, borderBottom: "1px solid var(--line-soft)" }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer",
              border: "none", background: "none",
              color: tab === t.key ? "var(--gold)" : "var(--ink-4)",
              borderBottom: `2px solid ${tab === t.key ? "var(--gold)" : "transparent"}`,
              marginBottom: -1,
            }}>
              <span style={{ color: tab === t.key ? "var(--gold)" : "var(--ink-4)" }}>{t.icon}</span>
              {tl(t)}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>

          {/* Deals */}
          {tab === "deals" && (
            <>
              {/* Add Deal button row */}
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 16px", borderBottom: "1px solid var(--line-soft)" }}>
                <button onClick={() => setShowWizard(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: "var(--r)", background: "var(--gold)", border: "none", color: "#1A1610", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  <Ic s={13}><path d="M12 5v14M5 12h14"/></Ic>
                  {lang === "ar" ? "إضافة صفقة" : lang === "fr" ? "Ajouter un deal" : "Add Deal"}
                </button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "var(--bg-cream)" }}>
                  {["ID", lang==="ar"?"العقار":lang==="fr"?"Bien":"Property", lang==="ar"?"النوع":"Type", lang==="ar"?"المبلغ":lang==="fr"?"Montant":"Amount", lang==="ar"?"الحالة":lang==="fr"?"Statut":"Status", lang==="ar"?"التاريخ":"Date"].map(h => <th key={h} style={thStyle}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {/* User-added deals (newest first) */}
                  {addedDeals.slice().reverse().map((d, i) => (
                    <tr key={d.crmRef} style={{ borderBottom: "1px solid var(--line-soft)", background: "rgba(200,160,60,0.04)" }}>
                      <td style={{ ...tdStyle, fontFamily: "monospace", color: "var(--azure)", fontSize: 11 }}>{d.crmRef}</td>
                      <td style={{ ...tdStyle, fontWeight: 500, color: "var(--ink)" }}>
                        {[d.propType, d.area].filter(Boolean).join(" — ") || "—"}
                      </td>
                      <td style={tdStyle}><span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "rgba(200,160,60,0.12)", color: "var(--gold-deep)", border: "1px solid rgba(200,160,60,0.3)", fontWeight: 600 }}>{d.category.toUpperCase()}</span></td>
                      <td style={{ ...tdStyle, fontWeight: 600 }} className="tnum">{d.budgetMax > 0 ? aed(d.budgetMax) : d.budgetMin > 0 ? aed(d.budgetMin) : "—"}</td>
                      <td style={tdStyle}><span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(59,130,246,0.1)", color: "var(--azure)" }}>NEW</span></td>
                      <td style={{ ...tdStyle, color: "var(--ink-4)" }}>{d.date}</td>
                    </tr>
                  ))}
                  {/* Mock deals */}
                  {deals.map((d, i) => (
                    <tr key={d.id} style={{ borderBottom: i < deals.length-1 ? "1px solid var(--line-soft)" : "none" }}>
                      <td style={{ ...tdStyle, fontFamily: "monospace", color: "var(--ink-4)", fontSize: 11 }}>{d.id}</td>
                      <td style={{ ...tdStyle, fontWeight: 500, color: "var(--ink)" }}>{d.property}</td>
                      <td style={{ ...tdStyle }}>{d.type}</td>
                      <td style={{ ...tdStyle, fontWeight: 600 }} className="tnum">{aed(d.amount)}</td>
                      <td style={tdStyle}><span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: DEAL_STATUS[d.status].bg, color: DEAL_STATUS[d.status].color }}>{DEAL_STATUS[d.status].en}</span></td>
                      <td style={tdStyle}>{d.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Documents */}
          {tab === "documents" && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--bg-cream)" }}>
                {[lang==="ar"?"الوثيقة":lang==="fr"?"Document":"Document", lang==="ar"?"النوع":"Type", lang==="ar"?"الحالة":lang==="fr"?"Statut":"Status", lang==="ar"?"التاريخ":"Date", "Size"].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>{docs.map((d, i) => (
                <tr key={d.name} style={{ borderBottom: i < docs.length-1 ? "1px solid var(--line-soft)" : "none" }}>
                  <td style={{ ...tdStyle, fontWeight: 500, color: "var(--ink)", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ color: "var(--ink-4)" }}><IcDoc2 /></span>{d.name}
                  </td>
                  <td style={tdStyle}><span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "var(--bg-cream)", color: "var(--ink-4)", border: "1px solid var(--line-soft)" }}>{d.type}</span></td>
                  <td style={tdStyle}><span style={{ fontSize: 10.5, fontWeight: 600, color: DOC_STATUS[d.status].color }}>{DOC_STATUS[d.status].en}</span></td>
                  <td style={tdStyle}>{d.date}</td>
                  <td style={{ ...tdStyle, color: "var(--ink-4)" }}>{d.size}</td>
                </tr>
              ))}</tbody>
            </table>
          )}

          {/* Orders */}
          {tab === "orders" && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--bg-cream)" }}>
                {["N°", lang==="ar"?"النوع":lang==="fr"?"Type":"Type", lang==="ar"?"الوصف":lang==="fr"?"Description":"Description", lang==="ar"?"المبلغ":lang==="fr"?"Montant":"Amount", lang==="ar"?"الحالة":lang==="fr"?"Statut":"Status", lang==="ar"?"التاريخ":"Date"].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>{orders.map((o, i) => {
                const ostat = ORD_STATUS[o.status] ?? ORD_STATUS.pending;
                return (
                  <tr key={o.id} style={{ borderBottom: i < orders.length-1 ? "1px solid var(--line-soft)" : "none" }}>
                    <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "var(--ink-4)" }}>{o.id}</td>
                    <td style={tdStyle}><span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "var(--bg-cream)", color: "var(--ink-4)", border: "1px solid var(--line-soft)" }}>{lang==="ar"?o.type_ar:lang==="fr"?o.type_fr:o.type_en}</span></td>
                    <td style={{ ...tdStyle, fontWeight: 500, color: "var(--ink)" }}>{lang==="ar"?o.desc_ar:lang==="fr"?o.desc_fr:o.desc_en}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }} className="tnum">{o.amount > 0 ? aed(o.amount) : "—"}</td>
                    <td style={tdStyle}><span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: ostat.bg, color: ostat.color }}>{lang==="ar"?ostat.ar:lang==="fr"?ostat.fr:ostat.en}</span></td>
                    <td style={tdStyle}>{o.date}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          )}

          {/* Invoices */}
          {tab === "invoices" && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--bg-cream)" }}>
                {["N°", lang==="ar"?"الوصف":lang==="fr"?"Description":"Description", lang==="ar"?"المبلغ":lang==="fr"?"Montant":"Amount", lang==="ar"?"الحالة":lang==="fr"?"Statut":"Status", lang==="ar"?"التاريخ":"Date"].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>{invoices.map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: i < invoices.length-1 ? "1px solid var(--line-soft)" : "none" }}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "var(--ink-4)" }}>{inv.id}</td>
                  <td style={{ ...tdStyle, fontWeight: 500, color: "var(--ink)" }}>{inv.desc}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }} className="tnum">{aed(inv.amount)}</td>
                  <td style={tdStyle}><span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: INV_STATUS[inv.status].bg, color: INV_STATUS[inv.status].color }}>{INV_STATUS[inv.status].en}</span></td>
                  <td style={tdStyle}>{inv.date}</td>
                </tr>
              ))}</tbody>
            </table>
          )}

          {/* Payments */}
          {tab === "payments" && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "var(--bg-cream)" }}>
                {["ID", lang==="ar"?"طريقة الدفع":lang==="fr"?"Méthode":"Method", lang==="ar"?"المبلغ":lang==="fr"?"Montant":"Amount", lang==="ar"?"الحالة":lang==="fr"?"Statut":"Status", "Réf.", lang==="ar"?"التاريخ":"Date"].map(h => <th key={h} style={thStyle}>{h}</th>)}
              </tr></thead>
              <tbody>{payments.map((pay, i) => (
                <tr key={pay.id} style={{ borderBottom: i < payments.length-1 ? "1px solid var(--line-soft)" : "none" }}>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "var(--ink-4)" }}>{pay.id}</td>
                  <td style={tdStyle}>{pay.method}</td>
                  <td style={{ ...tdStyle, fontWeight: 600 }} className="tnum">{aed(pay.amount)}</td>
                  <td style={tdStyle}><span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: PAY_STATUS[pay.status].bg, color: PAY_STATUS[pay.status].color }}>{PAY_STATUS[pay.status].en}</span></td>
                  <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "var(--ink-4)" }}>{pay.ref}</td>
                  <td style={tdStyle}>{pay.date}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>

      {/* Deal Wizard */}
      {showWizard && (
        <DealWizard
          clientName={lang === "ar" ? person.name_ar : person.name}
          clientId={person.id}
          clientAgent={person.agent}
          lang={lang}
          onClose={() => setShowWizard(false)}
          onConfirm={deal => {
            setAddedDeals(d => [...d, deal]);
            onDealConfirmed?.(deal);
            setShowWizard(false);
          }}
        />
      )}
    </div>
  );
}

/* ── List view ───────────────────────────────────────────────────────── */
export function ScreenClientsPersonne({ onDealConfirmed }: { onDealConfirmed?: (deal: ConfirmedDeal) => void } = {}) {
  const { lang } = useLang();
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState<Status | "all">("all");
  const [agent,   setAgent]   = useState("All agents");
  const [visaOnly, setVisaOnly] = useState(false);

  const selected = selectedId ? PERSONS.find(p => p.id === selectedId) : null;
  if (selected) return <PersonDetail person={selected} onBack={() => setSelectedId(null)} lang={lang} onDealConfirmed={onDealConfirmed} />;

  const filtered = PERSONS.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.email.includes(q) || p.phone.includes(q);
    const matchStatus = status === "all" || p.status === status;
    const matchAgent  = agent === "All agents" || p.agent === agent;
    const matchVisa   = !visaOnly || p.visa;
    return matchSearch && matchStatus && matchAgent && matchVisa;
  });

  const title = lang === "ar" ? t.nav_personne : lang === "fr" ? "Personnes" : "Individuals";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title} crumb={[lang === "ar" ? t.nav_clients : "Clients"]}>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--r)", background: "var(--gold)", color: "#1A1610", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          <IcPlus2 />{lang === "ar" ? "عميل جديد" : lang === "fr" ? "Nouveau client" : "New Client"}
        </button>
      </Topbar>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-cream)" }}>
        {/* Filter bar */}
        <div style={{ padding: isMob ? "12px" : "14px 24px", background: "var(--bg-paper)", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "7px 12px", flex: isMob ? 1 : undefined, minWidth: 200 }}>
            <IcSearch2 />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "بحث..." : lang === "fr" ? "Rechercher..." : "Search..."}
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "var(--ink)", width: "100%" }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["all", "vip", "active", "prospect", "inactive"] as const).map(s => {
              const cfg = s === "all" ? null : STATUS_CFG[s];
              const active = status === s;
              return (
                <button key={s} onClick={() => setStatus(s)} style={{ padding: "6px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: active ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap", background: active ? (cfg ? `${cfg.color}18` : "var(--gold)") : "transparent", color: active ? (cfg ? cfg.color : "#1A1610") : "var(--ink-4)", border: active ? (cfg ? `1px solid ${cfg.color}` : "1px solid var(--gold)") : "1px solid var(--line-soft)" }}>
                  {s === "all" ? (lang === "ar" ? "الكل" : lang === "fr" ? "Tous" : "All") : (lang === "ar" ? cfg!.ar : lang === "fr" ? cfg!.fr : cfg!.en)}
                  <span style={{ marginInlineStart: 5, fontSize: 10, opacity: 0.6 }}>{s === "all" ? PERSONS.length : PERSONS.filter(p => p.status === s).length}</span>
                </button>
              );
            })}
          </div>
          <select value={agent} onChange={e => setAgent(e.target.value)} style={{ padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}>
            {AGENTS.map(a => <option key={a}>{a}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)", cursor: "pointer", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={visaOnly} onChange={e => setVisaOnly(e.target.checked)} style={{ accentColor: "var(--gold)" }} />
            {lang === "ar" ? "تأشيرة ذهبية فقط" : lang === "fr" ? "Visa Doré uniquement" : "Golden Visa only"}
          </label>
          <div style={{ marginInlineStart: "auto", fontSize: 11.5, color: "var(--ink-4)" }}>{filtered.length} {lang === "ar" ? "عميل" : "client(s)"}</div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "12px" : "20px 24px" }}>
          <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
            {!isMob && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-cream)" }}>
                    {[lang==="ar"?"العميل":lang==="fr"?"Client":"Client", lang==="ar"?"جهة الاتصال":lang==="fr"?"Contact":"Contact", lang==="ar"?"الميزانية":lang==="fr"?"Budget":"Budget", lang==="ar"?"الصفقات":lang==="fr"?"Deals":"Deals", lang==="ar"?"الوكيل":lang==="fr"?"Agent":"Agent", lang==="ar"?"الحالة":lang==="fr"?"Statut":"Status"].map(h => (
                      <th key={h} style={{ padding: "10px 18px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const scfg = STATUS_CFG[p.status];
                    return (
                      <tr key={p.id}
                        onClick={() => setSelectedId(p.id)}
                        style={{ borderBottom: i < filtered.length-1 ? "1px solid var(--line-soft)" : "none", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-cream)"}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                      >
                        <td style={{ padding: "13px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--gold-ghost)", display: "grid", placeItems: "center", fontSize: 14, fontWeight: 700, color: "var(--gold-deep)", flexShrink: 0 }}>{p.name[0]}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                                {lang === "ar" ? p.name_ar : p.name}
                                {p.visa && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "rgba(200,160,60,0.15)", color: "var(--gold-deep)" }}>⭐ Visa</span>}
                              </div>
                              <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{p.flag} {NAT_LABELS[p.nat]} · {p.lastContact}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--ink-3)" }}><IcPhone />{p.phone}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--ink-3)" }}><IcMail />{p.email}</div>
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px" }}>
                          <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{aed(p.budget)}</div>
                          {p.budget >= 2_000_000 && <div style={{ fontSize: 10, color: "var(--gold)", marginTop: 2 }}>✓ Golden Visa eligible</div>}
                        </td>
                        <td style={{ padding: "13px 18px", fontSize: 13, color: "var(--ink-2)" }} className="tnum">{p.deals}</td>
                        <td style={{ padding: "13px 18px", fontSize: 12.5, color: "var(--ink-3)" }}>{p.agent}</td>
                        <td style={{ padding: "13px 18px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: `${scfg.color}18`, color: scfg.color }}>{lang==="ar"?scfg.ar:lang==="fr"?scfg.fr:scfg.en}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {isMob && filtered.map((p, i) => {
              const scfg = STATUS_CFG[p.status];
              return (
                <div key={p.id} onClick={() => setSelectedId(p.id)} style={{ padding: "14px 16px", borderBottom: i < filtered.length-1 ? "1px solid var(--line-soft)" : "none", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--gold-ghost)", display: "grid", placeItems: "center", fontSize: 15, fontWeight: 700, color: "var(--gold-deep)", flexShrink: 0 }}>{p.name[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{lang==="ar"?p.name_ar:p.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{p.flag} · {p.lastContact}</div>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${scfg.color}18`, color: scfg.color }}>{lang==="ar"?scfg.ar:lang==="fr"?scfg.fr:scfg.en}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{p.phone} · {aed(p.budget)}</div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>{lang==="ar"?"لا توجد نتائج":lang==="fr"?"Aucun résultat":"No results"}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
