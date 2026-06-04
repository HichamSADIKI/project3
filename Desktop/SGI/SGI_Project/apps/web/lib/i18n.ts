export type Lang = "ar" | "en" | "fr";

export type Translations = {
  // Language labels
  lang_ar: string; lang_en: string; lang_fr: string;

  // Sidebar
  workspace: string; logout: string; role: string;

  // Nav
  nav_dash: string; nav_prop: string; nav_crm: string;
  nav_contract: string; nav_rental: string; nav_realestate: string;
  nav_re_sec_commercial: string; nav_re_sec_patrimoine: string;
  nav_re_sec_tiers: string; nav_re_sec_finance: string; nav_re_sec_support: string;
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
  nav_achat: string; nav_vente: string; nav_location: string;
  nav_developers: string; dev_subtitle: string; dev_count: string; dev_empty: string; dev_new: string;
  st_scheduled: string; st_paused: string;
  re_showcase: string; st_featured: string; st_urgent: string;
  nav_re_marketing: string; nav_re_website: string;
  web_subtitle: string; web_view_site: string;
  web_kpi_online: string; web_kpi_draft: string; web_kpi_featured: string; web_kpi_urgent: string;
  web_all: string; web_sale: string; web_rent: string;
  web_publish: string; web_unpublish: string; web_view: string; web_empty: string;
  web_badge_online: string; web_badge_draft: string; web_offline: string;
  social_btn: string; social_title: string; social_subtitle: string; social_publish: string; social_published: string;
  scenario_btn: string; scenario_title: string; scenario_subtitle: string;
  scenario_photos: string; scenario_voice: string; scenario_voice_avatar: string; scenario_voice_record: string;
  scenario_male: string; scenario_female: string; scenario_voice_m: string; scenario_voice_f: string;
  scenario_script_ph: string; scenario_record_start: string; scenario_record_stop: string;
  scenario_recording: string; scenario_recorded: string; scenario_title_ph: string;
  scenario_generate: string; scenario_generating: string; scenario_generated: string;
  scenario_untitled: string; scenario_ready: string; scenario_watch: string;
  scenario_err_upload: string; scenario_err_mic: string; scenario_err_generate: string;
  scenario_share: string; scenario_err_share: string; scenario_failed: string;
  mkt_campaigns: string; mkt_kpis: string; mkt_name: string; mkt_channel: string;
  mkt_budget: string; mkt_spend: string; mkt_impressions: string; mkt_clicks: string;
  mkt_leads: string; mkt_click_rate: string; mkt_starts_on: string; mkt_ends_on: string;
  mkt_new_campaign: string; mkt_publish: string; mkt_name_required: string; mkt_empty: string;
  mkt_chan_social_facebook: string; mkt_chan_social_instagram: string; mkt_chan_social_linkedin: string;
  mkt_chan_portal_bayut: string; mkt_chan_portal_propertyfinder: string; mkt_chan_portal_dubizzle: string;
  mkt_chan_email: string; mkt_chan_other: string;
  nav_re_process: string;
  proc_eyebrow: string; proc_f_leads: string; proc_f_units: string; proc_f_listed: string;
  proc_f_deals: string; proc_f_payments: string;
  proc_phase1_sources: string; proc_phase1_sub: string; proc_phase2_acquisition: string; proc_phase2_sub: string;
  proc_phase3_engine: string; proc_phase3_sub: string; proc_phase4_outputs: string; proc_phase4_sub: string;
  proc_k_leads: string; proc_k_imports: string; proc_k_duplicates: string; proc_k_rejected: string;
  proc_k_units: string; proc_k_watcher: string; proc_k_qualified: string; proc_k_sale_listings: string;
  proc_k_rent_listings: string; proc_k_mk_leads: string; proc_k_impressions: string; proc_k_clicks: string;
  proc_k_spend: string; proc_k_listed_total: string; proc_k_sales_tx: string; proc_k_lease_apps: string;
  proc_k_payments: string; proc_k_deals_total: string; proc_module_off: string; load_error: string;
  dev_col_projects: string; dev_col_units: string; dev_col_city: string; dev_col_status: string;
  dev_status_active: string; dev_status_inactive: string;
  dev_field_name: string; dev_field_city: string; dev_field_license: string; dev_field_projects: string;
  view_list: string; view_map: string; nav_map: string; map_subtitle: string; map_empty: string; map_assets: string;
  re_mandates: string; re_offers: string; re_listings: string; re_applications: string; re_transactions: string; re_matches: string;
  re_budget: string; re_commission: string; re_asking_price: string; re_list_price: string; re_final_price: string; re_monthly_rent: string; re_match_score: string; re_amount: string;
  re_new_mandate: string; re_new_offer: string; re_new_listing: string; re_new_application: string; re_run_match: string; re_no_matches: string;
  st_active: string; st_fulfilled: string; st_expired: string; st_cancelled: string; st_draft: string; st_submitted: string; st_accepted: string; st_rejected: string; st_withdrawn: string; st_published: string; st_under_offer: string; st_sold: string; st_reserved: string; st_leased: string; st_screening: string; st_approved: string; st_converted: string; st_pending: string; st_completed: string;
  nav_payments: string;
  nav_cheques: string;
  nav_maintenance_re: string;
  nav_comms: string;
  nav_inbox: string;
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
  tel_dial_failed: string;
  tel_ami_ext_label: string; tel_ami_connect: string; tel_ami_disconnect: string;
  tel_ami_connected: string; tel_ami_disconnected: string; tel_ami_hint: string;
  tel_ami_connect_failed: string; tel_ami_offline: string; tel_ami_incoming: string;
  tel_ami_unknown_caller: string; tel_ami_no_calls: string;
  tel_no_calls: string; tel_unknown_caller: string;
  tel_notes: string; tel_disposition: string;
  tel_disp_interested: string; tel_disp_callback: string; tel_disp_not_interested: string;
  tel_disp_no_answer: string; tel_disp_wrong_number: string; tel_disp_voicemail: string;
  tel_disp_completed: string;
  tel_log_crm: string; tel_create_ticket: string; tel_schedule_callback: string;
  tel_redial: string; tel_call: string; tel_open_client: string; tel_save: string;
  tel_action_done: string; tel_action_failed: string; tel_shortcuts_hint: string;
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
  col_diffusion: string;
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
  // Lot 3 — comms
  cm_direct: string; cm_group: string; cm_ticket: string; cm_contract: string;
  cm_empty_conversations: string; cm_no_subject: string; cm_select_conversation: string;
  cm_live: string; cm_offline: string; cm_empty_messages: string; cm_system: string;
  cm_voice_note: string; cm_ai_prefix: string; cm_write_message: string; cm_send: string;
  // Omnichannel Inbox
  inbox_title: string; inbox_ch_whatsapp: string; inbox_ch_email: string; inbox_ch_webchat: string;
  inbox_ch_facebook: string; inbox_ch_instagram: string;
  inbox_st_new: string; inbox_st_assigned: string; inbox_st_pending: string; inbox_st_resolved: string; inbox_st_closed: string;
  inbox_empty_conversations: string; inbox_select_conversation: string; inbox_empty_messages: string;
  inbox_no_subject: string; inbox_unknown_contact: string; inbox_in: string; inbox_out: string;
  inbox_live: string; inbox_offline: string; inbox_send: string; inbox_write_reply: string;
  inbox_agent_panel: string; inbox_assign: string; inbox_assign_me: string; inbox_status_label: string;
  inbox_tags_label: string; inbox_add_tag: string; inbox_notes_label: string; inbox_add_note: string;
  inbox_write_note: string; inbox_empty_notes: string; inbox_empty_tags: string; inbox_reference: string;
  inbox_all_channels: string; inbox_all_statuses: string; inbox_filter: string;
  // Ticketing SLA (service desk)
  nav_tickets: string;
  ticket_title: string; ticket_detail: string; ticket_new: string; ticket_create: string;
  ticket_subject: string; ticket_description: string;
  ticket_st_open: string; ticket_st_in_progress: string; ticket_st_pending: string;
  ticket_st_resolved: string; ticket_st_closed: string;
  ticket_pr_low: string; ticket_pr_medium: string; ticket_pr_high: string; ticket_pr_urgent: string;
  ticket_all_priorities: string; ticket_filter_agent: string;
  ticket_status_label: string; ticket_assign: string; ticket_assign_me: string;
  ticket_assigned_to: string; ticket_agent_id_ph: string;
  ticket_sla_breached: string; ticket_sla_due: string;
  ticket_timeline: string; ticket_empty_timeline: string; ticket_empty_column: string;
  ticket_comment_label: string; ticket_write_comment: string; ticket_add_comment: string;
  ticket_ev_created: string; ticket_ev_assigned: string; ticket_ev_status_changed: string;
  ticket_ev_commented: string;
  // AI Copilot
  copilot_assist: string; copilot_insert: string; copilot_inserted: string; copilot_error: string;
  copilot_summary: string; copilot_reply: string; copilot_sentiment: string; copilot_intent: string;
  copilot_nba: string; copilot_engine: string;
  copilot_engine_ai: string; copilot_engine_fallback: string;
  copilot_sentiment_positive: string; copilot_sentiment_neutral: string; copilot_sentiment_negative: string;
  copilot_intent_buy: string; copilot_intent_rent: string; copilot_intent_complaint: string;
  copilot_intent_visit: string; copilot_intent_payment: string; copilot_intent_info: string;
  copilot_action_schedule_visit: string; copilot_action_send_listing: string; copilot_action_escalate: string;
  copilot_action_request_payment: string; copilot_action_share_info: string; copilot_action_follow_up: string;
  // Assistant in-app (chatbot robot)
  assistant_title: string; assistant_subtitle: string; assistant_welcome: string;
  assistant_placeholder: string; assistant_send: string; assistant_error: string;
  assistant_open: string; assistant_close: string; assistant_thinking: string;
  assistant_goto: string; assistant_clear: string;
  assistant_tip_field: string; assistant_tip_error: string; assistant_tip_idle: string;
  assistant_pin: string; assistant_unpin: string;
  // Lot 3 — documents
  dt_contract: string; dt_mandate: string; dt_ejari: string; dt_dld: string; dt_insurance: string;
  dt_invoice: string; dt_statement: string; dt_id: string; dt_passport: string; dt_other: string;
  ds_draft: string; ds_active: string; ds_signed: string; ds_archived: string;
  doc_title_required: string; count_documents: string; col_entity: string; col_version: string;
  empty_documents: string; document_new: string; field_title: string; field_entity_type: string; field_entity_id: string;
  // Lot 3 — owner-portal
  op_draft: string; op_sent: string; op_choose_owner: string; op_select_prompt: string;
  op_statements_label: string; op_last_net_payout: string;
  col_period: string; col_revenue: string; col_expenses: string; col_net_payout: string; op_empty_statements: string;
  // Lot 3 — workflows
  wf_in_progress: string; wf_approved: string; wf_rejected: string; wf_cancelled: string;
  wf_quote_prefix: string; wf_ticket_prefix: string; wf_contract_prefix: string; wf_in_progress_count: string;
  col_instance: string; col_linked_object: string; col_steps: string; empty_workflows: string;
  wf_approve: string; wf_reject: string;
  // Lot 3 — branches
  col_code: string; col_contact: string; branch_new: string; empty_branches: string;
  br_active: string; br_inactive: string; branches_active_count: string; field_phone: string; field_email: string;
  name_required: string;
};

