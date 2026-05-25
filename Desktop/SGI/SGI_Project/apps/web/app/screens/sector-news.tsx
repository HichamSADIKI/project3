"use client";

import React, { useState, useMemo } from "react";
import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import type { Sector } from "./sector-crm";

/* ─── Local icons ─────────────────────────────────────────────────────────── */
function IcX()      { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>; }
function IcSearch() { return <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>; }
function IcCalendar() { return <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>; }
function IcExternalLink() { return <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>; }

/* ─── Types ───────────────────────────────────────────────────────────────── */
interface NewsArticle {
  id: string;
  date: string;
  source: string;
  tag: string;
  title_en: string; title_ar: string; title_fr: string;
  summary_en: string; summary_ar: string; summary_fr: string;
  body_en: string; body_ar: string; body_fr: string;
}

/* ─── News data per sector ────────────────────────────────────────────────── */
const NEWS: Record<Sector, NewsArticle[]> = {
  realestate: [
    {
      id: "re1", date: "2026-05-24", source: "Gulf Business", tag: "Market",
      title_en: "Dubai Property Prices Rise 14% in Q1 2026",
      title_ar: "أسعار العقارات في دبي ترتفع 14٪ في الربع الأول 2026",
      title_fr: "Les prix de l'immobilier à Dubaï augmentent de 14% au T1 2026",
      summary_en: "The Dubai property market continues its strong momentum with residential prices climbing 14% year-over-year, driven by high demand in Palm Jumeirah and Downtown areas.",
      summary_ar: "يواصل سوق العقارات في دبي زخمه القوي مع ارتفاع أسعار المساكن بنسبة 14٪ على أساس سنوي، مدفوعاً بالطلب المرتفع في نخلة جميرا ووسط المدينة.",
      summary_fr: "Le marché immobilier de Dubaï poursuit son élan avec des prix résidentiels en hausse de 14% sur un an, portés par une forte demande à Palm Jumeirah et Downtown.",
      body_en: "Dubai's real estate sector recorded its strongest Q1 performance in a decade, with transaction volumes reaching AED 120 billion across residential and commercial segments. Palm Jumeirah villas led gains with a 22% price appreciation, while Business Bay office space tightened to sub-5% vacancy rates. Analysts point to strong inflows from European and South Asian investors as primary drivers. The Golden Visa program continues to boost long-term demand, with eligible property purchases exceeding AED 2M accounting for 38% of all Q1 transactions. Looking ahead, off-plan launches in Dubailand and Al Furjan are expected to introduce 12,000 new units by year-end, which may moderate price growth in mid-tier segments while luxury supply remains constrained.",
      body_ar: "سجّل قطاع العقارات في دبي أقوى أداء له في الربع الأول خلال عقد، إذ بلغت أحجام المعاملات 120 مليار درهم في القطاعين السكني والتجاري. تصدّرت فلل نخلة جميرا الارتفاعات بنسبة 22٪، فيما انخفض معدل شواغر مكاتب الخليج التجاري إلى ما دون 5٪. يُشير المحللون إلى التدفقات القوية من المستثمرين الأوروبيين وجنوب آسيا بوصفها المحرّكات الرئيسية. يواصل برنامج التأشيرة الذهبية دعم الطلب طويل الأمد، إذ شكّلت عمليات الشراء المؤهّلة التي تتجاوز 2 مليون درهم 38٪ من جميع معاملات الربع الأول.",
      body_fr: "Le secteur immobilier de Dubaï a enregistré sa meilleure performance du T1 depuis une décennie, avec des volumes de transactions atteignant 120 milliards AED. Les villas de Palm Jumeirah ont mené les hausses avec +22%, tandis que les bureaux de Business Bay affichent un taux de vacance inférieur à 5%. Les analystes soulignent les flux importants d'investisseurs européens et sud-asiatiques. Le programme Golden Visa continue de soutenir la demande à long terme, les achats éligibles (>2M AED) représentant 38% des transactions du T1.",
    },
    {
      id: "re2", date: "2026-05-20", source: "Arabian Business", tag: "Golden Visa",
      title_en: "Golden Visa Applications Surge 40% After New 2M AED Threshold Rules",
      title_ar: "طلبات التأشيرة الذهبية ترتفع 40٪ بعد قواعد عتبة الـ 2 مليون درهم الجديدة",
      title_fr: "Les demandes de Golden Visa bondissent de 40% après les nouvelles règles du seuil 2M AED",
      summary_en: "Updated GDRFA regulations clarifying the 2 million AED property threshold have triggered a surge in Golden Visa applications from European and Asian investors.",
      summary_ar: "أدى توضيح لوائح الهيئة العامة للإقامة وشؤون الأجانب بشأن عتبة الـ 2 مليون درهم إلى ارتفاع حاد في طلبات التأشيرة الذهبية من المستثمرين الأوروبيين والآسيويين.",
      summary_fr: "La clarification des règlements GDRFA sur le seuil de 2M AED a déclenché une hausse des demandes de Golden Visa de la part d'investisseurs européens et asiatiques.",
      body_en: "The General Directorate of Residency and Foreigners Affairs (GDRFA) published updated guidelines in April 2026 clarifying that mortgaged properties with a minimum equity of AED 2 million qualify for the Golden Visa program. This clarification, long awaited by brokers and developers, has removed a key ambiguity that was deterring foreign buyers. The result has been a 40% spike in Golden Visa applications in the first six weeks since the announcement. Infinity International reports that its Golden Visa service requests have more than doubled, with French, Italian, and Indian nationals leading the surge. Processing times have been reduced to 15 working days for complete applications.",
      body_ar: "نشرت الهيئة العامة للإقامة وشؤون الأجانب إرشادات محدّثة في أبريل 2026 توضّح أن العقارات المرهونة التي تبلغ حقوق الملكية فيها 2 مليون درهم على الأقل مؤهّلة للتأشيرة الذهبية. وقد أسفر هذا الوضوح عن ارتفاع بنسبة 40٪ في الطلبات خلال الأسابيع الستة الأولى. تُفيد إنفينيتي إنترناشيونال بأن طلبات خدمة التأشيرة الذهبية لديها تضاعفت، مع تصدّر الرعايا الفرنسيين والإيطاليين والهنود قائمة المتقدمين.",
      body_fr: "La GDRFA a publié des directives actualisées en avril 2026 précisant que les propriétés hypothéquées avec une valeur nette minimale de 2M AED sont éligibles au Golden Visa. Cette clarification a provoqué une hausse de 40% des demandes en six semaines. Infinity International rapporte que ses demandes de service Golden Visa ont plus que doublé, les ressortissants français, italiens et indiens menant la progression.",
    },
    {
      id: "re3", date: "2026-05-15", source: "Zawya", tag: "Rental",
      title_en: "Dubai Short-Term Rental Yields Reach 9.2% Average in 2026",
      title_ar: "عوائد الإيجارات قصيرة الأمد في دبي تصل إلى 9.2٪ في 2026",
      title_fr: "Les rendements locatifs courts termes à Dubaï atteignent 9,2% en 2026",
      summary_en: "Short-term rental platforms report record yields as Dubai's tourism sector surpasses 24 million visitor arrivals in 2025, making buy-to-let investments increasingly attractive.",
      summary_ar: "تُسجّل منصات الإيجار قصير الأمد عوائد قياسية مع تجاوز قطاع السياحة في دبي 24 مليون زيارة في 2025.",
      summary_fr: "Les plateformes de location courte durée rapportent des rendements records avec le secteur touristique de Dubaï dépassant 24 millions de visiteurs en 2025.",
      body_en: "Dubai's short-term rental market has emerged as one of the highest-yielding residential asset classes globally, with average gross yields of 9.2% in 2026 compared to the long-term rental average of 6.1%. Areas near Expo City Dubai, DIFC, and Marina continue to outperform, with some properties achieving 11–13% gross yields. However, investors are cautioned to account for DTCM licensing fees, management costs (typically 20–25% of revenue), and increasing competition from new supply. Infinity International's rental management division manages over 340 short-term units across key Dubai micro-markets, providing end-to-end service from licensing to guest management.",
      body_ar: "برزت سوق الإيجارات قصيرة الأمد في دبي بوصفها واحدة من أعلى الفئات العقارية عائداً على المستوى العالمي، بمتوسط عائد إجمالي 9.2٪ في 2026. تتصدر مناطق إكسبو سيتي دبي وDIFC والمارينا الأداء، مع تحقيق بعض العقارات عوائد 11-13٪. تدير قسم إدارة الإيجارات في إنفينيتي إنترناشيونال أكثر من 340 وحدة قصيرة الأمد.",
      body_fr: "Le marché de la location courte durée à Dubaï s'est imposé comme l'une des classes d'actifs résidentiels les plus rentables au monde, avec des rendements bruts moyens de 9,2% en 2026. Les zones proches d'Expo City Dubai, du DIFC et de la Marina surperforment. La division de gestion locative d'Infinity International gère plus de 340 unités courte durée à travers les micro-marchés clés de Dubaï.",
    },
    {
      id: "re4", date: "2026-05-10", source: "The National", tag: "Investment",
      title_en: "Abu Dhabi Yas Island Launches AED 3.8B Residential Mega-Project",
      title_ar: "جزيرة ياس في أبوظبي تطلق مشروعاً سكنياً ضخماً بقيمة 3.8 مليار درهم",
      title_fr: "Yas Island Abu Dhabi lance un méga-projet résidentiel de 3,8 milliards AED",
      summary_en: "Aldar Properties announces a landmark 3.8 billion AED mixed-use development on Yas Island, featuring 4,200 units across waterfront towers and villas.",
      summary_ar: "تُعلن شركة الدار العقارية عن مشروع متعدد الاستخدامات بقيمة 3.8 مليار درهم في جزيرة ياس، يضم 4,200 وحدة في أبراج وفلل على الواجهة المائية.",
      summary_fr: "Aldar Properties annonce un développement mixte de 3,8 milliards AED sur Yas Island, avec 4 200 unités dans des tours et villas en bord de mer.",
      body_en: "Aldar Properties has unveiled Yas Shores, a 3.8 billion AED master-planned community on Yas Island featuring 4,200 residential units ranging from studios to six-bedroom villas. The project, expected to complete between 2028 and 2030, targets both end-users and investors, with a 40/60 payment plan available. Units start at AED 950,000 for a one-bedroom apartment and reach AED 18 million for a six-bedroom waterfront villa. Abu Dhabi's property market has historically offered more stable yields compared to Dubai, with lower transaction volatility and a strong rental base from government and oil-sector employees.",
      body_ar: "كشفت الدار العقارية عن ياس شورز، مجتمع مخطط رئيسي بقيمة 3.8 مليار درهم في جزيرة ياس، يضم 4,200 وحدة سكنية. يستهدف المشروع المستخدمين النهائيين والمستثمرين بخطة دفع 40/60. تبدأ الأسعار من 950,000 درهم لشقة غرفة نوم واحدة وتصل إلى 18 مليون درهم للفيلا.",
      body_fr: "Aldar Properties a dévoilé Yas Shores, une communauté de 3,8 milliards AED sur Yas Island avec 4 200 unités résidentielles. Le projet, attendu entre 2028 et 2030, cible les utilisateurs finaux et les investisseurs avec un plan de paiement 40/60. Les prix démarrent à 950 000 AED pour un appartement 1 chambre.",
    },
    {
      id: "re5", date: "2026-05-05", source: "Property Monitor", tag: "Off-Plan",
      title_en: "Off-Plan Sales Break Record with AED 45B Transacted in April 2026",
      title_ar: "مبيعات العقارات على الخارطة تكسر الأرقام القياسية بـ 45 مليار درهم في أبريل 2026",
      title_fr: "Les ventes sur plan battent des records avec 45 milliards AED échangés en avril 2026",
      summary_en: "April 2026 became the highest-ever month for off-plan transactions in UAE history, driven by 23 new project launches across Dubai and Ras Al Khaimah.",
      summary_ar: "أصبح أبريل 2026 أعلى شهر على الإطلاق لمعاملات العقارات على الخارطة في تاريخ الإمارات، مدفوعاً بإطلاق 23 مشروعاً جديداً عبر دبي ورأس الخيمة.",
      summary_fr: "Avril 2026 est devenu le mois record pour les transactions sur plan dans l'histoire des EAU, avec 23 nouveaux lancements à Dubaï et Ras Al Khaïmah.",
      body_en: "Off-plan transactions in the UAE reached AED 45 billion in April 2026, surpassing the previous record of AED 39 billion set in December 2025. Twenty-three projects launched simultaneously across Dubai Marina, JVC, Arjan, and the emerging market of Ras Al Khaimah. Developers are increasingly offering 1% monthly payment plans post-handover, reducing entry barriers for first-time buyers. However, market watchers note that the rapid pace of launches — now averaging 8 new projects per week in Dubai alone — raises questions about medium-term supply absorption, particularly in the AED 1–3 million segment which has seen the most launches.",
      body_ar: "بلغت معاملات العقارات على الخارطة في الإمارات 45 مليار درهم في أبريل 2026، متجاوزةً الرقم القياسي السابق البالغ 39 مليار درهم في ديسمبر 2025. أُطلق 23 مشروعاً في آنٍ واحد عبر مارينا دبي وJVC وعجان ورأس الخيمة. يقدّم المطورون بشكل متزايد خطط دفع بنسبة 1٪ شهرياً بعد التسليم.",
      body_fr: "Les transactions sur plan aux EAU ont atteint 45 milliards AED en avril 2026, dépassant le record précédent de 39 milliards. Vingt-trois projets ont été lancés simultanément. Les développeurs proposent de plus en plus des plans de paiement à 1% mensuel après livraison, réduisant les barrières à l'entrée pour les primo-accédants.",
    },
    {
      id: "re6", date: "2026-04-28", source: "Bloomberg Middle East", tag: "Analysis",
      title_en: "Foreign Direct Investment in UAE Real Estate Tops USD 18B in 2025",
      title_ar: "الاستثمار الأجنبي المباشر في العقارات الإماراتية يتجاوز 18 مليار دولار في 2025",
      title_fr: "L'investissement direct étranger dans l'immobilier des EAU dépasse 18 milliards USD en 2025",
      summary_en: "UAE real estate attracted record foreign investment in 2025, with Russian, French, and Indian investors accounting for over 60% of cross-border capital flows.",
      summary_ar: "استقطبت العقارات الإماراتية استثمارات أجنبية قياسية في 2025، مع استحواذ المستثمرين الروس والفرنسيين والهنود على أكثر من 60٪ من تدفقات رأس المال عبر الحدود.",
      summary_fr: "L'immobilier des EAU a attiré des investissements étrangers records en 2025, les investisseurs russes, français et indiens représentant plus de 60% des flux de capitaux transfrontaliers.",
      body_en: "Foreign direct investment in UAE real estate totalled USD 18.3 billion in 2025, a 28% increase from 2024, according to data from the UAE Ministry of Economy and CBRE. Russian nationals remained the largest foreign buyer group for the third consecutive year, followed by French, Indian, Pakistani, and British nationals. The UAE's lack of capital gains tax, combined with the Golden Visa incentive and ease of remittance, continues to position the market as a preferred destination for wealth preservation. Infinity International's multilingual service — available in Arabic, French, and English — has positioned it as a preferred partner for French-speaking investors from France, Belgium, Switzerland, and North Africa.",
      body_ar: "بلغ الاستثمار الأجنبي المباشر في العقارات الإماراتية 18.3 مليار دولار في 2025، بزيادة 28٪ عن 2024. ظل الرعايا الروس أكبر مجموعة مشترين أجانب للسنة الثالثة على التوالي، تليهم الفرنسيون والهنود والباكستانيون والبريطانيون.",
      body_fr: "L'investissement direct étranger dans l'immobilier des EAU a totalisé 18,3 milliards USD en 2025, soit une hausse de 28% par rapport à 2024. Les ressortissants russes sont restés le plus grand groupe d'acheteurs étrangers pour la troisième année consécutive, suivis des Français, Indiens, Pakistanais et Britanniques.",
    },
  ],

  tourisme: [
    {
      id: "to1", date: "2026-05-22", source: "Dubai Tourism", tag: "Arrivals",
      title_en: "Dubai Welcomes 26 Million Tourists in 2025, Eyes 30M by 2028",
      title_ar: "دبي تستقبل 26 مليون سائح في 2025 وتستهدف 30 مليون بحلول 2028",
      title_fr: "Dubaï accueille 26 millions de touristes en 2025 et vise 30M d'ici 2028",
      summary_en: "Dubai's Department of Economy and Tourism reports record arrivals for 2025, with European and CIS markets driving the majority of growth ahead of Expo 2025 legacy events.",
      summary_ar: "تُسجّل دائرة الاقتصاد والسياحة في دبي أرقاماً قياسية لعام 2025، مع قيادة الأسواق الأوروبية ودول رابطة الدول المستقلة لمعظم النمو.",
      summary_fr: "Le Département de l'Économie et du Tourisme de Dubaï rapporte des arrivées records pour 2025, les marchés européens et CEI menant la croissance.",
      body_en: "Dubai welcomed 26.1 million international overnight visitors in 2025, cementing its position as the world's fourth most-visited city. Average hotel occupancy across Dubai's 140,000-plus rooms reached 82%, the highest since 2019. European tourists grew 31% year-over-year, led by France (+38%), Germany (+27%), and the UK (+22%). The city's diversified attraction portfolio — from cultural sites to adventure tourism, wellness, and MICE events — continues to attract varied traveler profiles. For Infinity International's tourism division, the strong arrival numbers translate directly into demand for VIP transfer services, luxury hotel packages, and curated excursion programs.",
      body_ar: "استقبلت دبي 26.1 مليون زائر دولي في 2025. بلغ متوسط إشغال الفنادق 82٪، وهو الأعلى منذ 2019. نما السياح الأوروبيون 31٪ على أساس سنوي، بقيادة فرنسا (+38٪) وألمانيا (+27٪) والمملكة المتحدة (+22٪).",
      body_fr: "Dubaï a accueilli 26,1 millions de visiteurs internationaux en 2025. L'occupation hôtelière moyenne a atteint 82%, le niveau le plus élevé depuis 2019. Les touristes européens ont augmenté de 31%, menés par la France (+38%), l'Allemagne (+27%) et le Royaume-Uni (+22%).",
    },
    {
      id: "to2", date: "2026-05-18", source: "Travel+Leisure", tag: "Luxury",
      title_en: "UAE Named Top Destination for Ultra-High-Net-Worth Travelers in 2026",
      title_ar: "الإمارات تُسمَّى وجهة رئيسية للمسافرين من فئة الثروات العالية جداً في 2026",
      title_fr: "Les EAU nommés destination principale pour les voyageurs UHNW en 2026",
      summary_en: "Wealth intelligence firm AltFinance ranks UAE top globally for ultra-luxury travel demand, citing yacht charters, private aviation, and bespoke desert experiences as key draws.",
      summary_ar: "تُصنّف شركة AltFinance الإمارات في المرتبة الأولى عالمياً في الطلب على السفر الفائق الفخامة، مستشهدةً باستئجار اليخوت والطيران الخاص وتجارب الصحراء المخصصة.",
      summary_fr: "La firme AltFinance classe les EAU au premier rang mondial pour la demande de voyages ultra-luxe, citant les charters de yachts, l'aviation privée et les expériences désertiques sur mesure.",
      body_en: "The UAE has claimed the top spot in AltFinance's 2026 Global Ultra-Luxury Travel Index for the second consecutive year, driven by a 45% surge in private jet arrivals and record demand for superyacht charters in Dubai Marina and Abu Dhabi. The average UHNW visitor spends USD 28,000 per trip, up 18% from 2024. Key activities requested include desert glamping, private Burj Khalifa access, Pearl Diving Heritage experiences, and exclusive access to UAE Formula E tracks. Infinity International's VIP concierge division has expanded its yacht charter fleet to 28 vessels and now offers helicopter transfers between Dubai and Abu Dhabi for high-profile clients.",
      body_ar: "حصلت الإمارات على المرتبة الأولى في مؤشر AltFinance العالمي للسفر الفائق الفخامة للسنة الثانية على التوالي. يُنفق الزائر من فئة الثروات العالية جداً 28,000 دولار في المتوسط للرحلة الواحدة. وسّعت إنفينيتي إنترناشيونال أسطول استئجار اليخوت إلى 28 سفينة.",
      body_fr: "Les EAU ont décroché la première place dans l'index AltFinance pour la deuxième année consécutive. Le visiteur UHNW moyen dépense 28 000 USD par séjour, en hausse de 18% par rapport à 2024. La division VIP d'Infinity International a étendu sa flotte de yachts à 28 navires.",
    },
    {
      id: "to3", date: "2026-05-12", source: "Arabian Travel Market", tag: "MICE",
      title_en: "UAE MICE Sector Generates AED 9.4B in 2025, Growth Accelerates",
      title_ar: "قطاع الفعاليات والمعارض في الإمارات يُدرّ 9.4 مليار درهم في 2025",
      title_fr: "Le secteur MICE des EAU génère 9,4 milliards AED en 2025",
      summary_en: "Meetings, Incentives, Conferences, and Exhibitions in UAE generate record AED 9.4B with Dubai Convention Centre hosting 1,200+ events attended by 2.3 million delegates.",
      summary_ar: "يُسجّل قطاع الاجتماعات والحوافز والمؤتمرات والمعارض في الإمارات 9.4 مليار درهم، مع استضافة مركز دبي للمؤتمرات أكثر من 1,200 فعالية.",
      summary_fr: "Les Meetings, Incentives, Conferences et Exhibitions aux EAU génèrent un record de 9,4 milliards AED avec plus de 1 200 événements et 2,3 millions de délégués.",
      body_en: "The UAE's MICE (Meetings, Incentives, Conferences, Exhibitions) sector delivered its strongest year on record in 2025, generating AED 9.4 billion in direct economic contribution. The Dubai Convention and Exhibition Centre hosted 1,247 events, welcoming 2.3 million delegates from 142 countries. GITEX Technology Week remained the flagship event, attracting 200,000 attendees and 6,500 exhibiting companies. Arabian Travel Market 2026 saw record participation with 45,000 visitors. For tourism service providers like Infinity International, MICE demand creates high-value group bookings for transfers, accommodation, and tailored cultural experiences for international delegations.",
      body_ar: "حقّق قطاع الفعاليات والمعارض في الإمارات أقوى أداء على الإطلاق في 2025 بمساهمة اقتصادية مباشرة بلغت 9.4 مليار درهم. استضاف مركز دبي للمؤتمرات 1,247 فعالية استقبلت 2.3 مليون مندوب من 142 دولة.",
      body_fr: "Le secteur MICE des EAU a livré sa meilleure année en 2025, générant 9,4 milliards AED. Le Dubai Convention Centre a accueilli 1 247 événements avec 2,3 millions de délégués de 142 pays. Pour Infinity International, la demande MICE crée des réservations de groupe à haute valeur.",
    },
    {
      id: "to4", date: "2026-05-06", source: "Gulf News", tag: "Visa",
      title_en: "UAE Extends Tourist Visa-on-Arrival to 12 New Countries",
      title_ar: "الإمارات تمدّد التأشيرة عند الوصول إلى 12 دولة جديدة",
      title_fr: "Les EAU étendent le visa à l'arrivée à 12 nouveaux pays",
      summary_en: "UAE expands its visa-on-arrival program to include 12 additional nations, reducing travel friction for key emerging markets including Brazil, Kazakhstan, and South Korea.",
      summary_ar: "تُوسّع الإمارات برنامج التأشيرة عند الوصول ليشمل 12 دولة إضافية، مما يُقلّل من صعوبات السفر للأسواق الناشئة الرئيسية.",
      summary_fr: "Les EAU élargissent leur programme de visa à l'arrivée à 12 nations supplémentaires, réduisant les obstacles pour des marchés émergents clés.",
      body_en: "The UAE Federal Authority for Identity, Citizenship, Customs and Port Security has extended visa-on-arrival privileges to 12 new countries, bringing the total to 125 nationalities who can enter without prior visa arrangements. The new additions include Brazil, Kazakhstan, South Korea, Peru, Thailand (extension to 90 days), and seven additional African nations. The move is expected to add approximately 800,000 additional tourist arrivals per year and aligns with the UAE Tourism Strategy 2031 target of 40 million annual visitors. Infinity International's visa assistance services continue to serve clients from non-eligible countries requiring advance visa coordination.",
      body_ar: "مدّدت هيئة الهوية والجنسية والجمارك وأمن المنافذ الإماراتية امتيازات التأشيرة عند الوصول إلى 12 دولة جديدة، ليبلغ إجمالي الجنسيات المؤهلة 125 جنسية. تشمل الإضافات الجديدة البرازيل وكازاخستان وكوريا الجنوبية والبيرو وتايلاند.",
      body_fr: "L'Autorité fédérale des EAU a étendu les privilèges de visa à l'arrivée à 12 nouveaux pays, portant le total à 125 nationalités. Les nouveaux pays incluent le Brésil, le Kazakhstan, la Corée du Sud, le Pérou et la Thaïlande (extension à 90 jours).",
    },
    {
      id: "to5", date: "2026-04-30", source: "Hotels.com Insight", tag: "Hotels",
      title_en: "Dubai Hotel RevPAR Hits All-Time High of AED 1,050 in March 2026",
      title_ar: "معدل الإيراد لكل غرفة متاحة في فنادق دبي يبلغ أعلى مستوياته التاريخية",
      title_fr: "Le RevPAR des hôtels de Dubaï atteint un sommet historique en mars 2026",
      summary_en: "Dubai hotels achieve record Revenue Per Available Room of AED 1,050 in March driven by ultra-high-season demand during Ramadan and post-Ramadan leisure travel.",
      summary_ar: "تُحقّق فنادق دبي رقماً قياسياً للإيراد لكل غرفة متاحة بلغ 1,050 درهم في مارس مدفوعاً بالطلب الموسمي الاستثنائي.",
      summary_fr: "Les hôtels de Dubaï atteignent un RevPAR record de 1 050 AED en mars, porté par une demande exceptionnelle durant le Ramadan et le tourisme post-Ramadan.",
      body_en: "Dubai's hotel sector reached a new revenue milestone in March 2026, with Revenue Per Available Room (RevPAR) averaging AED 1,050 — a 19% increase over March 2025. The Ramadan period, coinciding this year with spring school holidays in Europe, created exceptional demand convergence. Five-star hotels in DIFC, Palm Jumeirah, and Downtown Dubai reported average daily rates exceeding AED 3,500. Budget and mid-scale properties in Deira and Bur Dubai also benefited from overflow demand, with RevPAR rising 12% in those areas. The strong performance is prompting several international hotel groups to accelerate UAE pipeline projects, with over 8,000 new rooms expected to open across Dubai and Abu Dhabi by end-2026.",
      body_ar: "بلغ قطاع الفنادق في دبي إيراداً قياسياً جديداً في مارس 2026، مع متوسط RevPAR بلغ 1,050 درهم، بزيادة 19٪ عن مارس 2025. أعلنت فنادق الخمس نجوم في DIFC ونخلة جميرا ووسط المدينة عن معدلات يومية متوسطة تتجاوز 3,500 درهم.",
      body_fr: "L'hôtellerie de Dubaï a atteint un nouveau record en mars 2026, avec un RevPAR moyen de 1 050 AED, soit +19% par rapport à mars 2025. Les hôtels cinq étoiles du DIFC, de Palm Jumeirah et du Downtown ont rapporté des tarifs journaliers moyens dépassant 3 500 AED.",
    },
  ],

  sante: [
    {
      id: "sa1", date: "2026-05-23", source: "UAE Ministry of Health", tag: "Policy",
      title_en: "UAE Launches National Digital Health ID for All Residents",
      title_ar: "الإمارات تُطلق هوية الصحة الرقمية الوطنية لجميع المقيمين",
      title_fr: "Les EAU lancent l'identité de santé numérique nationale pour tous les résidents",
      summary_en: "The Ministry of Health and Prevention launches a unified digital health record system giving all UAE residents a portable health profile accessible across public and private facilities.",
      summary_ar: "تُطلق وزارة الصحة والوقاية نظاماً موحداً للسجلات الصحية الرقمية يمنح جميع المقيمين ملفاً صحياً متنقلاً.",
      summary_fr: "Le Ministère de la Santé lance un système unifié de dossiers de santé numériques offrant à tous les résidents un profil de santé portable.",
      body_en: "The UAE Ministry of Health and Prevention has launched the UAE Health ID, a unified digital health record system that consolidates medical history, prescriptions, lab results, and imaging data from all registered health facilities. All UAE residents are automatically enrolled using their Emirates ID, with privacy controls allowing selective sharing with providers. The system integrates with over 1,200 public and private hospitals and clinics, and is accessible via the UAE Pass app. Health tourists visiting the UAE can also enroll voluntarily, allowing treating physicians to access complete medical histories. Infinity International's health services division assists clients in enrolling and navigating the new system for premium health check-up services.",
      body_ar: "أطلقت وزارة الصحة والوقاية هوية الصحة الإماراتية، نظام موحد للسجلات الصحية الرقمية يُوحّد التاريخ الطبي والوصفات والمختبرات والتصوير من جميع المرافق الصحية المسجلة. يُسجَّل تلقائياً جميع المقيمين في الإمارات باستخدام بطاقة الهوية.",
      body_fr: "Le Ministère de la Santé des EAU a lancé l'UAE Health ID, un système unifié de dossiers de santé numériques consolidant l'historique médical, les ordonnances et les résultats de laboratoire. Tous les résidents sont automatiquement inscrits via leur Emirates ID. Le système s'intègre à plus de 1 200 établissements de santé.",
    },
    {
      id: "sa2", date: "2026-05-17", source: "Arab Health", tag: "MedTech",
      title_en: "AI Diagnostics Adoption Accelerates Across UAE Private Hospitals",
      title_ar: "تسريع اعتماد تشخيصات الذكاء الاصطناعي في المستشفيات الخاصة بالإمارات",
      title_fr: "L'adoption des diagnostics IA s'accélère dans les hôpitaux privés des EAU",
      summary_en: "Leading UAE hospital groups Cleveland Clinic Abu Dhabi and American Hospital Dubai report 35% improvement in diagnostic accuracy after deploying AI imaging platforms.",
      summary_ar: "تُسجّل مجموعات مستشفيات إماراتية رائدة تحسناً بنسبة 35٪ في دقة التشخيص بعد نشر منصات تصوير الذكاء الاصطناعي.",
      summary_fr: "Les groupes hospitaliers Cleveland Clinic Abu Dhabi et American Hospital Dubai rapportent 35% d'amélioration en précision diagnostique après déploiement de plateformes d'imagerie IA.",
      body_en: "Cleveland Clinic Abu Dhabi and American Hospital Dubai have published joint outcomes data showing a 35% improvement in early cancer detection accuracy and a 28% reduction in diagnostic time following the deployment of AI-powered imaging analysis platforms. The systems, supplied by Siemens Healthineers and Aidoc, analyze CT, MRI, and X-ray results in real time, flagging critical findings within minutes rather than hours. UAE regulators have fast-tracked approvals for 14 additional AI diagnostic tools across radiology, pathology, and cardiology specialties. Infinity International's premium health check-up packages now include AI-enhanced cancer screening as a standard component for VIP clients.",
      body_ar: "نشرت كليفلاند كلينيك أبوظبي والمستشفى الأمريكي دبي بيانات مشتركة تُظهر تحسناً بنسبة 35٪ في الكشف المبكر عن السرطان وتقليصاً بنسبة 28٪ في وقت التشخيص بعد نشر منصات التحليل بالذكاء الاصطناعي.",
      body_fr: "Cleveland Clinic Abu Dhabi et American Hospital Dubai ont publié des données communes montrant 35% d'amélioration dans la détection précoce du cancer et 28% de réduction du temps diagnostique grâce aux plateformes d'imagerie IA.",
    },
    {
      id: "sa3", date: "2026-05-09", source: "Health Monitor", tag: "Insurance",
      title_en: "DHA Mandates Enhanced Health Insurance Coverage from January 2027",
      title_ar: "هيئة الصحة بدبي تُلزم بتغطية تأمين صحي محسّنة من يناير 2027",
      title_fr: "La DHA exige une couverture d'assurance santé améliorée à partir de janvier 2027",
      summary_en: "Dubai Health Authority announces mandatory upgrade to all employer-sponsored health plans, increasing coverage limits and adding mental health and dental as required benefits.",
      summary_ar: "تُعلن هيئة الصحة بدبي عن ترقية إلزامية لجميع خطط الصحة التي يرعاها صاحب العمل مع زيادة حدود التغطية وإضافة الصحة النفسية والأسنان.",
      summary_fr: "La Dubai Health Authority annonce une mise à niveau obligatoire de tous les plans de santé sponsorisés par les employeurs, augmentant les plafonds et ajoutant la santé mentale et les soins dentaires.",
      body_en: "The Dubai Health Authority (DHA) has issued new mandatory health insurance standards effective January 2027, requiring all employer-sponsored health plans to increase annual benefit limits from AED 150,000 to AED 300,000, and to include mental health counseling (minimum 12 sessions per year) and basic dental care (preventive and restorative) as mandatory benefits. The changes affect approximately 1.2 million employees currently enrolled in basic-tier plans. Insurers must also eliminate pre-authorization requirements for emergency care and reduce claim processing times to 5 working days. Infinity International's health insurance advisory service is already helping corporate clients plan the transition and benchmark costs.",
      body_ar: "أصدرت هيئة الصحة بدبي معايير تأمين صحي إلزامية جديدة سارية من يناير 2027، تشترط زيادة حدود المزايا السنوية من 150,000 إلى 300,000 درهم، وإدراج استشارات الصحة النفسية ورعاية الأسنان الأساسية كمزايا إلزامية.",
      body_fr: "La DHA a émis de nouvelles normes d'assurance santé obligatoires effectives en janvier 2027, exigeant d'augmenter les plafonds annuels de 150 000 à 300 000 AED et d'inclure la santé mentale (minimum 12 séances/an) et les soins dentaires de base.",
    },
    {
      id: "sa4", date: "2026-05-02", source: "The National", tag: "Medical Tourism",
      title_en: "Dubai Attracts 420,000 Medical Tourists in 2025, Revenue Tops AED 2.8B",
      title_ar: "دبي تستقطب 420,000 سائح طبي في 2025 وإيرادات تتجاوز 2.8 مليار درهم",
      title_fr: "Dubaï attire 420 000 touristes médicaux en 2025, revenus dépassant 2,8 milliards AED",
      summary_en: "Dubai Healthcare City reports record medical tourist arrivals, primarily from GCC, South Asia, and Africa seeking elective procedures, oncology care, and wellness treatments.",
      summary_ar: "تُسجّل مدينة دبي الطبية أرقاماً قياسية في الزيارات السياحية الطبية، بشكل رئيسي من دول مجلس التعاون وجنوب آسيا وأفريقيا.",
      summary_fr: "Dubai Healthcare City rapporte des arrivées record de touristes médicaux, principalement du Golfe, d'Asie du Sud et d'Afrique.",
      body_en: "Dubai attracted 420,000 medical tourists in 2025 generating AED 2.8 billion in healthcare revenue, according to the Dubai Health Authority's annual medical tourism report. The top source markets were Saudi Arabia (28%), India (19%), Russia (12%), and a growing contingent from East and West Africa (14% combined). Most sought procedures included elective orthopedic surgery, bariatric surgery, oncology consultations, IVF treatments, and executive health check-ups. Dubai Healthcare City's 150+ licensed facilities maintained a 94% patient satisfaction rate. Infinity International facilitates medical tourism packages including visa coordination, airport transfers, accommodation near hospitals, and post-care concierge services.",
      body_ar: "استقطبت دبي 420,000 سائح طبي في 2025 بإيرادات رعاية صحية بلغت 2.8 مليار درهم. جاء أعلى الأسواق المُصدِّرة من المملكة العربية السعودية (28٪) والهند (19٪) وروسيا (12٪). تُيسّر إنفينيتي إنترناشيونال باقات السياحة الطبية بما فيها التنسيق التأشيرة والنقل وخدمات ما بعد الرعاية.",
      body_fr: "Dubaï a attiré 420 000 touristes médicaux en 2025, générant 2,8 milliards AED. Les principaux marchés sources étaient l'Arabie Saoudite (28%), l'Inde (19%) et la Russie (12%). Infinity International facilite des packages de tourisme médical incluant la coordination visa, les transferts et les services de conciergerie post-soins.",
    },
  ],

  assurance: [
    {
      id: "as1", date: "2026-05-21", source: "Insurance Business Arabia", tag: "Market",
      title_en: "UAE Insurance Market Grows 11% to Reach AED 72B in Gross Written Premiums",
      title_ar: "سوق التأمين الإماراتية تنمو 11٪ لتصل إلى 72 مليار درهم في أقساط الاكتتاب",
      title_fr: "Le marché assurance UAE croît de 11% pour atteindre 72 milliards AED en primes brutes",
      summary_en: "UAE insurance sector records strongest growth in five years, driven by mandatory health insurance expansion, compulsory motor insurance renewals, and new corporate liability products.",
      summary_ar: "يُسجّل قطاع التأمين الإماراتي أقوى نمو في خمس سنوات، مدفوعاً بتوسّع التأمين الصحي الإلزامي وتجديدات التأمين الإلزامي على السيارات.",
      summary_fr: "Le secteur assurance des EAU enregistre sa plus forte croissance en cinq ans, portée par l'expansion de l'assurance santé obligatoire et les nouvelles polices de responsabilité civile.",
      body_en: "The UAE insurance market recorded AED 72 billion in gross written premiums for 2025, an 11% increase over 2024, according to the Insurance Authority's annual report. Health insurance remains the dominant line at 42% of total premiums, supported by mandatory employer coverage requirements. Motor insurance (23%) and property insurance (18%) were the next largest segments. Life insurance grew the fastest at 19% year-on-year, reflecting increasing awareness among expatriate residents of life coverage needs. The regulatory environment has become increasingly stringent with new IFRS 17 accounting standards fully implemented, requiring insurers to increase technical reserve adequacy. Infinity International's insurance advisory service specializes in multi-line corporate programs and expatriate personal line coverage.",
      body_ar: "سجّل سوق التأمين الإماراتي 72 مليار درهم في أقساط الاكتتاب لعام 2025. يظل التأمين الصحي هو الشريحة المهيمنة بنسبة 42٪. بلغ نمو التأمين على الحياة 19٪ على أساس سنوي.",
      body_fr: "Le marché assurance des EAU a enregistré 72 milliards AED de primes brutes pour 2025. L'assurance santé reste la ligne dominante à 42% du total. L'assurance-vie a connu la croissance la plus rapide à +19% annuel.",
    },
    {
      id: "as2", date: "2026-05-14", source: "Gulf Insurance Group", tag: "Digital",
      title_en: "InsurTech Investment in UAE Reaches USD 340M in 2025",
      title_ar: "استثمارات التقنية التأمينية في الإمارات تصل إلى 340 مليون دولار في 2025",
      title_fr: "L'investissement InsurTech aux EAU atteint 340 millions USD en 2025",
      summary_en: "Dubai International Financial Centre reports record InsurTech funding with AI-powered underwriting and claims automation platforms attracting major VC backing.",
      summary_ar: "يُسجّل مركز دبي المالي العالمي تمويلاً قياسياً لشركات التقنية التأمينية مع اجتذاب منصات الاكتتاب بالذكاء الاصطناعي وأتمتة المطالبات دعماً كبيراً.",
      summary_fr: "Le DIFC rapporte un financement InsurTech record avec des plateformes de souscription IA et d'automatisation des sinistres attirant un soutien VC majeur.",
      body_en: "InsurTech investment in the UAE reached USD 340 million in 2025, nearly doubling from USD 180 million in 2023, driven by DIFC's InsurTech hub program and Abu Dhabi Global Market's regulatory sandbox. Key funded startups include Democrance (micro-insurance for low-income segments), CoverGo (B2B insurance distribution platform), and YallaCompare (consumer comparison). Traditional insurers are also investing heavily in AI underwriting systems that can process motor and property insurance applications in under 3 minutes. The UAE Insurance Authority has issued new guidelines for embedded insurance products, which allow airlines, travel platforms, and e-commerce sites to sell insurance at point of purchase. Infinity International is exploring integration of embedded insurance into its property transaction and tourism booking flows.",
      body_ar: "وصل استثمار التقنية التأمينية في الإمارات إلى 340 مليون دولار في 2025، بارتفاع حاد من 180 مليون دولار في 2023. تعمل شركات الناشئة الرئيسية المموّلة على التأمين الصغري ومنصات توزيع التأمين وأنظمة التأمين المدمج.",
      body_fr: "L'investissement InsurTech aux EAU a atteint 340 millions USD en 2025, presque le double de 2023. Les startups phares incluent Democrance, CoverGo et YallaCompare. Les assureurs traditionnels investissent massivement dans des systèmes de souscription IA.",
    },
  ],

  banques: [
    {
      id: "ba1", date: "2026-05-23", source: "Central Bank UAE", tag: "Rates",
      title_en: "UAE Central Bank Holds Base Rate at 4.65% Amid Global Uncertainty",
      title_ar: "المصرف المركزي الإماراتي يُبقي على سعر الفائدة القياسي عند 4.65٪",
      title_fr: "La Banque Centrale des EAU maintient le taux directeur à 4,65% face aux incertitudes mondiales",
      summary_en: "The UAE Central Bank keeps its benchmark interest rate unchanged at 4.65%, aligned with US Federal Reserve policy, providing mortgage and lending rate stability for Q2 2026.",
      summary_ar: "يُبقي المصرف المركزي الإماراتي على سعر الفائدة القياسي دون تغيير عند 4.65٪، منسجماً مع سياسة الاحتياطي الفيدرالي الأمريكي.",
      summary_fr: "La Banque Centrale des EAU maintient son taux directeur inchangé à 4,65%, aligné sur la politique de la Fed américaine.",
      body_en: "The UAE Central Bank's Monetary Policy Committee voted unanimously to hold the base rate at 4.65% at its May 2026 meeting, following the US Federal Reserve's decision to pause its rate cycle. The UAE dirham's peg to the US dollar means UAE monetary policy mirrors Fed decisions. For mortgage borrowers, current variable rates on AED home loans average 6.8–7.2%, unchanged from the previous quarter. Banks are competing aggressively on fixed-rate mortgage products, with Emirates NBD and Abu Dhabi Commercial Bank offering 3-year fixed rates starting at 6.4%. The interest rate environment remains favorable for savings deposits, with high-yield savings accounts offering up to 4.5% annually. Infinity International's banking advisory service helps clients compare mortgage products across 12 UAE banks.",
      body_ar: "صوّتت لجنة السياسة النقدية في المصرف المركزي الإماراتي بالإجماع على إبقاء سعر الفائدة القياسي عند 4.65٪. تتراوح أسعار الرهن العقاري المتغيرة الحالية بين 6.8 و7.2٪. تتنافس البنوك بقوة على منتجات الرهن العقاري ذات السعر الثابت.",
      body_fr: "La Banque Centrale des EAU a voté à l'unanimité pour maintenir le taux directeur à 4,65%. Les taux hypothécaires variables actuels moyennent 6,8-7,2%. Les banques se concurrencent agressivement sur les produits à taux fixe, avec des offres à partir de 6,4% sur 3 ans.",
    },
    {
      id: "ba2", date: "2026-05-16", source: "Emirates 24/7", tag: "Digital Banking",
      title_en: "UAE Digital Banking Users Surpass 8 Million — 72% of Adult Population",
      title_ar: "مستخدمو الخدمات المصرفية الرقمية في الإمارات يتجاوزون 8 مليون — 72٪ من البالغين",
      title_fr: "Les utilisateurs de banque digitale aux EAU dépassent 8 millions — 72% de la population adulte",
      summary_en: "Mobile and internet banking penetration in UAE reaches 72% of adult residents, with real-time payment infrastructure processing AED 4.3 billion in daily transactions.",
      summary_ar: "يبلغ اختراق الخدمات المصرفية عبر الهاتف والإنترنت 72٪ من البالغين المقيمين في الإمارات.",
      summary_fr: "La pénétration bancaire mobile et internet aux EAU atteint 72% des résidents adultes.",
      body_en: "Digital banking adoption in the UAE has accelerated dramatically, with over 8 million residents now using mobile or internet banking as their primary channel, representing 72% of the adult population, up from 58% in 2023. The UAE's Instant Payment Network processed AED 4.3 billion in daily transactions in Q1 2026, a 67% increase year-over-year. Neo-banks and digital-only players like Wio, Zand, and Liv by Emirates NBD now collectively serve 2.1 million customers. The Central Bank's Open Banking framework, launched in late 2024, is enabling third-party fintechs to build financial products on top of bank APIs. Traditional banks have responded by launching 24/7 digital account opening with Emirates ID verification, reducing onboarding from 5 days to under 10 minutes.",
      body_ar: "تجاوز عدد مستخدمي الخدمات المصرفية الرقمية في الإمارات 8 ملايين. معالجة شبكة المدفوعات الفورية 4.3 مليار درهم يومياً. البنوك الإلكترونية الجديدة تخدم 2.1 مليون عميل بشكل مشترك.",
      body_fr: "L'adoption bancaire digitale aux EAU a atteint 8 millions d'utilisateurs (72% des adultes). Le réseau de paiement instantané UAE traite 4,3 milliards AED par jour. Les néo-banques Wio, Zand et Liv servent collectivement 2,1 millions de clients.",
    },
    {
      id: "ba3", date: "2026-05-08", source: "Banker Middle East", tag: "Mortgage",
      title_en: "UAE Mortgage Market Records AED 28B in New Originations for Q1 2026",
      title_ar: "سوق الرهن العقاري الإماراتي يُسجّل 28 مليار درهم في إصدارات جديدة للربع الأول 2026",
      title_fr: "Le marché hypothécaire des EAU enregistre 28 milliards AED de nouveaux prêts au T1 2026",
      summary_en: "UAE mortgage originations reach 5-year high with first-time buyers leveraging 90% LTV products from Islamic banks while refinancing activity remains subdued by sticky rates.",
      summary_ar: "يبلغ إصدار الرهن العقاري في الإمارات أعلى مستوياته في 5 سنوات مع استخدام المشترين لأول مرة منتجات نسبة القرض إلى القيمة 90٪.",
      summary_fr: "Les émissions hypothécaires aux EAU atteignent un sommet sur 5 ans, avec les primo-accédants utilisant des produits à 90% LTV des banques islamiques.",
      body_en: "UAE mortgage originations reached AED 28 billion in Q1 2026, the highest quarterly volume since 2021, driven primarily by first-time buyers and the off-plan market's growth. Islamic banks — led by Abu Dhabi Islamic Bank, Dubai Islamic Bank, and Sharjah Islamic Bank — captured 61% of new mortgage volume, offering Sharia-compliant products at competitive rates with 90% loan-to-value ratios for UAE nationals and 80% for expatriates. The Central Bank's mortgage cap rules introduced in 2013 remain in force, limiting expatriates to 80% LTV on properties below AED 5 million. Infinity International's banking advisory service pre-qualifies clients at no cost, comparing products from 12 lenders to find the optimal structure for each buyer's profile.",
      body_ar: "بلغت إصدارات الرهن العقاري في الإمارات 28 مليار درهم في الربع الأول من 2026. استحوذت البنوك الإسلامية على 61٪ من حجم الرهن الجديد. نسبة القرض إلى القيمة تبلغ 80٪ للمغتربين.",
      body_fr: "Les émissions hypothécaires aux EAU ont atteint 28 milliards AED au T1 2026. Les banques islamiques ont capturé 61% du volume, offrant des produits conformes à la Charia avec un LTV de 90% pour les nationaux et 80% pour les expatriés.",
    },
  ],

  amazon: [
    {
      id: "am1", date: "2026-05-20", source: "E-Commerce Arabia", tag: "FBA",
      title_en: "Amazon UAE Cross-Border Seller Base Grows 58% to 48,000 Active Merchants",
      title_ar: "قاعدة البائعين العابرين للحدود في أمازون الإمارات تنمو 58٪ لتصل إلى 48,000 تاجر نشط",
      title_fr: "La base de vendeurs cross-border Amazon UAE croît de 58% à 48 000 marchands actifs",
      summary_en: "Amazon.ae reports 58% growth in third-party seller accounts driven by UAE government's e-commerce facilitation initiative and expanded FBA warehouse capacity in Dubai.",
      summary_ar: "تُسجّل أمازون الإمارات نمواً بنسبة 58٪ في حسابات البائعين من الجهات الخارجية مدفوعاً بمبادرة تسهيل التجارة الإلكترونية الحكومية الإماراتية.",
      summary_fr: "Amazon.ae rapporte 58% de croissance des comptes vendeurs tiers, portée par l'initiative gouvernementale UAE et l'expansion des entrepôts FBA à Dubaï.",
      body_en: "Amazon UAE's third-party marketplace has expanded dramatically to 48,000 active sellers in 2025, a 58% increase driven by Dubai CommerCity's one-stop e-commerce licensing service and Amazon's expansion of its Dubai South fulfillment center to 450,000 square meters — making it one of the largest FBA facilities in the MENA region. Top-performing product categories include electronics accessories, fashion, health & beauty, and home goods. UAE-based FBA sellers report average profit margins of 22% for established private label products, with strong demand from Saudi Arabia, Egypt, Kuwait, and Oman contributing 63% of cross-border order volume. Infinity International's Amazon consulting team helps clients from product sourcing to listing optimization, PPC management, and FBA inventory planning.",
      body_ar: "اتسعت منصة أمازون الإمارات من الجهات الخارجية لتضم 48,000 بائع نشط، بزيادة 58٪. تشمل أعلى فئات المنتجات أداءً الإلكترونيات والأزياء والصحة والجمال. يحقق البائعون عبر FBA هوامش ربح متوسطة 22٪.",
      body_fr: "Le marché tiers Amazon UAE a atteint 48 000 vendeurs actifs (+58%). L'entrepôt FBA de Dubai South couvre maintenant 450 000 m². Les vendeurs FBA basés aux EAU rapportent des marges bénéficiaires moyennes de 22% pour les marques privées établies.",
    },
    {
      id: "am2", date: "2026-05-13", source: "Gulf Retail", tag: "Logistics",
      title_en: "UAE Same-Day Delivery Coverage Expands to 91% of Urban Addresses",
      title_ar: "تغطية التوصيل في نفس اليوم في الإمارات تتسع لتشمل 91٪ من العناوين الحضرية",
      title_fr: "La couverture livraison le jour même aux EAU s'étend à 91% des adresses urbaines",
      summary_en: "Last-mile logistics investments by Noon, Amazon, Fetchr, and Aramex bring same-day delivery to 91% of UAE urban addresses as drone delivery pilots launch in Dubai.",
      summary_ar: "توسّع تغطية التوصيل في نفس اليوم بفعل استثمارات الميل الأخير من نون وأمازون وفيتشر وأرامكس لتشمل 91٪ من العناوين الحضرية.",
      summary_fr: "Les investissements logistiques de Noon, Amazon, Fetchr et Aramex portent la livraison le jour même à 91% des adresses urbaines des EAU.",
      body_en: "UAE e-commerce logistics infrastructure has reached near-full coverage for same-day delivery in major urban centers, with Noon, Amazon.ae, Fetchr, and Aramex collectively serving 91% of Dubai, Abu Dhabi, and Sharjah addresses with same-day options. The expansion has been enabled by AED 2.1 billion in logistics infrastructure investment in 2024–2025 combined, including new sortation centers, expanded motorcycle courier networks, and AI-powered route optimization. Dubai's Roads and Transport Authority approved the first commercial drone delivery corridor in Q1 2026, with Amazon Prime Air operating 35 delivery drones along a 12km corridor between Dubai South and Motor City. E-commerce sellers using FBA benefit directly from these logistics improvements, with Amazon reporting a 23% reduction in delivery complaints year-on-year.",
      body_ar: "وصلت البنية التحتية اللوجستية للتجارة الإلكترونية في الإمارات إلى تغطية شبه كاملة للتوصيل في نفس اليوم. وافقت هيئة الطرق والمواصلات على أول ممر للتوصيل التجاري بالطائرات المسيّرة في الربع الأول من 2026.",
      body_fr: "L'infrastructure logistique e-commerce UAE couvre 91% des adresses urbaines pour la livraison le jour même. La RTA de Dubaï a approuvé le premier corridor de livraison par drone au T1 2026, avec Amazon Prime Air opérant 35 drones sur 12km.",
    },
  ],

  consultants: [
    {
      id: "co1", date: "2026-05-22", source: "Management Consulting Review", tag: "Strategy",
      title_en: "UAE Management Consulting Market Valued at AED 4.2B, Growing 16% YoY",
      title_ar: "سوق الاستشارات الإدارية في الإمارات بقيمة 4.2 مليار درهم ينمو 16٪ سنوياً",
      title_fr: "Le marché du conseil en management UAE est évalué à 4,2 milliards AED, croissance de 16% annuel",
      summary_en: "UAE management consulting revenues surge on back of digital transformation mandates, Vision 2031 project execution and AI adoption advisory across both public and private sectors.",
      summary_ar: "تتصاعد إيرادات الاستشارات الإدارية في الإمارات على خلفية تفويضات التحول الرقمي وتنفيذ مشاريع رؤية 2031 واستشارات اعتماد الذكاء الاصطناعي.",
      summary_fr: "Les revenus du conseil en management aux EAU augmentent sur fond de mandats de transformation digitale, d'exécution des projets Vision 2031 et de conseil en adoption IA.",
      body_en: "The UAE management consulting market reached AED 4.2 billion in fee revenue in 2025, growing 16% year-over-year, according to a report by Consult & Research MENA. The Big Four accounting/consulting firms (Deloitte, PwC, KPMG, EY) combined with McKinsey, BCG, Oliver Wyman, and Roland Berger control approximately 68% of the market by revenue. However, boutique and specialist firms — including those focused on digital transformation, HR advisory, and sector-specific expertise — are the fastest-growing segment at 24% annual growth. UAE government entities, sovereign wealth funds, and family businesses transitioning from founder to professional management represent the most active client segments. Infinity International's consulting arm specializes in real estate investment advisory, business setup, and operational optimization for SMEs entering the UAE market.",
      body_ar: "بلغ سوق الاستشارات الإدارية في الإمارات 4.2 مليار درهم في إيرادات الأتعاب لعام 2025، بنمو 16٪. تُهيمن شركات المحاسبة والاستشارات الكبرى على 68٪ من السوق. تُعدّ شركات الخبرة المتخصصة الأسرع نمواً بنسبة 24٪ سنوياً.",
      body_fr: "Le marché du conseil en management UAE a atteint 4,2 milliards AED en 2025 (+16% annuel). Les Big Four et cabinets stratégiques contrôlent 68% du marché par revenus. Les cabinets boutiques spécialisés sont le segment à la croissance la plus rapide (+24%).",
    },
    {
      id: "co2", date: "2026-05-11", source: "UAE Economic Observer", tag: "Business Setup",
      title_en: "UAE New Business Registrations Hit 50,000 in Q1 2026 — 40% by Foreigners",
      title_ar: "تسجيلات الأعمال الجديدة في الإمارات تبلغ 50,000 في الربع الأول 2026 — 40٪ من قِبل الأجانب",
      title_fr: "Les nouvelles immatriculations d'entreprises UAE atteignent 50 000 au T1 2026 — 40% par des étrangers",
      summary_en: "Record business formation activity in UAE with 50,000 new companies registered in Q1 2026, driven by 100% foreign ownership rules, free zone expansion, and Golden Visa incentives.",
      summary_ar: "نشاط تأسيس أعمال قياسي في الإمارات مع تسجيل 50,000 شركة جديدة في الربع الأول من 2026، مدفوعاً بقواعد الملكية الأجنبية بنسبة 100٪ وتوسع المناطق الحرة.",
      summary_fr: "Activité de création d'entreprises record aux EAU avec 50 000 nouvelles sociétés au T1 2026, portée par les règles de propriété étrangère à 100%, l'expansion des zones franches et les incitations Golden Visa.",
      body_en: "The UAE recorded 50,000 new business registrations in Q1 2026, a 31% increase over Q1 2025, with foreign nationals accounting for 40% of new incorporations — the highest foreign entrepreneur participation rate in UAE history. The continued rollout of 100% foreign ownership in mainland sectors and the proliferation of free zones (now 47 across the UAE) continue to attract entrepreneurs from Europe, South Asia, and Africa. The UAE Ministry of Economy reports that one-person service companies (sole establishments and single-member LLCs) account for 62% of new registrations, reflecting the rise of digital nomads and freelance professionals choosing Dubai as a base. Infinity International's business setup consulting team handles DED mainland and DMCC/JAFZA free zone registrations, including Golden Visa-eligible structures for qualifying clients.",
      body_ar: "سجّلت الإمارات 50,000 تسجيل أعمال جديد في الربع الأول من 2026، بزيادة 31٪. يمثّل الرعايا الأجانب 40٪ من التأسيسات الجديدة — أعلى معدل مشاركة لرجال الأعمال الأجانب في تاريخ الإمارات.",
      body_fr: "Les EAU ont enregistré 50 000 nouvelles immatriculations d'entreprises au T1 2026 (+31%). Les ressortissants étrangers représentent 40% des nouvelles incorporations — le taux le plus élevé de l'histoire des EAU. Les UAE comptent maintenant 47 zones franches.",
    },
  ],

  admin: [
    {
      id: "ad1", date: "2026-05-24", source: "Government of UAE", tag: "Digital Gov",
      title_en: "UAE Achieves 96% Government Service Digitization — World's Highest Rate",
      title_ar: "الإمارات تحقق 96٪ رقمنة للخدمات الحكومية — الأعلى عالمياً",
      title_fr: "Les EAU atteignent 96% de numérisation des services gouvernementaux — Le plus haut taux mondial",
      summary_en: "The UAE ranks first globally in government service digitization with 96% of public services available online, reducing average service completion time from 8 days to 3 hours.",
      summary_ar: "تحتل الإمارات المرتبة الأولى عالمياً في رقمنة الخدمات الحكومية مع 96٪ من الخدمات العامة متاحة عبر الإنترنت.",
      summary_fr: "Les EAU se classent premiers mondialement en numérisation des services gouvernementaux avec 96% des services publics disponibles en ligne.",
      body_en: "The UAE Government Annual Report for 2025 confirms the country has achieved 96% digitization of government services, ranking first globally ahead of Estonia (94%) and Singapore (91%). The UAE Pass digital identity platform now serves 7.2 million users and enables single-sign-on access to 5,500+ government services across federal and emirate entities. Average government service completion time has been reduced from 8 working days in 2020 to under 3 hours in 2025 for the most common transactions including residency renewals, driving license applications, and business registration. The Ministry of Cabinet Affairs' Government Services Excellence program is now rolling out AI-powered proactive government services — where the government initiates service delivery before the citizen needs to request it. Infinity International regularly leverages the UAE's digital infrastructure to accelerate visa, business registration, and residency processes for its clients.",
      body_ar: "يؤكد التقرير السنوي للحكومة الإماراتية 2025 تحقيق البلاد رقمنة 96٪ للخدمات الحكومية. تخدم منصة الهوية الرقمية UAE Pass 7.2 مليون مستخدم وتتيح وصول أحادي الدخول لأكثر من 5,500 خدمة حكومية. انخفض متوسط وقت إتمام الخدمات الحكومية من 8 أيام عمل في 2020 إلى أقل من 3 ساعات.",
      body_fr: "Le rapport annuel du gouvernement UAE 2025 confirme que le pays a atteint 96% de numérisation. UAE Pass sert 7,2 millions d'utilisateurs et donne accès en SSO à 5 500+ services gouvernementaux. Le temps moyen d'accomplissement est passé de 8 jours ouvrables à moins de 3 heures.",
    },
    {
      id: "ad2", date: "2026-05-15", source: "Federal Authority", tag: "Residency",
      title_en: "New Long-Term Residence Visa Categories Launched for Specialists",
      title_ar: "إطلاق فئات تأشيرة إقامة طويلة الأمد جديدة للمتخصصين",
      title_fr: "Nouvelles catégories de visa de résidence à long terme lancées pour les spécialistes",
      summary_en: "UAE expands its long-term visa framework with new 10-year residence visas for AI researchers, renewable energy engineers, culture and arts professionals, and agricultural innovators.",
      summary_ar: "توسّع الإمارات إطارها للتأشيرة طويلة الأمد بتأشيرات إقامة 10 سنوات جديدة لباحثي الذكاء الاصطناعي ومهندسي الطاقة المتجددة والمبدعين الثقافيين.",
      summary_fr: "Les EAU élargissent leur cadre visa long terme avec de nouveaux visas de résidence 10 ans pour les chercheurs IA, ingénieurs en énergie renouvelable et professionnels de la culture.",
      body_en: "The UAE Federal Authority for Identity and Citizenship has announced four new occupational categories eligible for the 10-year long-term residence visa: AI and machine learning researchers, renewable energy engineers, culture and arts professionals with demonstrated international recognition, and agricultural technology innovators. The additions bring the total number of qualifying occupational categories to 23. Required documentation includes attested academic qualifications, professional experience letters, and salary certificates showing AED 30,000+ monthly income (or equivalent self-employment income for entrepreneurs). Processing time for long-term residence visas has been reduced to 10 working days. Infinity International's administration services team provides end-to-end long-term visa processing, from initial eligibility assessment through document attestation and final application submission.",
      body_ar: "أعلنت الهيئة الاتحادية للهوية والجنسية عن أربع فئات مهنية جديدة مؤهلة لتأشيرة الإقامة طويلة الأمد لمدة 10 سنوات: باحثو الذكاء الاصطناعي ومهندسو الطاقة المتجددة والمحترفون الثقافيون والمبتكرون في التكنولوجيا الزراعية.",
      body_fr: "L'Autorité fédérale des EAU a annoncé quatre nouvelles catégories professionnelles éligibles au visa de résidence longue durée 10 ans : chercheurs IA, ingénieurs en énergies renouvelables, professionnels de la culture et innovateurs en agritech. Le délai de traitement a été réduit à 10 jours ouvrables.",
    },
  ],

  travail: [
    {
      id: "tr1", date: "2026-05-21", source: "UAE Ministry of HR", tag: "Labour Market",
      title_en: "UAE Private Sector Employment Rises 12% as Emiratisation Targets Advance",
      title_ar: "توظيف القطاع الخاص في الإمارات يرتفع 12٪ مع تقدم أهداف التوطين",
      title_fr: "L'emploi dans le secteur privé UAE augmente de 12% avec l'avancement des objectifs d'Emiratisation",
      summary_en: "UAE private sector employment grew 12% in 2025 with 68,000 new UAE national hires, surpassing Emiratisation quota targets for the third consecutive year across banking, telecom, and healthcare.",
      summary_ar: "نما توظيف القطاع الخاص الإماراتي 12٪ في 2025 مع 68,000 توظيف جديد من المواطنين الإماراتيين، متجاوزاً أهداف حصة التوطين للسنة الثالثة على التوالي.",
      summary_fr: "L'emploi dans le secteur privé UAE a augmenté de 12% en 2025 avec 68 000 nouvelles embauches de nationaux, dépassant les quotas d'Emiratisation pour la troisième année consécutive.",
      body_en: "The UAE Ministry of Human Resources and Emiratisation reports that private sector employment grew 12% in 2025, supported by 68,000 new UAE national hires — surpassing the annual Emiratisation quota for the third consecutive year. Banking and financial services maintained the highest Emiratisation rate at 36%, followed by telecom (28%) and healthcare (22%). The NAFIS program — which subsidizes UAE national salaries in the private sector up to AED 8,000 per month — has been expanded to include small and medium enterprises with 20–49 employees. Foreign worker permits reached 5.8 million active permits, with construction, hospitality, and domestic services as the dominant sectors. Infinity International's employment division connects skilled professionals with UAE employers across multiple sectors and provides visa coordination for incoming employees.",
      body_ar: "تُسجّل الوزارة نمواً بنسبة 12٪ في توظيف القطاع الخاص. الخدمات المصرفية والمالية تحافظ على أعلى معدل تعاملات بنسبة 36٪. تم توسيع برنامج نافس ليشمل الشركات الصغيرة والمتوسطة.",
      body_fr: "Le Ministère des RH et de l'Emiratisation rapporte une croissance de 12% de l'emploi privé avec 68 000 nouvelles embauches nationales. Le programme NAFIS a été étendu aux PME de 20 à 49 employés. Les permis de travail étrangers ont atteint 5,8 millions actifs.",
    },
    {
      id: "tr2", date: "2026-05-14", source: "Bayt.com", tag: "Remote Work",
      title_en: "UAE Launches Remote Work Visa Programme for Global Tech Talent",
      title_ar: "الإمارات تطلق برنامج تأشيرة العمل عن بُعد للمواهب التقنية العالمية",
      title_fr: "Les EAU lancent un programme de visa travail à distance pour les talents tech mondiaux",
      summary_en: "New UAE Remote Work Visa program allows digital professionals earning USD 5,000+ monthly to reside in UAE for one year with renewable options and full family sponsorship rights.",
      summary_ar: "يتيح برنامج تأشيرة العمل عن بُعد الجديد في الإمارات للمحترفين الرقميين الإقامة لمدة عام قابل للتجديد.",
      summary_fr: "Le nouveau programme de visa travail à distance des EAU permet aux professionnels digitaux gagnant 5 000+ USD/mois de résider aux EAU un an avec option de renouvellement.",
      body_en: "The UAE Government has launched an enhanced Remote Work Visa program targeting global technology and creative professionals. The program allows individuals earning a minimum of USD 5,000 per month from foreign employers or their own businesses to reside in the UAE for one year, renewable annually for up to 5 years. Key benefits include: full family sponsorship rights (spouse and up to four children), driving license equivalency recognition from major countries, and access to UAE banking, healthcare, and school enrollment for dependents. The program targets professionals in software development, digital marketing, video production, graphic design, UX/UI, data science, and e-commerce management. UAE income earned remotely for foreign clients is exempt from UAE personal income tax. Infinity International processes Remote Work Visa applications as part of its comprehensive employment services.",
      body_ar: "أطلقت حكومة الإمارات برنامج تأشيرة العمل عن بُعد المحسَّن للمحترفين التقنيين والإبداعيين العالميين. يتيح البرنامج للأفراد الحاصلين على دخل لا يقل عن 5,000 دولار شهرياً الإقامة في الإمارات لمدة عام قابل للتجديد. يشمل حق كفالة الأسرة الكاملة والوصول إلى الخدمات المصرفية والرعاية الصحية.",
      body_fr: "Le gouvernement UAE a lancé un programme de visa travail à distance amélioré ciblant les professionnels technologiques et créatifs mondiaux. Le programme permet à ceux gagnant 5 000+ USD/mois de résider aux EAU un an (renouvelable jusqu'à 5 ans). Avantages : droit de parrainage famille complète, accès aux services bancaires, santé et écoles pour les dépendants.",
    },
    {
      id: "tr3", date: "2026-05-05", source: "Gulf HR Review", tag: "Salary",
      title_en: "UAE Salary Increases Average 8.5% in 2026 — Tech and Finance Lead",
      title_ar: "زيادات الرواتب في الإمارات تبلغ متوسط 8.5٪ في 2026 — التقنية والمالية في المقدمة",
      title_fr: "Les augmentations salariales aux EAU moyennent 8,5% en 2026 — Tech et finance en tête",
      summary_en: "UAE salary increments average 8.5% for 2026, with technology professionals receiving the highest raises of 14-18% as employer competition for digital skills intensifies.",
      summary_ar: "تبلغ زيادات الرواتب في الإمارات متوسطاً قدره 8.5٪ لعام 2026، مع حصول المحترفين في مجال التكنولوجيا على أعلى زيادات بنسبة 14-18٪.",
      summary_fr: "Les augmentations salariales aux EAU moyennent 8,5% pour 2026, les professionnels technologiques recevant les plus fortes hausses de 14-18% face à une concurrence intense pour les compétences digitales.",
      body_en: "UAE salary growth averaged 8.5% across all sectors in 2026 according to Bayt.com's annual Gulf Salary Survey, outpacing the regional average of 6.2%. Technology professionals received the highest increases at 14–18%, particularly those with AI/ML engineering, cybersecurity, and cloud architecture skills. Finance and accounting professionals saw 10–12% increases, driven by IFRS 17 and AML compliance hiring. Healthcare professionals continue to command premiums, with specialist physicians receiving packages 20–30% higher than 2023 levels. The UAE's zero personal income tax combined with cost-of-living adjustments makes total compensation packages highly competitive versus European financial centers. Infinity International's recruitment team specializes in mid-to-senior level placements across real estate, hospitality, healthcare, and financial services.",
      body_ar: "بلغ متوسط نمو الرواتب في الإمارات 8.5٪ في جميع القطاعات، متجاوزاً المتوسط الإقليمي البالغ 6.2٪. يحصل المحترفون في مجال التكنولوجيا على أعلى زيادة بنسبة 14-18٪. يجعل الإعفاء من ضريبة الدخل الشخصي الحزم التعويضية الإجمالية تنافسية للغاية.",
      body_fr: "La croissance salariale aux EAU a moyenné 8,5% en 2026, dépassant la moyenne régionale de 6,2%. Les professionnels tech ont reçu les plus fortes hausses (14-18%), notamment ceux avec des compétences IA/ML, cybersécurité et architecture cloud.",
    },
  ],
};

