"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Ic } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";

/* ─── Category icons ────────────────────────────────────────────────── */
const IcCloud    = () => <Ic><path d="M18 10a6 6 0 0 0-12 0 4 4 0 0 0 0 8h12a4 4 0 0 0 0-8z"/></Ic>;
const IcShop     = () => <Ic><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/></Ic>;
const IcBox      = () => <Ic><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></Ic>;
const IcTruck    = () => <Ic><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 5v4h-7V8z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></Ic>;
const IcAds      = () => <Ic><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Ic>;
const IcPay      = () => <Ic><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></Ic>;

/* ─── Types ──────────────────────────────────────────────────────────── */
type CountryKey = "ae" | "sa" | "ma";
type CatKey     = "cloud" | "business" | "marketplace" | "logistique" | "ads" | "pay";

interface AService {
  name: string; name_ar: string; name_fr: string;
  desc_en: string; desc_ar: string; desc_fr: string;
  url: string; cat: CatKey; tag?: string;
  highlight?: boolean;
}

/* ─── Category meta ──────────────────────────────────────────────────── */
const CATS: { key: CatKey; en: string; ar: string; fr: string; icon: React.ReactElement; color: string }[] = [
  { key: "cloud",       en: "AWS — Cloud",         ar: "AWS — السحابة",        fr: "AWS — Cloud",            icon: <IcCloud />,   color: "#FF9900" },
  { key: "business",    en: "Amazon Business",      ar: "أمازون بيزنس",        fr: "Amazon Business",         icon: <IcShop />,    color: "var(--azure)" },
  { key: "marketplace", en: "Marketplace & FBA",    ar: "ماركت بليس وFBA",      fr: "Marketplace & FBA",      icon: <IcBox />,     color: "var(--emerald)" },
  { key: "logistique",  en: "Logistics",            ar: "اللوجستية",            fr: "Logistique",              icon: <IcTruck />,   color: "var(--gold)" },
  { key: "ads",         en: "Amazon Advertising",   ar: "إعلانات أمازون",       fr: "Amazon Advertising",      icon: <IcAds />,     color: "var(--rose)" },
  { key: "pay",         en: "Amazon Pay & Fintech", ar: "أمازون باي والتقنية",  fr: "Amazon Pay & Fintech",    icon: <IcPay />,     color: "#8B5CF6" },
];

/* ─── Country meta ───────────────────────────────────────────────────── */
const COUNTRIES: { key: CountryKey; flag: string; en: string; ar: string; fr: string; tagline_en: string; tagline_ar: string; tagline_fr: string }[] = [
  { key: "ae", flag: "🇦🇪", en: "UAE", ar: "الإمارات", fr: "EAU",
    tagline_en: "UAE — Amazon's MENA headquarters, with amazon.ae and the region's largest AWS infrastructure",
    tagline_ar: "الإمارات — المقر الإقليمي لأمازون في منطقة MENA مع amazon.ae وأكبر بنية تحتية لـ AWS في المنطقة",
    tagline_fr: "EAU — QG MENA d'Amazon avec amazon.ae et la plus grande infrastructure AWS de la région" },
  { key: "sa", flag: "🇸🇦", en: "KSA", ar: "المملكة", fr: "Arabie Saoudite",
    tagline_en: "KSA — amazon.sa launched 2020, AWS region in Riyadh powering Vision 2030 digital transformation",
    tagline_ar: "المملكة — إطلاق amazon.sa في 2020، منطقة AWS في الرياض تدعم التحول الرقمي لرؤية 2030",
    tagline_fr: "KSA — amazon.sa lancé en 2020, région AWS à Riyad alimentant la transformation digitale Vision 2030" },
  { key: "ma", flag: "🇲🇦", en: "Morocco", ar: "المغرب", fr: "Maroc",
    tagline_en: "Morocco — Growing AWS adoption and sellers on amazon.fr; dedicated local programs via Amazon Launchpad Africa",
    tagline_ar: "المغرب — تنامي اعتماد AWS والبائعين على amazon.fr؛ برامج محلية مخصصة عبر Amazon Launchpad Africa",
    tagline_fr: "Maroc — Adoption AWS croissante et vendeurs sur amazon.fr ; programmes locaux via Amazon Launchpad Africa" },
];

/* ─── KPIs ───────────────────────────────────────────────────────────── */
const KPIS: Record<CountryKey, { n: string; en: string; ar: string; fr: string }[]> = {
  ae: [
    { n: "2019",     en: "amazon.ae launched",  ar: "إطلاق amazon.ae",    fr: "Lancement amazon.ae" },
    { n: "3 AZs",    en: "AWS Middle East",      ar: "مناطق توافر AWS",    fr: "Zones dispo. AWS" },
    { n: "50K+",     en: "Active sellers",       ar: "بائع نشط",           fr: "Vendeurs actifs" },
    { n: "2-hr",     en: "Prime delivery",       ar: "توصيل Prime",        fr: "Livraison Prime" },
  ],
  sa: [
    { n: "2020",     en: "amazon.sa launched",  ar: "إطلاق amazon.sa",    fr: "Lancement amazon.sa" },
    { n: "2026",     en: "AWS KSA Region",       ar: "منطقة AWS المملكة",  fr: "Région AWS KSA" },
    { n: "30K+",     en: "Active sellers",       ar: "بائع نشط",           fr: "Vendeurs actifs" },
    { n: "Vision",   en: "2030 partner",         ar: "شريك رؤية 2030",     fr: "Partenaire 2030" },
  ],
  ma: [
    { n: "amazon.fr", en: "Primary platform",   ar: "المنصة الأساسية",    fr: "Plateforme principale" },
    { n: "AWS",       en: "Cloud services",      ar: "خدمات السحابة",      fr: "Services cloud" },
    { n: "Africa",    en: "Launchpad program",   ar: "برنامج Launchpad",   fr: "Programme Launchpad" },
    { n: "2024",      en: "AWS expansion",       ar: "توسع AWS",            fr: "Expansion AWS" },
  ],
};

