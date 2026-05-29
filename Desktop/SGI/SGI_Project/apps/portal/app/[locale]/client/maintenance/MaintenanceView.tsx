"use client";

import { useState } from "react";

export interface MyTicket {
  id: string;
  reference: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  sla_due_at: string | null;
  cost_estimate_aed: number | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  new: "sgi-badge-info", triaged: "sgi-badge-pending",
  assigned: "sgi-badge-pending", in_progress: "sgi-badge-pending",
  on_hold: "sgi-badge-info", resolved: "sgi-badge-active",
  closed: "sgi-badge-active", cancelled: "sgi-badge-rejected",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "#DC2626", high: "#F59E0B", medium: "#3B82F6", low: "#6B7280",
};

const CATEGORY_ICON: Record<string, string> = {
  plumbing:"🔧", electrical:"⚡", hvac:"❄️",
  appliance:"🏠", structural:"🏗️", cleaning:"🧹", other:"📋",
};

export function MaintenanceView({
  tickets, dateLocale, statusLabels, categoryLabels, priorityLabels, labels,
}: {
  tickets: MyTicket[];
  dateLocale: string;
  statusLabels: Record<string, string>;
  categoryLabels: Record<string, string>;
  priorityLabels: Record<string, string>;
  labels: { empty: string; cta: string; ctaHref: string; slaBreached: string; createdOn: string };
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  const money = new Intl.NumberFormat("en-AE", {
    style: "currency", currency: "AED", maximumFractionDigits: 0,
  });

  const isSlaBreached = (t: MyTicket) => {
    if (!t.sla_due_at || ["closed","cancelled","resolved"].includes(t.status)) return false;
    return new Date(t.sla_due_at) < new Date();
  };

  if (tickets.length === 0) {
    return (
      <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
        <p style={{ margin: "0 0 1rem" }}>{labels.empty}</p>
        <a href={labels.ctaHref} className="sgi-button sgi-button-primary">{labels.cta}</a>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {tickets.map(t => {
        const open = openId === t.id;
        const breached = isSlaBreached(t);
        return (
          <div
            key={t.id}
            className="sgi-card"
            onClick={() => setOpenId(open ? null : t.id)}
            style={{ cursor: "pointer", border: breached ? "1px solid #DC2626" : undefined }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", marginBottom: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "monospace", fontSize: "0.8rem", fontWeight: 700, color: "var(--gold, var(--ink))" }}>
                  {t.reference}
                </span>
                <span>{CATEGORY_ICON[t.category] ?? "📋"}</span>
                <span className="sgi-badge sgi-badge-info" style={{ fontSize: "0.75rem" }}>
                  {categoryLabels[t.category] ?? t.category}
                </span>
              </div>
              <span className={`sgi-badge ${STATUS_BADGE[t.status] ?? ""}`}>
                {statusLabels[t.status] ?? t.status}
              </span>
            </div>

            <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--ink)", marginBottom: "0.4rem" }}>
              {t.title}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem 1.25rem", fontSize: "0.82rem", color: "var(--ink-2)" }}>
              <span style={{ color: PRIORITY_COLOR[t.priority], fontWeight: 700 }}>
                {priorityLabels[t.priority] ?? t.priority}
              </span>
              {breached && (
                <span style={{ color: "#DC2626", fontWeight: 700 }}>{labels.slaBreached}</span>
              )}
              <span style={{ color: "var(--ink-3)" }}>
                {labels.createdOn} {new Date(t.created_at).toLocaleDateString(dateLocale)}
              </span>
            </div>

            {open && (
              <div
                onClick={e => e.stopPropagation()}
                style={{ marginTop: "0.85rem", paddingTop: "0.85rem", borderTop: "1px solid var(--line-soft, #e5e0d5)", cursor: "default", fontSize: "0.82rem", color: "var(--ink-2)" }}
              >
                {t.cost_estimate_aed != null && (
                  <div style={{ marginBottom: "0.3rem" }}>
                    <span style={{ color: "var(--ink-3)" }}>Estimation : </span>
                    {money.format(t.cost_estimate_aed)}
                  </div>
                )}
                {t.sla_due_at && (
                  <div>
                    <span style={{ color: "var(--ink-3)" }}>SLA : </span>
                    {new Date(t.sla_due_at).toLocaleString(dateLocale)}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
