"use client";
import React, { useState } from "react";
import { Topbar, Ic } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const IcSearch  = () => <Ic s={15}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ic>;
const IcPlus    = () => <Ic s={15}><path d="M12 5v14M5 12h14"/></Ic>;
const IcFilter  = () => <Ic s={15}><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></Ic>;

type OrdStatus  = "completed" | "signed" | "pending" | "in_progress" | "cancelled";
type OrdType    = "spa" | "mou" | "viewing" | "dld" | "visa" | "rental" | "maintenance" | "other";
type ClientType = "individual" | "company";

interface Order {
  id: string;
  client: string; client_ar: string;
  clientType: ClientType;
  type: OrdType;
  desc_en: string; desc_ar: string; desc_fr: string;
  amount: number;
  status: OrdStatus;
  date: string;
  agent: string;
  priority: "high" | "medium" | "low";
}

const STATUS_CFG: Record<OrdStatus, { en: string; ar: string; fr: string; color: string }> = {
  completed:   { en: "Completed",   ar: "مكتمل",    fr: "Complété",    color: "var(--emerald)" },
  signed:      { en: "Signed",      ar: "موقّع",     fr: "Signé",       color: "var(--azure)"   },
  pending:     { en: "Pending",     ar: "معلّق",     fr: "En attente",  color: "var(--gold)"    },
  in_progress: { en: "In progress", ar: "جارٍ",      fr: "En cours",    color: "#8B5CF6"        },
  cancelled:   { en: "Cancelled",   ar: "ملغى",     fr: "Annulé",      color: "var(--rose)"    },
};

const TYPE_CFG: Record<OrdType, { en: string; ar: string; fr: string }> = {
  spa:         { en: "SPA Contract",    ar: "عقد SPA",           fr: "Contrat SPA"       },
  mou:         { en: "MOU",             ar: "مذكرة تفاهم",       fr: "Protocole d'accord"},
  viewing:     { en: "Property Viewing",ar: "جولة عقارية",       fr: "Visite bien"       },
  dld:         { en: "DLD Registration",ar: "تسجيل DLD",         fr: "Enregistrement DLD"},
  visa:        { en: "Golden Visa",     ar: "تأشيرة ذهبية",      fr: "Visa Doré"         },
  rental:      { en: "Rental Contract", ar: "عقد إيجار",         fr: "Contrat location"  },
  maintenance: { en: "Maintenance",     ar: "صيانة",              fr: "Maintenance"       },
  other:       { en: "Other",           ar: "أخرى",               fr: "Autre"             },
};

const PRIORITY_CFG = {
  high:   { en: "High",   ar: "عالية",   fr: "Haute",  color: "var(--rose)"    },
  medium: { en: "Medium", ar: "متوسطة",  fr: "Moyenne",color: "var(--gold)"    },
  low:    { en: "Low",    ar: "منخفضة",  fr: "Basse",  color: "var(--ink-4)"   },
};

const aed = (n: number) => n > 0
  ? new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n)
  : "—";
const fmt = (d: string) => new Date(d).toLocaleDateString("en-AE", { day: "2-digit", month: "short", year: "numeric" });

