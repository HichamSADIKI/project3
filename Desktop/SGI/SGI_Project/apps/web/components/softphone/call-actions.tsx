"use client";

/**
 * Actions « 1 clic » depuis un appel : logger au CRM, ouvrir un ticket,
 * planifier un rappel. Orchestre des endpoints existants via la couche proxy
 * (`/api/admin/**`) — aucune logique métier nouvelle côté backend.
 *
 * - Logger au CRM : rattache l'appel au lead existant du client (ou en crée un,
 *   source="call") puis y ajoute une activité `call` (réutilise crm.add_activity).
 *   Nécessite un client identifié.
 * - Créer un ticket : POST /tickets (requester_client_id = client de l'appel).
 * - Planifier un rappel : activité CRM `call` horodatée (`scheduled_at`).
 *
 * RTL-safe (CSS logique). Numéros / dates en chiffres latins (UAE).
 */

import React, { useState } from "react";

import { useT } from "@/components/language-provider";
import { getJson, postJson, extractError } from "@/lib/api-client";

type ActionState = "idle" | "busy" | "done" | "error";

interface CallActionsProps {
  /** Client identifié (screen pop / contexte fiche). CRM & rappel l'exigent. */
  clientId?: string | null;
  /** Libellé d'objet pour le ticket (ex. numéro distant). */
  subject: string;
  /** Notes de wrap-up courantes (passées au CRM / ticket / rappel). */
  notes: string;
}

/**
 * Résout le lead du client : réutilise le lead existant le plus récent s'il y
 * en a un (évite les doublons à chaque appel), sinon en crée un (source=call).
 */
async function ensureLead(
  clientId: string,
  notes: string,
): Promise<string | null> {
  try {
    const existing = await getJson<{ data: { id: string }[] }>(
      `/api/admin/crm/leads?client_id=${encodeURIComponent(clientId)}&limit=1`,
    );
    const found = existing.data?.[0]?.id;
    if (found) return found;
  } catch {
    /* pas de lead existant → on en crée un */
  }
  const res = await postJson("/api/admin/crm/leads", {
    client_id: clientId,
    source: "call",
    notes: notes || null,
  });
  if (!res.ok) return null;
  const body = (await res.json()) as { data?: { id?: string } };
  return body.data?.id ?? null;
}

/** Ajoute une activité (immuable) sur un lead. */
async function addActivity(
  leadId: string,
  content: string,
  scheduledAt: string | null,
): Promise<boolean> {
  const res = await postJson(`/api/admin/crm/leads/${leadId}/activities`, {
    lead_id: leadId,
    type: "call",
    content: content || null,
    scheduled_at: scheduledAt,
  });
  return res.ok;
}

export function CallActions({ clientId, subject, notes }: CallActionsProps) {
  const t = useT();
  const [crm, setCrm] = useState<ActionState>("idle");
  const [ticket, setTicket] = useState<ActionState>("idle");
  const [cb, setCb] = useState<ActionState>("idle");
  const [cbAt, setCbAt] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const hasClient = Boolean(clientId);

  async function logToCrm() {
    if (!clientId) return;
    setCrm("busy");
    setErr(null);
    const leadId = await ensureLead(clientId, notes);
    if (!leadId) {
      setCrm("error");
      return;
    }
    const ok = await addActivity(leadId, notes, null);
    setCrm(ok ? "done" : "error");
  }

  async function createTicket() {
    setTicket("busy");
    setErr(null);
    const res = await postJson("/api/admin/tickets", {
      subject: `${t.tel_call} — ${subject}`.slice(0, 255),
      description: notes || null,
      priority: "medium",
      requester_client_id: clientId ?? null,
    });
    if (!res.ok) {
      setErr(await extractError(res, "ticket_failed"));
      setTicket("error");
      return;
    }
    setTicket("done");
  }

  async function scheduleCallback() {
    if (!clientId || !cbAt) return;
    setCb("busy");
    setErr(null);
    const leadId = await ensureLead(clientId, notes);
    if (!leadId) {
      setCb("error");
      return;
    }
    // datetime-local → ISO (le backend attend un datetime).
    const iso = new Date(cbAt).toISOString();
    const ok = await addActivity(
      leadId,
      `${t.tel_schedule_callback}: ${notes}`,
      iso,
    );
    setCb(ok ? "done" : "error");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <button
        onClick={() => void logToCrm()}
        disabled={!hasClient || crm === "busy" || crm === "done"}
        style={actionBtn(!hasClient || crm === "busy" || crm === "done")}
        title={hasClient ? t.tel_log_crm : t.tel_no_match}
      >
        {label(t.tel_log_crm, crm, t)}
      </button>

      <button
        onClick={() => void createTicket()}
        disabled={ticket === "busy" || ticket === "done"}
        style={actionBtn(ticket === "busy" || ticket === "done")}
        title={t.tel_create_ticket}
      >
        {label(t.tel_create_ticket, ticket, t)}
      </button>

      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="datetime-local"
          value={cbAt}
          onChange={(e) => setCbAt(e.target.value)}
          disabled={!hasClient}
          style={{
            flex: 1,
            minWidth: 0,
            padding: "6px 8px",
            border: "1px solid var(--line)",
            borderRadius: 8,
            background: "var(--bg-cream)",
            fontSize: 12,
            color: "var(--ink)",
            direction: "ltr",
          }}
        />
        <button
          onClick={() => void scheduleCallback()}
          disabled={!hasClient || !cbAt || cb === "busy" || cb === "done"}
          style={actionBtn(
            !hasClient || !cbAt || cb === "busy" || cb === "done",
          )}
          title={t.tel_schedule_callback}
        >
          {label(t.tel_schedule_callback, cb, t)}
        </button>
      </div>

      {err && <div style={{ fontSize: 11, color: "var(--rose)" }}>{err}</div>}
    </div>
  );
}

function label(
  base: string,
  state: ActionState,
  t: ReturnType<typeof useT>,
): string {
  if (state === "busy") return "…";
  if (state === "done") return `✓ ${t.tel_action_done}`;
  if (state === "error") return `✕ ${t.tel_action_failed}`;
  return base;
}

function actionBtn(disabled: boolean): React.CSSProperties {
  return {
    padding: "7px 10px",
    border: "1px solid var(--line)",
    borderRadius: 8,
    background: "var(--bg-cream)",
    color: "var(--ink)",
    fontSize: 12,
    fontWeight: 600,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
    whiteSpace: "nowrap",
  };
}
