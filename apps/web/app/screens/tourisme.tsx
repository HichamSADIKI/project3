"use client";
import React, { useState } from "react";
import { useBreakpoint } from "@/lib/hooks";
import { Topbar, Eyebrow, Ic } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";

/* ─── Category icons ────────────────────────────────────────────────── */
const IcPortal    = () => <Ic><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Ic>;
const IcAttract   = () => <Ic><path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></Ic>;
const IcHotel     = () => <Ic><path d="M3 18v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7M3 14h18"/><circle cx="7" cy="11" r="1.5"/></Ic>;
const IcTransport = () => <Ic><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4 2.4h3a2 2 0 0 1 2 1.7l.4 2.5a2 2 0 0 1-.6 1.8L7.6 9.8a16 16 0 0 0 6.6 6.6l1.4-1.2a2 2 0 0 1 1.8-.6l2.5.4a2 2 0 0 1 1.7 2z"/></Ic>;
const IcCulture   = () => <Ic><path d="M2 20h20M4 20V10M20 20V10M12 20V4M4 10l8-6 8 6"/></Ic>;
const IcVisaTour  = () => <Ic><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h3M14 15h3"/></Ic>;

/* ─── Types ──────────────────────────────────────────────────────────── */
type CountryKey  = "ae" | "sa" | "ma";
type CatKey      = "portal" | "attract" | "hotel" | "transport" | "culture" | "visa";

interface TService {
  name: string;
  name_ar: string;
  name_fr: string;
  desc_en: string;
  desc_ar: string;
  desc_fr: string;
  url: string;
  cat: CatKey;
  tag?: string;
  highlight?: boolean;
}

/* ─── Category meta ──────────────────────────────────────────────────── */
const CATS: { key: CatKey; en: string; ar: string; fr: string; icon: React.ReactElement; color: string }[] = [
  { key: "portal",    en: "Official Portals", ar: "البوابات الرسمية",   fr: "Portails officiels",  icon: <IcPortal />,    color: "var(--azure)" },
  { key: "attract",   en: "Attractions",      ar: "المعالم السياحية",   fr: "Attractions",         icon: <IcAttract />,   color: "var(--gold)" },
  { key: "hotel",     en: "Accommodation",    ar: "الإقامة",            fr: "Hébergement",         icon: <IcHotel />,     color: "var(--emerald)" },
  { key: "transport", en: "Transport",        ar: "المواصلات",          fr: "Transport",           icon: <IcTransport />, color: "#F59E0B" },
  { key: "culture",   en: "Culture & Leisure",ar: "الثقافة والترفيه",   fr: "Culture & Loisirs",  icon: <IcCulture />,   color: "#8B5CF6" },
  { key: "visa",      en: "Visas & Entry",    ar: "التأشيرات والدخول",  fr: "Visas & Formalités", icon: <IcVisaTour />,  color: "var(--rose)" },
];

/* ─── Country meta ───────────────────────────────────────────────────── */
const COUNTRIES: { key: CountryKey; flag: string; en: string; ar: string; fr: string; tagline_en: string; tagline_ar: string; tagline_fr: string; gradient: string }[] = [
  {
    key: "ae", flag: "🇦🇪",
    en: "UAE", ar: "الإمارات", fr: "EAU",
    tagline_en: "United Arab Emirates · Gateway to the world",
    tagline_ar: "الإمارات العربية المتحدة · بوابة العالم",
    tagline_fr: "Émirats Arabes Unis · La porte du monde",
    gradient: "linear-gradient(135deg, #0A2342 0%, #1A3A5C 60%, #0D5C3A 100%)",
  },
  {
    key: "sa", flag: "🇸🇦",
    en: "KSA", ar: "المملكة", fr: "Arabie Saoudite",
    tagline_en: "Kingdom of Saudi Arabia · Where heritage meets Vision 2030",
    tagline_ar: "المملكة العربية السعودية · حيث يلتقي الإرث برؤية 2030",
    tagline_fr: "Arabie Saoudite · Là où le patrimoine rencontre Vision 2030",
    gradient: "linear-gradient(135deg, #1A2610 0%, #2E4020 60%, #3B1A0A 100%)",
  },
  {
    key: "ma", flag: "🇲🇦",
    en: "Morocco", ar: "المغرب", fr: "Maroc",
    tagline_en: "Kingdom of Morocco · Where the Sahara meets the Atlantic",
    tagline_ar: "المملكة المغربية · حيث الصحراء تلتقي الأطلسي",
    tagline_fr: "Royaume du Maroc · Là où le Sahara rencontre l'Atlantique",
    gradient: "linear-gradient(135deg, #2A0A0A 0%, #4A1010 60%, #8B1A1A 100%)",
  },
];

