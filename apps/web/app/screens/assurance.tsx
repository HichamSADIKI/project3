"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Ic } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";

/* ─── Category icons ────────────────────────────────────────────────── */
const IcRegul  = () => <Ic><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></Ic>;
const IcSante3 = () => <Ic><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M12 8v8M9 12h6"/></Ic>;
const IcAuto   = () => <Ic><path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3.7L8 4h8l1.3 3H21a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></Ic>;
const IcHabita = () => <Ic><path d="M3 21V10l9-7 9 7v11"/><path d="M9 21v-7h6v7"/></Ic>;
const IcVie    = () => <Ic><path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.7l-1.06-1.1a5.5 5.5 0 0 0-7.78 7.8l1.06 1L12 21l7.78-7.6 1.06-1a5.5 5.5 0 0 0 0-7.8z"/></Ic>;
const IcBiz2   = () => <Ic><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M12 12v5M9.5 12H15"/></Ic>;

/* ─── Types ──────────────────────────────────────────────────────────── */
type CountryKey = "ae" | "sa" | "ma";
type CatKey     = "regul" | "sante" | "auto" | "habita" | "vie" | "biz";

interface AService {
  name: string; name_ar: string; name_fr: string;
  desc_en: string; desc_ar: string; desc_fr: string;
  url: string; cat: CatKey; tag?: string;
  highlight?: boolean;
}

/* ─── Category meta ──────────────────────────────────────────────────── */
const CATS: { key: CatKey; en: string; ar: string; fr: string; icon: React.ReactElement; color: string }[] = [
  { key: "regul",  en: "Regulators",        ar: "الجهات التنظيمية",  fr: "Régulateurs",         icon: <IcRegul />,  color: "var(--ink-2)" },
  { key: "sante",  en: "Health Insurance",   ar: "التأمين الصحي",     fr: "Assurance Santé",     icon: <IcSante3 />, color: "var(--emerald)" },
  { key: "auto",   en: "Car Insurance",      ar: "تأمين السيارات",    fr: "Assurance Auto",      icon: <IcAuto />,   color: "var(--azure)" },
  { key: "habita", en: "Property Insurance", ar: "تأمين الممتلكات",   fr: "Assurance Habitation",icon: <IcHabita />, color: "var(--gold)" },
  { key: "vie",    en: "Life Insurance",     ar: "التأمين على الحياة",fr: "Assurance Vie",       icon: <IcVie />,    color: "var(--rose)" },
  { key: "biz",    en: "Business Insurance", ar: "تأمين الأعمال",     fr: "Assurance Entreprise",icon: <IcBiz2 />,   color: "#8B5CF6" },
];

/* ─── Country meta ───────────────────────────────────────────────────── */
const COUNTRIES: { key: CountryKey; flag: string; en: string; ar: string; fr: string; tagline_en: string; tagline_ar: string; tagline_fr: string }[] = [
  { key: "ae", flag: "🇦🇪", en: "UAE",    ar: "الإمارات",  fr: "EAU",
    tagline_en: "UAE — One of the most developed insurance markets in the region",
    tagline_ar: "الإمارات — من أكثر أسواق التأمين تطوراً في المنطقة",
    tagline_fr: "EAU — L'un des marchés d'assurance les plus développés de la région" },
  { key: "sa", flag: "🇸🇦", en: "KSA",    ar: "المملكة",   fr: "Arabie Saoudite",
    tagline_en: "KSA — Takaful-driven insurance market aligned with Vision 2030",
    tagline_ar: "المملكة — سوق تأمين تكافلي متوافق مع رؤية 2030",
    tagline_fr: "KSA — Marché d'assurance Takaful aligné sur Vision 2030" },
  { key: "ma", flag: "🇲🇦", en: "Morocco", ar: "المغرب",    fr: "Maroc",
    tagline_en: "Morocco — 3rd largest African insurance market, regulated by ACAPS",
    tagline_ar: "المغرب — ثالث أكبر سوق للتأمين في أفريقيا، منظّم من ACAPS",
    tagline_fr: "Maroc — 3e marché d'assurance africain, régulé par l'ACAPS" },
];

