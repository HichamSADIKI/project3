"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { postFormData } from "@/lib/api";

export interface DocumentFormLabels {
  add: string;
  docType: string;
  expiry: string;
  expiryHint: string;
  file: string;
  fileHint: string;
  send: string;
  sending: string;
  success: string;
  error: string;
  types: Record<string, string>;
}

const DOC_TYPES = ["trade_licence", "insurance", "vat", "id", "other"] as const;

export function DocumentUploadForm({ labels }: { labels: DocumentFormLabels }) {
  const router = useRouter();
  const [docType, setDocType] = useState<string>("trade_licence");
  const [expiry, setExpiry] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!file) {
      setError(labels.error);
      return;
    }
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("doc_type", docType);
      if (expiry) fd.append("expiry_date", expiry);
      fd.append("file", file);
      const res = await postFormData("/api/fournisseur/documents", fd);
      if (!res.ok) throw new Error("upload_failed");
      setSuccess(true);
      setFile(null);
      setExpiry("");
      router.refresh();
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sgi-card" style={{ display: "grid", gap: "0.85rem" }}>
      <h2 style={{ margin: 0, fontSize: "1.05rem", color: "var(--ink)" }}>{labels.add}</h2>
      <div className="sgi-grid-auto" style={{ gap: "0.85rem" }}>
        <div>
          <label className="sgi-label" htmlFor="docType">{labels.docType}</label>
          <select
            id="docType"
            className="sgi-input"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            {DOC_TYPES.map((t) => (
              <option key={t} value={t}>{labels.types[t] ?? t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="sgi-label" htmlFor="expiry">{labels.expiry}</label>
          <input
            id="expiry"
            type="date"
            className="sgi-input"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
          />
          <small style={{ display: "block", marginTop: 6, color: "var(--ink-3)", fontSize: "0.75rem" }}>
            {labels.expiryHint}
          </small>
        </div>
      </div>
      <div>
        <label className="sgi-label" htmlFor="docFile">{labels.file}</label>
        <input
          id="docFile"
          type="file"
          required
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="sgi-input"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          style={{ padding: "0.5rem" }}
        />
        <small style={{ display: "block", marginTop: 6, color: "var(--ink-3)", fontSize: "0.75rem" }}>
          {labels.fileHint}
        </small>
      </div>
      {error && (
        <div role="alert" style={{ background: "var(--rose-soft)", color: "var(--rose)", padding: "0.6rem 0.8rem", borderRadius: "var(--r)", fontSize: "0.8rem" }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "var(--emerald-soft)", color: "var(--emerald)", padding: "0.6rem 0.8rem", borderRadius: "var(--r)", fontSize: "0.8rem" }}>
          {labels.success}
        </div>
      )}
      <button type="submit" disabled={loading} className="sgi-button sgi-button-primary" style={{ justifySelf: "start" }}>
        {loading ? labels.sending : labels.send}
      </button>
    </form>
  );
}