/* ─── Service data ───────────────────────────────────────────────────── */
const SERVICES: Record<CountryKey, TService[]> = {
  ae: [
    /* Portails */
    { cat: "portal", highlight: true, tag: "Dubai",
      name: "Visit Dubai", name_ar: "زيارة دبي", name_fr: "Visit Dubai",
      url: "https://www.visitdubai.com",
      desc_en: "Official Dubai tourism portal — itineraries, events, hotels and experiences curated by Dubai Tourism.",
      desc_ar: "البوابة الرسمية لسياحة دبي — خطط السفر والفعاليات والفنادق والتجارب.",
      desc_fr: "Portail officiel du tourisme de Dubaï — itinéraires, événements, hôtels et expériences." },
    { cat: "portal", highlight: true, tag: "Abu Dhabi",
      name: "Visit Abu Dhabi", name_ar: "زيارة أبوظبي", name_fr: "Visit Abu Dhabi",
      url: "https://www.visitabudhabi.ae",
      desc_en: "Abu Dhabi's official tourism authority — plan your stay, discover culture, island escapes and F1 events.",
      desc_ar: "الهيئة الرسمية لسياحة أبوظبي — ابق وتعرف على الثقافة والجزر وسباقات الفورمولا 1.",
      desc_fr: "Autorité officielle du tourisme d'Abu Dhabi — séjour, culture, îles et Formule 1." },
    { cat: "portal", tag: "Fédéral",
      name: "UAE Tourism", name_ar: "السياحة الإماراتية", name_fr: "Tourisme EAU",
      url: "https://u.ae/en/information-and-services/visiting-and-exploring-the-uae",
      desc_en: "Federal UAE tourism gateway — entry requirements, travel tips and destination guides.",
      desc_ar: "البوابة الاتحادية للسياحة في الإمارات — متطلبات الدخول ونصائح السفر.",
      desc_fr: "Portail fédéral du tourisme aux EAU — conditions d'entrée, conseils et guides." },
    /* Attractions */
    { cat: "attract", tag: "Dubai",
      name: "Burj Khalifa / At The Top", name_ar: "برج خليفة / في القمة", name_fr: "Burj Khalifa",
      url: "https://www.burjkhalifa.ae",
      desc_en: "World's tallest building — sky-high observation decks on floors 124, 125 and 148.",
      desc_ar: "أطول مبنى في العالم — مراصد في الطوابق 124 و125 و148.",
      desc_fr: "Le plus haut bâtiment du monde — observatoires aux étages 124, 125 et 148." },
    { cat: "attract", tag: "Dubai",
      name: "Dubai Mall", name_ar: "دبي مول", name_fr: "Dubai Mall",
      url: "https://www.thedubaimall.com",
      desc_en: "World's largest shopping and entertainment destination — aquarium, ice rink, over 1,300 stores.",
      desc_ar: "أكبر وجهة تسوق وترفيه في العالم — حوض مائي وحلبة جليد وأكثر من 1300 متجر.",
      desc_fr: "Plus grande destination shopping et loisirs du monde — aquarium, patinoire, 1 300 boutiques." },
    { cat: "attract", tag: "Abu Dhabi",
      name: "Yas Island", name_ar: "جزيرة ياس", name_fr: "Île Yas",
      url: "https://www.yasisland.ae",
      desc_en: "Abu Dhabi's leisure island — Ferrari World, Yas Waterworld, Warner Bros. World and F1 circuit.",
      desc_ar: "جزيرة الترفيه في أبوظبي — فيراري وورلد وياس ووتروورلد وبطل العالم وحلبة الفورمولا 1.",
      desc_fr: "L'île des loisirs d'Abu Dhabi — Ferrari World, Yas Waterworld, Warner Bros. et circuit F1." },
    { cat: "attract", tag: "Abu Dhabi",
      name: "Sheikh Zayed Grand Mosque", name_ar: "مسجد الشيخ زايد", name_fr: "Grande Mosquée",
      url: "https://www.szgmc.gov.ae",
      desc_en: "One of the world's largest mosques — iconic white marble architecture, open to all visitors.",
      desc_ar: "أحد أكبر مساجد العالم — معمار رخامي أبيض مميز، مفتوح لجميع الزوار.",
      desc_fr: "L'une des plus grandes mosquées du monde — architecture en marbre blanc, ouverte à tous." },
    { cat: "attract", tag: "Dubai",
      name: "Palm Jumeirah", name_ar: "نخلة جميرا", name_fr: "Palm Jumeirah",
      url: "https://www.palmjumeirah.com",
      desc_en: "Iconic palm-shaped archipelago — luxury hotels, beach clubs, fine dining and the Monorail.",
      desc_ar: "الأرخبيل الأيقوني على شكل نخلة — فنادق فاخرة ونوادي شاطئية وتجارب متنوعة.",
      desc_fr: "L'archipel en forme de palmier — hôtels de luxe, clubs de plage et gastronomie." },
    /* Hébergement */
    { cat: "hotel", tag: "Dubai",
      name: "Jumeirah Hotels & Resorts", name_ar: "فنادق ومنتجعات جميرا", name_fr: "Jumeirah Hotels",
      url: "https://www.jumeirah.com",
      desc_en: "Luxury hospitality group — Burj Al Arab, Madinat Jumeirah and iconic Dubai hotels.",
      desc_ar: "مجموعة ضيافة فاخرة — برج العرب ومدينة جميرا وفنادق دبي الشهيرة.",
      desc_fr: "Groupe hôtelier de luxe — Burj Al Arab, Madinat Jumeirah et hôtels iconiques de Dubaï." },
    { cat: "hotel", tag: "Abu Dhabi",
      name: "Anantara Hotels UAE", name_ar: "فنادق أناناترا", name_fr: "Anantara UAE",
      url: "https://www.anantara.com/en/qasr-al-sarab-abu-dhabi",
      desc_en: "Award-winning luxury desert resort — Qasr Al Sarab, a mirage in the Empty Quarter.",
      desc_ar: "منتجع فاخر في الصحراء — قصر الصراب، سراب في الربع الخالي.",
      desc_fr: "Resort de luxe dans le désert — Qasr Al Sarab, un mirage dans le Rub al-Khali." },
    /* Transport */
    { cat: "transport", tag: "Dubai",
      name: "Emirates Airlines", name_ar: "طيران الإمارات", name_fr: "Emirates",
      url: "https://www.emirates.com",
      desc_en: "Dubai's flagship carrier — worldwide connections from Dubai International Airport.",
      desc_ar: "الناقل الرئيسي لدبي — رحلات إلى جميع أنحاء العالم من مطار دبي الدولي.",
      desc_fr: "Compagnie aérienne phare de Dubaï — connexions mondiales depuis l'aéroport de Dubaï." },
    { cat: "transport", tag: "Abu Dhabi",
      name: "Etihad Airways", name_ar: "الاتحاد للطيران", name_fr: "Etihad Airways",
      url: "https://www.etihad.com",
      desc_en: "Abu Dhabi's national airline — First Class Apartments and premium connections worldwide.",
      desc_ar: "الخط الجوي الوطني لأبوظبي — شققSuite الدرجة الأولى ورحلات متميزة عالمية.",
      desc_fr: "Compagnie nationale d'Abu Dhabi — appartements de Première Classe et connexions mondiales." },
    { cat: "transport", tag: "Dubai",
      name: "RTA Dubai", name_ar: "هيئة الطرق والمواصلات", name_fr: "RTA Dubaï",
      url: "https://www.rta.ae",
      desc_en: "Roads & Transport Authority — Dubai Metro, bus, water taxi and NOL card information.",
      desc_ar: "هيئة الطرق والمواصلات — مترو دبي والحافلات والتاكسي المائي وبطاقة نول.",
      desc_fr: "Autorité des routes et transports — Metro, bus, taxi nautique et carte NOL." },
    { cat: "transport", tag: "Régional",
      name: "Careem", name_ar: "كريم", name_fr: "Careem",
      url: "https://www.careem.com",
      desc_en: "Regional ride-hailing super app — cars, motorbikes, deliveries across the UAE.",
      desc_ar: "تطبيق التنقل الإقليمي الشامل — سيارات ودراجات وتوصيل في جميع أنحاء الإمارات.",
      desc_fr: "Super app de mobilité — voitures, motos et livraisons dans tout les EAU." },
    /* Culture */
    { cat: "culture", tag: "Abu Dhabi",
      name: "Louvre Abu Dhabi", name_ar: "متحف اللوفر أبوظبي", name_fr: "Louvre Abu Dhabi",
      url: "https://www.louvreabudhabi.ae",
      desc_en: "Universal museum — masterpieces from prehistory to the 21st century under Jean Nouvel's dome.",
      desc_ar: "متحف عالمي — روائع من عصور ما قبل التاريخ إلى القرن الحادي والعشرين تحت قبة جان نوفيل.",
      desc_fr: "Musée universel — chefs-d'œuvre de la préhistoire au XXIe siècle sous la coupole de Jean Nouvel." },
    { cat: "culture", tag: "Dubai",
      name: "Dubai Opera", name_ar: "دبي أوبرا", name_fr: "Dubai Opera",
      url: "https://www.dubaiopera.com",
      desc_en: "Multi-format performing arts venue — opera, ballet, concerts and Broadway shows.",
      desc_ar: "مكان للفنون الأدائية — أوبرا وباليه وحفلات موسيقية وعروض برودواي.",
      desc_fr: "Salle de spectacle multiformat — opéra, ballet, concerts et comédies musicales." },
    { cat: "culture", tag: "Dubai",
      name: "Global Village", name_ar: "القرية العالمية", name_fr: "Global Village",
      url: "https://www.globalvillage.ae",
      desc_en: "Seasonal multicultural festival — 90+ countries, 3,500 shows per season, Oct–Apr.",
      desc_ar: "مهرجان ثقافي موسمي — أكثر من 90 دولة و3500 عرض بين أكتوبر وأبريل.",
      desc_fr: "Festival multiculturel saisonnier — 90+ pays, 3 500 spectacles d'oct. à avr." },
    /* Visas */
    { cat: "visa", tag: "Fédéral",
      name: "UAE Visa on Arrival / eVisa", name_ar: "التأشيرة الإماراتية", name_fr: "eVisa EAU",
      url: "https://u.ae/en/information-and-services/visa-and-emirates-id",
      desc_en: "Official UAE visa information — tourist visa, visa on arrival eligibility and application.",
      desc_ar: "معلومات التأشيرة الإماراتية الرسمية — التأشيرة السياحية وتأشيرة الوصول.",
      desc_fr: "Informations officielles sur le visa EAU — visa touristique et visa à l'arrivée." },
  ],

  sa: [
    /* Portails */
    { cat: "portal", highlight: true, tag: "National",
      name: "Visit Saudi", name_ar: "زيارة السعودية", name_fr: "Visit Saudi",
      url: "https://www.visitsaudi.com",
      desc_en: "Official Saudi Tourism Authority portal — destinations, experiences and travel planning.",
      desc_ar: "البوابة الرسمية للهيئة السعودية للسياحة — وجهات وتجارب وتخطيط الرحلات.",
      desc_fr: "Portail officiel de l'Autorité Saoudienne du Tourisme — destinations et expériences." },
    { cat: "portal", tag: "National",
      name: "Sharek Tourism Platform", name_ar: "منصة شارك السياحية", name_fr: "Sharek",
      url: "https://www.sharektourism.com.sa",
      desc_en: "Saudi domestic tourism platform — local destinations, packages and activities.",
      desc_ar: "منصة السياحة الداخلية السعودية — وجهات محلية وباقات وأنشطة.",
      desc_fr: "Plateforme de tourisme intérieur saoudien — destinations locales et activités." },
    /* Attractions */
    { cat: "attract", highlight: true, tag: "AlUla",
      name: "AlUla — Experience AlUla", name_ar: "العلا — استكشف العلا", name_fr: "AlUla",
      url: "https://www.experiencealula.com",
      desc_en: "Saudi Arabia's open-air museum — ancient Hegra (Madain Saleh), rock art and desert landscapes.",
      desc_ar: "متحف المملكة في الهواء الطلق — الحِجر (مدائن صالح) وفن الصخور والمناظر الصحراوية.",
      desc_fr: "Le musée à ciel ouvert d'Arabie Saoudite — Hégra, art rupestre et paysages désertiques." },
    { cat: "attract", tag: "Riyadh",
      name: "Diriyah — UNESCO Site", name_ar: "الدرعية — موقع يونسكو", name_fr: "Diriyah",
      url: "https://www.diriyah.sa",
      desc_en: "Birthplace of the Saudi state — UNESCO-listed historic mud-brick city and cultural hub.",
      desc_ar: "مهد الدولة السعودية — مدينة تاريخية من الطين مدرجة في اليونسكو.",
      desc_fr: "Berceau de l'État saoudien — cité historique en pisé inscrite à l'UNESCO." },
    { cat: "attract", tag: "NEOM",
      name: "NEOM / THE LINE", name_ar: "نيوم / ذا لاين", name_fr: "NEOM / THE LINE",
      url: "https://www.neom.com",
      desc_en: "Futuristic mega-project — sustainable city, Sindalah island and mountain resort Trojena.",
      desc_ar: "مشروع المستقبل الضخم — مدينة مستدامة وجزيرة سندالة ومنتجع ترجينا الجبلي.",
      desc_fr: "Méga-projet futuriste — ville durable, île Sindalah et station de montagne Trojena." },
    { cat: "attract", tag: "Jeddah",
      name: "Al-Balad Historic Jeddah", name_ar: "البلد التاريخية بجدة", name_fr: "Jeddah Historique",
      url: "https://www.visitsaudi.com/en/jeddah",
      desc_en: "UNESCO World Heritage site — coral-built houses, traditional souks and Red Sea waterfront.",
      desc_ar: "موقع التراث العالمي لليونسكو — بيوت من المرجان والأسواق التقليدية وواجهة البحر الأحمر.",
      desc_fr: "Patrimoine mondial de l'UNESCO — maisons en corail, souks traditionnels et front de mer." },
    /* Hébergement */
    { cat: "hotel", tag: "AlUla",
      name: "Banyan Tree AlUla", name_ar: "بانيان تري العلا", name_fr: "Banyan Tree AlUla",
      url: "https://www.banyantree.com/saudi-arabia/alula",
      desc_en: "Desert luxury tented camp in the heart of AlUla — among ancient rock formations.",
      desc_ar: "مخيم فاخر في قلب العلا — وسط التكوينات الصخرية القديمة.",
      desc_fr: "Camp de luxe sous tente au cœur d'AlUla — parmi les formations rocheuses antiques." },
    { cat: "hotel", tag: "Riyadh",
      name: "Four Seasons Riyadh", name_ar: "فورسيزونز الرياض", name_fr: "Four Seasons Riyad",
      url: "https://www.fourseasons.com/riyadh",
      desc_en: "Iconic 5-star tower in Kingdom Centre — dining, spa and skyline views over Riyadh.",
      desc_ar: "البرج الأيقوني الخمس نجوم في مركز المملكة — مطاعم وسبا وإطلالات بانورامية.",
      desc_fr: "Tour iconique 5 étoiles dans Kingdom Centre — restaurants, spa et vue panoramique." },
    /* Transport */
    { cat: "transport", tag: "National",
      name: "Saudi Airlines", name_ar: "السعودية للطيران", name_fr: "Saudi Airlines",
      url: "https://www.saudiairlines.com",
      desc_en: "Saudi Arabia's national carrier — domestic and international flights from Riyadh, Jeddah, Dammam.",
      desc_ar: "الناقل الوطني السعودي — رحلات داخلية ودولية من الرياض وجدة والدمام.",
      desc_fr: "Compagnie nationale saoudienne — vols intérieurs et internationaux." },
    { cat: "transport", tag: "National",
      name: "SAR — Saudi Railways", name_ar: "السكك الحديدية السعودية", name_fr: "SAR Railways",
      url: "https://www.sar.com.sa",
      desc_en: "Saudi Railways — Haramain High Speed Railway (Mecca–Medina) and North network.",
      desc_ar: "السكك الحديدية السعودية — قطار الحرمين السريع (مكة المكرمة–المدينة المنورة).",
      desc_fr: "Trains saoudiens — TGV Haramaïn (La Mecque–Médine) et réseau Nord." },
    { cat: "transport", tag: "Riyadh",
      name: "Riyadh Metro", name_ar: "مترو الرياض", name_fr: "Métro de Riyad",
      url: "https://www.riyadhmetro.gov.sa",
      desc_en: "6-line metro network — connect Riyadh's districts, airport and King Abdulaziz landmarks.",
      desc_ar: "شبكة مترو من 6 خطوط — تربط أحياء الرياض والمطار ومعالم الملك عبدالعزيز.",
      desc_fr: "Réseau de métro à 6 lignes — quartiers de Riyad, aéroport et sites emblématiques." },
    /* Culture */
    { cat: "culture", tag: "National",
      name: "National Museum Riyadh", name_ar: "المتحف الوطني الرياض", name_fr: "Musée National Riyad",
      url: "https://www.visitsaudi.com/en/riyadh/attractions/national-museum-of-saudi-arabia",
      desc_en: "8-gallery museum tracing Arabia's history from ancient times to the modern Kingdom.",
      desc_ar: "متحف من 8 صالات يرصد تاريخ الجزيرة العربية من القدم إلى المملكة الحديثة.",
      desc_fr: "8 galeries retraçant l'histoire de l'Arabie antique au Royaume moderne." },
    { cat: "culture", tag: "Jeddah",
      name: "Jeddah Waterfront (Corniche)", name_ar: "كورنيش جدة", name_fr: "Corniche Jeddah",
      url: "https://www.visitsaudi.com/en/jeddah",
      desc_en: "30 km seaside promenade — King Fahd Fountain, sculptures, cafés and the Floating Mosque.",
      desc_ar: "كورنيش بحري بطول 30 كم — نافورة الملك فهد والمنحوتات ومسجد الرحمة.",
      desc_fr: "Promenade bord de mer de 30 km — Fontaine du Roi Fahd et Mosquée flottante." },
    /* Visas */
    { cat: "visa", tag: "National",
      name: "Saudi eVisa", name_ar: "التأشيرة الإلكترونية السعودية", name_fr: "eVisa Arabie Saoudite",
      url: "https://www.visasaudi.com",
      desc_en: "Saudi tourist eVisa — 49 eligible nationalities, 1-year multiple-entry, apply online.",
      desc_ar: "تأشيرة سياحية إلكترونية لـ 49 جنسية — دخول متعدد لسنة، تقدم عبر الإنترنت.",
      desc_fr: "eVisa touristique pour 49 nationalités — entrées multiples 1 an, demande en ligne." },
  ],

  ma: [
    /* Portails */
    { cat: "portal", highlight: true, tag: "National",
      name: "Visit Morocco", name_ar: "زيارة المغرب", name_fr: "Visit Morocco",
      url: "https://www.visitmorocco.com",
      desc_en: "Morocco's official national tourism office — travel guides, itineraries and practical info.",
      desc_ar: "المكتب الوطني الرسمي للسياحة المغربية — أدلة سياحية وخطط رحلات ومعلومات عملية.",
      desc_fr: "Office National Marocain du Tourisme — guides, itinéraires et informations pratiques." },
    { cat: "portal", tag: "National",
      name: "Maroc Tourisme (ONMT)", name_ar: "المكتب الوطني المغربي للسياحة", name_fr: "ONMT Maroc",
      url: "https://www.tourisme.gov.ma",
      desc_en: "Ministry of Tourism — professional registration, accommodation licensing and tourism statistics.",
      desc_ar: "وزارة السياحة — التسجيل المهني وترخيص الإقامة وإحصاءات السياحة.",
      desc_fr: "Ministère du Tourisme — agréments professionnels, hébergements et statistiques touristiques." },
    /* Attractions */
    { cat: "attract", highlight: true, tag: "Marrakech",
      name: "Djemaa el-Fna · Médina Marrakech", name_ar: "جامع الفنا · مدينة مراكش", name_fr: "Jemaa el-Fna",
      url: "https://www.visitmorocco.com/fr/voyager/marrakech",
      desc_en: "UNESCO-listed central square — snake charmers, storytellers and Moroccan night market.",
      desc_ar: "الساحة المركزية المدرجة في اليونسكو — حاوو الأفاعي والحكواتيون وسوق الليل المغربي.",
      desc_fr: "Place centrale inscrite à l'UNESCO — charmeurs de serpents, conteurs et marché nocturne." },
    { cat: "attract", tag: "Fès",
      name: "Médina de Fès el-Bali", name_ar: "مدينة فاس البالي", name_fr: "Fès el-Bali",
      url: "https://www.visitmorocco.com/fr/voyager/fes",
      desc_en: "World's largest car-free urban area — UNESCO medieval medina, tanneries and madrasas.",
      desc_ar: "أكبر منطقة حضرية خالية من السيارات في العالم — مدينة قروسطية في اليونسكو ودباغات.",
      desc_fr: "Plus grande zone urbaine sans voiture au monde — médina médiévale UNESCO et tanneries." },
    { cat: "attract", tag: "Sahara",
      name: "Désert du Sahara — Merzouga", name_ar: "صحراء الساحرة — مرزوكة", name_fr: "Sahara — Merzouga",
      url: "https://www.visitmorocco.com/fr/voyager/errachidia",
      desc_en: "Golden sand dunes of Erg Chebbi — camel treks, desert camps under the stars.",
      desc_ar: "كثبان عرق الشبي الذهبية — رحلات الجمال ومخيمات الصحراء تحت النجوم.",
      desc_fr: "Dunes dorées de l'Erg Chebbi — randonnées à dos de dromadaire et bivouacs sous les étoiles." },
    { cat: "attract", tag: "Chefchaouen",
      name: "Chefchaouen — Ville bleue", name_ar: "شفشاون — المدينة الزرقاء", name_fr: "Chefchaouen",
      url: "https://www.visitmorocco.com/fr/voyager/chefchaouen",
      desc_en: "The Blue City — Instagram-famous streets, mountain hiking and traditional craft markets.",
      desc_ar: "المدينة الزرقاء — شوارع شهيرة على إنستغرام وتسلق الجبال وأسواق الحرف التقليدية.",
      desc_fr: "La Ville Bleue — rues célèbres sur Instagram, randonnées et marchés artisanaux." },
    /* Hébergement */
    { cat: "hotel", tag: "Marrakech",
      name: "La Mamounia", name_ar: "لا مامونية", name_fr: "La Mamounia",
      url: "https://www.mamounia.com",
      desc_en: "Legendary 5-star palace hotel — Art Deco gardens, hammam and world-renowned dining.",
      desc_ar: "فندق القصر الأسطوري خمس نجوم — حدائق فن ديكو وحمام وعشاء ذائع الصيت.",
      desc_fr: "Légendaire palace 5 étoiles — jardins Art Déco, hammam et gastronomie mondialement connue." },
    { cat: "hotel", tag: "National",
      name: "Riad Booking Morocco", name_ar: "حجز الرياض المغرب", name_fr: "Riad Booking Morocco",
      url: "https://www.riad-booking-morocco.com",
      desc_en: "Curated selection of traditional riads across Morocco — Marrakech, Fès, Essaouira.",
      desc_ar: "مجموعة مختارة من الرياضات التقليدية في المغرب — مراكش وفاس والصويرة.",
      desc_fr: "Sélection de riads traditionnels — Marrakech, Fès, Essaouira et plus." },
    /* Transport */
    { cat: "transport", tag: "National",
      name: "Royal Air Maroc", name_ar: "الخطوط الملكية المغربية", name_fr: "Royal Air Maroc",
      url: "https://www.royalairmaroc.com",
      desc_en: "Morocco's national airline — international connections and domestic flights across Morocco.",
      desc_ar: "الخط الجوي الوطني المغربي — رحلات دولية وداخلية في جميع أنحاء المغرب.",
      desc_fr: "Compagnie nationale marocaine — vols internationaux et liaisons intérieures." },
    { cat: "transport", tag: "National",
      name: "ONCF — Train Maroc", name_ar: "المكتب الوطني للسكك الحديدية", name_fr: "ONCF Trains",
      url: "https://www.oncf.ma",
      desc_en: "National rail network — Al Boraq TGV (Casablanca–Tanger), Marrakech and Fès lines.",
      desc_ar: "شبكة القطارات الوطنية — البراق TGV (الدار البيضاء–طنجة) وخطوط مراكش وفاس.",
      desc_fr: "Réseau ferroviaire national — TGV Al Boraq (Casablanca–Tanger), Marrakech et Fès." },
    { cat: "transport", tag: "National",
      name: "CTM — Lignes nationales", name_ar: "النقل الطرقي الوطني", name_fr: "CTM",
      url: "https://www.ctm.ma",
      desc_en: "Premium intercity bus network — comfortable coaches connecting all Moroccan cities.",
      desc_ar: "شبكة الحافلات بين المدن — حافلات مريحة تربط جميع المدن المغربية.",
      desc_fr: "Réseau de cars interurbains — liaisons confortables entre toutes les villes marocaines." },
    /* Culture */
    { cat: "culture", tag: "Casablanca",
      name: "Hassan II Mosque", name_ar: "مسجد الحسن الثاني", name_fr: "Mosquée Hassan II",
      url: "https://www.fmh2.ma",
      desc_en: "World's 7th largest mosque — guided tours, minaret visible 100 km out to sea.",
      desc_ar: "سابع أكبر مساجد العالم — جولات إرشادية ومئذنة ترى على بعد 100 كم في البحر.",
      desc_fr: "7e plus grande mosquée du monde — visites guidées et minaret visible à 100 km en mer." },
    { cat: "culture", tag: "Marrakech",
      name: "Jardin Majorelle · Musée Yves Saint Laurent", name_ar: "حديقة ماجوريل", name_fr: "Jardin Majorelle",
      url: "https://www.jardinmajorelle.com",
      desc_en: "Iconic cobalt-blue botanical garden — Berber museum and adjacent YSL museum.",
      desc_ar: "الحديقة النباتية الأيقونية الزرقاء الكوبالت — متحف البربر ومتحف إيف سان لوران المجاور.",
      desc_fr: "Jardin botanique iconique bleu cobalt — Musée Berbère et Musée Yves Saint Laurent." },
    /* Visas */
    { cat: "visa", tag: "National",
      name: "Morocco Visa Information", name_ar: "معلومات التأشيرة المغربية", name_fr: "Visa Maroc",
      url: "https://www.moroccanembassy.com/visa",
      desc_en: "Moroccan visa requirements — 60+ nationalities visa-free, eVisa and embassy applications.",
      desc_ar: "متطلبات التأشيرة المغربية — أكثر من 60 جنسية إعفاء من التأشيرة.",
      desc_fr: "Conditions visa Maroc — 60+ nationalités exemptées, eVisa et demandes en ambassade." },
  ],
};

