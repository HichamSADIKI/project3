"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Ic } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";

/* ─── Domain icons ─────────────────────────────────────────────────── */
const IcImmo    = () => <Ic><path d="M3 21V10l9-7 9 7v11"/><path d="M9 21v-7h6v7"/></Ic>;
const IcVisa2   = () => <Ic><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h3M13 15h5"/></Ic>;
const IcBiz     = () => <Ic><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M12 12v5M9.5 12H15"/></Ic>;
const IcFiscal  = () => <Ic><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 6-7"/></Ic>;
const IcSante2  = () => <Ic><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Ic>;
const IcPermis  = () => <Ic><path d="M3 21h18M3 10h18M3 7l9-4 9 4M6 10v11M10 10v11M14 10v11M18 10v11"/></Ic>;

/* ─── Types ─────────────────────────────────────────────────────────── */
type CountryKey = "ae" | "sa" | "ma";
type DomainKey  = "immo" | "visa" | "biz" | "fiscal" | "sante" | "permis";

interface Service {
  name: string;
  name_ar: string;
  name_fr: string;
  desc_en: string;
  desc_ar: string;
  desc_fr: string;
  url: string;
  domain: DomainKey;
  tag?: string;
}

/* ─── Domain meta ────────────────────────────────────────────────────── */
const DOMAINS: { key: DomainKey; en: string; ar: string; fr: string; icon: React.ReactElement; color: string }[] = [
  { key: "immo",   en: "Real Estate",  ar: "العقارات",       fr: "Immobilier",       icon: <IcImmo />,   color: "var(--gold)" },
  { key: "visa",   en: "Visa & Stay",  ar: "التأشيرة والإقامة", fr: "Visa & Séjour",  icon: <IcVisa2 />,  color: "var(--azure)" },
  { key: "biz",    en: "Business",     ar: "الأعمال",         fr: "Entreprise",       icon: <IcBiz />,    color: "var(--emerald)" },
  { key: "fiscal", en: "Tax & Finance",ar: "الضرائب والمالية", fr: "Fiscal",          icon: <IcFiscal />, color: "#F59E0B" },
  { key: "sante",  en: "Health",       ar: "الصحة",           fr: "Santé",            icon: <IcSante2 />, color: "var(--rose)" },
  { key: "permis", en: "Permits",      ar: "تراخيص البناء",   fr: "Permis",           icon: <IcPermis />, color: "#8B5CF6" },
];

/* ─── Country meta ───────────────────────────────────────────────────── */
const COUNTRIES: { key: CountryKey; flag: string; en: string; ar: string; fr: string; hero_en: string; hero_ar: string; hero_fr: string }[] = [
  {
    key: "ae", flag: "🇦🇪",
    en: "UAE", ar: "الإمارات", fr: "EAU",
    hero_en: "United Arab Emirates · Federal & Emirate services",
    hero_ar: "الإمارات العربية المتحدة · خدمات اتحادية وإماراتية",
    hero_fr: "Émirats Arabes Unis · Services fédéraux et émirats",
  },
  {
    key: "sa", flag: "🇸🇦",
    en: "KSA", ar: "المملكة", fr: "Arabie Saoudite",
    hero_en: "Kingdom of Saudi Arabia · Vision 2030 digital services",
    hero_ar: "المملكة العربية السعودية · خدمات رقمية لرؤية 2030",
    hero_fr: "Arabie Saoudite · Services numériques Vision 2030",
  },
  {
    key: "ma", flag: "🇲🇦",
    en: "Morocco", ar: "المغرب", fr: "Maroc",
    hero_en: "Kingdom of Morocco · Administrative portal services",
    hero_ar: "المملكة المغربية · خدمات بوابة الإدارة",
    hero_fr: "Royaume du Maroc · Services du portail administratif",
  },
];

