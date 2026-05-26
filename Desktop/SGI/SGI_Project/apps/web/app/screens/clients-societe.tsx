"use client";
import React, { useState } from "react";
import { Topbar, Ic, IcPhone, IcMail } from "@/components/sgi-ui";
import { DealWizard, type ConfirmedDeal } from "@/components/deal-wizard";
import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const IcSearch2  = () => <Ic s={15}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ic>;
const IcPlus2    = () => <Ic s={15}><path d="M12 5v14M5 12h14"/></Ic>;
const IcGlobe    = () => <Ic s={14}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Ic>;
const IcBack     = () => <Ic s={16}><path d="m15 18-6-6 6-6"/></Ic>;
const IcDeal     = () => <Ic s={15}><path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z"/></Ic>;
const IcDoc2     = () => <Ic s={15}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></Ic>;
const IcInvoice  = () => <Ic s={15}><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></Ic>;
const IcPayment  = () => <Ic s={15}><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></Ic>;
const IcOrder    = () => <Ic s={15}><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></Ic>;
const IcWallet   = () => <Ic s={15}><path d="M20 12V8H6a2 2 0 0 1 0-4h12v4"/><path d="M4 6v12c0 1.1.9 2 2 2h14v-4"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></Ic>;

/* ── Contact action helpers ────────────────────────────────────── */
function ContactBtn({ href, bg, children }: { href: string; bg: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target={href.startsWith("http") ? "_blank" : undefined}
      rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
      onClick={e => e.stopPropagation()}
      style={{
        width: 36, height: 36, borderRadius: "50%",
        background: bg, display: "inline-flex",
        alignItems: "center", justifyContent: "center",
        flexShrink: 0, textDecoration: "none", color: "#fff",
        fontSize: 15, transition: "opacity 0.15s",
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = "0.8")}
      onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
    >
      {children}
    </a>
  );
}
function waNum(phone: string) { return phone.replace(/[^\d]/g, ""); }
function IcWA() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}
function IcSMS() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}
function IcMailSm() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    </svg>
  );
}
function IcPhoneSm() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.37a16 16 0 0 0 6 6l1.27-.96a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

interface WalletTx { id: string; type: "purchase" | "payment"; amount: number; aed: number; desc: string; date: string; ref?: string; }
function initBalance(c: Company) {
  return (c.status === "vip" ? 25000 : c.status === "active" ? 10000 : c.status === "prospect" ? 3000 : 1000) + c.deals * 5000;
}
function mockWalletTxs(c: Company): WalletTx[] {
  const b = initBalance(c);
  const txs: WalletTx[] = [
    { id: "W-001", type: "purchase", amount: Math.floor(b * 0.6), aed: Math.floor(b * 0.6), desc: "Achat initial de points entreprise", date: "2026-01-10" },
    { id: "W-002", type: "purchase", amount: Math.floor(b * 0.4), aed: Math.floor(b * 0.4), desc: "Recharge portefeuille Q1", date: "2026-03-15" },
  ];
  if (c.deals > 1) txs.push({ id: "W-003", type: "purchase", amount: 2000, aed: 2000, desc: "Bonus partenariat — contrat signé", date: "2026-04-01" });
  return txs;
}

type Status  = "active" | "prospect" | "vip" | "inactive";
type Sector  = "realestate" | "investment" | "construction" | "retail" | "hospitality" | "finance" | "other";
type TabKey  = "deals" | "documents" | "orders" | "invoices" | "payments" | "wallet";

interface Company {
  id: string;
  name: string; name_ar: string;
  country: string; flag: string;
  sector: Sector;
  contact: string; contactRole: string;
  phone: string; email: string; website?: string;
  annualRevenue: number;
  deals: number;
  status: Status;
  agent: string;
  languages: string[];
  vatNo?: string;
  tradeLicense?: string;
}

const LANG_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ar: { label: "AR", color: "#92610a", bg: "rgba(200,160,60,0.15)" },
  en: { label: "EN", color: "#1d4ed8", bg: "rgba(59,130,246,0.12)" },
  fr: { label: "FR", color: "#6d28d9", bg: "rgba(139,92,246,0.12)" },
  ru: { label: "RU", color: "#065f46", bg: "rgba(16,185,129,0.12)" },
  zh: { label: "ZH", color: "#991b1b", bg: "rgba(239,68,68,0.12)"  },
  hi: { label: "HI", color: "#92400e", bg: "rgba(245,158,11,0.12)" },
};
function LangPills({ langs }: { langs: string[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {langs.map(l => {
        const cfg = LANG_CFG[l] ?? { label: l.toUpperCase(), color: "var(--ink-3)", bg: "var(--bg-cream)" };
        return (
          <span key={l} style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: cfg.bg, color: cfg.color, letterSpacing: "0.05em" }}>
            {cfg.label}
          </span>
        );
      })}
    </div>
  );
}

const SECTOR_CFG: Record<Sector, { en: string; ar: string; fr: string; color: string }> = {
  realestate:   { en: "Real Estate",   ar: "عقارات",          fr: "Immobilier",    color: "var(--gold)"    },
  investment:   { en: "Investment",    ar: "استثمار",          fr: "Investissement",color: "var(--azure)"   },
  construction: { en: "Construction",  ar: "بناء وتشييد",      fr: "Construction",  color: "var(--emerald)" },
  retail:       { en: "Retail",        ar: "تجزئة",            fr: "Commerce",      color: "#8B5CF6"        },
  hospitality:  { en: "Hospitality",   ar: "ضيافة وفنادق",     fr: "Hôtellerie",    color: "var(--rose)"    },
  finance:      { en: "Finance",       ar: "مالية",             fr: "Finance",       color: "#F59E0B"        },
  other:        { en: "Other",         ar: "أخرى",              fr: "Autre",         color: "var(--ink-4)"  },
};

const STATUS_CFG: Record<Status, { en: string; ar: string; fr: string; color: string }> = {
  active:   { en: "Active",    ar: "نشطة",       fr: "Active",    color: "var(--emerald)" },
  prospect: { en: "Prospect",  ar: "محتملة",      fr: "Prospect",  color: "var(--azure)"   },
  vip:      { en: "VIP",       ar: "VIP",         fr: "VIP",       color: "var(--gold)"    },
  inactive: { en: "Inactive",  ar: "غير نشطة",    fr: "Inactive",  color: "var(--ink-4)"  },
};

