export type Lang = "ar" | "en" | "fr";

export type Translations = {
  // Language labels
  lang_ar: string; lang_en: string; lang_fr: string;

  // Sidebar
  workspace: string; logout: string; role: string;

  // Nav
  nav_dash: string; nav_prop: string; nav_crm: string;
  nav_contract: string; nav_rental: string; nav_realestate: string;
  nav_admin: string; nav_tourisme: string; nav_sante: string;
  nav_assurance: string; nav_banques: string; nav_amazon: string; nav_consultants: string;
  nav_visa: string;
  nav_clients: string; nav_personne: string; nav_societe: string;
  nav_orders: string;
  nav_travail: string;
  nav_callcenter: string;
  nav_erp: string; nav_workspace: string; nav_audit: string;
  nav_backoffice: string; nav_hr: string; nav_it: string; nav_finance: string; nav_marketing: string;
  nav_fournisseurs: string; nav_fournisseurs_fiches: string; nav_fournisseurs_validation: string;
  nav_news: string;
  nav_buildings: string;
  nav_units: string;
  nav_tenants: string;
  nav_owners: string;
  nav_owner_portal: string;
  nav_contracts_re: string;
  nav_payments: string;
  nav_cheques: string;
  nav_maintenance_re: string;
  nav_comms: string;
  nav_workflows: string;
  nav_branches: string;
  nav_documents: string;
  nav_re_settings: string;
  nav_parametres: string;
  nav_report: string;

  // Topbar
  search: string;

  // Screen titles
  t_dash: string; t_prop: string; t_crm: string;
  t_contract: string; t_rental: string; t_visa: string;
  t_finance: string; t_report: string;

  // Login form
  login_title: string; login_sub: string;
  login_label: string; login_ph: string;
  pass_label: string; forgot: string;
  sign_in: string; signing_in: string;
  keep_signed: string; continue_ws: string;
  or: string; sso: string;
  need_access: string; contact_manager: string;
  error_creds: string;

  // Forgot password
  forgot_back: string; forgot_title: string; forgot_sub: string;
  email_label: string; email_ph: string;
  send_link: string; sending: string; remember_pw: string;

  // Sent confirmation
  sent_title: string; sent_sub: string;
  sent_link_valid: string; sent_no_email: string; sent_check_spam: string;
  resend: string; back_login: string;
  need_help: string; contact_support: string;

  // Left panel hero
  hero_eyebrow: string; hero_title: string; hero_sub: string;
  hero_s1_n: string; hero_s1_l: string;
  hero_s2_n: string; hero_s2_l: string;
  hero_s3_n: string; hero_s3_l: string;

  // Common
  add: string; export_btn: string; filter: string;
  view_all: string; save: string; cancel: string;
  new_btn: string; close_month: string; coming_soon: string;

  // Téléphonie / softphone
  tel_calls: string; tel_messages: string;
  tel_softphone: string; tel_extension: string; tel_secret: string;
  tel_connect: string; tel_disconnect: string; tel_connecting: string;
  tel_registered: string; tel_offline: string; tel_reg_failed: string;
  tel_incoming: string; tel_outgoing: string; tel_in_call: string; tel_on_hold: string;
  tel_answer: string; tel_hangup: string; tel_mute: string; tel_unmute: string;
  tel_hold: string; tel_resume: string; tel_keypad: string;
  tel_screen_pop: string; tel_no_match: string; tel_searching: string;
  tel_agent_status: string; tel_status_available: string; tel_status_busy: string;
  tel_status_wrap_up: string; tel_status_paused: string; tel_status_offline: string;
  tel_call_log: string; tel_direction: string; tel_inbound: string; tel_outbound: string;
  tel_internal: string; tel_duration: string; tel_dial: string; tel_dial_ph: string;
  tel_no_calls: string; tel_unknown_caller: string;
};

