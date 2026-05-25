"use client";
import React, { useState } from "react";
import { Topbar, Ic, IcPhone, IcMail, IcArrowUp } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

const IcSearch2 = () => <Ic s={15}><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ic>;
const IcFilter2 = () => <Ic s={15}><path d="M3 6h18M6 12h12M10 18h4"/></Ic>;
const IcPlus2   = () => <Ic s={15}><path d="M12 5v14M5 12h14"/></Ic>;

type Status   = "active" | "prospect" | "vip" | "inactive";
type Nat      = "ae" | "sa" | "ma" | "fr" | "gb" | "in" | "ru" | "cn";

interface Person {
  id: string;
  name: string; name_ar: string;
  nat: Nat; flag: string;
  phone: string; email: string;
  budget: number;
  status: Status;
  deals: number;
  lastContact: string;
  agent: string;
  visa: boolean;
}

const NAT_LABELS: Record<Nat, string> = { ae: "Emirati", sa: "Saudi", ma: "Moroccan", fr: "French", gb: "British", in: "Indian", ru: "Russian", cn: "Chinese" };
const NAT_FLAGS:  Record<Nat, string> = { ae: "🇦🇪", sa: "🇸🇦", ma: "🇲🇦", fr: "🇫🇷", gb: "🇬🇧", in: "🇮🇳", ru: "🇷🇺", cn: "🇨🇳" };

const STATUS_CFG: Record<Status, { en: string; ar: string; fr: string; color: string }> = {
  active:   { en: "Active",    ar: "نشط",       fr: "Actif",     color: "var(--emerald)" },
  prospect: { en: "Prospect",  ar: "عميل محتمل", fr: "Prospect",  color: "var(--azure)"   },
  vip:      { en: "VIP",       ar: "VIP",        fr: "VIP",       color: "var(--gold)"    },
  inactive: { en: "Inactive",  ar: "غير نشط",    fr: "Inactif",   color: "var(--ink-4)"  },
};

const aed = (n: number) => new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

const PERSONS: Person[] = [
  { id: "p001", name: "Reem Al Hashemi",      name_ar: "ريم الهاشمي",         nat: "ae", flag: "🇦🇪", phone: "+971 50 123 4567", email: "reem@email.ae",      budget: 11_200_000, status: "vip",      deals: 2, lastContact: "2026-05-24", agent: "Yasmine K.", visa: true  },
  { id: "p002", name: "Abdullah Al Rashid",   name_ar: "عبدالله الراشد",       nat: "sa", flag: "🇸🇦", phone: "+966 55 987 6543", email: "a.rashid@gmail.com", budget: 8_500_000,  status: "vip",      deals: 3, lastContact: "2026-05-22", agent: "Omar B.",    visa: true  },
  { id: "p003", name: "Sophie Martin",        name_ar: "صوفي مارتان",          nat: "fr", flag: "🇫🇷", phone: "+33 6 12 34 56 78", email: "s.martin@gmail.com", budget: 6_400_000, status: "active",   deals: 1, lastContact: "2026-05-20", agent: "Reem M.",    visa: false },
  { id: "p004", name: "Fatima Al Zaabi",      name_ar: "فاطمة الزعابي",        nat: "ae", flag: "🇦🇪", phone: "+971 52 456 7890", email: "fatima@email.ae",    budget: 6_400_000,  status: "active",   deals: 1, lastContact: "2026-05-19", agent: "Yasmine K.", visa: false },
  { id: "p005", name: "James Thornton",       name_ar: "جيمس ثورنتون",         nat: "gb", flag: "🇬🇧", phone: "+44 7700 900000",  email: "j.thornton@uk.com",  budget: 5_800_000,  status: "active",   deals: 2, lastContact: "2026-05-18", agent: "Nadia K.",   visa: true  },
  { id: "p006", name: "Priya Sharma",         name_ar: "بريا شارما",           nat: "in", flag: "🇮🇳", phone: "+971 54 321 0987", email: "priya@email.in",     budget: 3_200_000,  status: "prospect", deals: 0, lastContact: "2026-05-15", agent: "Adel H.",    visa: false },
  { id: "p007", name: "Youssef El Amrani",    name_ar: "يوسف العمراني",        nat: "ma", flag: "🇲🇦", phone: "+212 6 12 34 56 78", email: "y.amrani@ma.com",  budget: 4_100_000,  status: "active",   deals: 1, lastContact: "2026-05-14", agent: "Omar B.",    visa: true  },
  { id: "p008", name: "Dmitri Volkov",        name_ar: "ديمتري فولكوف",        nat: "ru", flag: "🇷🇺", phone: "+971 50 876 5432", email: "d.volkov@ru.com",    budget: 9_000_000,  status: "vip",      deals: 2, lastContact: "2026-05-13", agent: "Yasmine K.", visa: true  },
  { id: "p009", name: "Li Wei",               name_ar: "لي وي",                nat: "cn", flag: "🇨🇳", phone: "+971 55 654 3210", email: "liwei@cn.com",       budget: 7_500_000,  status: "active",   deals: 1, lastContact: "2026-05-10", agent: "Reem M.",    visa: true  },
  { id: "p010", name: "Hessa Al Mansouri",    name_ar: "حصة المنصوري",         nat: "ae", flag: "🇦🇪", phone: "+971 56 789 0123", email: "hessa@email.ae",     budget: 2_500_000,  status: "prospect", deals: 0, lastContact: "2026-05-08", agent: "Nadia K.",   visa: false },
  { id: "p011", name: "Karim Benali",         name_ar: "كريم بن علي",          nat: "ma", flag: "🇲🇦", phone: "+212 6 98 76 54 32", email: "k.benali@ma.com",  budget: 2_100_000,  status: "prospect", deals: 0, lastContact: "2026-05-05", agent: "Adel H.",    visa: false },
  { id: "p012", name: "Sara Al Nuaimi",       name_ar: "سارة النعيمي",         nat: "ae", flag: "🇦🇪", phone: "+971 50 111 2233", email: "sara@email.ae",      budget: 15_000_000, status: "vip",      deals: 4, lastContact: "2026-05-25", agent: "Yasmine K.", visa: true  },
];