const DEAL_STATUS = {
  won:        { en: "Won",        ar: "مُنجز",     fr: "Gagné",       color: "var(--emerald)" },
  active:     { en: "Active",     ar: "نشط",       fr: "En cours",    color: "var(--azure)"   },
  negotiation:{ en: "Negotiation",ar: "تفاوض",     fr: "Négociation", color: "var(--gold)"    },
  lost:       { en: "Lost",       ar: "خسر",       fr: "Perdu",       color: "var(--rose)"    },
};
const DOC_STATUS = {
  verified:   { en: "Verified",   ar: "موثق",      fr: "Vérifié",     color: "var(--emerald)" },
  pending:    { en: "Pending",    ar: "معلق",       fr: "En attente",  color: "var(--gold)"    },
  expired:    { en: "Expired",    ar: "منتهي",      fr: "Expiré",      color: "var(--rose)"    },
};
const INV_STATUS = {
  paid:       { en: "Paid",       ar: "مدفوعة",    fr: "Payée",       color: "var(--emerald)" },
  pending:    { en: "Pending",    ar: "معلقة",      fr: "En attente",  color: "var(--gold)"    },
  overdue:    { en: "Overdue",    ar: "متأخرة",     fr: "En retard",   color: "var(--rose)"    },
};
const PAY_STATUS = {
  cleared:    { en: "Cleared",    ar: "مقبولة",    fr: "Encaissé",    color: "var(--emerald)" },
  pending:    { en: "Pending",    ar: "معلق",       fr: "En attente",  color: "var(--gold)"    },
};
const ORD_STATUS = {
  completed:  { en: "Completed",  ar: "مكتمل",     fr: "Complété",    color: "var(--emerald)" },
  signed:     { en: "Signed",     ar: "موقّع",      fr: "Signé",       color: "var(--azure)"   },
  pending:    { en: "Pending",    ar: "معلّق",      fr: "En attente",  color: "var(--gold)"    },
  cancelled:  { en: "Cancelled",  ar: "ملغى",      fr: "Annulé",      color: "var(--rose)"    },
};

const aed = (n: number) => new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);
const fmt  = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

const COMPANIES: Company[] = [
  { id: "c001", name: "Al Maktoum Holding",          name_ar: "مجموعة آل مكتوم القابضة",    country: "UAE",     flag: "🇦🇪", sector: "investment",   contact: "Sultan Al Maktoum",    contactRole: "CEO",                 phone: "+971 4 123 4567",    email: "info@amholding.ae",        website: "amholding.ae",  annualRevenue: 18_400_000, deals: 4, status: "vip",      agent: "Yasmine K.", languages: ["ar", "en"],       vatNo: "100345678900003", tradeLicense: "DED-2019-00345" },
  { id: "c002", name: "Gulf Properties LLC",          name_ar: "شركة الخليج للعقارات",        country: "UAE",     flag: "🇦🇪", sector: "realestate",   contact: "Mariam Al Suwaidi",    contactRole: "Managing Director",   phone: "+971 4 987 6543",    email: "m.suwaidi@gulfprop.ae",    website: "gulfprop.ae",   annualRevenue: 7_800_000,  deals: 6, status: "vip",      agent: "Omar B.",    languages: ["ar", "en"],       vatNo: "100567890100003", tradeLicense: "DED-2017-00892" },
  { id: "c003", name: "Invest Maroc SARL",            name_ar: "إنفيست المغرب",               country: "Morocco", flag: "🇲🇦", sector: "investment",   contact: "Mehdi Bensouda",      contactRole: "General Manager",     phone: "+212 5 22 34 56 78", email: "m.bensouda@investma.com",                    annualRevenue: 5_200_000,  deals: 3, status: "active",   agent: "Omar B.",    languages: ["ar", "fr"] },
  { id: "c004", name: "Riyadh Development Co.",       name_ar: "شركة الرياض للتطوير",         country: "KSA",     flag: "🇸🇦", sector: "construction", contact: "Turki Al Faisal",     contactRole: "Chairman",            phone: "+966 11 234 5678",   email: "t.faisal@rdc.sa",          website: "rdc.sa",        annualRevenue: 9_100_000,  deals: 2, status: "active",   agent: "Yasmine K.", languages: ["ar", "en"],       vatNo: "300123456700003" },
  { id: "c005", name: "Dubai Hospitality Group",      name_ar: "مجموعة دبي للضيافة",          country: "UAE",     flag: "🇦🇪", sector: "hospitality",  contact: "Khalid Al Qasimi",     contactRole: "President",           phone: "+971 4 567 8901",    email: "k.qasimi@dhg.ae",          website: "dhg.ae",        annualRevenue: 12_500_000, deals: 5, status: "vip",      agent: "Reem M.",    languages: ["ar", "en", "fr"], vatNo: "100987654300003", tradeLicense: "DED-2015-01234" },
  { id: "c006", name: "Casablanca Real Estate SA",    name_ar: "الدار البيضاء للعقارات",      country: "Morocco", flag: "🇲🇦", sector: "realestate",   contact: "Leila Chraibi",        contactRole: "Director",            phone: "+212 5 22 98 76 54", email: "l.chraibi@crsa.ma",                          annualRevenue: 3_400_000,  deals: 2, status: "active",   agent: "Adel H.",    languages: ["ar", "fr"] },
  { id: "c007", name: "Emirates Financial Partners",  name_ar: "شركاء الإمارات الماليون",     country: "UAE",     flag: "🇦🇪", sector: "finance",      contact: "Ahmad Al Muhairi",     contactRole: "Partner",             phone: "+971 2 345 6789",    email: "a.muhairi@efp.ae",         website: "efp.ae",        annualRevenue: 6_700_000,  deals: 3, status: "active",   agent: "Nadia K.",   languages: ["ar", "en"],       vatNo: "100234567800003" },
  { id: "c008", name: "Vision Construct KSA",         name_ar: "رؤية للإنشاء المملكة",        country: "KSA",     flag: "🇸🇦", sector: "construction", contact: "Nora Al Turki",        contactRole: "Operations Director", phone: "+966 12 456 7890",   email: "n.turki@vcksa.sa",         website: "vcksa.sa",      annualRevenue: 4_800_000,  deals: 1, status: "prospect", agent: "Adel H.",    languages: ["ar", "en"] },
  { id: "c009", name: "Mena Retail Holdings",         name_ar: "مينا القابضة للتجزئة",        country: "UAE",     flag: "🇦🇪", sector: "retail",       contact: "Sara Al Dhaheri",      contactRole: "CEO",                 phone: "+971 4 678 9012",    email: "s.dhaheri@mena-retail.ae", website: "mena-retail.ae",annualRevenue: 8_200_000,  deals: 2, status: "active",   agent: "Reem M.",    languages: ["ar", "en"],       vatNo: "100876543200003", tradeLicense: "DED-2020-00567" },
  { id: "c010", name: "Infinity Maroc Partners",      name_ar: "إنفينيتي شركاء المغرب",       country: "Morocco", flag: "🇲🇦", sector: "investment",   contact: "Rachid El Fassi",      contactRole: "Founding Partner",    phone: "+212 5 37 12 34 56", email: "r.elfassi@imp.ma",                           annualRevenue: 2_900_000,  deals: 1, status: "prospect", agent: "Yasmine K.", languages: ["ar", "fr"] },
  { id: "c011", name: "Al Ain Properties PJSC",       name_ar: "شركة العين للعقارات",         country: "UAE",     flag: "🇦🇪", sector: "realestate",   contact: "Hamdan Al Nahyan",     contactRole: "Vice Chairman",       phone: "+971 3 789 0123",    email: "h.alnahyan@aap.ae",        website: "aap.ae",        annualRevenue: 14_300_000, deals: 7, status: "vip",      agent: "Yasmine K.", languages: ["ar", "en"],       vatNo: "100765432100003", tradeLicense: "DED-2012-00189" },
  { id: "c012", name: "Saudi Luxury Hospitality Co.", name_ar: "شركة الضيافة الفاخرة السعودية",country: "KSA",    flag: "🇸🇦", sector: "hospitality",  contact: "Faisal Al Saud",       contactRole: "Executive Director",  phone: "+966 11 890 1234",   email: "f.alsaud@slhc.sa",         website: "slhc.sa",       annualRevenue: 11_600_000, deals: 3, status: "vip",      agent: "Omar B.",    languages: ["ar", "en"] },
];

