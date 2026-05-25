"use client";

import React, { useState, useEffect } from "react";
import { useTheme } from "@/components/theme-provider";
import { useLang, useT } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

/* ─── Icon wrapper ──────────────────────────────────────────────── */
export function Ic({ s = 16, children }: { s?: number; children: React.ReactNode }) {
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  );
}

export const IcDash      = () => <Ic><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></Ic>;
export const IcProp      = () => <Ic><path d="M3 21V10l9-7 9 7v11"/><path d="M9 21v-7h6v7"/></Ic>;
export const IcCRM       = () => <Ic><circle cx="9" cy="8" r="3.5"/><path d="M2 21c0-3.5 3.2-6 7-6s7 2.5 7 6"/><circle cx="17" cy="6" r="2.5"/><path d="M22 16c0-2.5-2.5-4-5-4"/></Ic>;
export const IcContract  = () => <Ic><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/></Ic>;
export const IcRental    = () => <Ic><path d="M21 10V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l3-1.7"/><circle cx="17" cy="17" r="3"/><path d="M19.5 19.5 22 22"/></Ic>;
export const IcVisa      = () => <Ic><path d="M12 2 14.5 9 22 9.3l-6 4.6 2.2 7.4L12 17.5 5.8 21.3 8 13.9 2 9.3 9.5 9z"/></Ic>;
export const IcFinance   = () => <Ic><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 6-7"/></Ic>;
export const IcReport    = () => <Ic><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12v5M12 8v9M16 14v3"/></Ic>;
export const IcSearch    = () => <Ic><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></Ic>;
export const IcBell      = () => <Ic><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10 21a2 2 0 0 0 4 0"/></Ic>;
export const IcSun       = () => <Ic><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></Ic>;
export const IcMoon      = () => <Ic><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></Ic>;
export const IcPlus      = () => <Ic><path d="M12 5v14M5 12h14"/></Ic>;
export const IcChevD     = () => <Ic s={15}><path d="m6 9 6 6 6-6"/></Ic>;
export const IcChevR     = () => <Ic s={14}><path d="m9 6 6 6-6 6"/></Ic>;
export const IcChevL     = () => <Ic s={14}><path d="m15 6-6 6 6 6"/></Ic>;
export const IcArrowUp   = () => <Ic s={13}><path d="M7 17 17 7M9 7h8v8"/></Ic>;
export const IcArrowDown = () => <Ic s={13}><path d="M17 7 7 17M7 9v8h8"/></Ic>;
export const IcDownload  = () => <Ic s={15}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></Ic>;
export const IcTrend     = () => <Ic s={14}><path d="m22 7-9 9-5-5-6 6M16 7h6v6"/></Ic>;
export const IcCheck     = () => <Ic s={12}><path d="m5 12 5 5L20 7"/></Ic>;
export const IcClock     = () => <Ic s={13}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Ic>;
export const IcPhone     = () => <Ic><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1A19.5 19.5 0 0 1 5 13.2 19.8 19.8 0 0 1 2 4.6 2 2 0 0 1 4 2.4h3a2 2 0 0 1 2 1.7l.4 2.5a2 2 0 0 1-.6 1.8L7.6 9.8a16 16 0 0 0 6.6 6.6l1.4-1.2a2 2 0 0 1 1.8-.6l2.5.4a2 2 0 0 1 1.7 2z"/></Ic>;
export const IcMail      = () => <Ic><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></Ic>;
export const IcChat      = () => <Ic><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></Ic>;
export const IcFilter    = () => <Ic><path d="M3 6h18M6 12h12M10 18h4"/></Ic>;
export const IcMap       = () => <Ic><path d="M3 6v15l6-3 6 3 6-3V3l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></Ic>;
export const IcList      = () => <Ic><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></Ic>;
export const IcGrid      = () => <Ic><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></Ic>;
export const IcBed       = () => <Ic s={14}><path d="M3 18v-7a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3v7M3 14h18"/><circle cx="7" cy="11" r="1.5"/></Ic>;
export const IcBath      = () => <Ic s={14}><path d="M3 12h18v3a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M7 12V6a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2"/></Ic>;
export const IcArea      = () => <Ic s={14}><rect x="3" y="3" width="18" height="18" rx="1"/><path d="M3 9h18M9 3v18"/></Ic>;
export const IcDoc       = () => <Ic><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></Ic>;
export const IcMore      = () => <Ic><circle cx="12" cy="5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="19" r="1.2"/></Ic>;
export const IcHeart     = () => <Ic><path d="M20.84 4.6a5.5 5.5 0 0 0-7.78 0L12 5.7l-1.06-1.1a5.5 5.5 0 0 0-7.78 7.8l1.06 1L12 21l7.78-7.6 1.06-1a5.5 5.5 0 0 0 0-7.8z"/></Ic>;
export const IcShare     = () => <Ic><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5 15.4 17.5M15.4 6.5 8.6 10.5"/></Ic>;
export const IcLock      = () => <Ic><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></Ic>;
export const IcPin       = () => <Ic><path d="M12 21s-7-7.5-7-12a7 7 0 0 1 14 0c0 4.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></Ic>;
export const IcAdmin     = () => <Ic><path d="M2 21h20M3 21V9l9-6 9 6v12M9 21v-7h6v7M12 3v18"/></Ic>;
export const IcTourisme  = () => <Ic><circle cx="12" cy="12" r="10"/><path d="m16.2 7.8-2.1 6.3-6.4 2.1 2.1-6.3 6.4-2.1z"/></Ic>;
export const IcSante     = () => <Ic><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></Ic>;
export const IcAssurance = () => <Ic><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></Ic>;
export const IcBanques   = () => <Ic><path d="M3 21h18M3 10h18M3 7l9-4 9 4M6 10v11M10 10v11M14 10v11M18 10v11"/></Ic>;
export const IcAmazon    = () => <Ic><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/></Ic>;
export const IcConsult   = () => <Ic><circle cx="12" cy="7" r="4"/><path d="M5.5 21a8.38 8.38 0 0 1 13 0"/><path d="M17 14.5a3 3 0 1 1 4 2.8V21M19 21h-4"/></Ic>;
export const IcClients   = () => <Ic><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></Ic>;
export const IcPersonne  = () => <Ic><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></Ic>;
export const IcSociete   = () => <Ic><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4"/></Ic>;
export const IcERP       = () => <Ic><rect x="2" y="2" width="9" height="9" rx="1"/><rect x="13" y="2" width="9" height="9" rx="1"/><rect x="2" y="13" width="9" height="9" rx="1"/><rect x="13" y="13" width="9" height="9" rx="1"/></Ic>;
export const IcHR        = () => <Ic><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></Ic>;
export const IcIT        = () => <Ic><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/><path d="M7 8h10M7 12h5"/></Ic>;
export const IcBackOffice= () => <Ic><path d="M2 20h20M4 20V10l8-7 8 7v10"/><path d="M9 20v-6h6v6"/><rect x="10" y="8" width="4" height="4" rx="0.5"/></Ic>;
export const IcSettings  = () => <Ic><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></Ic>;
export const IcWorkspace = () => <Ic><rect x="3" y="3" width="18" height="11" rx="2"/><path d="M7 22H17M12 18v4"/><circle cx="12" cy="9" r="2"/><path d="M8 9h1M15 9h1"/></Ic>;
export const IcAudit     = () => <Ic><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Ic>;