const ar: Translations = {
  lang_ar: "العربية", lang_en: "English", lang_fr: "Français",

  workspace: "مساحة العمل", logout: "تسجيل خروج", role: "المدير العام",

  nav_dash: "لوحة القيادة", nav_prop: "العقارات", nav_crm: "إدارة العملاء",
  nav_contract: "العقود", nav_rental: "الإيجارات", nav_realestate: "العقارات",
  nav_admin: "الإدارات", nav_tourisme: "السياحة", nav_sante: "الصحة",
  nav_assurance: "التأمين", nav_banques: "البنوك", nav_amazon: "أمازون", nav_consultants: "المستشارون",
  nav_visa: "التأشيرة الذهبية",
  nav_clients: "العملاء", nav_personne: "الأشخاص", nav_societe: "الشركات",
  nav_orders: "الطلبات",
  nav_travail: "التوظيف",
  nav_callcenter: "مركز الاتصال",
  nav_erp: "نظام ERP", nav_workspace: "بيئة العمل", nav_audit: "المراجعة",
  nav_backoffice: "الإدارة الداخلية", nav_hr: "الموارد البشرية", nav_it: "تقنية المعلومات", nav_finance: "المالية", nav_marketing: "التسويق",
  nav_fournisseurs: "المورّدون", nav_fournisseurs_fiches: "بطاقات المورّدين", nav_fournisseurs_validation: "اعتماد المورّدين",
  nav_news: "الأخبار",
  nav_buildings: "المباني",
  nav_units: "الوحدات",
  nav_tenants: "المستأجرون",
  nav_owners: "الملاك",
  nav_owner_portal: "بوابة المالك",
  nav_contracts_re: "العقود",
  nav_payments: "المدفوعات",
  nav_cheques: "الشيكات",
  nav_maintenance_re: "الصيانة",
  nav_comms: "التواصل",
  nav_workflows: "عمليات الموافقة",
  nav_branches: "الفروع",
  nav_documents: "المستندات",
  nav_re_settings: "إعدادات العقارات",
  nav_parametres: "الإعدادات",
  nav_report: "التقارير",

  search: "بحث...",

  t_dash: "لوحة القيادة", t_prop: "العقارات", t_crm: "إدارة العملاء · قائمة الأعمال",
  t_contract: "العقود", t_rental: "الإيجارات", t_visa: "التأشيرة الذهبية",
  t_finance: "المالية · الربع الثاني 2026", t_report: "التقارير",

  login_title: "تسجيل الدخول",
  login_sub: "مرحباً بعودتك إلى مساحة عمل SGI.",
  login_label: "اسم المستخدم", login_ph: "اسم.المستخدم",
  pass_label: "كلمة المرور", forgot: "نسيت؟",
  sign_in: "دخول", signing_in: "جارٍ الدخول...",
  keep_signed: "ابقَ متصلاً على هذا الجهاز",
  continue_ws: "متابعة إلى مساحة العمل",
  or: "أو", sso: "الدخول عبر Microsoft Entra",
  need_access: "تحتاج إلى وصول؟", contact_manager: "تواصل مع مديرك",
  error_creds: "بيانات غير صحيحة. جرّب login / password.",

  forgot_back: "العودة لتسجيل الدخول",
  forgot_title: "إعادة تعيين كلمة المرور",
  forgot_sub: "أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة التعيين خلال دقائق.",
  email_label: "البريد الإلكتروني", email_ph: "you@infinity.ae",
  send_link: "إرسال الرابط", sending: "جارٍ الإرسال...",
  remember_pw: "تذكرت كلمة المرور؟",

  sent_title: "تحقق من بريدك الإلكتروني",
  sent_sub: "أرسلنا رابط إعادة التعيين إلى",
  sent_link_valid: "الرابط صالح لمدة ٣٠ دقيقة.",
  sent_no_email: "لم تستلم البريد؟",
  sent_check_spam: "تحقق من مجلد الرسائل غير المرغوب فيها. إن استمرت المشكلة، تواصل مع مسؤول النظام.",
  resend: "إعادة الإرسال", back_login: "العودة لتسجيل الدخول",
  need_help: "تحتاج مساعدة؟", contact_support: "تواصل مع الدعم",

  hero_eyebrow: "إنفينيتي إنترناشيونال · منصة متكاملة 2026",
  hero_title: "كل خدماتك —",
  hero_sub: "إدارة العقارات، السياحة، الصحة، التأمين، البنوك، التجارة الإلكترونية، الاستشارات، الإدارات والتوظيف — من مساحة عمل واحدة لفريق إنفينيتي إنترناشيونال.",
  hero_s1_n: "9",         hero_s1_l: "قطاع رئيسي",
  hero_s2_n: "50+",       hero_s2_l: "وكيل ومستشار",
  hero_s3_n: "AED 24.5M", hero_s3_l: "حجم المعاملات الشهري",

  add: "إضافة", export_btn: "تصدير", filter: "تصفية",
  view_all: "عرض الكل", save: "حفظ", cancel: "إلغاء",
  new_btn: "جديد", close_month: "إغلاق الشهر", coming_soon: "قريباً",

  tel_calls: "المكالمات", tel_messages: "الرسائل",
  tel_softphone: "الهاتف البرمجي", tel_extension: "الرقم الداخلي", tel_secret: "كلمة السر",
  tel_connect: "اتصال", tel_disconnect: "قطع الاتصال", tel_connecting: "جارٍ الاتصال…",
  tel_registered: "متصل", tel_offline: "غير متصل", tel_reg_failed: "فشل التسجيل",
  tel_incoming: "مكالمة واردة", tel_outgoing: "مكالمة صادرة", tel_in_call: "في مكالمة", tel_on_hold: "قيد الانتظار",
  tel_answer: "رد", tel_hangup: "إنهاء", tel_mute: "كتم", tel_unmute: "إلغاء الكتم",
  tel_hold: "انتظار", tel_resume: "استئناف", tel_keypad: "لوحة الأرقام",
  tel_screen_pop: "بطاقة العميل", tel_no_match: "لا يوجد عميل مطابق", tel_searching: "جارٍ البحث…",
  tel_agent_status: "حالة الموظف", tel_status_available: "متاح", tel_status_busy: "مشغول",
  tel_status_wrap_up: "إنهاء", tel_status_paused: "متوقف مؤقتاً", tel_status_offline: "غير متصل",
  tel_call_log: "سجل المكالمات", tel_direction: "الاتجاه", tel_inbound: "واردة", tel_outbound: "صادرة",
  tel_internal: "داخلية", tel_duration: "المدة", tel_dial: "اتصال", tel_dial_ph: "أدخل الرقم…",
  tel_no_calls: "لا توجد مكالمات.", tel_unknown_caller: "متصل مجهول",
};