const AGENTS = ["All agents", "Yasmine K.", "Omar B.", "Reem M.", "Adel H.", "Nadia K."];

export function ScreenClientsPersonne() {
  const { lang } = useLang();
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const [search,  setSearch]  = useState("");
  const [status,  setStatus]  = useState<Status | "all">("all");
  const [agent,   setAgent]   = useState("All agents");
  const [visaOnly, setVisaOnly] = useState(false);

  const filtered = PERSONS.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.email.includes(q) || p.phone.includes(q);
    const matchStatus = status === "all" || p.status === status;
    const matchAgent  = agent === "All agents" || p.agent === agent;
    const matchVisa   = !visaOnly || p.visa;
    return matchSearch && matchStatus && matchAgent && matchVisa;
  });

  const title = lang === "ar" ? t.nav_personne : lang === "fr" ? "Personnes" : "Individuals";

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={title} crumb={[lang === "ar" ? t.nav_clients : "Clients"]}>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: "var(--r)", background: "var(--gold)", color: "#1A1610", border: "none", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          <IcPlus2 />
          {lang === "ar" ? "عميل جديد" : lang === "fr" ? "Nouveau client" : "New Client"}
        </button>
      </Topbar>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg-cream)" }}>

        {/* Filter bar */}
        <div style={{ padding: isMob ? "12px" : "14px 24px", background: "var(--bg-paper)", borderBottom: "1px solid var(--line-soft)", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "7px 12px", flex: isMob ? 1 : undefined, minWidth: 200 }}>
            <IcSearch2 />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lang === "ar" ? "بحث..." : lang === "fr" ? "Rechercher..." : "Search..."}
              style={{ border: "none", background: "transparent", outline: "none", fontSize: 12.5, color: "var(--ink)", width: "100%" }} />
          </div>

          {/* Status pills */}
          <div style={{ display: "flex", gap: 6 }}>
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
                  <span style={{ marginInlineStart: 5, fontSize: 10, opacity: 0.6 }}>
                    {s === "all" ? PERSONS.length : PERSONS.filter(p => p.status === s).length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Agent + Visa filters */}
          <select value={agent} onChange={e => setAgent(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-2)", fontSize: 12, cursor: "pointer" }}>
            {AGENTS.map(a => <option key={a}>{a}</option>)}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)", cursor: "pointer", whiteSpace: "nowrap" }}>
            <input type="checkbox" checked={visaOnly} onChange={e => setVisaOnly(e.target.checked)} style={{ accentColor: "var(--gold)" }} />
            {lang === "ar" ? "تأشيرة ذهبية فقط" : lang === "fr" ? "Visa Doré uniquement" : "Golden Visa only"}
          </label>

          <div style={{ marginInlineStart: "auto", fontSize: 11.5, color: "var(--ink-4)" }}>
            {filtered.length} {lang === "ar" ? "عميل" : lang === "fr" ? "client(s)" : "client(s)"}
          </div>
        </div>

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "12px" : "20px 24px" }}>
          <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
            {!isMob && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--bg-cream)" }}>
                    {[
                      lang === "ar" ? "العميل" : lang === "fr" ? "Client" : "Client",
                      lang === "ar" ? "جهة الاتصال" : lang === "fr" ? "Contact" : "Contact",
                      lang === "ar" ? "الميزانية" : lang === "fr" ? "Budget" : "Budget",
                      lang === "ar" ? "الصفقات" : lang === "fr" ? "Deals" : "Deals",
                      lang === "ar" ? "الوكيل" : lang === "fr" ? "Agent" : "Agent",
                      lang === "ar" ? "الحالة" : lang === "fr" ? "Statut" : "Status",
                    ].map(h => (
                      <th key={h} style={{ padding: "10px 18px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p, i) => {
                    const scfg = STATUS_CFG[p.status];
                    return (
                      <tr key={p.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid var(--line-soft)" : "none", cursor: "pointer" }}
                        onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = "var(--bg-cream)"}
                        onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = "transparent"}
                      >
                        <td style={{ padding: "13px 18px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--gold-ghost)", display: "grid", placeItems: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 14, fontWeight: 700, color: "var(--gold-deep)", flexShrink: 0 }}>
                              {p.name[0]}
                            </div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", display: "flex", alignItems: "center", gap: 6 }}>
                                {lang === "ar" ? p.name_ar : p.name}
                                {p.visa && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "rgba(200,160,60,0.15)", color: "var(--gold-deep)" }}>⭐ Visa</span>}
                              </div>
                              <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{p.flag} {NAT_LABELS[p.nat]} · {p.lastContact}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--ink-3)" }}><IcPhone />{p.phone}</div>
                            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: "var(--ink-3)" }}><IcMail />{p.email}</div>
                          </div>
                        </td>
                        <td style={{ padding: "13px 18px" }}>
                          <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{aed(p.budget)}</div>
                          {p.budget >= 2_000_000 && <div style={{ fontSize: 10, color: "var(--gold)", marginTop: 2 }}>✓ Golden Visa eligible</div>}
                        </td>
                        <td style={{ padding: "13px 18px", fontSize: 13, color: "var(--ink-2)" }} className="tnum">{p.deals}</td>
                        <td style={{ padding: "13px 18px", fontSize: 12.5, color: "var(--ink-3)" }}>{p.agent}</td>
                        <td style={{ padding: "13px 18px" }}>
                          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: `${scfg.color}18`, color: scfg.color }}>
                            {lang === "ar" ? scfg.ar : lang === "fr" ? scfg.fr : scfg.en}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}

            {/* Mobile cards */}
            {isMob && filtered.map((p, i) => {
              const scfg = STATUS_CFG[p.status];
              return (
                <div key={p.id} style={{ padding: "14px 16px", borderBottom: i < filtered.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--gold-ghost)", display: "grid", placeItems: "center", fontFamily: "'Cormorant Garamond',serif", fontSize: 15, fontWeight: 700, color: "var(--gold-deep)", flexShrink: 0 }}>
                      {p.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{lang === "ar" ? p.name_ar : p.name}</div>
                      <div style={{ fontSize: 10.5, color: "var(--ink-4)" }}>{p.flag} · {p.lastContact}</div>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: `${scfg.color}18`, color: scfg.color }}>{lang === "ar" ? scfg.ar : lang === "fr" ? scfg.fr : scfg.en}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--ink-3)" }}>{p.phone} · {aed(p.budget)}</div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
                {lang === "ar" ? "لا توجد نتائج" : lang === "fr" ? "Aucun résultat" : "No results"}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
