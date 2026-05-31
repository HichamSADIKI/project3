"use client";

import React, { useEffect, useState } from "react";
import { Topbar, IcSettings } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { getJson } from "@/lib/api-client";

// Câblé sur /api/admin/company-settings → /api/v1/company-settings (objet unique).

type Settings = {
  currency: string; vat_enabled: boolean; vat_rate: string;
  default_emirate: string; timezone: string; ejari_enabled: boolean;
  dld_enabled: boolean; fiscal_year_start_month: number;
  invoice_prefix: string; contract_prefix: string; default_payment_terms_days: number;
};

function Toggle({ on }: { on: boolean }) {
  return (
    <span style={{ width: 38, height: 22, borderRadius: 999, padding: 2, flexShrink: 0, background: on ? "var(--gold)" : "var(--line)", display: "inline-flex", justifyContent: on ? "flex-end" : "flex-start" }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: "#fff" }} />
    </span>
  );
}

export function ScreenRealEstateSettings() {
  const t = useT();
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getJson<{ data: Settings }>("/api/admin/company-settings")
      .then(r => { if (!cancelled) { setS(r.data); setError(null); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "load_failed"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const sections: { title: string; rows: { label: string; value: React.ReactNode }[] }[] = s ? [
    { title: "TVA & Devise", rows: [
      { label: "Devise", value: s.currency },
      { label: "TVA activée", value: <Toggle on={s.vat_enabled} /> },
      { label: "Taux de TVA (%)", value: s.vat_rate },
    ]},
    { title: "Localisation", rows: [
      { label: "Émirat par défaut", value: s.default_emirate },
      { label: "Fuseau horaire", value: s.timezone },
    ]},
    { title: "Conformité UAE", rows: [
      { label: "Ejari activé", value: <Toggle on={s.ejari_enabled} /> },
      { label: "DLD activé", value: <Toggle on={s.dld_enabled} /> },
    ]},
    { title: "Références & Paiements", rows: [
      { label: "Préfixe facture", value: s.invoice_prefix },
      { label: "Préfixe contrat", value: s.contract_prefix },
      { label: "Délai de paiement (jours)", value: s.default_payment_terms_days },
      { label: "Mois de début d'exercice", value: s.fiscal_year_start_month },
    ]},
  ] : [];

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_re_settings} />
      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{ color: "var(--gold)" }}><IcSettings /></span>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_re_settings}</div>
        </div>
        {loading && <div style={{ color: "var(--ink-4)", fontSize: 13 }}>Chargement…</div>}
        {error && <div style={{ padding: "12px 16px", borderRadius: "var(--r)", background: "var(--rose-soft)", color: "var(--rose)", fontSize: 13 }}>Erreur : {error}</div>}

        {s && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, maxWidth: 980 }}>
            {sections.map(sec => (
              <div key={sec.title} style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: "20px 22px" }}>
                <div className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>{sec.title}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  {sec.rows.map(r => (
                    <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                      <div style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 500 }}>{r.label}</div>
                      <div className="tnum" style={{ fontSize: 13, color: "var(--ink)", fontWeight: 600 }}>{r.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
