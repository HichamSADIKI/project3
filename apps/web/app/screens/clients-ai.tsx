"use client";
import React from "react";

import { Topbar } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";
import { AgentAiPanel } from "@/components/agent-ai-panel";

/** Écran « Agent AI — Clients » : synthèse du portefeuille, qualification d'un
 *  client, brouillon de message (AR/EN/FR) et copilote conversationnel. Câblé
 *  sur /clients/ai/* (scoping company_id côté backend — Loi 1). CSS logique. */
export function ScreenClientsAI({
  onNavigate,
}: {
  onNavigate?: (screen: string) => void;
}): React.ReactNode {
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.aiagent_clients_title} />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isMob ? "16px 12px" : "28px 32px",
          background: "var(--bg-cream)",
        }}
      >
        <p style={{ marginTop: 0, marginBottom: 16, color: "var(--ink-4)", fontSize: 13, textAlign: "start" }}>
          {t.aiagent_clients_sub}
        </p>
        <div style={{ maxWidth: 820 }}>
          <AgentAiPanel domain="clients" onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
