"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Ic } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";

/* ─── Category icons ────────────────────────────────────────────────── */
const IcRegul   = () => <Ic><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/></Ic>;
const IcRetail  = () => <Ic><path d="M3 21h18M3 10h18M3 7l9-4 9 4M6 10v11M10 10v11M14 10v11M18 10v11"/></Ic>;
const IcIslam   = () => <Ic><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/><path d="M12 6v6l4 2"/></Ic>;
const IcBiz     = () => <Ic><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M12 12v5M9.5 12H15"/></Ic>;
const IcFintech = () => <Ic><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Ic>;
const IcInvest  = () => <Ic><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 6-7"/></Ic>;

/* ─── Types ──────────────────────────────────────────────────────────── */
type CountryKey = "ae" | "sa" | "ma";
type CatKey     = "regul" | "retail" | "islam" | "biz" | "fintech" | "invest";

interface BService {
  name: string; name_ar: string; name_fr: string;
  desc_en: string; desc_ar: string; desc_fr: string;
  url: string; cat: CatKey; tag?: string;
  highlight?: boolean;
}

/* ─── Category meta ──────────────────────────────────────────────────── */
const CATS: { key: CatKey; en: string; ar: string; fr: string; icon: React.ReactElement; color: string }[] = [
  { key: "regul",   en: "Central Banks",       ar: "البنوك المركزية",     fr: "Banques Centrales",    icon: <IcRegul />,   color: "var(--ink-2)" },
  { key: "retail",  en: "Retail Banking",      ar: "الخدمات المصرفية",   fr: "Banques de Détail",    icon: <IcRetail />,  color: "var(--azure)" },
  { key: "islam",   en: "Islamic Banking",     ar: "المصرفية الإسلامية", fr: "Finance Islamique",    icon: <IcIslam />,   color: "var(--emerald)" },
  { key: "biz",     en: "Corporate Banking",   ar: "الخدمات للشركات",   fr: "Banques d'Affaires",   icon: <IcBiz />,     color: "var(--gold)" },
  { key: "fintech", en: "Fintech & Digital",   ar: "التكنولوجيا المالية", fr: "Fintech & Digital",   icon: <IcFintech />, color: "#8B5CF6" },
  { key: "invest",  en: "Investment",          ar: "الاستثمار",           fr: "Investissement",       icon: <IcInvest />,  color: "var(--rose)" },
];

/* ─── Country meta ───────────────────────────────────────────────────── */
const COUNTRIES: { key: CountryKey; flag: string; en: string; ar: string; fr: string; tagline_en: string; tagline_ar: string; tagline_fr: string }[] = [
  { key: "ae", flag: "🇦🇪", en: "UAE", ar: "الإمارات", fr: "EAU",
    tagline_en: "UAE — Regional financial hub with DIFC and 50+ licensed banks",
    tagline_ar: "الإمارات — مركز مالي إقليمي رائد مع أكثر من 50 بنكاً مرخصاً",
    tagline_fr: "EAU — Hub financier régional avec DIFC et plus de 50 banques agréées" },
  { key: "sa", flag: "🇸🇦", en: "KSA", ar: "المملكة", fr: "Arabie Saoudite",
    tagline_en: "KSA — Fastest-growing banking sector in MENA, driven by Vision 2030",
    tagline_ar: "المملكة — القطاع المصرفي الأسرع نمواً في منطقة الشرق الأوسط وفق رؤية 2030",
    tagline_fr: "KSA — Secteur bancaire MENA à la croissance la plus rapide, Vision 2030" },
  { key: "ma", flag: "🇲🇦", en: "Morocco", ar: "المغرب", fr: "Maroc",
    tagline_en: "Morocco — Gateway to Africa, 3rd largest banking market on the continent",
    tagline_ar: "المغرب — بوابة أفريقيا وثالث أكبر سوق مصرفي في القارة",
    tagline_fr: "Maroc — Porte d'entrée vers l'Afrique, 3e marché bancaire du continent" },
];

/* ─── KPIs ───────────────────────────────────────────────────────────── */
const KPIS: Record<CountryKey, { n: string; en: string; ar: string; fr: string }[]> = {
  ae: [
    { n: "50+",      en: "Licensed banks",     ar: "بنك مرخص",          fr: "Banques agréées" },
    { n: "AED 4T",   en: "Total assets",       ar: "إجمالي الأصول",     fr: "Actif total" },
    { n: "DIFC",     en: "Financial hub",      ar: "مركز مالي",          fr: "Hub financier" },
    { n: "CBUAE",    en: "Regulator",          ar: "المنظِّم",            fr: "Régulateur" },
  ],
  sa: [
    { n: "30+",      en: "Local & foreign",    ar: "بنك محلي وأجنبي",    fr: "Local & étranger" },
    { n: "SAR 4.2T", en: "Total assets",       ar: "إجمالي الأصول",      fr: "Actif total" },
    { n: "60%",      en: "Digital transactions",ar: "معاملات رقمية",     fr: "Transactions digital" },
    { n: "SAMA",     en: "Regulator",          ar: "المنظِّم",            fr: "Régulateur" },
  ],
  ma: [
    { n: "24",       en: "Registered banks",   ar: "بنك مسجّل",          fr: "Banques enregistrées" },
    { n: "MAD 1.8T", en: "Total deposits",     ar: "إجمالي الودائع",     fr: "Dépôts totaux" },
    { n: "30%+",     en: "Banked population",  ar: "نسبة الشمول المالي", fr: "Taux de bancarisation" },
    { n: "BAM",      en: "Regulator",          ar: "المنظِّم",            fr: "Régulateur" },
  ],
};

