"use client";
import React, { useState } from "react";
import { Topbar, Ic, IcPhone, IcMail } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const IcSearch2 = () => <Ic s={15}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ic>;
const IcPlus2   = () => <Ic s={15}><path d="M12 5v14M5 12h14"/></Ic>;
const IcGlobe   = () => <Ic s={14}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Ic>;

type Status  = "active" | "prospect" | "vip" | "inactive";
type Sector  = "realestate" | "investment" | "construction" | "retail" | "hospitality" | "finance" | "other";

interface Company {
  id: string;
  name: string; name_ar: string;
  country: string; flag: string;
  sector: Sector;
  contact: string; phone: string; email: string; website?: string;
  annualRevenue: number;
  deals: number;
  status: Status;
  agent: string;
  vatNo?: string;
}

const SECTOR_CFG: Record<Sector, { en: string; ar: string; fr: string; color: string }> = {
  realestate:   { en: "Real Estate",   ar: "عقارات",          fr: "Immobilier",    color: "var(--gold)"    },
  investment:   { en: "Investment",    ar: "استثمار",          fr: "Investissement",color: "var(--azure)"   },
  construction: { en: "Construction",  ar: "بناء وتشييد",      fr: "Construction",  color: "var(--emerald)" },
  retail:       { en: "Retail",        ar: "تجزئة",            fr: "Commerce",      color: "#8B5CF6"        },
  hospitality:  { en: "Hospitality",   ar: "ضيافة وفنادق",     fr: "Hôtellerie",    color: "var(--rose)"    },
  finance:      { en: "Finance",       ar: "مالية",             fr: "Finance",       color: "#F59E0B"        },
  other:        { en: "Other",         ar: "أخرى",              fr: "Autre",         color: "var(--ink-4)"  },
};

const STATUS_CFG: Record<Status, { en: string; ar: string; fr: string; color: string }> = {
  active:   { en: "Active",    ar: "نشطة",       fr: "Active",    color: "var(--emerald)" },
  prospect: { en: "Prospect",  ar: "محتملة",      fr: "Prospect",  color: "var(--azure)"   },
  vip:      { en: "VIP",       ar: "VIP",         fr: "VIP",       color: "var(--gold)"    },
  inactive: { en: "Inactive",  ar: "غير نشطة",    fr: "Inactive",  color: "var(--ink-4)"  },
};

