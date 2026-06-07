"use client";

// Pilotage du design du site public depuis la sous-rubrique « Website ».
// 3 modèles de marque (Instagram · Snapchat · Facebook), appliqués :
//   • Manuellement : l'utilisateur choisit un style, il reste actif.
//   • Automatiquement : rotation entre les 3 styles toutes les X heures (délai
//     réglable) — le style actif est dérivé du temps écoulé depuis `since`.
// Le choix est persisté localement (sgi_site_design_v1) ; un aperçu live reflète
// exactement le rendu. (Le branchement du portail public sur ce réglage se fait
// via un setting backend — voir note d'intégration.)

import React, { useEffect, useMemo, useState } from "react";
import type { Lang } from "@/lib/i18n";

export type SiteModel = "instagram" | "snapchat" | "facebook";

interface ModelDef {
  key: SiteModel;
  name: string;
  bg: string;          // fond de la vitrine
  card: string;        // fond des cartes
  accent: string;      // couleur d'accent / liens
  ink: string;         // texte principal
  ctaBg: string;       // fond du bouton principal (peut être un dégradé)
  ctaText: string;     // texte du bouton principal
}

export const SITE_MODELS: ModelDef[] = [
  { key: "instagram", name: "Instagram", bg: "#FEF8FA", card: "#FFFFFF", accent: "#E1306C", ink: "#1A1014", ctaBg: "linear-gradient(135deg,#833AB4,#E1306C 45%,#F77737)", ctaText: "#FFFFFF" },
  { key: "snapchat",  name: "Snapchat",  bg: "#FFFDF4", card: "#FFFFFF", accent: "#C9A800", ink: "#1A1705", ctaBg: "#FFFC00", ctaText: "#0B0B0B" },
  { key: "facebook",  name: "Facebook",  bg: "#F7F9FC", card: "#FFFFFF", accent: "#1877F2", ink: "#0A1A2F", ctaBg: "#1877F2", ctaText: "#FFFFFF" },
];

const ORDER: SiteModel[] = ["instagram", "snapchat", "facebook"];
const byKey = (k: SiteModel) => SITE_MODELS.find((m) => m.key === k) ?? SITE_MODELS[0];

type Mode = "manual" | "auto";
interface Conf { mode: Mode; manual: SiteModel; delayHours: number; since: number; }

const LS_KEY = "sgi_site_design_v1";
const DEFAULT_CONF: Conf = { mode: "manual", manual: "instagram", delayHours: 6, since: 0 };

function loadConf(): Conf {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return { ...DEFAULT_CONF, ...JSON.parse(raw) };
  } catch { /* stockage indisponible */ }
  return DEFAULT_CONF;
}
function saveConf(c: Conf) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(c)); } catch { /* stockage indisponible */ }
}

// Style actif + temps avant bascule, en mode rotation automatique.
function autoState(c: Conf, now: number): { active: SiteModel; next: SiteModel; nextInMs: number } {
  const span = Math.max(1, c.delayHours) * 3_600_000;
  const elapsed = Math.max(0, now - (c.since || now));
  const idx = Math.floor(elapsed / span) % ORDER.length;
  const nextIdx = (idx + 1) % ORDER.length;
  return { active: ORDER[idx], next: ORDER[nextIdx], nextInMs: span - (elapsed % span) };
}