const en: Translations = {
  lang_ar: "العربية", lang_en: "English", lang_fr: "Français",

  workspace: "Workspace", logout: "Log out", role: "Managing Director",

  nav_dash: "Dashboard", nav_prop: "Properties", nav_crm: "CRM",
  nav_contract: "Contracts", nav_rental: "Rentals", nav_realestate: "Real Estate",
  nav_admin: "Administrations", nav_tourisme: "Tourism", nav_sante: "Health",
  nav_assurance: "Insurance", nav_banques: "Banks", nav_amazon: "Amazon", nav_consultants: "Consultants",
  nav_visa: "Golden Visa",
  nav_clients: "Clients", nav_personne: "Individuals", nav_societe: "Companies",
  nav_orders: "Orders",
  nav_travail: "Employment",
  nav_callcenter: "Call Center",
  nav_erp: "ERP", nav_workspace: "Workspace", nav_audit: "Audit",
  nav_backoffice: "Back Office", nav_hr: "HR", nav_it: "IT", nav_finance: "Finance", nav_marketing: "Marketing",
  nav_fournisseurs: "Suppliers", nav_fournisseurs_fiches: "Supplier records", nav_fournisseurs_validation: "Vendor approval",
  nav_news: "News",
  nav_buildings: "Buildings",
  nav_units: "Units",
  nav_tenants: "Tenants",
  nav_owners: "Owners",
  nav_owner_portal: "Owner Portal",
  nav_contracts_re: "Contracts",
  nav_payments: "Payments",
  nav_cheques: "Cheques",
  nav_maintenance_re: "Maintenance",
  nav_comms: "Communication",
  nav_workflows: "Validations",
  nav_branches: "Branches",
  nav_documents: "Documents",
  nav_re_settings: "Real Estate Settings",
  nav_parametres: "Settings",
  nav_report: "Reports",

  search: "Search…",

  t_dash: "Dashboard", t_prop: "Properties", t_crm: "CRM · Pipeline",
  t_contract: "Contracts", t_rental: "Rentals", t_visa: "Golden Visa",
  t_finance: "Finance · Q2 2026", t_report: "Reports",

  login_title: "Sign in",
  login_sub: "Welcome back to your SGI workspace.",
  login_label: "Login", login_ph: "your.login",
  pass_label: "Password", forgot: "Forgot?",
  sign_in: "Sign in", signing_in: "Signing in…",
  keep_signed: "Keep me signed in on this device",
  continue_ws: "Continue to workspace",
  or: "OR", sso: "Continue with Single Sign-On (Microsoft Entra)",
  need_access: "Need access?", contact_manager: "Contact your manager",
  error_creds: "Invalid credentials. Try login / password.",

  forgot_back: "Back to sign in",
  forgot_title: "Reset password",
  forgot_sub: "Enter your email address and we'll send you a reset link within a few minutes.",
  email_label: "Email address", email_ph: "you@infinity.ae",
  send_link: "Send reset link", sending: "Sending…",
  remember_pw: "Remember your password?",

  sent_title: "Check your inbox",
  sent_sub: "We sent a reset link to",
  sent_link_valid: "The link is valid for 30 minutes.",
  sent_no_email: "Don't see the email?",
  sent_check_spam: "Check your spam or junk folder. If the issue persists, contact your system administrator.",
  resend: "Resend email", back_login: "Back to login",
  need_help: "Need help?", contact_support: "Contact support",

  hero_eyebrow: "Infinity International · Integrated Platform 2026",
  hero_title: "All your services —",
  hero_sub: "Real estate, tourism, health, insurance, banking, e-commerce, consulting, administration and employment — one workspace for the Infinity International team.",
  hero_s1_n: "9",         hero_s1_l: "Core sectors",
  hero_s2_n: "50+",       hero_s2_l: "Agents & consultants",
  hero_s3_n: "AED 24.5M", hero_s3_l: "Monthly volume",

  add: "Add", export_btn: "Export", filter: "Filter",
  view_all: "View all", save: "Save", cancel: "Cancel",
  new_btn: "New", close_month: "Close month", coming_soon: "Coming soon",

  tel_calls: "Calls", tel_messages: "Messages",
  tel_softphone: "Softphone", tel_extension: "Extension", tel_secret: "Secret",
  tel_connect: "Connect", tel_disconnect: "Disconnect", tel_connecting: "Connecting…",
  tel_registered: "Registered", tel_offline: "Offline", tel_reg_failed: "Registration failed",
  tel_incoming: "Incoming call", tel_outgoing: "Outgoing call", tel_in_call: "In call", tel_on_hold: "On hold",
  tel_answer: "Answer", tel_hangup: "Hang up", tel_mute: "Mute", tel_unmute: "Unmute",
  tel_hold: "Hold", tel_resume: "Resume", tel_keypad: "Keypad",
  tel_screen_pop: "Caller", tel_no_match: "No matching client", tel_searching: "Searching…",
  tel_agent_status: "Agent status", tel_status_available: "Available", tel_status_busy: "Busy",
  tel_status_wrap_up: "Wrap-up", tel_status_paused: "Paused", tel_status_offline: "Offline",
  tel_call_log: "Call log", tel_direction: "Direction", tel_inbound: "Inbound", tel_outbound: "Outbound",
  tel_internal: "Internal", tel_duration: "Duration", tel_dial: "Dial", tel_dial_ph: "Enter a number…",
  tel_no_calls: "No calls.", tel_unknown_caller: "Unknown caller",
};