/* ─── Logo ────────────────────────────────────────────────────────── */
export function LogoMark({ size = 36 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <div style={{
      width: size, height: size, borderRadius: 6,
      background: "#fff", overflow: "hidden",
      display: "flex", alignItems: "center", justifyContent: "flex-start",
      flexShrink: 0,
    }}>
      <img
        src="/logo-infinity-mark.png"
        alt="Infinity"
        style={{
          height: size * 1.1,
          width: "auto",
          objectFit: "cover",
          objectPosition: "left center",
          marginInlineStart: -(size * 0.05),
        }}
      />
    </div>
  );
}

export function Wordmark({ subtitle = true }: { subtitle?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/logo-infinity-full.png"
      alt="Infinity International Facilities Management"
      style={{
        height: subtitle ? 56 : 38,
        objectFit: "contain",
        objectPosition: "left center",
        maxWidth: subtitle ? 320 : 200,
      }}
    />
  );
}

/* ─── Sidebar nav data ────────────────────────────────────────────── */
export type NavKey =
  | "dash" | "crm"
  | "clients" | "personne" | "societe"
  | "realestate" | "prop" | "contract" | "rental" | "visa"
  | "tourisme" | "sante" | "assurance" | "banques" | "amazon" | "consultants" | "admin"
  | "erp" | "workspace" | "audit"
  | "backoffice" | "hr" | "it" | "finance"
  | "report" | "parametres";