const aed = (n: number) => new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const COMPANIES: Company[] = [
  { id: "c001", name: "Al Maktoum Holding",          name_ar: "مجموعة آل مكتوم القابضة",    country: "UAE", flag: "🇦🇪", sector: "investment",   contact: "Sultan Al Maktoum",    phone: "+971 4 123 4567", email: "info@amholding.ae",     website: "amholding.ae",     annualRevenue: 18_400_000, deals: 4, status: "vip",      agent: "Yasmine K.", vatNo: "100345678900003" },
  { id: "c002", name: "Gulf Properties LLC",          name_ar: "شركة الخليج للعقارات",        country: "UAE", flag: "🇦🇪", sector: "realestate",   contact: "Mariam Al Suwaidi",    phone: "+971 4 987 6543", email: "m.suwaidi@gulfprop.ae", website: "gulfprop.ae",      annualRevenue: 7_800_000,  deals: 6, status: "vip",      agent: "Omar B.",    vatNo: "100567890100003" },
  { id: "c003", name: "Invest Maroc SARL",            name_ar: "إنفيست المغرب",               country: "Morocco", flag: "🇲🇦", sector: "investment", contact: "Mehdi Bensouda",      phone: "+212 5 22 34 56 78", email: "m.bensouda@investma.com", annualRevenue: 5_200_000, deals: 3, status: "active",    agent: "Omar B."    },
  { id: "c004", name: "Riyadh Development Co.",       name_ar: "شركة الرياض للتطوير",         country: "KSA",     flag: "🇸🇦", sector: "construction", contact: "Turki Al Faisal",   phone: "+966 11 234 5678", email: "t.faisal@rdc.sa",        website: "rdc.sa",           annualRevenue: 9_100_000,  deals: 2, status: "active",   agent: "Yasmine K.", vatNo: "300123456700003" },
  { id: "c005", name: "Dubai Hospitality Group",      name_ar: "مجموعة دبي للضيافة",          country: "UAE", flag: "🇦🇪", sector: "hospitality",  contact: "Khalid Al Qasimi",     phone: "+971 4 567 8901", email: "k.qasimi@dhg.ae",       website: "dhg.ae",           annualRevenue: 12_500_000, deals: 5, status: "vip",      agent: "Reem M.",    vatNo: "100987654300003" },
  { id: "c006", name: "Casablanca Real Estate SA",    name_ar: "الدار البيضاء للعقارات",      country: "Morocco", flag: "🇲🇦", sector: "realestate", contact: "Leila Chraibi",       phone: "+212 5 22 98 76 54", email: "l.chraibi@crsa.ma",      annualRevenue: 3_400_000,  deals: 2, status: "active",   agent: "Adel H."    },
  { id: "c007", name: "Emirates Financial Partners",  name_ar: "شركاء الإمارات الماليون",     country: "UAE", flag: "🇦🇪", sector: "finance",      contact: "Ahmad Al Muhairi",     phone: "+971 2 345 6789", email: "a.muhairi@efp.ae",      website: "efp.ae",           annualRevenue: 6_700_000,  deals: 3, status: "active",   agent: "Nadia K.",   vatNo: "100234567800003" },
  { id: "c008", name: "Vision Construct KSA",         name_ar: "رؤية للإنشاء المملكة",        country: "KSA",     flag: "🇸🇦", sector: "construction", contact: "Nora Al Turki",     phone: "+966 12 456 7890", email: "n.turki@vcksa.sa",       website: "vcksa.sa",         annualRevenue: 4_800_000,  deals: 1, status: "prospect", agent: "Adel H."    },
  { id: "c009", name: "Mena Retail Holdings",         name_ar: "مينا القابضة للتجزئة",        country: "UAE", flag: "🇦🇪", sector: "retail",       contact: "Sara Al Dhaheri",      phone: "+971 4 678 9012", email: "s.dhaheri@mena-retail.ae",website: "mena-retail.ae",  annualRevenue: 8_200_000,  deals: 2, status: "active",   agent: "Reem M.",    vatNo: "100876543200003" },
  { id: "c010", name: "Infinity Maroc Partners",      name_ar: "إنفينيتي شركاء المغرب",       country: "Morocco", flag: "🇲🇦", sector: "investment", contact: "Rachid El Fassi",     phone: "+212 5 37 12 34 56", email: "r.elfassi@imp.ma",       annualRevenue: 2_900_000,  deals: 1, status: "prospect", agent: "Yasmine K." },
  { id: "c011", name: "Al Ain Properties PJSC",       name_ar: "شركة العين للعقارات",         country: "UAE", flag: "🇦🇪", sector: "realestate",   contact: "Hamdan Al Nahyan",     phone: "+971 3 789 0123", email: "h.alnahyan@aap.ae",     website: "aap.ae",           annualRevenue: 14_300_000, deals: 7, status: "vip",      agent: "Yasmine K.", vatNo: "100765432100003" },
  { id: "c012", name: "Saudi Luxury Hospitality Co.", name_ar: "شركة الضيافة الفاخرة السعودية",country: "KSA", flag: "🇸🇦", sector: "hospitality", contact: "Faisal Al Saud",       phone: "+966 11 890 1234", email: "f.alsaud@slhc.sa",       website: "slhc.sa",          annualRevenue: 11_600_000, deals: 3, status: "vip",      agent: "Omar B."    },
];

const AGENTS = ["All agents", "Yasmine K.", "Omar B.", "Reem M.", "Adel H.", "Nadia K."];
const SECTORS = ["all", ...Object.keys(SECTOR_CFG)] as const;