const ORDERS: Order[] = [
  { id: "ORD-2026-001", client: "Reem Al Hashemi",          client_ar: "ريم الهاشمي",                  clientType: "individual", type: "spa",         desc_en: "SPA — Palm Jumeirah Signature Villa",          desc_ar: "عقد SPA — فيلا نخلة جميرا",          desc_fr: "SPA — Villa Palm Jumeirah",          amount: 11_200_000, status: "signed",      date: "2026-03-18", agent: "Yasmine K.", priority: "high"   },
  { id: "ORD-2026-002", client: "Al Maktoum Holding",       client_ar: "مجموعة آل مكتوم القابضة",        clientType: "company",    type: "mou",         desc_en: "MOU — Exclusive Partnership 2026",             desc_ar: "مذكرة تفاهم — شراكة حصرية 2026",     desc_fr: "MOU — Partenariat exclusif 2026",     amount: 0,          status: "signed",      date: "2026-02-01", agent: "Yasmine K.", priority: "high"   },
  { id: "ORD-2026-003", client: "Abdullah Al Rashid",       client_ar: "عبدالله الراشد",                 clientType: "individual", type: "spa",         desc_en: "SPA — Downtown Dubai Penthouse 5201",          desc_ar: "عقد SPA — بنتهاوس داونتاون 5201",    desc_fr: "SPA — Penthouse Downtown 5201",       amount: 8_500_000,  status: "completed",   date: "2026-01-10", agent: "Omar B.",    priority: "high"   },
  { id: "ORD-2026-004", client: "Gulf Properties LLC",      client_ar: "شركة الخليج للعقارات",            clientType: "company",    type: "spa",         desc_en: "SPA — Business Bay Grade A Floor 12",          desc_ar: "عقد SPA — الطابق 12 الخليج التجاري", desc_fr: "SPA — Business Bay Floor 12",         amount: 6_200_000,  status: "in_progress", date: "2026-04-02", agent: "Omar B.",    priority: "high"   },
  { id: "ORD-2026-005", client: "Sophie Martin",            client_ar: "صوفي مارتان",                    clientType: "individual", type: "viewing",     desc_en: "Property Viewing — JBR Marina Gate T3",        desc_ar: "جولة عقارية — بوابة المارينا",        desc_fr: "Visite — Marina Gate JBR T3",         amount: 0,          status: "completed",   date: "2026-05-05", agent: "Reem M.",    priority: "low"    },
  { id: "ORD-2026-006", client: "Dubai Hospitality Group",  client_ar: "مجموعة دبي للضيافة",              clientType: "company",    type: "rental",      desc_en: "Long-term rental — DIFC Office Suite 800",     desc_ar: "إيجار طويل — مكتب DIFC 800",         desc_fr: "Location longue durée — DIFC 800",    amount: 980_000,    status: "signed",      date: "2026-02-14", agent: "Reem M.",    priority: "medium" },
  { id: "ORD-2026-007", client: "James Thornton",           client_ar: "جيمس ثورنتون",                   clientType: "individual", type: "visa",        desc_en: "Golden Visa Application — Property Eligible",  desc_ar: "طلب التأشيرة الذهبية — مؤهل عقاري",  desc_fr: "Demande Visa Doré — Éligible bien",   amount: 4_200,      status: "in_progress", date: "2026-04-02", agent: "Nadia K.",   priority: "medium" },
  { id: "ORD-2026-008", client: "Al Ain Properties PJSC",  client_ar: "شركة العين للعقارات",              clientType: "company",    type: "dld",         desc_en: "DLD Registration — Saadiyat Island Villa",     desc_ar: "تسجيل DLD — فيلا جزيرة السعديات",   desc_fr: "Enregistrement DLD — Saadiyat",       amount: 32_800,     status: "completed",   date: "2026-03-25", agent: "Yasmine K.", priority: "medium" },
  { id: "ORD-2026-009", client: "Fatima Al Zaabi",         client_ar: "فاطمة الزعابي",                   clientType: "individual", type: "viewing",     desc_en: "Property Viewing — Abu Dhabi Khalifa City",    desc_ar: "جولة — خليفة سيتي أبوظبي",           desc_fr: "Visite — Khalifa City Abu Dhabi",     amount: 0,          status: "pending",     date: "2026-05-20", agent: "Yasmine K.", priority: "low"    },
  { id: "ORD-2026-010", client: "Riyadh Development Co.",  client_ar: "شركة الرياض للتطوير",              clientType: "company",    type: "mou",         desc_en: "MOU — Joint Development KSA Portfolio",        desc_ar: "مذكرة تفاهم — محفظة التطوير السعودية",desc_fr: "MOU — Portefeuille développement KSA", amount: 0,          status: "pending",     date: "2026-05-12", agent: "Yasmine K.", priority: "high"   },
  { id: "ORD-2026-011", client: "Emirates Financial Ptrs", client_ar: "شركاء الإمارات الماليون",           clientType: "company",    type: "spa",         desc_en: "SPA — Emirates Hills Villa Complex",           desc_ar: "عقد SPA — مجمع فلل إمارات هيلز",    desc_fr: "SPA — Emirates Hills Complex",        amount: 5_400_000,  status: "in_progress", date: "2026-05-01", agent: "Nadia K.",   priority: "high"   },
  { id: "ORD-2026-012", client: "Mena Retail Holdings",    client_ar: "مينا القابضة للتجزئة",              clientType: "company",    type: "maintenance", desc_en: "Annual FM Service Contract — Mena Portfolio",  desc_ar: "عقد خدمات الإدارة السنوي — مينا",    desc_fr: "Contrat FM annuel — Portefeuille",     amount: 164_000,    status: "pending",     date: "2026-05-10", agent: "Reem M.",    priority: "medium" },
  { id: "ORD-2026-013", client: "Abdullah Al Rashid",      client_ar: "عبدالله الراشد",                   clientType: "individual", type: "visa",        desc_en: "Golden Visa Renewal — 10 Year",               desc_ar: "تجديد تأشيرة ذهبية — 10 سنوات",      desc_fr: "Renouvellement Visa Doré 10 ans",      amount: 4_200,      status: "completed",   date: "2026-02-28", agent: "Omar B.",    priority: "medium" },
  { id: "ORD-2026-014", client: "Saudi Luxury Hospitality",client_ar: "شركة الضيافة الفاخرة السعودية",     clientType: "company",    type: "spa",         desc_en: "SPA — Marsa Al Arab Hotel Residences",         desc_ar: "عقد SPA — مارسى العرب",               desc_fr: "SPA — Marsa Al Arab Résidences",      amount: 9_800_000,  status: "pending",     date: "2026-05-18", agent: "Omar B.",    priority: "high"   },
  { id: "ORD-2026-015", client: "Reem Al Hashemi",         client_ar: "ريم الهاشمي",                      clientType: "individual", type: "dld",         desc_en: "DLD Registration — Palm Jumeirah Villa",       desc_ar: "تسجيل DLD — فيلا نخلة جميرا",         desc_fr: "Enregistrement DLD — Palm Jumeirah",  amount: 56_000,     status: "completed",   date: "2026-03-25", agent: "Yasmine K.", priority: "low"    },
  { id: "ORD-2026-016", client: "James Thornton",          client_ar: "جيمس ثورنتون",                     clientType: "individual", type: "spa",         desc_en: "SPA — Downtown Dubai Studio 12B",              desc_ar: "عقد SPA — ستوديو داونتاون 12B",       desc_fr: "SPA — Studio Downtown 12B",           amount: 1_200_000,  status: "signed",      date: "2026-04-20", agent: "Nadia K.",   priority: "medium" },
  { id: "ORD-2025-098", client: "Gulf Properties LLC",     client_ar: "شركة الخليج للعقارات",              clientType: "company",    type: "maintenance", desc_en: "FM Contract — Gulf Properties Portfolio Q4",   desc_ar: "عقد إدارة — محفظة الخليج الربع 4",   desc_fr: "Contrat FM — Portefeuille Q4",         amount: 88_000,     status: "completed",   date: "2025-10-15", agent: "Omar B.",    priority: "low"    },
  { id: "ORD-2025-104", client: "Sophie Martin",           client_ar: "صوفي مارتان",                      clientType: "individual", type: "rental",      desc_en: "Rental Contract — JBR Sea View Apartment",    desc_ar: "عقد إيجار — شقة إطلالة بحر JBR",     desc_fr: "Contrat location — JBR vue mer",       amount: 320_000,    status: "completed",   date: "2025-11-05", agent: "Reem M.",    priority: "low"    },
];