const AGENTS  = ["All agents", "Yasmine K.", "Omar B.", "Reem M.", "Adel H.", "Nadia K."];
const SECTORS = ["all", ...Object.keys(SECTOR_CFG)] as const;

/* ─── Mock data generators ───────────────────────────────────── */
type DealStatus = keyof typeof DEAL_STATUS;
type DocStatus  = keyof typeof DOC_STATUS;
type InvStatus  = keyof typeof INV_STATUS;
type PayStatus  = keyof typeof PAY_STATUS;

function mockDeals(c: Company) {
  const bases = [
    { prop: "Marina Gate Tower 3 — Unit 4502", type_en: "Sale", type_ar: "بيع", type_fr: "Vente", amount: 3_800_000, date: "2026-03-18", status: "won" as DealStatus },
    { prop: "Business Bay Office Floor 12", type_en: "Commercial", type_ar: "تجاري", type_fr: "Commercial", amount: 6_200_000, date: "2026-04-02", status: "active" as DealStatus },
    { prop: "DIFC Grade A Office — Suite 800", type_en: "Long-Term Rental", type_ar: "إيجار طويل", type_fr: "Location longue durée", amount: 980_000, date: "2026-02-14", status: "negotiation" as DealStatus },
    { prop: "Palm Jumeirah Villa — Signature", type_en: "Sale", type_ar: "بيع", type_fr: "Vente", amount: 12_500_000, date: "2025-11-20", status: "won" as DealStatus },
    { prop: "Downtown Dubai — Penthouse 5201", type_en: "Sale", type_ar: "بيع", type_fr: "Vente", amount: 8_700_000, date: "2026-01-05", status: "active" as DealStatus },
    { prop: "JBR — Retail Podium Level 2", type_en: "Commercial Rental", type_ar: "إيجار تجاري", type_fr: "Location commerciale", amount: 450_000, date: "2025-09-30", status: "won" as DealStatus },
    { prop: "Abu Dhabi — Saadiyat Island Villa", type_en: "Sale", type_ar: "بيع", type_fr: "Vente", amount: 5_400_000, date: "2026-05-01", status: "negotiation" as DealStatus },
  ];
  return bases.slice(0, Math.min(c.deals, bases.length));
}

function mockDocuments(c: Company) {
  const docs = [
    { name_en: "Trade License", name_ar: "رخصة تجارية", name_fr: "Licence commerciale", ref: c.tradeLicense ?? "DED-2023-00001", date: "2026-01-15", exp: "2027-01-14", status: "verified" as DocStatus },
    { name_en: "VAT Registration Certificate", name_ar: "شهادة التسجيل الضريبي", name_fr: "Certificat TVA", ref: c.vatNo ?? "N/A", date: "2023-06-01", exp: "2026-12-31", status: "verified" as DocStatus },
    { name_en: "MOA / Articles of Incorporation", name_ar: "عقد التأسيس", name_fr: "Actes constitutifs", ref: "MOA-2021-7734", date: "2021-03-10", exp: undefined, status: "verified" as DocStatus },
    { name_en: "Board Resolution — Property Acquisition", name_ar: "قرار مجلس الإدارة", name_fr: "Résolution du conseil", ref: "BR-2026-04", date: "2026-04-08", exp: undefined, status: "pending" as DocStatus },
    { name_en: "Power of Attorney", name_ar: "توكيل رسمي", name_fr: "Procuration", ref: "POA-UAE-2025-118", date: "2025-11-22", exp: "2026-11-21", status: "verified" as DocStatus },
    { name_en: "MOU — Infinity International", name_ar: "مذكرة تفاهم", name_fr: "Protocole d'accord", ref: "MOU-INF-2026-003", date: "2026-02-01", exp: "2026-08-01", status: "verified" as DocStatus },
  ];
  return docs.slice(0, c.deals + 2);
}

function mockInvoices(c: Company) {
  return [
    { ref: `INV-${c.id.toUpperCase()}-001`, date: "2026-03-20", due: "2026-04-20", amount: c.annualRevenue * 0.03, status: "paid" as InvStatus,    desc_en: "Commission — Q1 2026", desc_fr: "Commission — T1 2026", desc_ar: "عمولة — الربع الأول 2026" },
    { ref: `INV-${c.id.toUpperCase()}-002`, date: "2026-04-15", due: "2026-05-15", amount: c.annualRevenue * 0.025, status: "paid" as InvStatus,   desc_en: "Advisory Fees — April", desc_fr: "Honoraires — Avril", desc_ar: "رسوم استشارية — أبريل" },
    { ref: `INV-${c.id.toUpperCase()}-003`, date: "2026-05-10", due: "2026-06-10", amount: c.annualRevenue * 0.04,  status: "pending" as InvStatus, desc_en: "Commission — Q2 2026", desc_fr: "Commission — T2 2026", desc_ar: "عمولة — الربع الثاني 2026" },
  ];
}