const fr: Translations = {
  lang_ar: "العربية", lang_en: "English", lang_fr: "Français",

  workspace: "Espace de travail", logout: "Se déconnecter", role: "Directeur Général",

  nav_dash: "Tableau de bord", nav_prop: "Propriétés", nav_crm: "CRM",
  nav_contract: "Contrats", nav_rental: "Locations", nav_realestate: "Immobilier",
  nav_admin: "Administrations", nav_tourisme: "Tourisme", nav_sante: "Santé",
  nav_assurance: "Assurance", nav_banques: "Banques", nav_amazon: "Amazone", nav_consultants: "Consultants",
  nav_visa: "Visa Doré",
  nav_clients: "Clients", nav_personne: "Personnes", nav_societe: "Sociétés",
  nav_orders: "Commandes",
  nav_travail: "Travail",
  nav_callcenter: "Call Center",
  nav_erp: "ERP", nav_workspace: "Espace de travail", nav_audit: "Audit",
  nav_backoffice: "Back Office", nav_hr: "RH", nav_it: "IT", nav_finance: "Finance", nav_marketing: "Marketing",
  nav_fournisseurs: "Fournisseurs", nav_fournisseurs_fiches: "Fiches fournisseurs", nav_fournisseurs_validation: "Validation fournisseurs",
  nav_news: "Actualités",
  nav_buildings: "Bâtiments",
  nav_units: "Unités",
  nav_tenants: "Locataires",
  nav_owners: "Propriétaires",
  nav_owner_portal: "Portail Propriétaire",
  nav_contracts_re: "Contrats",
  nav_payments: "Paiements",
  nav_cheques: "Chèques",
  nav_maintenance_re: "Maintenance",
  nav_comms: "Communication",
  nav_workflows: "Validations",
  nav_branches: "Succursales",
  nav_documents: "Documents",
  nav_re_settings: "Paramètres Immobilier",
  nav_parametres: "Paramètres",
  nav_report: "Rapports",

  search: "Rechercher…",

  t_dash: "Tableau de bord", t_prop: "Propriétés", t_crm: "CRM · Pipeline",
  t_contract: "Contrats", t_rental: "Locations", t_visa: "Visa Doré",
  t_finance: "Finance · T2 2026", t_report: "Rapports",

  login_title: "Connexion",
  login_sub: "Bon retour dans votre espace de travail SGI.",
  login_label: "Identifiant", login_ph: "votre.identifiant",
  pass_label: "Mot de passe", forgot: "Oublié ?",
  sign_in: "Se connecter", signing_in: "Connexion en cours…",
  keep_signed: "Rester connecté sur cet appareil",
  continue_ws: "Accéder à l'espace de travail",
  or: "OU", sso: "Connexion SSO (Microsoft Entra)",
  need_access: "Besoin d'un accès ?", contact_manager: "Contacter votre manager",
  error_creds: "Identifiants incorrects. Essayez login / password.",

  forgot_back: "Retour à la connexion",
  forgot_title: "Réinitialiser le mot de passe",
  forgot_sub: "Entrez votre adresse e-mail et nous vous enverrons un lien de réinitialisation.",
  email_label: "Adresse e-mail", email_ph: "vous@infinity.ae",
  send_link: "Envoyer le lien", sending: "Envoi en cours…",
  remember_pw: "Vous souvenez-vous de votre mot de passe ?",

  sent_title: "Vérifiez votre boîte mail",
  sent_sub: "Nous avons envoyé un lien à",
  sent_link_valid: "Le lien est valable 30 minutes.",
  sent_no_email: "Vous ne voyez pas l'e-mail ?",
  sent_check_spam: "Vérifiez votre dossier spam. Si le problème persiste, contactez votre administrateur.",
  resend: "Renvoyer l'e-mail", back_login: "Retour à la connexion",
  need_help: "Besoin d'aide ?", contact_support: "Contacter le support",

  hero_eyebrow: "Infinity International · Plateforme intégrée 2026",
  hero_title: "Tous vos services —",
  hero_sub: "Immobilier, tourisme, santé, assurance, banques, e-commerce, consulting, administrations et emploi — un seul espace de travail pour l'équipe Infinity International.",
  hero_s1_n: "9",         hero_s1_l: "Secteurs principaux",
  hero_s2_n: "50+",       hero_s2_l: "Agents & consultants",
  hero_s3_n: "AED 24,5M", hero_s3_l: "Volume mensuel",

  add: "Ajouter", export_btn: "Exporter", filter: "Filtrer",
  view_all: "Voir tout", save: "Enregistrer", cancel: "Annuler",
  new_btn: "Nouveau", close_month: "Clôturer le mois", coming_soon: "Prochainement",

  tel_calls: "Appels", tel_messages: "Messages",
  tel_softphone: "Softphone", tel_extension: "Extension", tel_secret: "Secret",
  tel_connect: "Connecter", tel_disconnect: "Déconnecter", tel_connecting: "Connexion…",
  tel_registered: "Enregistré", tel_offline: "Hors-ligne", tel_reg_failed: "Échec d'enregistrement",
  tel_incoming: "Appel entrant", tel_outgoing: "Appel sortant", tel_in_call: "En communication", tel_on_hold: "En attente",
  tel_answer: "Répondre", tel_hangup: "Raccrocher", tel_mute: "Couper le micro", tel_unmute: "Réactiver le micro",
  tel_hold: "Mettre en attente", tel_resume: "Reprendre", tel_keypad: "Clavier",
  tel_screen_pop: "Appelant", tel_no_match: "Aucun client correspondant", tel_searching: "Recherche…",
  tel_agent_status: "Statut agent", tel_status_available: "Disponible", tel_status_busy: "Occupé",
  tel_status_wrap_up: "Clôture", tel_status_paused: "En pause", tel_status_offline: "Hors-ligne",
  tel_call_log: "Journal d'appels", tel_direction: "Sens", tel_inbound: "Entrant", tel_outbound: "Sortant",
  tel_internal: "Interne", tel_duration: "Durée", tel_dial: "Appeler", tel_dial_ph: "Saisir un numéro…",
  tel_no_calls: "Aucun appel.", tel_unknown_caller: "Appelant inconnu",
};

export const T: Record<Lang, Translations> = { ar, en, fr };