const AGENTS   = ["all", "Yasmine K.", "Omar B.", "Reem M.", "Adel H.", "Nadia K."];
const STATUSES = ["all", ...Object.keys(STATUS_CFG)] as (OrdStatus | "all")[];
const TYPES    = ["all", ...Object.keys(TYPE_CFG)]   as (OrdType   | "all")[];

export function ScreenOrders() {
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const [search,   setSearch]   = useState("");
  const [status,   setStatus]   = useState<OrdStatus | "all">("all");
  const [type,     setType]     = useState<OrdType   | "all">("all");
  const [agent,    setAgent]    = useState("all");
  const [clientT,  setClientT]  = useState<ClientType | "all">("all");

  const lbl = (en: string, ar: string, fr: string) => lang === "ar" ? ar : lang === "fr" ? fr : en;
  const title = lbl("Orders", "الطلبات", "Commandes");

  const filtered = ORDERS.filter(o => {
    const q = search.toLowerCase();
    const ms = !q || o.client.toLowerCase().includes(q) || o.id.toLowerCase().includes(q) ||
      (lang === "ar" ? o.desc_ar : lang === "fr" ? o.desc_fr : o.desc_en).toLowerCase().includes(q);
    return ms
      && (status === "all" || o.status === status)
      && (type   === "all" || o.type   === type)
      && (agent  === "all" || o.agent  === agent)
      && (clientT === "all" || o.clientType === clientT);
  });

  /* KPIs */
  const total       = ORDERS.length;
  const pending     = ORDERS.filter(o => o.status === "pending" || o.status === "in_progress").length;
  const signed      = ORDERS.filter(o => o.status === "signed").length;
  const completed   = ORDERS.filter(o => o.status === "completed").length;
  const totalValue  = ORDERS.filter(o => o.amount > 0).reduce((s, o) => s + o.amount, 0);

  const KPI_DATA = [
    { label: lbl("Total Orders", "إجمالي الطلبات", "Total commandes"), value: total,     color: "var(--ink)",     sub: "" },
    { label: lbl("Pending / Active", "معلّق / جارٍ", "En attente / Actif"), value: pending,  color: "var(--gold)",    sub: `${Math.round(pending / total * 100)}%` },
    { label: lbl("Signed",        "موقّعة",        "Signées"),         value: signed,    color: "var(--azure)",   sub: `${Math.round(signed / total * 100)}%` },
    { label: lbl("Completed",     "مكتملة",        "Complétées"),      value: completed, color: "var(--emerald)", sub: `${Math.round(completed / total * 100)}%` },
  ];

  const thStyle: React.CSSProperties = {
    padding: "9px 14px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600,
    letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start",
    borderBottom: "1px solid var(--line-soft)", background: "var(--bg-cream)", whiteSpace: "nowrap",
  };
  const tdStyle: React.CSSProperties = { padding: "12px 14px", fontSize: 12.5, color: "var(--ink-2)" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title}>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--r)", background: "var(--gold)", color: "#1A1610", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          <IcPlus />
          {lbl("New Order", "طلب جديد", "Nouvelle commande")}
        </button>
      </Topbar>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-cream)" }}>

        {/* KPI cards */}
        <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12, padding: isMob ? "12px" : "20px 24px 0" }}>
          {KPI_DATA.map(k => (
            <div key={k.label} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "16px 18px" }}>
              <div style={{ fontSize: 11, color: "var(--ink-4)", marginBottom: 6 }}>{k.label}</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span className="tnum font-display" style={{ fontSize: 28, fontWeight: 700, color: k.color }}>{k.value}</span>
                {k.sub && <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{k.sub}</span>}
              </div>
            </div>
          ))}
        </div>

        {/* Total value banner */}
        <div style={{ margin: isMob ? "12px" : "12px 24px 0", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "12px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <span style={{ fontSize: 12, color: "var(--ink-4)" }}>{lbl("Total value (excl. free orders)", "إجمالي القيمة (دون الطلبات المجانية)", "Valeur totale (hors commandes gratuites)")}</span>
          <span className="tnum font-display" style={{ fontSize: 18, fontWeight: 700, color: "var(--gold)" }}>{aed(totalValue)}</span>
        </div>

        {/* Filter bar */}
        <div style={{ padding: isMob ? "12px" : "12px 24px", background: "var(--bg-paper)", borderBottom: "1px solid var(--line-soft)", borderTop: "1px solid var(--line-soft)", marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "7px 12px", flex: isMob ? 1 : undefined, minWidth: 200 }}>
            <IcSearch />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lbl("Search orders…", "بحث في الطلبات…", "Rechercher…")}
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "var(--ink)", width: "100%" }} />
          </div>

          {/* Status pills */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {(["all", "pending", "in_progress", "signed", "completed", "cancelled"] as const).map(s => {
              const cfg = s === "all" ? null : STATUS_CFG[s];
              const active = status === s;
              return (
                <button key={s} onClick={() => setStatus(s)} style={{
                  padding: "5px 11px", borderRadius: 999, fontSize: 11.5, fontWeight: active ? 600 : 400, cursor: "pointer",
                  background: active ? (cfg ? `${cfg.color}18` : "var(--gold)") : "transparent",
                  color: active ? (cfg ? cfg.color : "#1A1610") : "var(--ink-4)",
                  border: active ? (cfg ? `1px solid ${cfg.color}` : "1px solid var(--gold)") : "1px solid var(--line-soft)",
                }}>
                  {s === "all" ? lbl("All", "الكل", "Tout") : (lang === "ar" ? cfg!.ar : lang === "fr" ? cfg!.fr : cfg!.en)}
                </button>
              );
            })}
          </div>

          {/* Type select */}
          <select value={type} onChange={e => setType(e.target.value as OrdType | "all")}
            style={{ padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}>
            <option value="all">{lbl("All types", "كل الأنواع", "Tous types")}</option>
            {(Object.keys(TYPE_CFG) as OrdType[]).map(t => (
              <option key={t} value={t}>{lang === "ar" ? TYPE_CFG[t].ar : lang === "fr" ? TYPE_CFG[t].fr : TYPE_CFG[t].en}</option>
            ))}
          </select>

          {/* Client type toggle */}
          <select value={clientT} onChange={e => setClientT(e.target.value as ClientType | "all")}
            style={{ padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}>
            <option value="all">{lbl("All clients", "كل العملاء", "Tous clients")}</option>
            <option value="individual">{lbl("Individuals", "أشخاص", "Personnes")}</option>
            <option value="company">{lbl("Companies", "شركات", "Sociétés")}</option>
          </select>

          {/* Agent select */}
          <select value={agent} onChange={e => setAgent(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}>
            <option value="all">{lbl("All agents", "كل الوكلاء", "Tous agents")}</option>
            {AGENTS.filter(a => a !== "all").map(a => <option key={a}>{a}</option>)}
          </select>

          <div style={{ marginInlineStart: "auto", fontSize: 11.5, color: "var(--ink-4)" }}>
            {filtered.length} {lbl("order(s)", "طلب", "commande(s)")}
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "12px" : "16px 24px" }}>
          {isMob ? (
            /* Mobile cards */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(o => {
                const scfg = STATUS_CFG[o.status];
                const tcfg = TYPE_CFG[o.type];
                return (
                  <div key={o.id} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 10.5, color: "var(--ink-4)", fontFamily: "Roboto, sans-serif", marginBottom: 2 }}>{o.id}</div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{o.client}</div>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${scfg.color}15`, color: scfg.color }}>{lang === "ar" ? scfg.ar : lang === "fr" ? scfg.fr : scfg.en}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)", marginBottom: 4 }}>{lang === "ar" ? o.desc_ar : lang === "fr" ? o.desc_fr : o.desc_en}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5 }}>
                      <span style={{ color: "var(--ink-4)" }}>{lang === "ar" ? tcfg.ar : lang === "fr" ? tcfg.fr : tcfg.en} · {o.agent}</span>
                      <span className="tnum" style={{ fontWeight: 600, color: "var(--ink)" }}>{aed(o.amount)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {[
                      "N°",
                      lbl("Client", "العميل", "Client"),
                      lbl("Type", "النوع", "Type"),
                      lbl("Description", "الوصف", "Description"),
                      lbl("Amount", "المبلغ", "Montant"),
                      lbl("Priority", "الأولوية", "Priorité"),
                      lbl("Agent", "الوكيل", "Agent"),
                      lbl("Date", "التاريخ", "Date"),
                      lbl("Status", "الحالة", "Statut"),
                    ].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((o, i) => {
                    const scfg = STATUS_CFG[o.status];
                    const tcfg = TYPE_CFG[o.type];
                    const pcfg = PRIORITY_CFG[o.priority];
                    return (
                      <tr key={o.id}
                        style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--line-soft)" : "none", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-cream)"}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                      >
                        <td style={{ ...tdStyle, fontFamily: "Roboto, sans-serif", fontSize: 11, color: "var(--ink-4)" }}>{o.id}</td>
                        <td style={{ ...tdStyle }}>
                          <div style={{ fontWeight: 500, color: "var(--ink)" }}>{lang === "ar" ? o.client_ar : o.client}</div>
                          <div style={{ fontSize: 10.5, color: "var(--ink-4)", marginTop: 1 }}>
                            {o.clientType === "individual" ? lbl("Individual", "شخص", "Personne") : lbl("Company", "شركة", "Société")}
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 10.5, padding: "2px 7px", borderRadius: 999, background: "var(--bg-cream)", color: "var(--ink-3)", border: "1px solid var(--line-soft)", whiteSpace: "nowrap" }}>
                            {lang === "ar" ? tcfg.ar : lang === "fr" ? tcfg.fr : tcfg.en}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, maxWidth: 280 }}>
                          <div style={{ color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {lang === "ar" ? o.desc_ar : lang === "fr" ? o.desc_fr : o.desc_en}
                          </div>
                        </td>
                        <td style={{ ...tdStyle, fontWeight: 600, color: "var(--ink)" }} className="tnum">{aed(o.amount)}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: pcfg.color }}>
                            {lang === "ar" ? pcfg.ar : lang === "fr" ? pcfg.fr : pcfg.en}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, color: "var(--ink-3)" }}>{o.agent}</td>
                        <td style={{ ...tdStyle, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{fmt(o.date)}</td>
                        <td style={tdStyle}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: `${scfg.color}15`, color: scfg.color, whiteSpace: "nowrap" }}>
                            {lang === "ar" ? scfg.ar : lang === "fr" ? scfg.fr : scfg.en}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                  {lbl("No orders match your filters.", "لا توجد طلبات تطابق المعايير.", "Aucune commande ne correspond aux filtres.")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