/* ─── KPIs ───────────────────────────────────────────────────────────── */
const KPIS: Record<CountryKey, { n: string; en: string; ar: string; fr: string }[]> = {
  ae: [
    { n: "60+",   en: "Licensed insurers",   ar: "شركة تأمين مرخصة",  fr: "Assureurs agréés" },
    { n: "AED 50B", en: "Market size",       ar: "حجم السوق",          fr: "Taille du marché" },
    { n: "96%",   en: "Health coverage",     ar: "تغطية صحية",         fr: "Couverture santé" },
    { n: "CBUAE", en: "Regulator",           ar: "المنظِّم",            fr: "Régulateur" },
  ],
  sa: [
    { n: "30+",   en: "Takaful companies",   ar: "شركة تكافل",          fr: "Sociétés Takaful" },
    { n: "SAR 45B",en: "Market size",        ar: "حجم السوق",           fr: "Taille du marché" },
    { n: "98%",   en: "Health coverage goal",ar: "هدف التغطية الصحية",  fr: "Objectif santé" },
    { n: "SAMA",  en: "Regulator",           ar: "المنظِّم",             fr: "Régulateur" },
  ],
  ma: [
    { n: "20+",   en: "Insurance companies", ar: "شركة تأمين",          fr: "Compagnies" },
    { n: "MAD 50B",en: "Market size",        ar: "حجم السوق",           fr: "Taille du marché" },
    { n: "3rd",   en: "Africa ranking",      ar: "مرتبة أفريقيا",       fr: "Rang Afrique" },
    { n: "ACAPS", en: "Regulator",           ar: "المنظِّم",             fr: "Régulateur" },
  ],
};

