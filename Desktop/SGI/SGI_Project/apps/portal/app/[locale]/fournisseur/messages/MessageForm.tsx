"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiClient } from "@/lib/api";

export interface MessageFormLabels {
  subject: string;
  subjectPlaceholder: string;
  body: string;
  bodyPlaceholder: string;
  send: string;
  sending: string;
  success: string;
  error: string;
}

export function MessageForm({ labels }: { labels: MessageFormLabels }) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!body.trim()) return;
    setLoading(true);
    try {
      await apiClient("/api/proxy/fournisseur/messages", {
        method: "POST",
        json: { subject: subject.trim() || null, body: body.trim() },
      });
      setSuccess(true);
      setSubject("");
      setBody("");
      router.refresh();
    } catch {
      setError(labels.error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sgi-card" style={{ display: "grid", gap: "0.75rem" }}>
      <div>
        <label className="sgi-label" htmlFor="msgSubject">{labels.subject}</label>
        <input
          id="msgSubject"
          type="text"
          maxLength={255}
          className="sgi-input"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={labels.subjectPlaceholder}
        />
      </div>
      <div>
        <label className="sgi-label" htmlFor="msgBody">{labels.body}</label>
        <textarea
          id="msgBody"
          required
          rows={3}
          maxLength={5000}
          className="sgi-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={labels.bodyPlaceholder}
          style={{ resize: "vertical", minHeight: 80, fontFamily: "inherit" }}
        />
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
