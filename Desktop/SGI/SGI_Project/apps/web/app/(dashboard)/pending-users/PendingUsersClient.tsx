"use client";

import { useCallback, useEffect, useState } from "react";

import { getJson, postJson } from "@/lib/api-client";

interface PendingUser {
  id: string;
  email: string;
  full_name: string;
  role: "client" | "fournisseur";
  status: string;
  created_at: string;
}

type Filter = "all" | "client" | "fournisseur";

const ROLE_LABEL: Record<string, string> = {
  client: "Client",
  fournisseur: "Fournisseur",
};

export function PendingUsersClient() {
  const [users, setUsers] = useState<PendingUser[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = filter !== "all" ? `?role_filter=${filter}` : "";
      const data = await getJson<PendingUser[]>(`/api/admin/pending-users${qs}`);
      setUsers(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  async function decide(id: string, approve: boolean) {
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await postJson(`/api/admin/pending-users/${id}/decision`, { approve });
      if (!res.ok) throw new Error("decision_failed");
      setUsers((u) => u.filter((x) => x.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "decision_failed");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-base)", padding: "2rem" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
        <div>
          <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--ink)", margin: 0 }}>
            Inscriptions en attente
          </h1>
          <p style={{ color: "var(--ink-3)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Valider ou rejeter les inscriptions Client et Fournisseur déposées via le portal public.
          </p>
        </div>
        <a href="/" style={{ color: "var(--gold-deep)", fontSize: "0.85rem", fontWeight: 500 }}>
          ← Retour au tableau de bord
        </a>
      </header>

      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem" }}>
        {(["all", "client", "fournisseur"] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              border: "1px solid",
              borderColor: filter === f ? "var(--gold)" : "var(--line)",
              background: filter === f ? "var(--gold-ghost)" : "var(--surface-3)",
              color: filter === f ? "var(--gold-deep)" : "var(--ink-2)",
              fontWeight: 600,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {f === "all" ? "Tous" : ROLE_LABEL[f]}
          </button>
        ))}
        <button
          type="button"
          onClick={fetchUsers}
          style={{
            padding: "0.5rem 1rem",
            borderRadius: "8px",
            border: "1px solid var(--line)",
            background: "var(--surface-3)",
            color: "var(--ink-2)",
            fontSize: "0.85rem",
            cursor: "pointer",
            marginInlineStart: "auto",
          }}
        >
          ↻ Rafraîchir
        </button>
      </div>

      {error && (
        <div style={{ background: "var(--rose-soft)", color: "var(--rose)", padding: "0.75rem 1rem", borderRadius: "8px", marginBottom: "1rem" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", color: "var(--ink-3)", padding: "3rem" }}>Chargement…</div>
      ) : users.length === 0 ? (
        <div style={{ textAlign: "center", color: "var(--ink-3)", padding: "3rem", background: "var(--surface-3)", borderRadius: "12px", border: "1px solid var(--line-soft)" }}>
          Aucune inscription en attente.
        </div>
      ) : (
        <div style={{ background: "var(--surface-3)", borderRadius: "12px", border: "1px solid var(--line-soft)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "var(--bg-paper)" }}>
              <tr>
                {["Utilisateur", "Email", "Rôle demandé", "Soumis le", "Actions"].map((h) => (
                  <th key={h} style={{ padding: "0.75rem 1rem", textAlign: "start", fontSize: "0.75rem", color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--line-soft)" }}>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink)", fontWeight: 500 }}>{u.full_name}</td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink-2)", fontSize: "0.85rem" }}>{u.email}</td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <span style={{
                      display: "inline-block",
                      padding: "0.125rem 0.625rem",
                      borderRadius: "4px",
                      background: u.role === "client" ? "var(--azure-soft)" : "var(--gold-ghost)",
                      color: u.role === "client" ? "var(--azure)" : "var(--gold-deep)",
                      fontSize: "0.7rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                    }}>
                      {ROLE_LABEL[u.role] ?? u.role}
                    </span>
                  </td>
                  <td style={{ padding: "0.75rem 1rem", color: "var(--ink-3)", fontSize: "0.85rem" }}>
                    {u.created_at ? new Date(u.created_at).toLocaleString("fr-FR") : "—"}
                  </td>
                  <td style={{ padding: "0.75rem 1rem" }}>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button
                        type="button"
                        disabled={busy[u.id]}
                        onClick={() => decide(u.id, true)}
                        style={{
                          padding: "0.375rem 0.875rem",
                          borderRadius: "6px",
                          background: "var(--emerald)",
                          color: "white",
                          border: "none",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: busy[u.id] ? "not-allowed" : "pointer",
                          opacity: busy[u.id] ? 0.5 : 1,
                        }}
                      >
                        ✓ Approuver
                      </button>
                      <button
                        type="button"
                        disabled={busy[u.id]}
                        onClick={() => decide(u.id, false)}
                        style={{
                          padding: "0.375rem 0.875rem",
                          borderRadius: "6px",
                          background: "transparent",
                          color: "var(--rose)",
                          border: "1px solid var(--rose)",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          cursor: busy[u.id] ? "not-allowed" : "pointer",
                          opacity: busy[u.id] ? 0.5 : 1,
                        }}
                      >
                        ✕ Rejeter
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
