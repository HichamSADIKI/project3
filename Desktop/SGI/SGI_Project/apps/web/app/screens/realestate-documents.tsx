"use client";

import React from "react";
import { Topbar, IcDoc, IcPlus, IcCheck, IcClock } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Maquette statique. Câblage à l'API /api/v1/documents (versioning + signature
// interne UAE) prévu lors d'une étape de wiring ultérieure.

const TYPE_LABEL: Record<string, string> = {
  contract: "Contrat", mandate: "Mandat", ejari: "Ejari", dld: "DLD",
  insurance: "Assurance", invoice: "Facture", statement: "Relevé",
  id: "Pièce ID", passport: "Passeport", other: "Autre",
};

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  draft:    { label: "Brouillon", color: "var(--ink-4)",  bg: "var(--line-soft)" },
  active:   { label: "Actif",     color: "var(--azure)",  bg: "rgba(56,132,255,0.12)" },
  signed:   { label: "Signé",     color: "var(--emerald)", bg: "rgba(16,185,129,0.12)" },
  archived: { label: "Archivé",   color: "var(--ink-3)",  bg: "var(--line-soft)" },
};

const DOCS = [
  { title: "Bail — Marina Tower #1204", type: "contract", entity: "Contrat · DXB-2024-1182", version: 3, status: "signed", signed: 2, total: 2 },
  { title: "Mandat de gestion — Y. Rahman", type: "mandate", entity: "Propriétaire", version: 1, status: "active", signed: 0, total: 1 },
  { title: "Ejari — Business Bay #0901", type: "ejari", entity: "Unité · BB-0901", version: 2, status: "active", signed: 1, total: 2 },
  { title: "Assurance bâtiment — Corniche", type: "insurance", entity: "Bâtiment · BR-003", version: 1, status: "draft", signed: 0, total: 0 },
];

export function ScreenRealEstateDocuments() {
  const t = useT();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_documents} />

      <div style={{ flex: 1, overflowY: "auto", padding: "28px 32px", background: "var(--bg-cream)" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22, gap: 16, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: "var(--gold)" }}><IcDoc /></span>
            <div>
              <div className="font-display" style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)" }}>{t.nav_documents}</div>
              <div style={{ fontSize: 12, color: "var(--ink-4)" }}>{DOCS.length} · versioning & signature électronique</div>
            </div>
          </div>
          <button style={{
            display: "flex", alignItems: "center", gap: 8, padding: "9px 16px",
            background: "var(--gold)", color: "#1A1610", border: "none",
            borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: "pointer",
          }}>
            <IcPlus /> {t.add}
          </button>
        </div>

        <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "var(--bg-cream)", color: "var(--ink-4)", fontSize: 11.5, textTransform: "uppercase", letterSpacing: 0.4 }}>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>{t.nav_documents}</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Type</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Entité</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Version</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Signatures</th>
                <th style={{ textAlign: "start", padding: "12px 16px", fontWeight: 600 }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {DOCS.map(d => {
                const st = STATUS_STYLE[d.status];
                const fullySigned = d.total > 0 && d.signed === d.total;
                return (
                  <tr key={d.title} style={{ borderTop: "1px solid var(--line-soft)" }}>
                    <td style={{ padding: "13px 16px", fontWeight: 500, color: "var(--ink)" }}>{d.title}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-2)" }}>{TYPE_LABEL[d.type]}</td>
                    <td style={{ padding: "13px 16px", color: "var(--ink-3)" }}>{d.entity}</td>
                    <td className="tnum" style={{ padding: "13px 16px", color: "var(--ink-2)" }}>v{d.version}</td>
                    <td style={{ padding: "13px 16px" }}>
                      {d.total === 0 ? (
                        <span style={{ color: "var(--ink-4)" }}>—</span>
                      ) : (
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 5,
                          color: fullySigned ? "var(--emerald)" : "var(--gold-deep)", fontWeight: 600,
                        }}>
                          {fullySigned ? <IcCheck /> : <IcClock />} {d.signed}/{d.total}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "13px 16px" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 999, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
