"use client";

import React, { useEffect, useState } from "react";
import { Topbar, Eyebrow, Chip, IcChevR } from "@/components/sgi-ui";
import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";
import { getJson } from "@/lib/api-client";
import type { Translations } from "@/lib/i18n";

/* ──────────────────────────────────────────────────────────────────────────
 * Écran « Process Immobilier » — vue d'orchestration LECTURE SEULE des 4 phases
 * du process vente+location (Sources → Acquisition/Watcher → Moteur central →
 * Sorties). Agrégation CÔTÉ FRONT depuis les endpoints existants (proxies admin
 * → FastAPI), tolérante aux 404 (modules marketing/sources pas encore montés).
 * Chaque tuile/segment route vers le module concerné via onNavigate(navKey).
 * RTL strict (CSS logique uniquement) ; chiffres latins en-AE.
 * ────────────────────────────────────────────────────────────────────────── */

// Lit le `meta.total` d'une enveloppe de liste {success,data,meta}. Tolérant :
// renvoie null si l'endpoint répond 404 / erreur (module non monté, etc.).
type ListEnvelope = { meta?: { total?: number } | null };
async function fetchTotal(url: string): Promise<number | null> {
  try {
    const r = await getJson<ListEnvelope>(url);
    const total = r?.meta?.total;
    return typeof total === "number" ? total : null;
  } catch {
    return null;
  }
}

// Récupère un objet KPI générique (ex. crm/pipeline → {status: count}, ou
// marketing/kpis → {impressions, clicks, leads, spend}). Tolérant aux 404.
type ObjEnvelope = { data?: Record<string, unknown> | null };
async function fetchObj(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await getJson<ObjEnvelope>(url);
    return r?.data ?? null;
  } catch {
    return null;
  }
}

function asNum(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : 0;
  return Number.isFinite(n) ? n : 0;
}

/* ─── Agrégat ────────────────────────────────────────────────────────────── */
type Metrics = {
  // Phase 1 — Sources
  leadsTotal: number | null;
  importsTotal: number | null;
  importsDuplicate: number | null;
  importsRejected: number | null;
  // Phase 2 — Acquisition / Watcher
  unitsTotal: number | null;
  watcherImports: number | null;
  // Phase 3 — Moteur central
  leadsQualified: number | null;
  salesListings: number | null;
  rentalListings: number | null;
  mkImpressions: number | null;
  mkClicks: number | null;
  mkLeads: number | null;
  mkSpend: number | null;
  // Phase 4 — Sorties
  salesTx: number | null;
  leaseApps: number | null;
  payments: number | null;
};

const EMPTY: Metrics = {
  leadsTotal: null, importsTotal: null, importsDuplicate: null, importsRejected: null,
  unitsTotal: null, watcherImports: null,
  leadsQualified: null, salesListings: null, rentalListings: null,
  mkImpressions: null, mkClicks: null, mkLeads: null, mkSpend: null,
  salesTx: null, leaseApps: null, payments: null,
};

/* ─── Formatters ─────────────────────────────────────────────────────────── */
const NUM = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });
const AED = new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 });
const fmtN = (v: number | null) => (v == null ? "—" : NUM.format(v));
const fmtAED = (v: number | null) => (v == null ? "—" : AED.format(v));

/* ─── KPI tile (cliquable) ───────────────────────────────────────────────── */
function ProcKpi({ eyebrow, value, hint, tone = "gold", navKey, onNavigate }: {
  eyebrow: string; value: string; hint?: string; tone?: "gold" | "emerald" | "azure";
  navKey?: string; onNavigate?: (k: string) => void;
}) {
  const clickable = Boolean(navKey && onNavigate);
  return (
    <button
      type="button"
      disabled={!clickable}
      onClick={() => navKey && onNavigate?.(navKey)}
      className="sgi-card"
      style={{
        padding: 16, display: "flex", flexDirection: "column", gap: 8,
        textAlign: "start", border: "1px solid var(--line-soft)",
        background: "var(--bg-ivory)", cursor: clickable ? "pointer" : "default",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <Eyebrow>{eyebrow}</Eyebrow>
        {clickable && <span style={{ display: "inline-flex", color: "var(--ink-4)" }}><IcChevR /></span>}
      </div>
      <div className="font-display tnum" style={{ fontSize: 30, lineHeight: 1, color: `var(--${tone})` }}>{value}</div>
      {hint && <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: "0.03em" }}>{hint}</div>}
    </button>
  );
}

