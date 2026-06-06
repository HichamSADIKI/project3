"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiClient } from "@/lib/api";

export interface ServiceFormLabels {
  type: string;
  title: string;
  description: string;
  fee: string;
  submit: string;
  submitting: string;
  successMessage: string;
  types: {
    notary: string;
    bank: string;
    insurance: string;
    legal: string;
    translation: string;
    valuation: string;
    other: string;
  };
}

export function ServiceForm({ labels }: { labels: ServiceFormLabels }) {
  const router = useRouter();
  const [serviceType, setServiceType] = useState("notary");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fee, setFee] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient("/api/proxy/fournisseur/services", {
        method: "POST",
        json: {
          service_type: serviceType,
          title,
          description: description || null,
          fee_aed: fee || null,
        },
      });
      setSuccess(true);
      setTitle("");
      setDescription("");
      setFee("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "service_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <div>
        <label className="sgi-label" htmlFor="st">{labels.type}</label>
        <select id="st" className="sgi-input" value={serviceType} onChange={(e) => setServiceType(e.target.value)}>
          <option value="notary">{labels.types.notary}</option>
          <option value="bank">{labels.types.bank}</option>
          <option value="insurance">{labels.types.insurance}</option>
          <option value="legal">{labels.types.legal}</option>
          <option value="translation">{labels.types.translation}</option>
          <option value="valuation">{labels.types.valuation}</option>
          <option value="other">{labels.types.other}</option>
        </select>
      </div>
      <div>
        <label className="sgi-label" htmlFor="fee">{labels.fee}</label>
        <input id="fee" type="number" min="0" step="0.01" className="sgi-input" value={fee} onChange={(e) => setFee(e.target.value)} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="sgi-label" htmlFor="ttl">{labels.title}</label>
        <input id="ttl" required minLength={2} className="sgi-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="sgi-label" htmlFor="ds">{labels.description}</label>
        <textarea id="ds" rows={3} className="sgi-input" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      {error && (
        <div role="alert" style={{ gridColumn: "1 / -1", background: "var(--rose-soft)", color: "var(--rose)", padding: "0.625rem 0.875rem", borderRadius: "var(--r)", fontSize: "0.85rem" }}>
          {error}
        </div>
      )}
      {success && (
        <div role="status" style={{ gridColumn: "1 / -1", background: "var(--emerald-soft)", color: "var(--emerald)", padding: "0.625rem 0.875rem", borderRadius: "var(--r)", fontSize: "0.85rem" }}>
          {labels.successMessage}
        </div>
      )}
      <button type="submit" disabled={loading} className="sgi-button sgi-button-primary" style={{ gridColumn: "1 / -1" }}>
        {loading ? labels.submitting : labels.submit}
      </button>
    </form>
  );
}