function fmtCountdown(ms: number, lang: Lang): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const sep = lang === "ar" ? " " : " ";
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s${sep}`.trim();
}

export function SiteDesignPanel({ lang }: { lang: Lang }) {
  const L = (ar: string, en: string, fr: string) => (lang === "ar" ? ar : lang === "fr" ? fr : en);

  const [conf, setConf] = useState<Conf>(DEFAULT_CONF);
  const [hydrated, setHydrated] = useState(false);
  const [now, setNow] = useState(0);
  const [offline, setOffline] = useState(false);

  // Hydratation : d'abord le cache local (instantané, évite l'écran vide), puis
  // synchronisation avec le serveur (source de vérité, partagée avec le portail).
  useEffect(() => {
    setConf(loadConf());
    setNow(Date.now());
    setHydrated(true);
    (async () => {
      try {
        const res = await fetch("/api/admin/site-design");
        if (!res.ok) { setOffline(true); return; }
        const d = (await res.json())?.data;
        if (!d) return;
        const style: SiteModel = ORDER.includes(d.style) ? d.style : "instagram";
        const merged: Conf = {
          mode: d.mode === "auto" ? "auto" : "manual",
          manual: style,
          delayHours: Math.max(1, Math.min(168, Number(d.delay_hours) || 6)),
          since: d.rotation_since ? Date.parse(d.rotation_since) || 0 : 0,
        };
        setConf(merged);
        saveConf(merged);
      } catch {
        setOffline(true);
      }
    })();
  }, []);

  // Pousse le réglage au backend (le portail public lira la même source).
  const pushToApi = async (c: Conf) => {
    try {
      const res = await fetch("/api/admin/site-design", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: c.mode, style: c.manual, delay_hours: c.delayHours }),
      });
      if (!res.ok) { setOffline(true); return; }
      setOffline(false);
      // Re-cale l'ancre de rotation sur celle calculée par le serveur.
      const d = (await res.json())?.data;
      const ts = d?.rotation_since ? Date.parse(d.rotation_since) : NaN;
      if (!Number.isNaN(ts)) {
        setConf((prev) => {
          const nx = { ...prev, since: ts };
          saveConf(nx);
          return nx;
        });
      }
    } catch {
      setOffline(true);
    }
  };

  // Tick de l'horloge seulement en mode auto (pour le compte à rebours).
  useEffect(() => {
    if (!hydrated || conf.mode !== "auto") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hydrated, conf.mode]);

  const update = (patch: Partial<Conf>) => {
    const next = { ...conf, ...patch };
    setConf(next);
    saveConf(next);
    void pushToApi(next);
  };

  const auto = useMemo(() => autoState(conf, now || Date.now()), [conf, now]);
  const activeKey: SiteModel = conf.mode === "auto" ? auto.active : conf.manual;
  const active = byKey(activeKey);

  if (!hydrated) {
    // Réserve la hauteur pour éviter le saut de mise en page.
    return <div style={{ height: 280, marginBottom: 24, borderRadius: "var(--r-md)", background: "var(--bg-paper)", border: "1px solid var(--line-soft)" }} />;
  }

  return (
    <div style={{ marginBottom: 24, borderRadius: "var(--r-md)", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", overflow: "hidden" }}>
      {/* En-tête du panneau */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", padding: "16px 18px", borderBottom: "1px solid var(--line-soft)" }}>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: "var(--ink)" }}>
            {L("تصميم الموقع العام", "Public site design", "Design du site public")}
          </div>
          <div style={{ fontSize: 12, color: "var(--ink-4)", marginTop: 2 }}>
            {L("ثلاثة نماذج — يدوي أو تدوير تلقائي",
               "Three models — manual or automatic rotation",
               "Trois modèles — manuel ou rotation automatique")}
            {offline && (
              <span style={{ marginInlineStart: 8, color: "var(--rose)", fontWeight: 600 }}>
                · {L("غير متصل (محلي)", "offline (local)", "hors-ligne (local)")}
              </span>
            )}
          </div>
        </div>
        {/* Bascule Manuel / Auto */}
        <div style={{ display: "inline-flex", border: "1px solid var(--line)", borderRadius: "var(--r)", overflow: "hidden" }}>
          {(["manual", "auto"] as Mode[]).map((md) => {
            const on = conf.mode === md;
            return (
              <button
                key={md}
                type="button"
                onClick={() => update(md === "auto" ? { mode: "auto", since: Date.now() } : { mode: "manual" })}
                style={{
                  padding: "7px 16px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "none",
                  background: on ? "var(--gold)" : "transparent",
                  color: on ? "#FFFFFF" : "var(--ink-3)",
                }}
              >
                {md === "manual" ? L("يدوي", "Manual", "Manuel") : L("تلقائي", "Auto", "Automatique")}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)", gap: 18, padding: 18 }}>
        {/* ── Colonne contrôles ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {/* Sélecteur de modèles */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {SITE_MODELS.map((m) => {
              const isActive = activeKey === m.key;
              const isChosen = conf.mode === "manual" ? conf.manual === m.key : false;
              const selectable = conf.mode === "manual";
              return (
                <button
                  key={m.key}
                  type="button"
                  disabled={!selectable}
                  onClick={() => selectable && update({ manual: m.key })}
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
                    borderRadius: "var(--r)", textAlign: "start",
                    cursor: selectable ? "pointer" : "default",
                    border: `2px solid ${isActive ? m.accent : "var(--line-soft)"}`,
                    background: isActive ? "var(--bg-ivory)" : "var(--bg-base)",
                    opacity: selectable || isActive ? 1 : 0.55,
                  }}
                >
                  {/* pastille marque */}
                  <span style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: m.ctaBg, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.08)" }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{m.name}</span>
                    <span style={{ display: "block", fontSize: 11, color: "var(--ink-4)" }}>{m.accent}</span>
                  </span>
                  {isActive && (
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: m.accent, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {conf.mode === "auto"
                        ? L("نشط", "Live", "Actif")
                        : (isChosen ? L("مُختار", "Selected", "Choisi") : "")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Réglages rotation (mode auto) */}
          {conf.mode === "auto" && (
            <div style={{ padding: "12px 14px", borderRadius: "var(--r)", background: "var(--gold-ghost)", border: "1px solid var(--gold-line)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: "var(--ink-2)", flexWrap: "wrap" }}>
                {L("التدوير كل", "Rotate every", "Rotation toutes les")}
                <input
                  type="number" min={1} max={168} value={conf.delayHours}
                  onChange={(e) => update({ delayHours: Math.max(1, Math.min(168, Number(e.target.value) || 1)), since: Date.now() })}
                  style={{ width: 64, height: 32, padding: "0 8px", borderRadius: "var(--r-sm)", border: "1px solid var(--line)", background: "var(--bg-ivory)", color: "var(--ink)", fontSize: 13, textAlign: "center" }}
                />
                {L("ساعة", "hours", "heures")}
              </label>
              <div style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-3)" }}>
                {L("الحالي", "Current", "Actuel")} :{" "}
                <strong style={{ color: active.accent }}>{active.name}</strong>
                {" · "}
                {L("التالي", "Next", "Prochain")} :{" "}
                <strong style={{ color: byKey(auto.next).accent }}>{byKey(auto.next).name}</strong>
                {" "}
                <span style={{ color: "var(--ink-4)" }}>
                  ({L("خلال", "in", "dans")} {fmtCountdown(auto.nextInMs, lang)})
                </span>
              </div>
              {/* Frise des 3 prochains créneaux */}
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {[0, 1, 2].map((i) => {
                  const k = ORDER[(ORDER.indexOf(auto.active) + i) % ORDER.length];
                  const mm = byKey(k);
                  return (
                    <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: mm.accent, opacity: i === 0 ? 1 : 0.35 }} title={mm.name} />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Colonne aperçu live ── */}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
            {L("معاينة مباشرة", "Live preview", "Aperçu en direct")}
          </div>
          <SitePreview model={active} lang={lang} />
        </div>
      </div>
    </div>
  );
}

/* Mini-vitrine fidèle au modèle actif (hero + 2 cartes biens). */
function SitePreview({ model, lang }: { model: ModelDef; lang: Lang }) {
  const L = (ar: string, en: string, fr: string) => (lang === "ar" ? ar : lang === "fr" ? fr : en);
  return (
    <div style={{ borderRadius: "var(--r-md)", overflow: "hidden", border: "1px solid var(--line)", boxShadow: "var(--shadow-2)" }}>
      {/* barre navigateur */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", background: "#E9EBEE" }}>
        <span style={{ width: 9, height: 9, borderRadius: 5, background: "#FF5F57" }} />
        <span style={{ width: 9, height: 9, borderRadius: 5, background: "#FEBC2E" }} />
        <span style={{ width: 9, height: 9, borderRadius: 5, background: "#28C840" }} />
        <span style={{ marginInlineStart: 8, fontSize: 10, color: "#7A828C" }}>infinity-realty.ae</span>
      </div>
      {/* contenu vitrine */}
      <div style={{ background: model.bg, padding: 14, color: model.ink }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: model.accent }}>INFINITY</div>
          <div style={{ display: "flex", gap: 10, fontSize: 10, color: model.ink, opacity: 0.7 }}>
            <span>{L("شراء", "Buy", "Acheter")}</span>
            <span>{L("إيجار", "Rent", "Louer")}</span>
            <span>{L("اتصل", "Contact", "Contact")}</span>
          </div>
        </div>
        {/* hero */}
        <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.25, marginBottom: 4 }}>
          {L("اعثر على عقارك في دبي", "Find your home in Dubai", "Trouvez votre bien à Dubaï")}
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 10 }}>
          {L("آلاف العقارات المختارة", "Thousands of curated listings", "Des milliers de biens sélectionnés")}
        </div>
        <span style={{ display: "inline-block", padding: "7px 16px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: model.ctaBg, color: model.ctaText }}>
          {L("ابدأ البحث", "Start searching", "Lancer la recherche")}
        </span>
        {/* cartes biens */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          {[0, 1].map((i) => (
            <div key={i} style={{ background: model.card, borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
              <div style={{ height: 36, background: `linear-gradient(135deg, ${model.accent}22, ${model.accent}55)` }} />
              <div style={{ padding: "6px 8px" }}>
                <div style={{ fontSize: 10, fontWeight: 700 }}>{i === 0 ? "Marina · 2BR" : "Downtown · 1BR"}</div>
                <div style={{ fontSize: 11, fontWeight: 800, color: model.accent }}>{i === 0 ? "1,850,000 AED" : "95,000 AED/yr"}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