/* ─── Service data ───────────────────────────────────────────────────── */
const SERVICES: Record<CountryKey, BService[]> = {
  ae: [
    /* Central Banks / Regulators */
    { cat: "regul", highlight: true, tag: "Fédéral",
      name: "Central Bank UAE (CBUAE)", name_ar: "المصرف المركزي الإماراتي", name_fr: "Banque Centrale des EAU",
      desc_en: "Federal regulator overseeing monetary policy, banking supervision and payment systems in the UAE.",
      desc_ar: "المنظِّم الفيدرالي المسؤول عن السياسة النقدية والرقابة المصرفية وأنظمة الدفع في الإمارات.",
      desc_fr: "Régulateur fédéral chargé de la politique monétaire, supervision bancaire et systèmes de paiement.",
      url: "https://www.centralbank.ae" },
    { cat: "regul", highlight: true, tag: "DIFC",
      name: "DFSA — Dubai Financial Services Authority", name_ar: "هيئة دبي للخدمات المالية", name_fr: "DFSA — Autorité des Services Financiers",
      desc_en: "Regulator of DIFC — the world-class financial free zone and international hub in Dubai.",
      desc_ar: "المنظِّم لمنطقة DIFC — المنطقة الحرة المالية العالمية ومركز دبي الدولي.",
      desc_fr: "Régulateur du DIFC — la zone franche financière internationale de Dubaï.",
      url: "https://www.dfsa.ae" },
    { cat: "regul", tag: "ADGM",
      name: "FSRA — Financial Services Regulatory Authority", name_ar: "هيئة تنظيم الخدمات المالية ADGM", name_fr: "FSRA — Abu Dhabi Global Market",
      desc_en: "Regulator for Abu Dhabi Global Market (ADGM), the UAE's other major financial free zone.",
      desc_ar: "المنظِّم لسوق أبوظبي العالمي ADGM، المنطقة الحرة المالية الرئيسية الأخرى في الإمارات.",
      desc_fr: "Régulateur de l'Abu Dhabi Global Market (ADGM), la deuxième grande zone franche financière.",
      url: "https://www.fsra.ae" },

    /* Retail Banking */
    { cat: "retail", highlight: true, tag: "Largest UAE",
      name: "Emirates NBD", name_ar: "بنك الإمارات دبي الوطني", name_fr: "Emirates NBD",
      desc_en: "Largest bank in the UAE by assets, offering comprehensive retail, corporate and investment banking.",
      desc_ar: "أكبر بنك في الإمارات من حيث الأصول، يقدم خدمات التجزئة والشركات والاستثمار.",
      desc_fr: "Plus grande banque des EAU en actifs, offrant services retail, corporate et investissement.",
      url: "https://www.emiratesnbd.com" },
    { cat: "retail", highlight: true, tag: "FAB",
      name: "First Abu Dhabi Bank", name_ar: "بنك أبوظبي الأول", name_fr: "First Abu Dhabi Bank",
      desc_en: "UAE's largest bank by market cap and one of the strongest in the MENA region.",
      desc_ar: "أكبر بنك في الإمارات من حيث القيمة السوقية وأحد أقوى البنوك في منطقة MENA.",
      desc_fr: "Plus grande banque des EAU par capitalisation boursière, référence de la région MENA.",
      url: "https://www.bankfab.com" },
    { cat: "retail",
      name: "Mashreq Bank", name_ar: "بنك المشرق", name_fr: "Mashreq Bank",
      desc_en: "Pioneer in digital banking in the UAE with a strong presence across the Middle East.",
      desc_ar: "رائد في الخدمات المصرفية الرقمية في الإمارات مع حضور قوي في جميع أنحاء الشرق الأوسط.",
      desc_fr: "Pionnier de la banque digitale aux EAU avec une forte présence au Moyen-Orient.",
      url: "https://www.mashreqbank.com" },
    { cat: "retail",
      name: "Abu Dhabi Commercial Bank (ADCB)", name_ar: "بنك أبوظبي التجاري", name_fr: "ADCB",
      desc_en: "Third-largest bank in the UAE, known for retail, SME and corporate banking solutions.",
      desc_ar: "ثالث أكبر بنك في الإمارات، متخصص في خدمات الأفراد والشركات الصغيرة والمتوسطة.",
      desc_fr: "3e banque des EAU, reconnue pour ses solutions retail, PME et corporate.",
      url: "https://www.adcb.com" },

    /* Islamic Banking */
    { cat: "islam", highlight: true, tag: "Largest Islamic",
      name: "Dubai Islamic Bank (DIB)", name_ar: "بنك دبي الإسلامي", name_fr: "Dubai Islamic Bank",
      desc_en: "World's first full-service Islamic bank, founded in 1975. Leading Sharia-compliant banking.",
      desc_ar: "أول بنك إسلامي متكامل الخدمات في العالم، تأسس عام 1975. رائد في الخدمات المتوافقة مع الشريعة.",
      desc_fr: "Première banque islamique complète au monde, fondée en 1975. Leader de la finance Charia.",
      url: "https://www.dib.ae" },
    { cat: "islam",
      name: "Abu Dhabi Islamic Bank (ADIB)", name_ar: "مصرف أبوظبي الإسلامي", name_fr: "Abu Dhabi Islamic Bank",
      desc_en: "Leading Islamic bank in Abu Dhabi offering Sharia-compliant products for individuals and businesses.",
      desc_ar: "بنك إسلامي رائد في أبوظبي يقدم منتجات متوافقة مع الشريعة للأفراد والمؤسسات.",
      desc_fr: "Banque islamique leader à Abu Dhabi, produits conformes à la Charia pour particuliers et entreprises.",
      url: "https://www.adib.ae" },
    { cat: "islam",
      name: "Emirates Islamic", name_ar: "الإمارات الإسلامي", name_fr: "Emirates Islamic",
      desc_en: "Subsidiary of Emirates NBD offering a full range of Sharia-compliant banking services.",
      desc_ar: "شركة تابعة لبنك الإمارات دبي الوطني تقدم خدمات مصرفية متوافقة مع الشريعة.",
      desc_fr: "Filiale d'Emirates NBD proposant une gamme complète de services bancaires conformes à la Charia.",
      url: "https://www.emiratesislamic.ae" },

    /* Corporate Banking */
    { cat: "biz", highlight: true, tag: "DIFC",
      name: "HSBC UAE", name_ar: "بنك HSBC الإمارات", name_fr: "HSBC EAU",
      desc_en: "International banking presence in UAE, strong in trade finance, treasury and corporate lending.",
      desc_ar: "حضور بنكي دولي في الإمارات، قوي في تمويل التجارة والخزينة والإقراض للشركات.",
      desc_fr: "Présence bancaire internationale aux EAU, fort en trade finance, trésorerie et crédit corporate.",
      url: "https://www.hsbc.ae" },
    { cat: "biz",
      name: "Standard Chartered UAE", name_ar: "ستاندرد تشارترد الإمارات", name_fr: "Standard Chartered EAU",
      desc_en: "Global bank with strong UAE operations, specializing in trade, cash management and capital markets.",
      desc_ar: "بنك عالمي بعمليات قوية في الإمارات، متخصص في التجارة وإدارة النقد وأسواق رأس المال.",
      desc_fr: "Banque mondiale avec de solides opérations aux EAU, spécialisée en trade et marchés de capitaux.",
      url: "https://www.sc.com/ae" },

    /* Fintech */
    { cat: "fintech", highlight: true, tag: "DIFC Fintech",
      name: "DIFC FinTech Hive", name_ar: "مسرّع التكنولوجيا المالية — DIFC", name_fr: "DIFC FinTech Hive",
      desc_en: "MENA's largest fintech accelerator, connecting startups with leading financial institutions.",
      desc_ar: "أكبر مسرّع للتكنولوجيا المالية في منطقة MENA، يربط الشركات الناشئة بالمؤسسات المالية الكبرى.",
      desc_fr: "Plus grand accélérateur fintech de MENA, connectant startups et institutions financières.",
      url: "https://www.fintechhive.difc.ae" },
    { cat: "fintech",
      name: "Wio Bank", name_ar: "بنك وايو", name_fr: "Wio Bank",
      desc_en: "UAE's first platform bank — embedded banking APIs for SMEs and digital businesses.",
      desc_ar: "أول بنك منصة في الإمارات — واجهات برمجة مصرفية متكاملة للشركات الصغيرة والأعمال الرقمية.",
      desc_fr: "Première banque plateforme des EAU — API bancaires intégrées pour PME et businesses digitaux.",
      url: "https://www.wio.io" },
    { cat: "fintech",
      name: "Liv. by Emirates NBD", name_ar: "بنك ليف الرقمي", name_fr: "Liv. Digital Bank",
      desc_en: "UAE's first lifestyle digital bank designed for millennials and digital-native customers.",
      desc_ar: "أول بنك رقمي للأسلوب الحياة في الإمارات، مصمم للجيل الرقمي.",
      desc_fr: "Première banque digitale lifestyle des EAU conçue pour les millennials.",
      url: "https://www.liv.me" },

    /* Investment */
    { cat: "invest", highlight: true, tag: "Sovereign",
      name: "Mubadala Investment", name_ar: "مبادلة للاستثمار", name_fr: "Mubadala Investment",
      desc_en: "Abu Dhabi's sovereign wealth fund managing USD 284B+ across global asset classes.",
      desc_ar: "صندوق الثروة السيادي لأبوظبي يدير أكثر من 284 مليار دولار عبر فئات الأصول العالمية.",
      desc_fr: "Fonds souverain d'Abu Dhabi gérant 284 Mds USD+ dans diverses classes d'actifs mondiales.",
      url: "https://www.mubadala.com" },
    { cat: "invest",
      name: "ADQ — Abu Dhabi Developmental Holding", name_ar: "ADQ — القابضة", name_fr: "ADQ — Abu Dhabi",
      desc_en: "Abu Dhabi holding company overseeing strategic investments in infrastructure, energy and food sectors.",
      desc_ar: "شركة أبوظبي القابضة تشرف على الاستثمارات الاستراتيجية في البنية التحتية والطاقة والغذاء.",
      desc_fr: "Holding d'Abu Dhabi supervisant les investissements stratégiques en infrastructure, énergie et agroalimentaire.",
      url: "https://www.adq.ae" },
  ],

  sa: [
    /* Central Banks / Regulators */
    { cat: "regul", highlight: true, tag: "Fédéral",
      name: "SAMA — Saudi Central Bank", name_ar: "البنك المركزي السعودي — سامة", name_fr: "SAMA — Banque Centrale Saoudienne",
      desc_en: "Saudi Arabia's monetary authority, regulating the banking and insurance sectors and overseeing Vision 2030 financial reforms.",
      desc_ar: "السلطة النقدية في المملكة العربية السعودية، تنظيم القطاعين المصرفي والتأميني وإشراف إصلاحات رؤية 2030.",
      desc_fr: "Autorité monétaire saoudienne réglementant le secteur bancaire et assurantiel dans le cadre de Vision 2030.",
      url: "https://www.sama.gov.sa" },
    { cat: "regul", tag: "Capital Markets",
      name: "CMA — Capital Markets Authority", name_ar: "هيئة السوق المالية", name_fr: "CMA — Autorité des Marchés Financiers",
      desc_en: "Regulator for securities, investment funds and capital markets in Saudi Arabia.",
      desc_ar: "المنظِّم للأوراق المالية وصناديق الاستثمار وأسواق رأس المال في المملكة العربية السعودية.",
      desc_fr: "Régulateur des titres, fonds d'investissement et marchés de capitaux en Arabie Saoudite.",
      url: "https://www.cma.org.sa" },

    /* Retail Banking */
    { cat: "retail", highlight: true, tag: "Largest KSA",
      name: "Al Rajhi Bank", name_ar: "مصرف الراجحي", name_fr: "Al Rajhi Bank",
      desc_en: "Largest Islamic bank in the world by assets. Comprehensive retail and corporate Sharia-compliant banking.",
      desc_ar: "أكبر بنك إسلامي في العالم من حيث الأصول. خدمات مصرفية متكاملة للأفراد والشركات وفق الشريعة.",
      desc_fr: "Plus grande banque islamique au monde en actifs. Services bancaires conformes à la Charia.",
      url: "https://www.alrajhibank.com.sa" },
    { cat: "retail", highlight: true,
      name: "Saudi National Bank (SNB)", name_ar: "البنك الأهلي السعودي", name_fr: "Saudi National Bank",
      desc_en: "Largest bank in Saudi Arabia by assets, formed from the merger of NCB and Samba.",
      desc_ar: "أكبر بنك في المملكة العربية السعودية من حيث الأصول، ناتج عن دمج البنك الأهلي التجاري وسمبا.",
      desc_fr: "Plus grande banque d'Arabie Saoudite en actifs, née de la fusion de NCB et Samba.",
      url: "https://www.alahli.com" },
    { cat: "retail",
      name: "Riyad Bank", name_ar: "بنك الرياض", name_fr: "Riyad Bank",
      desc_en: "One of the largest Saudi banks, offering retail, corporate and investment banking solutions.",
      desc_ar: "أحد أكبر البنوك السعودية، يقدم حلولاً مصرفية للأفراد والشركات والاستثمار.",
      desc_fr: "L'une des plus grandes banques saoudiennes, offrant services retail, corporate et investissement.",
      url: "https://www.riyadbank.com" },
    { cat: "retail",
      name: "Banque Saudi Fransi", name_ar: "البنك السعودي الفرنسي", name_fr: "Banque Saudi Fransi",
      desc_en: "Joint venture with Crédit Agricole, combining international expertise with local banking knowledge.",
      desc_ar: "مشروع مشترك مع كريدي أغريكول، يجمع الخبرة الدولية بالمعرفة المصرفية المحلية.",
      desc_fr: "Joint-venture avec Crédit Agricole, alliant expertise internationale et connaissance bancaire locale.",
      url: "https://www.alfransi.com.sa" },

    /* Islamic Banking */
    { cat: "islam", highlight: true,
      name: "Alinma Bank", name_ar: "مصرف الإنماء", name_fr: "Alinma Bank",
      desc_en: "Fully Sharia-compliant bank focusing on innovation and digital services for Saudi customers.",
      desc_ar: "بنك متوافق تماماً مع أحكام الشريعة الإسلامية، يركز على الابتكار والخدمات الرقمية.",
      desc_fr: "Banque entièrement conforme à la Charia, axée sur l'innovation et les services digitaux.",
      url: "https://www.alinma.com" },
    { cat: "islam",
      name: "Bank AlJazira", name_ar: "بنك الجزيرة", name_fr: "Bank AlJazira",
      desc_en: "Saudi Islamic bank offering tailored financial solutions for individuals and corporations.",
      desc_ar: "بنك إسلامي سعودي يقدم حلولاً مالية مخصصة للأفراد والشركات.",
      desc_fr: "Banque islamique saoudienne proposant des solutions financières sur mesure.",
      url: "https://www.baj.com.sa" },

    /* Corporate Banking */
    { cat: "biz", highlight: true, tag: "International",
      name: "HSBC Saudi Arabia", name_ar: "بنك HSBC السعودية", name_fr: "HSBC Arabie Saoudite",
      desc_en: "International banking leader in KSA, strong in trade finance, capital markets and treasury solutions.",
      desc_ar: "رائد مصرفي دولي في المملكة، قوي في تمويل التجارة وأسواق رأس المال والخزينة.",
      desc_fr: "Leader bancaire international en KSA, fort en trade finance, marchés de capitaux et trésorerie.",
      url: "https://www.business.hsbc.com/en-gb/sa" },
    { cat: "biz",
      name: "Arab National Bank", name_ar: "البنك العربي الوطني", name_fr: "Arab National Bank",
      desc_en: "Saudi bank with Arab Bank Group partnership, specializing in SME and corporate banking.",
      desc_ar: "بنك سعودي بشراكة مجموعة البنك العربي، متخصص في الخدمات المصرفية للشركات الصغيرة والمتوسطة.",
      desc_fr: "Banque saoudienne avec partenariat Arab Bank Group, spécialisée dans les PME et corporate.",
      url: "https://www.anb.com.sa" },

    /* Fintech */
    { cat: "fintech", highlight: true, tag: "Digital Bank",
      name: "STC Pay", name_ar: "STC باي", name_fr: "STC Pay",
      desc_en: "Saudi Arabia's leading digital wallet — payments, transfers and financial services via mobile.",
      desc_ar: "محفظة رقمية رائدة في المملكة — مدفوعات وتحويلات وخدمات مالية عبر الجوال.",
      desc_fr: "Portefeuille digital leader en Arabie Saoudite — paiements, transferts et services financiers mobile.",
      url: "https://www.stcpay.com.sa" },
    { cat: "fintech",
      name: "Tamara", name_ar: "تمارا", name_fr: "Tamara",
      desc_en: "MENA's leading Buy Now Pay Later platform, valued at over USD 1B (unicorn).",
      desc_ar: "منصة الشراء الآن والدفع لاحقاً الرائدة في منطقة MENA، بقيمة تتجاوز مليار دولار.",
      desc_fr: "Plateforme BNPL leader de MENA, valorisée à plus d'1 Mds USD (licorne).",
      url: "https://www.tamara.co" },
    { cat: "fintech",
      name: "Saudi Fintech — Fintech Saudi", name_ar: "فنتك السعودية", name_fr: "Fintech Saudi",
      desc_en: "SAMA initiative to develop KSA's fintech ecosystem and support startups in financial innovation.",
      desc_ar: "مبادرة سامة لتطوير النظام البيئي للتكنولوجيا المالية في المملكة.",
      desc_fr: "Initiative SAMA pour développer l'écosystème fintech saoudien et soutenir les startups.",
      url: "https://www.fintech.sa" },

    /* Investment */
    { cat: "invest", highlight: true, tag: "Sovereign",
      name: "PIF — Public Investment Fund", name_ar: "صندوق الاستثمارات العامة", name_fr: "PIF — Fonds d'Investissement Public",
      desc_en: "Saudi sovereign wealth fund with USD 925B+ AUM, driving Vision 2030 megaprojects worldwide.",
      desc_ar: "الصندوق السيادي السعودي بأصول تجاوزت 925 مليار دولار، يقود المشاريع الكبرى لرؤية 2030.",
      desc_fr: "Fonds souverain saoudien gérant 925 Mds USD+, moteur des mégaprojets Vision 2030 dans le monde.",
      url: "https://www.pif.gov.sa" },
    { cat: "invest",
      name: "Tadawul — Saudi Exchange", name_ar: "تداول — البورصة السعودية", name_fr: "Tadawul — Bourse Saoudienne",
      desc_en: "The Arab world's largest stock exchange, listing 200+ companies with market cap exceeding USD 3T.",
      desc_ar: "أكبر بورصة في العالم العربي، تضم أكثر من 200 شركة بقيمة سوقية تجاوزت 3 تريليون دولار.",
      desc_fr: "Plus grande bourse du monde arabe, 200+ sociétés listées avec capitalisation dépassant 3 000 Mds USD.",
      url: "https://www.saudiexchange.sa" },
  ],

  ma: [
    /* Central Banks / Regulators */
    { cat: "regul", highlight: true, tag: "Fédéral",
      name: "Bank Al-Maghrib (BAM)", name_ar: "بنك المغرب", name_fr: "Bank Al-Maghrib",
      desc_en: "Morocco's central bank, responsible for monetary policy, banking supervision and financial stability.",
      desc_ar: "البنك المركزي للمغرب، مسؤول عن السياسة النقدية والرقابة المصرفية والاستقرار المالي.",
      desc_fr: "Banque centrale du Maroc, responsable de la politique monétaire, supervision bancaire et stabilité financière.",
      url: "https://www.bkam.ma" },
    { cat: "regul", tag: "Capital Markets",
      name: "AMMC — Autorité Marocaine du Marché des Capitaux", name_ar: "AMMC — هيئة سوق الرساميل", name_fr: "AMMC — Marchés de Capitaux",
      desc_en: "Moroccan regulator for capital markets, securities and listed companies.",
      desc_ar: "هيئة تنظيم أسواق رأس المال والأوراق المالية والشركات المدرجة في المغرب.",
      desc_fr: "Autorité marocaine de réglementation des marchés de capitaux, valeurs mobilières et sociétés cotées.",
      url: "https://www.ammc.ma" },

    /* Retail Banking */
    { cat: "retail", highlight: true, tag: "1er Maroc",
      name: "Attijariwafa Bank", name_ar: "التجاري وفا بنك", name_fr: "Attijariwafa Bank",
      desc_en: "Morocco's largest bank and leading pan-African institution with presence in 25+ countries.",
      desc_ar: "أكبر بنك في المغرب وأحد المؤسسات الأفريقية الرائدة بحضور في أكثر من 25 دولة.",
      desc_fr: "Plus grande banque du Maroc et institution panafricaine leader, présente dans 25+ pays.",
      url: "https://www.attijariwafabank.com" },
    { cat: "retail", highlight: true,
      name: "Banque Centrale Populaire (BCP)", name_ar: "البنك الشعبي المركزي", name_fr: "Banque Centrale Populaire",
      desc_en: "Morocco's second-largest bank, strong in retail banking and serving Moroccan diaspora worldwide.",
      desc_ar: "ثاني أكبر بنك في المغرب، قوي في الخدمات المصرفية للأفراد وخدمة المغاربة المقيمين في الخارج.",
      desc_fr: "2e banque du Maroc, forte en retail et dans le service de la diaspora marocaine dans le monde.",
      url: "https://www.gbp.ma" },
    { cat: "retail",
      name: "BMCE Bank of Africa", name_ar: "BMCE بنك أفريقيا", name_fr: "BMCE Bank of Africa",
      desc_en: "Moroccan bank with strong pan-African and international presence across 30+ countries.",
      desc_ar: "بنك مغربي بحضور قوي في أفريقيا وعلى المستوى الدولي في أكثر من 30 دولة.",
      desc_fr: "Banque marocaine avec forte présence panafricaine et internationale dans 30+ pays.",
      url: "https://www.bmcebank.ma" },
    { cat: "retail",
      name: "CIH Bank", name_ar: "بنك CIH", name_fr: "CIH Bank",
      desc_en: "Moroccan bank specializing in real estate financing, savings and consumer credit.",
      desc_ar: "بنك مغربي متخصص في تمويل العقارات والادخار والائتمان الاستهلاكي.",
      desc_fr: "Banque marocaine spécialisée dans le financement immobilier, l'épargne et le crédit à la consommation.",
      url: "https://www.cihbank.ma" },
    { cat: "retail",
      name: "BMCI (BNP Paribas Maroc)", name_ar: "BMCI — BNP باريبا المغرب", name_fr: "BMCI — BNP Paribas Maroc",
      desc_en: "BNP Paribas subsidiary in Morocco, offering full banking services and international connectivity.",
      desc_ar: "شركة تابعة لبنك BNP باريبا في المغرب، تقدم خدمات مصرفية شاملة واتصالاً دولياً.",
      desc_fr: "Filiale de BNP Paribas au Maroc, offrant des services bancaires complets et une connectivité internationale.",
      url: "https://www.bmci.ma" },

    /* Islamic Banking */
    { cat: "islam", highlight: true, tag: "Finance Participative",
      name: "Umnia Bank", name_ar: "أمنية بنك", name_fr: "Umnia Bank",
      desc_en: "Morocco's first fully participative (Islamic) bank, jointly owned by CIH Bank and Qatar International Islamic Bank.",
      desc_ar: "أول بنك تشاركي (إسلامي) متكامل في المغرب، مملوك بالاشتراك بين CIH Bank والبنك الدولي الإسلامي القطري.",
      desc_fr: "Première banque participative complète au Maroc, détenue par CIH Bank et Qatar International Islamic Bank.",
      url: "https://www.umniabank.ma" },
    { cat: "islam",
      name: "BTI Bank", name_ar: "BTI بنك", name_fr: "BTI Bank",
      desc_en: "Moroccan participative bank backed by Banque Centrale Populaire and Islamic Development Bank.",
      desc_ar: "بنك تشاركي مغربي مدعوم من البنك الشعبي المركزي والبنك الإسلامي للتنمية.",
      desc_fr: "Banque participative marocaine soutenue par la BCP et la Banque Islamique de Développement.",
      url: "https://www.btibank.ma" },

    /* Corporate Banking */
    { cat: "biz", highlight: true, tag: "International",
      name: "Société Générale Maroc", name_ar: "سوسيتي جنرال المغرب", name_fr: "Société Générale Maroc",
      desc_en: "Subsidiary of Société Générale Group, specializing in corporate banking and trade finance in Morocco.",
      desc_ar: "شركة تابعة لمجموعة سوسيتي جنرال، متخصصة في الخدمات المصرفية للشركات وتمويل التجارة في المغرب.",
      desc_fr: "Filiale du Groupe Société Générale, spécialisée dans la banque d'entreprises et le trade finance au Maroc.",
      url: "https://www.sgmaroc.com" },
    { cat: "biz",
      name: "CFG Bank", name_ar: "CFG بنك", name_fr: "CFG Bank",
      desc_en: "Moroccan investment and corporate bank known for capital market expertise and SME support.",
      desc_ar: "بنك استثماري ومتخصص مغربي معروف بخبرته في أسواق رأس المال ودعم الشركات الصغيرة والمتوسطة.",
      desc_fr: "Banque d'investissement et d'affaires marocaine, reconnue pour son expertise en marchés de capitaux et le soutien aux PME.",
      url: "https://www.cfg.ma" },

    /* Fintech */
    { cat: "fintech", highlight: true, tag: "Mobile Money",
      name: "M-Wallet (Maroc Telecom)", name_ar: "محفظة M-Wallet اتصالات المغرب", name_fr: "M-Wallet Maroc Telecom",
      desc_en: "Mobile payment and wallet service by Maroc Telecom, widely used for peer transfers and bill payments.",
      desc_ar: "خدمة الدفع عبر الجوال والمحفظة من اتصالات المغرب، تُستخدم على نطاق واسع للتحويلات ودفع الفواتير.",
      desc_fr: "Service de paiement mobile et portefeuille de Maroc Telecom, très utilisé pour transferts et factures.",
      url: "https://www.iam.ma/Particulier/Telephonie-Mobile/M-Wallet" },
    { cat: "fintech",
      name: "Casablanca Finance City (CFC)", name_ar: "مركز كازابلانكا للمال", name_fr: "Casablanca Finance City",
      desc_en: "Africa's leading financial hub based in Casablanca, hosting 200+ international financial firms.",
      desc_ar: "المركز المالي الرائد في أفريقيا في الدار البيضاء، يضم أكثر من 200 شركة مالية دولية.",
      desc_fr: "Hub financier leader d'Afrique basé à Casablanca, regroupant 200+ firmes financières internationales.",
      url: "https://www.casablancafinancecity.com" },

    /* Investment */
    { cat: "invest", highlight: true, tag: "Bourse",
      name: "Bourse de Casablanca", name_ar: "بورصة الدار البيضاء", name_fr: "Bourse de Casablanca",
      desc_en: "Morocco's stock exchange, one of Africa's most dynamic, listing 75+ companies across all sectors.",
      desc_ar: "بورصة المغرب، من أكثر الأسواق المالية الأفريقية ديناميكية، تضم أكثر من 75 شركة.",
      desc_fr: "Bourse du Maroc, l'une des plus dynamiques d'Afrique, listant 75+ sociétés dans tous les secteurs.",
      url: "https://www.casablanca-bourse.com" },
    { cat: "invest",
      name: "CDG — Caisse de Dépôt et de Gestion", name_ar: "CDG — صندوق الإيداع والتدبير", name_fr: "CDG — Caisse de Dépôt",
      desc_en: "Morocco's state investment institution managing long-term savings and financing strategic national projects.",
      desc_ar: "مؤسسة الاستثمار الحكومية المغربية تدير المدخرات طويلة الأجل وتمويل المشاريع الوطنية الاستراتيجية.",
      desc_fr: "Institution d'investissement étatique marocaine, gérant l'épargne longue et finançant les projets stratégiques nationaux.",
      url: "https://www.cdg.ma" },
  ],
};