/* ─── Service data ───────────────────────────────────────────────────── */
const SERVICES: Record<CountryKey, Service[]> = {
  ae: [
    /* Immobilier */
    { domain: "immo", tag: "Dubai",     name: "Dubai Land Department",     name_ar: "دائرة الأراضي والأملاك",    name_fr: "Département des Terres de Dubaï",  url: "https://www.dubailand.gov.ae",  desc_en: "Property registration, title deeds, valuation and real estate services in Dubai.", desc_ar: "تسجيل العقارات وسندات الملكية والتقييم في دبي.", desc_fr: "Enregistrement immobilier, titres de propriété et évaluation à Dubaï." },
    { domain: "immo", tag: "Dubai",     name: "RERA",                      name_ar: "مؤسسة التنظيم العقاري",    name_fr: "RERA",                             url: "https://www.rpdubai.ae",        desc_en: "Real Estate Regulatory Agency — licensing brokers and developers in Dubai.", desc_ar: "الجهة التنظيمية للوسطاء والمطورين العقاريين في دبي.", desc_fr: "Agence de réglementation immobilière — licences courtiers et promoteurs." },
    { domain: "immo", tag: "Abu Dhabi", name: "TAMM",                      name_ar: "تمّ",                        name_fr: "TAMM",                             url: "https://www.tamm.abudhabi",     desc_en: "Abu Dhabi's unified government services portal — property, business and more.", desc_ar: "بوابة خدمات حكومة أبوظبي الموحدة للعقارات والأعمال وغيرها.", desc_fr: "Portail unifié des services gouvernementaux d'Abu Dhabi." },
    { domain: "immo", tag: "Abu Dhabi", name: "Abu Dhabi DMA",             name_ar: "بلدية أبوظبي",              name_fr: "Municipalité d'Abu Dhabi",         url: "https://www.dma.gov.ae",        desc_en: "Department of Municipalities and Transport — planning and permits.", desc_ar: "دائرة البلديات والنقل — التخطيط والتراخيص.", desc_fr: "Département des Municipalités et Transports — planification et permis." },
    /* Visa */
    { domain: "visa", tag: "Dubai",     name: "GDRFA Dubai",               name_ar: "إدارة الإقامة والجوازات",  name_fr: "GDRFA Dubaï",                      url: "https://www.gdrfad.gov.ae",     desc_en: "General Directorate of Residency — visas, residence permits and immigration.", desc_ar: "الإدارة العامة للإقامة والشؤون الأجنبية — التأشيرات والإقامة.", desc_fr: "Direction de la résidence et de l'immigration à Dubaï." },
    { domain: "visa", tag: "Fédéral",   name: "ICA",                       name_ar: "الهيئة الاتحادية للهوية",  name_fr: "ICA",                              url: "https://www.ica.gov.ae",        desc_en: "Federal Authority for Identity, Citizenship, Customs and Port Security.", desc_ar: "الهيئة الاتحادية للهوية والجنسية والجمارك وأمن المنافذ.", desc_fr: "Autorité fédérale d'identité, citoyenneté, douanes et sécurité des ports." },
    { domain: "visa", tag: "Fédéral",   name: "MOHRE",                     name_ar: "وزارة الموارد البشرية",    name_fr: "MOHRE",                            url: "https://www.mohre.gov.ae",      desc_en: "Ministry of Human Resources — work permits, labour contracts, Tawteen.", desc_ar: "وزارة الموارد البشرية والتوطين — تصاريح العمل والعقود.", desc_fr: "Ministère des Ressources Humaines — permis de travail, contrats, Emiratisation." },
    /* Entreprise */
    { domain: "biz",  tag: "Dubai",     name: "DED Dubai",                 name_ar: "دائرة الاقتصاد والسياحة", name_fr: "DED Dubaï",                        url: "https://www.dubaided.gov.ae",   desc_en: "Department of Economy & Tourism — trade licences and commercial registration.", desc_ar: "دائرة الاقتصاد والسياحة — التراخيص التجارية والتسجيل.", desc_fr: "Département de l'Économie et du Tourisme — licences commerciales." },
    { domain: "biz",  tag: "Abu Dhabi", name: "ADIO",                      name_ar: "مكتب أبوظبي للاستثمار",   name_fr: "ADIO",                             url: "https://www.investinabudhabi.ae", desc_en: "Abu Dhabi Investment Office — foreign investment incentives and licensing.", desc_ar: "مكتب الاستثمار في أبوظبي — حوافز الاستثمار الأجنبي.", desc_fr: "Bureau d'investissement d'Abu Dhabi — incitations et licences." },
    { domain: "biz",  tag: "Fédéral",   name: "DIFC",                      name_ar: "مركز دبي المالي الدولي",   name_fr: "DIFC",                             url: "https://www.difc.ae",           desc_en: "Dubai International Financial Centre — offshore company setup and regulation.", desc_ar: "مركز دبي المالي الدولي — تأسيس الشركات الخارجية.", desc_fr: "Centre financier international de Dubaï — création de sociétés offshore." },
    /* Fiscal */
    { domain: "fiscal", tag: "Fédéral", name: "FTA",                       name_ar: "الهيئة الاتحادية للضرائب", name_fr: "Autorité Fiscale Fédérale",        url: "https://www.tax.gov.ae",        desc_en: "Federal Tax Authority — VAT registration, filing and corporate tax.", desc_ar: "الهيئة الاتحادية للضرائب — تسجيل ضريبة القيمة المضافة وضريبة الشركات.", desc_fr: "Autorité fiscale fédérale — TVA, déclarations et impôt sur les sociétés." },
    { domain: "fiscal", tag: "Fédéral", name: "MOF UAE",                   name_ar: "وزارة المالية",             name_fr: "Ministère des Finances EAU",       url: "https://www.mof.gov.ae",        desc_en: "Ministry of Finance — public budget, economic policy and fiscal planning.", desc_ar: "وزارة المالية — الميزانية العامة والسياسة الاقتصادية.", desc_fr: "Ministère des Finances — budget public et politique économique." },
    /* Santé */
    { domain: "sante", tag: "Dubai",    name: "DHA",                       name_ar: "هيئة الصحة في دبي",        name_fr: "Autorité Sanitaire de Dubaï",      url: "https://www.dha.gov.ae",        desc_en: "Dubai Health Authority — licensing, insurance and healthcare facilities.", desc_ar: "هيئة الصحة بدبي — الترخيص والتأمين الصحي والمنشآت الطبية.", desc_fr: "Autorité sanitaire de Dubaï — licences, assurance et établissements de santé." },
    { domain: "sante", tag: "Abu Dhabi",name: "DOH",                       name_ar: "دائرة الصحة أبوظبي",       name_fr: "DOH Abu Dhabi",                    url: "https://www.doh.gov.ae",        desc_en: "Department of Health Abu Dhabi — medical fitness, Malaffi, Thiqa.", desc_ar: "دائرة الصحة في أبوظبي — اللياقة الطبية ونظام ملفي وثيقة.", desc_fr: "Département de Santé d'Abu Dhabi — aptitude médicale, Malaffi, Thiqa." },
    /* Permis */
    { domain: "permis", tag: "Dubai",   name: "Dubai Municipality",        name_ar: "بلدية دبي",                name_fr: "Municipalité de Dubaï",            url: "https://www.dm.gov.ae",         desc_en: "Building permits, inspections, environment and public health regulation.", desc_ar: "تراخيص البناء والتفتيش والبيئة والصحة العامة.", desc_fr: "Permis de construire, inspections, environnement et santé publique." },
    { domain: "permis", tag: "Abu Dhabi",name: "Abu Dhabi City Municipality",name_ar: "أمانة مدينة أبوظبي",     name_fr: "Mairie d'Abu Dhabi",               url: "https://www.dmt.gov.ae",        desc_en: "Zoning, construction permits and urban planning in Abu Dhabi.", desc_ar: "التخطيط العمراني وتراخيص البناء في أبوظبي.", desc_fr: "Urbanisme, permis de construire et planification à Abu Dhabi." },
  ],
  sa: [
    /* Immobilier */
    { domain: "immo", tag: "وطني",      name: "REGA",                      name_ar: "الهيئة العامة للعقار",     name_fr: "REGA",                             url: "https://www.rega.gov.sa",       desc_en: "Real Estate General Authority — licensing, registration and market regulation.", desc_ar: "الهيئة العامة للعقار — الترخيص والتسجيل وتنظيم السوق العقاري.", desc_fr: "Autorité générale immobilière — licences, enregistrement et régulation du marché." },
    { domain: "immo", tag: "وطني",      name: "Sakani",                    name_ar: "سكني",                      name_fr: "Sakani",                           url: "https://www.sakani.com.sa",     desc_en: "National housing platform — residential units for Saudi citizens.", desc_ar: "منصة الإسكان الوطنية — وحدات سكنية للمواطنين السعوديين.", desc_fr: "Plateforme nationale du logement — unités résidentielles pour les citoyens." },
    { domain: "immo", tag: "وطني",      name: "Wathq",                     name_ar: "وثق",                       name_fr: "Wathq",                            url: "https://wathq.sa",              desc_en: "Real estate documentation and authentication platform.", desc_ar: "منصة توثيق العقود والمعاملات العقارية.", desc_fr: "Plateforme de documentation et d'authentification immobilière." },
    /* Visa */
    { domain: "visa", tag: "وطني",      name: "Absher",                    name_ar: "أبشر",                      name_fr: "Absher",                           url: "https://www.absher.sa",         desc_en: "National digital portal — residency, iqama, passport and civil services.", desc_ar: "البوابة الرقمية الوطنية — الإقامة والجواز والخدمات المدنية.", desc_fr: "Portail national — résidence, iqama, passeport et services civils." },
    { domain: "visa", tag: "وطني",      name: "Jawazat",                   name_ar: "الجوازات",                  name_fr: "Jawazat",                          url: "https://www.moi.gov.sa",        desc_en: "General Directorate of Passports — iqama renewal, exit/re-entry visa.", desc_ar: "الجوازات — تجديد الإقامة وتأشيرة الخروج والعودة.", desc_fr: "Direction des Passeports — renouvellement iqama, visa sortie/retour." },
    { domain: "visa", tag: "وطني",      name: "Mudad",                     name_ar: "مدد",                       name_fr: "Mudad",                            url: "https://www.mudad.com.sa",      desc_en: "Wage protection and labour compliance platform (Nitaqat).", desc_ar: "منصة حماية الأجور والامتثال العمالي (نطاقات).", desc_fr: "Protection des salaires et conformité du travail (Nitaqat)." },
    /* Entreprise */
    { domain: "biz",  tag: "وطني",      name: "Maroof",                    name_ar: "معروف",                     name_fr: "Maroof",                           url: "https://www.maroof.sa",         desc_en: "E-commerce verification platform — trusted online businesses.", desc_ar: "منصة التحقق من المتاجر الإلكترونية الموثوقة.", desc_fr: "Plateforme de vérification e-commerce — commerces en ligne certifiés." },
    { domain: "biz",  tag: "وطني",      name: "Etimad",                    name_ar: "اعتماد",                    name_fr: "Etimad",                           url: "https://www.etimad.sa",         desc_en: "Government contracting and procurement portal for businesses.", desc_ar: "منصة التعاقد الحكومي والمشتريات للأعمال.", desc_fr: "Portail des marchés publics et contrats gouvernementaux." },
    { domain: "biz",  tag: "وطني",      name: "MISA",                      name_ar: "وزارة الاستثمار",           name_fr: "MISA",                             url: "https://www.misa.gov.sa",       desc_en: "Ministry of Investment — foreign investment licences and incentives.", desc_ar: "وزارة الاستثمار — تراخيص الاستثمار الأجنبي والحوافز.", desc_fr: "Ministère de l'Investissement — licences et incitations pour investisseurs étrangers." },
    /* Fiscal */
    { domain: "fiscal", tag: "وطني",    name: "ZATCA",                     name_ar: "هيئة الزكاة والضريبة",     name_fr: "ZATCA",                            url: "https://www.zatca.gov.sa",      desc_en: "Zakat, Tax and Customs Authority — VAT, corporate tax and customs.", desc_ar: "هيئة الزكاة والضريبة والجمارك — ضريبة القيمة المضافة والجمارك.", desc_fr: "Autorité de la Zakat, Taxe et Douanes — TVA, impôt et douanes." },
    /* Santé */
    { domain: "sante", tag: "وطني",     name: "MOH Saudi Arabia",          name_ar: "وزارة الصحة",              name_fr: "Ministère de la Santé KSA",        url: "https://www.moh.gov.sa",        desc_en: "Ministry of Health — medical facilities, vaccination and health licensing.", desc_ar: "وزارة الصحة — المنشآت الطبية والتطعيم والترخيص.", desc_fr: "Ministère de la Santé — établissements médicaux, vaccination et licences." },
    { domain: "sante", tag: "وطني",     name: "Seha Virtual Hospital",     name_ar: "مستشفى صحة الافتراضي",    name_fr: "Seha Virtual Hospital",            url: "https://svh.com.sa",            desc_en: "National virtual hospital — telemedicine and remote specialist consultations.", desc_ar: "المستشفى الافتراضي الوطني — الطب عن بُعد واستشارات المتخصصين.", desc_fr: "Hôpital virtuel national — télémédecine et consultations à distance." },
    /* Permis */
    { domain: "permis", tag: "وطني",    name: "Balady",                    name_ar: "بلدي",                      name_fr: "Balady",                           url: "https://www.balady.gov.sa",     desc_en: "Municipal services portal — building permits, land use and urban planning.", desc_ar: "بوابة الخدمات البلدية — تراخيص البناء واستخدام الأراضي.", desc_fr: "Portail municipal — permis de construire, usage des sols et urbanisme." },
  ],
  ma: [
    /* Immobilier */
    { domain: "immo", tag: "National",  name: "ANCFCC",                    name_ar: "الوكالة الوطنية للمحافظة العقارية", name_fr: "ANCFCC",                    url: "https://www.ancfcc.gov.ma",     desc_en: "National Agency for Land Conservation — property registration and title deeds.", desc_ar: "الوكالة الوطنية للمحافظة العقارية — تسجيل الملكية وسندات الملكية.", desc_fr: "Conservation foncière — immatriculation, titres fonciers et publicité immobilière." },
    { domain: "immo", tag: "National",  name: "idarati.ma",                name_ar: "إدارتي",                    name_fr: "idarati.ma",                       url: "https://www.idarati.ma",        desc_en: "Morocco's citizen administrative portal — property, civil status and more.", desc_ar: "بوابة الإدارة المغربية للمواطنين — العقارات والحالة المدنية وغيرها.", desc_fr: "Portail administratif citoyen du Maroc — propriété, état civil et plus." },
    /* Visa */
    { domain: "visa", tag: "National",  name: "DGSN",                      name_ar: "المديرية العامة للأمن",     name_fr: "DGSN",                             url: "https://www.dgsn.ma",           desc_en: "General Directorate of National Security — residence cards and immigration.", desc_ar: "المديرية العامة للأمن الوطني — بطاقات الإقامة والهجرة.", desc_fr: "Direction Générale de la Sûreté Nationale — titres de séjour et immigration." },
    { domain: "visa", tag: "National",  name: "Portail National de l'Emploi", name_ar: "بوابة الشغل الوطنية",   name_fr: "Portail National de l'Emploi",     url: "https://www.emploi.gov.ma",     desc_en: "National employment portal — work authorisations and labour contracts.", desc_ar: "بوابة التشغيل الوطنية — تصاريح العمل وعقود الشغل.", desc_fr: "Portail national de l'emploi — autorisations de travail et contrats." },
    /* Entreprise */
    { domain: "biz",  tag: "National",  name: "OMPIC",                     name_ar: "المكتب المغربي للملكية الصناعية", name_fr: "OMPIC",                    url: "https://www.ompic.ma",          desc_en: "Office for Industrial and Commercial Property — company registration and trademarks.", desc_ar: "مكتب الملكية الصناعية والتجارية — تسجيل الشركات والعلامات التجارية.", desc_fr: "Office Marocain de la Propriété Industrielle — enregistrement sociétés et marques." },
    { domain: "biz",  tag: "National",  name: "CRI — Centres Régionaux",   name_ar: "مراكز الجهوية للاستثمار", name_fr: "CRI",                              url: "https://www.invest.gov.ma",     desc_en: "Regional Investment Centres — one-stop shop for business creation in Morocco.", desc_ar: "مراكز الجهوية للاستثمار — شباك واحد لإنشاء الأعمال في المغرب.", desc_fr: "Guichet unique pour la création d'entreprise et l'investissement au Maroc." },
    { domain: "biz",  tag: "National",  name: "Portail des Entreprises",   name_ar: "بوابة المقاولات",          name_fr: "Portail Entreprises",              url: "https://www.portail.tax.gov.ma",desc_en: "Business portal — online corporate tax filing and company declarations.", desc_ar: "بوابة المقاولات — التصريح بالضريبة وإيداع الوثائق إلكترونياً.", desc_fr: "Portail entreprises — déclaration IS, dépôt des états de synthèse en ligne." },
    /* Fiscal */
    { domain: "fiscal", tag: "National",name: "DGI Maroc",                 name_ar: "المديرية العامة للضرائب",  name_fr: "DGI Maroc",                        url: "https://www.tax.gov.ma",        desc_en: "General Directorate of Taxes — income tax, VAT and corporate declarations.", desc_ar: "المديرية العامة للضرائب — الضريبة على الدخل والقيمة المضافة والشركات.", desc_fr: "Direction Générale des Impôts — IR, TVA, IS et déclarations en ligne." },
    { domain: "fiscal", tag: "National",name: "CNSS",                      name_ar: "الصندوق الوطني للضمان الاجتماعي", name_fr: "CNSS",                    url: "https://www.cnss.ma",           desc_en: "National Social Security Fund — employee contributions and benefits declaration.", desc_ar: "الصندوق الوطني للضمان الاجتماعي — اشتراكات وتصريح الأجور.", desc_fr: "Caisse Nationale de Sécurité Sociale — cotisations et déclarations de salaires." },
    /* Santé */
    { domain: "sante", tag: "National", name: "Ministère de la Santé",     name_ar: "وزارة الصحة",             name_fr: "Ministère de la Santé",            url: "https://www.sante.gov.ma",      desc_en: "Morocco Ministry of Health — public hospitals, medical licences and health data.", desc_ar: "وزارة الصحة المغربية — المستشفيات والترخيص الطبي.", desc_fr: "Ministère de la Santé — hôpitaux publics, licences médicales et données de santé." },
    { domain: "sante", tag: "National", name: "CNOPS",                     name_ar: "الصندوق الوطني لمنظمات الاحتياط الاجتماعي", name_fr: "CNOPS",           url: "https://www.cnops.org.ma",      desc_en: "National Fund for Social Welfare Organisations — public servant health coverage.", desc_ar: "الصندوق الوطني لمنظمات الاحتياط الاجتماعي — التغطية الصحية للموظفين.", desc_fr: "Couverture santé des fonctionnaires et agents de l'État marocain." },
    /* Permis */
    { domain: "permis", tag: "National",name: "Agences Urbaines",          name_ar: "الوكالات الحضرية",         name_fr: "Agences Urbaines",                 url: "https://www.au-casablanca.ma",  desc_en: "Urban agencies — building permits, zoning plans and urban development.", desc_ar: "الوكالات الحضرية — رخص البناء والتخطيط العمراني.", desc_fr: "Permis de construire, plans d'aménagement et développement urbain au Maroc." },
    { domain: "permis", tag: "National",name: "Communes & Arrondissements",name_ar: "الجماعات الترابية",        name_fr: "Communes",                         url: "https://www.radeema.ma",        desc_en: "Local communes — civil status, certificates of residence and local taxation.", desc_ar: "الجماعات المحلية — الحالة المدنية وشهادات الإقامة والضرائب المحلية.", desc_fr: "État civil, certificats de résidence et taxes locales auprès des communes." },
  ],
};