const ar: Translations = {
  lang_ar: "العربية", lang_en: "English", lang_fr: "Français",

  workspace: "مساحة العمل", logout: "تسجيل خروج", role: "المدير العام",

  nav_dash: "لوحة القيادة", nav_prop: "العقارات", nav_crm: "إدارة العملاء",
  nav_contract: "العقود", nav_rental: "الإيجارات", nav_realestate: "العقارات",
  nav_re_sec_commercial: "التجاري", nav_re_sec_patrimoine: "الممتلكات",
  nav_re_sec_tiers: "الأطراف", nav_re_sec_finance: "المالية", nav_re_sec_support: "الدعم والإدارة",
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
  nav_achat: "الشراء", nav_vente: "البيع", nav_location: "الإيجار",
  nav_developers: "المطوّرون", dev_subtitle: "المطوّرون العقاريون ومشاريعهم.", dev_count: "مطوّر", dev_empty: "لا يوجد مطوّرون.", dev_new: "مطوّر جديد",
  st_scheduled: "مجدول", st_paused: "متوقف مؤقتًا",
  re_showcase: "الواجهة", st_featured: "مميّز", st_urgent: "عاجل",
  nav_re_marketing: "التسويق العقاري", nav_re_website: "الموقع الإلكتروني",
  web_subtitle: "إدارة واجهة الموقع العام — البيع والإيجار", web_view_site: "عرض الموقع",
  web_kpi_online: "منشور", web_kpi_draft: "مسودة", web_kpi_featured: "مميّز", web_kpi_urgent: "عاجل",
  web_all: "الكل", web_sale: "للبيع", web_rent: "للإيجار",
  web_publish: "نشر", web_unpublish: "إلغاء النشر", web_view: "عرض", web_empty: "لا توجد إعلانات",
  web_badge_online: "منشور", web_badge_draft: "مسودة", web_offline: "غير منشور",
  social_btn: "تواصل اجتماعي", social_title: "النشر على وسائل التواصل", social_subtitle: "اختر القنوات لنشر الإعلان عليها.", social_publish: "نشر", social_published: "منشور",
  scenario_btn: "سيناريو", scenario_title: "إنشاء فيديو لوسائل التواصل", scenario_subtitle: "اجمع عدة صور وصوتًا لإنشاء فيديو.",
  scenario_photos: "الصور", scenario_voice: "الصوت", scenario_voice_avatar: "صوت أفاتار", scenario_voice_record: "تسجيل",
  scenario_male: "رجل", scenario_female: "امرأة", scenario_voice_m: "صوت رجولي", scenario_voice_f: "صوت أنثوي",
  scenario_script_ph: "النص الذي سيُقال…", scenario_record_start: "ابدأ التسجيل", scenario_record_stop: "إيقاف",
  scenario_recording: "جارٍ التسجيل", scenario_recorded: "تم التسجيل", scenario_title_ph: "عنوان الفيديو (اختياري)",
  scenario_generate: "إنشاء الفيديو", scenario_generating: "جارٍ الإنشاء", scenario_generated: "الفيديوهات المُنشأة",
  scenario_untitled: "بدون عنوان", scenario_ready: "جاهز", scenario_watch: "مشاهدة",
  scenario_err_upload: "فشل رفع الملف", scenario_err_mic: "تعذّر الوصول إلى الميكروفون", scenario_err_generate: "فشل إنشاء الفيديو",
  scenario_share: "نشر الفيديو", scenario_err_share: "فشل النشر", scenario_failed: "فشل",
  mkt_campaigns: "الحملات", mkt_kpis: "المؤشرات", mkt_name: "الاسم", mkt_channel: "القناة",
  mkt_budget: "الميزانية (د.إ)", mkt_spend: "الإنفاق", mkt_impressions: "مرات الظهور", mkt_clicks: "النقرات",
  mkt_leads: "العملاء المحتملون", mkt_click_rate: "معدل النقر", mkt_starts_on: "تاريخ البدء", mkt_ends_on: "تاريخ الانتهاء",
  mkt_new_campaign: "حملة جديدة", mkt_publish: "نشر", mkt_name_required: "الاسم مطلوب", mkt_empty: "لا توجد حملات",
  mkt_chan_social_facebook: "فيسبوك", mkt_chan_social_instagram: "إنستغرام", mkt_chan_social_linkedin: "لينكدإن",
  mkt_chan_portal_bayut: "بيوت", mkt_chan_portal_propertyfinder: "بروبرتي فايندر", mkt_chan_portal_dubizzle: "دوبيزل",
  mkt_chan_email: "بريد إلكتروني", mkt_chan_other: "أخرى",
  nav_re_process: "المسار العقاري",
  proc_eyebrow: "من البداية للنهاية", proc_f_leads: "العملاء", proc_f_units: "الوحدات", proc_f_listed: "معروضة",
  proc_f_deals: "صفقات", proc_f_payments: "التحصيل",
  proc_phase1_sources: "المصادر", proc_phase1_sub: "استقبال العملاء متعدد المصادر", proc_phase2_acquisition: "الاستحواذ والمراقب", proc_phase2_sub: "المخزون والمراقبة المجدولة",
  proc_phase3_engine: "المحرك المركزي", proc_phase3_sub: "التأهيل والتسويق والنشر", proc_phase4_outputs: "المخرجات", proc_phase4_sub: "المبيعات والإيجارات والتحصيل",
  proc_k_leads: "عملاء CRM", proc_k_imports: "الواردات", proc_k_duplicates: "مكرر", proc_k_rejected: "مرفوض",
  proc_k_units: "الوحدات في المخزون", proc_k_watcher: "التقاطات المراقب", proc_k_qualified: "عملاء مؤهلون", proc_k_sale_listings: "إعلانات البيع",
  proc_k_rent_listings: "إعلانات الإيجار", proc_k_mk_leads: "عملاء التسويق", proc_k_impressions: "الظهور", proc_k_clicks: "النقرات",
  proc_k_spend: "الإنفاق", proc_k_listed_total: "إجمالي المعروض", proc_k_sales_tx: "صفقات البيع", proc_k_lease_apps: "طلبات الإيجار",
  proc_k_payments: "طلبات الدفع", proc_k_deals_total: "إجمالي الصفقات", proc_module_off: "الوحدة غير مثبتة", load_error: "فشل التحميل",
  dev_col_projects: "المشاريع", dev_col_units: "الوحدات", dev_col_city: "المدينة", dev_col_status: "الحالة",
  dev_status_active: "نشط", dev_status_inactive: "غير نشط",
  dev_field_name: "اسم المطوّر", dev_field_city: "المدينة", dev_field_license: "رقم الرخصة", dev_field_projects: "عدد المشاريع",
  view_list: "قائمة", view_map: "خريطة", nav_map: "الخريطة", map_subtitle: "كل الأصول المحدّدة جغرافياً.", map_empty: "لا توجد عناصر محدّدة جغرافياً.", map_assets: "أصول على الخريطة",
  re_mandates: "التفويضات", re_offers: "العروض", re_listings: "الإعلانات", re_applications: "الطلبات", re_transactions: "المعاملات", re_matches: "التطابقات",
  re_budget: "الميزانية", re_commission: "العمولة", re_asking_price: "السعر المطلوب", re_list_price: "سعر العرض", re_final_price: "السعر النهائي", re_monthly_rent: "الإيجار الشهري", re_match_score: "درجة التطابق", re_amount: "المبلغ",
  re_new_mandate: "تفويض جديد", re_new_offer: "عرض جديد", re_new_listing: "إعلان جديد", re_new_application: "طلب جديد", re_run_match: "بحث عن تطابقات", re_no_matches: "لا توجد تطابقات",
  st_active: "نشط", st_fulfilled: "منجز", st_expired: "منتهٍ", st_cancelled: "ملغى", st_draft: "مسودة", st_submitted: "مُقدّم", st_accepted: "مقبول", st_rejected: "مرفوض", st_withdrawn: "مسحوب", st_published: "منشور", st_under_offer: "قيد العرض", st_sold: "مُباع", st_reserved: "محجوز", st_leased: "مؤجَّر", st_screening: "قيد الفحص", st_approved: "موافَق عليه", st_converted: "محوَّل", st_pending: "قيد الانتظار", st_completed: "مكتمل",
  nav_payments: "المدفوعات",
  nav_cheques: "الشيكات",
  nav_maintenance_re: "الصيانة",
  nav_comms: "التواصل",
  nav_inbox: "صندوق موحّد",
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
  tel_dial_failed: "فشل الاتصال",
  tel_ami_ext_label: "تحويلتي", tel_ami_connect: "اتصال", tel_ami_disconnect: "قطع الاتصال",
  tel_ami_connected: "متصل", tel_ami_disconnected: "غير متصل",
  tel_ami_hint: "تتحدث على هاتفك ؛ يقوم SGI بتشغيل المكالمات وتسجيلها.",
  tel_ami_connect_failed: "تعذّر الاتصال بالمقسم", tel_ami_offline: "خادم Asterisk (AMI) غير متاح",
  tel_ami_incoming: "مكالمة واردة", tel_ami_unknown_caller: "متصل غير معروف",
  tel_ami_no_calls: "لا مكالمات",
  tel_no_calls: "لا توجد مكالمات.", tel_unknown_caller: "متصل مجهول",
  tel_notes: "ملاحظات", tel_disposition: "النتيجة",
  tel_disp_interested: "مهتم", tel_disp_callback: "طلب معاودة الاتصال", tel_disp_not_interested: "غير مهتم",
  tel_disp_no_answer: "لا يوجد رد", tel_disp_wrong_number: "رقم خاطئ", tel_disp_voicemail: "بريد صوتي",
  tel_disp_completed: "مكتمل",
  tel_log_crm: "تسجيل في CRM", tel_create_ticket: "إنشاء تذكرة", tel_schedule_callback: "جدولة معاودة اتصال",
  tel_redial: "إعادة الاتصال", tel_call: "اتصال", tel_open_client: "فتح بطاقة العميل", tel_save: "حفظ",
  tel_action_done: "تم", tel_action_failed: "فشل", tel_shortcuts_hint: "Alt+A رد · Alt+H إنهاء · Alt+M كتم",
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
  col_diffusion: "النشر",
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
  // Lot 3 — comms
  cm_direct: "مباشر", cm_group: "مجموعة", cm_ticket: "تذكرة", cm_contract: "عقد",
  cm_empty_conversations: "لا محادثات.", cm_no_subject: "(بدون موضوع)", cm_select_conversation: "اختر محادثة.",
  cm_live: "مباشر", cm_offline: "غير متصل", cm_empty_messages: "لا رسائل.", cm_system: "النظام",
  cm_voice_note: "🎙️ رسالة صوتية", cm_ai_prefix: "ذكاء اصطناعي:", cm_write_message: "اكتب رسالة…", cm_send: "إرسال",
  inbox_title: "الصندوق الموحّد", inbox_ch_whatsapp: "واتساب", inbox_ch_email: "بريد", inbox_ch_webchat: "دردشة الويب",
  inbox_ch_facebook: "فيسبوك", inbox_ch_instagram: "إنستغرام",
  inbox_st_new: "جديد", inbox_st_assigned: "مُسند", inbox_st_pending: "معلّق", inbox_st_resolved: "تمّ الحل", inbox_st_closed: "مغلق",
  inbox_empty_conversations: "لا محادثات.", inbox_select_conversation: "اختر محادثة.", inbox_empty_messages: "لا رسائل.",
  inbox_no_subject: "(بدون موضوع)", inbox_unknown_contact: "جهة غير معروفة", inbox_in: "وارد", inbox_out: "صادر",
  inbox_live: "مباشر", inbox_offline: "غير متصل", inbox_send: "إرسال", inbox_write_reply: "اكتب ردًّا…",
  inbox_agent_panel: "لوحة الوكيل", inbox_assign: "إسناد", inbox_assign_me: "إسناد إليّ", inbox_status_label: "الحالة",
  inbox_tags_label: "الوسوم", inbox_add_tag: "إضافة وسم", inbox_notes_label: "ملاحظات داخلية", inbox_add_note: "إضافة ملاحظة",
  inbox_write_note: "اكتب ملاحظة داخلية…", inbox_empty_notes: "لا ملاحظات.", inbox_empty_tags: "لا وسوم.", inbox_reference: "المرجع",
  inbox_all_channels: "كل القنوات", inbox_all_statuses: "كل الحالات", inbox_filter: "تصفية",
  nav_tickets: "التذاكر",
  ticket_title: "تذاكر الدعم", ticket_detail: "تفاصيل التذكرة", ticket_new: "تذكرة جديدة", ticket_create: "إنشاء",
  ticket_subject: "الموضوع", ticket_description: "الوصف",
  ticket_st_open: "مفتوحة", ticket_st_in_progress: "قيد المعالجة", ticket_st_pending: "معلّقة",
  ticket_st_resolved: "تمّ الحل", ticket_st_closed: "مغلقة",
  ticket_pr_low: "منخفضة", ticket_pr_medium: "متوسطة", ticket_pr_high: "عالية", ticket_pr_urgent: "عاجلة",
  ticket_all_priorities: "كل الأولويات", ticket_filter_agent: "تصفية حسب الوكيل",
  ticket_status_label: "الحالة", ticket_assign: "إسناد", ticket_assign_me: "إسناد إليّ",
  ticket_assigned_to: "مُسندة إلى", ticket_agent_id_ph: "معرّف الوكيل",
  ticket_sla_breached: "تجاوز مدة الخدمة", ticket_sla_due: "موعد استحقاق الخدمة",
  ticket_timeline: "السجل الزمني", ticket_empty_timeline: "لا أحداث.", ticket_empty_column: "لا تذاكر.",
  ticket_comment_label: "تعليق", ticket_write_comment: "اكتب تعليقًا…", ticket_add_comment: "إضافة تعليق",
  ticket_ev_created: "تمّ الإنشاء", ticket_ev_assigned: "تمّ الإسناد", ticket_ev_status_changed: "تغيّرت الحالة",
  ticket_ev_commented: "تعليق",
  // AI Copilot
  copilot_assist: "مساعدة بالذكاء الاصطناعي", copilot_insert: "إدراج", copilot_inserted: "تمّ الإدراج",
  copilot_error: "تعذّر الحصول على المساعدة",
  copilot_summary: "ملخّص", copilot_reply: "ردّ مقترح", copilot_sentiment: "المشاعر", copilot_intent: "النيّة",
  copilot_nba: "إجراءات مقترحة", copilot_engine: "المحرّك",
  copilot_engine_ai: "ذكاء اصطناعي", copilot_engine_fallback: "تلقائي",
  copilot_sentiment_positive: "إيجابي", copilot_sentiment_neutral: "محايد", copilot_sentiment_negative: "سلبي",
  copilot_intent_buy: "شراء", copilot_intent_rent: "إيجار", copilot_intent_complaint: "شكوى",
  copilot_intent_visit: "زيارة", copilot_intent_payment: "دفع", copilot_intent_info: "استفسار",
  copilot_action_schedule_visit: "جدولة زيارة", copilot_action_send_listing: "إرسال عقار", copilot_action_escalate: "تصعيد",
  copilot_action_request_payment: "طلب دفعة", copilot_action_share_info: "مشاركة معلومات", copilot_action_follow_up: "متابعة",
  assistant_title: "مساعد SGI", assistant_subtitle: "هنا لمساعدتك", assistant_welcome: "مرحباً! أنا مساعد SGI. كيف يمكنني مساعدتك في استخدام التطبيق؟",
  assistant_placeholder: "اكتب سؤالك…", assistant_send: "إرسال", assistant_error: "تعذّر الحصول على رد، حاول مرة أخرى.",
  assistant_open: "فتح المساعد", assistant_close: "إغلاق", assistant_thinking: "يكتب…",
  assistant_goto: "افتح", assistant_clear: "محادثة جديدة",
  assistant_tip_field: "هل تحتاج مساعدة في ملء هذا الحقل؟", assistant_tip_error: "حدث خطأ — هل أساعدك؟", assistant_tip_idle: "هل تحتاج مساعدة في هذه الصفحة؟",
  assistant_pin: "تثبيت المساعد", assistant_unpin: "تحرير المساعد",
  // Lot 3 — documents
  dt_contract: "عقد", dt_mandate: "تفويض", dt_ejari: "إيجاري", dt_dld: "دائرة الأراضي", dt_insurance: "تأمين",
  dt_invoice: "فاتورة", dt_statement: "كشف", dt_id: "هوية", dt_passport: "جواز سفر", dt_other: "أخرى",
  ds_draft: "مسودة", ds_active: "نشط", ds_signed: "موقّع", ds_archived: "مؤرشف",
  doc_title_required: "العنوان مطلوب.", count_documents: "مستند", col_entity: "الكيان", col_version: "الإصدار",
  empty_documents: "لا مستندات.", document_new: "مستند جديد", field_title: "العنوان", field_entity_type: "نوع الكيان المرتبط (اختياري)", field_entity_id: "معرّف الكيان المرتبط (اختياري)",
  // Lot 3 — owner-portal
  op_draft: "مسودة", op_sent: "مُرسل", op_choose_owner: "— اختر مالكًا —", op_select_prompt: "اختر مالكًا لعرض كشوفه.",
  op_statements_label: "كشوف", op_last_net_payout: "آخر صافي دفع",
  col_period: "الفترة", col_revenue: "الإيرادات", col_expenses: "المصروفات", col_net_payout: "صافي الدفع", op_empty_statements: "لا كشوف.",
  // Lot 3 — workflows
  wf_in_progress: "قيد التنفيذ", wf_approved: "موافق عليه", wf_rejected: "مرفوض", wf_cancelled: "ملغى",
  wf_quote_prefix: "عرض سعر", wf_ticket_prefix: "تذكرة", wf_contract_prefix: "عقد", wf_in_progress_count: "قيد التنفيذ",
  col_instance: "النسخة", col_linked_object: "العنصر المرتبط", col_steps: "الخطوات", empty_workflows: "لا نسخ سير عمل.",
  wf_approve: "موافقة", wf_reject: "رفض",
  // Lot 3 — branches
  col_code: "الرمز", col_contact: "جهة الاتصال", branch_new: "فرع جديد", empty_branches: "لا فروع.",
  br_active: "نشط", br_inactive: "غير نشط", branches_active_count: "نشط", field_phone: "الهاتف", field_email: "البريد الإلكتروني",
  name_required: "الاسم مطلوب.",
};