/* ─── Service data ───────────────────────────────────────────────────── */
const SERVICES: Record<CountryKey, AService[]> = {
  ae: [
    /* Régulateurs */
    { cat: "regul", highlight: true, tag: "Fédéral",
      name: "Central Bank UAE — Insurance", name_ar: "المصرف المركزي الإماراتي — التأمين", name_fr: "CBUAE — Assurance",
      url: "https://www.centralbank.ae/en/insurance",
      desc_en: "Federal regulator overseeing all licensed insurers in the UAE — consumer protection and market stability.",
      desc_ar: "الجهة الاتحادية المنظِّمة لجميع شركات التأمين المرخصة في الإمارات — حماية المستهلك واستقرار السوق.",
      desc_fr: "Régulateur fédéral supervisant tous les assureurs agréés aux EAU — protection du consommateur." },
    { cat: "regul", tag: "Fédéral",
      name: "UAE Insurance Authority (IA)", name_ar: "هيئة التأمين الإماراتية", name_fr: "Insurance Authority UAE",
      url: "https://www.ia.gov.ae",
      desc_en: "Former dedicated insurance authority — its powers transferred to CBUAE. Archives and legislation.",
      desc_ar: "الهيئة المخصصة السابقة للتأمين — نُقلت صلاحياتها إلى المصرف المركزي. أرشيف وتشريعات.",
      desc_fr: "Ancienne autorité d'assurance — pouvoirs transférés à la CBUAE. Archives et législation." },
    /* Santé */
    { cat: "sante", highlight: true, tag: "Abu Dhabi",
      name: "DAMAN Health", name_ar: "ضمان للتأمين الصحي", name_fr: "DAMAN Health",
      url: "https://www.damanhealth.ae",
      desc_en: "Abu Dhabi's largest health insurer — Thiqa (nationals), Basic and Enhanced Daman plans.",
      desc_ar: "أكبر شركة تأمين صحي في أبوظبي — ثيقة للمواطنين وخطط ضمان الأساسية والمعززة.",
      desc_fr: "Principal assureur santé d'Abu Dhabi — Thiqa (nationaux), plans Basic et Enhanced Daman." },
    { cat: "sante", tag: "Régional",
      name: "Bupa Gulf", name_ar: "بوبا الخليج", name_fr: "Bupa Gulf",
      url: "https://www.bupagulf.com",
      desc_en: "International health insurance leader — individual and corporate health plans across the Gulf.",
      desc_ar: "الرائد الدولي في التأمين الصحي — خطط صحية فردية وشركات في جميع أنحاء الخليج.",
      desc_fr: "Leader international de l'assurance santé — plans individuels et entreprises dans le Golfe." },
    { cat: "sante", tag: "Multi-emirats",
      name: "AXA Gulf — Health", name_ar: "AXA الخليج — الصحة", name_fr: "AXA Gulf Santé",
      url: "https://www.axagulf.com",
      desc_en: "Comprehensive health plans for individuals, families and corporates — network of 4,000+ providers.",
      desc_ar: "خطط صحية شاملة للأفراد والعائلات والشركات — شبكة أكثر من 4000 مزود.",
      desc_fr: "Plans santé complets individus, familles et entreprises — réseau 4 000+ prestataires." },
    { cat: "sante", tag: "Multi-emirats",
      name: "Cigna UAE", name_ar: "سيجنا الإمارات", name_fr: "Cigna UAE",
      url: "https://www.cignahealthbenefits.com/ae",
      desc_en: "Global health benefits — expat-focused health insurance with worldwide cover and 24/7 support.",
      desc_ar: "مزايا صحية عالمية — تأمين صحي للمغتربين مع تغطية دولية ودعم 24 ساعة.",
      desc_fr: "Avantages santé mondiaux — assurance expatriés avec couverture mondiale et assistance 24h/24." },
    /* Auto */
    { cat: "auto", highlight: true, tag: "Multi-emirats",
      name: "Orient Insurance — Motor", name_ar: "أوريينت للتأمين — السيارات", name_fr: "Orient Insurance Auto",
      url: "https://www.orientinsurance.ae",
      desc_en: "UAE's leading motor insurer — comprehensive and third-party cover, instant online quotes.",
      desc_ar: "شركة التأمين على السيارات الرائدة في الإمارات — تأمين شامل وضد الغير، عروض فورية عبر الإنترنت.",
      desc_fr: "Principal assureur automobile aux EAU — couverture tous risques et tiers, devis en ligne instantané." },
    { cat: "auto", tag: "Multi-emirats",
      name: "RSA Insurance UAE", name_ar: "RSA للتأمين الإمارات", name_fr: "RSA Insurance UAE",
      url: "https://www.rsauae.com",
      desc_en: "Royal & Sun Alliance — comprehensive motor, roadside assistance and fleet solutions.",
      desc_ar: "رويال صن ألاينس — تأمين شامل على السيارات والمساعدة على الطريق وحلول الأساطيل.",
      desc_fr: "Royal & Sun Alliance — auto tous risques, assistance routière et flotte d'entreprise." },
    { cat: "auto", tag: "Multi-emirats",
      name: "Watania Takaful — Auto", name_ar: "وطنية للتكافل — السيارات", name_fr: "Watania Takaful Auto",
      url: "https://www.wataniatakful.ae",
      desc_en: "Sharia-compliant motor Takaful — comprehensive and third-party Islamic insurance plans.",
      desc_ar: "تكافل السيارات المتوافق مع الشريعة — خطط تأمين إسلامية شاملة وضد الغير.",
      desc_fr: "Takaful automobile conforme à la Charia — plans d'assurance islamique tous risques et tiers." },
    /* Habitation */
    { cat: "habita", highlight: true, tag: "Multi-emirats",
      name: "Zurich Insurance UAE — Property", name_ar: "زيورخ للتأمين الإمارات — الممتلكات", name_fr: "Zurich UAE Habitation",
      url: "https://www.zurich.ae",
      desc_en: "Home and property insurance — fire, theft, liability and contents cover for UAE residents.",
      desc_ar: "تأمين المنزل والممتلكات — حريق وسرقة ومسؤولية ومحتويات للمقيمين في الإمارات.",
      desc_fr: "Assurance habitation et biens — incendie, vol, responsabilité et contenu pour résidents EAU." },
    { cat: "habita", tag: "Multi-emirats",
      name: "AIG UAE — Property & Casualty", name_ar: "AIG الإمارات — الممتلكات والحوادث", name_fr: "AIG UAE Habitation",
      url: "https://www.aig.ae",
      desc_en: "Commercial and residential property insurance — all risks, business interruption and liability.",
      desc_ar: "تأمين الممتلكات التجارية والسكنية — جميع الأخطار وتوقف الأعمال والمسؤولية.",
      desc_fr: "Assurance biens commerciaux et résidentiels — tous risques, perte d'exploitation et RC." },
    /* Vie */
    { cat: "vie", highlight: true, tag: "Multi-emirats",
      name: "MetLife UAE", name_ar: "ميت لايف الإمارات", name_fr: "MetLife UAE",
      url: "https://www.metlifeinsurance.ae",
      desc_en: "Leading life insurance provider — term life, savings, critical illness and group benefits.",
      desc_ar: "مزود رائد للتأمين على الحياة — حياة لأجل وادخار وأمراض خطيرة ومزايا جماعية.",
      desc_fr: "Assureur vie leader — temporaire décès, épargne, maladies graves et avantages collectifs." },
    { cat: "vie", tag: "Multi-emirats",
      name: "Friends Provident International", name_ar: "فريندز بروفيدنت الدولية", name_fr: "Friends Provident International",
      url: "https://www.fpinternational.com",
      desc_en: "Expat life and savings plans — whole-of-life, regular savings and education plans.",
      desc_ar: "خطط حياة وادخار للمغتربين — تأمين الحياة بالكامل وخطط ادخار منتظمة وتعليمية.",
      desc_fr: "Plans vie et épargne expatriés — vie entière, épargne régulière et plans éducation." },
    /* Entreprise */
    { cat: "biz", highlight: true, tag: "Multi-emirats",
      name: "Allianz UAE — Commercial", name_ar: "أليانز الإمارات — التجاري", name_fr: "Allianz UAE Commercial",
      url: "https://www.allianz.ae",
      desc_en: "Full commercial insurance suite — property, liability, marine cargo and engineering.",
      desc_ar: "مجموعة تأمين تجاري كاملة — ممتلكات ومسؤولية وشحن بحري وهندسة.",
      desc_fr: "Suite complète assurance commerciale — biens, RC, fret maritime et risques ingénierie." },
    { cat: "biz", tag: "Multi-emirats",
      name: "Marsh McLennan UAE", name_ar: "مارش ماكلينان الإمارات", name_fr: "Marsh McLennan UAE",
      url: "https://www.marsh.com/ae",
      desc_en: "Global insurance broker and risk management — SME, real estate and corporate risk solutions.",
      desc_ar: "وسيط التأمين العالمي وإدارة المخاطر — حلول للشركات الصغيرة والعقارات والشركات الكبرى.",
      desc_fr: "Courtier mondial et gestion des risques — solutions PME, immobilier et entreprises." },
  ],

  sa: [
    /* Régulateurs */
    { cat: "regul", highlight: true, tag: "National",
      name: "SAMA — Insurance Supervision", name_ar: "البنك المركزي السعودي — إشراف التأمين", name_fr: "SAMA Supervision Assurance",
      url: "https://www.sama.gov.sa/en-US/Insurance",
      desc_en: "Saudi Central Bank — regulatory body for all insurance and reinsurance companies in KSA.",
      desc_ar: "البنك المركزي السعودي — الجهة التنظيمية لجميع شركات التأمين وإعادة التأمين في المملكة.",
      desc_fr: "Banque Centrale Saoudienne — régulateur de toutes les sociétés d'assurance et réassurance." },
    { cat: "regul", tag: "National",
      name: "CCHI — Health Insurance Council", name_ar: "مجلس الضمان الصحي التعاوني", name_fr: "CCHI",
      url: "https://www.cchi.gov.sa",
      desc_en: "Mandatory health insurance council — policy oversight, approvals and consumer complaints.",
      desc_ar: "مجلس الضمان الصحي التعاوني — الإشراف على الوثائق والموافقات وشكاوى المستهلكين.",
      desc_fr: "Conseil de l'assurance maladie obligatoire — supervision, agréments et réclamations." },
    /* Santé */
    { cat: "sante", highlight: true, tag: "National",
      name: "Bupa Arabia", name_ar: "بوبا العربية", name_fr: "Bupa Arabia",
      url: "https://www.bupaarabia.com.sa",
      desc_en: "Largest private health insurer in KSA — corporate and individual plans, 2M+ members.",
      desc_ar: "أكبر شركة تأمين صحي خاص في المملكة — خطط شركات وأفراد، أكثر من 2 مليون عضو.",
      desc_fr: "Plus grand assureur santé privé KSA — plans entreprises et individuels, 2M+ membres." },
    { cat: "sante", tag: "National",
      name: "Tawuniya Insurance", name_ar: "التعاونية للتأمين", name_fr: "Tawuniya Assurance",
      url: "https://www.tawuniya.com.sa",
      desc_en: "Saudi Arabia's oldest and largest insurer — health, motor, property and life products.",
      desc_ar: "أقدم وأكبر شركة تأمين في المملكة — منتجات صحة وسيارات وممتلكات وحياة.",
      desc_fr: "Plus ancienne et plus grande compagnie d'assurance KSA — santé, auto, biens et vie." },
    { cat: "sante", tag: "National",
      name: "MedGulf Insurance", name_ar: "مدغلف للتأمين", name_fr: "MedGulf Insurance",
      url: "https://www.medgulf.com.sa",
      desc_en: "Leading health insurer — SME medical plans, maternity and dental coverage.",
      desc_ar: "شركة تأمين صحي رائدة — خطط طبية للشركات الصغيرة والتوليد والأسنان.",
      desc_fr: "Assureur santé majeur — plans médicaux PME, maternité et couverture dentaire." },
    /* Auto */
    { cat: "auto", highlight: true, tag: "National",
      name: "Najm for Insurance Services", name_ar: "نجم لخدمات التأمين", name_fr: "Najm Services Assurance",
      url: "https://www.najm.sa",
      desc_en: "Saudi accident reporting and insurance services — traffic accident claim management platform.",
      desc_ar: "الإبلاغ عن الحوادث وخدمات التأمين في المملكة — منصة إدارة مطالبات حوادث المرور.",
      desc_fr: "Déclaration d'accidents et services assurance — plateforme de gestion des sinistres auto." },
    { cat: "auto", tag: "National",
      name: "Salama Islamic Arab Insurance", name_ar: "سلامة للتأمين التعاوني", name_fr: "Salama Assurance Auto",
      url: "https://www.salama.ae",
      desc_en: "Sharia-compliant auto Takaful — comprehensive, third-party and fleet motor plans.",
      desc_ar: "تكافل السيارات المتوافق مع الشريعة — شامل وضد الغير وخطط الأساطيل.",
      desc_fr: "Takaful auto conforme Charia — tous risques, tiers et plans flotte." },
    { cat: "auto", tag: "National",
      name: "Al Rajhi Takaful — Motor", name_ar: "الراجحي تكافل — السيارات", name_fr: "Al Rajhi Takaful Auto",
      url: "https://www.alrajhitakaful.com",
      desc_en: "Takaful motor insurance linked to Al Rajhi Bank — competitive rates and instant digital quotes.",
      desc_ar: "تكافل السيارات المرتبط بمصرف الراجحي — أسعار تنافسية وعروض رقمية فورية.",
      desc_fr: "Takaful auto lié à Al Rajhi Bank — tarifs compétitifs et devis numériques instantanés." },
    /* Habitation */
    { cat: "habita", highlight: true, tag: "National",
      name: "Alinma Tokio Marine", name_ar: "أليانز البلاد", name_fr: "Alinma Tokio Marine",
      url: "https://www.alinmatokiomarine.com",
      desc_en: "Home and property insurance — fire, theft, natural disasters and contents for Saudi homeowners.",
      desc_ar: "تأمين المنزل والممتلكات — حريق وسرقة وكوارث طبيعية ومحتويات لأصحاب المنازل السعوديين.",
      desc_fr: "Assurance habitation — incendie, vol, catastrophes naturelles et contenu pour propriétaires saoudiens." },
    { cat: "habita", tag: "National",
      name: "Malath Insurance", name_ar: "ملاذ للتأمين", name_fr: "Malath Insurance",
      url: "https://www.malath.com.sa",
      desc_en: "Takaful property and home insurance — protection for residential and commercial properties.",
      desc_ar: "تكافل الممتلكات وتأمين المنزل — حماية للعقارات السكنية والتجارية.",
      desc_fr: "Takaful biens et habitation — protection des propriétés résidentielles et commerciales." },
    /* Vie */
    { cat: "vie", highlight: true, tag: "National",
      name: "Solidarity Saudi Takaful", name_ar: "سوليدرتي للتأمين التكافلي", name_fr: "Solidarity Saudi Takaful",
      url: "https://www.solidarity.com.sa",
      desc_en: "Largest family Takaful provider — life, savings and education Takaful plans.",
      desc_ar: "أكبر مزود لتكافل الأسرة — خطط تكافل الحياة والادخار والتعليم.",
      desc_fr: "Plus grand fournisseur de Takaful famille — plans vie, épargne et éducation." },
    { cat: "vie", tag: "National",
      name: "MetLife Saudi Arabia", name_ar: "ميت لايف المملكة", name_fr: "MetLife Arabie Saoudite",
      url: "https://www.metlife.com.sa",
      desc_en: "Life insurance and employee benefits — group term life, critical illness and pension solutions.",
      desc_ar: "تأمين الحياة ومزايا الموظفين — تأمين الحياة الجماعي والأمراض الخطيرة وحلول التقاعد.",
      desc_fr: "Assurance vie et avantages collectifs — prévoyance groupe, maladies graves et retraite." },
    /* Entreprise */
    { cat: "biz", highlight: true, tag: "National",
      name: "Saudi Re for Cooperative Reinsurance", name_ar: "إعادة التأمين السعودية", name_fr: "Saudi Re",
      url: "https://www.saudire.com",
      desc_en: "Saudi national reinsurer — treaty and facultative reinsurance supporting the local market.",
      desc_ar: "شركة إعادة التأمين السعودية الوطنية — إعادة تأمين اتفاقية واختيارية لدعم السوق المحلي.",
      desc_fr: "Réassureur national saoudien — réassurance treaty et facultative pour le marché local." },
    { cat: "biz", tag: "National",
      name: "SAICO — Commercial Lines", name_ar: "الشركة السعودية للتأمين", name_fr: "SAICO Assurance Commerciale",
      url: "https://www.saico.com.sa",
      desc_en: "Commercial insurance — property, engineering, marine and liability for Saudi businesses.",
      desc_ar: "التأمين التجاري — ممتلكات وهندسة وبحري ومسؤولية للشركات السعودية.",
      desc_fr: "Assurance commerciale — biens, ingénierie, maritime et RC pour entreprises saoudiennes." },
  ],

  ma: [
    /* Régulateurs */
    { cat: "regul", highlight: true, tag: "National",
      name: "ACAPS", name_ar: "هيئة مراقبة التأمينات والاحتياط الاجتماعي", name_fr: "ACAPS",
      url: "https://www.acaps.ma",
      desc_en: "Moroccan insurance and social protection regulator — market supervision, consumer protection and licensing.",
      desc_ar: "الهيئة المغربية لمراقبة التأمينات والاحتياط الاجتماعي — إشراف السوق وحماية المستهلك والترخيص.",
      desc_fr: "Régulateur marocain assurance et prévoyance — supervision du marché, protection consommateur et agréments." },
    { cat: "regul", tag: "National",
      name: "Fédération Marocaine des Assurances (FMSAR)", name_ar: "الاتحاد المغربي لشركات التأمين", name_fr: "FMSAR",
      url: "https://www.fmsar.org.ma",
      desc_en: "Professional federation of Moroccan insurers — statistics, standards and sector advocacy.",
      desc_ar: "الاتحاد المهني لشركات التأمين المغربية — إحصاءات ومعايير ودفاع عن القطاع.",
      desc_fr: "Fédération professionnelle des assureurs marocains — statistiques, normes et représentation." },
    /* Santé */
    { cat: "sante", highlight: true, tag: "National",
      name: "CNSS — AMO Secteur Privé", name_ar: "CNSS — التأمين الإجباري القطاع الخاص", name_fr: "CNSS — AMO Privé",
      url: "https://www.cnss.ma/fr/content/assurance-maladie-obligatoire-amo",
      desc_en: "Mandatory Health Insurance for private-sector employees — managed by CNSS.",
      desc_ar: "التأمين الصحي الإجباري لموظفي القطاع الخاص — تديره CNSS.",
      desc_fr: "Assurance Maladie Obligatoire salariés secteur privé — gérée par la CNSS." },
    { cat: "sante", tag: "National",
      name: "RMA Assurance — Santé", name_ar: "RMA للتأمين — الصحة", name_fr: "RMA Santé",
      url: "https://www.rma.ma",
      desc_en: "Leading private health insurer — complementary health plans topping AMO coverage.",
      desc_ar: "شركة التأمين الصحي الخاصة الرائدة — خطط صحية تكميلية تتجاوز تغطية AMO.",
      desc_fr: "Principal assureur santé privé — plans complémentaires santé en supplément de l'AMO." },
    { cat: "sante", tag: "National",
      name: "Saham Assurance (Sanlam Maroc)", name_ar: "سهم للتأمين — سانلام المغرب", name_fr: "Saham / Sanlam Maroc",
      url: "https://www.saham-assurance.ma",
      desc_en: "Pan-African insurer — individual and group health, dental and maternity plans in Morocco.",
      desc_ar: "شركة تأمين أفريقية — خطط صحية فردية وجماعية وأسنان وتوليد في المغرب.",
      desc_fr: "Assureur panafricain — santé individuelle et collective, dentaire et maternité au Maroc." },
    /* Auto */
    { cat: "auto", highlight: true, tag: "National",
      name: "Wafa Assurance — Auto", name_ar: "وفا للتأمين — السيارات", name_fr: "Wafa Assurance Auto",
      url: "https://www.wafaassurance.ma",
      desc_en: "Morocco's largest insurer — comprehensive, third-party motor and assistance 24/7.",
      desc_ar: "أكبر شركة تأمين في المغرب — تأمين شامل وضد الغير ومساعدة 24 ساعة.",
      desc_fr: "Plus grand assureur marocain — tous risques, tiers et assistance 24h/24." },
    { cat: "auto", tag: "National",
      name: "Atlanta Assurance — Auto", name_ar: "أطلنتا للتأمين — السيارات", name_fr: "Atlanta Assurance Auto",
      url: "https://www.atlanta.ma",
      desc_en: "Second largest insurer in Morocco — motor, fleet and assistance plans.",
      desc_ar: "ثاني أكبر شركة تأمين في المغرب — خطط السيارات والأساطيل والمساعدة.",
      desc_fr: "Deuxième assureur marocain — auto, flotte et assistance routière." },
    { cat: "auto", tag: "National",
      name: "AXA Maroc — Auto", name_ar: "AXA المغرب — السيارات", name_fr: "AXA Maroc Auto",
      url: "https://www.axa.ma",
      desc_en: "AXA Morocco — comprehensive motor cover, driver assistance and claims digital management.",
      desc_ar: "AXA المغرب — تغطية شاملة للسيارات ومساعدة السائق وإدارة المطالبات الرقمية.",
      desc_fr: "AXA Maroc — couverture auto tous risques, assistance conducteur et gestion sinistres en ligne." },
    /* Habitation */
    { cat: "habita", highlight: true, tag: "National",
      name: "Allianz Maroc — Habitation", name_ar: "أليانز المغرب — السكن", name_fr: "Allianz Maroc Habitation",
      url: "https://www.allianz.ma",
      desc_en: "Home insurance — fire, theft, water damage, civil liability for Moroccan homeowners.",
      desc_ar: "تأمين المنزل — حريق وسرقة وأضرار المياه والمسؤولية المدنية لأصحاب المنازل المغاربة.",
      desc_fr: "Assurance habitation — incendie, vol, dégâts des eaux et RC pour propriétaires marocains." },
    { cat: "habita", tag: "National",
      name: "Zurich Maroc — Multirisque", name_ar: "زيورخ المغرب — متعددة الأخطار", name_fr: "Zurich Maroc Multirisque",
      url: "https://www.zurich.ma",
      desc_en: "Multirisque home insurance — comprehensive property protection for individuals and landlords.",
      desc_ar: "تأمين متعدد الأخطار للمنزل — حماية شاملة للممتلكات للأفراد وأصحاب العقارات.",
      desc_fr: "Multirisque habitation — protection complète des biens pour particuliers et bailleurs." },
    /* Vie */
    { cat: "vie", highlight: true, tag: "National",
      name: "Wafa Assurance — Vie & Épargne", name_ar: "وفا للتأمين — الحياة والادخار", name_fr: "Wafa Assurance Vie",
      url: "https://www.wafaassurance.ma",
      desc_en: "Life and savings insurance — endowment plans, education savings and retirement products.",
      desc_ar: "تأمين الحياة والادخار — خطط تأمين مختلطة وادخار تعليمي ومنتجات التقاعد.",
      desc_fr: "Assurance vie et épargne — plans dotation, épargne éducation et produits retraite." },
    { cat: "vie", tag: "National",
      name: "Saham Vie (Sanlam) — Prévoyance", name_ar: "سهم للحياة — الحماية", name_fr: "Saham Vie Prévoyance",
      url: "https://www.saham-assurance.ma",
      desc_en: "Life protection and savings — individual life, disability and supplemental pension plans.",
      desc_ar: "الحماية والادخار — حياة فردية وعجز ومعاش تكميلي.",
      desc_fr: "Protection et épargne — vie individuelle, incapacité et retraite complémentaire." },
    /* Entreprise */
    { cat: "biz", highlight: true, tag: "National",
      name: "Atlanta Assurance — Entreprises", name_ar: "أطلنتا للتأمين — الشركات", name_fr: "Atlanta Entreprises",
      url: "https://www.atlanta.ma",
      desc_en: "Commercial lines — property all risks, liability, marine cargo and engineering in Morocco.",
      desc_ar: "الخطوط التجارية — جميع مخاطر الممتلكات والمسؤولية والشحن البحري والهندسة في المغرب.",
      desc_fr: "Lignes commerciales — tous risques biens, RC, fret maritime et ingénierie au Maroc." },
    { cat: "biz", tag: "National",
      name: "Mutuelle Agricole Marocaine (MAMDA)", name_ar: "الجمعية المغربية للتأمين الزراعي", name_fr: "MAMDA",
      url: "https://www.mamda.ma",
      desc_en: "Agricultural mutual insurer — crop, livestock, equipment and rural property insurance.",
      desc_ar: "التأمين التعاوني الزراعي — محاصيل وماشية ومعدات وممتلكات ريفية.",
      desc_fr: "Mutuelle agricole — cultures, bétail, matériel et biens ruraux assurés." },
  ],
};