/* ─── Service Card ────────────────────────────────────────────────────── */
function ServiceCard({ s, lang, isMob }: { s: Service; lang: string; isMob: boolean }) {
  const domain = DOMAINS.find(d => d.key === s.domain)!;
  const name = lang === "ar" ? s.name_ar : lang === "fr" ? s.name_fr : s.name;
  const desc = lang === "ar" ? s.desc_ar : lang === "fr" ? s.desc_fr : s.desc_en;
  return (
    <div style={{
      padding: isMob ? 14 : 18,
      background: "var(--bg-paper)",
      border: "1px solid var(--line-soft)",
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
          background: `color-mix(in srgb, ${domain.color} 12%, transparent)`,
          border: `1px solid color-mix(in srgb, ${domain.color} 25%, transparent)`,
          display: "grid", placeItems: "center",
          color: domain.color,
        }}>
          {domain.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: lang === "ar" ? 13.5 : 13, fontWeight: 600, lineHeight: 1.3 }}
            className={lang === "ar" ? "font-ar" : undefined}>{name}</div>
          {s.tag && (
            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "var(--bg-inset)", color: "var(--ink-4)", border: "1px solid var(--line-soft)", marginTop: 4, display: "inline-block" }}>{s.tag}</span>
          )}
        </div>
      </div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.55, flex: 1 }}
        className={lang === "ar" ? "font-ar" : undefined}>{desc}</div>
      <a
        href={s.url} target="_blank" rel="noopener noreferrer"
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          padding: "7px 14px", borderRadius: "var(--r-sm)",
          background: "var(--bg-inset)", border: "1px solid var(--line-soft)",
          fontSize: 12, fontWeight: 500, color: "var(--ink-2)",
          textDecoration: "none", cursor: "pointer",
          transition: "all 0.15s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = domain.color; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = domain.color; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-inset)"; e.currentTarget.style.color = "var(--ink-2)"; e.currentTarget.style.borderColor = "var(--line-soft)"; }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        {lang === "ar" ? "فتح البوابة" : lang === "fr" ? "Accéder" : "Open portal"}
      </a>
    </div>
  );
}

