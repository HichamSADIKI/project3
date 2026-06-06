"use client";

import { useState } from "react";
import { apiClient } from "@/lib/api";

export interface TenantPayment {
  id: string;
  reference: string;
  payment_type: string;
  status: string;
  amount_aed: string;
  due_date: string | null;
  paid_at: string | null;
  description: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  pending: "sgi-badge-pending",
  paid: "sgi-badge-active",
  overdue: "sgi-badge-rejected",
  cancelled: "sgi-badge-info",
};

export function PaymentsView({
  payments,
  dateLocale,
  statusLabels,
  typeLabels,
  labels,
}: {
  payments: TenantPayment[];
  dateLocale: string;
  statusLabels: Record<string, string>;
  typeLabels: Record<string, string>;
  labels: {
    empty: string;
    reference: string;
    type: string;
    amount: string;
    dueDate: string;
    status: string;
    pay: string;
    paying: string;
    payError: string;
  };
}) {
  const [rows, setRows] = useState<TenantPayment[]>(payments);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const money = new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  });

  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(dateLocale) : "—");

  const pay = async (id: string) => {
    setError(null);
    setPayingId(id);
    try {
      const updated = await apiClient<TenantPayment>(`/api/proxy/tenant/payments/${id}/pay`, {
        method: "POST",
        json: { method: "online" },
      });
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updated } : r)));
    } catch {
      setError(labels.payError);
    } finally {
      setPayingId(null);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
        {labels.empty}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      {error ? (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      ) : null}

      {rows.map((p) => {
        const payable = p.status === "pending" || p.status === "overdue";
        return (
          <div
            key={p.id}
            className="sgi-card"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <strong style={{ color: "var(--ink)" }}>
                {money.format(Number(p.amount_aed))}{" "}
                <span style={{ fontWeight: 400, color: "var(--ink-3)", fontSize: "0.85rem" }}>
                  · {typeLabels[p.payment_type] ?? p.payment_type}
                </span>
              </strong>
              <span style={{ fontSize: "0.8rem", color: "var(--ink-3)" }}>
                {p.reference} · {labels.dueDate}: {fmtDate(p.due_date)}
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <span className={`sgi-badge ${STATUS_BADGE[p.status] ?? "sgi-badge-info"}`}>
                {statusLabels[p.status] ?? p.status}
              </span>
              {payable ? (
                <button
                  type="button"
                  className="sgi-button sgi-button-primary"
                  disabled={payingId === p.id}
                  onClick={() => pay(p.id)}
                >
                  {payingId === p.id ? labels.paying : labels.pay}
                </button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
