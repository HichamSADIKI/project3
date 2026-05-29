"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiClient } from "@/lib/api";

export interface LeadFormLabels {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  interest: string;
  budget: string;
  notes: string;
  submit: string;
  submitting: string;
  successMessage: string;
  interestOptions: {
    buy: string;
    rent: string;
    golden_visa: string;
    commercial: string;
  };
}

export function LeadForm({ labels }: { labels: LeadFormLabels }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState("buy");
  const [budget, setBudget] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient("/api/proxy/fournisseur/leads", {
        method: "POST",
        json: {
          prospect_first_name: firstName,
          prospect_last_name: lastName || null,
          prospect_email: email || null,
          prospect_phone: phone,
          interest_type: interest,
          budget_aed: budget || null,
          notes: notes || null,
        },
      });
      setSuccess(true);
      setFirstName("");
      setLastName("");
      setEmail("");
      setPhone("");
      setBudget("");
      setNotes("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "lead_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <div>
        <label className="sgi-label" htmlFor="fn">{labels.firstName}</label>
        <input id="fn" required className="sgi-input" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
      </div>
      <div>
        <label className="sgi-label" htmlFor="ln">{labels.lastName}</label>
        <input id="ln" className="sgi-input" value={lastName} onChange={(e) => setLastName(e.target.value)} />
      </div>
      <div>
        <label className="sgi-label" htmlFor="em">{labels.email}</label>
        <input id="em" type="email" className="sgi-input" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div>
        <label className="sgi-label" htmlFor="ph">{labels.phone}</label>
        <input id="ph" required className="sgi-input" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div>
        <label className="sgi-label" htmlFor="it">{labels.interest}</label>
        <select id="it" className="sgi-input" value={interest} onChange={(e) => setInterest(e.target.value)}>
          <option value="buy">{labels.interestOptions.buy}</option>
          <option value="rent">{labels.interestOptions.rent}</option>
          <option value="golden_visa">{labels.interestOptions.golden_visa}</option>
          <option value="commercial">{labels.interestOptions.commercial}</option>
        </select>
      </div>
      <div>
        <label className="sgi-label" htmlFor="bd">{labels.budget}</label>
        <input id="bd" type="number" min="0" step="0.01" className="sgi-input" value={budget} onChange={(e) => setBudget(e.target.value)} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="sgi-label" htmlFor="nt">{labels.notes}</label>
        <textarea id="nt" rows={3} className="sgi-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
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
