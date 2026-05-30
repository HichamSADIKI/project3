"use client";

import React from "react";
import { Topbar, IcChat } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useApiList } from "@/lib/use-api-list";

// Câblé sur /api/admin/comms/conversations → /api/v1/comms/conversations.
// Le fil de messages live (+ WebSocket temps réel) relève d'une étape ultérieure.

const TYPE_LABEL: Record<string, string> = {
  direct: "Direct", group: "Groupe", ticket: "Ticket", contract: "Contrat",
};

type Conversation = {
  id: string; type: string; subject: string | null; last_message_at: string | null;
};

export function ScreenRealEstateComms() {
  const t = useT();
  const { items, loading, error } = useApiList<Conversation>("/api/admin/comms/conversations?limit=100");

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.nav_comms} />
      <div style={{ flex: 1, display: "flex", minHeight: 0, background: "var(--bg-cream)" }}>
        {/* Liste conversations (réelle) */}
        <div style={{ width: 320, borderInlineEnd: "1px solid var(--line-soft)", background: "var(--bg-paper)", overflowY: "auto" }}>
          <div style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "var(--gold)" }}><IcChat /></span>
            <span className="font-display" style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>{t.nav_comms}</span>
            <span style={{ fontSize: 11, color: "var(--ink-4)", marginInlineStart: "auto" }}>{loading ? "…" : items.length}</span>
          </div>
          {error && <div style={{ padding: "10px 18px", color: "var(--rose)", fontSize: 12 }}>Erreur : {error}</div>}
          {!loading && items.length === 0 && !error && (
            <div style={{ padding: "16px 18px", color: "var(--ink-4)", fontSize: 13 }}>Aucune conversation.</div>
          )}
          {items.map(c => (
            <div key={c.id} style={{ padding: "12px 18px", borderTop: "1px solid var(--line-soft)", cursor: "pointer", borderInlineStart: "3px solid transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject || "(sans objet)"}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: "var(--ink-4)", background: "var(--line-soft)", borderRadius: 999, padding: "1px 7px" }}>{TYPE_LABEL[c.type] ?? c.type}</span>
              </div>
              <div style={{ fontSize: 11.5, color: "var(--ink-4)", marginTop: 3 }}>
                {c.last_message_at ? new Date(c.last_message_at).toLocaleString("fr") : "—"}
              </div>
            </div>
          ))}
        </div>
        {/* Fil de messages — placeholder (live thread + WS : étape ultérieure) */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)", fontSize: 13, padding: 24, textAlign: "center" }}>
          Sélectionnez une conversation.<br />Le fil de messages temps réel (WebSocket) sera câblé ultérieurement.
        </div>
      </div>
    </div>
  );
}
