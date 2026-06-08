"use client";

import React, { useEffect, useState } from "react";

import { EntitySearchInput } from "@/components/entity-search-input";
import { useT, useLang } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { postJson } from "@/lib/api-client";

// Panneau « Agent AI » réutilisable pour les espaces Clients et Fournisseurs.
// Câblé sur les sous-routes /clients/ai/* et /vendors/ai/* via les proxies
// /api/admin/{domain}/ai/*. CSS strictement logique (Loi 3 RTL) ; chiffres
// latins. Le scoping company_id est garanti côté backend (Loi 1) — ce composant
// n'envoie jamais de tenant.

export type AgentDomain = "clients" | "vendors";

// Localisation des jetons métier (bandes, actions, objets, drapeaux…).
// Les jetons absents retombent sur une forme « humanisée » (snake_case → texte).
const TOK: Record<string, { ar: string; en: string; fr: string }> = {
  // Bandes de score / risque
  hot: { ar: "ساخن", en: "Hot", fr: "Chaud" },
  warm: { ar: "دافئ", en: "Warm", fr: "Tiède" },
  cold: { ar: "بارد", en: "Cold", fr: "Froid" },
  low: { ar: "منخفض", en: "Low", fr: "Faible" },
  medium: { ar: "متوسط", en: "Medium", fr: "Moyen" },
  high: { ar: "مرتفع", en: "High", fr: "Élevé" },
  // Recommandations de validation
  approve: { ar: "اعتماد", en: "Approve", fr: "Approuver" },
  request_documents: { ar: "طلب مستندات", en: "Request documents", fr: "Demander des documents" },
  review: { ar: "مراجعة", en: "Review", fr: "À revoir" },
  reject: { ar: "رفض", en: "Reject", fr: "Rejeter" },
  // Actions recommandées
  propose_golden_visa: { ar: "اقتراح الإقامة الذهبية", en: "Propose Golden Visa", fr: "Proposer Golden Visa" },
  schedule_visit: { ar: "تحديد زيارة", en: "Schedule visit", fr: "Planifier une visite" },
  send_proposal: { ar: "إرسال عرض", en: "Send proposal", fr: "Envoyer une proposition" },
  follow_up_call: { ar: "مكالمة متابعة", en: "Follow-up call", fr: "Appel de suivi" },
  follow_up: { ar: "متابعة", en: "Follow up", fr: "Relance" },
  nurture_sequence: { ar: "تسلسل رعاية", en: "Nurture sequence", fr: "Séquence de nurturing" },
  collect_contact: { ar: "جمع جهة الاتصال", en: "Collect contact", fr: "Collecter un contact" },
  qualify_needs: { ar: "تحديد الاحتياجات", en: "Qualify needs", fr: "Qualifier le besoin" },
  complete_verification: { ar: "إكمال التحقق", en: "Complete verification", fr: "Compléter la vérification" },
  request_trade_licence: { ar: "طلب الرخصة التجارية", en: "Request trade licence", fr: "Demander la licence" },
  request_insurance: { ar: "طلب التأمين", en: "Request insurance", fr: "Demander l'assurance" },
  review_performance: { ar: "مراجعة الأداء", en: "Review performance", fr: "Revoir la performance" },
  collect_first_rating: { ar: "أول تقييم", en: "Collect first rating", fr: "Recueillir une note" },
  eligible_for_jobs: { ar: "مؤهل للمهام", en: "Eligible for jobs", fr: "Éligible aux missions" },
  // Objets de message
  proposal: { ar: "عرض", en: "Proposal", fr: "Proposition" },
  welcome: { ar: "ترحيب", en: "Welcome", fr: "Bienvenue" },
  visit: { ar: "زيارة", en: "Visit", fr: "Visite" },
  performance_review: { ar: "مراجعة الأداء", en: "Performance review", fr: "Revue de performance" },
};

function humanize(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

function tok(key: string, lang: string): string {
  const entry = TOK[key];
  if (!entry) return humanize(key);
  return entry[lang as "ar" | "en" | "fr"] ?? entry.en;
}

type Tab = "insights" | "entity" | "secondary" | "message" | "chat";

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
  // Clients : message remplace l'ancien onglet "secondary".
  clients: ["insights", "entity", "message", "chat"],
  // Fournisseurs : validation (secondary) ET message d'outreach (parité Clients).
  vendors: ["insights", "entity", "secondary", "message", "chat"],
};

