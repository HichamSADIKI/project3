"use client";

import React, { useState } from "react";

import { useT, useLang } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { postJson } from "@/lib/api-client";

// Panneau « Agent AI » réutilisable pour les espaces Clients et Fournisseurs.
// Câblé sur les sous-routes /clients/ai/* et /vendors/ai/* via les proxies
// /api/admin/{domain}/ai/*. CSS strictement logique (Loi 3 RTL) ; chiffres
// latins. Le scoping company_id est garanti côté backend (Loi 1) — ce composant
// n'envoie jamais de tenant.

export type AgentDomain = "clients" | "vendors";

type Tab = "insights" | "entity" | "secondary" | "chat";

type InsightsResult = {
  headline: string;
  bullets: string[];
  narrative: string;
  engine: string;
};

type EntityResult = {
  // score (clients) OU risk (vendors)
  score?: number;
  band?: string;
  risk_band?: string;
  golden_visa_eligible?: boolean;
  flags?: string[];
  recommended_actions?: string[];
  // validation (vendors)
  recommendation?: string;
  blocking_issues?: string[];
  warnings?: string[];
  // message (clients)
  message?: string;
  narrative?: string;
  engine: string;
};

type ChatTurn = { role: "user" | "assistant"; content: string };

const TABS_FOR: Record<AgentDomain, Tab[]> = {
  clients: ["insights", "entity", "secondary", "chat"],
  vendors: ["insights", "entity", "secondary", "chat"],
};

function tabLabel(t: Translations, domain: AgentDomain, tab: Tab): string {
  if (tab === "insights") return t.aiagent_tab_insights;
  if (tab === "chat") return t.aiagent_tab_chat;
  if (tab === "entity") return domain === "clients" ? t.aiagent_tab_score : t.aiagent_risk_band;
  // secondary
  return domain === "clients" ? t.aiagent_tab_message : t.aiagent_tab_validation;
}

const card: React.CSSProperties = {
  background: "var(--bg-cream)",
  border: "1px solid var(--line-soft)",
  borderRadius: 10,
  padding: "12px 14px",
  textAlign: "start",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  border: "none",
  borderRadius: 999,
  background: "var(--gold)",
  color: "#1A1610",
  fontSize: 12.5,
  fontWeight: 600,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 220,
  padding: "7px 10px",
  border: "1px solid var(--line)",
  borderRadius: 8,
  background: "var(--bg)",
  color: "var(--ink)",
  fontSize: 12.5,
  textAlign: "start",
};

function EngineBadge({ engine }: { engine: string }): React.ReactNode {
  const t = useT();
  const isAi = engine !== "heuristic" && engine !== "unavailable";
  return (
    <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>
      {isAi ? t.aiagent_engine_ai : t.aiagent_engine_heuristic}
    </span>
  );
}

function Chips({ label, items }: { label: string; items: string[] }): React.ReactNode {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-4)" }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((a) => (
          <span
            key={a}
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--ink)",
              background: "var(--line-soft)",
              borderRadius: 999,
              padding: "3px 10px",
            }}
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}