type NavItem  = { key: NavKey; icon: React.ReactElement; badge?: number };
type NavEntry =
  | ({ type: "item"  } & NavItem)
  | { type: "group"; id: string; groupKey: NavKey; icon: React.ReactElement; badge?: number; children: NavItem[] };

const NAV_ENTRIES: NavEntry[] = [
  { type: "item",  key: "dash",        icon: <IcDash /> },
  { type: "group", id: "clients",      groupKey: "clients", icon: <IcClients />,
    children: [
      { key: "personne", icon: <IcPersonne /> },
      { key: "societe",  icon: <IcSociete /> },
    ],
  },
  { type: "item",  key: "crm",         icon: <IcCRM />,  badge: 12 },
  { type: "group", id: "realestate",   groupKey: "realestate", icon: <IcProp />,
    children: [
      { key: "prop",     icon: <IcProp /> },
      { key: "contract", icon: <IcContract /> },
      { key: "rental",   icon: <IcRental /> },
      { key: "visa",     icon: <IcVisa />, badge: 3 },
    ],
  },
  { type: "item",  key: "tourisme",    icon: <IcTourisme /> },
  { type: "item",  key: "sante",       icon: <IcSante /> },
  { type: "item",  key: "assurance",   icon: <IcAssurance /> },
  { type: "item",  key: "banques",     icon: <IcBanques /> },
  { type: "item",  key: "amazon",      icon: <IcAmazon /> },
  { type: "item",  key: "consultants", icon: <IcConsult /> },
  { type: "item",  key: "admin",       icon: <IcAdmin /> },
  { type: "item",  key: "erp",         icon: <IcERP /> },
  { type: "item",  key: "workspace",   icon: <IcWorkspace /> },
  { type: "item",  key: "audit",       icon: <IcAudit /> },
  { type: "group", id: "backoffice",   groupKey: "backoffice", icon: <IcBackOffice />,
    children: [
      { key: "hr",      icon: <IcHR /> },
      { key: "it",      icon: <IcIT /> },
      { key: "finance", icon: <IcFinance /> },
    ],
  },
  { type: "item",  key: "report",      icon: <IcReport /> },
  { type: "item",  key: "parametres",  icon: <IcSettings /> },
];

/* ─── User status ─────────────────────────────────────────────────── */
type UserStatus = "online" | "available" | "busy" | "away" | "offline";

const STATUSES: { key: UserStatus; color: string; label_en: string; label_ar: string; label_fr: string }[] = [
  { key: "online",    color: "var(--emerald)", label_en: "Online",    label_ar: "متصل",      label_fr: "En ligne"   },
  { key: "available", color: "var(--azure)",   label_en: "Available", label_ar: "متاح",       label_fr: "Disponible" },
  { key: "busy",      color: "var(--gold)",    label_en: "Busy",      label_ar: "مشغول",      label_fr: "Occupé"     },
  { key: "away",      color: "#F59E0B",        label_en: "Away",      label_ar: "بعيد",       label_fr: "Absent"     },
  { key: "offline",   color: "var(--ink-4)",   label_en: "Offline",   label_ar: "غير متصل",   label_fr: "Hors ligne" },
];

/* ─── Logout icon ─────────────────────────────────────────────────── */
function IcLogout() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

