"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Ic } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";

/* ─── Category icons — Firms ────────────────────────────────────────── */
const IcStrategy = () => <Ic><path d="M2 20h20M6 20V10l6-8 6 8v10"/><path d="M12 20v-6"/></Ic>;
const IcLegal    = () => <Ic><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></Ic>;
const IcRealty   = () => <Ic><path d="M3 21V10l9-7 9 7v11"/><circle cx="12" cy="13" r="2"/><path d="M12 15v6"/></Ic>;
const IcFinAdv   = () => <Ic><path d="M3 3v18h18"/><path d="m7 14 4-4 3 3 6-7"/></Ic>;
const IcTax      = () => <Ic><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2M12 12v5M9.5 12H15"/></Ic>;
const IcTech     = () => <Ic><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></Ic>;

/* ─── Specialist icons ──────────────────────────────────────────────── */
const IcMedecin   = () => <Ic><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Ic>;
const IcLabo      = () => <Ic><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v11l-5 5h16l-5-5V3"/></Ic>;
const IcNutri     = () => <Ic><path d="M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z"/></Ic>;
const IcPsy       = () => <Ic><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44l-2.5-10a2.5 2.5 0 0 1 2.46-3.06H9.5z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5"/><path d="M9.5 2h5M12 12h.01"/></Ic>;
const IcAvocat    = () => <Ic><path d="m14.5 2-8.5 20M9.5 2l8.5 20M4 15h16M4 9h16"/></Ic>;
const IcNotaire   = () => <Ic><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13l2 2 4-4"/></Ic>;
const IcFinance   = () => <Ic><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></Ic>;
const IcCompta    = () => <Ic><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h.01M11 15h2"/></Ic>;
const IcAssurance = () => <Ic><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Ic>;
const IcIT        = () => <Ic><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></Ic>;
const IcCyber     = () => <Ic><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></Ic>;
const IcMarketing = () => <Ic><path d="m3 11 19-9-9 19-2-8-8-2z"/></Ic>;
const IcDev       = () => <Ic><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></Ic>;
const IcSport     = () => <Ic><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></Ic>;
const IcVoyage    = () => <Ic><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 2c-2-2-4-2-5.5-.5L10 5 1.8 6.2c-.5.1-.9.5-.9 1.1l.3 1.3C1.6 9.3 2.2 10 3 10l1.7.7 5.5-1.1 6-6 5 5-7 6.5 1 5.3c.2.8 1 1.3 1.8 1.2l1.2-.3c.6-.1 1-.5 1.1-1z"/></Ic>;
const IcEduc      = () => <Ic><path d="m4 6 8-4 8 4-8 4-8-4z"/><path d="m4 10 8 4 8-4M4 14l8 4 8-4"/></Ic>;
const IcCoach     = () => <Ic><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></Ic>;
const IcImmig     = () => <Ic><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Ic>;
const IcArchi     = () => <Ic><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></Ic>;
const IcRH        = () => <Ic><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ic>;
const IcDouane      = () => <Ic><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></Ic>;
const IcTraducteur  = () => <Ic><path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></Ic>;

/* ─── Types ──────────────────────────────────────────────────────────── */
type ViewMode = "specialists" | "firms";

type SpecKey =
  | "medecin" | "specialiste" | "labo" | "nutri" | "psy"
  | "avocat" | "notaire" | "finance" | "compta" | "assurance"
  | "it" | "cyber" | "marketing" | "dev"
  | "sport" | "voyage" | "educ" | "coach"
  | "immigration" | "archi" | "rh" | "douane" | "traducteur";

interface Specialist {
  key: SpecKey;
  icon: React.ReactElement;
  color: string;
  demand: "high" | "medium";
  name_en: string; name_ar: string; name_fr: string;
  desc_en: string; desc_ar: string; desc_fr: string;
  tags_en: string[]; tags_ar: string[]; tags_fr: string[];
  group: "sante" | "juridique" | "tech" | "lifestyle" | "business";
}

/* ─── Specialist groups ─────────────────────────────────────────────── */
const SPEC_GROUPS: { key: Specialist["group"]; en: string; ar: string; fr: string; color: string }[] = [
  { key: "sante",     en: "Health & Medical",      ar: "الصحة والطب",           fr: "Santé & Médical",       color: "#4F6B4E" },
  { key: "juridique", en: "Legal & Finance",        ar: "القانون والمالية",       fr: "Juridique & Finance",   color: "#4A6B82" },
  { key: "tech",      en: "Tech & Digital",         ar: "التكنولوجيا والرقمي",    fr: "Tech & Digital",        color: "#6D4F9E" },
  { key: "lifestyle", en: "Lifestyle & Services",   ar: "أسلوب الحياة والخدمات", fr: "Lifestyle & Services",  color: "#B8924F" },
  { key: "business",  en: "Business & HR",          ar: "الأعمال والموارد البشرية",fr: "Business & RH",         color: "#8E4F4F" },
];