function tabLabel(t: Translations, domain: AgentDomain, tab: Tab): string {
  if (tab === "insights") return t.aiagent_tab_insights;
  if (tab === "chat") return t.aiagent_tab_chat;
  if (tab === "message") return t.aiagent_tab_message;
  if (tab === "entity") return domain === "clients" ? t.aiagent_tab_score : t.aiagent_risk_band;
  // secondary = validation (fournisseurs)
  return t.aiagent_tab_validation;
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

function Chips({
  label,
  items,
  lang,
}: {
  label: string;
  items: string[];
  lang: string;
}): React.ReactNode {
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
            {tok(a, lang)}
          </span>
        ))}
      </div>
    </div>
  );
}

// C2 — cible de navigation par action recommandée (clé d'écran de page.tsx).
// Une action sans cible reste une puce d'information (non cliquable).
const ACTION_TARGET: Record<string, string> = {
  // Clients
  schedule_visit: "realestate_agenda",
  propose_golden_visa: "realestate_golden_visa",
  send_proposal: "realestate_vente",
  follow_up_call: "crm",
  follow_up: "crm",
  nurture_sequence: "crm",
  collect_contact: "personne",
  qualify_needs: "personne",
  // Fournisseurs
  complete_verification: "fournisseurs_validation",
  request_trade_licence: "fournisseurs_fiches",
  request_insurance: "fournisseurs_fiches",
  review_performance: "fournisseurs_fiches",
  collect_first_rating: "fournisseurs_fiches",
};