/* ─── Service Card ────────────────────────────────────────────────────── */
function TourCard({ s, lang, isMob }: { s: TService; lang: string; isMob: boolean }) {
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
          display: "grid", placeItems: "center",
          color: cat.color,
        }}>
          {cat.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 6, flexWrap: "wrap" }}>
            <div style={{ fontSize: lang === "ar" ? 13.5 : 13, fontWeight: 600, lineHeight: 1.3 }}
              className={lang === "ar" ? "font-ar" : undefined}>{name}</div>
            {s.highlight && <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 999, background: cat.color, color: "#fff", fontWeight: 600, flexShrink: 0, marginTop: 2 }}>★</span>}
          </div>
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
        onMouseEnter={e => { e.currentTarget.style.background = cat.color; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = cat.color; }}
        onMouseLeave={e => { e.currentTarget.style.background = "var(--bg-inset)"; e.currentTarget.style.color = "var(--ink-2)"; e.currentTarget.style.borderColor = "var(--line-soft)"; }}
      >
        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
        {lang === "ar" ? "اكتشف" : lang === "fr" ? "Découvrir" : "Explore"}
      </a>
    </div>
  );
}

/* ─── Stats strip ────────────────────────────────────────────────────── */
const STATS: Record<CountryKey, { en: string; ar: string; fr: string; n: string }[]> = {
  ae: [
    { n: "17M+", en: "Visitors / year", ar: "زائر / سنة", fr: "Visiteurs / an" },
    { n: "130+", en: "Nationalities", ar: "جنسية", fr: "Nationalités" },
    { n: "#1",   en: "MICE destination", ar: "وجهة MICE", fr: "Destination MICE" },
    { n: "365",  en: "Days sunshine",   ar: "يوم شمس", fr: "Jours de soleil" },
  ],
  sa: [
    { n: "100M", en: "Target visitors 2030", ar: "زائر مستهدف 2030", fr: "Visiteurs cibles 2030" },
    { n: "12",   en: "UNESCO sites",        ar: "موقع يونسكو", fr: "Sites UNESCO" },
    { n: "2030", en: "Vision year",         ar: "سنة الرؤية", fr: "Année Vision" },
    { n: "3M km²",en: "Land area",          ar: "كلم² مساحة", fr: "km² superficie" },
  ],
  ma: [
    { n: "13M+", en: "Tourists / year", ar: "سائح / سنة", fr: "Touristes / an" },
    { n: "9",    en: "UNESCO sites",    ar: "موقع يونسكو", fr: "Sites UNESCO" },
    { n: "4",    en: "Climate zones",   ar: "مناخ مختلف", fr: "Zones climatiques" },
    { n: "3,500km",en: "Coastline",    ar: "كيلومتر ساحل", fr: "Km de côtes" },
  ],
};