/* ─── Component ──────────────────────────────────────────────────────── */
export function ScreenBanques() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const [country, setCountry] = useState<CountryKey>("ae");
  const [cat, setCat]         = useState<CatKey | "all">("all");

  const country_meta = COUNTRIES.find(c => c.key === country)!;
  const services     = SERVICES[country];
  const kpis         = KPIS[country];

  const label = (s: BService) => lang === "ar" ? s.name_ar : lang === "fr" ? s.name_fr : s.name;
  const desc  = (s: BService) => lang === "ar" ? s.desc_ar : lang === "fr" ? s.desc_fr : s.desc_en;
  const catLabel = (c: (typeof CATS)[0]) => lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en;
  const tagline = lang === "ar" ? country_meta.tagline_ar : lang === "fr" ? country_meta.tagline_fr : country_meta.tagline_en;

  const filtered = cat === "all" ? services : services.filter(s => s.cat === cat);

  /* group by category for the "all" view */
  const grouped = CATS.map(c => ({
    ...c,
    items: services.filter(s => s.cat === c.key),
  })).filter(g => g.items.length > 0);

  const topbarTitle = lang === "ar" ? "البنوك" : lang === "fr" ? "Banques" : "Banks";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={topbarTitle} />

      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-cream)" }}>

        {/* ── Hero dark card ── */}
        <div style={{
          background: "linear-gradient(135deg, #0d1b2a 0%, #1a2d4a 50%, #0a2240 100%)",
          padding: isMob ? "24px 16px 20px" : "32px 36px 28px",
        }}>
          {/* Country selector */}
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

          {/* Title + tagline */}
          <div className="font-display" style={{ fontSize: isMob ? 24 : 30, color: "#fff", letterSpacing: "0.02em", marginBottom: 8 }}>
            {topbarTitle}
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", maxWidth: 580, lineHeight: 1.6, marginBottom: 24 }}>
            {tagline}
          </div>

          {/* KPI stats */}
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
        </div>

        {/* ── Category filter pills ── */}
        <div style={{ padding: isMob ? "14px 12px" : "16px 24px", background: "var(--bg-paper)", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: 8, overflowX: "auto", flexWrap: isMob ? "nowrap" : "wrap" }}>
          <button
            onClick={() => setCat("all")}
            style={{
              padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              background: cat === "all" ? "var(--gold)" : "var(--bg-ivory)",
              color: cat === "all" ? "#1A1610" : "var(--ink-3)",
              border: cat === "all" ? "1px solid var(--gold)" : "1px solid var(--line-soft)",
            }}
          >
            {lang === "ar" ? "الكل" : lang === "fr" ? "Tout" : "All"}
            <span style={{ marginInlineStart: 6, fontSize: 10, opacity: 0.7 }}>{services.length}</span>
          </button>
          {CATS.map(c => {
            const count = services.filter(s => s.cat === c.key).length;
            if (count === 0) return null;
            const active = cat === c.key;
            return (
              <button key={c.key} onClick={() => setCat(c.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: active ? 600 : 400,
                  cursor: "pointer", whiteSpace: "nowrap",
                  background: active ? `${c.color}18` : "var(--bg-ivory)",
                  color: active ? c.color : "var(--ink-3)",
                  border: active ? `1px solid ${c.color}` : "1px solid var(--line-soft)",
                }}
              >
                <span style={{ width: 13, height: 13, display: "inline-flex", alignItems: "center", justifyContent: "center", color: active ? c.color : "var(--ink-4)" }}>{c.icon}</span>
                {catLabel(c)}
                <span style={{ fontSize: 10, opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Service cards ── */}
        <div style={{ padding: isMob ? "16px 12px" : "24px 24px" }}>
          {cat === "all" ? (
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
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceCard({ s, catColor, label, desc }: {
  s: BService;
  catColor: string;
  label: (s: BService) => string;
  desc: (s: BService) => string;
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