/* ─── Service data ───────────────────────────────────────────────────── */
const SERVICES: Record<CountryKey, AService[]> = {
  ae: [
    /* AWS Cloud */
    { cat: "cloud", highlight: true, tag: "ME-CENTRAL-1",
      name: "AWS Middle East (UAE) Region", name_ar: "منطقة AWS الشرق الأوسط (الإمارات)", name_fr: "Région AWS Moyen-Orient (EAU)",
      desc_en: "AWS's dedicated UAE cloud region (me-central-1) with 3 Availability Zones, launched 2022. Data residency in the UAE.",
      desc_ar: "منطقة السحابة الإماراتية المخصصة من AWS (me-central-1) مع 3 مناطق توافر، أُطلقت في 2022. إقامة البيانات في الإمارات.",
      desc_fr: "Région cloud UAE dédiée d'AWS (me-central-1) avec 3 zones de disponibilité, lancée en 2022. Résidence des données aux EAU.",
      url: "https://aws.amazon.com/local/uae" },
    { cat: "cloud", highlight: true,
      name: "AWS EC2 — Compute", name_ar: "AWS EC2 — الحوسبة", name_fr: "AWS EC2 — Calcul",
      desc_en: "Scalable virtual servers in the UAE region. Run enterprise workloads, web applications and APIs with full compliance.",
      desc_ar: "خوادم افتراضية قابلة للتوسع في المنطقة الإماراتية. تشغيل أحمال العمل المؤسسية وتطبيقات الويب وواجهات API مع الامتثال الكامل.",
      desc_fr: "Serveurs virtuels scalables dans la région UAE. Exécutez workloads enterprise, applications web et API en pleine conformité.",
      url: "https://aws.amazon.com/ec2" },
    { cat: "cloud",
      name: "AWS S3 — Storage", name_ar: "AWS S3 — التخزين", name_fr: "AWS S3 — Stockage",
      desc_en: "Unlimited object storage for documents, media and backups. GDPR/UAE PDPL compliant with fine-grained access control.",
      desc_ar: "تخزين كائنات غير محدود للوثائق والوسائط والنسخ الاحتياطية. متوافق مع PDPL الإمارات مع تحكم دقيق في الوصول.",
      desc_fr: "Stockage objet illimité pour documents, médias et sauvegardes. Conforme PDPL UAE avec contrôle d'accès fin.",
      url: "https://aws.amazon.com/s3" },
    { cat: "cloud",
      name: "Amazon Bedrock — Generative AI", name_ar: "Amazon Bedrock — الذكاء الاصطناعي التوليدي", name_fr: "Amazon Bedrock — IA Générative",
      desc_en: "Fully managed generative AI service. Access Claude, Llama and Titan foundation models via API for UAE enterprise apps.",
      desc_ar: "خدمة ذكاء اصطناعي توليدي مُدارة بالكامل. وصول إلى نماذج Claude وLlama وTitan عبر API لتطبيقات المؤسسات الإماراتية.",
      desc_fr: "Service d'IA générative entièrement managé. Accès aux modèles Claude, Llama et Titan via API pour apps enterprise UAE.",
      url: "https://aws.amazon.com/bedrock" },
    { cat: "cloud",
      name: "AWS RDS — Managed Database", name_ar: "AWS RDS — قاعدة البيانات المُدارة", name_fr: "AWS RDS — Base de Données Managée",
      desc_en: "Managed relational databases (PostgreSQL, MySQL, Aurora) in the UAE region for enterprise-grade reliability.",
      desc_ar: "قواعد بيانات علائقية مُدارة (PostgreSQL وMySQL وAurora) في المنطقة الإماراتية بموثوقية مؤسسية.",
      desc_fr: "Bases de données relationnelles managées (PostgreSQL, MySQL, Aurora) en région UAE pour fiabilité enterprise.",
      url: "https://aws.amazon.com/rds" },
    { cat: "cloud",
      name: "AWS Well-Architected — UAE Partners", name_ar: "AWS مُهيأ جيداً — شركاء الإمارات", name_fr: "AWS Well-Architected — Partenaires EAU",
      desc_en: "Directory of certified AWS Partners in the UAE for architecture review, migration and managed services.",
      desc_ar: "دليل شركاء AWS المعتمدين في الإمارات لمراجعة البنية والهجرة والخدمات المُدارة.",
      desc_fr: "Annuaire de partenaires AWS certifiés aux EAU pour revue d'architecture, migration et services managés.",
      url: "https://partners.amazonaws.com" },

    /* Amazon Business */
    { cat: "business", highlight: true, tag: "B2B",
      name: "Amazon Business — UAE", name_ar: "أمازون بيزنس — الإمارات", name_fr: "Amazon Business — EAU",
      desc_en: "B2B procurement platform for UAE companies — bulk discounts, VAT invoices, multi-user accounts and approval workflows.",
      desc_ar: "منصة المشتريات B2B للشركات الإماراتية — خصومات الجملة وفواتير ضريبة القيمة المضافة وحسابات متعددة المستخدمين.",
      desc_fr: "Plateforme de procurement B2B pour entreprises UAE — remises volume, factures TVA, comptes multi-utilisateurs.",
      url: "https://www.amazon.ae/business" },
    { cat: "business",
      name: "Amazon for Government — UAE", name_ar: "أمازون للحكومة — الإمارات", name_fr: "Amazon for Government — EAU",
      desc_en: "Dedicated procurement solutions for UAE federal and local government entities, with compliant purchasing workflows.",
      desc_ar: "حلول مشتريات مخصصة للجهات الحكومية الاتحادية والمحلية في الإمارات مع سير عمل شراء متوافقة.",
      desc_fr: "Solutions de procurement dédiées aux entités gouvernementales fédérales et locales UAE, workflows conformes.",
      url: "https://aws.amazon.com/government-education/government" },
    { cat: "business",
      name: "AWS Marketplace — UAE", name_ar: "سوق AWS — الإمارات", name_fr: "AWS Marketplace — EAU",
      desc_en: "Digital catalogue of 10,000+ software products deployable in the UAE region — pay-as-you-go SaaS and AMIs.",
      desc_ar: "كتالوج رقمي يضم أكثر من 10,000 منتج برمجي قابل للنشر في المنطقة الإماراتية — SaaS ونماذج AMI بالدفع حسب الاستخدام.",
      desc_fr: "Catalogue digital de 10 000+ produits logiciels déployables en région UAE — SaaS et AMI à la consommation.",
      url: "https://aws.amazon.com/marketplace" },
    { cat: "business",
      name: "Amazon Launchpad — MENA", name_ar: "أمازون لانشباد — منطقة MENA", name_fr: "Amazon Launchpad — MENA",
      desc_en: "Program helping startups and SMEs launch products on Amazon.ae with marketing support and brand visibility.",
      desc_ar: "برنامج يساعد الشركات الناشئة والصغيرة على إطلاق منتجاتها على Amazon.ae مع دعم تسويقي وظهور للعلامة التجارية.",
      desc_fr: "Programme aidant les startups et PME à lancer des produits sur Amazon.ae avec soutien marketing et visibilité marque.",
      url: "https://www.amazon.ae/launchpad" },

    /* Marketplace & FBA */
    { cat: "marketplace", highlight: true, tag: "Seller Hub",
      name: "Sell on Amazon.ae", name_ar: "البيع على Amazon.ae", name_fr: "Vendre sur Amazon.ae",
      desc_en: "Create your seller account on Amazon UAE — access 50K+ active buyers with Individual or Professional plan.",
      desc_ar: "أنشئ حساب بائعك على أمازون الإمارات — وصول لأكثر من 50,000 مشتري نشط مع الخطة الفردية أو المهنية.",
      desc_fr: "Créez votre compte vendeur Amazon UAE — accédez à 50 000+ acheteurs actifs avec plan Individuel ou Professionnel.",
      url: "https://sell.amazon.ae" },
    { cat: "marketplace", highlight: true, tag: "FBA",
      name: "Fulfillment by Amazon — UAE", name_ar: "الشحن والوفاء بواسطة أمازون — الإمارات", name_fr: "Fulfillment by Amazon — EAU",
      desc_en: "Store products in Amazon's UAE fulfillment centers. Amazon picks, packs and ships to Prime customers with 2-hour delivery.",
      desc_ar: "خزّن المنتجات في مراكز وفاء أمازون الإماراتية. تقوم أمازون بالانتقاء والتعبئة والشحن لعملاء Prime بتوصيل في ساعتين.",
      desc_fr: "Stockez produits dans les centres fulfillment UAE d'Amazon. Amazon prépare et livre aux clients Prime en 2 heures.",
      url: "https://sell.amazon.ae/fba" },
    { cat: "marketplace",
      name: "Amazon Vendor Central — UAE", name_ar: "مركز بائعي الجملة أمازون — الإمارات", name_fr: "Amazon Vendor Central — EAU",
      desc_en: "Wholesale supplier program — sell directly to Amazon UAE which then sells to end customers.",
      desc_ar: "برنامج موردي الجملة — البيع مباشرة لأمازون الإمارات التي تبيع بعد ذلك للعملاء النهائيين.",
      desc_fr: "Programme fournisseur en gros — vendez directement à Amazon UAE qui revend ensuite aux clients finaux.",
      url: "https://vendorcentral.amazon.ae" },
    { cat: "marketplace",
      name: "Amazon Global Selling — UAE Export", name_ar: "البيع العالمي من الإمارات", name_fr: "Amazon Global Selling — Export EAU",
      desc_en: "Expand from amazon.ae to 20+ global marketplaces — Europe, USA, India — with centralized inventory management.",
      desc_ar: "التوسع من amazon.ae إلى أكثر من 20 سوقاً عالمياً — أوروبا والولايات المتحدة والهند — مع إدارة مخزون مركزية.",
      desc_fr: "Étendez-vous d'amazon.ae vers 20+ marketplaces mondiales — Europe, USA, Inde — avec gestion d'inventaire centralisée.",
      url: "https://sell.amazon.ae/global-selling" },

    /* Logistics */
    { cat: "logistique", highlight: true, tag: "Prime",
      name: "Amazon Prime — UAE", name_ar: "أمازون برايم — الإمارات", name_fr: "Amazon Prime — EAU",
      desc_en: "Prime membership with free 2-hour delivery in Dubai and Abu Dhabi, Prime Video and exclusive deals.",
      desc_ar: "عضوية Prime مع توصيل مجاني خلال ساعتين في دبي وأبوظبي وPrime Video وعروض حصرية.",
      desc_fr: "Abonnement Prime avec livraison gratuite en 2h à Dubaï et Abu Dhabi, Prime Video et offres exclusives.",
      url: "https://www.amazon.ae/prime" },
    { cat: "logistique",
      name: "Amazon Logistics — UAE", name_ar: "أمازون لوجستيك — الإمارات", name_fr: "Amazon Logistics — EAU",
      desc_en: "Amazon's last-mile delivery network in the UAE — purpose-built fulfillment centers in Dubai and Abu Dhabi.",
      desc_ar: "شبكة التوصيل الأخيرة لأمازون في الإمارات — مراكز وفاء مبنية خصيصاً في دبي وأبوظبي.",
      desc_fr: "Réseau de livraison last-mile d'Amazon aux EAU — centres fulfillment dédiés à Dubaï et Abu Dhabi.",
      url: "https://logistics.amazon.ae" },
    { cat: "logistique",
      name: "Amazon Flex — UAE Driver Program", name_ar: "أمازون فليكس — برنامج السائقين", name_fr: "Amazon Flex — Programme Livreurs",
      desc_en: "Gig delivery driver program — use your own vehicle to deliver Amazon packages in the UAE.",
      desc_ar: "برنامج توصيل مرن — استخدم مركبتك الخاصة لتوصيل طرود أمازون في الإمارات.",
      desc_fr: "Programme de livreurs indépendants — utilisez votre propre véhicule pour livrer des colis Amazon aux EAU.",
      url: "https://flex.amazon.ae" },

    /* Advertising */
    { cat: "ads", highlight: true,
      name: "Amazon Ads — Sponsored Products", name_ar: "إعلانات أمازون — المنتجات المدعومة", name_fr: "Amazon Ads — Produits Sponsorisés",
      desc_en: "Pay-per-click ads shown in Amazon.ae search results and product pages — boost visibility for your listings.",
      desc_ar: "إعلانات بالنقرة تظهر في نتائج بحث Amazon.ae وصفحات المنتجات — عزز ظهور قوائمك.",
      desc_fr: "Annonces PPC affichées dans les résultats de recherche Amazon.ae et pages produits — boostez la visibilité de vos listings.",
      url: "https://advertising.amazon.ae" },
    { cat: "ads",
      name: "Amazon DSP — Display & Video", name_ar: "Amazon DSP — العرض والفيديو", name_fr: "Amazon DSP — Display & Vidéo",
      desc_en: "Programmatic display and video advertising reaching Amazon shoppers across websites and apps in the UAE.",
      desc_ar: "إعلانات العرض والفيديو البرامجية التي تصل إلى متسوقي أمازون عبر المواقع والتطبيقات في الإمارات.",
      desc_fr: "Publicité display et vidéo programmatique atteignant les acheteurs Amazon sur sites web et apps aux EAU.",
      url: "https://advertising.amazon.com/solutions/products/amazon-dsp" },
    { cat: "ads",
      name: "Amazon Brand Registry — UAE", name_ar: "سجل العلامة التجارية أمازون", name_fr: "Amazon Brand Registry — EAU",
      desc_en: "Protect your brand on Amazon.ae, unlock enhanced content (A+), Brand Store and analytics tools.",
      desc_ar: "احمِ علامتك التجارية على Amazon.ae، أطلق محتوى معزز (A+) ومتجر العلامة التجارية وأدوات التحليل.",
      desc_fr: "Protégez votre marque sur Amazon.ae, débloquez le contenu enrichi (A+), Brand Store et outils analytiques.",
      url: "https://brandregistry.amazon.ae" },

    /* Pay & Fintech */
    { cat: "pay", highlight: true,
      name: "Amazon Pay — UAE", name_ar: "أمازون باي — الإمارات", name_fr: "Amazon Pay — EAU",
      desc_en: "Let customers pay on your website using their Amazon account. Fast, trusted checkout for UAE e-commerce.",
      desc_ar: "اسمح للعملاء بالدفع على موقعك باستخدام حساب أمازون الخاص بهم. دفع سريع موثوق لتجارة الإمارات الإلكترونية.",
      desc_fr: "Permettez à vos clients de payer sur votre site avec leur compte Amazon. Checkout rapide et fiable pour l'e-commerce UAE.",
      url: "https://pay.amazon.ae" },
    { cat: "pay",
      name: "AWS Activate — Startup Credits", name_ar: "AWS تنشيط — أرصدة للشركات الناشئة", name_fr: "AWS Activate — Crédits Startup",
      desc_en: "Up to USD 100,000 in AWS credits, support and training for eligible UAE startups and accelerator members.",
      desc_ar: "ما يصل إلى 100,000 دولار من أرصدة AWS والدعم والتدريب للشركات الناشئة الإماراتية المؤهلة وأعضاء المسرّعات.",
      desc_fr: "Jusqu'à 100 000 USD de crédits AWS, support et formation pour startups UAE éligibles et membres d'accélérateurs.",
      url: "https://aws.amazon.com/activate" },
  ],

  sa: [
    /* AWS Cloud */
    { cat: "cloud", highlight: true, tag: "Vision 2030",
      name: "AWS Middle East (Saudi Arabia) Region", name_ar: "منطقة AWS الشرق الأوسط (المملكة)", name_fr: "Région AWS Moyen-Orient (KSA)",
      desc_en: "AWS's dedicated Saudi Arabia cloud region in Riyadh, planned 2026, supporting Vision 2030 digital sovereignty goals.",
      desc_ar: "منطقة السحابة السعودية المخصصة من AWS في الرياض، مخططة لعام 2026، تدعم أهداف السيادة الرقمية لرؤية 2030.",
      desc_fr: "Région cloud dédiée d'AWS en Arabie Saoudite à Riyad, prévue 2026, soutenant les objectifs de souveraineté numérique Vision 2030.",
      url: "https://aws.amazon.com/local/saudi-arabia" },
    { cat: "cloud", highlight: true, tag: "MCIT Partner",
      name: "AWS & MCIT — Cloud First Strategy", name_ar: "AWS ووزارة الاتصالات — استراتيجية السحابة أولاً", name_fr: "AWS & MCIT — Stratégie Cloud First",
      desc_en: "Strategic partnership with Saudi Ministry of Communications to migrate 70% of government workloads to cloud by 2030.",
      desc_ar: "شراكة استراتيجية مع وزارة الاتصالات السعودية لنقل 70% من أعمال الحكومة إلى السحابة بحلول 2030.",
      desc_fr: "Partenariat stratégique avec le ministère saoudien des Communications pour migrer 70% des workloads gouvernementaux vers le cloud d'ici 2030.",
      url: "https://aws.amazon.com/government-education/government/saudi-arabia" },
    { cat: "cloud",
      name: "Amazon SageMaker — AI/ML", name_ar: "Amazon SageMaker — الذكاء الاصطناعي", name_fr: "Amazon SageMaker — IA/ML",
      desc_en: "Build, train and deploy machine learning models at scale for Saudi enterprises — Arabic NLP and vision AI supported.",
      desc_ar: "بناء وتدريب ونشر نماذج التعلم الآلي على نطاق واسع للمؤسسات السعودية — دعم معالجة اللغة الطبيعية العربية.",
      desc_fr: "Construisez, entraînez et déployez des modèles ML à l'échelle pour entreprises saoudiennes — NLP arabe et vision IA supportés.",
      url: "https://aws.amazon.com/sagemaker" },
    { cat: "cloud",
      name: "AWS GAIA — Government AI", name_ar: "AWS GAIA — الذكاء الاصطناعي الحكومي", name_fr: "AWS GAIA — IA Gouvernementale",
      desc_en: "AWS Generative AI Initiative for ARABIA — helping Saudi public sector organizations adopt generative AI responsibly.",
      desc_ar: "مبادرة AWS للذكاء الاصطناعي التوليدي للعرب — مساعدة منظمات القطاع العام السعودي على اعتماد الذكاء الاصطناعي التوليدي بشكل مسؤول.",
      desc_fr: "Initiative AWS Generative AI pour l'Arabie — aide les organisations du secteur public saoudien à adopter l'IA générative de façon responsable.",
      url: "https://aws.amazon.com/generative-ai" },

    /* Amazon Business */
    { cat: "business", highlight: true, tag: "B2B",
      name: "Amazon Business — Saudi Arabia", name_ar: "أمازون بيزنس — المملكة العربية السعودية", name_fr: "Amazon Business — Arabie Saoudite",
      desc_en: "B2B marketplace for Saudi companies — tax-compliant invoices (ZATCA), bulk pricing and multi-seat account management.",
      desc_ar: "سوق B2B للشركات السعودية — فواتير متوافقة مع هيئة الزكاة والضريبة والجمارك وأسعار الجملة وإدارة حسابات متعددة.",
      desc_fr: "Marketplace B2B pour entreprises saoudiennes — factures conformes ZATCA, tarification volume et gestion multi-comptes.",
      url: "https://www.amazon.sa/business" },
    { cat: "business",
      name: "AWS Marketplace — KSA", name_ar: "سوق AWS — المملكة", name_fr: "AWS Marketplace — KSA",
      desc_en: "Procure enterprise software directly from AWS Marketplace with consolidated billing for Saudi entities.",
      desc_ar: "شراء برمجيات المؤسسات مباشرة من سوق AWS مع فوترة موحدة للكيانات السعودية.",
      desc_fr: "Achetez logiciels enterprise directement sur AWS Marketplace avec facturation consolidée pour entités saoudiennes.",
      url: "https://aws.amazon.com/marketplace" },
    { cat: "business",
      name: "Amazon Launchpad — Saudi Arabia", name_ar: "أمازون لانشباد — المملكة", name_fr: "Amazon Launchpad — Arabie Saoudite",
      desc_en: "Program supporting Saudi startups and SMEs to launch products on amazon.sa with dedicated marketing and brand support.",
      desc_ar: "برنامج دعم الشركات الناشئة والصغيرة السعودية لإطلاق منتجاتها على amazon.sa مع دعم تسويقي ومساعدة للعلامة التجارية.",
      desc_fr: "Programme soutenant startups et PME saoudiennes à lancer sur amazon.sa avec marketing dédié et soutien marque.",
      url: "https://www.amazon.sa/launchpad" },

    /* Marketplace */
    { cat: "marketplace", highlight: true, tag: "Seller Hub",
      name: "Sell on Amazon.sa", name_ar: "البيع على Amazon.sa", name_fr: "Vendre sur Amazon.sa",
      desc_en: "List and sell products on Amazon Saudi Arabia — launched 2020 with fast-growing customer base and Prime delivery.",
      desc_ar: "أدرج منتجاتك وبِعها على أمازون السعودية — أُطلق في 2020 مع قاعدة عملاء سريعة النمو وتوصيل Prime.",
      desc_fr: "Listez et vendez sur Amazon Arabie Saoudite — lancé en 2020 avec base clients en forte croissance et livraison Prime.",
      url: "https://sell.amazon.sa" },
    { cat: "marketplace", highlight: true, tag: "FBA",
      name: "FBA — Amazon Saudi Fulfillment Centers", name_ar: "FBA — مراكز وفاء أمازون السعودية", name_fr: "FBA — Centres Fulfillment Amazon KSA",
      desc_en: "Store your inventory in Amazon's Saudi fulfillment centers in Riyadh and Jeddah — Amazon ships within 24 hours.",
      desc_ar: "خزّن مخزونك في مراكز وفاء أمازون السعودية في الرياض وجدة — تشحن أمازون خلال 24 ساعة.",
      desc_fr: "Stockez votre inventaire dans les centres fulfillment saoudiens d'Amazon à Riyad et Djeddah — Amazon livre en 24h.",
      url: "https://sell.amazon.sa/fba" },
    { cat: "marketplace",
      name: "Amazon Global Selling — KSA Export", name_ar: "البيع العالمي من المملكة", name_fr: "Amazon Global Selling — Export KSA",
      desc_en: "Sell Saudi products on Amazon.com, Amazon.co.uk and other global marketplaces from a single seller account.",
      desc_ar: "بيع المنتجات السعودية على Amazon.com وAmazon.co.uk وأسواق عالمية أخرى من حساب بائع واحد.",
      desc_fr: "Vendez des produits saoudiens sur Amazon.com, Amazon.co.uk et autres marketplaces mondiales depuis un seul compte vendeur.",
      url: "https://sell.amazon.sa/global-selling" },

    /* Logistics */
    { cat: "logistique", highlight: true, tag: "Prime",
      name: "Amazon Prime — Saudi Arabia", name_ar: "أمازون برايم — المملكة", name_fr: "Amazon Prime — Arabie Saoudite",
      desc_en: "Prime membership with fast delivery across Saudi Arabia, Prime Video Arabic content and exclusive deals.",
      desc_ar: "عضوية Prime مع توصيل سريع في جميع أنحاء المملكة ومحتوى Prime Video العربي وعروض حصرية.",
      desc_fr: "Abonnement Prime avec livraison rapide dans toute l'Arabie Saoudite, contenu Prime Video arabe et offres exclusives.",
      url: "https://www.amazon.sa/prime" },
    { cat: "logistique",
      name: "Amazon Logistics — Riyadh & Jeddah", name_ar: "أمازون لوجستيك — الرياض وجدة", name_fr: "Amazon Logistics — Riyad & Djeddah",
      desc_en: "Amazon's last-mile delivery network across Saudi Arabia with fulfillment hubs in Riyadh, Jeddah and Dammam.",
      desc_ar: "شبكة التوصيل الأخيرة لأمازون في جميع أنحاء المملكة مع مراكز وفاء في الرياض وجدة والدمام.",
      desc_fr: "Réseau de livraison last-mile d'Amazon dans toute l'Arabie Saoudite avec hubs fulfillment à Riyad, Djeddah et Dammam.",
      url: "https://logistics.amazon.sa" },

    /* Advertising */
    { cat: "ads", highlight: true,
      name: "Amazon Ads — Saudi Arabia", name_ar: "إعلانات أمازون — المملكة", name_fr: "Amazon Ads — Arabie Saoudite",
      desc_en: "Sponsored Products, Sponsored Brands and Sponsored Display ads on amazon.sa to reach Saudi shoppers.",
      desc_ar: "إعلانات المنتجات المدعومة والعلامات التجارية المدعومة والعرض المدعوم على amazon.sa للوصول إلى المتسوقين السعوديين.",
      desc_fr: "Sponsored Products, Sponsored Brands et Sponsored Display sur amazon.sa pour toucher les acheteurs saoudiens.",
      url: "https://advertising.amazon.sa" },
    { cat: "ads",
      name: "Twitch Advertising — MENA", name_ar: "إعلانات Twitch — منطقة MENA", name_fr: "Publicité Twitch — MENA",
      desc_en: "Reach Saudi Arabia's rapidly growing gaming audience through Twitch live streaming advertising.",
      desc_ar: "الوصول إلى جمهور الألعاب السريع النمو في المملكة العربية السعودية من خلال إعلانات البث المباشر على Twitch.",
      desc_fr: "Atteignez l'audience gaming en forte croissance d'Arabie Saoudite via la publicité sur le live streaming Twitch.",
      url: "https://advertising.amazon.com/solutions/products/streaming-tv-ads/twitch" },

    /* Pay */
    { cat: "pay", highlight: true,
      name: "Amazon Pay — Saudi Arabia", name_ar: "أمازون باي — المملكة", name_fr: "Amazon Pay — Arabie Saoudite",
      desc_en: "Trusted payment solution for Saudi e-commerce merchants — accept payments via Amazon account credentials.",
      desc_ar: "حل دفع موثوق لتجار التجارة الإلكترونية السعوديين — قبول المدفوعات عبر بيانات اعتماد حساب أمازون.",
      desc_fr: "Solution de paiement fiable pour marchands e-commerce saoudiens — acceptez paiements via identifiants compte Amazon.",
      url: "https://pay.amazon.sa" },
    { cat: "pay",
      name: "AWS Activate — Saudi Startups", name_ar: "AWS تنشيط — الشركات الناشئة السعودية", name_fr: "AWS Activate — Startups Saoudiennes",
      desc_en: "AWS credits and mentorship for Saudi startups — linked to Monsha'at, KACST and Vision 2030 startup ecosystem.",
      desc_ar: "أرصدة AWS وإرشاد للشركات الناشئة السعودية — مرتبط بمنشآت والمدينة العلمية ونظام الشركات الناشئة لرؤية 2030.",
      desc_fr: "Crédits AWS et mentorat pour startups saoudiennes — lié à Monsha'at, KACST et l'écosystème startup Vision 2030.",
      url: "https://aws.amazon.com/activate" },
  ],

  ma: [
    /* AWS Cloud */
    { cat: "cloud", highlight: true, tag: "Cloud Leader",
      name: "AWS — Maroc (via région EU)", name_ar: "AWS — المغرب (عبر منطقة EU)", name_fr: "AWS — Maroc (via région EU)",
      desc_en: "Moroccan businesses access AWS from EU regions (Paris, Frankfurt). Data residency options under Morocco's Law 09-08.",
      desc_ar: "تصل الشركات المغربية إلى AWS من المناطق الأوروبية (باريس، فرانكفورت). خيارات إقامة البيانات بموجب القانون المغربي 09-08.",
      desc_fr: "Les entreprises marocaines accèdent à AWS depuis les régions EU (Paris, Francfort). Options de résidence données selon la Loi 09-08.",
      url: "https://aws.amazon.com/fr/about-aws/global-infrastructure/regions_az" },
    { cat: "cloud", highlight: true, tag: "AWS Training",
      name: "AWS re/Start — Maroc", name_ar: "AWS re/Start — المغرب", name_fr: "AWS re/Start — Maroc",
      desc_en: "Free cloud skills training program in Morocco, partnering with UM6P, ISCAE and local tech bootcamps.",
      desc_ar: "برنامج تدريب مجاني على مهارات السحابة في المغرب، بالشراكة مع UM6P وISCAE ومعسكرات التقنية المحلية.",
      desc_fr: "Programme de formation gratuit aux compétences cloud au Maroc, en partenariat avec UM6P, ISCAE et bootcamps tech locaux.",
      url: "https://aws.amazon.com/training/restart" },
    { cat: "cloud",
      name: "AWS Partner Network — Maroc", name_ar: "شبكة شركاء AWS — المغرب", name_fr: "AWS Partner Network — Maroc",
      desc_en: "Directory of Moroccan AWS-certified integrators — cloud migration, DevOps and managed services providers.",
      desc_ar: "دليل المتكاملين المغاربة المعتمدين من AWS — هجرة السحابة وDevOps ومزودي الخدمات المُدارة.",
      desc_fr: "Annuaire des intégrateurs marocains certifiés AWS — migration cloud, DevOps et prestataires de services managés.",
      url: "https://partners.amazonaws.com" },
    { cat: "cloud",
      name: "Amazon Bedrock — Darija AI", name_ar: "Amazon Bedrock — الذكاء الاصطناعي بالدارجة", name_fr: "Amazon Bedrock — IA Darija",
      desc_en: "Use foundation models on AWS to build Arabic and Darija NLP applications for Moroccan businesses and government.",
      desc_ar: "استخدم النماذج الأساسية على AWS لبناء تطبيقات معالجة اللغة الطبيعية العربية والدارجة للشركات والحكومة المغربية.",
      desc_fr: "Utilisez les modèles de fondation sur AWS pour créer des applications NLP arabe et darija pour entreprises et gouvernement marocains.",
      url: "https://aws.amazon.com/bedrock" },

    /* Business */
    { cat: "business", highlight: true, tag: "B2B",
      name: "Amazon Business — France (Maroc)", name_ar: "أمازون بيزنس فرنسا — المغرب", name_fr: "Amazon Business — France (Maroc)",
      desc_en: "Moroccan companies procure via Amazon Business France — VAT invoices, bulk pricing and Euro payments accepted.",
      desc_ar: "تشتري الشركات المغربية عبر Amazon Business France — فواتير ضريبة القيمة المضافة وأسعار الجملة والمدفوعات باليورو.",
      desc_fr: "Les entreprises marocaines achètent via Amazon Business France — factures TVA, tarification volume, paiements en euros.",
      url: "https://www.amazon.fr/business" },
    { cat: "business",
      name: "Amazon Launchpad Africa — Maroc", name_ar: "أمازون لانشباد أفريقيا — المغرب", name_fr: "Amazon Launchpad Africa — Maroc",
      desc_en: "Pan-African seller program helping Moroccan startups distribute products across amazon.fr and other EU marketplaces.",
      desc_ar: "برنامج بائع أفريقي شامل يساعد الشركات الناشئة المغربية على توزيع منتجاتها عبر amazon.fr وأسواق EU أخرى.",
      desc_fr: "Programme vendeurs panafricain aidant les startups marocaines à distribuer sur amazon.fr et autres marketplaces EU.",
      url: "https://www.amazon.fr/launchpad" },
    { cat: "business",
      name: "AWS Marketplace — EMEA", name_ar: "سوق AWS — EMEA", name_fr: "AWS Marketplace — EMEA",
      desc_en: "Access 10,000+ cloud software products for Moroccan businesses billed through AWS consolidated invoicing.",
      desc_ar: "الوصول إلى أكثر من 10,000 منتج برمجي سحابي للشركات المغربية مع فوترة موحدة من AWS.",
      desc_fr: "Accédez à 10 000+ produits logiciels cloud pour entreprises marocaines avec facturation AWS consolidée.",
      url: "https://aws.amazon.com/marketplace" },

    /* Marketplace */
    { cat: "marketplace", highlight: true, tag: "Seller",
      name: "Sell on Amazon.fr — Maroc", name_ar: "البيع على Amazon.fr — المغرب", name_fr: "Vendre sur Amazon.fr — Maroc",
      desc_en: "Register as a Moroccan seller on Amazon France — access 50M+ EU customers with multilingual product listings.",
      desc_ar: "سجّل كبائع مغربي على أمازون فرنسا — وصول لأكثر من 50 مليون عميل أوروبي مع قوائم منتجات متعددة اللغات.",
      desc_fr: "Inscrivez-vous comme vendeur marocain sur Amazon France — accès à 50M+ clients EU avec listings multilingues.",
      url: "https://sell.amazon.fr" },
    { cat: "marketplace",
      name: "Maroc Export × Amazon — Programme", name_ar: "الصادرات المغربية × أمازون", name_fr: "Maroc Export × Amazon — Programme",
      desc_en: "Partnership between Maroc Export agency and Amazon helping Moroccan artisans and SMEs export products online.",
      desc_ar: "شراكة بين وكالة المغرب للصادرات وأمازون لمساعدة الحرفيين والشركات الصغيرة المغربية على تصدير المنتجات عبر الإنترنت.",
      desc_fr: "Partenariat entre Maroc Export et Amazon pour aider artisans et PME marocains à exporter leurs produits en ligne.",
      url: "https://www.marocexport.ma" },
    { cat: "marketplace",
      name: "FBA Europe — Moroccan Sellers", name_ar: "FBA أوروبا — البائعون المغاربة", name_fr: "FBA Europe — Vendeurs Marocains",
      desc_en: "Fulfillment by Amazon via European warehouses (France, Spain, Germany) for Moroccan exporters shipping to EU customers.",
      desc_ar: "الشحن والوفاء بواسطة أمازون عبر المستودعات الأوروبية (فرنسا وإسبانيا وألمانيا) للمصدرين المغاربة.",
      desc_fr: "Fulfillment by Amazon via entrepôts européens (France, Espagne, Allemagne) pour exportateurs marocains vers clients EU.",
      url: "https://sell.amazon.fr/fba" },

    /* Logistics */
    { cat: "logistique", highlight: true,
      name: "Amazon Shipping — Maroc (via partenaires)", name_ar: "شحن أمازون — المغرب (عبر الشركاء)", name_fr: "Amazon Shipping — Maroc (partenaires)",
      desc_en: "Last-mile delivery in Morocco through Amazon's logistics partners — Amana, Colis Privé Maroc and CTM Express.",
      desc_ar: "التوصيل الأخير في المغرب عبر شركاء لوجستيك أمازون — أمانة وكوليس بريفيه المغرب وCTM Express.",
      desc_fr: "Livraison last-mile au Maroc via les partenaires logistiques d'Amazon — Amana, Colis Privé Maroc et CTM Express.",
      url: "https://www.amazon.fr/shipping" },
    { cat: "logistique",
      name: "DHL × Amazon — Maroc Export", name_ar: "DHL × أمازون — صادرات المغرب", name_fr: "DHL × Amazon — Export Maroc",
      desc_en: "DHL Express partnership for Moroccan sellers shipping products sold on Amazon EU to international customers.",
      desc_ar: "شراكة DHL Express للبائعين المغاربة لشحن المنتجات المباعة على أمازون EU للعملاء الدوليين.",
      desc_fr: "Partenariat DHL Express pour vendeurs marocains expédiant des produits vendus sur Amazon EU aux clients internationaux.",
      url: "https://www.dhl.com/ma-fr/home/express.html" },

    /* Advertising */
    { cat: "ads", highlight: true,
      name: "Amazon Ads — Maroc (via amazon.fr)", name_ar: "إعلانات أمازون — المغرب (عبر amazon.fr)", name_fr: "Amazon Ads — Maroc (via amazon.fr)",
      desc_en: "Moroccan sellers run Sponsored Products and Sponsored Brands ads on amazon.fr to reach French-speaking EU shoppers.",
      desc_ar: "يدير البائعون المغاربة إعلانات المنتجات المدعومة والعلامات التجارية على amazon.fr للوصول إلى متسوقي EU الناطقين بالفرنسية.",
      desc_fr: "Les vendeurs marocains diffusent Sponsored Products et Sponsored Brands sur amazon.fr pour toucher acheteurs EU francophones.",
      url: "https://advertising.amazon.com/fr-fr" },
    { cat: "ads",
      name: "Amazon Attribution — Performance", name_ar: "نسب أمازون — قياس الأداء", name_fr: "Amazon Attribution — Performance",
      desc_en: "Measure how your off-Amazon marketing channels (social, search, email) drive sales on your Amazon listings.",
      desc_ar: "قياس كيف تدفع قنوات التسويق خارج أمازون (التواصل الاجتماعي والبحث والبريد الإلكتروني) مبيعاتك على قوائم أمازون.",
      desc_fr: "Mesurez comment vos canaux marketing hors Amazon (social, search, email) génèrent des ventes sur vos listings Amazon.",
      url: "https://advertising.amazon.com/solutions/products/amazon-attribution" },

    /* Pay */
    { cat: "pay", highlight: true,
      name: "AWS Activate — Startups Maroc", name_ar: "AWS تنشيط — الشركات الناشئة المغربية", name_fr: "AWS Activate — Startups Maroc",
      desc_en: "Free AWS cloud credits, mentorship and training for Moroccan startups through CFC, UM6P Ventures and Startups Maroc.",
      desc_ar: "أرصدة سحابية AWS مجانية وإرشاد وتدريب للشركات الناشئة المغربية عبر CFC وUM6P Ventures وStartups Maroc.",
      desc_fr: "Crédits cloud AWS gratuits, mentorat et formation pour startups marocaines via CFC, UM6P Ventures et Startups Maroc.",
      url: "https://aws.amazon.com/activate" },
    { cat: "pay",
      name: "Amazon Pay — Intégration E-commerce Maroc", name_ar: "أمازون باي — تكامل التجارة الإلكترونية", name_fr: "Amazon Pay — Intégration E-commerce Maroc",
      desc_en: "Integrate Amazon Pay into Moroccan e-commerce sites (WooCommerce, Magento) to accept secure international payments.",
      desc_ar: "دمج Amazon Pay في مواقع التجارة الإلكترونية المغربية (WooCommerce وMagento) لقبول مدفوعات دولية آمنة.",
      desc_fr: "Intégrez Amazon Pay dans les sites e-commerce marocains (WooCommerce, Magento) pour accepter paiements internationaux sécurisés.",
      url: "https://pay.amazon.com/fr" },
  ],
};