const en: Translations = {
  lang_ar: "العربية", lang_en: "English", lang_fr: "Français",

  workspace: "Workspace", logout: "Log out", role: "Managing Director",

  nav_dash: "Dashboard", nav_prop: "Properties", nav_crm: "CRM",
  nav_contract: "Contracts", nav_rental: "Rentals", nav_realestate: "Real Estate",
  nav_re_sec_commercial: "Commercial", nav_re_sec_patrimoine: "Properties",
  nav_re_sec_tiers: "Parties", nav_re_sec_finance: "Finance", nav_re_sec_support: "Support & Admin",
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
  nav_achat: "Buy", nav_vente: "Sell", nav_location: "Rent",
  nav_developers: "Developers", dev_subtitle: "Property developers and their projects.", dev_count: "developers", dev_empty: "No developers yet.", dev_new: "New developer",
  st_scheduled: "Scheduled", st_paused: "Paused",
  re_showcase: "Showcase", st_featured: "Featured", st_urgent: "Urgent",
  nav_re_marketing: "Real estate marketing", nav_re_website: "Website",
  web_subtitle: "Manage the public showcase — sales & rentals", web_view_site: "View site",
  web_kpi_online: "Online", web_kpi_draft: "Drafts", web_kpi_featured: "Featured", web_kpi_urgent: "Urgent",
  web_all: "All", web_sale: "For sale", web_rent: "For rent",
  web_publish: "Publish", web_unpublish: "Unpublish", web_view: "View", web_empty: "No listings",
  web_badge_online: "Online", web_badge_draft: "Draft", web_offline: "Offline",
  social_btn: "Social", social_title: "Publish to social media", social_subtitle: "Pick the channels to publish this listing on.", social_publish: "Publish", social_published: "Published",
  scenario_btn: "Scenario", scenario_title: "Generate a social media video", scenario_subtitle: "Combine several photos and a voice into a video.",
  scenario_photos: "Photos", scenario_voice: "Voice", scenario_voice_avatar: "Avatar voice", scenario_voice_record: "Record",
  scenario_male: "Man", scenario_female: "Woman", scenario_voice_m: "male voice", scenario_voice_f: "female voice",
  scenario_script_ph: "Script to be spoken…", scenario_record_start: "Start recording", scenario_record_stop: "Stop",
  scenario_recording: "Recording", scenario_recorded: "Recorded", scenario_title_ph: "Video title (optional)",
  scenario_generate: "Generate video", scenario_generating: "Generating", scenario_generated: "Generated videos",
  scenario_untitled: "Untitled", scenario_ready: "Ready", scenario_watch: "Watch",
  scenario_err_upload: "Upload failed", scenario_err_mic: "Microphone access denied", scenario_err_generate: "Video generation failed",
  scenario_share: "Publish video", scenario_err_share: "Publish failed", scenario_failed: "Failed",
  mkt_campaigns: "Campaigns", mkt_kpis: "KPIs", mkt_name: "Name", mkt_channel: "Channel",
  mkt_budget: "Budget (AED)", mkt_spend: "Spend", mkt_impressions: "Impressions", mkt_clicks: "Clicks",
  mkt_leads: "Leads", mkt_click_rate: "Click rate", mkt_starts_on: "Start date", mkt_ends_on: "End date",
  mkt_new_campaign: "New campaign", mkt_publish: "Publish", mkt_name_required: "Name is required", mkt_empty: "No campaigns",
  mkt_chan_social_facebook: "Facebook", mkt_chan_social_instagram: "Instagram", mkt_chan_social_linkedin: "LinkedIn",
  mkt_chan_portal_bayut: "Bayut", mkt_chan_portal_propertyfinder: "Property Finder", mkt_chan_portal_dubizzle: "Dubizzle",
  mkt_chan_email: "Email", mkt_chan_other: "Other",
  nav_re_process: "Process",
  proc_eyebrow: "End-to-end", proc_f_leads: "Leads", proc_f_units: "Units", proc_f_listed: "Listed",
  proc_f_deals: "Deals", proc_f_payments: "Collection",
  proc_phase1_sources: "Sources", proc_phase1_sub: "Multi-source lead ingestion", proc_phase2_acquisition: "Acquisition & Watcher", proc_phase2_sub: "Inventory & scheduled monitoring",
  proc_phase3_engine: "Central engine", proc_phase3_sub: "Qualification, marketing & publication", proc_phase4_outputs: "Outputs", proc_phase4_sub: "Sales, leases & collection",
  proc_k_leads: "CRM leads", proc_k_imports: "Imports", proc_k_duplicates: "Duplicates", proc_k_rejected: "Rejected",
  proc_k_units: "Units in inventory", proc_k_watcher: "Watcher captures", proc_k_qualified: "Qualified leads", proc_k_sale_listings: "Sale listings",
  proc_k_rent_listings: "Rent listings", proc_k_mk_leads: "Marketing leads", proc_k_impressions: "Impressions", proc_k_clicks: "Clicks",
  proc_k_spend: "Spend", proc_k_listed_total: "Total listed", proc_k_sales_tx: "Sale deals", proc_k_lease_apps: "Lease applications",
  proc_k_payments: "Payment requests", proc_k_deals_total: "Total deals", proc_module_off: "Module not installed", load_error: "Loading failed",
  dev_col_projects: "Projects", dev_col_units: "Units", dev_col_city: "City", dev_col_status: "Status",
  dev_status_active: "Active", dev_status_inactive: "Inactive",
  dev_field_name: "Developer name", dev_field_city: "City", dev_field_license: "Licence no.", dev_field_projects: "Projects count",
  view_list: "List", view_map: "Map", nav_map: "Map", map_subtitle: "All geolocated assets.", map_empty: "No geolocated items.", map_assets: "assets on map",
  re_mandates: "Mandates", re_offers: "Offers", re_listings: "Listings", re_applications: "Applications", re_transactions: "Transactions", re_matches: "Matches",
  re_budget: "Budget", re_commission: "Commission", re_asking_price: "Asking price", re_list_price: "List price", re_final_price: "Final price", re_monthly_rent: "Monthly rent", re_match_score: "Match score", re_amount: "Amount",
  re_new_mandate: "New mandate", re_new_offer: "New offer", re_new_listing: "New listing", re_new_application: "New application", re_run_match: "Find matches", re_no_matches: "No matches",
  st_active: "Active", st_fulfilled: "Fulfilled", st_expired: "Expired", st_cancelled: "Cancelled", st_draft: "Draft", st_submitted: "Submitted", st_accepted: "Accepted", st_rejected: "Rejected", st_withdrawn: "Withdrawn", st_published: "Published", st_under_offer: "Under offer", st_sold: "Sold", st_reserved: "Reserved", st_leased: "Leased", st_screening: "Screening", st_approved: "Approved", st_converted: "Converted", st_pending: "Pending", st_completed: "Completed",
  nav_payments: "Payments",
  nav_cheques: "Cheques",
  nav_maintenance_re: "Maintenance",
  nav_comms: "Communication",
  nav_inbox: "Omnichannel Inbox",
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
  tel_dial_failed: "Call failed",
  tel_ami_ext_label: "My extension", tel_ami_connect: "Connect", tel_ami_disconnect: "Disconnect",
  tel_ami_connected: "Connected", tel_ami_disconnected: "Disconnected",
  tel_ami_hint: "You talk on your phone; SGI places and logs the calls.",
  tel_ami_connect_failed: "Could not connect to the PBX", tel_ami_offline: "Asterisk (AMI) unreachable",
  tel_ami_incoming: "Incoming call", tel_ami_unknown_caller: "Unknown caller",
  tel_ami_no_calls: "No calls",
  tel_no_calls: "No calls.", tel_unknown_caller: "Unknown caller",
  tel_notes: "Notes", tel_disposition: "Outcome",
  tel_disp_interested: "Interested", tel_disp_callback: "Callback", tel_disp_not_interested: "Not interested",
  tel_disp_no_answer: "No answer", tel_disp_wrong_number: "Wrong number", tel_disp_voicemail: "Voicemail",
  tel_disp_completed: "Completed",
  tel_log_crm: "Log to CRM", tel_create_ticket: "Create ticket", tel_schedule_callback: "Schedule callback",
  tel_redial: "Redial", tel_call: "Call", tel_open_client: "Open client", tel_save: "Save",
  tel_action_done: "Done", tel_action_failed: "Failed", tel_shortcuts_hint: "Alt+A answer · Alt+H hang up · Alt+M mute",
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
  col_diffusion: "Distribution",
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
  // Lot 3 — comms
  cm_direct: "Direct", cm_group: "Group", cm_ticket: "Ticket", cm_contract: "Contract",
  cm_empty_conversations: "No conversations.", cm_no_subject: "(no subject)", cm_select_conversation: "Select a conversation.",
  cm_live: "Live", cm_offline: "Offline", cm_empty_messages: "No messages.", cm_system: "system",
  cm_voice_note: "🎙️ voice note", cm_ai_prefix: "AI:", cm_write_message: "Write a message…", cm_send: "Send",
  inbox_title: "Omnichannel Inbox", inbox_ch_whatsapp: "WhatsApp", inbox_ch_email: "Email", inbox_ch_webchat: "Web chat",
  inbox_ch_facebook: "Facebook", inbox_ch_instagram: "Instagram",
  inbox_st_new: "New", inbox_st_assigned: "Assigned", inbox_st_pending: "Pending", inbox_st_resolved: "Resolved", inbox_st_closed: "Closed",
  inbox_empty_conversations: "No conversations.", inbox_select_conversation: "Select a conversation.", inbox_empty_messages: "No messages.",
  inbox_no_subject: "(no subject)", inbox_unknown_contact: "Unknown contact", inbox_in: "In", inbox_out: "Out",
  inbox_live: "Live", inbox_offline: "Offline", inbox_send: "Send", inbox_write_reply: "Write a reply…",
  inbox_agent_panel: "Agent panel", inbox_assign: "Assign", inbox_assign_me: "Assign to me", inbox_status_label: "Status",
  inbox_tags_label: "Tags", inbox_add_tag: "Add tag", inbox_notes_label: "Internal notes", inbox_add_note: "Add note",
  inbox_write_note: "Write an internal note…", inbox_empty_notes: "No notes.", inbox_empty_tags: "No tags.", inbox_reference: "Reference",
  inbox_all_channels: "All channels", inbox_all_statuses: "All statuses", inbox_filter: "Filter",
  nav_tickets: "Tickets",
  ticket_title: "Support tickets", ticket_detail: "Ticket detail", ticket_new: "New ticket", ticket_create: "Create",
  ticket_subject: "Subject", ticket_description: "Description",
  ticket_st_open: "Open", ticket_st_in_progress: "In progress", ticket_st_pending: "Pending",
  ticket_st_resolved: "Resolved", ticket_st_closed: "Closed",
  ticket_pr_low: "Low", ticket_pr_medium: "Medium", ticket_pr_high: "High", ticket_pr_urgent: "Urgent",
  ticket_all_priorities: "All priorities", ticket_filter_agent: "Filter by agent",
  ticket_status_label: "Status", ticket_assign: "Assign", ticket_assign_me: "Assign to me",
  ticket_assigned_to: "Assigned to", ticket_agent_id_ph: "Agent ID",
  ticket_sla_breached: "SLA breached", ticket_sla_due: "SLA due",
  ticket_timeline: "Timeline", ticket_empty_timeline: "No events.", ticket_empty_column: "No tickets.",
  ticket_comment_label: "Comment", ticket_write_comment: "Write a comment…", ticket_add_comment: "Add comment",
  ticket_ev_created: "Created", ticket_ev_assigned: "Assigned", ticket_ev_status_changed: "Status changed",
  ticket_ev_commented: "Comment",
  // AI Copilot
  copilot_assist: "AI assist", copilot_insert: "Insert", copilot_inserted: "Inserted",
  copilot_error: "Could not get assistance",
  copilot_summary: "Summary", copilot_reply: "Suggested reply", copilot_sentiment: "Sentiment", copilot_intent: "Intent",
  copilot_nba: "Suggested actions", copilot_engine: "Engine",
  copilot_engine_ai: "AI", copilot_engine_fallback: "Automatic",
  copilot_sentiment_positive: "Positive", copilot_sentiment_neutral: "Neutral", copilot_sentiment_negative: "Negative",
  copilot_intent_buy: "Buy", copilot_intent_rent: "Rent", copilot_intent_complaint: "Complaint",
  copilot_intent_visit: "Visit", copilot_intent_payment: "Payment", copilot_intent_info: "Info",
  copilot_action_schedule_visit: "Schedule visit", copilot_action_send_listing: "Send listing", copilot_action_escalate: "Escalate",
  copilot_action_request_payment: "Request payment", copilot_action_share_info: "Share info", copilot_action_follow_up: "Follow up",
  assistant_title: "SGI Assistant", assistant_subtitle: "Here to help", assistant_welcome: "Hi! I'm the SGI assistant. How can I help you use the app?",
  assistant_placeholder: "Type your question…", assistant_send: "Send", assistant_error: "Couldn't get a reply, please try again.",
  assistant_open: "Open assistant", assistant_close: "Close", assistant_thinking: "Typing…",
  assistant_goto: "Open", assistant_clear: "New chat",
  assistant_tip_field: "Need help filling this field?", assistant_tip_error: "Something went wrong — can I help?", assistant_tip_idle: "Need help on this page?",
  assistant_pin: "Pin assistant", assistant_unpin: "Unpin assistant",
  // Lot 3 — documents
  dt_contract: "Contract", dt_mandate: "Mandate", dt_ejari: "Ejari", dt_dld: "DLD", dt_insurance: "Insurance",
  dt_invoice: "Invoice", dt_statement: "Statement", dt_id: "ID", dt_passport: "Passport", dt_other: "Other",
  ds_draft: "Draft", ds_active: "Active", ds_signed: "Signed", ds_archived: "Archived",
  doc_title_required: "Title is required.", count_documents: "document(s)", col_entity: "Entity", col_version: "Version",
  empty_documents: "No documents.", document_new: "New document", field_title: "Title", field_entity_type: "Linked entity type (optional)", field_entity_id: "Linked entity UUID (optional)",
  // Lot 3 — owner-portal
  op_draft: "Draft", op_sent: "Sent", op_choose_owner: "— Choose an owner —", op_select_prompt: "Select an owner to view their statements.",
  op_statements_label: "Statements", op_last_net_payout: "Last net payout",
  col_period: "Period", col_revenue: "Revenue", col_expenses: "Expenses", col_net_payout: "Net payout", op_empty_statements: "No statements.",
  // Lot 3 — workflows
  wf_in_progress: "In progress", wf_approved: "Approved", wf_rejected: "Rejected", wf_cancelled: "Cancelled",
  wf_quote_prefix: "Quote", wf_ticket_prefix: "Ticket", wf_contract_prefix: "Contract", wf_in_progress_count: "in progress",
  col_instance: "Instance", col_linked_object: "Linked object", col_steps: "Steps", empty_workflows: "No workflow instances.",
  wf_approve: "Approve", wf_reject: "Reject",
  // Lot 3 — branches
  col_code: "Code", col_contact: "Contact", branch_new: "New branch", empty_branches: "No branches.",
  br_active: "Active", br_inactive: "Inactive", branches_active_count: "active", field_phone: "Phone", field_email: "Email",
  name_required: "Name is required.",
};