export function ScreenClientsSociete() {
  const { lang } = useLang();
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState<Status | "all">("all");
  const [sector,  setSector]  = useState<Sector | "all">("all");
  const [agent,   setAgent]   = useState("All agents");

  const filtered = COMPANIES.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || c.name.toLowerCase().includes(q) || c.contact.toLowerCase().includes(q) || c.email.includes(q);
    const matchStatus = status === "all" || c.status === status;
    const matchSector = sector === "all" || c.sector === sector;
    const matchAgent  = agent === "All agents" || c.agent === agent;
    return matchSearch && matchStatus && matchSector && matchAgent;
  });

  const title = lang === "ar" ? t.nav_societe : lang === "fr" ? "Sociétés" : "Companies";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title} crumb={[lang === "ar" ? t.nav_clients : "Clients"]}>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--r)", background: "var(--gold)", color: "#1A1610", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          <IcPlus2 />
          {lang === "ar" ? "شركة جديدة" : lang === "fr" ? "Nouvelle société" : "New Company"}
        </button>
      </Topbar>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-cream)" }}>

        {/* Filter bar */}
        <div style={{ padding: isMob ? "12px" : "14px 24px", background: "var(--bg-paper)", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "7px 12px", flex: isMob ? 1 : undefined, minWidth: 200 }}>
            <IcSearch2 />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "بحث..." : lang === "fr" ? "Rechercher..." : "Search..."}
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "var(--ink)", width: "100%" }} />
          </div>

          {/* Status pills */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all", "vip", "active", "prospect", "inactive"] as const).map(s => {
              const cfg = s === "all" ? null : STATUS_CFG[s];
              const active = status === s;
              return (
                <button key={s} onClick={() => setStatus(s)}
                  style={{
                    padding: "6px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: active ? 600 : 400, cursor: "pointer", whiteSpace: "nowrap",
                    background: active ? (cfg ? `${cfg.color}18` : "var(--gold)") : "transparent",
                    color: active ? (cfg ? cfg.color : "#1A1610") : "var(--ink-4)",
                    border: active ? (cfg ? `1px solid ${cfg.color}` : "1px solid var(--gold)") : "1px solid var(--line-soft)",
                  }}
                >
                  {s === "all" ? (lang === "ar" ? "الكل" : lang === "fr" ? "Tous" : "All") : (lang === "ar" ? cfg!.ar : lang === "fr" ? cfg!.fr : cfg!.en)}
                </button>
              );
            })}
          </div>

          <select value={sector} onChange={e => setSector(e.target.value as Sector | "all")}
            style={{ padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}>
            <option value="all">{lang === "ar" ? "كل القطاعات" : lang === "fr" ? "Tous secteurs" : "All sectors"}</option>
            {(Object.keys(SECTOR_CFG) as Sector[]).map(s => (
              <option key={s} value={s}>{lang === "ar" ? SECTOR_CFG[s].ar : lang === "fr" ? SECTOR_CFG[s].fr : SECTOR_CFG[s].en}</option>
            ))}
          </select>

          <select value={agent} onChange={e => setAgent(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}>
            {AGENTS.map(a => <option key={a}>{a}</option>)}
          </select>

          <div style={{ marginInlineStart: "auto", fontSize: 11.5, color: "var(--ink-4)" }}>
            {filtered.length} {lang === "ar" ? "شركة" : lang === "fr" ? "société(s)" : "company(-ies)"}
          </div>
        </div>

        {/* Cards grid / table */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "12px" : "20px 24px" }}>
          {isMob ? (
            /* Mobile: card stack */
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(c => {
                const scfg = STATUS_CFG[c.status];
                const secfg = SECTOR_CFG[c.sector];
                return (
                  <div key={c.id} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "14px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                      <div style={{ width: 38, height: 38, borderRadius: "var(--r-sm)", background: `${secfg.color}15`, display: "grid", placeItems: "center", color: secfg.color, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                        {c.name[0]}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{lang === "ar" ? c.name_ar : c.name}</div>
                        <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{c.flag} {c.country}</div>
                      </div>
                      <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${scfg.color}18`, color: scfg.color }}>{lang === "ar" ? scfg.ar : lang === "fr" ? scfg.fr : scfg.en}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{c.contact} · {aed(c.annualRevenue)}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Desktop: full table */
            <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-cream)" }}>
                    {[
                      lang === "ar" ? "الشركة" : lang === "fr" ? "Société" : "Company",
                      lang === "ar" ? "القطاع" : lang === "fr" ? "Secteur" : "Sector",
                      lang === "ar" ? "جهة الاتصال" : lang === "fr" ? "Contact" : "Contact",
                      lang === "ar" ? "الإيرادات" : lang === "fr" ? "Chiffre d'affaires" : "Revenue",
                      lang === "ar" ? "الصفقات" : lang === "fr" ? "Deals" : "Deals",
                      lang === "ar" ? "الوكيل" : lang === "fr" ? "Agent" : "Agent",
                      lang === "ar" ? "الحالة" : lang === "fr" ? "Statut" : "Status",
                    ].map(h => (
                      <th key={h} style={{ padding: "10px 16px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => {
                    const scfg  = STATUS_CFG[c.status];
                    const secfg = SECTOR_CFG[c.sector];
                    return (
                      <tr key={c.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--line-soft)" : "none", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-cream)"}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                      >
                        <td style={{ padding: "13px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: "var(--r-sm)", background: `${secfg.color}15`, display: "grid", placeItems: "center", color: secfg.color, fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                              {c.name[0]}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{lang === "ar" ? c.name_ar : c.name}</div>
                              <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{c.flag} {c.country}{c.vatNo ? ` · TVA ${c.vatNo}` : ""}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 9px", borderRadius: 999, background: `${secfg.color}12`, color: secfg.color }}>
                            {lang === "ar" ? secfg.ar : lang === "fr" ? secfg.fr : secfg.en}
                          </span>
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-2)", marginBottom: 3 }}>{c.contact}</div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--ink-4)" }}><IcPhone />{c.phone}</div>
                            {c.website && <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--azure)" }}><IcGlobe />{c.website}</div>}
                          </div>
                        </td>
                        <td style={{ padding: "13px 16px" }}>
                          <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{aed(c.annualRevenue)}</div>
                        </td>
                        <td style={{ padding: "13px 16px", fontSize: 13, color: "var(--ink-2)" }} className="tnum">{c.deals}</td>
                        <td style={{ padding: "13px 16px", fontSize: 12.5, color: "var(--ink-3)" }}>{c.agent}</td>
                        <td style={{ padding: "13px 16px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: `${scfg.color}18`, color: scfg.color }}>
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
                  {lang === "ar" ? "لا توجد نتائج" : lang === "fr" ? "Aucun résultat" : "No results"}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
