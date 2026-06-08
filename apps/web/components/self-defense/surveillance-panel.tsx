"use client";

/**
 * Panneau de surveillance Self-Defense : s'affiche à l'activation d'un mode.
 * Deux vues — Liste + Carte (monde) — des sessions actives : utilisateurs, IPs,
 * régions (géo-IP). Mode avancé : ventilation par catégorie / sous-catégorie / page.
 *
 * Réservé admin/manager : on interroge `/api/admin/presence/active` ; un 401/403 →
 * le panneau ne s'affiche pas (pas de fuite d'IP aux non-admins). Polling ~12 s.
 */

import React, { useCallback, useEffect, useState } from "react";

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
    list: "Liste", map: "Carte",
  },
  en: {
    title: "Surveillance", users: "Users", ips: "IP addresses", regions: "Regions",
    categories: "Categories", subcategories: "Subcategories", pages: "Pages",
    advanced: "Advanced", active: "active", none: "No active session.", unknown: "unknown",
    list: "List", map: "Map",
  },
  ar: {
    title: "المراقبة", users: "المستخدمون", ips: "عناوين IP", regions: "المناطق",
    categories: "الفئات", subcategories: "الفئات الفرعية", pages: "الصفحات",
    advanced: "متقدم", active: "نشطة", none: "لا جلسات نشطة.", unknown: "غير معروف",
    list: "قائمة", map: "خريطة",
  },
};

function BucketList({ title, rows, unknown }: { title: string; rows: Bucket[]; unknown: string }): React.ReactNode {
  return (
    <div style={{ marginBlockEnd: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--ink-4)", marginBlockEnd: 4 }}>
        {title}
      </div>
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

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/presence/active?advanced=${advanced ? 1 : 0}`, {
        cache: "no-store",
      });
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

  return (
    <div
      style={{
        position: "fixed",
        insetBlockStart: 42,
        insetInlineStart: 16,
        width: 440,
        maxWidth: "92vw",
        maxHeight: "76vh",
        overflowY: "auto",
        background: "var(--bg-paper)",
        border: "1px solid var(--line-soft)",
        borderRadius: 14,
        boxShadow: "0 16px 44px rgba(0,0,0,0.32)",
        padding: 16,
        zIndex: 1320,
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBlockEnd: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 14 }}>📡 {L("title")}</div>
        <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
          {count} {L("active")}
        </div>
        <div style={{ marginInlineStart: "auto", display: "flex", alignItems: "center", gap: 10 }}>
          <label style={{ fontSize: 11.5, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={advanced} onChange={(e) => setAdvanced(e.target.checked)} />
            {L("advanced")}
          </label>
          <ViewToggle view={view} onChange={setView} listLabel={L("list")} mapLabel={L("map")} />
        </div>
      </div>

      {view === "map" ? (
        <ReMap markers={markers} height={420} emptyLabel={L("none")} />
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
  );
}