function mockOrders(c: Company) {
  return [
    { id: `ORD-${c.id}-001`, type_en: "Property Viewing",   type_ar: "جولة عقارية",   type_fr: "Visite",            desc_en: "Due diligence visit — DIFC Office Tower",     desc_ar: "زيارة العناية الواجبة — برج DIFC",     desc_fr: "Visite due diligence — DIFC Office Tower",     amount: 0,                  status: "completed", date: "2026-03-05" },
    { id: `ORD-${c.id}-002`, type_en: "MOU",                type_ar: "مذكرة تفاهم",   type_fr: "Protocole d'accord",desc_en: "MOU — Exclusive Partnership 2026",             desc_ar: "مذكرة تفاهم — شراكة حصرية 2026",       desc_fr: "MOU — Partenariat exclusif 2026",              amount: 0,                  status: "signed",    date: "2026-02-01" },
    { id: `ORD-${c.id}-003`, type_en: "SPA Contract",       type_ar: "عقد SPA",       type_fr: "Contrat SPA",       desc_en: "Sale & Purchase Agreement — Business Bay",     desc_ar: "عقد بيع وشراء — الخليج التجاري",       desc_fr: "Contrat SPA — Business Bay",                   amount: c.annualRevenue * 0.5, status: "signed", date: "2026-03-18" },
    { id: `ORD-${c.id}-004`, type_en: "DLD Registration",   type_ar: "تسجيل DLD",     type_fr: "Enregistrement DLD",desc_en: "Dubai Land Department registration",           desc_ar: "تسجيل دائرة الأراضي والأملاك",         desc_fr: "Enregistrement Département foncier Dubaï",    amount: 32_800,             status: "completed", date: "2026-03-25" },
    { id: `ORD-${c.id}-005`, type_en: "Maintenance Order",  type_ar: "أمر صيانة",     type_fr: "Bon de travaux",    desc_en: "Annual FM service contract renewal",           desc_ar: "تجديد عقد خدمات الإدارة السنوي",       desc_fr: "Renouvellement contrat FM annuel",             amount: c.annualRevenue * 0.02, status: "pending", date: "2026-05-01" },
  ].slice(0, Math.min(c.deals + 2, 5));
}

function mockPayments(c: Company) {
  return [
    { ref: `PAY-${c.id.toUpperCase()}-001`, date: "2026-03-25", amount: c.annualRevenue * 0.03,   method_en: "Bank Transfer (SWIFT)", method_ar: "تحويل بنكي", method_fr: "Virement SWIFT", status: "cleared" as PayStatus  },
    { ref: `PAY-${c.id.toUpperCase()}-002`, date: "2026-04-20", amount: c.annualRevenue * 0.025,  method_en: "Bank Transfer (SWIFT)", method_ar: "تحويل بنكي", method_fr: "Virement SWIFT", status: "cleared" as PayStatus  },
    { ref: `PAY-${c.id.toUpperCase()}-003`, date: "2026-05-20", amount: c.annualRevenue * 0.04,   method_en: "Corporate Cheque", method_ar: "شيك شركة", method_fr: "Chèque d'entreprise", status: "pending" as PayStatus },
  ];
}