/* ─── Component ──────────────────────────────────────────────────────── */
export function ScreenAmazon() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const [country, setCountry] = useState<CountryKey>("ae");
  const [cat, setCat]         = useState<CatKey | "all">("all");

  const country_meta = COUNTRIES.find(c => c.key === country)!;
  const services     = SERVICES[country];
  const kpis         = KPIS[country];

  const label = (s: AService) => lang === "ar" ? s.name_ar : lang === "fr" ? s.name_fr : s.name;
  const desc  = (s: AService) => lang === "ar" ? s.desc_ar : lang === "fr" ? s.desc_fr : s.desc_en;
  const catLabel = (c: (typeof CATS)[0]) => lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en;
  const tagline = lang === "ar" ? country_meta.tagline_ar : lang === "fr" ? country_meta.tagline_fr : country_meta.tagline_en;

  const filtered = cat === "all" ? services : services.filter(s => s.cat === cat);
  const grouped = CATS.map(c => ({
    ...c, items: services.filter(s => s.cat === c.key),
  })).filter(g => g.items.length > 0);

  const topbarTitle = lang === "ar" ? "أمازون" : "Amazon";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={topbarTitle} />

      <div style={{ flex: 1, overflowY: "auto", background: "var(--bg-cream)" }}>

        {/* ── Hero — Amazon orange gradient ── */}
        <div style={{
          background: "linear-gradient(135deg, #0d0c0a 0%, #1a1208 50%, #231800 100%)",
          padding: isMob ? "24px 16px 20px" : "32px 36px 28px",
          borderBottom: "2px solid #FF9900",
        }}>
          {/* Amazon smile accent */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: "#FF9900", display: "grid", placeItems: "center" }}>
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.5" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            </div>
            <div style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "#FF9900", opacity: 0.8 }}>
              {lang === "ar" ? "خدمات أمازون" : lang === "fr" ? "Services Amazon" : "Amazon Services"}
            </div>
          </div>

          {/* Country selector */}
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {COUNTRIES.map(c => (
              <button key={c.key} onClick={() => { setCountry(c.key); setCat("all"); }}
                style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 14px", borderRadius: 999, cursor: "pointer",
                  background: country === c.key ? "rgba(255,153,0,0.2)" : "rgba(255,255,255,0.06)",
                  border: country === c.key ? "1px solid #FF9900" : "1px solid rgba(255,255,255,0.1)",
                  color: country === c.key ? "#FF9900" : "rgba(255,255,255,0.55)",
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
                <div className="font-display tnum" style={{ fontSize: 22, color: "#FF9900", letterSpacing: "0.02em" }}>{k.n}</div>
                <div style={{ fontSize: 10.5, color: "rgba(255,255,255,0.45)", marginTop: 3 }}>
                  {lang === "ar" ? k.ar : lang === "fr" ? k.fr : k.en}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Category filter pills ── */}
        <div style={{ padding: isMob ? "14px 12px" : "16px 24px", background: "var(--bg-paper)", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: 8, overflowX: "auto", flexWrap: isMob ? "nowrap" : "wrap" }}>
          <button onClick={() => setCat("all")}
            style={{
              padding: "6px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              background: cat === "all" ? "#FF9900" : "var(--bg-ivory)",
              color: cat === "all" ? "#000" : "var(--ink-3)",
              border: cat === "all" ? "1px solid #FF9900" : "1px solid var(--line-soft)",
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
                <span style={{ width: 13, height: 13, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{c.icon}</span>
                {catLabel(c)}
                <span style={{ fontSize: 10, opacity: 0.6 }}>{count}</span>
              </button>
            );
          })}
        </div>

        {/* ── Cards ── */}
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
  s: AService;
  catColor: string;
  label: (s: AService) => string;
  desc: (s: AService) => string;
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
        <span style={{ position: "absolute", top: 10, insetInlineEnd: 10, fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: `${catColor}20`, color: catColor, letterSpacing: "0.1em" }}>★</span>
      )}
      {s.tag && (
        <span style={{ display: "inline-block", marginBottom: 8, fontSize: 9.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${catColor}15`, color: catColor, letterSpacing: "0.08em" }}>
          {s.tag}
        </span>
      )}
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginBottom: 6, lineHeight: 1.3 }}>{label(s)}</div>
      <div style={{ fontSize: 12, color: "var(--ink-3)", lineHeight: 1.6 }}>{desc(s)}</div>
      <div style={{ marginTop: 10, fontSize: 10.5, color: catColor, opacity: 0.8, display: "flex", alignItems: "center", gap: 4 }}>
        <svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14 21 3"/></svg>
        {new URL(s.url).hostname.replace("www.", "")}
      </div>
    </a>
  );
}