/* ─── Specialists data ──────────────────────────────────────────────── */
const SPECIALISTS: Specialist[] = [
  /* ── Santé ── */
  {
    key: "medecin", icon: <IcMedecin />, color: "#4F6B4E", demand: "high", group: "sante",
    name_en: "General Practitioner",    name_ar: "طبيب عام",                 name_fr: "Médecin Généraliste",
    desc_en: "Primary healthcare, check-ups, prescriptions, referrals to specialists.",
    desc_ar: "الرعاية الصحية الأساسية، الفحوصات، الوصفات الطبية، الإحالة إلى المتخصصين.",
    desc_fr: "Soins primaires, bilans de santé, ordonnances, orientation vers spécialistes.",
    tags_en: ["Doctor", "Health check", "Consultation", "Prescription"],
    tags_ar: ["طبيب", "فحص صحي", "استشارة", "وصفة طبية"],
    tags_fr: ["Médecin", "Bilan santé", "Consultation", "Ordonnance"],
  },
  {
    key: "specialiste", icon: <IcMedecin />, color: "#4F6B4E", demand: "high", group: "sante",
    name_en: "Medical Specialist",   name_ar: "طبيب متخصص",              name_fr: "Médecin Spécialiste",
    desc_en: "Cardiologist, dermatologist, ophthalmologist, orthopedist, neurologist and more.",
    desc_ar: "طبيب قلب، جلدية، عيون، عظام، أعصاب والمزيد من التخصصات.",
    desc_fr: "Cardiologue, dermatologue, ophtalmologiste, orthopédiste, neurologue et plus.",
    tags_en: ["Cardiology", "Dermatology", "Ophthalmology", "Specialist"],
    tags_ar: ["قلب", "جلدية", "عيون", "تخصص طبي"],
    tags_fr: ["Cardiologie", "Dermatologie", "Ophtalmologie", "Spécialiste"],
  },
  {
    key: "labo", icon: <IcLabo />, color: "#4F6B4E", demand: "high", group: "sante",
    name_en: "Medical Laboratory",   name_ar: "مختبر طبي",               name_fr: "Laboratoire d'Analyses",
    desc_en: "Blood tests, PCR, allergy panels, hormonal assessments, full health panels.",
    desc_ar: "تحاليل الدم، PCR، فحوصات الحساسية، تقييم الهرمونات، الفحوصات الصحية الشاملة.",
    desc_fr: "Analyses sanguines, PCR, bilans allergies, hormonaux, bilan complet de santé.",
    tags_en: ["Blood test", "PCR", "Analysis", "Lab results"],
    tags_ar: ["تحليل دم", "PCR", "نتائج مختبر"],
    tags_fr: ["Prise de sang", "PCR", "Analyse", "Résultats labo"],
  },
  {
    key: "nutri", icon: <IcNutri />, color: "#4F6B4E", demand: "medium", group: "sante",
    name_en: "Nutritionist & Dietitian", name_ar: "أخصائي التغذية",        name_fr: "Nutritionniste & Diététicien",
    desc_en: "Personalized diet plans, weight management, sports nutrition, diabetes nutrition.",
    desc_ar: "خطط غذائية مخصصة، إدارة الوزن، تغذية رياضية، تغذية مرضى السكري.",
    desc_fr: "Plans alimentaires personnalisés, gestion du poids, nutrition sportive, diabète.",
    tags_en: ["Diet", "Weight loss", "Nutrition plan", "Healthy eating"],
    tags_ar: ["حمية غذائية", "إنقاص الوزن", "خطة التغذية"],
    tags_fr: ["Régime", "Perte de poids", "Plan nutritionnel", "Alimentation saine"],
  },
  {
    key: "psy", icon: <IcPsy />, color: "#4F6B4E", demand: "medium", group: "sante",
    name_en: "Psychologist & Therapist", name_ar: "طبيب نفسي ومعالج",      name_fr: "Psychologue & Thérapeute",
    desc_en: "Mental health counseling, anxiety, depression, stress management, couples therapy.",
    desc_ar: "استشارات الصحة النفسية، القلق، الاكتئاب، إدارة التوتر، علاج الأزواج.",
    desc_fr: "Santé mentale, anxiété, dépression, gestion du stress, thérapie de couple.",
    tags_en: ["Therapy", "Mental health", "Anxiety", "Counseling"],
    tags_ar: ["علاج نفسي", "صحة نفسية", "قلق", "استشارة"],
    tags_fr: ["Thérapie", "Santé mentale", "Anxiété", "Counseling"],
  },

  /* ── Juridique & Finance ── */
  {
    key: "avocat", icon: <IcAvocat />, color: "#4A6B82", demand: "high", group: "juridique",
    name_en: "Lawyer & Legal Consultant", name_ar: "محامي ومستشار قانوني",  name_fr: "Avocat & Consultant Juridique",
    desc_en: "Real estate law, corporate, contracts, litigation, family law, criminal defense.",
    desc_ar: "قانون العقارات، الشركات، العقود، التقاضي، قانون الأسرة، الدفاع الجنائي.",
    desc_fr: "Droit immobilier, sociétés, contrats, litiges, droit de la famille, pénal.",
    tags_en: ["Contract", "Litigation", "Legal advice", "Real estate law"],
    tags_ar: ["عقد", "تقاضٍ", "استشارة قانونية", "قانون عقارات"],
    tags_fr: ["Contrat", "Contentieux", "Conseil juridique", "Droit immobilier"],
  },
  {
    key: "notaire", icon: <IcNotaire />, color: "#4A6B82", demand: "high", group: "juridique",
    name_en: "Notary & Document Attestation", name_ar: "كاتب العدل وتصديق الوثائق", name_fr: "Notaire & Attestation",
    desc_en: "Property transfers, powers of attorney, document legalization, inheritance notarization.",
    desc_ar: "نقل الملكية، التوكيلات، توثيق الوثائق، توثيق الميراث.",
    desc_fr: "Transferts immobiliers, procurations, légalisation de documents, successions.",
    tags_en: ["Notarization", "Power of attorney", "Property transfer", "Document"],
    tags_ar: ["توثيق", "توكيل", "نقل ملكية", "وثيقة"],
    tags_fr: ["Notarisation", "Procuration", "Transfert de propriété", "Document"],
  },
  {
    key: "finance", icon: <IcFinance />, color: "#4A6B82", demand: "high", group: "juridique",
    name_en: "Financial Advisor",    name_ar: "مستشار مالي",              name_fr: "Conseiller Financier",
    desc_en: "Wealth management, investment portfolios, retirement planning, savings strategies.",
    desc_ar: "إدارة الثروات، محافظ الاستثمار، التخطيط للتقاعد، استراتيجيات الادخار.",
    desc_fr: "Gestion de patrimoine, portefeuilles d'investissement, retraite, épargne.",
    tags_en: ["Investment", "Wealth management", "Portfolio", "Financial planning"],
    tags_ar: ["استثمار", "إدارة ثروات", "محفظة مالية", "تخطيط مالي"],
    tags_fr: ["Investissement", "Patrimoine", "Portefeuille", "Planification financière"],
  },
  {
    key: "compta", icon: <IcCompta />, color: "#4A6B82", demand: "high", group: "juridique",
    name_en: "Accountant & Tax Expert",  name_ar: "محاسب وخبير ضريبي",      name_fr: "Expert-Comptable & Fiscal",
    desc_en: "Bookkeeping, UAE VAT, corporate tax, financial statements, audit preparation.",
    desc_ar: "المحاسبة، ضريبة القيمة المضافة الإماراتية، ضريبة الشركات، البيانات المالية.",
    desc_fr: "Comptabilité, TVA EAU, impôt société, états financiers, préparation audit.",
    tags_en: ["Accounting", "VAT", "Tax return", "Bookkeeping"],
    tags_ar: ["محاسبة", "ضريبة القيمة المضافة", "إقرار ضريبي"],
    tags_fr: ["Comptabilité", "TVA", "Déclaration fiscale", "Tenue de livres"],
  },
  {
    key: "assurance", icon: <IcAssurance />, color: "#4A6B82", demand: "medium", group: "juridique",
    name_en: "Insurance Broker",     name_ar: "وسيط تأمين",              name_fr: "Courtier en Assurance",
    desc_en: "Health, life, property, vehicle, business insurance — comparison & subscription.",
    desc_ar: "تأمين صحي، حياة، ممتلكات، مركبات، أعمال — مقارنة واشتراك.",
    desc_fr: "Assurance santé, vie, habitation, auto, entreprise — comparaison & souscription.",
    tags_en: ["Health insurance", "Life insurance", "Property insurance", "Car insurance"],
    tags_ar: ["تأمين صحي", "تأمين حياة", "تأمين ممتلكات", "تأمين سيارة"],
    tags_fr: ["Assurance santé", "Assurance vie", "Assurance habitation", "Auto"],
  },

  /* ── Tech & Digital ── */
  {
    key: "it", icon: <IcIT />, color: "#6D4F9E", demand: "high", group: "tech",
    name_en: "IT Consultant",        name_ar: "مستشار تقنية المعلومات",   name_fr: "Consultant Informatique",
    desc_en: "Systems setup, network infrastructure, ERP/CRM implementation, IT support.",
    desc_ar: "إعداد الأنظمة، البنية التحتية للشبكات، تطبيق ERP/CRM، الدعم التقني.",
    desc_fr: "Configuration systèmes, infrastructure réseau, implémentation ERP/CRM, support IT.",
    tags_en: ["IT support", "Network", "ERP", "Computer setup"],
    tags_ar: ["دعم تقني", "شبكة", "ERP", "إعداد الحاسوب"],
    tags_fr: ["Support IT", "Réseau", "ERP", "Configuration informatique"],
  },
  {
    key: "cyber", icon: <IcCyber />, color: "#6D4F9E", demand: "high", group: "tech",
    name_en: "Cybersecurity Specialist", name_ar: "متخصص الأمن السيبراني", name_fr: "Expert Cybersécurité",
    desc_en: "Security audits, penetration testing, data protection, GDPR/NCA compliance.",
    desc_ar: "تدقيق الأمن، اختبار الاختراق، حماية البيانات، الامتثال GDPR/NCA.",
    desc_fr: "Audits sécurité, tests d'intrusion, protection données, conformité RGPD.",
    tags_en: ["Security audit", "Data protection", "Penetration test", "Compliance"],
    tags_ar: ["تدقيق أمني", "حماية البيانات", "اختبار اختراق"],
    tags_fr: ["Audit sécurité", "Protection données", "Test d'intrusion", "Conformité"],
  },
  {
    key: "marketing", icon: <IcMarketing />, color: "#6D4F9E", demand: "high", group: "tech",
    name_en: "Digital Marketing Specialist", name_ar: "متخصص التسويق الرقمي", name_fr: "Expert Marketing Digital",
    desc_en: "SEO, Google Ads, social media, email campaigns, brand strategy, analytics.",
    desc_ar: "SEO، إعلانات جوجل، وسائل التواصل الاجتماعي، حملات البريد الإلكتروني.",
    desc_fr: "SEO, Google Ads, réseaux sociaux, email marketing, stratégie de marque.",
    tags_en: ["SEO", "Social media", "Google Ads", "Branding"],
    tags_ar: ["SEO", "وسائل التواصل", "إعلانات جوجل", "العلامة التجارية"],
    tags_fr: ["SEO", "Réseaux sociaux", "Google Ads", "Branding"],
  },
  {
    key: "dev", icon: <IcDev />, color: "#6D4F9E", demand: "high", group: "tech",
    name_en: "Web & App Developer",  name_ar: "مطور ويب وتطبيقات",        name_fr: "Développeur Web & App",
    desc_en: "Custom websites, mobile apps, e-commerce platforms, API integrations.",
    desc_ar: "مواقع مخصصة، تطبيقات الهاتف المحمول، منصات التجارة الإلكترونية، تكاملات API.",
    desc_fr: "Sites web sur mesure, apps mobiles, e-commerce, intégrations API.",
    tags_en: ["Website", "Mobile app", "E-commerce", "API"],
    tags_ar: ["موقع ويب", "تطبيق جوال", "تجارة إلكترونية", "API"],
    tags_fr: ["Site web", "Application mobile", "E-commerce", "API"],
  },

  /* ── Lifestyle & Services ── */
  {
    key: "sport", icon: <IcSport />, color: "#B8924F", demand: "high", group: "lifestyle",
    name_en: "Sports Coach & Personal Trainer", name_ar: "مدرب رياضي وشخصي", name_fr: "Coach Sportif & Personal Trainer",
    desc_en: "Fitness programs, weight training, cardio, yoga, sports performance coaching.",
    desc_ar: "برامج اللياقة البدنية، تدريب الأثقال، كارديو، يوغا، تدريب الأداء الرياضي.",
    desc_fr: "Programmes fitness, musculation, cardio, yoga, coaching performance sportive.",
    tags_en: ["Personal trainer", "Fitness", "Yoga", "Gym coaching"],
    tags_ar: ["مدرب شخصي", "لياقة بدنية", "يوغا", "تدريب جيم"],
    tags_fr: ["Personal trainer", "Fitness", "Yoga", "Coaching sportif"],
  },
  {
    key: "voyage", icon: <IcVoyage />, color: "#B8924F", demand: "high", group: "lifestyle",
    name_en: "Travel & Tourism Consultant",  name_ar: "مستشار السياحة والسفر",  name_fr: "Consultant Voyage & Tourisme",
    desc_en: "Holiday packages, corporate travel, visa assistance, luxury tours, honeymoon.",
    desc_ar: "باقات العطلات، سفر الأعمال، مساعدة التأشيرة، جولات فاخرة، شهر العسل.",
    desc_fr: "Packages vacances, voyages d'affaires, assistance visa, tours de luxe, lune de miel.",
    tags_en: ["Holiday", "Business travel", "Tour package", "Visa"],
    tags_ar: ["عطلة", "سفر أعمال", "باقة سياحية", "تأشيرة"],
    tags_fr: ["Vacances", "Voyage affaires", "Circuit touristique", "Visa"],
  },
  {
    key: "educ", icon: <IcEduc />, color: "#B8924F", demand: "high", group: "lifestyle",
    name_en: "Education Consultant",  name_ar: "مستشار تعليمي",            name_fr: "Conseiller en Éducation",
    desc_en: "School & university admissions, tutoring, scholarships, study abroad, language courses.",
    desc_ar: "قبول المدارس والجامعات، تدريس خصوصي، منح دراسية، دراسة في الخارج، دورات لغوية.",
    desc_fr: "Admissions école & université, cours particuliers, bourses, études à l'étranger.",
    tags_en: ["Tutoring", "University admission", "Scholarship", "Study abroad"],
    tags_ar: ["تدريس خصوصي", "قبول جامعي", "منحة دراسية", "دراسة بالخارج"],
    tags_fr: ["Soutien scolaire", "Admission université", "Bourse", "Étude à l'étranger"],
  },
  {
    key: "coach", icon: <IcCoach />, color: "#B8924F", demand: "medium", group: "lifestyle",
    name_en: "Life Coach & Personal Development", name_ar: "مدرب الحياة والتطوير الشخصي", name_fr: "Coach de Vie & Développement Personnel",
    desc_en: "Goal setting, productivity, leadership skills, work-life balance, mindset coaching.",
    desc_ar: "تحديد الأهداف، الإنتاجية، مهارات القيادة، التوازن بين العمل والحياة.",
    desc_fr: "Objectifs, productivité, leadership, équilibre vie pro/perso, coaching mental.",
    tags_en: ["Life coaching", "Productivity", "Leadership", "Personal growth"],
    tags_ar: ["تدريب الحياة", "إنتاجية", "قيادة", "نمو شخصي"],
    tags_fr: ["Coaching de vie", "Productivité", "Leadership", "Développement perso"],
  },

  /* ── Business & HR ── */
  {
    key: "immigration", icon: <IcImmig />, color: "#8E4F4F", demand: "high", group: "business",
    name_en: "Immigration & Visa Consultant",  name_ar: "مستشار الهجرة والتأشيرات", name_fr: "Consultant Immigration & Visa",
    desc_en: "Golden Visa UAE, residence permits, work visas, family sponsorship, naturalization.",
    desc_ar: "الإقامة الذهبية الإماراتية، تصاريح الإقامة، تأشيرات العمل، كفالة الأسرة.",
    desc_fr: "Golden Visa EAU, permis de séjour, visas de travail, parrainage familial.",
    tags_en: ["Golden Visa", "Residence permit", "Work visa", "Sponsorship"],
    tags_ar: ["الإقامة الذهبية", "تصريح إقامة", "تأشيرة عمل", "كفالة"],
    tags_fr: ["Golden Visa", "Permis de séjour", "Visa de travail", "Parrainage"],
  },
  {
    key: "archi", icon: <IcArchi />, color: "#8E4F4F", demand: "high", group: "business",
    name_en: "Architect & Interior Designer",  name_ar: "مهندس معماري ومصمم داخلي",  name_fr: "Architecte & Designer d'Intérieur",
    desc_en: "Building design, space planning, renovation, interior decoration, 3D rendering.",
    desc_ar: "تصميم المباني، تخطيط الفضاء، التجديد، الديكور الداخلي، التصوير ثلاثي الأبعاد.",
    desc_fr: "Conception architecturale, aménagement d'espace, rénovation, décoration intérieure.",
    tags_en: ["Architecture", "Interior design", "Renovation", "3D design"],
    tags_ar: ["معمار", "تصميم داخلي", "تجديد", "تصميم ثلاثي الأبعاد"],
    tags_fr: ["Architecture", "Design intérieur", "Rénovation", "Conception 3D"],
  },
  {
    key: "rh", icon: <IcRH />, color: "#8E4F4F", demand: "high", group: "business",
    name_en: "HR & Recruitment Consultant",   name_ar: "مستشار الموارد البشرية والتوظيف", name_fr: "Consultant RH & Recrutement",
    desc_en: "Talent acquisition, headhunting, payroll, HR policies, employee training.",
    desc_ar: "استقطاب المواهب، البحث عن الكوادر، الرواتب، سياسات الموارد البشرية.",
    desc_fr: "Acquisition de talents, chasseur de têtes, paie, politiques RH, formation.",
    tags_en: ["Recruitment", "Headhunting", "Payroll", "HR policy"],
    tags_ar: ["توظيف", "بحث عن كوادر", "رواتب", "سياسات موارد بشرية"],
    tags_fr: ["Recrutement", "Chasse de têtes", "Paie", "Politique RH"],
  },
  {
    key: "douane", icon: <IcDouane />, color: "#8E4F4F", demand: "medium", group: "business",
    name_en: "Customs & Trade Consultant",    name_ar: "مستشار الجمارك والتجارة",    name_fr: "Consultant Douane & Commerce",
    desc_en: "Import/export clearance, HS codes, trade compliance, logistics optimization.",
    desc_ar: "تخليص الاستيراد/التصدير، رموز HS، الامتثال التجاري، تحسين اللوجستيات.",
    desc_fr: "Dédouanement import/export, codes SH, conformité commerciale, logistique.",
    tags_en: ["Customs clearance", "Import export", "Trade compliance", "Logistics"],
    tags_ar: ["تخليص جمركي", "استيراد تصدير", "امتثال تجاري", "لوجستيات"],
    tags_fr: ["Dédouanement", "Import export", "Conformité commerciale", "Logistique"],
  },
  {
    key: "traducteur", icon: <IcTraducteur />, color: "#8E4F4F", demand: "high", group: "business",
    name_en: "Translator & Interpreter",      name_ar: "مترجم ومفسر",                name_fr: "Traducteur & Interprète",
    desc_en: "Legal, medical, technical and sworn translations. Arabic, English, French and 20+ languages. Simultaneous interpreting for meetings & conferences.",
    desc_ar: "ترجمة قانونية وطبية وتقنية ومعتمدة. العربية والإنجليزية والفرنسية وأكثر من 20 لغة. ترجمة فورية للاجتماعات والمؤتمرات.",
    desc_fr: "Traductions juridique, médicale, technique et assermentée. Arabe, anglais, français et 20+ langues. Interprétation simultanée réunions & conférences.",
    tags_en: ["Legal translation", "Sworn translator", "Interpreter", "Arabic English French"],
    tags_ar: ["ترجمة قانونية", "مترجم معتمد", "ترجمة فورية", "عربي إنجليزي فرنسي"],
    tags_fr: ["Traduction juridique", "Traducteur assermenté", "Interprète", "Arabe anglais français"],
  },
];

