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
  loading: string; error_label: string;

  // Real Estate Settings screen
  set_sec_vat: string; set_sec_loc: string; set_sec_compliance: string; set_sec_refs: string;
  set_currency: string; set_vat_enabled: string; set_vat_rate: string;
  set_default_emirate: string; set_timezone: string;
  set_ejari_enabled: string; set_dld_enabled: string;
  set_invoice_prefix: string; set_contract_prefix: string;
  set_payment_terms_days: string; set_fiscal_year_start: string;

  // Common table / list
  col_reference: string; col_type: string; col_status: string; col_emirate: string; col_name: string;
  count_buildings: string; count_units: string; empty_buildings: string; empty_units: string;
  field_name: string; field_emirate: string;

  // Building types
  bt_residential_tower: string; bt_villa_compound: string; bt_mixed_use: string;
  bt_commercial: string; bt_warehouse: string;
  // Building status
  bs_operational: string; bs_under_renovation: string; bs_off_market: string; bs_demolished: string;
  // Buildings form
  bld_new: string; bld_ref_required: string;

  // Units — types
  ut_studio: string; ut_1br: string; ut_2br: string; ut_3br: string; ut_4br_plus: string;
  ut_penthouse: string; ut_duplex: string; ut_villa: string; ut_townhouse: string;
  ut_office: string; ut_shop: string; ut_warehouse: string; ut_other: string;
  // Units — status
  us_vacant: string; us_reserved: string; us_occupied: string;
  us_maintenance: string; us_renovation: string; us_off_market: string;
  // Units — list/form
  col_unit_number: string; col_rent_year: string; col_action: string;
  units_vacant_count: string; unit_status_refused: string; action_change: string;
  unit_new: string; field_building: string; field_unit_number: string; select_placeholder: string;
  unit_building_required: string; unit_number_required: string;

  // PDC cheques — status
  ps_pending: string; ps_deposited: string; ps_cleared: string;
  ps_bounced: string; ps_replaced: string; ps_cancelled: string;
  // PDC — columns / list / actions
  col_cheque_number: string; col_bank: string; col_amount: string; col_due_date: string;
  count_cheques: string; outstanding_label: string; empty_cheques: string; action_refused: string;
  pdc_deposit: string; pdc_clear: string; pdc_bounce: string; pdc_replace: string;
  pdc_bounce_reason: string;
  // PDC — replace modal
  pdc_replace_title: string; pdc_new_cheque_number: string; field_bank: string;
  field_branch_opt: string; field_amount_aed: string; pdc_new_due_date: string;
  // Lot 2 — communs
  field_client: string; field_property: string; invalid_amount: string; select_client_required: string;
  // Lot 2 — contracts
  ct_draft: string; ct_signed: string; ct_active: string; ct_expired: string; ct_cancelled: string;
  count_contracts: string; empty_contracts: string; col_signature: string;
  contract_type_rental: string; contract_type_sale: string;
  ct_renew: string; ct_request_signature: string; ct_sync_signature: string; contract_new: string;
  ct_client_property_required: string; ct_request_signature_title: string; ct_document_to_sign: string;
  ct_loading_documents: string; ct_no_linked_documents: string; ct_select_document: string;
  // Lot 2 — tenants
  tn_candidate: string; tn_active: string; tn_former: string; tn_blacklisted: string;
  kyc_not_started: string; kyc_pending: string; kyc_verified: string; kyc_rejected: string;
  visa_expired: string; visa_30d: string; visa_90d: string; kyc_reject_reason: string; kyc_verified_count: string;
  col_tenant: string; col_lifecycle: string; col_loyalty: string; col_kyc_action: string; empty_tenants: string;
  kyc_submit: string; kyc_verify: string; kyc_reject: string; tenant_new: string;
  // Lot 2 — owners
  payout_bank_transfer: string; payout_cheque: string; payout_cash: string;
  mandate_expired: string; mandate_jminus_prefix: string; count_owners: string;
  col_owner: string; col_mandate: string; col_commission: string; col_payout: string; col_mandate_due: string; col_statement: string;
  empty_owners: string; owner_generate_statement: string; owner_new: string;
  field_mandate_reference: string; field_mandate_commission: string;
  // Lot 2 — payments
  pt_rent: string; pt_charges: string; pt_deposit: string; pt_deposit_return: string; pt_owner_payout: string; pt_other: string;
  pay_pending: string; pay_paid: string; pay_overdue: string; pay_cancelled: string;
  payments_overdue_count: string; empty_payments: string; pay_collect: string;
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
  loading: "جارٍ التحميل…", error_label: "خطأ",

  set_sec_vat: "الضريبة والعملة", set_sec_loc: "الموقع",
  set_sec_compliance: "الامتثال (الإمارات)", set_sec_refs: "المراجع والمدفوعات",
  set_currency: "العملة", set_vat_enabled: "تفعيل ضريبة القيمة المضافة",
  set_vat_rate: "نسبة الضريبة (%)",
  set_default_emirate: "الإمارة الافتراضية", set_timezone: "المنطقة الزمنية",
  set_ejari_enabled: "تفعيل إيجاري", set_dld_enabled: "تفعيل دائرة الأراضي",
  set_invoice_prefix: "بادئة الفاتورة", set_contract_prefix: "بادئة العقد",
  set_payment_terms_days: "مهلة السداد (أيام)", set_fiscal_year_start: "شهر بداية السنة المالية",

  col_reference: "المرجع", col_type: "النوع", col_status: "الحالة", col_emirate: "الإمارة", col_name: "الاسم",
  count_buildings: "مبنى", count_units: "وحدة", empty_buildings: "لا توجد مبانٍ.", empty_units: "لا توجد وحدات.",
  field_name: "الاسم", field_emirate: "الإمارة",

  bt_residential_tower: "برج سكني", bt_villa_compound: "مجمع فلل", bt_mixed_use: "استخدام مختلط",
  bt_commercial: "تجاري", bt_warehouse: "مستودع",
  bs_operational: "تشغيلي", bs_under_renovation: "قيد التجديد", bs_off_market: "خارج السوق", bs_demolished: "مهدوم",
  bld_new: "مبنى جديد", bld_ref_required: "المرجع إلزامي.",

  ut_studio: "استوديو", ut_1br: "شقة غرفة", ut_2br: "شقة غرفتين", ut_3br: "شقة 3 غرف", ut_4br_plus: "شقة 4 غرف+",
  ut_penthouse: "بنتهاوس", ut_duplex: "دوبلكس", ut_villa: "فيلا", ut_townhouse: "تاون هاوس",
  ut_office: "مكتب", ut_shop: "محل", ut_warehouse: "مستودع", ut_other: "أخرى",
  us_vacant: "شاغر", us_reserved: "محجوز", us_occupied: "مشغول",
  us_maintenance: "صيانة", us_renovation: "تجديد", us_off_market: "خارج السوق",
  col_unit_number: "رقم الوحدة", col_rent_year: "الإيجار / سنة", col_action: "إجراء",
  units_vacant_count: "شاغرة", unit_status_refused: "رُفض تغيير الحالة", action_change: "تغيير ←",
  unit_new: "وحدة جديدة", field_building: "المبنى", field_unit_number: "رقم الوحدة", select_placeholder: "— اختر —",
  unit_building_required: "اختر مبنى.", unit_number_required: "رقم الوحدة إلزامي.",

  ps_pending: "للإيداع", ps_deposited: "مُودع", ps_cleared: "مُحصّل",
  ps_bounced: "مرتجع", ps_replaced: "مُستبدل", ps_cancelled: "مُلغى",
  col_cheque_number: "رقم الشيك", col_bank: "البنك", col_amount: "المبلغ", col_due_date: "تاريخ الاستحقاق",
  count_cheques: "شيك", outstanding_label: "المستحق", empty_cheques: "لا توجد شيكات.", action_refused: "رُفض الإجراء",
  pdc_deposit: "إيداع", pdc_clear: "تحصيل", pdc_bounce: "رفض", pdc_replace: "استبدال",
  pdc_bounce_reason: "سبب رفض الشيك؟",
  pdc_replace_title: "استبدال", pdc_new_cheque_number: "رقم الشيك الجديد", field_bank: "البنك",
  field_branch_opt: "الفرع (اختياري)", field_amount_aed: "المبلغ (درهم)", pdc_new_due_date: "تاريخ استحقاق جديد",
  // Lot 2 — communs
  field_client: "العميل", field_property: "العقار", invalid_amount: "مبلغ غير صالح.", select_client_required: "اختر عميلاً.",
  // Lot 2 — contracts
  ct_draft: "مسودة", ct_signed: "موقّع", ct_active: "نشط", ct_expired: "منتهٍ", ct_cancelled: "ملغى",
  count_contracts: "عقد", empty_contracts: "لا عقود.", col_signature: "التوقيع",
  contract_type_rental: "إيجار", contract_type_sale: "بيع",
  ct_renew: "تجديد", ct_request_signature: "طلب التوقيع", ct_sync_signature: "مزامنة التوقيع", contract_new: "عقد جديد",
  ct_client_property_required: "العميل والعقار مطلوبان.", ct_request_signature_title: "طلب التوقيع —", ct_document_to_sign: "المستند المراد توقيعه",
  ct_loading_documents: "جارٍ تحميل المستندات…", ct_no_linked_documents: "لا توجد مستندات مرتبطة بهذا العقد. أضف واحدًا في قسم المستندات.", ct_select_document: "اختر مستندًا.",
  // Lot 2 — tenants
  tn_candidate: "مرشّح", tn_active: "نشط", tn_former: "سابق", tn_blacklisted: "محظور",
  kyc_not_started: "لم يبدأ", kyc_pending: "قيد المراجعة", kyc_verified: "مُتحقق", kyc_rejected: "مرفوض",
  visa_expired: "تأشيرة منتهية", visa_30d: "تأشيرة ≤30ي", visa_90d: "تأشيرة ≤90ي", kyc_reject_reason: "سبب رفض KYC؟", kyc_verified_count: "تحقق KYC",
  col_tenant: "المستأجر", col_lifecycle: "دورة الحياة", col_loyalty: "الولاء", col_kyc_action: "KYC — إجراء", empty_tenants: "لا مستأجرين.",
  kyc_submit: "إرسال", kyc_verify: "تحقق", kyc_reject: "رفض", tenant_new: "مستأجر جديد",
  // Lot 2 — owners
  payout_bank_transfer: "تحويل بنكي", payout_cheque: "شيك", payout_cash: "نقدًا",
  mandate_expired: "تفويض منتهٍ", mandate_jminus_prefix: "تفويض ي-", count_owners: "مالك",
  col_owner: "المالك", col_mandate: "التفويض", col_commission: "العمولة", col_payout: "الدفع", col_mandate_due: "انتهاء التفويض", col_statement: "كشف",
  empty_owners: "لا ملاك.", owner_generate_statement: "إنشاء (الشهر الحالي)", owner_new: "مالك جديد",
  field_mandate_reference: "مرجع التفويض", field_mandate_commission: "عمولة التفويض (%)",
  // Lot 2 — payments
  pt_rent: "إيجار", pt_charges: "رسوم", pt_deposit: "تأمين", pt_deposit_return: "إعادة التأمين", pt_owner_payout: "دفع للمالك", pt_other: "أخرى",
  pay_pending: "قيد الانتظار", pay_paid: "مدفوع", pay_overdue: "متأخر", pay_cancelled: "ملغى",
  payments_overdue_count: "متأخر", empty_payments: "لا طلبات دفع.", pay_collect: "تحصيل",
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
  loading: "Loading…", error_label: "Error",

  set_sec_vat: "VAT & Currency", set_sec_loc: "Localization",
  set_sec_compliance: "UAE Compliance", set_sec_refs: "References & Payments",
  set_currency: "Currency", set_vat_enabled: "VAT enabled",
  set_vat_rate: "VAT rate (%)",
  set_default_emirate: "Default emirate", set_timezone: "Timezone",
  set_ejari_enabled: "Ejari enabled", set_dld_enabled: "DLD enabled",
  set_invoice_prefix: "Invoice prefix", set_contract_prefix: "Contract prefix",
  set_payment_terms_days: "Payment terms (days)", set_fiscal_year_start: "Fiscal year start month",

  col_reference: "Reference", col_type: "Type", col_status: "Status", col_emirate: "Emirate", col_name: "Name",
  count_buildings: "building(s)", count_units: "unit(s)", empty_buildings: "No buildings.", empty_units: "No units.",
  field_name: "Name", field_emirate: "Emirate",

  bt_residential_tower: "Residential tower", bt_villa_compound: "Villa compound", bt_mixed_use: "Mixed use",
  bt_commercial: "Commercial", bt_warehouse: "Warehouse",
  bs_operational: "Operational", bs_under_renovation: "Renovation", bs_off_market: "Off market", bs_demolished: "Demolished",
  bld_new: "New building", bld_ref_required: "Reference is required.",

  ut_studio: "Studio", ut_1br: "1BR apt.", ut_2br: "2BR apt.", ut_3br: "3BR apt.", ut_4br_plus: "4BR+ apt.",
  ut_penthouse: "Penthouse", ut_duplex: "Duplex", ut_villa: "Villa", ut_townhouse: "Townhouse",
  ut_office: "Office", ut_shop: "Shop", ut_warehouse: "Warehouse", ut_other: "Other",
  us_vacant: "Vacant", us_reserved: "Reserved", us_occupied: "Occupied",
  us_maintenance: "Maintenance", us_renovation: "Renovation", us_off_market: "Off market",
  col_unit_number: "Unit no.", col_rent_year: "Rent / year", col_action: "Action",
  units_vacant_count: "vacant", unit_status_refused: "Status change refused", action_change: "Change →",
  unit_new: "New unit", field_building: "Building", field_unit_number: "Unit number", select_placeholder: "— Select —",
  unit_building_required: "Select a building.", unit_number_required: "Unit number is required.",

  ps_pending: "To deposit", ps_deposited: "Deposited", ps_cleared: "Cleared",
  ps_bounced: "Bounced", ps_replaced: "Replaced", ps_cancelled: "Cancelled",
  col_cheque_number: "Cheque no.", col_bank: "Bank", col_amount: "Amount", col_due_date: "Due date",
  count_cheques: "cheque(s)", outstanding_label: "outstanding", empty_cheques: "No cheques.", action_refused: "Action refused",
  pdc_deposit: "Deposit", pdc_clear: "Cleared", pdc_bounce: "Bounced", pdc_replace: "Replace",
  pdc_bounce_reason: "Cheque bounce reason?",
  pdc_replace_title: "Replace", pdc_new_cheque_number: "New cheque number", field_bank: "Bank",
  field_branch_opt: "Branch (optional)", field_amount_aed: "Amount (AED)", pdc_new_due_date: "New due date",
  // Lot 2 — communs
  field_client: "Client", field_property: "Property", invalid_amount: "Invalid amount.", select_client_required: "Select a client.",
  // Lot 2 — contracts
  ct_draft: "Draft", ct_signed: "Signed", ct_active: "Active", ct_expired: "Expired", ct_cancelled: "Cancelled",
  count_contracts: "contract(s)", empty_contracts: "No contracts.", col_signature: "Signature",
  contract_type_rental: "Rental", contract_type_sale: "Sale",
  ct_renew: "Renew", ct_request_signature: "Request signature", ct_sync_signature: "Sync sign.", contract_new: "New contract",
  ct_client_property_required: "Client and property required.", ct_request_signature_title: "Request signature —", ct_document_to_sign: "Document to sign",
  ct_loading_documents: "Loading documents…", ct_no_linked_documents: "No documents linked to this contract. Add one in the Documents subsection.", ct_select_document: "Select a document.",
  // Lot 2 — tenants
  tn_candidate: "Candidate", tn_active: "Active", tn_former: "Former", tn_blacklisted: "Blacklisted",
  kyc_not_started: "Not started", kyc_pending: "Under review", kyc_verified: "Verified", kyc_rejected: "Rejected",
  visa_expired: "Visa expired", visa_30d: "Visa ≤30d", visa_90d: "Visa ≤90d", kyc_reject_reason: "KYC rejection reason?", kyc_verified_count: "KYC verified",
  col_tenant: "Tenant", col_lifecycle: "Lifecycle", col_loyalty: "Loyalty", col_kyc_action: "KYC — Action", empty_tenants: "No tenants.",
  kyc_submit: "Submit", kyc_verify: "Verify", kyc_reject: "Reject", tenant_new: "New tenant",
  // Lot 2 — owners
  payout_bank_transfer: "Bank transfer", payout_cheque: "Cheque", payout_cash: "Cash",
  mandate_expired: "Mandate expired", mandate_jminus_prefix: "Mandate D-", count_owners: "owner(s)",
  col_owner: "Owner", col_mandate: "Mandate", col_commission: "Commission", col_payout: "Payout", col_mandate_due: "Mandate due", col_statement: "Statement",
  empty_owners: "No owners.", owner_generate_statement: "Generate (current month)", owner_new: "New owner",
  field_mandate_reference: "Mandate reference", field_mandate_commission: "Mandate commission (%)",
  // Lot 2 — payments
  pt_rent: "Rent", pt_charges: "Charges", pt_deposit: "Deposit", pt_deposit_return: "Deposit return", pt_owner_payout: "Owner payout", pt_other: "Other",
  pay_pending: "Pending", pay_paid: "Paid", pay_overdue: "Overdue", pay_cancelled: "Cancelled",
  payments_overdue_count: "overdue", empty_payments: "No payment requests.", pay_collect: "Collect",
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
  loading: "Chargement…", error_label: "Erreur",

  set_sec_vat: "TVA & Devise", set_sec_loc: "Localisation",
  set_sec_compliance: "Conformité UAE", set_sec_refs: "Références & Paiements",
  set_currency: "Devise", set_vat_enabled: "TVA activée",
  set_vat_rate: "Taux de TVA (%)",
  set_default_emirate: "Émirat par défaut", set_timezone: "Fuseau horaire",
  set_ejari_enabled: "Ejari activé", set_dld_enabled: "DLD activé",
  set_invoice_prefix: "Préfixe facture", set_contract_prefix: "Préfixe contrat",
  set_payment_terms_days: "Délai de paiement (jours)", set_fiscal_year_start: "Mois de début d'exercice",

  col_reference: "Référence", col_type: "Type", col_status: "Statut", col_emirate: "Émirat", col_name: "Nom",
  count_buildings: "bâtiment(s)", count_units: "unité(s)", empty_buildings: "Aucun bâtiment.", empty_units: "Aucune unité.",
  field_name: "Nom", field_emirate: "Émirat",

  bt_residential_tower: "Tour résidentielle", bt_villa_compound: "Compound villas", bt_mixed_use: "Usage mixte",
  bt_commercial: "Commercial", bt_warehouse: "Entrepôt",
  bs_operational: "Opérationnel", bs_under_renovation: "Rénovation", bs_off_market: "Hors marché", bs_demolished: "Démoli",
  bld_new: "Nouveau bâtiment", bld_ref_required: "La référence est obligatoire.",

  ut_studio: "Studio", ut_1br: "Appart. 1ch", ut_2br: "Appart. 2ch", ut_3br: "Appart. 3ch", ut_4br_plus: "Appart. 4ch+",
  ut_penthouse: "Penthouse", ut_duplex: "Duplex", ut_villa: "Villa", ut_townhouse: "Townhouse",
  ut_office: "Bureau", ut_shop: "Local", ut_warehouse: "Entrepôt", ut_other: "Autre",
  us_vacant: "Vacant", us_reserved: "Réservé", us_occupied: "Occupé",
  us_maintenance: "Maintenance", us_renovation: "Rénovation", us_off_market: "Hors marché",
  col_unit_number: "N° Unité", col_rent_year: "Loyer / an", col_action: "Action",
  units_vacant_count: "vacant(s)", unit_status_refused: "Changement de statut refusé", action_change: "Changer →",
  unit_new: "Nouvelle unité", field_building: "Bâtiment", field_unit_number: "N° d'unité", select_placeholder: "— Sélectionner —",
  unit_building_required: "Sélectionnez un bâtiment.", unit_number_required: "Le numéro d'unité est obligatoire.",

  ps_pending: "À déposer", ps_deposited: "Déposé", ps_cleared: "Encaissé",
  ps_bounced: "Rejeté", ps_replaced: "Remplacé", ps_cancelled: "Annulé",
  col_cheque_number: "N° chèque", col_bank: "Banque", col_amount: "Montant", col_due_date: "Échéance",
  count_cheques: "chèque(s)", outstanding_label: "encours", empty_cheques: "Aucun chèque.", action_refused: "Action refusée",
  pdc_deposit: "Déposer", pdc_clear: "Encaissé", pdc_bounce: "Rejeté", pdc_replace: "Remplacer",
  pdc_bounce_reason: "Motif du rejet du chèque ?",
  pdc_replace_title: "Remplacer", pdc_new_cheque_number: "N° du nouveau chèque", field_bank: "Banque",
  field_branch_opt: "Agence (optionnel)", field_amount_aed: "Montant (AED)", pdc_new_due_date: "Nouvelle échéance",
  // Lot 2 — communs
  field_client: "Client", field_property: "Bien", invalid_amount: "Montant invalide.", select_client_required: "Sélectionnez un client.",
  // Lot 2 — contracts
  ct_draft: "Brouillon", ct_signed: "Signé", ct_active: "Actif", ct_expired: "Expiré", ct_cancelled: "Annulé",
  count_contracts: "contrat(s)", empty_contracts: "Aucun contrat.", col_signature: "Signature",
  contract_type_rental: "Location", contract_type_sale: "Vente",
  ct_renew: "Renouveler", ct_request_signature: "Demander signature", ct_sync_signature: "Sync sign.", contract_new: "Nouveau contrat",
  ct_client_property_required: "Client et bien obligatoires.", ct_request_signature_title: "Demander signature —", ct_document_to_sign: "Document à signer",
  ct_loading_documents: "Chargement des documents…", ct_no_linked_documents: "Aucun document lié à ce contrat. Ajoutez-en un dans la sous-catégorie Documents.", ct_select_document: "Sélectionnez un document.",
  // Lot 2 — tenants
  tn_candidate: "Candidat", tn_active: "Actif", tn_former: "Ancien", tn_blacklisted: "Blacklisté",
  kyc_not_started: "Non démarré", kyc_pending: "En revue", kyc_verified: "Vérifié", kyc_rejected: "Rejeté",
  visa_expired: "Visa expiré", visa_30d: "Visa ≤30j", visa_90d: "Visa ≤90j", kyc_reject_reason: "Motif du rejet KYC ?", kyc_verified_count: "KYC vérifié(s)",
  col_tenant: "Locataire", col_lifecycle: "Cycle de vie", col_loyalty: "Loyauté", col_kyc_action: "KYC — Action", empty_tenants: "Aucun locataire.",
  kyc_submit: "Soumettre", kyc_verify: "Vérifier", kyc_reject: "Rejeter", tenant_new: "Nouveau locataire",
  // Lot 2 — owners
  payout_bank_transfer: "Virement", payout_cheque: "Chèque", payout_cash: "Espèces",
  mandate_expired: "Mandat expiré", mandate_jminus_prefix: "Mandat J-", count_owners: "propriétaire(s)",
  col_owner: "Propriétaire", col_mandate: "Mandat", col_commission: "Commission", col_payout: "Versement", col_mandate_due: "Échéance mandat", col_statement: "Relevé",
  empty_owners: "Aucun propriétaire.", owner_generate_statement: "Générer (mois courant)", owner_new: "Nouveau propriétaire",
  field_mandate_reference: "Référence mandat", field_mandate_commission: "Commission mandat (%)",
  // Lot 2 — payments
  pt_rent: "Loyer", pt_charges: "Charges", pt_deposit: "Caution", pt_deposit_return: "Restitution", pt_owner_payout: "Payout propriétaire", pt_other: "Autre",
  pay_pending: "En attente", pay_paid: "Payé", pay_overdue: "En retard", pay_cancelled: "Annulé",
  payments_overdue_count: "en retard", empty_payments: "Aucune demande de paiement.", pay_collect: "Encaisser",
};

export const T: Record<Lang, Translations> = { ar, en, fr };
