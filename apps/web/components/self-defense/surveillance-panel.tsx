"use client";

/**
 * Panneau de surveillance Self-Defense : s'affiche à l'activation d'un mode.
 * Deux vues — Liste + Carte (monde) — des sessions actives : utilisateurs, IPs,
 * régions (géo-IP). Mode avancé : ventilation par catégorie / sous-catégorie / page.
 *
 * - DÉPLAÇABLE à la souris (par l'en-tête) + RÉDUCTIBLE (replié = barre seule),
 *   position + état repliés mémorisés (localStorage). RTL-safe (insetInlineStart).
 * - Réservé admin/manager : `/api/admin/presence/active` ; 401/403 → rien (pas de
 *   fuite d'IP). Polling ~12 s.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";

import { ReMap, type MapMarker } from "@/components/re-map";
import { ViewToggle } from "@/components/view-toggle";
import { useLang } from "@/components/language-provider";
import { useSelfDefense } from "@/lib/use-self-defense";

type Lang = "ar" | "en" | "fr";
type Bucket = { key: string; label?: string | null; count: number };
type Sess = {
  user_id: string;
  user_label?: string | null;
  ip?: string | null;
  country?: string | null;
  city?: string | null;
  lat?: number | null;
  lng?: number | null;
  category?: string | null;
  subcategory?: string | null;
  page?: string | null;
  last_seen_at: string;
};
type Active = {
  sessions: Sess[];
  by_user: Bucket[];
  by_ip: Bucket[];
  by_region: Bucket[];
  advanced?: { by_category: Bucket[]; by_subcategory: Bucket[]; by_page: Bucket[] } | null;
};

const TR: Record<Lang, Record<string, string>> = {
  fr: {
    title: "Surveillance", users: "Utilisateurs", ips: "Adresses IP", regions: "Régions",
    categories: "Catégories", subcategories: "Sous-catégories", pages: "Pages",
    advanced: "Avancé", active: "actives", none: "Aucune session active.", unknown: "inconnu",
    list: "Liste", map: "Carte", collapse: "Réduire", expand: "Agrandir",
  },
  en: {
    title: "Surveillance", users: "Users", ips: "IP addresses", regions: "Regions",
    categories: "Categories", subcategories: "Subcategories", pages: "Pages",
    advanced: "Advanced", active: "active", none: "No active session.", unknown: "unknown",
    list: "List", map: "Map", collapse: "Collapse", expand: "Expand",
  },
  ar: {
    title: "المراقبة", users: "المستخدمون", ips: "عناوين IP", regions: "المناطق",
    categories: "الفئات", subcategories: "الفئات الفرعية", pages: "الصفحات",
    advanced: "متقدم", active: "نشطة", none: "لا جلسات نشطة.", unknown: "غير معروف",
    list: "قائمة", map: "خريطة", collapse: "تصغير", expand: "تكبير",
  },
};

const PANEL_W = 380;
const POS_KEY = "sgi_surv_pos_v1";
const COL_KEY = "sgi_surv_collapsed_v1";
const DEFAULT_POS = { top: 64, is: 16 };

function BucketList({ title, rows, unknown }: { title: string; rows: Bucket[]; unknown: string }): React.ReactNode {
  return (
    <div style={{ marginBlockEnd: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", marginBlockEnd: 4 }}>{title}</div>
      {rows.length === 0 ? (
        <div style={{ fontSize: 11.5, color: "var(--ink-4)" }}>—</div>
      ) : (
        rows.slice(0, 8).map((b) => (
          <div
            key={b.key}
            style={{ display: "flex", justifyContent: "space-between", fontSize: 12, paddingBlock: 2 }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
              {b.label || (b.key === "∅" ? unknown : b.key)}
            </span>
            <span style={{ fontWeight: 700, color: "var(--ink-4)" }}>{b.count}</span>
          </div>
        ))
      )}
    </div>
  );
}

export function SurveillancePanel(): React.ReactNode {
  const { lang } = useLang();
  const lg = (lang as Lang) in TR ? (lang as Lang) : "fr";
  const L = (k: string): string => TR[lg][k] ?? TR.fr[k] ?? k;

  const { mode } = useSelfDefense();
  const [view, setView] = useState<"list" | "map">("list");
  const [advanced, setAdvanced] = useState(false);
  const [data, setData] = useState<Active | null>(null);
  const [authorized, setAuthorized] = useState(true);
  const [pos, setPos] = useState(DEFAULT_POS);
  const [collapsed, setCollapsed] = useState(false);

  const drag = useRef<{ sx: number; sy: number; top0: number; is0: number; moved: boolean; rtl: boolean } | null>(
    null,
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) {
        const p = JSON.parse(raw) as { top?: number; is?: number };
        if (typeof p.top === "number" && typeof p.is === "number") setPos({ top: p.top, is: p.is });
      }
      setCollapsed(localStorage.getItem(COL_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/presence/active?advanced=${advanced ? 1 : 0}`, { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        setAuthorized(false);
        return;
      }
      if (res.ok) {
        setAuthorized(true);
        setData((await res.json()) as Active);
      }
    } catch {
      /* best-effort */
    }
  }, [advanced]);

  useEffect(() => {
    if (!mode) return;
    void load();
    const id = window.setInterval(() => void load(), 12000);
    return () => window.clearInterval(id);
  }, [mode, load]);

  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    const sign = d.rtl ? -1 : 1;
    const is = Math.min(Math.max(8, d.is0 + sign * dx), window.innerWidth - 90);
    const top = Math.min(Math.max(8, d.top0 + dy), window.innerHeight - 56);
    setPos({ top, is });
  }, []);

  const onUp = useCallback(() => {
    const d = drag.current;
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    if (d?.moved) {
      setPos((p) => {
        try {
          localStorage.setItem(POS_KEY, JSON.stringify(p));
        } catch {
          /* ignore */
        }
        return p;
      });
    }
    drag.current = null;
  }, [onMove]);

  const onDownHeader = useCallback(
    (e: React.PointerEvent) => {
      const rtl = typeof document !== "undefined" && document.documentElement.dir === "rtl";
      drag.current = { sx: e.clientX, sy: e.clientY, top0: pos.top, is0: pos.is, moved: false, rtl };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [pos.top, pos.is, onMove, onUp],
  );

  function toggleCollapsed(): void {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COL_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  if (!mode || !authorized) return null;

  const markers: MapMarker[] = (data?.sessions ?? [])
    .filter((s) => s.lat != null && s.lng != null)
    .map((s, i) => ({
      id: `${s.user_id}-${i}`,
      lat: s.lat as number,
      lng: s.lng as number,
      title: s.user_label || s.ip || "?",
      subtitle: [s.city, s.country].filter(Boolean).join(", ") || undefined,
      badge: s.page || s.category || undefined,
    }));

  const count = data?.sessions.length ?? 0;
  const iconBtn: React.CSSProperties = {
    border: "none",
    background: "var(--bg-subtle, rgba(255,255,255,0.06))",
    color: "var(--ink-4)",
    cursor: "pointer",
    borderRadius: 8,
    width: 26,
    height: 26,
    fontSize: 14,
    fontWeight: 700,
    lineHeight: 1,
  };

  return (
    <div
      style={{
        position: "fixed",
        insetBlockStart: pos.top,
        insetInlineStart: pos.is,
        width: collapsed ? "auto" : PANEL_W,
        maxWidth: "92vw",
        maxHeight: collapsed ? undefined : "72vh",
        overflowY: collapsed ? "visible" : "auto",
        background: "var(--bg-paper)",
        border: "1px solid var(--line-soft)",
        borderRadius: 14,
        boxShadow: "0 16px 44px rgba(0,0,0,0.32)",
        zIndex: 1320,
        pointerEvents: "auto",
      }}
    >
      {/* En-tête = poignée de déplacement */}
      <div
        onPointerDown={onDownHeader}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "10px 12px",
          cursor: "grab",
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <span aria-hidden style={{ color: "var(--ink-4)", fontSize: 14, letterSpacing: -2 }}>
          ⠿
        </span>
        <span style={{ fontWeight: 700, fontSize: 14 }}>📡 {L("title")}</span>
        <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
          {count} {L("active")}
        </span>

        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {!collapsed && (
            <>
              <label style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}>
                <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
                {L("advanced")}
              </label>
              <ViewToggle view={view} onChange={setView} listLabel={L("list")} mapLabel={L("map")} />
            </>
          )}
          <button
            type="button"
            aria-label={collapsed ? L("expand") : L("collapse")}
            title={collapsed ? L("expand") : L("collapse")}
            onClick={toggleCollapsed}
            style={iconBtn}
          >
            {collapsed ? "▢" : "—"}
          </button>
        </div>
      </div>

      {/* Corps (masqué si replié) */}
      {!collapsed && (
        <div style={{ padding: "0 14px 14px" }}>
          {view === "map" ? (
            <ReMap markers={markers} height={380} emptyLabel={L("none")} />
          ) : count === 0 ? (
            <div style={{ fontSize: 12.5, color: "var(--ink-4)" }}>{L("none")}</div>
          ) : advanced && data?.advanced ? (
            <>
              <BucketList title={L("categories")} rows={data.advanced.by_category} unknown={L("unknown")} />
              <BucketList title={L("subcategories")} rows={data.advanced.by_subcategory} unknown={L("unknown")} />
              <BucketList title={L("pages")} rows={data.advanced.by_page} unknown={L("unknown")} />
            </>
          ) : (
            <>
              <BucketList title={L("users")} rows={data?.by_user ?? []} unknown={L("unknown")} />
              <BucketList title={L("ips")} rows={data?.by_ip ?? []} unknown={L("unknown")} />
              <BucketList title={L("regions")} rows={data?.by_region ?? []} unknown={L("unknown")} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
