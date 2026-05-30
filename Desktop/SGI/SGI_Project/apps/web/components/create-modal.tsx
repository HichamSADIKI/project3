"use client";

import React from "react";
import { IcClose } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";

// Coquille de modal de création réutilisable (wiring écriture).
// Les champs du formulaire sont passés en children ; le parent gère l'état.

export const fieldInput: React.CSSProperties = {
  width: "100%", padding: "9px 11px", border: "1px solid var(--line)",
  borderRadius: 8, background: "var(--bg-cream)", color: "var(--ink)", fontSize: 13,
};

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ fontSize: 12, color: "var(--ink-3)", fontWeight: 500, display: "block" }}>
      {label}
      <div style={{ marginTop: 5 }}>{children}</div>
    </label>
  );
}

export function CreateModal({
  title, open, saving, error, onClose, onSubmit, children,
}: {
  title: string;
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  const t = useT();
  if (!open) return null;
  return (
    <div onClick={() => !saving && onClose()} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: "92vw", maxHeight: "88vh", display: "flex", flexDirection: "column", background: "var(--bg-paper)", borderRadius: "var(--r)", border: "1px solid var(--line-soft)", overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--line-soft)" }}>
          <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{title}</span>
          <button onClick={() => !saving && onClose()} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)" }}><IcClose /></button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14, overflowY: "auto" }}>
          {children}
          {error && <div style={{ color: "var(--rose)", fontSize: 12.5 }}>Erreur : {error}</div>}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "14px 20px", borderTop: "1px solid var(--line-soft)" }}>
          <button onClick={onClose} disabled={saving} style={{ padding: "8px 16px", background: "transparent", color: "var(--ink-2)", border: "1px solid var(--line)", borderRadius: "var(--r)", fontSize: 13, cursor: "pointer" }}>{t.cancel}</button>
          <button onClick={onSubmit} disabled={saving} style={{ padding: "8px 18px", background: "var(--gold)", color: "#1A1610", border: "none", borderRadius: "var(--r)", fontWeight: 600, fontSize: 13, cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "…" : t.save}</button>
        </div>
      </div>
    </div>
  );
}