/* ─── Sector labels ────────────────────────────────────────────────────────── */
const SECTOR_LABELS: Record<Sector, { en: string; ar: string; fr: string; color: string }> = {
  realestate:  { en: "Real Estate",  ar: "العقارات",       fr: "Immobilier",  color: "#C9A84C" },
  tourisme:    { en: "Tourism",      ar: "السياحة",        fr: "Tourisme",    color: "#0EA5E9" },
  sante:       { en: "Health",       ar: "الصحة",          fr: "Santé",       color: "#10B981" },
  assurance:   { en: "Insurance",    ar: "التأمين",        fr: "Assurance",   color: "#8B5CF6" },
  banques:     { en: "Banking",      ar: "البنوك",         fr: "Banques",     color: "#3B82F6" },
  amazon:      { en: "Amazon/E-com", ar: "أمازون",         fr: "Amazon/E-com",color: "#F59E0B" },
  consultants: { en: "Consultants",  ar: "المستشارون",     fr: "Consultants", color: "#EC4899" },
  admin:       { en: "Admin",        ar: "الإدارات",       fr: "Admin",       color: "#64748B" },
  travail:     { en: "Employment",   ar: "التوظيف",        fr: "Emploi",      color: "#F97316" },
};

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
const TAG_COLORS: Record<string, string> = {
  Market: "#3B82F6", "Golden Visa": "#C9A84C", Rental: "#0EA5E9", Investment: "#10B981",
  "Off-Plan": "#8B5CF6", Analysis: "#64748B", Arrivals: "#EC4899", Luxury: "#F59E0B",
  MICE: "#F97316", Visa: "#06B6D4", Hotels: "#84CC16", Policy: "#10B981", MedTech: "#8B5CF6",
  Insurance: "#6366F1", "Medical Tourism": "#EC4899", Rates: "#3B82F6", "Digital Banking": "#0EA5E9",
  Mortgage: "#C9A84C", FBA: "#F59E0B", Logistics: "#F97316", Strategy: "#3B82F6",
  "Business Setup": "#10B981", "Digital Gov": "#0EA5E9", Residency: "#8B5CF6",
  "Labour Market": "#F97316", "Remote Work": "#3B82F6", Salary: "#10B981", Digital: "#6366F1",
};