/* ─── Types ──────────────────────────────────────────────────────────── */
type CountryKey = "ae" | "sa" | "ma";
type CatKey     = "strategy" | "legal" | "realty" | "finance" | "tax" | "tech";

interface CService {
  name: string; name_ar: string; name_fr: string;
  desc_en: string; desc_ar: string; desc_fr: string;
  url: string; cat: CatKey; tag?: string;
  highlight?: boolean;
}

/* ─── Category meta ──────────────────────────────────────────────────── */
const CATS: { key: CatKey; en: string; ar: string; fr: string; icon: React.ReactElement; color: string }[] = [
  { key: "strategy", en: "Strategy",           ar: "الاستراتيجية",        fr: "Stratégie",             icon: <IcStrategy />, color: "var(--gold)" },
  { key: "legal",    en: "Legal & Compliance",  ar: "القانون والامتثال",   fr: "Juridique & Compliance", icon: <IcLegal />,    color: "var(--azure)" },
  { key: "realty",   en: "Real Estate Advisory",ar: "الاستشارات العقارية", fr: "Conseil Immobilier",     icon: <IcRealty />,   color: "var(--emerald)" },
  { key: "finance",  en: "Finance & M&A",       ar: "المالية والاندماج",   fr: "Finance & M&A",          icon: <IcFinAdv />,   color: "#8B5CF6" },
  { key: "tax",      en: "Tax & Accounting",    ar: "الضريبة والمحاسبة",  fr: "Fiscal & Comptabilité",  icon: <IcTax />,      color: "var(--rose)" },
  { key: "tech",     en: "Tech & Digital",      ar: "التكنولوجيا والرقمي", fr: "Tech & Digital",         icon: <IcTech />,     color: "var(--ink-2)" },
];

/* ─── Country meta ───────────────────────────────────────────────────── */
const COUNTRIES: { key: CountryKey; flag: string; en: string; ar: string; fr: string; tagline_en: string; tagline_ar: string; tagline_fr: string }[] = [
  { key: "ae", flag: "🇦🇪", en: "UAE", ar: "الإمارات", fr: "EAU",
    tagline_en: "UAE — MENA's consulting capital, home to 500+ advisory firms in DIFC and Abu Dhabi",
    tagline_ar: "الإمارات — عاصمة الاستشارات في منطقة MENA مع أكثر من 500 شركة استشارية في DIFC وأبوظبي",
    tagline_fr: "EAU — Capitale du conseil en MENA, 500+ cabinets implantés dans le DIFC et Abu Dhabi" },
  { key: "sa", flag: "🇸🇦", en: "KSA", ar: "المملكة", fr: "Arabie Saoudite",
    tagline_en: "KSA — Vision 2030 driving an unprecedented consulting boom across all sectors",
    tagline_ar: "المملكة — رؤية 2030 تقود طفرة استشارية غير مسبوقة في جميع القطاعات",
    tagline_fr: "KSA — Vision 2030 génère un boom consulting sans précédent dans tous les secteurs" },
  { key: "ma", flag: "🇲🇦", en: "Morocco", ar: "المغرب", fr: "Maroc",
    tagline_en: "Morocco — Africa's consulting gateway, bridging European expertise with African ambition",
    tagline_ar: "المغرب — بوابة الاستشارات الأفريقية، تجمع الخبرة الأوروبية بالطموح الأفريقي",
    tagline_fr: "Maroc — Porte d'entrée conseil vers l'Afrique, pont entre expertise européenne et ambition africaine" },
];

/* ─── KPIs ───────────────────────────────────────────────────────────── */
const KPIS: Record<CountryKey, { n: string; en: string; ar: string; fr: string }[]> = {
  ae: [
    { n: "500+",    en: "Advisory firms",     ar: "شركة استشارية",       fr: "Cabinets conseil" },
    { n: "DIFC",    en: "Regional HQ hub",    ar: "مقر إقليمي",          fr: "Hub de QG régionaux" },
    { n: "USD 4B",  en: "Market size",        ar: "حجم السوق",           fr: "Taille du marché" },
    { n: "Big 4",   en: "All present",        ar: "جميعهم حاضرون",       fr: "Tous présents" },
  ],
  sa: [
    { n: "300+",    en: "Consulting firms",   ar: "شركة استشارية",       fr: "Cabinets conseil" },
    { n: "USD 6B",  en: "Market size",        ar: "حجم السوق",           fr: "Taille du marché" },
    { n: "2030",    en: "Giga-projects",      ar: "مشاريع ضخمة",         fr: "Giga-projets" },
    { n: "MCIT",    en: "Digitalisation",     ar: "الرقمنة",             fr: "Digitalisation" },
  ],
  ma: [
    { n: "150+",    en: "Consulting firms",   ar: "شركة استشارية",       fr: "Cabinets conseil" },
    { n: "CFC",     en: "Africa hub",         ar: "مركز أفريقيا",        fr: "Hub Afrique" },
    { n: "35+",     en: "Countries served",   ar: "دولة خدمتها",         fr: "Pays desservis" },
    { n: "HUB",     en: "Francophone Africa", ar: "أفريقيا الفرانكفونية", fr: "Afrique francophone" },
  ],
};

