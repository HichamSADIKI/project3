"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Ic } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";

/* ─── Category icons ────────────────────────────────────────────────── */
const IcHopital  = () => <Ic><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></Ic>;
const IcAssur    = () => <Ic><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Ic>;
const IcUrgence  = () => <Ic><path d="M12 2v20M4.93 4.93l14.14 14.14M2 12h20M4.93 19.07 19.07 4.93"/></Ic>;
const IcSpecial  = () => <Ic><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Ic>;
const IcPharma   = () => <Ic><path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2v-4M9 21H5a2 2 0 0 1-2-2v-4m0 0h18"/></Ic>;
const IcTelemed  = () => <Ic><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M9 10l2 2 4-4"/></Ic>;

/* ─── Types ──────────────────────────────────────────────────────────── */
type CountryKey = "ae" | "sa" | "ma";
type CatKey     = "hopital" | "assur" | "urgence" | "special" | "pharma" | "telemed";

interface HService {
  name: string; name_ar: string; name_fr: string;
  desc_en: string; desc_ar: string; desc_fr: string;
  url: string; cat: CatKey; tag?: string;
  highlight?: boolean;
  phone?: string;
}

/* ─── Category meta ──────────────────────────────────────────────────── */
const CATS: { key: CatKey; en: string; ar: string; fr: string; icon: React.ReactElement; color: string }[] = [
  { key: "hopital",  en: "Hospitals & Clinics",  ar: "المستشفيات والعيادات",  fr: "Hôpitaux & Cliniques",     icon: <IcHopital />,  color: "var(--azure)" },
  { key: "assur",    en: "Health Insurance",      ar: "التأمين الصحي",          fr: "Assurance Santé",          icon: <IcAssur />,    color: "var(--emerald)" },
  { key: "urgence",  en: "Emergency",             ar: "الطوارئ والإسعاف",       fr: "Urgences & Secours",       icon: <IcUrgence />,  color: "var(--rose)" },
  { key: "special",  en: "Specialised Medicine",  ar: "الطب المتخصص",           fr: "Médecine Spécialisée",     icon: <IcSpecial />,  color: "var(--gold)" },
  { key: "pharma",   en: "Pharmacies",            ar: "الصيدليات والدواء",       fr: "Pharmacies",              icon: <IcPharma />,   color: "#8B5CF6" },
  { key: "telemed",  en: "Telemedicine",          ar: "الطب عن بُعد",            fr: "Télémédecine",            icon: <IcTelemed />,  color: "#F59E0B" },
];

/* ─── Country meta ───────────────────────────────────────────────────── */
const COUNTRIES: { key: CountryKey; flag: string; en: string; ar: string; fr: string; tagline_en: string; tagline_ar: string; tagline_fr: string }[] = [
  { key: "ae", flag: "🇦🇪", en: "UAE",     ar: "الإمارات",  fr: "EAU",
    tagline_en: "UAE — World-class healthcare in the heart of the Gulf",
    tagline_ar: "الإمارات — رعاية صحية عالمية في قلب الخليج",
    tagline_fr: "EAU — Santé de classe mondiale au cœur du Golfe" },
  { key: "sa", flag: "🇸🇦", en: "KSA",     ar: "المملكة",   fr: "Arabie Saoudite",
    tagline_en: "KSA — Advancing healthcare through Vision 2030",
    tagline_ar: "المملكة — تطوير الرعاية الصحية عبر رؤية 2030",
    tagline_fr: "KSA — La santé au cœur de Vision 2030" },
  { key: "ma", flag: "🇲🇦", en: "Morocco",  ar: "المغرب",    fr: "Maroc",
    tagline_en: "Morocco — Healthcare reform and universal coverage",
    tagline_ar: "المغرب — إصلاح الصحة والتغطية الشاملة",
    tagline_fr: "Maroc — Réforme de la santé et couverture universelle" },
];

/* ─── KPIs ───────────────────────────────────────────────────────────── */
const KPIS: Record<CountryKey, { n: string; en: string; ar: string; fr: string }[]> = {
  ae: [
    { n: "170+", en: "Hospitals",        ar: "مستشفى",           fr: "Hôpitaux" },
    { n: "96%",  en: "Insurance coverage",ar: "تغطية تأمينية",   fr: "Couverture assurance" },
    { n: "30",   en: "Min avg response", ar: "دقيقة استجابة",    fr: "Min réponse moy." },
    { n: "#1",   en: "ME medical hub",   ar: "مركز طبي في الشرق الأوسط", fr: "Hub médical ME" },
  ],
  sa: [
    { n: "500+", en: "Hospitals",        ar: "مستشفى",           fr: "Hôpitaux" },
    { n: "98%",  en: "Coverage Vision 2030", ar: "تغطية رؤية 2030", fr: "Couverture Vision 2030" },
    { n: "911",  en: "Emergency number", ar: "رقم الطوارئ",      fr: "Numéro urgence" },
    { n: "70%",  en: "Digital health goal", ar: "هدف الصحة الرقمية", fr: "Objectif santé digitale" },
  ],
  ma: [
    { n: "2,900",en: "Public facilities",ar: "منشأة عامة",       fr: "Établissements publics" },
    { n: "AMO",  en: "Mandatory insurance",ar: "التأمين الإلزامي", fr: "Assurance obligatoire" },
    { n: "15",   en: "SAMU number",      ar: "رقم المستعجلات",   fr: "Numéro SAMU" },
    { n: "2026", en: "Universal coverage target", ar: "هدف التغطية الشاملة", fr: "Cible couverture univ." },
  ],
};