const fr: Translations = {
  lang_ar: "العربية", lang_en: "English", lang_fr: "Français",

  workspace: "Espace de travail", logout: "Se déconnecter", role: "Directeur Général",

  nav_dash: "Tableau de bord", nav_prop: "Propriétés", nav_crm: "CRM",
  nav_contract: "Contrats", nav_rental: "Locations", nav_realestate: "Immobilier",
  nav_re_sec_commercial: "Commercial", nav_re_sec_patrimoine: "Patrimoine",
  nav_re_sec_tiers: "Tiers", nav_re_sec_finance: "Finance", nav_re_sec_support: "Support & Admin",
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
  nav_achat: "Achat", nav_vente: "Vente", nav_location: "Location",
  nav_developers: "Promoteurs", dev_subtitle: "Promoteurs immobiliers et leurs projets.", dev_count: "promoteurs", dev_empty: "Aucun promoteur pour le moment.", dev_new: "Nouveau promoteur",
  st_scheduled: "Planifiée", st_paused: "En pause",
  re_showcase: "Vitrine", st_featured: "À la une", st_urgent: "Urgent",
  nav_re_marketing: "Marketing immobilier", nav_re_website: "Site web",
  web_subtitle: "Pilotez la vitrine publique — vente & location", web_view_site: "Voir le site",
  web_kpi_online: "En ligne", web_kpi_draft: "Brouillons", web_kpi_featured: "À la une", web_kpi_urgent: "Urgents",
  web_all: "Tous", web_sale: "À vendre", web_rent: "À louer",
  web_publish: "Publier", web_unpublish: "Retirer du site", web_view: "Voir", web_empty: "Aucune annonce",
  web_badge_online: "En ligne", web_badge_draft: "Brouillon", web_offline: "Hors ligne",
  social_btn: "Réseaux", social_title: "Publier sur les réseaux sociaux", social_subtitle: "Choisissez les canaux où publier cette annonce.", social_publish: "Publier", social_published: "Publié",
  scenario_btn: "Scénario", scenario_title: "Générer une vidéo social media", scenario_subtitle: "Combinez plusieurs photos et une voix pour générer une vidéo.",
  scenario_photos: "Photos", scenario_voice: "Voix", scenario_voice_avatar: "Voix d'avatar", scenario_voice_record: "Enregistrer",
  scenario_male: "Homme", scenario_female: "Femme", scenario_voice_m: "voix masculine", scenario_voice_f: "voix féminine",
  scenario_script_ph: "Texte à dire…", scenario_record_start: "Enregistrer", scenario_record_stop: "Arrêter",
  scenario_recording: "Enregistrement", scenario_recorded: "Enregistré", scenario_title_ph: "Titre de la vidéo (optionnel)",
  scenario_generate: "Générer la vidéo", scenario_generating: "Génération", scenario_generated: "Vidéos générées",
  scenario_untitled: "Sans titre", scenario_ready: "Prête", scenario_watch: "Voir",
  scenario_err_upload: "Échec de l'upload", scenario_err_mic: "Accès micro refusé", scenario_err_generate: "Échec de la génération",
  scenario_share: "Publier la vidéo", scenario_err_share: "Échec de la publication", scenario_failed: "Échec",
  mkt_campaigns: "Campagnes", mkt_kpis: "Indicateurs", mkt_name: "Nom", mkt_channel: "Canal",
  mkt_budget: "Budget (AED)", mkt_spend: "Dépense", mkt_impressions: "Impressions", mkt_clicks: "Clics",
  mkt_leads: "Prospects", mkt_click_rate: "Taux de clic", mkt_starts_on: "Date de début", mkt_ends_on: "Date de fin",
  mkt_new_campaign: "Nouvelle campagne", mkt_publish: "Publier", mkt_name_required: "Le nom est obligatoire", mkt_empty: "Aucune campagne",
  mkt_chan_social_facebook: "Facebook", mkt_chan_social_instagram: "Instagram", mkt_chan_social_linkedin: "LinkedIn",
  mkt_chan_portal_bayut: "Bayut", mkt_chan_portal_propertyfinder: "Property Finder", mkt_chan_portal_dubizzle: "Dubizzle",
  mkt_chan_email: "Email", mkt_chan_other: "Autre",
  nav_re_process: "Process",
  proc_eyebrow: "De bout en bout", proc_f_leads: "Leads", proc_f_units: "Unités", proc_f_listed: "Publiés",
  proc_f_deals: "Deals", proc_f_payments: "Encaissement",
  proc_phase1_sources: "Sources", proc_phase1_sub: "Ingestion multi-source de leads", proc_phase2_acquisition: "Acquisition & Watcher", proc_phase2_sub: "Inventaire & veille planifiée",
  proc_phase3_engine: "Moteur central", proc_phase3_sub: "Qualification, marketing & publication", proc_phase4_outputs: "Sorties", proc_phase4_sub: "Ventes, baux & encaissement",
  proc_k_leads: "Leads CRM", proc_k_imports: "Imports", proc_k_duplicates: "Doublons", proc_k_rejected: "Rejetés",
  proc_k_units: "Unités en inventaire", proc_k_watcher: "Captures Watcher", proc_k_qualified: "Leads qualifiés", proc_k_sale_listings: "Annonces vente",
  proc_k_rent_listings: "Annonces location", proc_k_mk_leads: "Leads marketing", proc_k_impressions: "Impressions", proc_k_clicks: "Clics",
  proc_k_spend: "Dépense", proc_k_listed_total: "Total publiés", proc_k_sales_tx: "Deals vente", proc_k_lease_apps: "Demandes location",
  proc_k_payments: "Demandes de paiement", proc_k_deals_total: "Total deals", proc_module_off: "Module non installé", load_error: "Échec du chargement",
  dev_col_projects: "Projets", dev_col_units: "Unités", dev_col_city: "Ville", dev_col_status: "Statut",
  dev_status_active: "Actif", dev_status_inactive: "Inactif",
  dev_field_name: "Nom du promoteur", dev_field_city: "Ville", dev_field_license: "N° licence", dev_field_projects: "Nb projets",
  view_list: "Liste", view_map: "Carte", nav_map: "Carte", map_subtitle: "Tous les actifs géolocalisés.", map_empty: "Aucun élément géolocalisé.", map_assets: "actifs sur la carte",
  re_mandates: "Mandats", re_offers: "Offres", re_listings: "Annonces", re_applications: "Candidatures", re_transactions: "Transactions", re_matches: "Rapprochements",
  re_budget: "Budget", re_commission: "Commission", re_asking_price: "Prix demandé", re_list_price: "Prix affiché", re_final_price: "Prix final", re_monthly_rent: "Loyer mensuel", re_match_score: "Score", re_amount: "Montant",
  re_new_mandate: "Nouveau mandat", re_new_offer: "Nouvelle offre", re_new_listing: "Nouvelle annonce", re_new_application: "Nouvelle candidature", re_run_match: "Rechercher", re_no_matches: "Aucun rapprochement",
  st_active: "Actif", st_fulfilled: "Honoré", st_expired: "Expiré", st_cancelled: "Annulé", st_draft: "Brouillon", st_submitted: "Soumise", st_accepted: "Acceptée", st_rejected: "Refusée", st_withdrawn: "Retirée", st_published: "Publiée", st_under_offer: "Sous offre", st_sold: "Vendu", st_reserved: "Réservé", st_leased: "Loué", st_screening: "Étude", st_approved: "Approuvée", st_converted: "Convertie", st_pending: "En attente", st_completed: "Terminée",
  nav_payments: "Paiements",
  nav_cheques: "Chèques",
  nav_maintenance_re: "Maintenance",
  nav_comms: "Communication",
  nav_inbox: "Boîte omnicanale",
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
  tel_dial_failed: "Échec de l'appel",
  tel_ami_ext_label: "Mon extension", tel_ami_connect: "Se connecter", tel_ami_disconnect: "Se déconnecter",
  tel_ami_connected: "Connecté", tel_ami_disconnected: "Déconnecté",
  tel_ami_hint: "Vous parlez sur votre téléphone ; SGI déclenche et trace les appels.",
  tel_ami_connect_failed: "Connexion au standard impossible", tel_ami_offline: "Asterisk (AMI) injoignable",
  tel_ami_incoming: "Appel entrant", tel_ami_unknown_caller: "Appelant inconnu",
  tel_ami_no_calls: "Aucun appel",
  tel_no_calls: "Aucun appel.", tel_unknown_caller: "Appelant inconnu",
  tel_notes: "Notes", tel_disposition: "Résultat",
  tel_disp_interested: "Intéressé", tel_disp_callback: "Rappel demandé", tel_disp_not_interested: "Pas intéressé",
  tel_disp_no_answer: "Pas de réponse", tel_disp_wrong_number: "Faux numéro", tel_disp_voicemail: "Messagerie",
  tel_disp_completed: "Terminé",
  tel_log_crm: "Logger au CRM", tel_create_ticket: "Créer un ticket", tel_schedule_callback: "Planifier un rappel",
  tel_redial: "Rappeler", tel_call: "Appeler", tel_open_client: "Ouvrir la fiche", tel_save: "Enregistrer",
  tel_action_done: "Fait", tel_action_failed: "Échec", tel_shortcuts_hint: "Alt+A répondre · Alt+H raccrocher · Alt+M muet",
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
  col_diffusion: "Diffusion",
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
  // Lot 3 — comms
  cm_direct: "Direct", cm_group: "Groupe", cm_ticket: "Ticket", cm_contract: "Contrat",
  cm_empty_conversations: "Aucune conversation.", cm_no_subject: "(sans objet)", cm_select_conversation: "Sélectionnez une conversation.",
  cm_live: "Temps réel", cm_offline: "Hors-ligne", cm_empty_messages: "Aucun message.", cm_system: "système",
  cm_voice_note: "🎙️ note vocale", cm_ai_prefix: "IA :", cm_write_message: "Écrire un message…", cm_send: "Envoyer",
  inbox_title: "Boîte omnicanale", inbox_ch_whatsapp: "WhatsApp", inbox_ch_email: "E-mail", inbox_ch_webchat: "Chat web",
  inbox_ch_facebook: "Facebook", inbox_ch_instagram: "Instagram",
  inbox_st_new: "Nouveau", inbox_st_assigned: "Assigné", inbox_st_pending: "En attente", inbox_st_resolved: "Résolu", inbox_st_closed: "Fermé",
  inbox_empty_conversations: "Aucune conversation.", inbox_select_conversation: "Sélectionnez une conversation.", inbox_empty_messages: "Aucun message.",
  inbox_no_subject: "(sans objet)", inbox_unknown_contact: "Contact inconnu", inbox_in: "Entrant", inbox_out: "Sortant",
  inbox_live: "Temps réel", inbox_offline: "Hors-ligne", inbox_send: "Envoyer", inbox_write_reply: "Écrire une réponse…",
  inbox_agent_panel: "Panneau agent", inbox_assign: "Assigner", inbox_assign_me: "M'assigner", inbox_status_label: "Statut",
  inbox_tags_label: "Étiquettes", inbox_add_tag: "Ajouter une étiquette", inbox_notes_label: "Notes internes", inbox_add_note: "Ajouter une note",
  inbox_write_note: "Écrire une note interne…", inbox_empty_notes: "Aucune note.", inbox_empty_tags: "Aucune étiquette.", inbox_reference: "Référence",
  inbox_all_channels: "Tous les canaux", inbox_all_statuses: "Tous les statuts", inbox_filter: "Filtrer",
  nav_tickets: "Tickets",
  ticket_title: "Tickets de support", ticket_detail: "Détail du ticket", ticket_new: "Nouveau ticket", ticket_create: "Créer",
  ticket_subject: "Sujet", ticket_description: "Description",
  ticket_st_open: "Ouvert", ticket_st_in_progress: "En cours", ticket_st_pending: "En attente",
  ticket_st_resolved: "Résolu", ticket_st_closed: "Fermé",
  ticket_pr_low: "Faible", ticket_pr_medium: "Moyenne", ticket_pr_high: "Haute", ticket_pr_urgent: "Urgente",
  ticket_all_priorities: "Toutes les priorités", ticket_filter_agent: "Filtrer par agent",
  ticket_status_label: "Statut", ticket_assign: "Assigner", ticket_assign_me: "M'assigner",
  ticket_assigned_to: "Assigné à", ticket_agent_id_ph: "ID agent",
  ticket_sla_breached: "SLA dépassé", ticket_sla_due: "Échéance SLA",
  ticket_timeline: "Historique", ticket_empty_timeline: "Aucun événement.", ticket_empty_column: "Aucun ticket.",
  ticket_comment_label: "Commentaire", ticket_write_comment: "Écrire un commentaire…", ticket_add_comment: "Ajouter un commentaire",
  ticket_ev_created: "Créé", ticket_ev_assigned: "Assigné", ticket_ev_status_changed: "Statut modifié",
  ticket_ev_commented: "Commentaire",
  // AI Copilot
  copilot_assist: "Assister par IA", copilot_insert: "Insérer", copilot_inserted: "Inséré",
  copilot_error: "Assistance indisponible",
  copilot_summary: "Résumé", copilot_reply: "Réponse suggérée", copilot_sentiment: "Sentiment", copilot_intent: "Intention",
  copilot_nba: "Actions suggérées", copilot_engine: "Moteur",
  copilot_engine_ai: "IA", copilot_engine_fallback: "Automatique",
  copilot_sentiment_positive: "Positif", copilot_sentiment_neutral: "Neutre", copilot_sentiment_negative: "Négatif",
  copilot_intent_buy: "Achat", copilot_intent_rent: "Location", copilot_intent_complaint: "Réclamation",
  copilot_intent_visit: "Visite", copilot_intent_payment: "Paiement", copilot_intent_info: "Information",
  copilot_action_schedule_visit: "Planifier une visite", copilot_action_send_listing: "Envoyer un bien", copilot_action_escalate: "Escalader",
  copilot_action_request_payment: "Demander un paiement", copilot_action_share_info: "Partager une info", copilot_action_follow_up: "Relancer",
  assistant_title: "Assistant SGI", assistant_subtitle: "Là pour vous aider", assistant_welcome: "Bonjour ! Je suis l'assistant SGI. Comment puis-je vous aider à utiliser l'application ?",
  assistant_placeholder: "Saisissez votre question…", assistant_send: "Envoyer", assistant_error: "Impossible d'obtenir une réponse, réessayez.",
  assistant_open: "Ouvrir l'assistant", assistant_close: "Fermer", assistant_thinking: "Rédige…",
  assistant_goto: "Ouvrir", assistant_clear: "Nouvelle discussion",
  assistant_tip_field: "Besoin d'aide pour remplir ce champ ?", assistant_tip_error: "Une erreur est survenue — je peux vous aider ?", assistant_tip_idle: "Besoin d'aide sur cette page ?",
  assistant_pin: "Figer l'assistant", assistant_unpin: "Libérer l'assistant",
  // Lot 3 — documents
  dt_contract: "Contrat", dt_mandate: "Mandat", dt_ejari: "Ejari", dt_dld: "DLD", dt_insurance: "Assurance",
  dt_invoice: "Facture", dt_statement: "Relevé", dt_id: "Pièce ID", dt_passport: "Passeport", dt_other: "Autre",
  ds_draft: "Brouillon", ds_active: "Actif", ds_signed: "Signé", ds_archived: "Archivé",
  doc_title_required: "Le titre est obligatoire.", count_documents: "document(s)", col_entity: "Entité", col_version: "Version",
  empty_documents: "Aucun document.", document_new: "Nouveau document", field_title: "Titre", field_entity_type: "Type d'entité liée (optionnel)", field_entity_id: "UUID entité liée (optionnel)",
  // Lot 3 — owner-portal
  op_draft: "Brouillon", op_sent: "Envoyé", op_choose_owner: "— Choisir un propriétaire —", op_select_prompt: "Sélectionnez un propriétaire pour voir ses relevés.",
  op_statements_label: "Relevés", op_last_net_payout: "Dernier payout net",
  col_period: "Période", col_revenue: "Revenus", col_expenses: "Dépenses", col_net_payout: "Payout net", op_empty_statements: "Aucun relevé.",
  // Lot 3 — workflows
  wf_in_progress: "En cours", wf_approved: "Approuvé", wf_rejected: "Rejeté", wf_cancelled: "Annulé",
  wf_quote_prefix: "Devis", wf_ticket_prefix: "Ticket", wf_contract_prefix: "Contrat", wf_in_progress_count: "en cours",
  col_instance: "Instance", col_linked_object: "Objet lié", col_steps: "Étapes", empty_workflows: "Aucune instance de workflow.",
  wf_approve: "Approuver", wf_reject: "Rejeter",
  // Lot 3 — branches
  col_code: "Code", col_contact: "Contact", branch_new: "Nouvelle succursale", empty_branches: "Aucune succursale.",
  br_active: "Active", br_inactive: "Inactive", branches_active_count: "active(s)", field_phone: "Téléphone", field_email: "Email",
  name_required: "Le nom est obligatoire.",
};

export const T: Record<Lang, Translations> = { ar, en, fr };