/* ─── Main screen ────────────────────────────────────────────────────── */
export function ScreenAdministrations() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const isTab = bp === "tablet";

  const [country,  setCountry]  = useState<CountryKey>("ae");
  const [domain,   setDomain]   = useState<DomainKey | "all">("all");

  const countryMeta = COUNTRIES.find(c => c.key === country)!;
  const services    = SERVICES[country];
  const filtered    = domain === "all" ? services : services.filter(s => s.domain === domain);

  const heroTitle = lang === "ar" ? countryMeta.hero_ar : lang === "fr" ? countryMeta.hero_fr : countryMeta.hero_en;
  const domainLabel = (d: typeof DOMAINS[0]) => lang === "ar" ? d.ar : lang === "fr" ? d.fr : d.en;

  const cols = isMob ? "1fr" : isTab ? "repeat(2, 1fr)" : "repeat(3, 1fr)";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar
        title={lang === "ar" ? "الخدمات الإدارية" : lang === "fr" ? "Services Administratifs" : "Administrative Services"}
        crumb={isMob ? [] : [countryMeta.flag + " " + (lang === "ar" ? countryMeta.ar : lang === "fr" ? countryMeta.fr : countryMeta.en), `${filtered.length} services`]}
      />

      <main style={{ flex: 1, padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 18, background: "var(--bg-cream)", overflow: "auto" }}>

        {/* Hero card */}
        <div className="sgi-card-elevated" style={{
          padding: isMob ? 18 : 28,
          background: "linear-gradient(135deg, var(--ink) 0%, #1C2B3A 100%)",
          color: "var(--bg-ivory)", border: "1px solid var(--ink)",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", insetInlineEnd: isMob ? -30 : -10, top: -20, fontSize: isMob ? 90 : 120, opacity: 0.18, lineHeight: 1 }}>
            {countryMeta.flag}
          </div>
          <Eyebrow style={{ color: "var(--gold)" }}>
            {lang === "ar" ? "الخدمات الحكومية الرقمية" : lang === "fr" ? "Services gouvernementaux numériques" : "Digital government services"}
          </Eyebrow>
          <div className="font-display" style={{ fontSize: isMob ? 22 : 32, marginTop: 8, lineHeight: 1.2 }}>{heroTitle}</div>
          <div style={{ marginTop: 18, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COUNTRIES.map(c => (
              <button
                key={c.key}
                onClick={() => { setCountry(c.key); setDomain("all"); }}
                style={{
                  padding: isMob ? "8px 14px" : "10px 18px",
                  borderRadius: "var(--r)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 8,
                  background: c.key === country ? "var(--gold)" : "rgba(255,255,255,0.08)",
                  color: c.key === country ? "var(--ink)" : "var(--bg-ivory)",
                  border: c.key === country ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.15)",
                  transition: "all 0.18s",
                }}
              >
                <span style={{ fontSize: 20 }}>{c.flag}</span>
                <span>{lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Domain filter */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {[{ key: "all" as const, en: "All", ar: "الكل", fr: "Tous", color: "var(--ink-3)" }, ...DOMAINS].map(d => {
            const isActive = domain === d.key;
            const label = lang === "ar" ? d.ar : lang === "fr" ? d.fr : d.en;
            const color = "color" in d ? d.color : "var(--ink-3)";
            return (
              <button
                key={d.key}
                onClick={() => setDomain(d.key as DomainKey | "all")}
                style={{
                  padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 6,
                  background: isActive ? color : "var(--bg-paper)",
                  color: isActive ? "#fff" : "var(--ink-3)",
                  border: `1px solid ${isActive ? color : "var(--line-soft)"}`,
                  transition: "all 0.15s",
                }}
              >
                {"icon" in d && <span style={{ width: 14, height: 14, display: "grid", placeItems: "center" }}>{d.icon}</span>}
                {label}
                <span style={{ fontSize: 10, opacity: 0.8 }}>
                  {d.key === "all" ? services.length : services.filter(s => s.domain === d.key).length}
                </span>
              </button>
            );
          })}
        </div>

        {/* Section par domaine ou grille filtrée */}
        {domain === "all" ? (
          DOMAINS.map(dom => {
            const domServices = services.filter(s => s.domain === dom.key);
            if (!domServices.length) return null;
            return (
              <section key={dom.key}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 6, background: `color-mix(in srgb, ${dom.color} 15%, transparent)`, display: "grid", placeItems: "center", color: dom.color }}>
                    {dom.icon}
                  </div>
                  <div>
                    <div className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: 16, fontWeight: 600 }}>
                      {domainLabel(dom)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{domServices.length} services</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>
                  {domServices.map((s, i) => <ServiceCard key={i} s={s} lang={lang} isMob={isMob} />)}
                </div>
              </section>
            );
          })
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>
            {filtered.map((s, i) => <ServiceCard key={i} s={s} lang={lang} isMob={isMob} />)}
          </div>
        )}

      </main>
    </div>
  );
}