/* ─── Card ───────────────────────────────────────────────────────────── */
function AssurCard({ s, lang, isMob }: { s: AService; lang: string; isMob: boolean }) {
  const cat  = CATS.find(c => c.key === s.cat)!;
  const name = lang === "ar" ? s.name_ar : lang === "fr" ? s.name_fr : s.name;
  const desc = lang === "ar" ? s.desc_ar : lang === "fr" ? s.desc_fr : s.desc_en;
  return (
    <div style={{
      padding: isMob ? 14 : 18,
      background: s.highlight ? `color-mix(in srgb, ${cat.color} 5%, var(--bg-paper))` : "var(--bg-paper)",
      border: s.highlight ? `1px solid color-mix(in srgb, ${cat.color} 30%, transparent)` : "1px solid var(--line-soft)",
      borderRadius: "var(--r)", display: "flex", flexDirection: "column", gap: 12,
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
            {s.highlight && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 999, background: cat.color, color: cat.color === "var(--ink-2)" ? "#fff" : "#fff", fontWeight: 600, flexShrink: 0, marginTop: 2 }}>★</span>}
          </div>
          {s.tag && <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "var(--bg-inset)", color: "var(--ink-4)", border: "1px solid var(--line-soft)", marginTop: 4, display: "inline-block" }}>{s.tag}</span>}
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
export function ScreenAssurance() {
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
        title={lang === "ar" ? "التأمين" : lang === "fr" ? "Assurance" : "Insurance"}
        crumb={isMob ? [] : [
          countryMeta.flag + " " + (lang === "ar" ? countryMeta.ar : lang === "fr" ? countryMeta.fr : countryMeta.en),
          `${filtered.length} ${lang === "fr" ? "compagnies" : lang === "ar" ? "شركة" : "companies"}`,
        ]}
      />

      <main style={{ flex: 1, padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 18, background: "var(--bg-cream)", overflow: "auto" }}>

        {/* Hero */}
        <div className="sgi-card-elevated" style={{
          padding: isMob ? 18 : 28,
          background: "linear-gradient(135deg, #1A0A2E 0%, #2E1A5C 60%, #0A2342 100%)",
          color: "var(--bg-ivory)", position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", insetInlineEnd: -10, top: -10, fontSize: isMob ? 90 : 130, opacity: 0.15, lineHeight: 1 }}>
            {countryMeta.flag}
          </div>
          <Eyebrow style={{ color: "#C4B5FD" }}>
            {lang === "ar" ? "سوق التأمين" : lang === "fr" ? "Marché de l'assurance" : "Insurance Market"}
          </Eyebrow>
          <div className="font-display" style={{ fontSize: isMob ? 20 : 30, marginTop: 8, lineHeight: 1.25 }}>{tagline}</div>

          <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: isMob ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
            {kpis.map((k, i) => (
              <div key={i} style={{ padding: isMob ? "8px 10px" : "12px 14px", background: "rgba(196,181,253,0.10)", borderInlineStart: "2px solid #C4B5FD", borderRadius: 4 }}>
                <div className="font-display tnum" style={{ fontSize: isMob ? 18 : 22, color: "#C4B5FD" }}>{k.n}</div>
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
                  background: c.key === country ? "#C4B5FD" : "rgba(255,255,255,0.10)",
                  color: c.key === country ? "#1A0A2E" : "var(--bg-ivory)",
                  border: c.key === country ? "1px solid #C4B5FD" : "1px solid rgba(255,255,255,0.18)",
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
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{items.length} {lang === "fr" ? "compagnies" : lang === "ar" ? "شركة" : "companies"}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>
                  {items.map((s, i) => <AssurCard key={i} s={s} lang={lang} isMob={isMob} />)}
                </div>
              </section>
            );
          })
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>
            {filtered.map((s, i) => <AssurCard key={i} s={s} lang={lang} isMob={isMob} />)}
          </div>
        )}

      </main>
    </div>
  );
}
