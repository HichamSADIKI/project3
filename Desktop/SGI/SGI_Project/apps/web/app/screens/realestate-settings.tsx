"use client";

import React from "react";
import { Topbar, IcSettings } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique. Le câblage à l'API /api/v1/company-settings
// (module realestate_core) viendra dans une étape ultérieure.

type Field =
  | { kind: "text"; label: string; value: string; hint?: string }
  | { kind: "toggle"; label: string; value: boolean; hint?: string };

const SECTIONS: { title: string; fields: Field[] }[] = [
  {
    title: "TVA & Devise",
    fields: [
      { kind: "text", label: "Devise", value: "AED", hint: "Dirham UAE — chiffres latins" },
      { kind: "toggle", label: "TVA activée", value: true },
      { kind: "text", label: "Taux de TVA (%)", value: "5.00", hint: "Standard UAE = 5 %" },
    ],
  },
  {
    title: "Localisation",
    fields: [
      { kind: "text", label: "Émirat par défaut", value: "Dubai (DXB)" },
      { kind: "text", label: "Fuseau horaire", value: "Asia/Dubai" },
    ],
  },
  {
    title: "Conformité UAE",
    fields: [
      { kind: "toggle", label: "Ejari activé", value: true, hint: "Enregistrement des baux Dubai" },
      { kind: "toggle", label: "DLD activé", value: true, hint: "Dubai Land Department" },
    ],
  },
  {
    title: "Références & Paiements",
    fields: [
      { kind: "text", label: "Préfixe facture", value: "INV" },
      { kind: "text", label: "Préfixe contrat", value: "CTR" },
      { kind: "text", label: "Délai de paiement (jours)", value: "30" },
      { kind: "text", label: "Mois de début d'exercice", value: "1" },
    ],
  },
];

function Toggle({ on }: { on: boolean }) {
  return (
    <span style={{
      width: 38, height: 22, borderRadius: 999, padding: 2, flexShrink: 0,
      background: on ? "var(--gold)" : "var(--line)",
      display: "inline-flex", justifyContent: on ? "flex-end" : "flex-start",
      transition: "background 0.15s ease",
    }}>
      <span style={{ width: 18, height: 18, borderRadius: 999, background: "#fff" }} />
    </span>
  );
}

export function ScreenRealEstateSettings() {
  const t = useT();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_re_settings} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 22 }}>
          <span style={{ color: "var(--gold)" }}><IcSettings /></span>
          <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_re_settings}</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18, maxWidth: 980 }}>
          {SECTIONS.map(section => (
            <div key={section.title} style={{
              background: "var(--bg-paper)", border: "1px solid var(--line-soft)",
              borderRadius: "var(--r)", padding: "20px 22px",
            }}>
              <div className="font-display" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 16 }}>{section.title}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {section.fields.map(f => (
                  <div key={f.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "var(--ink-2)", fontWeight: 500 }}>{f.label}</div>
                      {f.hint && <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 2 }}>{f.hint}</div>}
                    </div>
                    {f.kind === "toggle" ? (
                      <Toggle on={f.value} />
                    ) : (
                      <input
                        readOnly
                        value={f.value}
                        className="tnum"
                        style={{
                          width: 130, textAlign: "end", padding: "7px 10px",
                          border: "1px solid var(--line)", borderRadius: 8,
                          background: "var(--bg-cream)", color: "var(--ink)", fontSize: 13,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <button style={{
            padding: "9px 20px", background: "var(--gold)", color: "#1A1610",
            border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
}