/* ─── Sidebar ─────────────────────────────────────────────────────── */
export function Sidebar({ active, onNavigate, onLogout }: {
  active: string;
  onNavigate: (key: string) => void;
  onLogout?: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";

  const [collapsed, setCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [status, setStatus] = useState<UserStatus>("online");
  const [showStatus, setShowStatus] = useState(false);
  const [statusBounds, setStatusBounds] = useState<DOMRect | null>(null);
  const currentStatus = STATUSES.find(s => s.key === status)!;
  const statusLabel = lang === "ar" ? currentStatus.label_ar : lang === "fr" ? currentStatus.label_fr : currentStatus.label_en;

  /* Auto-open the group that contains the active child */
  useEffect(() => {
    for (const entry of NAV_ENTRIES) {
      if (entry.type === "group" && entry.children.some(c => c.key === active)) {
        setOpenGroup(entry.id);
        return;
      }
    }
  }, [active]);

  const navLabel = (key: NavKey): string => {
    const map: Record<NavKey, string> = {
      dash: t.nav_dash, prop: t.nav_prop, crm: t.nav_crm,
      clients: t.nav_clients, personne: t.nav_personne, societe: t.nav_societe,
      contract: t.nav_contract, rental: t.nav_rental, realestate: t.nav_realestate,
      admin: t.nav_admin, tourisme: t.nav_tourisme, sante: t.nav_sante,
      assurance: t.nav_assurance, banques: t.nav_banques, amazon: t.nav_amazon, consultants: t.nav_consultants,
      visa: t.nav_visa,
      erp: t.nav_erp, workspace: t.nav_workspace, audit: t.nav_audit,
      backoffice: t.nav_backoffice, hr: t.nav_hr, it: t.nav_it, finance: t.nav_finance,
      report: t.nav_report, parametres: t.nav_parametres,
    };
    return map[key];
  };

  function NavItemRow({ icon, navKey, badge, isActive, isChild = false }: {
    icon: React.ReactElement; navKey: NavKey; badge?: number; isActive: boolean; isChild?: boolean;
  }) {
    const col = collapsed && !isMob;
    return (
      <div
        onClick={() => { onNavigate(navKey); if (isMob) setMobileOpen(false); }}
        title={col ? navLabel(navKey) : undefined}
        style={{
          display: "flex", alignItems: "center", gap: col ? 0 : 11,
          padding: col ? "10px 0" : isChild ? "8px 10px 8px 32px" : "9px 10px",
          justifyContent: col ? "center" : undefined,
          borderRadius: "var(--r)", cursor: "pointer",
          background: isActive ? "var(--gold-ghost)" : "transparent",
          color: isActive ? "var(--gold-deep)" : "var(--ink-2)",
          position: "relative",
        }}
      >
        {isActive && (
          <div style={{ position: "absolute", insetInlineStart: 0, top: 6, bottom: 6, width: 2, background: "var(--gold)", borderRadius: 2 }} />
        )}
        <span style={{ width: 18, height: 18, display: "grid", placeItems: "center", color: isActive ? "var(--gold-deep)" : "var(--ink-3)", flexShrink: 0, position: "relative" }}>
          {icon}
          {col && badge && (
            <span style={{ position: "absolute", top: -3, insetInlineEnd: -3, width: 7, height: 7, borderRadius: 4, background: "var(--gold)" }} />
          )}
        </span>
        {!col && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: lang === "ar" ? 13.5 : 14, fontWeight: 500, lineHeight: 1.2 }}>
                {navLabel(navKey)}
              </div>
            </div>
            {badge && (
              <span className="tnum" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: "var(--gold)", color: "#1A1610", fontWeight: 600 }}>{badge}</span>
            )}
          </>
        )}
      </div>
    );
  }

  function GroupRow({ entry }: { entry: NavEntry & { type: "group" } }) {
    const col = collapsed && !isMob;
    const isGroupActive = entry.children.some(c => c.key === active) || active === entry.groupKey;
    const isOpen = openGroup === entry.id;

    return (
      <div>
        {/* Group header */}
        <div
          onClick={() => {
            onNavigate(entry.groupKey);
            setOpenGroup(p => p === entry.id ? null : entry.id);
            if (isMob) setMobileOpen(false);
          }}
          title={col ? navLabel(entry.groupKey) : undefined}
          style={{
            display: "flex", alignItems: "center", gap: col ? 0 : 11,
            padding: col ? "10px 0" : "9px 10px",
            justifyContent: col ? "center" : undefined,
            borderRadius: "var(--r)", cursor: "pointer",
            background: isGroupActive ? "var(--gold-ghost)" : "transparent",
            color: isGroupActive ? "var(--gold-deep)" : "var(--ink-2)",
            position: "relative",
          }}
        >
          {isGroupActive && (
            <div style={{ position: "absolute", insetInlineStart: 0, top: 6, bottom: 6, width: 2, background: "var(--gold)", borderRadius: 2 }} />
          )}
          <span style={{ width: 18, height: 18, display: "grid", placeItems: "center", color: isGroupActive ? "var(--gold-deep)" : "var(--ink-3)", flexShrink: 0 }}>
            {entry.icon}
          </span>
          {!col && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: lang === "ar" ? 13.5 : 14, fontWeight: 500, lineHeight: 1.2 }}>
                  {navLabel(entry.groupKey)}
                </div>
              </div>
              <span style={{ color: "var(--ink-4)", transition: "transform 0.2s", display: "block", transform: isOpen ? "rotate(180deg)" : "none" }}>
                <IcChevD />
              </span>
            </>
          )}
        </div>

        {/* Children */}
        {!col && isOpen && (
          <div style={{ borderInlineStart: "1px solid var(--line-soft)", marginInlineStart: 18, marginBottom: 2 }}>
            {entry.children.map(child => (
              <NavItemRow key={child.key} icon={child.icon} navKey={child.key} badge={child.badge} isActive={child.key === active} isChild />
            ))}
          </div>
        )}
      </div>
    );
  }

  function NavContent() {
    const col = collapsed && !isMob;
    return (
      <>
        <div style={{ padding: col ? "12px 6px" : "14px 10px", display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto" }}>
          {!col && <div className="eyebrow" style={{ padding: "8px 10px 6px" }}>{t.workspace}</div>}
          {NAV_ENTRIES.map(entry => {
            if (entry.type === "item") {
              return <NavItemRow key={entry.key} icon={entry.icon} navKey={entry.key} badge={entry.badge} isActive={entry.key === active} />;
            }
            return <GroupRow key={entry.id} entry={entry} />;
          })}
        </div>

        {/* User footer */}
        <div style={{ padding: col ? "12px 6px" : 12, borderTop: "1px solid var(--line-soft)", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, justifyContent: col ? "center" : undefined }}>
            <div
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setStatusBounds(r); setShowStatus(p => !p); }}
              title={statusLabel}
              style={{ position: "relative", flexShrink: 0, cursor: "pointer" }}
            >
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--ink)", color: "var(--gold)", display: "grid", placeItems: "center", fontFamily: "'Cormorant Garamond', serif", fontSize: 15, fontWeight: 600 }}>HS</div>
              <span style={{ position: "absolute", bottom: 1, insetInlineEnd: 1, width: 9, height: 9, borderRadius: "50%", background: currentStatus.color, border: "2px solid var(--bg-paper)", display: "block" }} />
            </div>
            {!col && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>Hicham Sadiki</div>
                  <button
                    onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setStatusBounds(r); setShowStatus(p => !p); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 10.5, color: currentStatus.color, letterSpacing: "0.04em", marginTop: 2 }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: currentStatus.color, display: "inline-block", flexShrink: 0 }} />
                    {statusLabel}
                  </button>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title={t.logout}
                    style={{
                      width: 28, height: 28, borderRadius: "var(--r-sm)",
                      display: "grid", placeItems: "center",
                      background: "transparent", border: "1px solid var(--line)",
                      color: "var(--ink-4)", cursor: "pointer", flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = "var(--rose-soft)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--rose)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--rose)";
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--line)";
                      (e.currentTarget as HTMLButtonElement).style.color = "var(--ink-4)";
                    }}
                  >
                    <IcLogout />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  /* ── Desktop / Tablet sidebar ── */
  if (!isMob) {
    return (
      <>
        <aside style={{
          width: collapsed ? 62 : 232, flexShrink: 0,
          background: "var(--bg-paper)",
          borderInlineEnd: "1px solid var(--line-soft)",
          display: "flex", flexDirection: "column", height: "100%",
          transition: "width 0.22s ease",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "16px 12px",
            borderBottom: "1px solid var(--line-soft)",
            display: "flex", alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between", gap: 8,
            minHeight: 66, flexShrink: 0,
          }}>
            {collapsed ? <LogoMark size={32} /> : <Wordmark />}
            <button
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? "Expand" : "Collapse"}
              style={{
                flexShrink: 0, width: 26, height: 26, borderRadius: "var(--r-sm)",
                display: "grid", placeItems: "center",
                background: "transparent", border: "1px solid var(--line-soft)",
                color: "var(--ink-4)", cursor: "pointer", transition: "all 0.15s",
              }}
            >
              {collapsed ? <IcChevR /> : <IcChevL />}
            </button>
          </div>
          <NavContent />
        </aside>

        {/* Status picker */}
        {showStatus && statusBounds && (
          <>
            <div onClick={() => setShowStatus(false)} style={{ position: "fixed", inset: 0, zIndex: 999 }} />
            <div style={{
              position: "fixed",
              bottom: window.innerHeight - statusBounds.top + 6,
              left: lang !== "ar" ? statusBounds.left : undefined,
              right: lang === "ar" ? (window.innerWidth - statusBounds.right) : undefined,
              width: 200, zIndex: 1000,
              background: "var(--bg-paper)",
              border: "1px solid var(--line-soft)",
              borderRadius: "var(--r)",
              boxShadow: "var(--shadow-2)",
              overflow: "hidden",
            }}>
              <div style={{ padding: "8px 14px 6px", borderBottom: "1px solid var(--line-soft)", fontSize: 10, color: "var(--ink-4)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                {lang === "ar" ? "الحالة" : lang === "fr" ? "Statut" : "Status"}
              </div>
              {STATUSES.map(s => (
                <button key={s.key} onClick={() => { setStatus(s.key); setShowStatus(false); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px", background: status === s.key ? "var(--gold-ghost)" : "transparent", border: "none", cursor: "pointer", fontSize: 12.5, color: status === s.key ? "var(--gold-deep)" : "var(--ink-2)", textAlign: "start" }}
                >
                  <span style={{ width: 10, height: 10, borderRadius: 5, background: s.color, flexShrink: 0, display: "inline-block" }} />
                  <span style={{ flex: 1 }}>{lang === "ar" ? s.label_ar : lang === "fr" ? s.label_fr : s.label_en}</span>
                  {status === s.key && <IcCheck />}
                </button>
              ))}
            </div>
          </>
        )}
      </>
    );
  }

  /* ── Mobile: hamburger + bottom sheet ── */
  return (
    <>
      {/* Hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        style={{
          position: "fixed", top: 14, insetInlineStart: 14, zIndex: 600,
          width: 38, height: 38, borderRadius: "var(--r)",
          display: "grid", placeItems: "center",
          background: "var(--bg-paper)", border: "1px solid var(--line-soft)",
          color: "var(--ink-2)", cursor: "pointer", boxShadow: "var(--shadow-1)",
        }}
      >
        <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Overlay + bottom sheet */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 700, backdropFilter: "blur(2px)" }}
          />
          <div style={{
            position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, zIndex: 800,
            background: "var(--bg-paper)",
            borderRadius: "14px 14px 0 0",
            maxHeight: "85vh", display: "flex", flexDirection: "column",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
            animation: "slideUp 0.22s ease",
          }}>
            {/* Sheet handle + header */}
            <div style={{ padding: "10px 16px 12px", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Wordmark />
              <button
                onClick={() => setMobileOpen(false)}
                style={{ width: 30, height: 30, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "transparent", border: "1px solid var(--line-soft)", color: "var(--ink-4)", cursor: "pointer" }}
              >
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", flex: 1 }}>
              <NavContent />
            </div>
          </div>
        </>
      )}
    </>
  );
}

/* ─── Topbar ──────────────────────────────────────────────────────── */
export function Topbar({ title, crumb = [], children }: {
  title: string; crumb?: string[]; children?: React.ReactNode;
}) {
  const { theme, toggle } = useTheme();
  const { lang, setLang } = useLang();
  const t = useT();
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  return (
    <header style={{
      height: 64, flexShrink: 0,
      paddingInlineStart: isMob ? 62 : 28, paddingInlineEnd: isMob ? 12 : 28,
      background: "var(--bg-cream)", borderBottom: "1px solid var(--line-soft)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, minWidth: 0, flexWrap: "nowrap" }}>
        <div className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: lang === "ar" ? 19 : 22, fontWeight: lang === "ar" ? 600 : 400, color: "var(--ink)", whiteSpace: "nowrap" }}>
          {title}
        </div>
        {crumb.map((c, i) => (
          <React.Fragment key={i}>
            <span style={{ color: "var(--ink-5)" }}>/</span>
            <span style={{ fontSize: 11, color: "var(--ink-4)", whiteSpace: "nowrap" }}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {children}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: "var(--r)", background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", color: "var(--ink-3)", fontSize: 12 }}>
          <IcSearch /><span style={{ color: "var(--ink-4)" }}>{t.search}</span>
          <span style={{ fontSize: 10, padding: "1px 5px", border: "1px solid var(--line)", borderRadius: 3, color: "var(--ink-4)" }}>⌘K</span>
        </div>
        <button style={{ position: "relative", height: 36, width: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", color: "var(--ink-2)", borderRadius: "var(--r)", cursor: "pointer" }}>
          <IcBell />
          <span style={{ position: "absolute", top: 8, insetInlineEnd: 8, width: 6, height: 6, borderRadius: 3, background: "var(--gold)" }} />
        </button>
        <button onClick={toggle} title={theme === "dark" ? "Light mode" : "Dark mode"} style={{ height: 36, width: 36, display: "inline-flex", alignItems: "center", justifyContent: "center", background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", color: "var(--ink-2)", borderRadius: "var(--r)", cursor: "pointer" }}>
          {theme === "dark" ? <IcSun /> : <IcMoon />}
        </button>
        <div style={{ display: "flex", gap: 2, background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: 3 }}>
          {(["ar", "en", "fr"] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: "3px 9px", borderRadius: "var(--r-sm)",
              fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em",
              border: "none", cursor: "pointer",
              background: lang === l ? "var(--gold)" : "transparent",
              color: lang === l ? "#1A1610" : "var(--ink-4)",
            }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}

/* ─── Atoms ───────────────────────────────────────────────────────── */
export function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div className="eyebrow" style={style}>{children}</div>;
}

export type Tone = "gold" | "emerald" | "rose" | "azure";

export function Chip({ tone, children }: { tone?: Tone; children: React.ReactNode }) {
  return <span className={`sgi-chip${tone ? ` sgi-chip-${tone}` : ""}`}>{children}</span>;
}

export function StatusDot({ tone = "gold" }: { tone?: string }) {
  return <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: 3, background: `var(--${tone})`, flexShrink: 0 }} />;
}

/* ─── Property image ──────────────────────────────────────────────── */
const PALETTES = [
  ["#C9B98C","#8A6B30"], ["#9DB6C8","#4A6B82"], ["#D9BB7D","#A8865A"],
  ["#B8AC92","#6B5F4D"], ["#94B391","#4F6B4E"], ["#C5A574","#6B4F2E"],
];

export function PropertyImage({ variant = 1 }: { variant?: number }) {
  const [a, b] = PALETTES[(variant - 1) % PALETTES.length];
  return (
    <div style={{ width: "100%", height: "100%", background: `linear-gradient(135deg,${a} 0%,${b} 100%)`, position: "relative" }}>
      <svg viewBox="0 0 140 110" preserveAspectRatio="none" width="100%" height="100%" style={{ position: "absolute", inset: 0, mixBlendMode: "soft-light" }}>
        <path d="M0 80 L20 70 L40 75 L60 60 L80 65 L100 55 L120 60 L140 50 L140 110 L0 110 Z" fill="rgba(0,0,0,0.25)" />
        <path d="M0 90 L25 82 L50 86 L75 75 L100 80 L125 72 L140 78 L140 110 L0 110 Z" fill="rgba(0,0,0,0.35)" />
        <g fill="rgba(0,0,0,0.2)">
          <rect x="20" y="40" width="14" height="50"/><rect x="36" y="30" width="10" height="60"/>
          <rect x="48" y="44" width="12" height="46"/><rect x="82" y="32" width="14" height="58"/>
          <rect x="98" y="38" width="10" height="52"/>
        </g>
      </svg>
    </div>
  );
}

export function fmtAED(n: number) { return "AED " + n.toLocaleString("en-AE"); }