/* ─── Company detail view ─────────────────────────────────────── */
function CompanyDetail({ company, onBack, lang, onDealConfirmed }: { company: Company; onBack: () => void; lang: string; onDealConfirmed?: (deal: ConfirmedDeal) => void }) {
  const [tab, setTab]               = useState<TabKey>("deals");
  const [showWizard, setShowWizard] = useState(false);
  const [addedDeals, setAddedDeals] = useState<ConfirmedDeal[]>([]);
  const [invoices, setInvoices]     = useState(() => mockInvoices(company));
  const [walletBalance, setWalletBalance] = useState(() => initBalance(company));
  const [walletTxs, setWalletTxs]   = useState<WalletTx[]>(() => mockWalletTxs(company));
  const [buyAmt, setBuyAmt]         = useState("");
  const bp   = useBreakpoint();
  const isMob = bp === "mobile";

  const scfg  = STATUS_CFG[company.status];
  const secfg = SECTOR_CFG[company.sector];
  const deals    = mockDeals(company);
  const docs     = mockDocuments(company);
  const orders   = mockOrders(company);
  const payments = mockPayments(company);

  const lbl = (en: string, ar: string, fr: string) => lang === "ar" ? ar : lang === "fr" ? fr : en;

  function handleBuyPoints() {
    const pts = Math.floor(Number(buyAmt));
    if (!pts || pts <= 0) return;
    setWalletBalance(b => b + pts);
    setWalletTxs(txs => [...txs, { id: `W-${Date.now()}`, type: "purchase", amount: pts, aed: pts, desc: `Achat de ${pts.toLocaleString("en-AE")} points`, date: new Date().toISOString().slice(0, 10) }]);
    setBuyAmt("");
  }
  function handlePayWithPoints(invRef: string, amount: number) {
    const pts = Math.ceil(amount);
    setWalletBalance(b => b - pts);
    setInvoices(invs => invs.map(inv => inv.ref === invRef ? { ...inv, status: "paid" as const } : inv));
    setWalletTxs(txs => [...txs, { id: `W-${Date.now()}`, type: "payment", amount: pts, aed: pts, desc: `Paiement facture ${invRef}`, date: new Date().toISOString().slice(0, 10), ref: invRef }]);
  }

  const TABS: { key: TabKey; icon: React.ReactNode; en: string; ar: string; fr: string }[] = [
    { key: "deals",    icon: <IcDeal />,    en: "Deals",        ar: "الصفقات",   fr: "Deals"        },
    { key: "documents",icon: <IcDoc2 />,    en: "Documents",    ar: "الوثائق",   fr: "Documents"    },
    { key: "orders",   icon: <IcOrder />,   en: "Orders",       ar: "الطلبات",   fr: "Commandes"    },
    { key: "invoices", icon: <IcInvoice />, en: "Invoices",     ar: "الفواتير",  fr: "Factures"     },
    { key: "payments", icon: <IcPayment />, en: "Payments",     ar: "المدفوعات", fr: "Paiements"    },
    { key: "wallet",   icon: <IcWallet />,  en: "Wallet",       ar: "المحفظة",   fr: "Portefeuille" },
  ];

  const thStyle: React.CSSProperties = {
    padding: "9px 14px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600,
    letterSpacing: "0.07em", textTransform: "uppercase", textAlign: "start",
    borderBottom: "1px solid var(--line-soft)", background: "var(--bg-cream)",
  };
  const tdStyle: React.CSSProperties = { padding: "11px 14px", fontSize: 12.5, color: "var(--ink-2)" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      {/* Topbar with back */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: isMob ? "12px" : "14px 24px", background: "var(--bg-paper)", borderBottom: "1px solid var(--line-soft)", flexShrink: 0 }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "none", color: "var(--ink-3)", fontSize: 12, cursor: "pointer" }}>
          <IcBack />
          {lbl("Back", "رجوع", "Retour")}
        </button>
        <span style={{ fontSize: 11, color: "var(--ink-4)" }}>/</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{lang === "ar" ? company.name_ar : company.name}</span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "12px" : "24px 32px", background: "var(--bg-cream)" }}>

        {/* Company card */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: isMob ? "16px" : "24px 28px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 18, flexWrap: "wrap" }}>
            {/* Logo avatar */}
            <div style={{ width: 60, height: 60, borderRadius: "var(--r)", background: `${secfg.color}15`, display: "grid", placeItems: "center", color: secfg.color, fontWeight: 800, fontSize: 22, flexShrink: 0 }}>
              {company.name[0]}
            </div>

            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 4 }}>
                <div className="font-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)" }}>
                  {lang === "ar" ? company.name_ar : company.name}
                </div>
                <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: `${scfg.color}18`, color: scfg.color }}>{lang === "ar" ? scfg.ar : lang === "fr" ? scfg.fr : scfg.en}</span>
                <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: `${secfg.color}12`, color: secfg.color }}>
                  {lang === "ar" ? secfg.ar : lang === "fr" ? secfg.fr : secfg.en}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--ink-4)", marginBottom: 14 }}>{company.flag} {company.country}{company.tradeLicense ? ` · ${company.tradeLicense}` : ""}</div>

              {/* Contact action buttons */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14 }} onClick={e => e.stopPropagation()}>
                <ContactBtn href={`tel:${company.phone}`} bg="#6B7280"><IcPhoneSm /></ContactBtn>
                <ContactBtn href={`https://wa.me/${waNum(company.phone)}`} bg="#25D366"><IcWA /></ContactBtn>
                <ContactBtn href={`mailto:${company.email}`} bg="#64748b"><IcMailSm /></ContactBtn>
                <ContactBtn href={`sms:${company.phone}`} bg="#3B82F6"><IcSMS /></ContactBtn>
              </div>
              {/* Info grid */}
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(3, auto)", gap: isMob ? "8px" : "20px 40px", rowGap: 10 }}>
                {[
                  { icon: "👤", label: lbl("Contact", "جهة الاتصال", "Contact"), val: `${company.contact} · ${company.contactRole}` },
                  { icon: "📞", label: lbl("Phone", "الهاتف", "Téléphone"), val: company.phone, href: `tel:${company.phone}` },
                  { icon: "✉️", label: lbl("Email", "البريد", "E-mail"), val: company.email, href: `mailto:${company.email}` },
                  ...(company.website ? [{ icon: "🌐", label: lbl("Website", "الموقع", "Site web"), val: company.website, href: `https://${company.website}` }] : []),
                  ...(company.vatNo   ? [{ icon: "🏛", label: lbl("VAT No.", "الرقم الضريبي", "N° TVA"), val: company.vatNo }] : []),
                  { icon: "💰", label: lbl("Annual Revenue", "الإيرادات السنوية", "CA annuel"), val: aed(company.annualRevenue) },
                  { icon: "🤝", label: lbl("Agent", "الوكيل", "Agent"), val: company.agent },
                ].map(info => (
                  <div key={info.label}>
                    <div style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 2, textTransform: "uppercase", letterSpacing: "0.06em" }}>{info.label}</div>
                    {"href" in info && info.href
                      ? <a href={info.href} target={info.href.startsWith("http") ? "_blank" : undefined} rel={info.href.startsWith("http") ? "noopener noreferrer" : undefined} style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500, textDecoration: "none" }} onClick={e => e.stopPropagation()}>{info.val}</a>
                      : <div style={{ fontSize: 12.5, color: "var(--ink)", fontWeight: 500 }}>{info.val}</div>
                    }
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 16px", borderRadius: "var(--r)", fontSize: 12.5, fontWeight: tab === t.key ? 600 : 400,
                border: "none", cursor: "pointer",
                background: tab === t.key ? "var(--gold)" : "var(--bg-paper)",
                color: tab === t.key ? "#1A1610" : "var(--ink-3)",
                boxShadow: tab === t.key ? "none" : "inset 0 0 0 1px var(--line-soft)",
              }}>
              {t.icon}
              {lang === "ar" ? t.ar : lang === "fr" ? t.fr : t.en}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>

          {/* DEALS */}
          {tab === "deals" && (
            <>
              <div style={{ display: "flex", justifyContent: "flex-end", padding: "10px 16px", borderBottom: "1px solid var(--line-soft)" }}>
                <button onClick={() => setShowWizard(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: "var(--r)", background: "var(--gold)", border: "none", color: "#1A1610", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  <Ic s={13}><path d="M12 5v14M5 12h14"/></Ic>
                  {lbl("Add Deal", "إضافة صفقة", "Ajouter un deal")}
                </button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["ID", lbl("Property", "العقار", "Propriété"), lbl("Type", "النوع", "Type"), lbl("Amount", "المبلغ", "Montant"), lbl("Date", "التاريخ", "Date"), lbl("Status", "الحالة", "Statut")].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {/* User-added deals */}
                  {addedDeals.slice().reverse().map(d => (
                    <tr key={d.crmRef} style={{ borderBottom: "1px solid var(--line-soft)", background: "rgba(200,160,60,0.04)" }}>
                      <td style={{ ...tdStyle, fontFamily: "monospace", color: "var(--azure)", fontSize: 11 }}>{d.crmRef}</td>
                      <td style={{ ...tdStyle, fontWeight: 500, color: "var(--ink)" }}>{[d.propType, d.area].filter(Boolean).join(" — ") || "—"}</td>
                      <td style={tdStyle}><span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "rgba(200,160,60,0.12)", color: "var(--gold-deep)", border: "1px solid rgba(200,160,60,0.3)", fontWeight: 600 }}>{d.category.toUpperCase()}</span></td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "var(--ink)" }} className="tnum">{d.budgetMax > 0 ? aed(d.budgetMax) : d.budgetMin > 0 ? aed(d.budgetMin) : "—"}</td>
                      <td style={{ ...tdStyle, color: "var(--ink-4)" }}>{d.date}</td>
                      <td style={tdStyle}><span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "rgba(59,130,246,0.1)", color: "var(--azure)" }}>NEW</span></td>
                    </tr>
                  ))}
                  {/* Mock deals */}
                  {deals.map((d, i) => {
                    const dscfg = DEAL_STATUS[d.status];
                    return (
                      <tr key={i} style={{ borderTop: "1px solid var(--line-soft)" }}>
                        <td style={{ ...tdStyle, fontFamily: "monospace", color: "var(--ink-4)", fontSize: 11 }}>—</td>
                        <td style={{ ...tdStyle, fontWeight: 500, color: "var(--ink)" }}>{d.prop}</td>
                        <td style={tdStyle}>{lbl(d.type_en, d.type_ar, d.type_fr)}</td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "var(--ink)" }} className="tnum">{aed(d.amount)}</td>
                        <td style={{ ...tdStyle, color: "var(--ink-4)" }}>{fmt(d.date)}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${dscfg.color}15`, color: dscfg.color }}>
                            {lbl(dscfg.en, dscfg.ar, dscfg.fr)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </>
          )}

          {/* DOCUMENTS */}
          {tab === "documents" && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[lbl("Document", "الوثيقة", "Document"), lbl("Reference", "المرجع", "Référence"), lbl("Date", "التاريخ", "Date"), lbl("Expiry", "الانتهاء", "Expiration"), lbl("Status", "الحالة", "Statut")].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {docs.map((d, i) => {
                  const dscfg = DOC_STATUS[d.status];
                  return (
                    <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--line-soft)" : "none" }}>
                      <td style={{ ...tdStyle, fontWeight: 500, color: "var(--ink)" }}>{lbl(d.name_en, d.name_ar, d.name_fr)}</td>
                      <td style={{ ...tdStyle, color: "var(--ink-4)" }} className="tnum">{d.ref}</td>
                      <td style={{ ...tdStyle, color: "var(--ink-4)" }}>{fmt(d.date)}</td>
                      <td style={{ ...tdStyle, color: d.exp ? "var(--ink-4)" : "var(--ink-4)" }}>{d.exp ? fmt(d.exp) : "—"}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${dscfg.color}15`, color: dscfg.color }}>
                          {lbl(dscfg.en, dscfg.ar, dscfg.fr)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* ORDERS */}
          {tab === "orders" && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["N°", lbl("Type", "النوع", "Type"), lbl("Description", "الوصف", "Description"), lbl("Amount", "المبلغ", "Montant"), lbl("Status", "الحالة", "Statut"), lbl("Date", "التاريخ", "Date")].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => {
                  const ostat = ORD_STATUS[o.status as keyof typeof ORD_STATUS] ?? ORD_STATUS.pending;
                  return (
                    <tr key={o.id} style={{ borderTop: i > 0 ? "1px solid var(--line-soft)" : "none" }}>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 11, color: "var(--ink-4)" }}>{o.id}</td>
                      <td style={tdStyle}><span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "var(--bg-cream)", color: "var(--ink-4)", border: "1px solid var(--line-soft)" }}>{lbl(o.type_en, o.type_ar, o.type_fr)}</span></td>
                      <td style={{ ...tdStyle, fontWeight: 500, color: "var(--ink)" }}>{lbl(o.desc_en, o.desc_ar, o.desc_fr)}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "var(--ink)" }} className="tnum">{o.amount > 0 ? aed(o.amount) : "—"}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${ostat.color}15`, color: ostat.color }}>
                          {lbl(ostat.en, ostat.ar, ostat.fr)}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, color: "var(--ink-4)" }}>{fmt(o.date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* INVOICES */}
          {tab === "invoices" && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[lbl("Invoice", "الفاتورة", "Facture"), lbl("Description", "الوصف", "Description"), lbl("Date", "التاريخ", "Date"), lbl("Due date", "تاريخ الاستحقاق", "Échéance"), lbl("Amount", "المبلغ", "Montant"), lbl("Status", "الحالة", "Statut")].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, i) => {
                  const iscfg = INV_STATUS[inv.status];
                  return (
                    <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--line-soft)" : "none" }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "var(--azure)" }} className="tnum">{inv.ref}</td>
                      <td style={tdStyle}>{lbl(inv.desc_en, inv.desc_ar, inv.desc_fr)}</td>
                      <td style={{ ...tdStyle, color: "var(--ink-4)" }}>{fmt(inv.date)}</td>
                      <td style={{ ...tdStyle, color: "var(--ink-4)" }}>{fmt(inv.due)}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "var(--ink)" }} className="tnum">{aed(inv.amount)}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${iscfg.color}15`, color: iscfg.color }}>
                          {lbl(iscfg.en, iscfg.ar, iscfg.fr)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* PAYMENTS */}
          {tab === "payments" && (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[lbl("Reference", "المرجع", "Référence"), lbl("Date", "التاريخ", "Date"), lbl("Amount", "المبلغ", "Montant"), lbl("Method", "الطريقة", "Méthode"), lbl("Status", "الحالة", "Statut")].map(h => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p, i) => {
                  const pscfg = PAY_STATUS[p.status];
                  return (
                    <tr key={i} style={{ borderTop: i > 0 ? "1px solid var(--line-soft)" : "none" }}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "var(--azure)" }} className="tnum">{p.ref}</td>
                      <td style={{ ...tdStyle, color: "var(--ink-4)" }}>{fmt(p.date)}</td>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "var(--ink)" }} className="tnum">{aed(p.amount)}</td>
                      <td style={tdStyle}>{lbl(p.method_en, p.method_ar, p.method_fr)}</td>
                      <td style={tdStyle}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${pscfg.color}15`, color: pscfg.color }}>
                          {lbl(pscfg.en, pscfg.ar, pscfg.fr)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* WALLET */}
          {tab === "wallet" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "4px 0" }}>

              {/* Balance card */}
              <div style={{ background: "linear-gradient(135deg, #1A1610 0%, #3D2E0A 60%, #C9A84C 100%)", borderRadius: "var(--r)", padding: "24px 28px", color: "#F5E9C8", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", insetInlineEnd: -20, top: -20, width: 120, height: 120, borderRadius: "50%", background: "rgba(201,168,76,0.15)" }} />
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.6, marginBottom: 10 }}>
                  {lbl("Points Balance", "رصيد النقاط", "Solde de points")}
                </div>
                <div className="tnum" style={{ fontSize: 42, fontWeight: 800, lineHeight: 1, color: "#F5E9C8" }}>
                  {walletBalance.toLocaleString("en-AE")}
                  <span style={{ fontSize: 18, fontWeight: 500, marginInlineStart: 8, opacity: 0.7 }}>pts</span>
                </div>
                <div style={{ marginTop: 10, fontSize: 13, opacity: 0.75 }}>
                  ≡ AED {walletBalance.toLocaleString("en-AE")} &nbsp;·&nbsp; 1 point = 1 AED
                </div>
              </div>

              {/* Buy points */}
              <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 22px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                  {lbl("Buy points", "شراء نقاط", "Acheter des points")}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {[1000, 5000, 10000, 50000].map(amt => (
                    <button key={amt} onClick={() => setBuyAmt(String(amt))}
                      style={{ padding: "7px 16px", borderRadius: "var(--r)", cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all .12s",
                        border: `1.5px solid ${buyAmt === String(amt) ? "var(--gold)" : "var(--line-soft)"}`,
                        background: buyAmt === String(amt) ? "var(--gold-ghost)" : "var(--bg-cream)",
                        color: buyAmt === String(amt) ? "var(--gold-deep)" : "var(--ink-2)" }}>
                      {amt.toLocaleString("en-AE")} AED
                    </button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <input type="number" value={buyAmt} onChange={e => setBuyAmt(e.target.value)}
                    placeholder={lbl("Custom amount (AED)…", "مبلغ مخصص (AED)…", "Montant personnalisé (AED)…")}
                    style={{ flex: 1, height: 36, padding: "0 12px", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", fontSize: 13, background: "var(--bg-ivory)", color: "var(--ink)", outline: "none" }} />
                  <button onClick={handleBuyPoints} disabled={!buyAmt || Number(buyAmt) <= 0}
                    style={{ padding: "0 20px", height: 36, background: "var(--gold)", border: "none", borderRadius: "var(--r)", color: "#1A1610", fontWeight: 700, fontSize: 13, cursor: !buyAmt || Number(buyAmt) <= 0 ? "not-allowed" : "pointer", opacity: !buyAmt || Number(buyAmt) <= 0 ? 0.5 : 1, whiteSpace: "nowrap" }}>
                    {lbl("Buy →", "شراء", "Acheter →")}
                  </button>
                </div>
              </div>

              {/* Pay pending invoices */}
              {invoices.some(inv => inv.status === "pending") && (
                <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 22px" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                    {lbl("Pay invoice with points", "دفع الفواتير بالنقاط", "Payer une facture avec les points")}
                  </div>
                  {invoices.filter(inv => inv.status === "pending").map((inv, i, arr) => {
                    const canPay = walletBalance >= inv.amount;
                    return (
                      <div key={inv.ref} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 0", borderBottom: i < arr.length - 1 ? "1px solid var(--line-soft)" : "none", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{lbl(inv.desc_en, inv.desc_ar, inv.desc_fr)}</div>
                          <div className="tnum" style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 2 }}>
                            {inv.ref} · AED {inv.amount.toLocaleString("en-AE")} · {inv.amount.toLocaleString("en-AE")} pts requis
                          </div>
                        </div>
                        <button onClick={() => handlePayWithPoints(inv.ref, inv.amount)} disabled={!canPay}
                          style={{ flexShrink: 0, padding: "7px 14px", border: "none", borderRadius: "var(--r)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
                            background: canPay ? "var(--emerald)" : "var(--bg-cream)",
                            color: canPay ? "#fff" : "var(--ink-4)",
                            cursor: canPay ? "pointer" : "not-allowed", opacity: canPay ? 1 : 0.55 }}>
                          {canPay ? lbl("Pay with points", "دفع بالنقاط", "Payer avec points") : lbl("Insufficient balance", "رصيد غير كافٍ", "Solde insuffisant")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Transaction history */}
              <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "18px 22px" }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 14 }}>
                  {lbl("Transaction history", "سجل المعاملات", "Historique des transactions")}
                </div>
                {walletTxs.length === 0
                  ? <div style={{ fontSize: 13, color: "var(--ink-4)", textAlign: "center", padding: "16px 0" }}>—</div>
                  : [...walletTxs].reverse().map((tx, i) => (
                    <div key={tx.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: i < walletTxs.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", display: "grid", placeItems: "center", flexShrink: 0, fontSize: 15, fontWeight: 700,
                        background: tx.type === "purchase" ? "rgba(16,185,129,0.12)" : "rgba(239,68,68,0.1)",
                        color: tx.type === "purchase" ? "var(--emerald)" : "var(--rose)" }}>
                        {tx.type === "purchase" ? "+" : "−"}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, color: "var(--ink)", fontWeight: 500 }}>{tx.desc}</div>
                        <div className="tnum" style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 1 }}>{tx.date}{tx.ref ? ` · ${tx.ref}` : ""}</div>
                      </div>
                      <div style={{ textAlign: "end", flexShrink: 0 }}>
                        <div className="tnum" style={{ fontSize: 13, fontWeight: 700, color: tx.type === "purchase" ? "var(--emerald)" : "var(--rose)" }}>
                          {tx.type === "purchase" ? "+" : "−"}{tx.amount.toLocaleString("en-AE")} pts
                        </div>
                        <div className="tnum" style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>AED {tx.aed.toLocaleString("en-AE")}</div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deal Wizard */}
      {showWizard && (
        <DealWizard
          clientName={lang === "ar" ? company.name_ar : company.name}
          clientId={company.id}
          clientAgent={company.agent}
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

/* ─── Main screen ─────────────────────────────────────────────── */
export function ScreenClientsSociete({ onDealConfirmed }: { onDealConfirmed?: (deal: ConfirmedDeal) => void } = {}) {
  const { lang } = useLang();
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const [search,     setSearch]     = useState("");
  const [status,     setStatus]     = useState<Status | "all">("all");
  const [sector,     setSector]     = useState<Sector | "all">("all");
  const [agent,      setAgent]      = useState("All agents");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = COMPANIES.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q) || c.email.includes(q);
    const matchStatus = status === "all" || c.status === status;
    const matchSector = sector === "all" || c.sector === sector;
    const matchAgent  = agent === "All agents" || c.agent === agent;
    return matchSearch && matchStatus && matchSector && matchAgent;
  });

  const selected = selectedId ? COMPANIES.find(c => c.id === selectedId) : null;
  if (selected) return <CompanyDetail company={selected} onBack={() => setSelectedId(null)} lang={lang} onDealConfirmed={onDealConfirmed} />;

  const title = lang === "ar" ? t.nav_societe : lang === "fr" ? "Sociétés" : "Companies";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title} crumb={[lang === "ar" ? t.nav_clients : "Clients"]}>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--r)", background: "var(--gold)", color: "#1A1610", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          <IcPlus2 />
          {lang === "ar" ? "شركة جديدة" : lang === "fr" ? "Nouvelle société" : "New Company"}
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

          {/* Status pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all", "vip", "active", "prospect", "inactive"] as const).map(s => {
              const cfg = s === "all" ? null : STATUS_CFG[s];
              const active = status === s;
              return (
                <button key={s} onClick={() => setStatus(s)}
                  style={{
                    padding: "6px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: active ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap",
                    background: active ? (cfg ? `${cfg.color}18` : "var(--gold)") : "transparent",
                    color: active ? (cfg ? cfg.color : "#1A1610") : "var(--ink-4)",
                    border: active ? (cfg ? `1px solid ${cfg.color}` : "1px solid var(--gold)") : "1px solid var(--line-soft)",
                  }}
                >
                  {s === "all" ? (lang === "ar" ? "الكل" : lang === "fr" ? "Tous" : "All") : (lang === "ar" ? cfg!.ar : lang === "fr" ? cfg!.fr : cfg!.en)}
                </button>
              );
            })}
          </div>

          <select value={sector} onChange={e => setSector(e.target.value as Sector | "all")}
            style={{ padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}>
            <option value="all">{lang === "ar" ? "كل القطاعات" : lang === "fr" ? "Tous secteurs" : "All sectors"}</option>
            {(Object.keys(SECTOR_CFG) as Sector[]).map(s => (
              <option key={s} value={s}>{lang === "ar" ? SECTOR_CFG[s].ar : lang === "fr" ? SECTOR_CFG[s].fr : SECTOR_CFG[s].en}</option>
            ))}
          </select>

          <select value={agent} onChange={e => setAgent(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}>
            {AGENTS.map(a => <option key={a}>{a}</option>)}
          </select>

          <div style={{ marginInlineStart: "auto", fontSize: 11.5, color: "var(--ink-4)" }}>
            {filtered.length} {lang === "ar" ? "شركة" : lang === "fr" ? "société(s)" : "company(-ies)"}
          </div>
        </div>

        {/* Cards grid / table */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "12px" : "20px 24px" }}>
          {isMob ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(c => {
                const scfg  = STATUS_CFG[c.status];
                const secfg = SECTOR_CFG[c.sector];
                return (
                  <div key={c.id} onClick={() => setSelectedId(c.id)} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "14px 16px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "var(--r-sm)", background: `${secfg.color}15`, display: "grid", placeItems: "center", color: secfg.color, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                        {c.name[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{lang === "ar" ? c.name_ar : c.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{c.flag} {c.country}</div>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${scfg.color}18`, color: scfg.color }}>{lang === "ar" ? scfg.ar : lang === "fr" ? scfg.fr : scfg.en}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 6 }}>{c.contact} · {aed(c.annualRevenue)}</div>
                    <LangPills langs={c.languages} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-cream)" }}>
                    {[
                      lang === "ar" ? "الشركة" : lang === "fr" ? "Société" : "Company",
                      lang === "ar" ? "القطاع" : lang === "fr" ? "Secteur" : "Sector",
                      lang === "ar" ? "جهة الاتصال" : lang === "fr" ? "Contact" : "Contact",
                      lang === "ar" ? "الإيرادات" : lang === "fr" ? "Chiffre d'affaires" : "Revenue",
                      lang === "ar" ? "الصفقات" : lang === "fr" ? "Deals" : "Deals",
                      lang === "ar" ? "الوكيل" : lang === "fr" ? "Agent" : "Agent",
                      lang === "ar" ? "اللغات" : lang === "fr" ? "Langues" : "Languages",
                      lang === "ar" ? "الحالة" : lang === "fr" ? "Statut" : "Status",
                    ].map(h => (
                      <th key={h} style={{ padding: "10px 16px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const scfg  = STATUS_CFG[c.status];
                    const secfg = SECTOR_CFG[c.sector];
                    return (
                      <tr key={c.id}
                        onClick={() => setSelectedId(c.id)}
                        style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--line-soft)" : "none", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-cream)"}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                      >
                        <td style={{ padding: "13px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: `${secfg.color}15`, display: "grid", placeItems: "center", color: secfg.color, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                              {c.name[0]}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{lang === "ar" ? c.name_ar : c.name}</div>
                              <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{c.flag} {c.country}{c.vatNo ? ` · TVA ${c.vatNo}` : ""}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: `${secfg.color}12`, color: secfg.color }}>
                            {lang === "ar" ? secfg.ar : lang === "fr" ? secfg.fr : secfg.en}
                          </span>
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)", marginBottom: 3 }}>{c.contact}</div>
                          <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{c.contactRole}</div>
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{aed(c.annualRevenue)}</div>
                        </td>
                        <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--ink-2)" }} className="tnum">{c.deals}</td>
                        <td style={{ padding: "13px 16px", fontSize: 12.5, color: "var(--ink-3)" }}>{c.agent}</td>
                        <td style={{ padding: "13px 16px" }}><LangPills langs={c.languages} /></td>
                        <td style={{ padding: "13px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: `${scfg.color}18`, color: scfg.color }}>
                            {lang === "ar" ? scfg.ar : lang === "fr" ? scfg.fr : scfg.en}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                  {lang === "ar" ? "لا توجد نتائج" : lang === "fr" ? "Aucun résultat" : "No results"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