/* ─── Service data ───────────────────────────────────────────────────── */
const SERVICES: Record<CountryKey, CService[]> = {
  ae: [
    /* Strategy */
    { cat: "strategy", highlight: true, tag: "MBB",
      name: "McKinsey & Company — UAE", name_ar: "ماكنزي وشركاه — الإمارات", name_fr: "McKinsey & Company — EAU",
      desc_en: "Global strategy leader with a major DIFC office advising governments and corporates on transformation.",
      desc_ar: "رائد الاستراتيجية العالمي بمكتب رئيسي في DIFC يستشير الحكومات والشركات في مجال التحول.",
      desc_fr: "Leader mondial de la stratégie avec bureau majeur au DIFC, conseillant gouvernements et entreprises.",
      url: "https://www.mckinsey.com/ae/en" },
    { cat: "strategy", highlight: true, tag: "MBB",
      name: "Boston Consulting Group — UAE", name_ar: "مجموعة بوسطن الاستشارية — الإمارات", name_fr: "BCG — EAU",
      desc_en: "BCG's UAE hub drives strategic transformation projects across the Gulf and wider MENA region.",
      desc_ar: "مركز مجموعة بوسطن الاستشارية في الإمارات يقود مشاريع التحول الاستراتيجي في الخليج ومنطقة MENA.",
      desc_fr: "Le hub EAU de BCG pilote des projets de transformation stratégique dans le Golfe et la région MENA.",
      url: "https://www.bcg.com/offices/dubai" },
    { cat: "strategy", tag: "MBB",
      name: "Bain & Company — UAE", name_ar: "بين وشركاه — الإمارات", name_fr: "Bain & Company — EAU",
      desc_en: "Results-oriented strategy firm with strong presence in private equity, real estate and retail sectors.",
      desc_ar: "شركة استشارات موجهة نحو النتائج بحضور قوي في قطاعات الأسهم الخاصة والعقارات والتجزئة.",
      desc_fr: "Cabinet de stratégie orienté résultats, avec forte présence dans le private equity, l'immobilier et le retail.",
      url: "https://www.bain.com/offices/dubai" },
    { cat: "strategy",
      name: "Roland Berger — Dubai", name_ar: "رولاند بيرغر — دبي", name_fr: "Roland Berger — Dubaï",
      desc_en: "European strategy leader with deep expertise in mobility, infrastructure and public sector in the Gulf.",
      desc_ar: "رائد الاستراتيجية الأوروبي بخبرة عميقة في التنقل والبنية التحتية والقطاع العام في الخليج.",
      desc_fr: "Leader européen de la stratégie, expertise approfondie en mobilité, infrastructure et secteur public dans le Golfe.",
      url: "https://www.rolandberger.com/en/offices/dubai.html" },
    { cat: "strategy",
      name: "Oliver Wyman — UAE", name_ar: "أوليفر وايمان — الإمارات", name_fr: "Oliver Wyman — EAU",
      desc_en: "Specialist in financial services, risk management and digital transformation across the MENA region.",
      desc_ar: "متخصص في الخدمات المالية وإدارة المخاطر والتحول الرقمي في منطقة MENA.",
      desc_fr: "Spécialiste des services financiers, gestion des risques et transformation digitale en MENA.",
      url: "https://www.oliverwyman.com/locations/middle-east/dubai.html" },

    /* Legal */
    { cat: "legal", highlight: true, tag: "DIFC",
      name: "Al Tamimi & Company", name_ar: "التميمي وشركاه", name_fr: "Al Tamimi & Company",
      desc_en: "Largest law firm in the Middle East, headquartered in Dubai with 17 offices across the region.",
      desc_ar: "أكبر شركة محاماة في الشرق الأوسط، مقرها دبي مع 17 مكتباً في المنطقة.",
      desc_fr: "Plus grand cabinet d'avocats du Moyen-Orient, basé à Dubaï avec 17 bureaux dans la région.",
      url: "https://www.tamimi.com" },
    { cat: "legal", highlight: true,
      name: "Baker McKenzie — UAE", name_ar: "بيكر ماكنزي — الإمارات", name_fr: "Baker McKenzie — EAU",
      desc_en: "Global law firm with strong UAE presence in M&A, real estate, arbitration and corporate law.",
      desc_ar: "شركة محاماة عالمية بحضور قوي في الإمارات في مجالات الدمج والاستحواذ والعقارات والتحكيم.",
      desc_fr: "Cabinet juridique mondial avec forte présence EAU en M&A, immobilier, arbitrage et droit des sociétés.",
      url: "https://www.bakermckenzie.com/en/locations/middleeast/uae" },
    { cat: "legal",
      name: "Clifford Chance — DIFC", name_ar: "كليفورد تشانس — DIFC", name_fr: "Clifford Chance — DIFC",
      desc_en: "Magic Circle firm with a leading DIFC practice in capital markets, finance and dispute resolution.",
      desc_ar: "شركة من الدائرة السحرية بممارسة رائدة في DIFC في أسواق رأس المال والتمويل وحل النزاعات.",
      desc_fr: "Firme du Magic Circle avec pratique DIFC leader en marchés de capitaux, finance et résolution de litiges.",
      url: "https://www.cliffordchance.com/offices/uae.html" },
    { cat: "legal",
      name: "Dentons — UAE", name_ar: "دينتونز — الإمارات", name_fr: "Dentons — EAU",
      desc_en: "World's largest law firm by headcount, with full-service UAE offices in Dubai and Abu Dhabi.",
      desc_ar: "أكبر شركة محاماة في العالم من حيث عدد الشركاء، مع مكاتب متكاملة في دبي وأبوظبي.",
      desc_fr: "Plus grand cabinet d'avocats mondial en nombre, avec bureaux UAE complets à Dubaï et Abu Dhabi.",
      url: "https://www.dentons.com/en/find-dentons-offices/offices/uae" },

    /* Real Estate Advisory */
    { cat: "realty", highlight: true, tag: "Global Leader",
      name: "JLL — Jones Lang LaSalle UAE", name_ar: "JLL — جونز لانغ لاسال الإمارات", name_fr: "JLL — Jones Lang LaSalle EAU",
      desc_en: "World's leading real estate advisory firm with a major UAE practice covering valuation, leasing and investment.",
      desc_ar: "شركة الاستشارات العقارية الرائدة عالمياً بممارسة رئيسية في الإمارات تشمل التقييم والتأجير والاستثمار.",
      desc_fr: "Premier cabinet conseil immobilier mondial avec pratique UAE majeure couvrant valorisation, location et investissement.",
      url: "https://www.jll.ae" },
    { cat: "realty", highlight: true,
      name: "Knight Frank — UAE", name_ar: "نايت فرانك — الإمارات", name_fr: "Knight Frank — EAU",
      desc_en: "Leading independent real estate consultancy with Dubai's most comprehensive prime residential market data.",
      desc_ar: "شركة استشارات عقارية مستقلة رائدة لديها أشمل بيانات سوق المساكن الفاخرة في دبي.",
      desc_fr: "Cabinet conseil immobilier indépendant leader avec les données les plus complètes sur le résidentiel prime à Dubaï.",
      url: "https://www.knightfrank.ae" },
    { cat: "realty",
      name: "CBRE — UAE", name_ar: "CBRE — الإمارات", name_fr: "CBRE — EAU",
      desc_en: "World's largest commercial real estate services firm with full UAE advisory, management and transaction services.",
      desc_ar: "أكبر شركة خدمات عقارية تجارية في العالم بخدمات استشارية وإدارية وتجارية متكاملة في الإمارات.",
      desc_fr: "Plus grande société de services immobiliers commerciaux au monde, services conseil, gestion et transaction complets aux EAU.",
      url: "https://www.cbre.ae" },
    { cat: "realty",
      name: "Savills — UAE", name_ar: "سافيلز — الإمارات", name_fr: "Savills — EAU",
      desc_en: "International real estate advisor with specialist expertise in luxury residential and commercial sectors.",
      desc_ar: "مستشار عقاري دولي بخبرة متخصصة في القطاعات السكنية الفاخرة والتجارية.",
      desc_fr: "Conseil immobilier international avec expertise spécialisée dans le résidentiel de luxe et le secteur commercial.",
      url: "https://www.savills.ae" },

    /* Finance & M&A */
    { cat: "finance", highlight: true, tag: "Big 4",
      name: "Deloitte — UAE", name_ar: "ديلويت — الإمارات", name_fr: "Deloitte — EAU",
      desc_en: "Largest professional services firm globally, with a UAE practice spanning audit, advisory, tax and M&A.",
      desc_ar: "أكبر شركة خدمات مهنية عالمياً، مع ممارسة في الإمارات تشمل التدقيق والاستشارات والضرائب والدمج والاستحواذ.",
      desc_fr: "Plus grande firme de services professionnels au monde, pratique UAE couvrant audit, advisory, fiscalité et M&A.",
      url: "https://www.deloitte.com/ae" },
    { cat: "finance", highlight: true, tag: "Big 4",
      name: "PwC — UAE", name_ar: "برايس ووترهاوس كوبرز — الإمارات", name_fr: "PwC — EAU",
      desc_en: "Global professional services network with one of the largest advisory and deals teams in the Gulf.",
      desc_ar: "شبكة خدمات مهنية عالمية مع أحد أكبر فرق الاستشارات والصفقات في الخليج.",
      desc_fr: "Réseau mondial de services professionnels avec l'une des plus grandes équipes advisory et deals du Golfe.",
      url: "https://www.pwc.com/m1/en/middle-east/uae.html" },
    { cat: "finance",
      name: "EY — Ernst & Young UAE", name_ar: "إيرنست ويونغ — الإمارات", name_fr: "EY — Ernst & Young EAU",
      desc_en: "Leading advisory firm with UAE strength in transactions, capital markets and financial due diligence.",
      desc_ar: "شركة استشارات رائدة بقوة في الإمارات في المعاملات وأسواق رأس المال والعناية الواجبة المالية.",
      desc_fr: "Cabinet advisory leader, fort aux EAU en transactions, marchés de capitaux et due diligence financière.",
      url: "https://www.ey.com/en_ae" },
    { cat: "finance",
      name: "KPMG — UAE", name_ar: "كيه بي إم جي — الإمارات", name_fr: "KPMG — EAU",
      desc_en: "Professional services leader with UAE expertise in infrastructure advisory, privatization and real estate.",
      desc_ar: "رائد في الخدمات المهنية بخبرة في الإمارات في الاستشارات المتعلقة بالبنية التحتية والخصخصة والعقارات.",
      desc_fr: "Leader des services professionnels, expertise UAE en conseil infrastructure, privatisation et immobilier.",
      url: "https://www.kpmg.com/ae" },

    /* Tax & Accounting */
    { cat: "tax", highlight: true,
      name: "Mazars — UAE", name_ar: "مازارز — الإمارات", name_fr: "Mazars — EAU",
      desc_en: "International audit and tax group with specialist VAT and corporate tax advisory in the UAE.",
      desc_ar: "مجموعة دولية للتدقيق والضرائب مع استشارات متخصصة في ضريبة القيمة المضافة والضريبة على الشركات في الإمارات.",
      desc_fr: "Groupe international d'audit et fiscalité avec conseil spécialisé TVA et impôt société aux EAU.",
      url: "https://www.mazars.ae" },
    { cat: "tax",
      name: "Grant Thornton — UAE", name_ar: "غرانت ثورنتون — الإمارات", name_fr: "Grant Thornton — EAU",
      desc_en: "Mid-market accounting and advisory firm with strong UAE presence for SMEs and family businesses.",
      desc_ar: "شركة محاسبة واستشارات للسوق المتوسطة بحضور قوي في الإمارات للشركات الصغيرة والمتوسطة وعائلية.",
      desc_fr: "Cabinet comptable et advisory mid-market, forte présence UAE pour PME et entreprises familiales.",
      url: "https://www.grantthornton.ae" },
    { cat: "tax",
      name: "BDO — UAE", name_ar: "BDO — الإمارات", name_fr: "BDO — EAU",
      desc_en: "Global accounting network with comprehensive UAE services in audit, tax and business advisory.",
      desc_ar: "شبكة محاسبة عالمية بخدمات متكاملة في الإمارات في التدقيق والضرائب والاستشارات التجارية.",
      desc_fr: "Réseau comptable mondial avec services UAE complets en audit, fiscalité et conseil d'affaires.",
      url: "https://www.bdo.ae" },

    /* Tech & Digital */
    { cat: "tech", highlight: true, tag: "Global Leader",
      name: "Accenture — UAE", name_ar: "أكسنتشر — الإمارات", name_fr: "Accenture — EAU",
      desc_en: "Global technology and strategy consultancy leading UAE's digital transformation projects.",
      desc_ar: "شركة استشارات تقنية واستراتيجية عالمية تقود مشاريع التحول الرقمي في الإمارات.",
      desc_fr: "Cabinet conseil technologie et stratégie mondial, pilote les projets de transformation digitale aux EAU.",
      url: "https://www.accenture.com/ae-en" },
    { cat: "tech",
      name: "IBM Consulting — UAE", name_ar: "IBM للاستشارات — الإمارات", name_fr: "IBM Consulting — EAU",
      desc_en: "Technology consultancy specializing in AI, cloud and cybersecurity transformation for UAE enterprises.",
      desc_ar: "استشارات تقنية متخصصة في الذكاء الاصطناعي والسحابة والأمن السيبراني للمؤسسات الإماراتية.",
      desc_fr: "Cabinet conseil technologie spécialisé en IA, cloud et cybersécurité pour les entreprises aux EAU.",
      url: "https://www.ibm.com/consulting/ae" },
    { cat: "tech",
      name: "Capgemini — UAE", name_ar: "كاب جيميني — الإمارات", name_fr: "Capgemini — EAU",
      desc_en: "European IT services leader with strong UAE delivery in cloud transformation and AI solutions.",
      desc_ar: "رائد أوروبي في خدمات تكنولوجيا المعلومات بتسليم قوي في الإمارات في مجال التحول السحابي وحلول الذكاء الاصطناعي.",
      desc_fr: "Leader européen des services IT, forte livraison UAE en transformation cloud et solutions IA.",
      url: "https://www.capgemini.com/ae-en" },
  ],

  sa: [
    /* Strategy */
    { cat: "strategy", highlight: true, tag: "MBB",
      name: "McKinsey & Company — KSA", name_ar: "ماكنزي وشركاه — المملكة", name_fr: "McKinsey & Company — KSA",
      desc_en: "Key adviser to Saudi government on Vision 2030 implementation, NEOM, and giga-project strategy.",
      desc_ar: "المستشار الرئيسي للحكومة السعودية في تنفيذ رؤية 2030 ونيوم واستراتيجية المشاريع الضخمة.",
      desc_fr: "Conseiller clé du gouvernement saoudien sur Vision 2030, NEOM et la stratégie des giga-projets.",
      url: "https://www.mckinsey.com/sa/en" },
    { cat: "strategy", highlight: true, tag: "MBB",
      name: "BCG — Saudi Arabia", name_ar: "مجموعة بوسطن الاستشارية — المملكة", name_fr: "BCG — Arabie Saoudite",
      desc_en: "Driving Vision 2030 sector strategies in tourism, entertainment, sports and industrialization.",
      desc_ar: "قيادة استراتيجيات قطاع رؤية 2030 في السياحة والترفيه والرياضة والتصنيع.",
      desc_fr: "Pilote les stratégies sectorielles Vision 2030 dans le tourisme, le divertissement, le sport et l'industrie.",
      url: "https://www.bcg.com/offices/riyadh" },
    { cat: "strategy", tag: "MBB",
      name: "Bain & Company — Riyadh", name_ar: "بين وشركاه — الرياض", name_fr: "Bain & Company — Riyad",
      desc_en: "Leading strategy and private equity advisory firm with a growing Riyadh practice.",
      desc_ar: "شركة استراتيجية واستشارات الأسهم الخاصة الرائدة بممارسة متنامية في الرياض.",
      desc_fr: "Cabinet de stratégie et advisory private equity leader, pratique Riyad en forte croissance.",
      url: "https://www.bain.com/offices/riyadh" },
    { cat: "strategy",
      name: "A.T. Kearney — KSA", name_ar: "كيرني — المملكة", name_fr: "Kearney — KSA",
      desc_en: "Global strategy firm advising Saudi industrial companies and government entities on transformation.",
      desc_ar: "شركة استراتيجية عالمية تستشير الشركات الصناعية السعودية والجهات الحكومية في مجال التحول.",
      desc_fr: "Cabinet de stratégie mondial conseillant entreprises industrielles saoudiennes et entités gouvernementales.",
      url: "https://www.kearney.com/office/riyadh" },

    /* Legal */
    { cat: "legal", highlight: true, tag: "Local Leader",
      name: "Al Tamimi & Company — KSA", name_ar: "التميمي وشركاه — المملكة", name_fr: "Al Tamimi — KSA",
      desc_en: "Largest regional firm, advising on Saudi regulatory frameworks, Vision 2030 projects and real estate law.",
      desc_ar: "أكبر شركة إقليمية تستشير في الأطر التنظيمية السعودية ومشاريع رؤية 2030 وقانون العقارات.",
      desc_fr: "Plus grand cabinet régional, conseil sur cadres réglementaires saoudiens, projets Vision 2030 et droit immobilier.",
      url: "https://www.tamimi.com/locations/saudi-arabia" },
    { cat: "legal", highlight: true,
      name: "White & Case — Riyadh", name_ar: "وايت وكيس — الرياض", name_fr: "White & Case — Riyad",
      desc_en: "Global firm with a leading Riyadh practice in project finance, energy and capital markets.",
      desc_ar: "شركة عالمية بممارسة رائدة في الرياض في تمويل المشاريع والطاقة وأسواق رأس المال.",
      desc_fr: "Firme mondiale avec pratique Riyad leader en project finance, énergie et marchés de capitaux.",
      url: "https://www.whitecase.com/law/offices/riyadh" },
    { cat: "legal",
      name: "Clyde & Co — KSA", name_ar: "كلايد وشركاه — المملكة", name_fr: "Clyde & Co — KSA",
      desc_en: "Insurance, construction and real estate specialist with a strong Saudi Arabian practice.",
      desc_ar: "متخصص في التأمين والبناء والعقارات بممارسة قوية في المملكة العربية السعودية.",
      desc_fr: "Spécialiste assurance, construction et immobilier avec une solide pratique en Arabie Saoudite.",
      url: "https://www.clydeco.com/en/locations/middle-east/saudi-arabia" },

    /* Real Estate Advisory */
    { cat: "realty", highlight: true,
      name: "JLL — Saudi Arabia", name_ar: "JLL — المملكة العربية السعودية", name_fr: "JLL — Arabie Saoudite",
      desc_en: "Leading real estate adviser on Saudi giga-projects: NEOM, Red Sea, Diriyah, AlUla.",
      desc_ar: "المستشار العقاري الرائد في المشاريع الضخمة السعودية: نيوم، البحر الأحمر، الدرعية، العُلا.",
      desc_fr: "Conseil immobilier leader sur les giga-projets saoudiens : NEOM, Red Sea, Diriyah, AlUla.",
      url: "https://www.jll.com/en/countries/saudi-arabia" },
    { cat: "realty",
      name: "Knight Frank — Saudi Arabia", name_ar: "نايت فرانك — المملكة", name_fr: "Knight Frank — Arabie Saoudite",
      desc_en: "Market leader in Saudi prime residential, commercial and hospitality real estate advisory.",
      desc_ar: "رائد السوق في الاستشارات العقارية السكنية والتجارية والضيافة المتميزة في المملكة العربية السعودية.",
      desc_fr: "Leader de marché en Arabie Saoudite en conseil immobilier résidentiel prime, commercial et hôtellerie.",
      url: "https://www.knightfrank.com/saudi-arabia" },
    { cat: "realty",
      name: "CBRE — Saudi Arabia", name_ar: "CBRE — المملكة", name_fr: "CBRE — Arabie Saoudite",
      desc_en: "Full-service commercial real estate firm advising on Vision 2030 development and asset management.",
      desc_ar: "شركة عقارات تجارية متكاملة الخدمات تستشير في تطوير رؤية 2030 وإدارة الأصول.",
      desc_fr: "Société immobilière commerciale full-service, conseil sur développement Vision 2030 et asset management.",
      url: "https://www.cbre.com/about/offices/riyadh" },

    /* Finance & M&A */
    { cat: "finance", highlight: true, tag: "Big 4",
      name: "Deloitte — Saudi Arabia", name_ar: "ديلويت — المملكة العربية السعودية", name_fr: "Deloitte — Arabie Saoudite",
      desc_en: "Top professional services firm in KSA, leading Vision 2030 advisory across sectors.",
      desc_ar: "شركة الخدمات المهنية الأولى في المملكة، تقود الاستشارات في مجال رؤية 2030 عبر القطاعات.",
      desc_fr: "Première firme de services professionnels en KSA, pilote l'advisory Vision 2030 dans tous les secteurs.",
      url: "https://www.deloitte.com/sa" },
    { cat: "finance", tag: "Big 4",
      name: "PwC — Saudi Arabia", name_ar: "PwC — المملكة العربية السعودية", name_fr: "PwC — Arabie Saoudite",
      desc_en: "Comprehensive advisory services with a major Riyadh hub for tax, deals and digital transformation.",
      desc_ar: "خدمات استشارية شاملة مع مركز رئيسي في الرياض للضرائب والصفقات والتحول الرقمي.",
      desc_fr: "Services advisory complets avec hub Riyad majeur pour fiscalité, deals et transformation digitale.",
      url: "https://www.pwc.com/m1/en/middle-east/saudi-arabia.html" },
    { cat: "finance", tag: "Big 4",
      name: "EY — Saudi Arabia", name_ar: "EY — المملكة العربية السعودية", name_fr: "EY — Arabie Saoudite",
      desc_en: "Major transactions and advisory practice in KSA covering IPOs, privatizations and infrastructure finance.",
      desc_ar: "ممارسة معاملات واستشارات رائدة في المملكة تشمل الاكتتابات العامة والخصخصة وتمويل البنية التحتية.",
      desc_fr: "Pratique transactions et advisory majeure en KSA couvrant introductions en bourse, privatisations et financement infrastructure.",
      url: "https://www.ey.com/en_sa" },

    /* Tax */
    { cat: "tax", highlight: true,
      name: "Mazars — Saudi Arabia", name_ar: "مازارز — المملكة", name_fr: "Mazars — Arabie Saoudite",
      desc_en: "Specialist tax advisory on Saudi Zakat, VAT and transfer pricing for multinationals.",
      desc_ar: "استشارات ضريبية متخصصة في الزكاة السعودية وضريبة القيمة المضافة وأسعار التحويل للشركات متعددة الجنسيات.",
      desc_fr: "Conseil fiscal spécialisé sur la Zakat saoudienne, TVA et prix de transfert pour les multinationales.",
      url: "https://www.mazars.com/home/about-us/our-offices/saudi-arabia" },
    { cat: "tax",
      name: "KPMG — Saudi Arabia", name_ar: "KPMG — المملكة", name_fr: "KPMG — Arabie Saoudite",
      desc_en: "Leading tax and audit firm in KSA, advising on ZATCA compliance and cross-border structures.",
      desc_ar: "شركة ضرائب وتدقيق رائدة في المملكة، تستشير في الامتثال لهيئة الزكاة والضريبة والجمارك والهياكل العابرة للحدود.",
      desc_fr: "Cabinet fiscal et d'audit leader en KSA, conseil sur la conformité ZATCA et les structures transfrontalières.",
      url: "https://www.kpmg.com/sa" },

    /* Tech */
    { cat: "tech", highlight: true, tag: "Vision 2030",
      name: "Accenture — Saudi Arabia", name_ar: "أكسنتشر — المملكة", name_fr: "Accenture — Arabie Saoudite",
      desc_en: "Leading digital transformation partner for Saudi Vision 2030 government and enterprise programs.",
      desc_ar: "شريك التحول الرقمي الرائد لبرامج رؤية 2030 الحكومية والمؤسسية السعودية.",
      desc_fr: "Partenaire de transformation digitale leader pour les programmes gouvernementaux et entreprises Vision 2030.",
      url: "https://www.accenture.com/sa-en" },
    { cat: "tech",
      name: "SAP — Saudi Arabia", name_ar: "SAP — المملكة العربية السعودية", name_fr: "SAP — Arabie Saoudite",
      desc_en: "Enterprise software and digital platform leader, powering Saudi Aramco, STC and major Vision 2030 entities.",
      desc_ar: "رائد برمجيات المؤسسات والمنصة الرقمية، يدعم أرامكو السعودية وSTC وكبرى كيانات رؤية 2030.",
      desc_fr: "Leader des logiciels enterprise et plateformes digitales, alimentant Saudi Aramco, STC et entités Vision 2030.",
      url: "https://www.sap.com/mena/about/offices.html" },
  ],

  ma: [
    /* Strategy */
    { cat: "strategy", highlight: true, tag: "Afrique",
      name: "McKinsey & Company — Casablanca", name_ar: "ماكنزي وشركاه — الدار البيضاء", name_fr: "McKinsey & Company — Casablanca",
      desc_en: "North Africa and francophone Africa hub, advising on Morocco's economic diversification and African expansion.",
      desc_ar: "مركز شمال أفريقيا وأفريقيا الفرانكفونية، يستشير في تنويع الاقتصاد المغربي والتوسع الأفريقي.",
      desc_fr: "Hub Afrique du Nord et Afrique francophone, conseil sur la diversification économique du Maroc et l'expansion africaine.",
      url: "https://www.mckinsey.com/ma/fr" },
    { cat: "strategy", highlight: true,
      name: "Roland Berger — Maroc", name_ar: "رولاند بيرغر — المغرب", name_fr: "Roland Berger — Maroc",
      desc_en: "Strong Moroccan presence in infrastructure, public sector reform and industrial competitiveness.",
      desc_ar: "حضور مغربي قوي في البنية التحتية وإصلاح القطاع العام والتنافسية الصناعية.",
      desc_fr: "Forte présence marocaine en infrastructure, réforme du secteur public et compétitivité industrielle.",
      url: "https://www.rolandberger.com/en/offices/casablanca.html" },
    { cat: "strategy",
      name: "Deloitte Consulting — Maroc", name_ar: "ديلويت للاستشارات — المغرب", name_fr: "Deloitte Consulting — Maroc",
      desc_en: "Strategy and operations consulting for Moroccan businesses and pan-African expansion projects.",
      desc_ar: "استشارات الاستراتيجية والعمليات للشركات المغربية ومشاريع التوسع الأفريقي.",
      desc_fr: "Conseil stratégie et opérations pour les entreprises marocaines et les projets d'expansion panafricaine.",
      url: "https://www2.deloitte.com/ma" },
    { cat: "strategy",
      name: "Syntec Conseil — Maroc", name_ar: "سينتك للاستشارات — المغرب", name_fr: "Syntec Conseil — Maroc",
      desc_en: "Moroccan management consulting federation grouping local and international advisory firms.",
      desc_ar: "الاتحاد المغربي للاستشارات الإدارية الذي يجمع شركات الاستشارات المحلية والدولية.",
      desc_fr: "Fédération marocaine du conseil en management regroupant cabinets locaux et internationaux.",
      url: "https://www.syntec-numerique.ma" },

    /* Legal */
    { cat: "legal", highlight: true, tag: "Référence",
      name: "Gide Loyrette Nouel — Casablanca", name_ar: "جيد لواريت نويل — الدار البيضاء", name_fr: "Gide Loyrette Nouel — Casablanca",
      desc_en: "France's leading international law firm with a major Casablanca practice in M&A, finance and real estate.",
      desc_ar: "الشركة القانونية الدولية الفرنسية الرائدة بممارسة رئيسية في الدار البيضاء في الدمج والاستحواذ والتمويل والعقارات.",
      desc_fr: "Premier cabinet juridique international français, pratique majeure à Casablanca en M&A, finance et immobilier.",
      url: "https://www.gide.com/fr/bureaux/casablanca" },
    { cat: "legal", highlight: true,
      name: "CMS Francis Lefebvre — Maroc", name_ar: "CMS فرانسيس ليفيبفر — المغرب", name_fr: "CMS Francis Lefebvre — Maroc",
      desc_en: "Leading law firm in Morocco for corporate law, real estate transactions and tax advisory.",
      desc_ar: "شركة محاماة رائدة في المغرب في قانون الشركات والمعاملات العقارية والاستشارات الضريبية.",
      desc_fr: "Cabinet d'avocats leader au Maroc pour le droit des affaires, les transactions immobilières et le conseil fiscal.",
      url: "https://cms.law/fr/mar" },
    { cat: "legal",
      name: "Clifford Chance — Casablanca", name_ar: "كليفورد تشانس — الدار البيضاء", name_fr: "Clifford Chance — Casablanca",
      desc_en: "International Magic Circle firm with a Casablanca office specializing in project finance and capital markets.",
      desc_ar: "شركة الدائرة السحرية الدولية بمكتب في الدار البيضاء متخصص في تمويل المشاريع وأسواق رأس المال.",
      desc_fr: "Cabinet international Magic Circle avec bureau Casablanca spécialisé en project finance et marchés de capitaux.",
      url: "https://www.cliffordchance.com/offices/morocco.html" },
    { cat: "legal",
      name: "Dentons — Maroc", name_ar: "دينتونز — المغرب", name_fr: "Dentons — Maroc",
      desc_en: "Global law firm present in Morocco, specialized in banking, finance and energy transactions.",
      desc_ar: "شركة محاماة عالمية حاضرة في المغرب، متخصصة في المعاملات المصرفية والمالية والطاقة.",
      desc_fr: "Cabinet juridique mondial présent au Maroc, spécialisé dans les transactions bancaires, financières et énergie.",
      url: "https://www.dentons.com/en/find-dentons-offices/offices/morocco" },

    /* Real Estate Advisory */
    { cat: "realty", highlight: true,
      name: "JLL — Maroc", name_ar: "JLL — المغرب", name_fr: "JLL — Maroc",
      desc_en: "Leading real estate adviser for Morocco's commercial, logistics and prime residential markets.",
      desc_ar: "المستشار العقاري الرائد للأسواق التجارية واللوجستية والسكنية المتميزة في المغرب.",
      desc_fr: "Conseil immobilier leader pour les marchés commercial, logistique et résidentiel prime du Maroc.",
      url: "https://www.jll.ma" },
    { cat: "realty",
      name: "Knight Frank — Maroc", name_ar: "نايت فرانك — المغرب", name_fr: "Knight Frank — Maroc",
      desc_en: "Prime residential and commercial property advisory across Casablanca, Marrakech and Rabat.",
      desc_ar: "استشارات عقارية سكنية وتجارية متميزة في الدار البيضاء ومراكش والرباط.",
      desc_fr: "Conseil immobilier résidentiel prime et commercial à Casablanca, Marrakech et Rabat.",
      url: "https://www.knightfrank.com/morocco" },
    { cat: "realty",
      name: "CBRE — Maroc", name_ar: "CBRE — المغرب", name_fr: "CBRE — Maroc",
      desc_en: "Commercial real estate services covering office, retail and industrial markets in Morocco.",
      desc_ar: "خدمات العقارات التجارية تشمل أسواق المكاتب والتجزئة والصناعة في المغرب.",
      desc_fr: "Services immobiliers commerciaux couvrant les marchés bureaux, retail et industriel au Maroc.",
      url: "https://www.cbre.ma" },

    /* Finance & M&A */
    { cat: "finance", highlight: true, tag: "Big 4",
      name: "Deloitte — Maroc", name_ar: "ديلويت — المغرب", name_fr: "Deloitte — Maroc",
      desc_en: "Largest professional services firm in Morocco, with leading M&A, IPO and infrastructure advisory.",
      desc_ar: "أكبر شركة خدمات مهنية في المغرب، مع استشارات رائدة في الدمج والاستحواذ والاكتتابات والبنية التحتية.",
      desc_fr: "Plus grande firme de services professionnels au Maroc, advisory M&A, IPO et infrastructure leader.",
      url: "https://www2.deloitte.com/ma" },
    { cat: "finance", tag: "Big 4",
      name: "PwC — Maroc", name_ar: "PwC — المغرب", name_fr: "PwC — Maroc",
      desc_en: "Comprehensive deals and advisory services for Moroccan corporates and African expansion projects.",
      desc_ar: "خدمات صفقات واستشارات شاملة للشركات المغربية ومشاريع التوسع الأفريقي.",
      desc_fr: "Services deals et advisory complets pour les entreprises marocaines et les projets d'expansion africaine.",
      url: "https://www.pwc.com/ma/fr.html" },
    { cat: "finance",
      name: "CFG Partners — Maroc", name_ar: "CFG بارتنرز — المغرب", name_fr: "CFG Partners — Maroc",
      desc_en: "Leading Moroccan investment bank specializing in M&A, capital markets and structured finance.",
      desc_ar: "بنك الاستثمار المغربي الرائد المتخصص في الدمج والاستحواذ وأسواق رأس المال والتمويل الهيكلي.",
      desc_fr: "Banque d'investissement marocaine leader, spécialisée en M&A, marchés de capitaux et financement structuré.",
      url: "https://www.cfg.ma" },

    /* Tax */
    { cat: "tax", highlight: true,
      name: "EY — Maroc", name_ar: "EY — المغرب", name_fr: "EY — Maroc",
      desc_en: "Leading tax and audit firm advising on Moroccan fiscal reform, transfer pricing and VAT compliance.",
      desc_ar: "شركة ضرائب وتدقيق رائدة تستشير في الإصلاح الضريبي المغربي وأسعار التحويل والامتثال لضريبة القيمة المضافة.",
      desc_fr: "Cabinet fiscal et d'audit leader, conseil sur la réforme fiscale marocaine, prix de transfert et conformité TVA.",
      url: "https://www.ey.com/fr_ma" },
    { cat: "tax",
      name: "KPMG — Maroc", name_ar: "KPMG — المغرب", name_fr: "KPMG — Maroc",
      desc_en: "Full-service tax advisory for Moroccan and foreign companies operating across Africa.",
      desc_ar: "استشارات ضريبية متكاملة للشركات المغربية والأجنبية العاملة في جميع أنحاء أفريقيا.",
      desc_fr: "Conseil fiscal full-service pour les entreprises marocaines et étrangères opérant à travers l'Afrique.",
      url: "https://www.kpmg.com/ma" },

    /* Tech */
    { cat: "tech", highlight: true, tag: "Digital",
      name: "Accenture — Maroc", name_ar: "أكسنتشر — المغرب", name_fr: "Accenture — Maroc",
      desc_en: "Digital and technology consulting for Morocco's banking, telecoms and public sector transformation.",
      desc_ar: "استشارات رقمية وتقنية لتحول القطاع المصرفي والاتصالات والقطاع العام في المغرب.",
      desc_fr: "Conseil digital et technologie pour la transformation des secteurs bancaire, télécom et public au Maroc.",
      url: "https://www.accenture.com/ma-fr" },
    { cat: "tech",
      name: "Capgemini — Maroc", name_ar: "كاب جيميني — المغرب", name_fr: "Capgemini — Maroc",
      desc_en: "Major nearshoring IT hub in Casablanca, delivering digital transformation services for European clients.",
      desc_ar: "مركز تقنية معلومات قريب التشوير في الدار البيضاء، يقدم خدمات التحول الرقمي للعملاء الأوروبيين.",
      desc_fr: "Hub nearshore IT majeur à Casablanca, livrant des services de transformation digitale pour clients européens.",
      url: "https://www.capgemini.com/ma-fr" },
  ],
};

