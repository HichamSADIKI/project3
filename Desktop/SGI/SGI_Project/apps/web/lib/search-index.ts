export type SearchCategory = "navigation" | "client" | "company" | "action";

export interface SearchItem {
  id: string;
  category: SearchCategory;
  label: string;
  label_ar?: string;
  label_fr?: string;
  sub?: string;
  screen: string;
  initialSearch?: string;
  emoji: string;
  keywords: string;
}

export const SEARCH_INDEX: SearchItem[] = [
  // ── Navigation ──────────────────────────────────────────────
  { id: "nav-dash",      category: "navigation", label: "Dashboard",             label_ar: "لوحة التحكم",       label_fr: "Tableau de bord",    screen: "dash",      emoji: "◼",  keywords: "dashboard tableau bord accueil home main" },
  { id: "nav-realestate",category: "navigation", label: "Real Estate",           label_ar: "العقارات",           label_fr: "Immobilier",          screen: "realestate", emoji: "🏠", keywords: "real estate immobilier biens property properties dashboard" },
  { id: "nav-crm",       category: "navigation", label: "CRM / Leads",           label_ar: "إدارة العملاء",      label_fr: "CRM / Prospects",    screen: "crm",       emoji: "📊",  keywords: "crm leads prospects pipeline vente sales" },
  { id: "nav-orders",    category: "navigation", label: "Orders",                label_ar: "الطلبات",            label_fr: "Commandes",          screen: "orders",    emoji: "📋",  keywords: "orders commandes bons achats purchases" },
  { id: "nav-personne",  category: "navigation", label: "Individual Clients",    label_ar: "الأشخاص",            label_fr: "Clients Personnes",  screen: "personne",  emoji: "👤",  keywords: "clients personnes individuals personne physique" },
  { id: "nav-societe",   category: "navigation", label: "Company Clients",       label_ar: "الشركات",            label_fr: "Clients Sociétés",   screen: "societe",   emoji: "🏢",  keywords: "clients societes entreprises companies corporate" },
  { id: "nav-consult",   category: "navigation", label: "Consultants",           label_ar: "المستشارون",         label_fr: "Consultants",        screen: "consultants", emoji: "💼", keywords: "consultants experts specialists advisors" },
  { id: "nav-finance",   category: "navigation", label: "Finance",               label_ar: "المالية",            label_fr: "Finance",            screen: "finance",   emoji: "💰",  keywords: "finance tresorerie treasury transactions ledger revenus depenses paiements tva vat" },
  { id: "nav-accounting",category: "navigation", label: "Accounting",            label_ar: "المحاسبة",           label_fr: "Comptabilité",       screen: "accounting",emoji: "📒",  keywords: "accounting comptabilite grand livre general ledger journal entries ecritures plan comptes chart accounts balance trial double entry partie double" },
  { id: "nav-report",    category: "navigation", label: "Reports",               label_ar: "التقارير",           label_fr: "Rapports",           screen: "report",    emoji: "📈",  keywords: "reports rapports statistiques analytics insights" },
  { id: "nav-hr",        category: "navigation", label: "Human Resources",       label_ar: "الموارد البشرية",    label_fr: "RH",                 screen: "hr",        emoji: "👥",  keywords: "hr human resources rh employes staff conges" },
  { id: "nav-it",        category: "navigation", label: "IT",                    label_ar: "تقنية المعلومات",    label_fr: "Informatique",       screen: "it",        emoji: "💻",  keywords: "it informatique systeme reseau securite" },
  { id: "nav-marketing", category: "navigation", label: "Marketing",             label_ar: "التسويق",            label_fr: "Marketing",          screen: "marketing", emoji: "📣",  keywords: "marketing campagnes publicite social media" },
  { id: "nav-audit",     category: "navigation", label: "Audit",                 label_ar: "المراجعة",           label_fr: "Audit",              screen: "audit",     emoji: "🔍",  keywords: "audit traces logs history historique" },
  { id: "nav-workspace", category: "navigation", label: "Workspace",             label_ar: "مساحة العمل",        label_fr: "Espace de travail",  screen: "workspace", emoji: "🗂",   keywords: "workspace documents collaboration files" },
  { id: "nav-erp",       category: "navigation", label: "ERP",                   label_ar: "نظام ERP",           label_fr: "ERP",                screen: "erp",       emoji: "⚙️",  keywords: "erp enterprise resource planning gestion" },
  { id: "nav-params",    category: "navigation", label: "Settings",              label_ar: "الإعدادات",          label_fr: "Paramètres",         screen: "parametres",emoji: "⚙️",  keywords: "settings parametres configuration preferences" },

  // ── Individual clients ──────────────────────────────────────
  { id: "p-reem",    category: "client", label: "Reem Al Hashemi",    label_ar: "ريم الهاشمي",      sub: "+971 50 123 4567 · reem@email.ae",          screen: "personne", initialSearch: "Reem",       emoji: "👤", keywords: "reem al hashemi ae vip emirate" },
  { id: "p-abdl",    category: "client", label: "Abdullah Al Rashid", label_ar: "عبدالله الراشد",   sub: "+966 55 987 6543 · a.rashid@gmail.com",      screen: "personne", initialSearch: "Abdullah",   emoji: "👤", keywords: "abdullah al rashid sa vip saudi" },
  { id: "p-sophie",  category: "client", label: "Sophie Martin",      label_ar: "صوفي مارتان",      sub: "+33 6 12 34 56 78 · s.martin@gmail.com",     screen: "personne", initialSearch: "Sophie",     emoji: "👤", keywords: "sophie martin fr france active" },
  { id: "p-fatima",  category: "client", label: "Fatima Al Zaabi",    label_ar: "فاطمة الزعابي",   sub: "+971 52 456 7890 · fatima@email.ae",         screen: "personne", initialSearch: "Fatima",     emoji: "👤", keywords: "fatima al zaabi ae emirate active" },
  { id: "p-james",   category: "client", label: "James Thornton",     label_ar: "جيمس ثورنتون",    sub: "+44 7700 900000 · j.thornton@uk.com",        screen: "personne", initialSearch: "James",      emoji: "👤", keywords: "james thornton gb british active" },
  { id: "p-priya",   category: "client", label: "Priya Sharma",       label_ar: "بريا شارما",      sub: "+971 54 321 0987 · priya@email.in",          screen: "personne", initialSearch: "Priya",      emoji: "👤", keywords: "priya sharma in india prospect" },
  { id: "p-youssef", category: "client", label: "Youssef El Amrani",  label_ar: "يوسف العمراني",   sub: "+212 6 12 34 56 78 · y.amrani@ma.com",      screen: "personne", initialSearch: "Youssef",    emoji: "👤", keywords: "youssef el amrani ma maroc active" },
  { id: "p-dmitri",  category: "client", label: "Dmitri Volkov",      label_ar: "ديمتري فولكوف",   sub: "+971 50 876 5432 · d.volkov@ru.com",         screen: "personne", initialSearch: "Dmitri",     emoji: "👤", keywords: "dmitri volkov ru russia vip" },
  { id: "p-liwei",   category: "client", label: "Li Wei",             label_ar: "لي وي",            sub: "+971 55 654 3210 · liwei@cn.com",            screen: "personne", initialSearch: "Li Wei",     emoji: "👤", keywords: "li wei cn china active" },
  { id: "p-hessa",   category: "client", label: "Hessa Al Mansouri",  label_ar: "حصة المنصوري",    sub: "+971 56 789 0123 · hessa@email.ae",          screen: "personne", initialSearch: "Hessa",      emoji: "👤", keywords: "hessa al mansouri ae emirate prospect" },
  { id: "p-karim",   category: "client", label: "Karim Benali",       label_ar: "كريم بن علي",     sub: "+212 6 98 76 54 32 · k.benali@ma.com",      screen: "personne", initialSearch: "Karim",      emoji: "👤", keywords: "karim benali ma maroc prospect" },
  { id: "p-sara",    category: "client", label: "Sara Al Nuaimi",     label_ar: "سارة النعيمي",    sub: "+971 50 111 2233 · sara@email.ae",           screen: "personne", initialSearch: "Sara",       emoji: "👤", keywords: "sara al nuaimi ae emirate vip" },

  // ── Company clients ─────────────────────────────────────────
  { id: "c-emaar",  category: "company", label: "Emaar Properties LLC",    sub: "🇦🇪 Real Estate · +971 4 366 1688",   screen: "societe", initialSearch: "Emaar",   emoji: "🏢", keywords: "emaar properties real estate uae dubai" },
  { id: "c-damac",  category: "company", label: "DAMAC Holdings",           sub: "🇦🇪 Investment · +971 4 301 9999",    screen: "societe", initialSearch: "DAMAC",   emoji: "🏢", keywords: "damac holdings investment uae" },
  { id: "c-luxe",   category: "company", label: "Luxe Capital Partners",    sub: "🇬🇧 Investment · +44 20 7946 0123",  screen: "societe", initialSearch: "Luxe",    emoji: "🏢", keywords: "luxe capital partners investment uk london" },
  { id: "c-gulf",   category: "company", label: "Gulf Investments Group",   sub: "🇸🇦 Finance · +966 11 234 5678",     screen: "societe", initialSearch: "Gulf",    emoji: "🏢", keywords: "gulf investments finance saudi riyadh" },
  { id: "c-maf",    category: "company", label: "MAF Properties",           sub: "🇦🇪 Retail · +971 4 294 7000",       screen: "societe", initialSearch: "MAF",     emoji: "🏢", keywords: "maf properties retail mall uae" },

  // ── Quick actions ───────────────────────────────────────────
  { id: "act-new-person",   category: "action", label: "New Individual Client",   label_fr: "Nouveau client (personne)", sub: "Add a person to CRM",       screen: "personne",  emoji: "➕", keywords: "new add create client person nouveau ajouter" },
  { id: "act-new-company",  category: "action", label: "New Company",             label_fr: "Nouvelle société",          sub: "Add a company to CRM",      screen: "societe",   emoji: "➕", keywords: "new add create company societe nouveau" },
  { id: "act-report",       category: "action", label: "View Reports",            label_fr: "Voir les rapports",         sub: "Analytics & statistics",    screen: "report",    emoji: "📈", keywords: "reports analytics view voir rapports stats" },
];

export function scoreItem(item: SearchItem, query: string): number {
  if (!query) return 1;
  const q = query.toLowerCase().trim();
  const label = item.label.toLowerCase();
  const keywords = item.keywords.toLowerCase();
  const sub = (item.sub ?? "").toLowerCase();
  const labelAr = (item.label_ar ?? "").toLowerCase();

  if (label === q) return 100;
  if (label.startsWith(q)) return 80;
  if (label.includes(q)) return 65;
  if (sub.includes(q)) return 55;
  if (labelAr.includes(q)) return 50;
  if (keywords.includes(q)) return 40;

  // All words match
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const allMatch = words.every(w => label.includes(w) || keywords.includes(w) || sub.includes(w));
    if (allMatch) return 45;
    const anyMatch = words.some(w => label.includes(w) || keywords.includes(w));
    if (anyMatch) return 20;
  }

  return 0;
}

export function searchItems(query: string): SearchItem[] {
  if (!query.trim()) return SEARCH_INDEX.slice(0, 8);
  return SEARCH_INDEX
    .map(item => ({ item, score: scoreItem(item, query) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item)
    .slice(0, 12);
}