/* ─── Main screen ────────────────────────────────────────────────────── */
export function ScreenTourisme() {
  const { lang } = useLang();
  const bp    = useBreakpoint();
  const isMob = bp === "mobile";
  const isTab = bp === "tablet";

  const [country, setCountry] = useState<CountryKey>("ae");
  const [cat,     setCat]     = useState<CatKey | "all">("all");

  const countryMeta = COUNTRIES.find(c => c.key === country)!;
  const services    = SERVICES[country];
  const filtered    = cat === "all" ? services : services.filter(s => s.cat === cat);
  const stats       = STATS[country];

  const tagline = lang === "ar" ? countryMeta.tagline_ar : lang === "fr" ? countryMeta.tagline_fr : countryMeta.tagline_en;
  const catLabel = (c: typeof CATS[0]) => lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en;
  const cols = isMob ? "1fr" : isTab ? "repeat(2, 1fr)" : "repeat(3, 1fr)";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar
        title={lang === "ar" ? "السياحة" : lang === "fr" ? "Tourisme" : "Tourism"}
        crumb={isMob ? [] : [
          countryMeta.flag + " " + (lang === "ar" ? countryMeta.ar : lang === "fr" ? countryMeta.fr : countryMeta.en),
          `${filtered.length} ${lang === "fr" ? "ressources" : lang === "ar" ? "مورد" : "resources"}`,
        ]}
      />

      <main style={{ flex: 1, padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 18, background: "var(--bg-cream)", overflow: "auto" }}>

        {/* Hero */}
        <div className="sgi-card-elevated" style={{
          padding: isMob ? 18 : 28,
          background: countryMeta.gradient,
          color: "var(--bg-ivory)", border: "none",
          position: "relative", overflow: "hidden",
        }}>
          <div style={{ position: "absolute", insetInlineEnd: isMob ? -20 : 0, top: -10, fontSize: isMob ? 100 : 140, opacity: 0.2, lineHeight: 1 }}>
            {countryMeta.flag}
          </div>
          <Eyebrow style={{ color: "var(--gold)" }}>
            {lang === "ar" ? "دليل السياحة الرسمي" : lang === "fr" ? "Guide officiel du tourisme" : "Official tourism guide"}
          </Eyebrow>
          <div className="font-display" style={{ fontSize: isMob ? 22 : 34, marginTop: 8, lineHeight: 1.2 }}>
            {tagline}
          </div>

          {/* Stats */}
          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: isMob ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: 10 }}>
            {stats.map((s, i) => (
              <div key={i} style={{ padding: isMob ? "8px 10px" : "12px 14px", background: "rgba(255,255,255,0.08)", borderInlineStart: "2px solid var(--gold)", borderRadius: 4 }}>
                <div className="font-display tnum" style={{ fontSize: isMob ? 18 : 24, color: "var(--gold)" }}>{s.n}</div>
                <div style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)", marginTop: 2 }}>
                  {lang === "ar" ? s.ar : lang === "fr" ? s.fr : s.en}
                </div>
              </div>
            ))}
          </div>

          {/* Country selector */}
          <div style={{ marginTop: 20, display: "flex", gap: 8, flexWrap: "wrap" }}>
            {COUNTRIES.map(c => (
              <button
                key={c.key}
                onClick={() => { setCountry(c.key); setCat("all"); }}
                style={{
                  padding: isMob ? "7px 12px" : "9px 16px",
                  borderRadius: "var(--r)", cursor: "pointer", fontSize: 13, fontWeight: 600,
                  display: "flex", alignItems: "center", gap: 8,
                  background: c.key === country ? "var(--gold)" : "rgba(255,255,255,0.10)",
                  color: c.key === country ? "var(--ink)" : "var(--bg-ivory)",
                  border: c.key === country ? "1px solid var(--gold)" : "1px solid rgba(255,255,255,0.18)",
                  transition: "all 0.18s",
                }}
              >
                <span style={{ fontSize: 18 }}>{c.flag}</span>
                <span>{lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Category filter */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{ key: "all" as const, en: "All", ar: "الكل", fr: "Tous", color: "var(--ink-3)" }, ...CATS].map(c => {
            const isActive = cat === c.key;
            const color = "color" in c ? c.color : "var(--ink-3)";
            const label = lang === "ar" ? c.ar : lang === "fr" ? c.fr : c.en;
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key as CatKey | "all")}
                style={{
                  padding: "6px 14px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 500,
                  display: "flex", alignItems: "center", gap: 6,
                  background: isActive ? color : "var(--bg-paper)",
                  color: isActive ? "#fff" : "var(--ink-3)",
                  border: `1px solid ${isActive ? color : "var(--line-soft)"}`,
                  transition: "all 0.15s",
                }}
              >
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
                    <div className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: 16, fontWeight: 600 }}>
                      {catLabel(catItem)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{items.length} {lang === "fr" ? "ressources" : lang === "ar" ? "مورد" : "resources"}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>
                  {items.map((s, i) => <TourCard key={i} s={s} lang={lang} isMob={isMob} />)}
                </div>
              </section>
            );
          })
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12 }}>
            {filtered.map((s, i) => <TourCard key={i} s={s} lang={lang} isMob={isMob} />)}
          </div>
        )}

      </main>
    </div>
  );
}
