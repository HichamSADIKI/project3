"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiClient } from "@/lib/api";

export interface SubmissionFormLabels {
  title: string;
  type: string;
  district: string;
  districtPlaceholder: string;
  askingPrice: string;
  bedrooms: string;
  contactPhone: string;
  submit: string;
  submitting: string;
  successMessage: string;
  types: {
    apartment: string;
    villa: string;
    townhouse: string;
    office: string;
    retail: string;
    land: string;
  };
}

export function SubmissionForm({ labels }: { labels: SubmissionFormLabels }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [type, setType] = useState("apartment");
  const [district, setDistrict] = useState("");
  const [price, setPrice] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [contact, setContact] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await apiClient("/api/proxy/fournisseur/submissions", {
        method: "POST",
        json: {
          title,
          type,
          district: district || null,
          city: "Dubai",
          asking_price: price,
          bedrooms: bedrooms ? parseInt(bedrooms, 10) : null,
          contact_phone: contact || null,
          images: [],
        },
      });
      setSuccess(true);
      setTitle("");
      setDistrict("");
      setPrice("");
      setBedrooms("");
      setContact("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "submission_failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="sgi-label" htmlFor="title">{labels.title}</label>
        <input id="title" required minLength={3} className="sgi-input" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div>
        <label className="sgi-label" htmlFor="type">{labels.type}</label>
        <select id="type" className="sgi-input" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="apartment">{labels.types.apartment}</option>
          <option value="villa">{labels.types.villa}</option>
          <option value="townhouse">{labels.types.townhouse}</option>
          <option value="office">{labels.types.office}</option>
          <option value="retail">{labels.types.retail}</option>
          <option value="land">{labels.types.land}</option>
        </select>
      </div>
      <div>
        <label className="sgi-label" htmlFor="district">{labels.district}</label>
        <input id="district" className="sgi-input" value={district} onChange={(e) => setDistrict(e.target.value)} placeholder={labels.districtPlaceholder} />
      </div>
      <div>
        <label className="sgi-label" htmlFor="price">{labels.askingPrice}</label>
        <input id="price" type="number" step="0.01" min="1" required className="sgi-input" value={price} onChange={(e) => setPrice(e.target.value)} />
      </div>
      <div>
        <label className="sgi-label" htmlFor="bedrooms">{labels.bedrooms}</label>
        <input id="bedrooms" type="number" min="0" className="sgi-input" value={bedrooms} onChange={(e) => setBedrooms(e.target.value)} />
      </div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label className="sgi-label" htmlFor="contact">{labels.contactPhone}</label>
        <input id="contact" className="sgi-input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+971..." />
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