function RecommendedActions({
  label,
  items,
  lang,
  onNavigate,
}: {
  label: string;
  items: string[];
  lang: string;
  onNavigate?: (screen: string) => void;
}): React.ReactNode {
  if (!items.length) return null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-4)" }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {items.map((a) => {
          const target = ACTION_TARGET[a];
          const clickable = Boolean(target && onNavigate);
          return (
            <button
              key={a}
              type="button"
              onClick={clickable ? () => onNavigate?.(target) : undefined}
              disabled={!clickable}
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: clickable ? "#1A1610" : "var(--ink)",
                background: clickable ? "var(--gold-ghost)" : "var(--line-soft)",
                border: clickable ? "1px solid var(--gold)" : "1px solid transparent",
                borderRadius: 999,
                padding: "3px 10px",
                cursor: clickable ? "pointer" : "default",
              }}
            >
              {clickable ? `${tok(a, lang)} →` : tok(a, lang)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function AgentAiPanel({
  domain,
  onNavigate,
}: {
  domain: AgentDomain;
  onNavigate?: (screen: string) => void;
}): React.ReactNode {
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
            data-testid={`aitab-${tb}`}
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
      {tab === "entity" && (
        <EntityTab base={base} domain={domain} lang={lang} mode="entity" onNavigate={onNavigate} />
      )}
      {tab === "secondary" && (
        <EntityTab base={base} domain={domain} lang={lang} mode="secondary" onNavigate={onNavigate} />
      )}
      {tab === "message" && (
        <EntityTab base={base} domain={domain} lang={lang} mode="message" onNavigate={onNavigate} />
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
  onNavigate,
}: {
  base: string;
  domain: AgentDomain;
  lang: string;
  mode: "entity" | "secondary" | "message";
  onNavigate?: (screen: string) => void;
}): React.ReactNode {
  const t = useT();
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [res, setRes] = useState<EntityResult | null>(null);
  // Objets d'outreach par domaine (onglet Message).
  const PURPOSES =
    domain === "clients"
      ? ["follow_up", "proposal", "welcome", "visit"]
      : ["request_documents", "performance_review", "welcome", "follow_up"];
  // Champs message — email est le canal d'envoi réel (WhatsApp = template requis).
  const [channel, setChannel] = useState("email");
  const [purpose, setPurpose] = useState(PURPOSES[0]);
  // Envoi réel du message (C1) — brouillon éditable avant envoi (humain dans la boucle).
  const [draftMsg, setDraftMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<string | null>(null);

  // Recharge le brouillon éditable quand un nouveau message est généré.
  useEffect(() => {
    if (res?.message) setDraftMsg(res.message);
  }, [res?.message]);

  async function sendMessage(): Promise<void> {
    if (!id.trim() || !draftMsg.trim()) return;
    setSending(true);
    setSendStatus(null);
    try {
      const r = await postJson(`${base}/${encodeURIComponent(id.trim())}/message/send`, {
        channel,
        locale: lang,
        purpose,
        message: draftMsg,
      });
      const json = (await r.json()) as { data?: { status?: string } };
      setSendStatus(r.ok ? (json.data?.status ?? "error") : "error");
    } catch {
      setSendStatus("error");
    } finally {
      setSending(false);
    }
  }

  // Résolution de la sous-route selon domaine + mode.
  function path(): { url: string; body: Record<string, string> } {
    const eid = encodeURIComponent(id.trim());
    if (mode === "entity") {
      const action = domain === "clients" ? "score" : "risk";
      return { url: `${base}/${eid}/${action}?locale=${lang}`, body: {} };
    }
    if (mode === "message") {
      return {
        url: `${base}/${eid}/message`,
        body: { channel, locale: lang, purpose },
      };
    }
    // secondary = validation (fournisseurs)
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

  const showMessageFields = mode === "message";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <EntitySearchInput
          placeholder={t.aiagent_search_placeholder}
          onSelect={(sid) => {
            setId(sid);
            setRes(null);
          }}
        />
        {showMessageFields && (
          <>
            <select value={channel} onChange={(e) => setChannel(e.target.value)} style={inputStyle}>
              <option value="whatsapp">WhatsApp</option>
              <option value="email">Email</option>
            </select>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)} style={inputStyle}>
              {PURPOSES.map((p) => (
                <option key={p} value={p}>
                  {tok(p, lang)}
                </option>
              ))}
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
                  {t.aiagent_band} : {tok(res.band, lang)}
                </span>
              )}
              {res.risk_band && (
                <span style={{ marginInlineStart: 8 }}>
                  {t.aiagent_risk_band} : {tok(res.risk_band, lang)}
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
              {t.aiagent_tab_validation} : <strong>{tok(res.recommendation, lang)}</strong>
            </div>
          )}
          {res.message && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                value={draftMsg}
                onChange={(e) => setDraftMsg(e.target.value)}
                rows={4}
                style={{
                  width: "100%",
                  resize: "vertical",
                  padding: "8px 10px",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  background: "var(--bg)",
                  color: "var(--ink)",
                  fontSize: 12.5,
                  fontFamily: "inherit",
                  textAlign: "start",
                }}
              />
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <button onClick={() => void sendMessage()} disabled={sending} style={primaryBtn}>
                  {sending ? t.aiagent_loading : t.aiagent_send}
                </button>
                {sendStatus === "queued" && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--emerald, #2f9e6e)" }}>
                    {t.aiagent_sent}
                  </span>
                )}
                {sendStatus === "template_required" && (
                  <span style={{ fontSize: 11.5, color: "var(--ink-4)" }}>
                    {t.aiagent_send_template}
                  </span>
                )}
                {sendStatus === "no_recipient" && (
                  <span style={{ fontSize: 11.5, color: "var(--rose)" }}>
                    {t.aiagent_send_no_recipient}
                  </span>
                )}
                {sendStatus === "error" && (
                  <span style={{ fontSize: 11.5, color: "var(--rose)" }}>{t.aiagent_error}</span>
                )}
              </div>
            </div>
          )}
          <RecommendedActions
            label={t.aiagent_recommended}
            items={res.recommended_actions ?? []}
            lang={lang}
            onNavigate={onNavigate}
          />
          <Chips label={t.aiagent_flags} items={res.flags ?? []} lang={lang} />
          <Chips label={t.aiagent_flags} items={res.blocking_issues ?? []} lang={lang} />
          <Chips label={t.aiagent_flags} items={res.warnings ?? []} lang={lang} />
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