/* ─── Component ──────────────────────────────────────────────────────── */
export function ScreenConsultants() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const [view, setView]       = useState<ViewMode>("specialists");
  const [country, setCountry] = useState<CountryKey>("ae");
  const [cat, setCat]         = useState<CatKey | "all">("all");
  const [specGroup, setSpecGroup] = useState<Specialist["group"] | "all">("all");
  const [searchSpec, setSearchSpec] = useState("");

  const country_meta = COUNTRIES.find(c => c.key === country)!;
  const services     = SERVICES[country];
  const kpis         = KPIS[country];

  const label = (s: CService) => lang === "ar" ? s.name_ar : lang === "fr" ? s.name_fr : s.name;
  const desc  = (s: CService) => lang === "ar" ? s.desc_ar : lang === "fr" ? s.desc_fr : s.desc_en;
  const catLabel = (c: (typeof CATS)[0]) => lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en;
  const tagline = lang === "ar" ? country_meta.tagline_ar : lang === "fr" ? country_meta.tagline_fr : country_meta.tagline_en;

  const filtered = cat === "all" ? services : services.filter(s => s.cat === cat);

  const grouped = CATS.map(c => ({
    ...c,
    items: services.filter(s => s.cat === c.key),
  })).filter(g => g.items.length > 0);

  const specLabel  = (s: Specialist) => lang === "ar" ? s.name_ar : lang === "fr" ? s.name_fr : s.name_en;
  const specDesc   = (s: Specialist) => lang === "ar" ? s.desc_ar : lang === "fr" ? s.desc_fr : s.desc_en;
  const specTags   = (s: Specialist) => lang === "ar" ? s.tags_ar : lang === "fr" ? s.tags_fr : s.tags_en;
  const grpLabel   = (g: (typeof SPEC_GROUPS)[0]) => lang === "ar" ? g.ar : lang === "fr" ? g.fr : g.en;

  const filteredSpecs = SPECIALISTS.filter(s => {
    const matchGroup = specGroup === "all" || s.group === specGroup;
    if (!searchSpec.trim()) return matchGroup;
    const q = searchSpec.toLowerCase();
    return matchGroup && (
      s.name_en.toLowerCase().includes(q) || s.name_fr.toLowerCase().includes(q) ||
      s.name_ar.includes(q) || s.desc_en.toLowerCase().includes(q) ||
      s.tags_en.some(t => t.toLowerCase().includes(q))
    );
  });

  const groupedSpecs = SPEC_GROUPS.map(g => ({
    ...g,
    items: filteredSpecs.filter(s => s.group === g.key),
  })).filter(g => g.items.length > 0);

  const topbarTitle = lang === "ar" ? "المستشارون" : lang === "fr" ? "Consultants" : "Consultants";

  const viewBtnStyle = (active: boolean): React.CSSProperties => ({
    padding: "7px 18px", borderRadius: 999, fontSize: 12.5, fontWeight: active ? 600 : 400,
    cursor: "pointer", border: "1px solid", transition: "all 0.15s",
    background:   active ? "rgba(184,146,79,0.25)" : "rgba(255,255,255,0.06)",
    borderColor:  active ? "var(--gold)" : "rgba(255,255,255,0.15)",
    color:        active ? "var(--gold)" : "rgba(255,255,255,0.6)",
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={topbarTitle} />

      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-cream)" }}>

        {/* ── Hero dark card ── */}
        <div style={{
          background: "linear-gradient(135deg, #14100a 0%, #1e1608 50%, #2a1e0c 100%)",
          padding: isMob ? "24px 16px 20px" : "32px 36px 28px",
        }}>

          {/* View mode switcher */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
            <button onClick={() => setView("specialists")} style={viewBtnStyle(view === "specialists")}>
              {lang === "ar" ? "🔍 المتخصصون" : lang === "fr" ? "🔍 Spécialistes" : "🔍 Specialists"}
              <span style={{ marginInlineStart: 6, fontSize: 10, opacity: 0.65 }}>{SPECIALISTS.length}</span>
            </button>
            <button onClick={() => setView("firms")} style={viewBtnStyle(view === "firms")}>
              {lang === "ar" ? "🏢 الشركات والكبرى" : lang === "fr" ? "🏢 Cabinets & Firmes" : "🏢 Firms & Agencies"}
            </button>
          </div>

          {view === "specialists" ? (
            <>
              <div className="font-display" style={{ fontSize: isMob ? 22 : 28, color: "#fff", marginBottom: 6 }}>
                {lang === "ar" ? "جميع المتخصصين" : lang === "fr" ? "Tous les Spécialistes" : "All Specialists"}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", maxWidth: 540, lineHeight: 1.6, marginBottom: 20 }}>
                {lang === "ar"
                  ? "ابحث عن المتخصص المناسب لاحتياجاتك في الصحة والقانون والتقنية والأعمال وأسلوب الحياة."
                  : lang === "fr"
                  ? "Trouvez le spécialiste adapté à vos besoins : santé, juridique, tech, business et lifestyle."
                  : "Find the right specialist for your needs: health, legal, tech, business and lifestyle."}
              </div>
              {/* Search bar */}
              <div style={{ position: "relative", maxWidth: 360 }}>
                <input
                  type="text" value={searchSpec} onChange={e => setSearchSpec(e.target.value)}
                  placeholder={lang === "ar" ? "ابحث عن متخصص..." : lang === "fr" ? "Rechercher un spécialiste..." : "Search specialist..."}
                  style={{
                    width: "100%", height: 38, padding: "0 14px 0 36px", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 999, fontSize: 12.5, color: "#fff", outline: "none",
                    fontFamily: "Roboto, system-ui, sans-serif",
                  }}
                />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round"
                  style={{ position: "absolute", insetInlineStart: 12, top: "50%", transform: "translateY(-50%)" }}>
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
              </div>
            </>
          ) : (
            <>
              {/* Country selector — firms view */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
                {COUNTRIES.map(c => (
                  <button key={c.key} onClick={() => { setCountry(c.key); setCat("all"); }}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                  background: country === c.key ? "rgba(200,160,60,0.2)" : "rgba(255,255,255,0.06)",
                  border: country === c.key ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.1)",
                  color: country === c.key ? "var(--gold)" : "rgba(255,255,255,0.55)",
                  fontSize: 12.5, fontWeight: country === c.key ? 600 : 400,
                  transition: "all 0.15s",
                }}
              >
                    <span style={{ fontSize: 16 }}>{c.flag}</span>
                    <span>{lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en}</span>
                  </button>
                ))}
              </div>
              <div className="font-display" style={{ fontSize: isMob ? 24 : 30, color: "#fff", letterSpacing: "0.02em", marginBottom: 8 }}>
                {topbarTitle}
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", maxWidth: 580, lineHeight: 1.6, marginBottom: 24 }}>
                {tagline}
              </div>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
                {kpis.map(k => (
                  <div key={k.n} style={{ minWidth: 80 }}>
                    <div className="font-display tnum" style={{ fontSize: 22, color: "var(--gold)", letterSpacing: "0.02em" }}>{k.n}</div>
                    <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
                      {lang === "ar" ? k.ar : lang === "fr" ? k.fr : k.en}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ── Filter bar (adapts to view mode) ── */}
        <div style={{ padding: isMob ? "12px 12px" : "14px 24px", background: "var(--bg-paper)", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: 8, overflowX: "auto", flexWrap: isMob ? "nowrap" : "wrap" }}>

          {view === "specialists" ? (
            /* Specialists group filters */
            <>
              <button onClick={() => setSpecGroup("all")} style={{
                padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                background: specGroup === "all" ? "var(--gold)" : "var(--bg-ivory)",
                color: specGroup === "all" ? "#1A1610" : "var(--ink-3)",
                border: specGroup === "all" ? "1px solid var(--gold)" : "1px solid var(--line-soft)",
              }}>
                {lang === "ar" ? "الكل" : lang === "fr" ? "Tout" : "All"}
                <span style={{ marginInlineStart: 5, fontSize: 10, opacity: 0.65 }}>{SPECIALISTS.length}</span>
              </button>
              {SPEC_GROUPS.map(g => {
                const cnt = SPECIALISTS.filter(s => s.group === g.key).length;
                const active = specGroup === g.key;
                return (
                  <button key={g.key} onClick={() => setSpecGroup(g.key)} style={{
                    padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: active ? 600 : 400,
                    cursor: "pointer", whiteSpace: "nowrap",
                    background: active ? `${g.color}18` : "var(--bg-ivory)",
                    color: active ? g.color : "var(--ink-3)",
                    border: active ? `1px solid ${g.color}` : "1px solid var(--line-soft)",
                  }}>
                    {grpLabel(g)}
                    <span style={{ marginInlineStart: 5, fontSize: 10, opacity: 0.6 }}>{cnt}</span>
                  </button>
                );
              })}
            </>
          ) : (
            /* Firms category filters */
            <>
              <button onClick={() => setCat("all")} style={{
                padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                background: cat === "all" ? "var(--gold)" : "var(--bg-ivory)",
                color: cat === "all" ? "#1A1610" : "var(--ink-3)",
                border: cat === "all" ? "1px solid var(--gold)" : "1px solid var(--line-soft)",
              }}>
                {lang === "ar" ? "الكل" : lang === "fr" ? "Tout" : "All"}
                <span style={{ marginInlineStart: 5, fontSize: 10, opacity: 0.65 }}>{services.length}</span>
              </button>
              {CATS.map(c => {
                const count = services.filter(s => s.cat === c.key).length;
                if (count === 0) return null;
                const active = cat === c.key;
                return (
                  <button key={c.key} onClick={() => setCat(c.key)} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 14px", borderRadius: 999, fontSize: 12, fontWeight: active ? 600 : 400,
                    cursor: "pointer", whiteSpace: "nowrap",
                    background: active ? `${c.color}18` : "var(--bg-ivory)",
                    color: active ? c.color : "var(--ink-3)",
                    border: active ? `1px solid ${c.color}` : "1px solid var(--line-soft)",
                  }}>
                    <span style={{ width: 13, height: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", color: active ? c.color : "var(--ink-4)" }}>{c.icon}</span>
                    {catLabel(c)}
                    <span style={{ fontSize: 10, opacity: 0.6 }}>{count}</span>
                  </button>
                );
              })}
            </>
          )}
        </div>

        {/* ── Content ── */}
        <div style={{ padding: isMob ? "16px 12px" : "24px 24px" }}>

          {view === "specialists" ? (
            /* ═══ Specialists grid ═══ */
            filteredSpecs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--ink-4)", fontSize: 13 }}>
                {lang === "ar" ? "لا يوجد نتائج" : lang === "fr" ? "Aucun résultat" : "No results found"}
              </div>
            ) : specGroup === "all" ? (
              groupedSpecs.map(g => (
                <div key={g.key} style={{ marginBottom: 36 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                    <div style={{ width: 4, height: 16, borderRadius: 2, background: g.color, flexShrink: 0 }} />
                    <div className="eyebrow" style={{ fontSize: 11, color: g.color, letterSpacing: "0.12em" }}>{grpLabel(g)}</div>
                    <span style={{ fontSize: 11, color: "var(--ink-4)", marginInlineStart: 4 }}>({g.items.length})</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                    {g.items.map(s => <SpecialistCard key={s.key} s={s} label={specLabel} desc={specDesc} tags={specTags} />)}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                {filteredSpecs.map(s => <SpecialistCard key={s.key} s={s} label={specLabel} desc={specDesc} tags={specTags} />)}
              </div>
            )
          ) : (
            /* ═══ Firms grid ═══ */
            cat === "all" ? (
              grouped.map(g => (
                <div key={g.key} style={{ marginBottom: 32 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <span style={{ color: g.color }}>{g.icon}</span>
                    <div className="eyebrow" style={{ fontSize: 11, color: g.color, letterSpacing: "0.14em" }}>{catLabel(g)}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                    {g.items.map(s => <ServiceCard key={s.url} s={s} catColor={g.color} label={label} desc={desc} />)}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                {filtered.map(s => {
                  const catMeta = CATS.find(c => c.key === s.cat)!;
                  return <ServiceCard key={s.url} s={s} catColor={catMeta.color} label={label} desc={desc} />;
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── SpecialistCard ─────────────────────────────────────────────────── */
function SpecialistCard({ s, label, desc, tags }: {
  s: Specialist;
  label: (s: Specialist) => string;
  desc:  (s: Specialist) => string;
  tags:  (s: Specialist) => string[];
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--bg-paper)",
        border: `1px solid ${hovered ? s.color : "var(--line-soft)"}`,
        borderRadius: "var(--r-md)", padding: "18px",
        transition: "border-color 0.2s, box-shadow 0.2s, transform 0.18s",
        boxShadow: hovered ? `0 4px 20px ${s.color}20` : "var(--shadow-1)",
        transform: hovered ? "translateY(-2px)" : "none",
        cursor: "default", position: "relative", overflow: "hidden",
      }}
    >
      {/* demand badge */}
      {s.demand === "high" && (
        <span style={{
          position: "absolute", top: 12, insetInlineEnd: 12,
          fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
          background: `${s.color}18`, color: s.color, letterSpacing: "0.08em",
          textTransform: "uppercase",
        }}>
          ★ Top
        </span>
      )}

      {/* Icon circle + title */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: "var(--r)",
          background: `${s.color}18`, border: `1px solid ${s.color}30`,
          display: "grid", placeItems: "center", flexShrink: 0,
          color: s.color,
        }}>
          {s.icon}
        </div>
        <div style={{ paddingTop: 2 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", lineHeight: 1.3 }}>
            {label(s)}
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.65, marginBottom: 12 }}>
        {desc(s)}
      </div>

      {/* Tags */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {tags(s).slice(0, 3).map(tag => (
          <span key={tag} style={{
            fontSize: 10.5, padding: "2px 9px", borderRadius: 999,
            background: `${s.color}12`, color: s.color,
            border: `1px solid ${s.color}25`, fontWeight: 500,
          }}>
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ─── ServiceCard ────────────────────────────────────────────────────── */
function ServiceCard({ s, catColor, label, desc }: {
  s: CService;
  catColor: string;
  label: (s: CService) => string;
  desc: (s: CService) => string;
}) {
  return (
    <a href={s.url} target="_blank" rel="noopener noreferrer"
      style={{
        display: "block", textDecoration: "none",
        background: "var(--bg-paper)",
        border: s.highlight ? `1px solid ${catColor}` : "1px solid var(--line-soft)",
        borderRadius: "var(--r)", padding: "16px 18px",
        transition: "box-shadow 0.15s, transform 0.15s",
        position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "var(--shadow-2)";
        (e.currentTarget as HTMLAnchorElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLAnchorElement).style.boxShadow = "none";
        (e.currentTarget as HTMLAnchorElement).style.transform = "none";
      }}
    >
      {s.highlight && (
        <span style={{
          position: "absolute", top: 10, insetInlineEnd: 10,
          fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
          background: `${catColor}20`, color: catColor, letterSpacing: "0.1em",
        }}>★</span>
      )}
      {s.tag && (
        <span style={{ display: "inline-block", marginBottom: 8, fontSize: 9.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${catColor}15`, color: catColor, letterSpacing: "0.08em" }}>
          {s.tag}
        </span>
      )}
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6, lineHeight: 1.3 }}>
        {label(s)}
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.6 }}>
        {desc(s)}
      </div>
      <div style={{ marginTop: 10, fontSize: 10.5, color: catColor, opacity: 0.8, display: "flex", alignItems: "center", gap: 4 }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
        {new URL(s.url).hostname.replace("www.", "")}
      </div>
    </a>
  );
}