/* ─── Service data ───────────────────────────────────────────────────── */
const SERVICES: Record<CountryKey, HService[]> = {
  ae: [
    /* Hôpitaux */
    { cat: "hopital", highlight: true, tag: "Abu Dhabi",
      name: "Cleveland Clinic Abu Dhabi", name_ar: "كليفلاند كلينك أبوظبي", name_fr: "Cleveland Clinic Abu Dhabi",
      url: "https://www.clevelandclinicabudhabi.ae",
      desc_en: "World-renowned US-standard hospital — cardiology, neurology and oncology centres of excellence.",
      desc_ar: "مستشفى أمريكي المستوى — مراكز تميّز في القلب والأعصاب والأورام.",
      desc_fr: "Hôpital de renommée mondiale — centres d'excellence cardiologie, neurologie et oncologie." },
    { cat: "hopital", tag: "Dubai",
      name: "American Hospital Dubai", name_ar: "المستشفى الأمريكي دبي", name_fr: "American Hospital Dubai",
      url: "https://www.ahdubai.com",
      desc_en: "First JCI-accredited hospital in the Middle East — comprehensive medical care in Dubai.",
      desc_ar: "أول مستشفى معتمد من JCI في الشرق الأوسط — رعاية طبية شاملة في دبي.",
      desc_fr: "Premier hôpital accrédité JCI au Moyen-Orient — soins complets à Dubaï." },
    { cat: "hopital", tag: "Multi-emirats",
      name: "Mediclinic Middle East", name_ar: "ميديكلينيك الشرق الأوسط", name_fr: "Mediclinic Middle East",
      url: "https://www.mediclinic.ae",
      desc_en: "Leading private hospital group — 6 hospitals and 28+ clinics across UAE.",
      desc_ar: "مجموعة مستشفيات خاصة رائدة — 6 مستشفيات وأكثر من 28 عيادة في الإمارات.",
      desc_fr: "Groupe hospitalier privé leader — 6 hôpitaux et 28+ cliniques aux EAU." },
    { cat: "hopital", tag: "Multi-emirats",
      name: "NMC Healthcare", name_ar: "مجموعة NMC الصحية", name_fr: "NMC Healthcare",
      url: "https://www.nmc.ae",
      desc_en: "Largest private healthcare network in UAE — 200+ facilities across the Emirates.",
      desc_ar: "أكبر شبكة رعاية صحية خاصة في الإمارات — أكثر من 200 منشأة.",
      desc_fr: "Plus grand réseau de santé privé aux EAU — 200+ établissements." },
    { cat: "hopital", tag: "Multi-emirats",
      name: "Aster Hospitals UAE", name_ar: "مستشفيات أستر الإمارات", name_fr: "Aster Hospitals UAE",
      url: "https://www.asterhospitals.ae",
      desc_en: "Affordable quality care — hospitals and clinics across Dubai, Abu Dhabi and Northern Emirates.",
      desc_ar: "رعاية جيدة بأسعار معقولة — مستشفيات وعيادات في دبي وأبوظبي والإمارات الشمالية.",
      desc_fr: "Soins de qualité abordables — hôpitaux et cliniques à Dubaï, Abu Dhabi et émirats du Nord." },
    /* Assurance */
    { cat: "assur", highlight: true, tag: "Abu Dhabi",
      name: "DAMAN — National Health Insurance", name_ar: "ضمان — التأمين الصحي الوطني", name_fr: "DAMAN Assurance Santé",
      url: "https://www.damanhealth.ae",
      desc_en: "Abu Dhabi's largest health insurer — Thiqa (UAE nationals) and Daman Enhanced plans.",
      desc_ar: "أكبر شركة تأمين صحي في أبوظبي — ثيقة للمواطنين وخطط ضمان المعززة.",
      desc_fr: "Principal assureur santé d'Abu Dhabi — Thiqa (nationaux) et plans Daman Enhanced." },
    { cat: "assur", tag: "Dubai",
      name: "DHA — Mandatory Health Insurance", name_ar: "هيئة الصحة دبي — التأمين الإلزامي", name_fr: "DHA Assurance Obligatoire",
      url: "https://www.dha.gov.ae/en/dhaportal/patient-rights/health-insurance",
      desc_en: "Mandatory health insurance in Dubai — Essential Benefits Plan (EBP) for low-income workers.",
      desc_ar: "التأمين الصحي الإلزامي في دبي — خطة المزايا الأساسية للعمال ذوي الدخل المنخفض.",
      desc_fr: "Assurance maladie obligatoire à Dubaï — Plan de prestations essentielles (EBP)." },
    { cat: "assur", tag: "Régional",
      name: "Bupa Global Middle East", name_ar: "بوبا الشرق الأوسط", name_fr: "Bupa Global Moyen-Orient",
      url: "https://www.bupaarabia.com.sa",
      desc_en: "International health insurance — premium expat plans covering UAE, KSA and global care.",
      desc_ar: "تأمين صحي دولي — خطط مميزة للمغتربين تغطي الإمارات والمملكة والرعاية العالمية.",
      desc_fr: "Assurance santé internationale — plans premium expatriés couvrant EAU, KSA et soins mondiaux." },
    /* Urgences */
    { cat: "urgence", highlight: true, tag: "Dubai",
      name: "DHA Emergency Services — 998", name_ar: "طوارئ هيئة الصحة دبي — 998", name_fr: "Urgences DHA — 998",
      url: "https://www.dha.gov.ae", phone: "998",
      desc_en: "Dubai ambulance and emergency medical services — 24/7 rapid response. Call 998.",
      desc_ar: "سيارات إسعاف وخدمات الطوارئ في دبي — استجابة سريعة على مدار الساعة. اتصل 998.",
      desc_fr: "Ambulances et services d'urgence Dubaï — intervention rapide 24h/24. Appelez le 998." },
    { cat: "urgence", tag: "Abu Dhabi",
      name: "ADCD Emergency — 999", name_ar: "طوارئ أبوظبي — 999", name_fr: "Urgences Abu Dhabi — 999",
      url: "https://www.adcd.gov.ae", phone: "999",
      desc_en: "Abu Dhabi Civil Defence and emergency services. Police, ambulance, fire brigade: 999.",
      desc_ar: "الدفاع المدني وخدمات الطوارئ في أبوظبي. الشرطة والإسعاف والإطفاء: 999.",
      desc_fr: "Défense civile et urgences Abu Dhabi. Police, ambulance, pompiers : 999." },
    /* Spécialisé */
    { cat: "special", tag: "Dubai",
      name: "King's College Hospital Dubai", name_ar: "مستشفى كينجز كوليدج دبي", name_fr: "King's College Hospital Dubai",
      url: "https://www.kingscollegehospital.ae",
      desc_en: "London NHS-standard hospital — neurosciences, oncology, haematology and complex surgery.",
      desc_ar: "مستشفى بمعايير NHS اللندنية — علم الأعصاب والأورام وأمراض الدم والجراحة المعقدة.",
      desc_fr: "Hôpital aux standards NHS londonniens — neurosciences, oncologie, hématologie." },
    { cat: "special", tag: "Dubai",
      name: "Moorfields Eye Hospital Dubai", name_ar: "مستشفى مورفيلدز للعيون دبي", name_fr: "Moorfields Eye Hospital",
      url: "https://www.moorfields.ae",
      desc_en: "World's leading ophthalmology centre — LASIK, retinal surgery and paediatric eye care.",
      desc_ar: "مركز طب العيون الرائد عالمياً — ليزك وجراحة الشبكية ورعاية العيون للأطفال.",
      desc_fr: "Centre ophtalmologique mondial leader — LASIK, chirurgie rétinienne et pédiatrie." },
    /* Pharmacies */
    { cat: "pharma", tag: "Multi-emirats",
      name: "Aster Pharmacy", name_ar: "صيدلية أستر", name_fr: "Aster Pharmacy",
      url: "https://www.asterpharmacy.ae",
      desc_en: "400+ branches across UAE — 24/7 locations, online ordering and home delivery.",
      desc_ar: "أكثر من 400 فرع في جميع أنحاء الإمارات — مواقع على مدار الساعة وتوصيل للمنزل.",
      desc_fr: "400+ succursales aux EAU — ouvert 24h/24, commande en ligne et livraison à domicile." },
    { cat: "pharma", tag: "Multi-emirats",
      name: "Life Pharmacy", name_ar: "لايف فارمسي", name_fr: "Life Pharmacy",
      url: "https://www.lifepharmacy.com",
      desc_en: "UAE's largest pharmacy chain — 200+ stores, online shop and consultation services.",
      desc_ar: "أكبر سلسلة صيدليات في الإمارات — أكثر من 200 متجر وتسوق إلكتروني واستشارات.",
      desc_fr: "Plus grande chaîne de pharmacies EAU — 200+ magasins, boutique en ligne et consultations." },
    /* Télémédecine */
    { cat: "telemed", highlight: true, tag: "Abu Dhabi",
      name: "SEHA Virtual Hospital", name_ar: "مستشفى صحة الافتراضي", name_fr: "SEHA Virtual Hospital",
      url: "https://svh.com.sa",
      desc_en: "Abu Dhabi's telehealth platform — video consultations with specialists, 24/7.",
      desc_ar: "منصة الصحة الرقمية في أبوظبي — استشارات مرئية مع متخصصين على مدار الساعة.",
      desc_fr: "Plateforme de télésanté d'Abu Dhabi — consultations vidéo avec des spécialistes 24h/24." },
    { cat: "telemed", tag: "Multi-emirats",
      name: "Okadoc", name_ar: "أوكادوك", name_fr: "Okadoc",
      url: "https://www.okadoc.com",
      desc_en: "UAE's leading health-tech platform — book appointments, video consults and health records.",
      desc_ar: "منصة التقنية الصحية الرائدة في الإمارات — حجز مواعيد واستشارات مرئية وسجلات صحية.",
      desc_fr: "Plateforme healthtech leader EAU — rendez-vous en ligne, téléconsultation et dossier santé." },
  ],

  sa: [
    /* Hôpitaux */
    { cat: "hopital", highlight: true, tag: "Riyadh",
      name: "King Faisal Specialist Hospital", name_ar: "مستشفى الملك فيصل التخصصي", name_fr: "King Faisal Specialist Hospital",
      url: "https://www.kfshrc.edu.sa",
      desc_en: "Saudi Arabia's leading research hospital — organ transplant, oncology and rare diseases.",
      desc_ar: "المستشفى البحثي الرائد في المملكة — زراعة الأعضاء والأورام والأمراض النادرة.",
      desc_fr: "Principal hôpital de recherche d'Arabie Saoudite — transplantation, oncologie et maladies rares." },
    { cat: "hopital", tag: "Riyadh",
      name: "King Abdulaziz Medical City", name_ar: "مدينة الملك عبدالعزيز الطبية", name_fr: "King Abdulaziz Medical City",
      url: "https://www.ngha.med.sa",
      desc_en: "National Guard health system — multi-specialty complex serving Saudi Armed Forces.",
      desc_ar: "نظام صحة الحرس الوطني — مجمع متعدد التخصصات يخدم القوات المسلحة السعودية.",
      desc_fr: "Système de santé de la Garde Nationale — complexe multispécialités pour les forces armées." },
    { cat: "hopital", tag: "Multi-villes",
      name: "Saudi German Hospitals", name_ar: "المستشفيات السعودية الألمانية", name_fr: "Saudi German Hospitals",
      url: "https://www.sghgroup.com",
      desc_en: "Largest private hospital group in MENA — Riyadh, Jeddah, Madinah and Dammam.",
      desc_ar: "أكبر مجموعة مستشفيات خاصة في منطقة الشرق الأوسط وأفريقيا.",
      desc_fr: "Plus grand groupe hospitalier privé MENA — Riyad, Jeddah, Médine et Dammam." },
    { cat: "hopital", tag: "Riyadh",
      name: "Johns Hopkins Aramco Healthcare", name_ar: "جونز هوبكنز أرامكو", name_fr: "Johns Hopkins Aramco",
      url: "https://www.jhah.com",
      desc_en: "Johns Hopkins-affiliated hospital — primary and specialised care for Aramco employees and community.",
      desc_ar: "مستشفى بالتعاون مع جونز هوبكنز — رعاية أولية ومتخصصة لموظفي أرامكو.",
      desc_fr: "Hôpital affilié Johns Hopkins — soins primaires et spécialisés pour Aramco et communauté." },
    /* Assurance */
    { cat: "assur", highlight: true, tag: "National",
      name: "CCHI — Council of Cooperative Health Insurance", name_ar: "مجلس الضمان الصحي التعاوني", name_fr: "CCHI",
      url: "https://www.cchi.gov.sa",
      desc_en: "Mandatory health insurance regulator — policy oversight, claims and provider network.",
      desc_ar: "المنظم للتأمين الصحي الإلزامي — الإشراف على الوثائق والمطالبات وشبكة المزودين.",
      desc_fr: "Régulateur de l'assurance maladie obligatoire — contrôle des polices et réseau prestataires." },
    { cat: "assur", tag: "National",
      name: "Bupa Arabia", name_ar: "بوبا العربية", name_fr: "Bupa Arabia",
      url: "https://www.bupaarabia.com.sa",
      desc_en: "Saudi Arabia's largest private health insurer — corporate and individual health plans.",
      desc_ar: "أكبر شركة تأمين صحي خاص في المملكة — خطط صحية للشركات والأفراد.",
      desc_fr: "Plus grand assureur santé privé d'Arabie Saoudite — plans entreprises et individuels." },
    { cat: "assur", tag: "National",
      name: "MedGulf Insurance", name_ar: "مدغلف للتأمين", name_fr: "MedGulf Insurance",
      url: "https://www.medgulf.com.sa",
      desc_en: "Leading health insurance provider — SME plans, maternity and dental coverage.",
      desc_ar: "مزود تأمين صحي رائد — خطط للشركات الصغيرة والتوليد وتغطية الأسنان.",
      desc_fr: "Assureur santé majeur — plans PME, maternité et couverture dentaire." },
    /* Urgences */
    { cat: "urgence", highlight: true, tag: "National",
      name: "Saudi Red Crescent — 911", name_ar: "الهلال الأحمر السعودي — 911", name_fr: "Croissant-Rouge Saoudien — 911",
      url: "https://www.srca.org.sa", phone: "911",
      desc_en: "National emergency response — ambulance, rescue and disaster relief. Call 911.",
      desc_ar: "الاستجابة الطارئة الوطنية — إسعاف وإنقاذ وإغاثة الكوارث. اتصل 911.",
      desc_fr: "Urgences nationales — ambulance, secours et aide en cas de catastrophe. Appelez le 911." },
    { cat: "urgence", tag: "National",
      name: "MOH Emergency Hotline", name_ar: "خط طوارئ وزارة الصحة", name_fr: "Hotline Urgences MOH",
      url: "https://www.moh.gov.sa", phone: "937",
      desc_en: "Ministry of Health 24/7 health hotline — medical guidance, hospital referral and emergencies.",
      desc_ar: "خط صحي 24 ساعة لوزارة الصحة — إرشاد طبي وإحالة المستشفى والطوارئ.",
      desc_fr: "Hotline santé 24h/24 du Ministère — conseil médical, orientation hôpital et urgences." },
    /* Spécialisé */
    { cat: "special", tag: "Riyadh",
      name: "King Hussein Cancer Center (KSA partner)", name_ar: "مركز الملك حسين للسرطان", name_fr: "Centre du Cancer KH",
      url: "https://www.ncccr.med.sa",
      desc_en: "National Cancer Control Program — screening, treatment and research across Saudi Arabia.",
      desc_ar: "البرنامج الوطني لمكافحة السرطان — الفحص والعلاج والبحث في المملكة.",
      desc_fr: "Programme national de lutte contre le cancer — dépistage, traitement et recherche." },
    { cat: "special", tag: "Riyadh",
      name: "Prince Sultan Cardiac Center", name_ar: "مركز الأمير سلطان لأمراض القلب", name_fr: "Centre Cardiaque Prince Sultan",
      url: "https://www.ngha.med.sa",
      desc_en: "Cardiology centre of excellence — cardiac surgery, catheterisation and paediatric cardiology.",
      desc_ar: "مركز تميّز لأمراض القلب — جراحة القلب والقسطرة وأمراض قلب الأطفال.",
      desc_fr: "Centre d'excellence cardiologie — chirurgie cardiaque, cathétérisme et cardiologie pédiatrique." },
    /* Pharmacies */
    { cat: "pharma", tag: "National",
      name: "Nahdi Medical Company", name_ar: "النهدي للصيدليات", name_fr: "Nahdi Pharmacies",
      url: "https://www.nahdionline.com",
      desc_en: "Saudi Arabia's largest pharmacy chain — 1,000+ stores, online ordering and delivery.",
      desc_ar: "أكبر سلسلة صيدليات في المملكة — أكثر من 1000 متجر وطلب عبر الإنترنت وتوصيل.",
      desc_fr: "Plus grande chaîne de pharmacies d'Arabie Saoudite — 1 000+ magasins et livraison." },
    { cat: "pharma", tag: "National",
      name: "Al-Dawaa Pharmacies", name_ar: "صيدليات الدواء", name_fr: "Al-Dawaa Pharmacies",
      url: "https://www.aldawaa.com",
      desc_en: "National pharmacy chain — prescription filling, wellness products and health screenings.",
      desc_ar: "سلسلة صيدليات وطنية — صرف الوصفات ومنتجات العافية وفحوصات الصحة.",
      desc_fr: "Chaîne nationale — délivrance d'ordonnances, produits bien-être et bilans de santé." },
    /* Télémédecine */
    { cat: "telemed", highlight: true, tag: "National",
      name: "Seha Virtual Hospital (SVH)", name_ar: "مستشفى صحة الافتراضي", name_fr: "Seha Virtual Hospital",
      url: "https://svh.com.sa",
      desc_en: "World's largest virtual hospital — 150+ specialists, connecting 35 hospitals digitally.",
      desc_ar: "أكبر مستشفى افتراضي في العالم — أكثر من 150 متخصص يربط 35 مستشفى رقمياً.",
      desc_fr: "Plus grand hôpital virtuel au monde — 150+ spécialistes reliant 35 hôpitaux numériquement." },
    { cat: "telemed", tag: "National",
      name: "Sehha App — MOH", name_ar: "تطبيق صحتي", name_fr: "Application Sehha",
      url: "https://www.moh.gov.sa/en/eServices/Pages/Sehha-App.aspx",
      desc_en: "Ministry of Health official app — AI symptom checker, doctor chat and nearest clinic finder.",
      desc_ar: "تطبيق وزارة الصحة الرسمي — فحص الأعراض بالذكاء الاصطناعي ودردشة الطبيب.",
      desc_fr: "Application officielle du Ministère — symptômes IA, chat médecin et clinique la plus proche." },
  ],

  ma: [
    /* Hôpitaux */
    { cat: "hopital", highlight: true, tag: "Rabat",
      name: "CHU Ibn Sina Rabat", name_ar: "المستشفى الجامعي ابن سينا الرباط", name_fr: "CHU Ibn Sina Rabat",
      url: "https://www.chu-ibnsina.ma",
      desc_en: "Leading university hospital — national reference centre for cardiology, neurology and surgery.",
      desc_ar: "المستشفى الجامعي الرائد — مرجع وطني في القلب والأعصاب والجراحة.",
      desc_fr: "CHU de référence nationale — cardiologie, neurologie et chirurgie complexe." },
    { cat: "hopital", tag: "Casablanca",
      name: "CHU Ibn Rochd Casablanca", name_ar: "المستشفى الجامعي ابن رشد الدار البيضاء", name_fr: "CHU Ibn Rochd Casablanca",
      url: "https://www.chuibnrochd.ma",
      desc_en: "Largest public hospital complex in Morocco — trauma, oncology and specialised medicine.",
      desc_ar: "أكبر مجمع مستشفيات عامة في المغرب — صدمات وأورام وطب متخصص.",
      desc_fr: "Plus grand complexe hospitalier public du Maroc — traumatologie, oncologie et spécialités." },
    { cat: "hopital", tag: "Casablanca",
      name: "Clinique du Parc", name_ar: "عيادة دو باك", name_fr: "Clinique du Parc",
      url: "https://www.cliniqueduparc.ma",
      desc_en: "Leading private clinic in Casablanca — cardiology, gynaecology and advanced imaging.",
      desc_ar: "العيادة الخاصة الرائدة في الدار البيضاء — قلب وأمراض النساء وتصوير متطور.",
      desc_fr: "Clinique privée leader à Casablanca — cardiologie, gynécologie et imagerie avancée." },
    { cat: "hopital", tag: "Marrakech",
      name: "Hôpital Ibn Tofail Marrakech", name_ar: "مستشفى ابن طفيل مراكش", name_fr: "Hôpital Ibn Tofail",
      url: "https://www.sante.gov.ma",
      desc_en: "Public hospital serving Marrakech-Safi region — emergency, maternity and specialised units.",
      desc_ar: "مستشفى عام يخدم جهة مراكش-آسفي — طوارئ وتوليد وأقسام متخصصة.",
      desc_fr: "Hôpital public région Marrakech-Safi — urgences, maternité et unités spécialisées." },
    /* Assurance */
    { cat: "assur", highlight: true, tag: "National",
      name: "AMO — Assurance Maladie Obligatoire", name_ar: "التأمين الإجباري عن المرض", name_fr: "AMO",
      url: "https://www.cnss.ma",
      desc_en: "Mandatory health insurance managed by CNSS — covering private-sector employees.",
      desc_ar: "التأمين الصحي الإجباري بإدارة CNSS — يغطي موظفي القطاع الخاص.",
      desc_fr: "Assurance maladie obligatoire gérée par la CNSS — salariés du secteur privé." },
    { cat: "assur", tag: "National",
      name: "CNOPS", name_ar: "الصندوق الوطني لمنظمات الاحتياط الاجتماعي", name_fr: "CNOPS",
      url: "https://www.cnops.org.ma",
      desc_en: "Health coverage for civil servants and public employees — reimbursement and mutual aid.",
      desc_ar: "التغطية الصحية للموظفين المدنيين والعاملين في القطاع العام.",
      desc_fr: "Couverture maladie des fonctionnaires et agents publics — remboursements et mutualité." },
    { cat: "assur", tag: "National",
      name: "RMA Assurance", name_ar: "RMA للتأمين", name_fr: "RMA Assurance",
      url: "https://www.rma.ma",
      desc_en: "Leading Moroccan private insurer — individual and group health plans, dental and hospitalisation.",
      desc_ar: "شركة التأمين الخاصة الرائدة في المغرب — خطط صحية فردية وجماعية وتأمين الأسنان.",
      desc_fr: "Premier assureur privé marocain — plans santé individuels et collectifs, dentaire et hospitalisation." },
    /* Urgences */
    { cat: "urgence", highlight: true, tag: "National",
      name: "SAMU Maroc — 15", name_ar: "المستعجلات الطبية المغربية — 15", name_fr: "SAMU Maroc — 15",
      url: "https://www.sante.gov.ma", phone: "15",
      desc_en: "National emergency medical service — ambulance, triage and hospital transfer. Call 15.",
      desc_ar: "خدمة الطوارئ الطبية الوطنية — إسعاف وفرز ونقل إلى المستشفى. اتصل 15.",
      desc_fr: "Service d'aide médicale urgente — ambulance, triage et transfert hospitalier. Appelez le 15." },
    { cat: "urgence", tag: "National",
      name: "Protection Civile — 150", name_ar: "الوقاية المدنية — 150", name_fr: "Protection Civile — 150",
      url: "https://www.royalairforce.gov.ma", phone: "150",
      desc_en: "Civil protection emergency services — fire, rescue and medical first response. Call 150.",
      desc_ar: "خدمات الوقاية المدنية الطارئة — حرائق وإنقاذ وإسعافات أولية. اتصل 150.",
      desc_fr: "Secours civils — incendie, sauvetage et premiers secours médicaux. Appelez le 150." },
    /* Spécialisé */
    { cat: "special", tag: "Rabat",
      name: "Institut National d'Oncologie", name_ar: "المعهد الوطني للأورام الرباط", name_fr: "Institut National d'Oncologie",
      url: "https://www.sante.gov.ma",
      desc_en: "National cancer reference institution — radiotherapy, chemotherapy and oncological surgery.",
      desc_ar: "المؤسسة الوطنية المرجعية للسرطان — علاج إشعاعي وكيميائي وجراحة الأورام.",
      desc_fr: "Institution nationale de référence oncologique — radiothérapie, chimiothérapie et chirurgie." },
    { cat: "special", tag: "Casablanca",
      name: "Centre Hospitalier Ibn Khatib", name_ar: "المستشفى ابن الخطيب", name_fr: "CH Ibn Khatib",
      url: "https://www.sante.gov.ma",
      desc_en: "Specialist psychiatry hospital — mental health, addiction treatment and neurological disorders.",
      desc_ar: "مستشفى متخصص في الطب النفسي — الصحة النفسية وعلاج الإدمان والاضطرابات العصبية.",
      desc_fr: "Hôpital spécialisé psychiatrie — santé mentale, addictologie et troubles neurologiques." },
    /* Pharmacies */
    { cat: "pharma", tag: "National",
      name: "ONEM — Médicaments essentiels", name_ar: "المكتب الوطني للأدوية الأساسية", name_fr: "ONEM",
      url: "https://www.sante.gov.ma",
      desc_en: "National office for essential medicines — price regulation and pharmacy licensing in Morocco.",
      desc_ar: "المكتب الوطني للأدوية الأساسية — تنظيم الأسعار وترخيص الصيدليات في المغرب.",
      desc_fr: "Office national des médicaments — régulation des prix et licences pharmacies au Maroc." },
    { cat: "pharma", tag: "National",
      name: "Pharmacies de Garde Maroc", name_ar: "صيدليات المناوبة المغرب", name_fr: "Pharmacies de Garde",
      url: "https://www.pharmaciesmaroc.ma",
      desc_en: "Nationwide on-duty pharmacy locator — find the nearest open pharmacy 24/7.",
      desc_ar: "محدد صيدليات المناوبة على مستوى وطني — ابحث عن أقرب صيدلية مفتوحة 24 ساعة.",
      desc_fr: "Localisateur des pharmacies de garde à l'échelle nationale — pharmacie ouverte 24h/24." },
    /* Télémédecine */
    { cat: "telemed", highlight: true, tag: "National",
      name: "Dabadoc", name_ar: "دابادوك", name_fr: "Dabadoc",
      url: "https://www.dabadoc.com",
      desc_en: "Morocco's leading doctor appointment platform — book online, teleconsultation and reminders.",
      desc_ar: "منصة المغرب الرائدة لحجز مواعيد الأطباء — حجز عبر الإنترنت واستشارات عن بُعد.",
      desc_fr: "Leader marocain de la prise de rendez-vous — consultation en ligne et rappels automatiques." },
    { cat: "telemed", tag: "National",
      name: "Hakimak", name_ar: "حكيمك", name_fr: "Hakimak",
      url: "https://www.hakimak.ma",
      desc_en: "Moroccan telehealth platform — immediate video consultations with certified doctors.",
      desc_ar: "منصة الصحة الرقمية المغربية — استشارات مرئية فورية مع أطباء معتمدين.",
      desc_fr: "Plateforme de téléconsultation marocaine — consultations vidéo immédiates avec médecins certifiés." },
  ],
};

