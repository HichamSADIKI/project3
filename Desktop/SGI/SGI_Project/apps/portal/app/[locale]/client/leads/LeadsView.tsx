"use client";

import { useMemo, useState } from "react";

export interface MyLead {
  id: string;
  reference: string | null;
  status: string;
  category: string;
  source: string | null;
  budget: number | null;
  property_type: string | null;
  preferred_location: string | null;
  golden_visa_eligible: boolean;
  score: number;
  notes: string | null;
  created_at: string;
}

export interface LeadsLabels {
  empty: string;
  cta: string;
  ctaHref: string;
  budgetLabel: string;
  noBudget: string;
  locationLabel: string;
  goldenVisa: string;
  createdOn: string;
  allSectors: string;
  scoreLabel: string;
  detailTitle: string;
  propertyTypeLabel: string;
}

// Statuts du pipeline CRM → classes de badge du portail.
const STATUS_BADGE: Record<string, string> = {
  new: "sgi-badge-info",
  contacted: "sgi-badge-pending",
  qualified: "sgi-badge-pending",
  proposal_sent: "sgi-badge-info",
  visit_planned: "sgi-badge-info",
  visit_done: "sgi-badge-info",
  negotiation: "sgi-badge-pending",
  won: "sgi-badge-active",
  lost: "sgi-badge-rejected",
};

export function LeadsView({
  leads,
  labels,
  statusLabels,
  categoryLabels,
  dateLocale,
}: {
  leads: MyLead[];
  labels: LeadsLabels;
  statusLabels: Record<string, string>;
  categoryLabels: Record<string, string>;
  dateLocale: string;
}) {
  const [sector, setSector] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const money = useMemo(
    () =>
      new Intl.NumberFormat("en-AE", {
        style: "currency",
        currency: "AED",
        maximumFractionDigits: 0,
      }),
    [],
  );

  // Secteurs présents dans les leads (pour ne montrer que des filtres utiles).
  const sectors = useMemo(() => {
    const seen = new Set<string>();
    for (const l of leads) seen.add(l.category);
    return [...seen];
  }, [leads]);

  const filtered = sector === "all" ? leads : leads.filter((l) => l.category === sector);

  if (leads.length === 0) {
    return (
      <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
        <p style={{ margin: "0 0 1rem" }}>{labels.empty}</p>
        <a href={labels.ctaHref} className="sgi-button sgi-button-primary">
          {labels.cta}
        </a>
      </div>
    );
  }

  const chip = (active: boolean): React.CSSProperties => ({
    padding: "0.3rem 0.85rem",
    borderRadius: "999px",
    border: "1px solid var(--line-soft, #e5e0d5)",
    background: active ? "var(--ink)" : "transparent",
    color: active ? "var(--bg-paper, #fff)" : "var(--ink-2)",
    fontSize: "0.8rem",
    fontWeight: 600,
    cursor: "pointer",
  });

  return (
    <>
      {/* Filtre par secteur */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "1.25rem" }}>
        <button type="button" onClick={() => setSector("all")} style={chip(sector === "all")}>
          {labels.allSectors}
        </button>
        {sectors.map((s) => (
          <button key={s} type="button" onClick={() => setSector(s)} style={chip(sector === s)}>
            {categoryLabels[s] ?? s}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {filtered.map((l) => {
          const open = openId === l.id;
          return (
            <div
              key={l.id}
              className="sgi-card"
              onClick={() => setOpenId(open ? null : l.id)}
              style={{ cursor: "pointer" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color: "var(--gold, var(--ink))" }}>
                    {l.reference ?? l.id.slice(0, 8)}
                  </span>
                  <span className="sgi-badge sgi-badge-info">{categoryLabels[l.category] ?? l.category}</span>
                </div>
                <span className={`sgi-badge ${STATUS_BADGE[l.status] ?? ""}`}>
                  {statusLabels[l.status] ?? l.status}
                </span>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1.25rem", fontSize: "0.85rem", color: "var(--ink-2)" }}>
                <span>
                  <span style={{ color: "var(--ink-3)" }}>{labels.budgetLabel} : </span>
                  {l.budget ? money.format(l.budget) : labels.noBudget}
                </span>
                {l.preferred_location && (
                  <span>
                    <span style={{ color: "var(--ink-3)" }}>{labels.locationLabel} : </span>
                    {l.preferred_location}
                  </span>
                )}
                <span style={{ color: "var(--ink-3)" }}>
                  {labels.createdOn} {new Date(l.created_at).toLocaleDateString(dateLocale)}
                </span>
              </div>

              {l.golden_visa_eligible && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span className="sgi-badge sgi-badge-active">★ {labels.goldenVisa}</span>
                </div>
              )}

              {/* Détail au clic */}
              {open && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid var(--line-soft, #e5e0d5)", cursor: "default" }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--ink)", marginBottom: "0.5rem" }}>
                    {labels.detailTitle}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem 1.5rem", fontSize: "0.82rem", color: "var(--ink-2)", marginBottom: "0.6rem" }}>
                    <span>
                      <span style={{ color: "var(--ink-3)" }}>{labels.scoreLabel} : </span>
                      {l.score}/100
                    </span>
                    {l.property_type && (
                      <span>
                        <span style={{ color: "var(--ink-3)" }}>{labels.propertyTypeLabel} : </span>
                        {l.property_type}
                      </span>
                    )}
                  </div>
                  {l.notes && (
                    <pre
                      style={{
                        margin: 0,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        fontFamily: "inherit",
                        fontSize: "0.82rem",
                        color: "var(--ink-2)",
                        background: "var(--bg-cream, #faf8f2)",
                        padding: "0.75rem",
                        borderRadius: "0.5rem",
                      }}
                    >
                      {l.notes}
                    </pre>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
