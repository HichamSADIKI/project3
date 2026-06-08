"use client";
import React from "react";

import { Topbar } from "@/components/sgi-ui";
import { useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";
import { AgentAiPanel } from "@/components/agent-ai-panel";

/** Écran « Agent AI — Fournisseurs » : synthèse du parc, score de fiabilité/
 *  risque d'un fournisseur, aide à la validation d'une inscription et copilote.
 *  Câblé sur /vendors/ai/* (scoping company_id côté backend — Loi 1). */
export function ScreenFournisseursAI({
  onNavigate,
}: {
  onNavigate?: (screen: string) => void;
}): React.ReactNode {
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  return (
    <div data-testid="screen-fournisseurs_ai" style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={t.aiagent_vendors_title} />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isMob ? "16px 12px" : "28px 32px",
          background: "var(--bg-cream)",
        }}
      >
        <p style={{ marginTop: 0, marginBottom: 16, color: "var(--ink-4)", fontSize: 13, textAlign: "start" }}>
          {t.aiagent_vendors_sub}
        </p>
        <div style={{ maxWidth: 820 }}>
          <AgentAiPanel domain="vendors" onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}