function tagColor(tag: string): string { return TAG_COLORS[tag] ?? "#64748B"; }

function formatDate(iso: string, lang: string): string {
  const d = new Date(iso);
  const locale = lang === "ar" ? "ar-AE" : lang === "fr" ? "fr-FR" : "en-AE";
  return d.toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
}

/* ─── Detail Panel ─────────────────────────────────────────────────────────── */
function ArticlePanel({
  article, lang, onClose,
}: { article: NewsArticle; lang: string; onClose: () => void }) {
  const isAr = lang === "ar";
  const title   = isAr ? article.title_ar   : lang === "fr" ? article.title_fr   : article.title_en;
  const body    = isAr ? article.body_ar    : lang === "fr" ? article.body_fr    : article.body_en;
  const dir     = isAr ? "rtl" : "ltr";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 50, display: "flex", justifyContent: "flex-end",
      background: "rgba(0,0,0,0.35)", backdropFilter: "blur(2px)",
    }} onClick={onClose}>
      <div
        style={{
          width: "min(600px,95vw)", height: "100%", background: "#fff", boxShadow: "-4px 0 32px rgba(0,0,0,0.18)",
          display: "flex", flexDirection: "column", overflowY: "auto", direction: dir,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
              <span style={{
                padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
                background: `${tagColor(article.tag)}22`, color: tagColor(article.tag),
              }}>{article.tag}</span>
              <span style={{ fontSize: 12, color: "#94a3b8", display: "flex", alignItems: "center", gap: 4 }}>
                <IcCalendar /> {formatDate(article.date, lang)}
              </span>
              <span style={{ fontSize: 12, color: "#94a3b8" }}>· {article.source}</span>
            </div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: "#0f172a", lineHeight: 1.4, margin: 0 }}>{title}</h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 4, marginTop: -2, flexShrink: 0 }}>
            <IcX />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px 32px", flex: 1, lineHeight: 1.8, fontSize: 14, color: "#334155" }}>
          {body.split("\n").filter(Boolean).map((para, i) => (
            <p key={i} style={{ marginBottom: 16 }}>{para}</p>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 6 }}>
          <IcExternalLink />
          <span style={{ fontSize: 12, color: "#94a3b8" }}>{article.source}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── News Card ────────────────────────────────────────────────────────────── */
function NewsCard({ article, lang, onClick }: { article: NewsArticle; lang: string; onClick: () => void }) {
  const isAr    = lang === "ar";
  const isFr    = lang === "fr";
  const title   = isAr ? article.title_ar   : isFr ? article.title_fr   : article.title_en;
  const summary = isAr ? article.summary_ar : isFr ? article.summary_fr : article.summary_en;
  const dir     = isAr ? "rtl" : "ltr";

  return (
    <div
      onClick={onClick}
      style={{
        background: "#fff", borderRadius: 12, border: "1px solid #e2e8f0",
        padding: "18px 20px", cursor: "pointer", direction: dir,
        transition: "box-shadow 0.15s, border-color 0.15s",
        display: "flex", flexDirection: "column", gap: 10,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "0 4px 20px rgba(0,0,0,0.1)"; (e.currentTarget as HTMLDivElement).style.borderColor = "#cbd5e1"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.borderColor = "#e2e8f0"; }}
    >
      {/* Meta */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{
          padding: "2px 9px", borderRadius: 99, fontSize: 11, fontWeight: 600,
          background: `${tagColor(article.tag)}22`, color: tagColor(article.tag),
        }}>{article.tag}</span>
        <span style={{ fontSize: 11, color: "#94a3b8", display: "flex", alignItems: "center", gap: 3 }}>
          <IcCalendar /> {formatDate(article.date, lang)}
        </span>
        <span style={{ fontSize: 11, color: "#94a3b8" }}>· {article.source}</span>
      </div>

      {/* Title */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", margin: 0, lineHeight: 1.45 }}>{title}</h3>

      {/* Summary — 2-line clamp */}
      <p style={{
        fontSize: 13, color: "#64748b", margin: 0, lineHeight: 1.6,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
      }}>{summary}</p>

      {/* Read more */}
      <div style={{ fontSize: 12, color: "#3b82f6", fontWeight: 600 }}>
        {isAr ? "قراءة المزيد ←" : isFr ? "Lire la suite →" : "Read more →"}
      </div>
    </div>
  );
}

/* ─── Main Screen ──────────────────────────────────────────────────────────── */
export function ScreenSectorNews({ sector }: { sector: Sector }) {
  const { lang } = useLang();
  const isAr = lang === "ar";
  const isFr = lang === "fr";

  const meta    = SECTOR_LABELS[sector];
  const articles = NEWS[sector] ?? [];
  const allTags  = useMemo(() => Array.from(new Set(articles.map(a => a.tag))), [articles]);

  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selected, setSelected] = useState<NewsArticle | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return articles.filter(a => {
      const matchTag = !activeTag || a.tag === activeTag;
      const title   = isAr ? a.title_ar   : isFr ? a.title_fr   : a.title_en;
      const summary = isAr ? a.summary_ar : isFr ? a.summary_fr : a.summary_en;
      const matchQ  = !q || title.toLowerCase().includes(q) || summary.toLowerCase().includes(q);
      return matchTag && matchQ;
    });
  }, [articles, search, activeTag, isAr, isFr]);

  const sectorLabel = isAr ? meta.ar : isFr ? meta.fr : meta.en;
  const dir         = isAr ? "rtl" : "ltr";

  const labels = {
    title:    isAr ? `أخبار ${sectorLabel}` : isFr ? `Actualités ${sectorLabel}` : `${sectorLabel} News`,
    subtitle: isAr ? "آخر الأخبار والتحليلات" : isFr ? "Dernières actualités et analyses" : "Latest news and analysis",
    search:   isAr ? "بحث في الأخبار..." : isFr ? "Rechercher dans les actualités…" : "Search news…",
    all:      isAr ? "الكل" : isFr ? "Tous" : "All",
    noResult: isAr ? "لا توجد نتائج" : isFr ? "Aucun résultat" : "No results found",
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f8fafc", direction: dir }}>

      {/* Topbar with language switcher */}
      <Topbar title={labels.title} crumb={[labels.subtitle]} />

      {/* Search + filters bar */}
      <div style={{ padding: "12px 28px", background: "#fff", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Search */}
          <div style={{ position: "relative", minWidth: 200, flex: "1 1 200px", maxWidth: 340 }}>
            <span style={{ position: "absolute", insetInlineStart: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }}>
              <IcSearch />
            </span>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={labels.search}
              style={{
                width: "100%", height: 36, paddingInlineStart: 34, paddingInlineEnd: 12,
                border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 13, outline: "none",
                background: "#f8fafc", color: "#0f172a", boxSizing: "border-box",
              }}
            />
          </div>

          {/* Tag filters */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button
              onClick={() => setActiveTag(null)}
              style={{
                padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${!activeTag ? meta.color : "#e2e8f0"}`,
                background: !activeTag ? `${meta.color}15` : "transparent",
                color: !activeTag ? meta.color : "#64748b",
              }}
            >{labels.all}</button>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setActiveTag(activeTag === tag ? null : tag)}
                style={{
                  padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: `1.5px solid ${activeTag === tag ? tagColor(tag) : "#e2e8f0"}`,
                  background: activeTag === tag ? `${tagColor(tag)}18` : "transparent",
                  color: activeTag === tag ? tagColor(tag) : "#64748b",
                }}
              >{tag}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 40px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#94a3b8", fontSize: 14 }}>
            {labels.noResult}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}>
            {filtered.map(article => (
              <NewsCard
                key={article.id}
                article={article}
                lang={lang}
                onClick={() => setSelected(article)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <ArticlePanel article={selected} lang={lang} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