/* ─── Card ───────────────────────────────────────────────────────────── */
function HealthCard({ s, lang, isMob }: { s: HService; lang: string; isMob: boolean }) {
  const cat = CATS.find(c => c.key === s.cat)!;
  const name = lang === "ar" ? s.name_ar : lang === "fr" ? s.name_fr : s.name;
  const desc = lang === "ar" ? s.desc_ar : lang === "fr" ? s.desc_fr : s.desc_en;
  return (
    <div style={{
      padding: isMob ? 14 : 18,
      background: s.highlight ? `color-mix(in srgb, ${cat.color} 5%, var(--bg-paper))` : "var(--bg-paper)",
      border: s.highlight ? `1px solid color-mix(in srgb, ${cat.color} 30%, transparent)` : "1px solid var(--line-soft)",
      borderRadius: "var(--r)",
      display: "flex", flexDirection: "column", gap: 12,
      transition: "box-shadow 0.15s",
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
          background: `color-mix(in srgb, ${cat.color} 14%, transparent)`,
          border: `1px solid color-mix(in srgb, ${cat.color} 28%, transparent)`,
          display: "grid", placeItems: "center", color: cat.color,
        }}>{cat.icon}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
            <div className={lang === "ar" ? "font-ar" : undefined}
              style={{ fontSize: lang === "ar" ? 13.5 : 13, fontWeight: 600, lineHeight: 1.3 }}>{name}</div>
            {s.highlight && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 999, background: cat.color, color: "#fff", fontWeight: 600, flexShrink: 0, marginTop: 2 }}>★</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            {s.tag && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "var(--bg-inset)", color: "var(--ink-4)", border: "1px solid var(--line-soft)" }}>{s.tag}</span>}
            {s.phone && <span style={{ fontSize: 10, padding: "1px 8px", borderRadius: 999, background: "var(--rose)", color: "#fff", fontWeight: 700 }}>☎ {s.phone}</span>}
          </div>
        </div>
      </div>
      <div className={lang === "ar" ? "font-ar" : undefined}
        style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.55, flex: 1 }}>{desc}</div>
      <a href={s.url} target="_blank" rel="noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "7px 14px", borderRadius: "var(--r-sm)",
          background: "var(--bg-inset)", border: "1px solid var(--line-soft)",
          fontSize: 12, fontWeight: 500, color: "var(--ink-2)",
          textDecoration: "none", cursor: "pointer", transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = cat.color; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = cat.color; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-inset)"; e.currentTarget.style.color = "var(--ink-2)"; e.currentTarget.style.borderColor = "var(--line-soft)"; }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        {lang === "ar" ? "زيارة" : lang === "fr" ? "Accéder" : "Visit"}
      </a>
    </div>
  );
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
export function ScreenSante() {
  const { lang } = useLang();
  const bp    = useBreakpoint();
  const isMob = bp === "mobile";
  const isTab = bp === "tablet";

  const [country, setCountry] = useState<CountryKey>("ae");
  const [cat,     setCat]     = useState<CatKey | "all">("all");

  const countryMeta = COUNTRIES.find(c => c.key === country)!;
  const services    = SERVICES[country];
  const filtered    = cat === "all" ? services : services.filter(s => s.cat === cat);
  const kpis        = KPIS[country];

  const tagline  = lang === "ar" ? countryMeta.tagline_ar : lang === "fr" ? countryMeta.tagline_fr : countryMeta.tagline_en;
  const catLabel = (c: typeof CATS[0]) => lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en;
  const cols     = isMob ? "1fr" : isTab ? "repeat(2, 1fr)" : "repeat(3, 1fr)";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar
        title={lang === "ar" ? "الصحة" : lang === "fr" ? "Santé" : "Health"}
        crumb={isMob ? [] : [
          countryMeta.flag + " " + (lang === "ar" ? countryMeta.ar : lang === "fr" ? countryMeta.fr : countryMeta.en),
          `${filtered.length} ${lang === "fr" ? "services" : lang === "ar" ? "خدمة" : "services"}`,
        ]}
      />

      <main style={{ flex: 1, padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 18, background: "var(--bg-cream)", overflow: "auto" }}>

        {/* Hero */}
        <div className="sgi-card-elevated" style={{
          padding: isMob ? 18 : 28,
          background: "linear-gradient(135deg, #0A2342 0%, #0D5C3A 100%)",
          color: "var(--bg-ivory)", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", insetInlineEnd: -10, top: -10, fontSize: isMob ? 90 : 130, opacity: 0.15, lineHeight: 1 }}>
            {countryMeta.flag}
          </div>
          <Eyebrow style={{ color: "#6EE7B7" }}>
            {lang === "ar" ? "الرعاية الصحية والطب" : lang === "fr" ? "Santé & Médecine" : "Health & Medical Care"}
          </Eyebrow>
          <div className="font-display" style={{ fontSize: isMob ? 20 : 30, marginTop: 8, lineHeight: 1.25 }}>{tagline}</div>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: isMob ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
            {kpis.map((k, i) => (
              <div key={i} style={{ padding: isMob ? "8px 10px" : "12px 14px", background: "rgba(110,231,183,0.10)", borderInlineStart: "2px solid #6EE7B7", borderRadius: 4 }}>
                <div className="font-display tnum" style={{ fontSize: isMob ? 18 : 22, color: "#6EE7B7" }}>{k.n}</div>
                <div style={{ fontSize: 10, letterSpacing: "0.07em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginTop: 2 }}>
                  {lang === "ar" ? k.ar : lang === "fr" ? k.fr : k.en}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COUNTRIES.map(c => (
              <button key={c.key} onClick={() => { setCountry(c.key); setCat("all"); }}
                style={{
                  padding: isMob ? "7px 12px" : "9px 16px", borderRadius: "var(--r)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 8,
                  background: c.key === country ? "#6EE7B7" : "rgba(255,255,255,0.10)",
                  color: c.key === country ? "#0A2342" : "var(--bg-ivory)",
                  border: c.key === country ? "1px solid #6EE7B7" : "1px solid rgba(255,255,255,0.18)",
                  transition: "all 0.18s",
                }}>
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span>{lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{ key: "all" as const, en: "All", ar: "الكل", fr: "Tous", color: "var(--ink-3)" }, ...CATS].map(c => {
            const isActive = cat === c.key;
            const color    = "color" in c ? c.color : "var(--ink-3)";
            const label    = lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en;
            return (
              <button key={c.key} onClick={() => setCat(c.key as CatKey | "all")}
                style={{
                  padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 6,
                  background: isActive ? color : "var(--bg-paper)",
                  color: isActive ? "#fff" : "var(--ink-3)",
                  border: `1px solid ${isActive ? color : "var(--line-soft)"}`,
                  transition: "all 0.15s",
                }}>
                {"icon" in c && <span style={{ width: 14, height: 14, display: "grid", placeItems: "center" }}>{c.icon}</span>}
                {label}
                <span style={{ fontSize: 10, opacity: 0.8 }}>
                  {c.key === "all" ? services.length : services.filter(s => s.cat === c.key).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Content */}
        {cat === "all" ? (
          CATS.map(catItem => {
            const items = services.filter(s => s.cat === catItem.key);
            if (!items.length) return null;
            return (
              <section key={catItem.key}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `color-mix(in srgb, ${catItem.color} 15%, transparent)`, display: "grid", placeItems: "center", color: catItem.color }}>
                    {catItem.icon}
                  </div>
                  <div>
                    <div className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: 16, fontWeight: 600 }}>{catLabel(catItem)}</div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{items.length} services</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>
                  {items.map((s, i) => <HealthCard key={i} s={s} lang={lang} isMob={isMob} />)}
                </div>
              </section>
            );
          })
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>
            {filtered.map((s, i) => <HealthCard key={i} s={s} lang={lang} isMob={isMob} />)}
          </div>
        )}

      </main>
    </div>
  );
}