export function AgentAiPanel({ domain }: { domain: AgentDomain }): React.ReactNode {
  const t = useT();
  const { lang } = useLang();
  const [tab, setTab] = useState<Tab>("insights");

  const base = `/api/admin/${domain}/ai`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Onglets */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {TABS_FOR[domain].map((tb) => (
          <button
            key={tb}
            onClick={() => setTab(tb)}
            style={{
              padding: "6px 13px",
              borderRadius: 999,
              border: "1px solid var(--line)",
              background: tab === tb ? "var(--gold)" : "var(--bg-cream)",
              color: tab === tb ? "#1A1610" : "var(--ink)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {tabLabel(t, domain, tb)}
          </button>
        ))}
      </div>

      {tab === "insights" && <InsightsTab base={base} lang={lang} />}
      {tab === "entity" && <EntityTab base={base} domain={domain} lang={lang} mode="entity" />}
      {tab === "secondary" && (
        <EntityTab base={base} domain={domain} lang={lang} mode="secondary" />
      )}
      {tab === "chat" && <ChatTab base={base} lang={lang} />}
    </div>
  );
}

// ── Onglet Synthèse ────────────────────────────────────────────────────────

function InsightsTab({ base, lang }: { base: string; lang: string }): React.ReactNode {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [res, setRes] = useState<InsightsResult | null>(null);

  async function run(): Promise<void> {
    setLoading(true);
    setError(false);
    try {
      const r = await postJson(`${base}/insights?locale=${lang}`, {});
      if (!r.ok) {
        setError(true);
        return;
      }
      const body = (await r.json()) as { data?: InsightsResult };
      setRes(body.data ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button onClick={() => void run()} disabled={loading} style={primaryBtn}>
        {loading ? t.aiagent_loading : t.aiagent_run}
      </button>
      {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>{t.aiagent_error}</div>}
      {res && (
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
          <strong style={{ fontSize: 13, color: "var(--ink)" }}>{res.headline}</strong>
          <ul style={{ margin: 0, paddingInlineStart: 18, display: "flex", flexDirection: "column", gap: 3 }}>
            {res.bullets.map((b) => (
              <li key={b} style={{ fontSize: 12.5, color: "var(--ink)" }}>
                {b}
              </li>
            ))}
          </ul>
          <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-4)", whiteSpace: "pre-wrap" }}>
            {res.narrative}
          </p>
          <EngineBadge engine={res.engine} />
        </div>
      )}
    </div>
  );
}

// ── Onglet entité (score/risk) et secondaire (message/validation) ──────────

function EntityTab({
  base,
  domain,
  lang,
  mode,
}: {
  base: string;
  domain: AgentDomain;
  lang: string;
  mode: "entity" | "secondary";
}): React.ReactNode {
  const t = useT();
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [res, setRes] = useState<EntityResult | null>(null);
  // Champs message (clients secondary).
  const [channel, setChannel] = useState("whatsapp");
  const [purpose, setPurpose] = useState("follow_up");

  // Résolution de la sous-route selon domaine + mode.
  function path(): { url: string; body: Record<string, string> } {
    const eid = encodeURIComponent(id.trim());
    if (mode === "entity") {
      const action = domain === "clients" ? "score" : "risk";
      return { url: `${base}/${eid}/${action}?locale=${lang}`, body: {} };
    }
    if (domain === "clients") {
      return {
        url: `${base}/${eid}/message`,
        body: { channel, locale: lang, purpose },
      };
    }
    return { url: `${base}/${eid}/validation?locale=${lang}`, body: {} };
  }

  async function run(): Promise<void> {
    if (!id.trim()) return;
    setLoading(true);
    setError(false);
    setRes(null);
    try {
      const { url, body } = path();
      const r = await postJson(url, body);
      if (!r.ok) {
        setError(true);
        return;
      }
      const json = (await r.json()) as { data?: EntityResult };
      setRes(json.data ?? null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  const showMessageFields = mode === "secondary" && domain === "clients";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input
          value={id}
          onChange={(e) => setId(e.target.value)}
          placeholder={t.aiagent_id_placeholder}
          style={inputStyle}
        />
        {showMessageFields && (
          <>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} style={inputStyle}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={inputStyle}>
              <option value="follow_up">follow_up</option>
              <option value="proposal">proposal</option>
              <option value="welcome">welcome</option>
              <option value="visit">visit</option>
            </select>
          </>
        )}
        <button onClick={() => void run()} disabled={loading || !id.trim()} style={primaryBtn}>
          {loading ? t.aiagent_loading : t.aiagent_run}
        </button>
      </div>
      {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>{t.aiagent_error}</div>}
      {res && (
        <div style={{ ...card, display: "flex", flexDirection: "column", gap: 8 }}>
          {res.score !== undefined && (
            <div style={{ fontSize: 13, color: "var(--ink)" }}>
              {t.aiagent_score_label} : <strong>{res.score}/100</strong>
              {res.band && (
                <span style={{ marginInlineStart: 8 }}>
                  {t.aiagent_band} : {res.band}
                </span>
              )}
              {res.risk_band && (
                <span style={{ marginInlineStart: 8 }}>
                  {t.aiagent_risk_band} : {res.risk_band}
                </span>
              )}
            </div>
          )}
          {res.golden_visa_eligible && (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "var(--gold)" }}>
              ★ {t.aiagent_gv_eligible}
            </span>
          )}
          {res.recommendation && (
            <div style={{ fontSize: 13, color: "var(--ink)" }}>
              {t.aiagent_tab_validation} : <strong>{res.recommendation}</strong>
            </div>
          )}
          {res.message && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink)", whiteSpace: "pre-wrap" }}>
              {res.message}
            </p>
          )}
          <Chips label={t.aiagent_recommended} items={res.recommended_actions ?? []} />
          <Chips label={t.aiagent_flags} items={res.flags ?? []} />
          <Chips label={t.aiagent_flags} items={res.blocking_issues ?? []} />
          <Chips label={t.aiagent_flags} items={res.warnings ?? []} />
          {res.narrative && (
            <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-4)", whiteSpace: "pre-wrap" }}>
              {res.narrative}
            </p>
          )}
          <EngineBadge engine={res.engine} />
        </div>
      )}
    </div>
  );
}

// ── Onglet Chat ────────────────────────────────────────────────────────────

function ChatTab({ base, lang }: { base: string; lang: string }): React.ReactNode {
  const t = useT();
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  async function send(): Promise<void> {
    const content = draft.trim();
    if (!content) return;
    const next: ChatTurn[] = [...turns, { role: "user", content }];
    setTurns(next);
    setDraft("");
    setLoading(true);
    setError(false);
    try {
      const r = await postJson(`${base}/chat`, { messages: next, locale: lang });
      if (!r.ok) {
        setError(true);
        return;
      }
      const json = (await r.json()) as { data?: { reply?: string } };
      const reply = json.data?.reply ?? "";
      setTurns([...next, { role: "assistant", content: reply }]);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {turns.map((m, i) => (
          <div
            key={i}
            style={{
              ...card,
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "85%",
              background: m.role === "user" ? "var(--gold-ghost)" : "var(--bg-cream)",
            }}
          >
            <span style={{ fontSize: 12.5, color: "var(--ink)", whiteSpace: "pre-wrap" }}>
              {m.content}
            </span>
          </div>
        ))}
      </div>
      {error && <div style={{ color: "var(--rose)", fontSize: 12 }}>{t.aiagent_error}</div>}
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void send();
          }}
          placeholder={t.aiagent_ask_placeholder}
          style={inputStyle}
        />
        <button onClick={() => void send()} disabled={loading || !draft.trim()} style={primaryBtn}>
          {loading ? t.aiagent_loading : t.aiagent_ask}
        </button>
      </div>
    </div>
  );
}