/* ─── Section de phase ───────────────────────────────────────────────────── */
function Phase({ index, title, subtitle, children }: {
  index: number; title: string; subtitle: string; children: React.ReactNode;
}) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
          display: "grid", placeItems: "center", background: "var(--ink)",
          color: "var(--gold)", fontSize: 13, fontWeight: 700,
        }} className="tnum">{index}</div>
        <div>
          <div className="font-display" style={{ fontSize: 19, color: "var(--ink)" }}>{title}</div>
          <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 1 }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </section>
  );
}

/* ─── Funnel cliquable ───────────────────────────────────────────────────── */
function Funnel({ steps }: { steps: { label: string; value: number | null; navKey?: string; onNavigate?: (k: string) => void }[] }) {
  const nums = steps.map((s) => (s.value == null ? 0 : s.value));
  const max = Math.max(1, ...nums);
  return (
    <div className="sgi-card" style={{ padding: 18, display: "grid", gridTemplateColumns: `repeat(${steps.length}, 1fr)`, gap: 10 }}>
      {steps.map((s, i) => {
        const ratio = s.value == null ? 0 : (s.value / max);
        const clickable = Boolean(s.navKey && s.onNavigate);
        return (
          <button
            key={i}
            type="button"
            disabled={!clickable}
            onClick={() => s.navKey && s.onNavigate?.(s.navKey)}
            style={{
              border: "1px solid var(--line-soft)", borderRadius: "var(--r)",
              background: "var(--bg-ivory)", padding: 12, textAlign: "start",
              display: "flex", flexDirection: "column", gap: 8, position: "relative",
              overflow: "hidden", cursor: clickable ? "pointer" : "default", minWidth: 0,
            }}
          >
            <div style={{ position: "absolute", insetBlockStart: 0, insetInlineStart: 0, height: 3, width: `${Math.max(6, ratio * 100)}%`, background: "var(--gold)" }} />
            <div style={{ fontSize: 10.5, color: "var(--ink-4)", letterSpacing: "0.06em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.label}</div>
            <div className="font-display tnum" style={{ fontSize: 24, color: "var(--ink)" }}>{fmtN(s.value)}</div>
          </button>
        );
      })}
    </div>
  );
}

/* ─── i18n helper (clés proc_* éventuellement absentes → fallback) ───────── */
function tx(t: Translations, key: string, fallback: string): string {
  const v = (t as unknown as Record<string, string>)[key];
  return v ?? fallback;
}

/* ─── Screen ─────────────────────────────────────────────────────────────── */
export function ScreenRealEstateProcess({ onNavigate }: { onNavigate?: (screen: string) => void } = {}) {
  const t = useT();
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const [m, setM] = useState<Metrics>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      const [
        leadsTotal,
        unitsTotal,
        salesTx,
        leaseApps,
        payments,
        salesListings,
        rentalListings,
        pipeline,
        mkKpis,
        imports,
        watcher,
      ] = await Promise.all([
        fetchTotal("/api/admin/crm/leads?category=realestate&limit=1"),
        fetchTotal("/api/admin/units?limit=1"),
        fetchTotal("/api/admin/sales/transactions?limit=1"),
        fetchTotal("/api/admin/leasing/applications?limit=1"),
        fetchTotal("/api/admin/payments/requests?limit=1"),
        fetchTotal("/api/admin/sales/listings?status=published&limit=1"),
        fetchTotal("/api/admin/leasing/listings?status=published&limit=1"),
        fetchObj("/api/admin/crm/pipeline"),
        fetchObj("/api/admin/marketing/kpis"),
        fetchTotal("/api/admin/sources/imports?limit=1"),
        fetchTotal("/api/admin/sources/imports?source_channel=watcher&limit=1"),
      ]);

      if (cancelled) return;

      // Leads qualifiés depuis pipeline (somme des étapes "chaudes").
      let leadsQualified: number | null = null;
      if (pipeline) {
        const hot = ["qualified", "proposal_sent", "visit_planned", "visit_done", "negotiation", "won"];
        leadsQualified = hot.reduce((acc, k) => acc + asNum(pipeline[k]), 0);
      }

      // Rejets/duplicates imports : si l'endpoint sources existe (imports non-null),
      // on tente les sous-totaux ; sinon on laisse null (fallback gracieux).
      let importsDuplicate: number | null = null;
      let importsRejected: number | null = null;
      if (imports != null) {
        [importsDuplicate, importsRejected] = await Promise.all([
          fetchTotal("/api/admin/sources/imports?status=duplicate&limit=1"),
          fetchTotal("/api/admin/sources/imports?status=rejected&limit=1"),
        ]);
      }
      if (cancelled) return;

      setM({
        leadsTotal,
        importsTotal: imports,
        importsDuplicate,
        importsRejected,
        unitsTotal,
        watcherImports: watcher,
        leadsQualified,
        salesListings,
        rentalListings,
        mkImpressions: mkKpis ? asNum(mkKpis.impressions) : null,
        mkClicks: mkKpis ? asNum(mkKpis.clicks) : null,
        mkLeads: mkKpis ? asNum(mkKpis.leads) : null,
        mkSpend: mkKpis ? asNum(mkKpis.spend ?? mkKpis.spend_aed) : null,
        salesTx,
        leaseApps,
        payments,
      });

      // Tout est null = aucun endpoint joignable (session/proxy KO).
      const allNull = [leadsTotal, unitsTotal, salesTx, leaseApps, payments].every((v) => v == null);
      if (allNull) setError("load_failed");
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  const gridCols = isMob ? "repeat(2, 1fr)" : "repeat(4, 1fr)";

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <Topbar title={tx(t, "nav_re_process", "Process")}>
        <Chip tone="gold">{tx(t, "proc_eyebrow", "End-to-end")}</Chip>
      </Topbar>

      <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden", scrollbarGutter: "stable", padding: isMob ? 14 : 28, display: "flex", flexDirection: "column", gap: 28, background: "var(--bg-cream)" }}>

        {/* État erreur global (aucun endpoint joignable) */}
        {error && !loading && (
          <div className="sgi-card" style={{ padding: 18, textAlign: "center", color: "var(--rose)", fontSize: 13 }}>
            {tx(t, "load_error", "Loading failed")}
          </div>
        )}

        {/* État chargement */}
        {loading && (
          <div className="sgi-card" style={{ padding: 24, textAlign: "center", color: "var(--ink-4)", fontSize: 13 }}>
            {tx(t, "loading", "Loading…")}
          </div>
        )}

        {!loading && (
          <>
            {/* ── Funnel global cliquable ───────────────────────────────── */}
            <Funnel steps={[
              { label: tx(t, "proc_f_leads", "Leads"), value: m.leadsTotal, navKey: "crm", onNavigate },
              { label: tx(t, "proc_f_units", "Units"), value: m.unitsTotal, navKey: "realestate_units", onNavigate },
              { label: tx(t, "proc_f_listed", "Listed"), value: (m.salesListings ?? 0) + (m.rentalListings ?? 0), navKey: "realestate_vente", onNavigate },
              { label: tx(t, "proc_f_deals", "Deals"), value: (m.salesTx ?? 0) + (m.leaseApps ?? 0), navKey: "realestate_location", onNavigate },
              { label: tx(t, "proc_f_payments", "Collection"), value: m.payments, navKey: "realestate_payments", onNavigate },
            ]} />

            {/* ── Phase 1 — Sources ─────────────────────────────────────── */}
            <Phase index={1} title={tx(t, "proc_phase1_sources", "Sources")} subtitle={tx(t, "proc_phase1_sub", "Multi-source lead ingestion")}>
              <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 14 }}>
                <ProcKpi eyebrow={tx(t, "proc_k_leads", "CRM leads")} value={fmtN(m.leadsTotal)} tone="gold" navKey="crm" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_imports", "Imports")} value={fmtN(m.importsTotal)} hint={m.importsTotal == null ? tx(t, "proc_module_off", "Module not installed") : undefined} tone="azure" navKey="realestate_marketing" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_duplicates", "Duplicates")} value={fmtN(m.importsDuplicate)} tone="emerald" />
                <ProcKpi eyebrow={tx(t, "proc_k_rejected", "Rejected")} value={fmtN(m.importsRejected)} tone="gold" />
              </div>
            </Phase>

            {/* ── Phase 2 — Acquisition / Watcher ───────────────────────── */}
            <Phase index={2} title={tx(t, "proc_phase2_acquisition", "Acquisition & Watcher")} subtitle={tx(t, "proc_phase2_sub", "Inventory & scheduled monitoring")}>
              <div style={{ display: "grid", gridTemplateColumns: isMob ? "repeat(2, 1fr)" : "repeat(2, 1fr)", gap: 14 }}>
                <ProcKpi eyebrow={tx(t, "proc_k_units", "Units in inventory")} value={fmtN(m.unitsTotal)} tone="gold" navKey="realestate_units" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_watcher", "Watcher captures")} value={fmtN(m.watcherImports)} hint={m.watcherImports == null ? tx(t, "proc_module_off", "Module not installed") : undefined} tone="azure" />
              </div>
            </Phase>

            {/* ── Phase 3 — Moteur central ──────────────────────────────── */}
            <Phase index={3} title={tx(t, "proc_phase3_engine", "Central engine")} subtitle={tx(t, "proc_phase3_sub", "Qualification, marketing & publication")}>
              <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 14 }}>
                <ProcKpi eyebrow={tx(t, "proc_k_qualified", "Qualified leads")} value={fmtN(m.leadsQualified)} tone="emerald" navKey="crm" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_sale_listings", "Sale listings")} value={fmtN(m.salesListings)} tone="gold" navKey="realestate_vente" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_rent_listings", "Rent listings")} value={fmtN(m.rentalListings)} tone="gold" navKey="realestate_location" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_mk_leads", "Marketing leads")} value={fmtN(m.mkLeads)} hint={m.mkLeads == null ? tx(t, "proc_module_off", "Module not installed") : undefined} tone="azure" navKey="realestate_marketing" onNavigate={onNavigate} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 14 }}>
                <ProcKpi eyebrow={tx(t, "proc_k_impressions", "Impressions")} value={fmtN(m.mkImpressions)} tone="azure" navKey="realestate_marketing" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_clicks", "Clicks")} value={fmtN(m.mkClicks)} tone="azure" navKey="realestate_marketing" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_spend", "Spend")} value={fmtAED(m.mkSpend)} tone="gold" navKey="realestate_marketing" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_listed_total", "Total listed")} value={fmtN((m.salesListings ?? 0) + (m.rentalListings ?? 0))} tone="emerald" navKey="realestate_vente" onNavigate={onNavigate} />
              </div>
            </Phase>

            {/* ── Phase 4 — Sorties ─────────────────────────────────────── */}
            <Phase index={4} title={tx(t, "proc_phase4_outputs", "Outputs")} subtitle={tx(t, "proc_phase4_sub", "Sales, leases & collection")}>
              <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 14 }}>
                <ProcKpi eyebrow={tx(t, "proc_k_sales_tx", "Sale deals")} value={fmtN(m.salesTx)} tone="gold" navKey="realestate_vente" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_lease_apps", "Lease applications")} value={fmtN(m.leaseApps)} tone="gold" navKey="realestate_location" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_payments", "Payment requests")} value={fmtN(m.payments)} tone="emerald" navKey="realestate_payments" onNavigate={onNavigate} />
                <ProcKpi eyebrow={tx(t, "proc_k_deals_total", "Total deals")} value={fmtN((m.salesTx ?? 0) + (m.leaseApps ?? 0))} tone="emerald" navKey="realestate_location" onNavigate={onNavigate} />
              </div>
            </Phase>

            <div style={{ fontSize: 11, color: "var(--ink-4)", letterSpacing: "0.03em", marginTop: 4 }}>
              {lang === "ar" ? "اضغط على أي بطاقة للانتقال إلى الوحدة." : lang === "fr" ? "Cliquez sur une tuile pour ouvrir le module." : "Click any tile to open the module."}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
