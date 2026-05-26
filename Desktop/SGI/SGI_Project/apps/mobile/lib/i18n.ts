/**
 * i18n SGI Mobile — AR / EN / FR avec RTL automatique.
 */
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";
import * as SecureStore from "expo-secure-store";

const ar = {
  // Navigation
  nav_dashboard: "لوحة التحكم",
  nav_properties: "العقارات",
  nav_crm: "إدارة العملاء",
  nav_clients: "العملاء",
  nav_notifications: "الإشعارات",
  nav_profile: "الملف الشخصي",
  // Auth
  login_title: "تسجيل الدخول",
  login_email: "البريد الإلكتروني",
  login_password: "كلمة المرور",
  login_btn: "دخول",
  login_error: "بيانات اعتماد غير صحيحة",
  // Properties
  prop_search: "بحث في العقارات…",
  prop_available: "متاح",
  prop_sold: "مباع",
  prop_rented: "مؤجر",
  prop_reserved: "محجوز",
  prop_under_offer: "تحت العرض",
  prop_beds: "غرف",
  prop_baths: "حمامات",
  prop_area: "م²",
  prop_featured: "مميز",
  prop_aed: "درهم",
  // CRM
  crm_pipeline: "خط الأنابيب",
  crm_new: "جديد",
  crm_contacted: "تم التواصل",
  crm_qualified: "مؤهل",
  crm_proposal: "عرض مُرسَل",
  crm_won: "مُبرَم",
  crm_lost: "خُسِر",
  crm_score: "نقاط",
  crm_budget: "الميزانية",
  crm_add_activity: "إضافة نشاط",
  // Clients
  client_individual: "أفراد",
  client_company: "شركات",
  client_search: "بحث عن عميل…",
  // Common
  search: "بحث",
  filter: "تصفية",
  add: "إضافة",
  save: "حفظ",
  cancel: "إلغاء",
  delete: "حذف",
  edit: "تعديل",
  loading: "جارٍ التحميل…",
  no_results: "لا توجد نتائج",
  error_generic: "حدث خطأ ما",
  logout: "تسجيل خروج",
  aed: "د.إ",
};

const en = {
  nav_dashboard: "Dashboard",
  nav_properties: "Properties",
  nav_crm: "CRM",
  nav_clients: "Clients",
  nav_notifications: "Notifications",
  nav_profile: "Profile",
  login_title: "Sign In",
  login_email: "Email",
  login_password: "Password",
  login_btn: "Sign In",
  login_error: "Invalid credentials",
  prop_search: "Search properties…",
  prop_available: "Available",
  prop_sold: "Sold",
  prop_rented: "Rented",
  prop_reserved: "Reserved",
  prop_under_offer: "Under Offer",
  prop_beds: "beds",
  prop_baths: "baths",
  prop_area: "sqm",
  prop_featured: "Featured",
  prop_aed: "AED",
  crm_pipeline: "Pipeline",
  crm_new: "New",
  crm_contacted: "Contacted",
  crm_qualified: "Qualified",
  crm_proposal: "Proposal Sent",
  crm_won: "Won",
  crm_lost: "Lost",
  crm_score: "Score",
  crm_budget: "Budget",
  crm_add_activity: "Add Activity",
  client_individual: "Individuals",
  client_company: "Companies",
  client_search: "Search clients…",
  search: "Search",
  filter: "Filter",
  add: "Add",
  save: "Save",
  cancel: "Cancel",
  delete: "Delete",
  edit: "Edit",
  loading: "Loading…",
  no_results: "No results",
  error_generic: "Something went wrong",
  logout: "Log out",
  aed: "AED",
};

const fr = {
  nav_dashboard: "Tableau de bord",
  nav_properties: "Propriétés",
  nav_crm: "CRM",
  nav_clients: "Clients",
  nav_notifications: "Notifications",
  nav_profile: "Profil",
  login_title: "Connexion",
  login_email: "E-mail",
  login_password: "Mot de passe",
  login_btn: "Se connecter",
  login_error: "Identifiants incorrects",
  prop_search: "Rechercher des biens…",
  prop_available: "Disponible",
  prop_sold: "Vendu",
  prop_rented: "Loué",
  prop_reserved: "Réservé",
  prop_under_offer: "Sous offre",
  prop_beds: "ch.",
  prop_baths: "sdb",
  prop_area: "m²",
  prop_featured: "En vedette",
  prop_aed: "AED",
  crm_pipeline: "Pipeline",
  crm_new: "Nouveau",
  crm_contacted: "Contacté",
  crm_qualified: "Qualifié",
  crm_proposal: "Offre envoyée",
  crm_won: "Gagné",
  crm_lost: "Perdu",
  crm_score: "Score",
  crm_budget: "Budget",
  crm_add_activity: "Ajouter activité",
  client_individual: "Particuliers",
  client_company: "Sociétés",
  client_search: "Rechercher un client…",
  search: "Rechercher",
  filter: "Filtrer",
  add: "Ajouter",
  save: "Enregistrer",
  cancel: "Annuler",
  delete: "Supprimer",
  edit: "Modifier",
  loading: "Chargement…",
  no_results: "Aucun résultat",
  error_generic: "Une erreur est survenue",
  logout: "Se déconnecter",
  aed: "AED",
};

export type TranslationKey = keyof typeof en;

i18n.use(initReactI18next).init({
  resources: {
    ar: { translation: ar },
    en: { translation: en },
    fr: { translation: fr },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export async function loadSavedLanguage() {
  const saved = await SecureStore.getItemAsync("sgi_lang");
  const lang = saved ?? "en";
  await i18n.changeLanguage(lang);
  const isRTL = lang === "ar";
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
}

export async function setLanguage(lang: "ar" | "en" | "fr") {
  await SecureStore.setItemAsync("sgi_lang", lang);
  await i18n.changeLanguage(lang);
  const isRTL = lang === "ar";
  I18nManager.allowRTL(isRTL);
  I18nManager.forceRTL(isRTL);
}

export default i18n;
