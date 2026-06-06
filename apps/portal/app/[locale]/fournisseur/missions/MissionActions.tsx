"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiClient } from "@/lib/api";

export interface MissionActionLabels {
  accept: string;
  in_progress: string;
  done: string;
  cancel: string;
  updating: string;
}

type Action = { target: string; labelKey: keyof MissionActionLabels; primary: boolean };

const ACTIONS_BY_STATUS: Record<string, Action[]> = {
  assigned: [
    { target: "accepted", labelKey: "accept", primary: true },
    { target: "cancelled", labelKey: "cancel", primary: false },
  ],
  accepted: [
    { target: "in_progress", labelKey: "in_progress", primary: true },
    { target: "cancelled", labelKey: "cancel", primary: false },
  ],
  in_progress: [
    { target: "done", labelKey: "done", primary: true },
    { target: "cancelled", labelKey: "cancel", primary: false },
  ],
};

export function MissionActions({
  missionId,
  status,
  labels,
}: {
  missionId: string;
  status: string;
  labels: MissionActionLabels;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const actions = ACTIONS_BY_STATUS[status] ?? [];

  if (actions.length === 0) return null;

  async function run(target: string) {
    setLoading(true);
    try {
      await apiClient(`/api/proxy/fournisseur/missions/${missionId}/status`, {
        method: "POST",
        json: { status: target },
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
      {actions.map((a) => (
        <button
          key={a.target}
          type="button"
          disabled={loading}
          onClick={() => run(a.target)}
          className={`sgi-button ${a.primary ? "sgi-button-primary" : "sgi-button-secondary"}`}
          style={{ fontSize: "0.8rem", padding: "0.35rem 0.8rem", opacity: loading ? 0.6 : 1 }}
        >
          {loading ? labels.updating : labels[a.labelKey]}
        </button>
      ))}
    </div>
  );
}
