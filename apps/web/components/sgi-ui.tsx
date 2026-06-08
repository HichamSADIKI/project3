"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTheme } from "@/components/theme-provider";
import { useLang, useT } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
import { useBreakpoint } from "@/lib/hooks";
import { useNavGate, useCurrentUser } from "@/lib/permissions";
import { useNotifications } from "@/lib/use-notifications";
import { useFavorites } from "@/hooks/use-favorites";

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
export const IcCalendar  = () => <Ic><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></Ic>;
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
export const IcOrders    = () => <Ic><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></Ic>;
export const IcAudit     = () => <Ic><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></Ic>;
export const IcTravail   = () => <Ic><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="12"/><path d="M12 12h.01M2 12h20"/></Ic>;
export const IcMarketing = () => <Ic><path d="M22 12h-4l-3 9L9 3l-3 9H2"/><circle cx="19" cy="5" r="2"/><path d="M19 3v4M17 5h4"/></Ic>;
export const IcGlobe     = () => <Ic><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></Ic>;
export const IcNews      = () => <Ic><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8V6Z"/></Ic>;
export const IcCallCenter= () => <Ic><path d="M4 12a8 8 0 0 1 16 0"/><path d="M22 13v3a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2zM2 13v3a2 2 0 0 0 2 2h1v-7H4a2 2 0 0 0-2 2z"/><path d="M19 18v1a3 3 0 0 1-3 3h-3"/></Ic>;
export const IcAI        = () => <Ic><path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 16l-1.6-5L6 9.4l4.4-1.6z"/><path d="M19 14l.7 2.1L22 17l-2.3.9L19 20l-.7-2.1L16 17l2.3-.9z"/></Ic>;
export const IcHamburger = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
    <path d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);
export const IcClose = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12"/>
  </svg>
);

/* ─── Logo ────────────────────────────────────────────────────────── */
export function LogoMark({ size = 36 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <div style={{
      width: size, height: size,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <img
        src="/logo-hp-holding.png"
        alt="HP Holding"
        style={{
          height: size,
          width: size,
          objectFit: "contain",
        }}
      />
    </div>
  );
}

export function Wordmark({ subtitle = true }: { subtitle?: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src="/logo-hp-holding.png"
      alt="HP Holding"
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
  | "dash" | "crm" | "orders"
  | "clients" | "personne" | "societe" | "clients_ai"
  | "realestate" | "realestate_process" | "realestate_achat" | "realestate_vente" | "realestate_location" | "realestate_marketing" | "realestate_website" | "realestate_buildings" | "realestate_properties_map" | "realestate_units" | "realestate_tenants" | "realestate_owners" | "realestate_owner_portal" | "realestate_developers" | "realestate_golden_visa" | "realestate_contracts" | "realestate_payments" | "realestate_cheques" | "realestate_maintenance" | "realestate_inspections" | "realestate_agenda" | "realestate_comms" | "realestate_inbox" | "realestate_tickets" | "realestate_workflows" | "realestate_branches" | "realestate_settings" | "realestate_documents"
  | "tourisme" | "tourisme_crm" | "tourisme_news"
  | "sante" | "sante_crm" | "sante_news"
  | "assurance" | "assurance_crm" | "assurance_news"
  | "banques" | "banques_crm" | "banques_news"
  | "amazon" | "amazon_crm" | "amazon_news"
  | "consultants" | "consultants_crm" | "consultants_news"
  | "admin" | "admin_crm" | "admin_news"
  | "travail" | "travail_crm" | "travail_news"
  | "callcenter" | "callcenter_crm" | "callcenter_news"
  | "erp" | "workspace" | "audit"
  | "appadmin" | "appadmin_users" | "appadmin_audit" | "appadmin_alerts" | "appadmin_infra" | "appadmin_backups" | "appadmin_honeytokens" | "appadmin_self_defense"
  | "backoffice" | "hr" | "it" | "finance" | "accounting" | "bank_recon" | "marketing"
  | "fournisseurs" | "fournisseurs_fiches" | "fournisseurs_validation" | "fournisseurs_ai"
  | "report" | "parametres";

export type NavItem  = { key: NavKey; icon: React.ReactElement; badge?: number; labelKey?: NavKey; section?: string };
export type NavEntry =
  | ({ type: "item"  } & NavItem)
  | { type: "group"; id: string; groupKey: NavKey; icon: React.ReactElement; badge?: number; children: NavItem[] }
  | { type: "spacer"; id: string };

export const NAV_ENTRIES: NavEntry[] = [
  { type: "item",  key: "dash",        icon: <IcDash /> },
  { type: "group", id: "fournisseurs", groupKey: "fournisseurs", icon: <IcDoc />,
    children: [
      { key: "fournisseurs_fiches",     icon: <IcDoc /> },
      { key: "fournisseurs_validation", icon: <IcClients /> },
      { key: "fournisseurs_ai",         icon: <IcAI /> },
    ],
  },
  { type: "group", id: "clients",      groupKey: "clients", icon: <IcClients />,
    children: [
      { key: "personne", icon: <IcPersonne /> },
      { key: "societe",  icon: <IcSociete /> },
      { key: "clients_ai", icon: <IcAI /> },
    ],
  },
  { type: "group", id: "realestate",   groupKey: "realestate", icon: <IcProp />,
    children: [
      // 🎯 COMMERCIAL — entonnoir + transactions + publication web (usage quotidien)
      { key: "crm", icon: <IcCRM />, badge: 12, section: "commercial" },
      { key: "realestate_marketing", icon: <IcMarketing />, section: "commercial" },
      { key: "realestate_process", icon: <IcTrend />, section: "commercial" },
      { key: "realestate_achat", icon: <IcFinance />, section: "commercial" },
      { key: "realestate_vente", icon: <IcContract />, section: "commercial" },
      { key: "realestate_location", icon: <IcProp />, section: "commercial" },
      { key: "realestate_website", icon: <IcGlobe />, section: "commercial" },
      { key: "realestate_contracts", icon: <IcContract />, section: "commercial" },
      // 🏢 PATRIMOINE — le stock géré
      { key: "realestate_buildings", icon: <IcProp />, section: "patrimoine" },
      { key: "realestate_properties_map", icon: <IcPin />, section: "patrimoine" },
      { key: "realestate_units", icon: <IcGrid />, section: "patrimoine" },
      { key: "realestate_branches", icon: <IcPin />, section: "patrimoine" },
      // 👥 TIERS — toutes les parties prenantes
      { key: "realestate_owners", icon: <IcClients />, section: "tiers" },
      { key: "realestate_tenants", icon: <IcPersonne />, section: "tiers" },
      { key: "realestate_developers", icon: <IcWorkspace />, section: "tiers" },
      { key: "realestate_owner_portal", icon: <IcWorkspace />, section: "tiers" },
      { key: "realestate_golden_visa", icon: <IcVisa />, section: "tiers" },
      // 💰 FINANCE — encaissements
      { key: "realestate_payments", icon: <IcFinance />, section: "finance" },
      { key: "realestate_cheques", icon: <IcReport />, section: "finance" },
      // 🛠️ SUPPORT & ADMIN — exploitation, relation client, config
      { key: "realestate_maintenance", icon: <IcClock />, section: "support" },
      { key: "realestate_inspections", icon: <IcAudit />, section: "support" },
      { key: "realestate_agenda", icon: <IcClock />, section: "support" },
      { key: "realestate_comms", icon: <IcChat />, section: "support" },
      { key: "realestate_inbox", icon: <IcMail />, section: "support" },
      { key: "realestate_tickets", icon: <IcReport />, section: "support" },
      { key: "realestate_workflows", icon: <IcAudit />, section: "support" },
      { key: "realestate_documents", icon: <IcDoc />, section: "support" },
      { key: "realestate_settings", icon: <IcSettings />, section: "support" },
    ],
  },
  { type: "group", id: "tourisme",    groupKey: "tourisme",    icon: <IcTourisme />,
    children: [
      { key: "tourisme",      icon: <IcTourisme />, labelKey: "dash" },
      { key: "tourisme_crm",  icon: <IcCRM /> },
      { key: "tourisme_news", icon: <IcNews /> },
    ],
  },
  { type: "group", id: "sante",       groupKey: "sante",       icon: <IcSante />,
    children: [
      { key: "sante",      icon: <IcSante />, labelKey: "dash" },
      { key: "sante_crm",  icon: <IcCRM /> },
      { key: "sante_news", icon: <IcNews /> },
    ],
  },
  { type: "group", id: "assurance",   groupKey: "assurance",   icon: <IcAssurance />,
    children: [
      { key: "assurance",      icon: <IcAssurance />, labelKey: "dash" },
      { key: "assurance_crm",  icon: <IcCRM /> },
      { key: "assurance_news", icon: <IcNews /> },
    ],
  },
  { type: "group", id: "banques",     groupKey: "banques",     icon: <IcBanques />,
    children: [
      { key: "banques",      icon: <IcBanques />, labelKey: "dash" },
      { key: "banques_crm",  icon: <IcCRM /> },
      { key: "banques_news", icon: <IcNews /> },
    ],
  },
  { type: "group", id: "amazon",      groupKey: "amazon",      icon: <IcAmazon />,
    children: [
      { key: "amazon",      icon: <IcAmazon />, labelKey: "dash" },
      { key: "amazon_crm",  icon: <IcCRM /> },
      { key: "amazon_news", icon: <IcNews /> },
    ],
  },
  { type: "group", id: "consultants", groupKey: "consultants", icon: <IcConsult />,
    children: [
      { key: "consultants",      icon: <IcConsult />, labelKey: "dash" },
      { key: "consultants_crm",  icon: <IcCRM /> },
      { key: "consultants_news", icon: <IcNews /> },
    ],
  },
  { type: "group", id: "admin",       groupKey: "admin",       icon: <IcAdmin />,
    children: [
      { key: "admin",      icon: <IcAdmin />, labelKey: "dash" },
      { key: "admin_crm",  icon: <IcCRM /> },
      { key: "admin_news", icon: <IcNews /> },
    ],
  },
  { type: "group", id: "travail",     groupKey: "travail",     icon: <IcTravail />,
    children: [
      { key: "travail",      icon: <IcTravail />, labelKey: "dash" },
      { key: "travail_crm",  icon: <IcCRM /> },
      { key: "travail_news", icon: <IcNews /> },
    ],
  },
  { type: "group", id: "callcenter",  groupKey: "callcenter",  icon: <IcCallCenter />,
    children: [
      { key: "callcenter",      icon: <IcCallCenter />, labelKey: "dash" },
      { key: "callcenter_crm",  icon: <IcCRM /> },
      { key: "callcenter_news", icon: <IcNews /> },
    ],
  },
  { type: "group", id: "backoffice",   groupKey: "backoffice", icon: <IcBackOffice />,
    children: [
      { key: "erp",       icon: <IcERP /> },
      { key: "workspace", icon: <IcWorkspace /> },
      { key: "audit",     icon: <IcAudit /> },
      { key: "hr",        icon: <IcHR /> },
      { key: "it",        icon: <IcIT /> },
      { key: "finance",   icon: <IcFinance /> },
      { key: "accounting", icon: <IcReport /> },
      { key: "bank_recon", icon: <IcFinance /> },
      { key: "marketing", icon: <IcMarketing /> },
    ],
  },
  { type: "group", id: "appadmin",     groupKey: "appadmin", icon: <IcAdmin />,
    children: [
      { key: "appadmin_users",   icon: <IcClients /> },
      { key: "appadmin_audit",   icon: <IcAudit /> },
      { key: "appadmin_alerts",  icon: <IcClock /> },
      { key: "appadmin_infra",   icon: <IcIT /> },
      { key: "appadmin_backups", icon: <IcReport /> },
      { key: "appadmin_honeytokens", icon: <IcLock /> },
      { key: "appadmin_self_defense", icon: <IcAssurance /> },
    ],
  },
  { type: "item",  key: "report",      icon: <IcReport /> },
  { type: "spacer", id: "spacer-settings" },
  { type: "item",  key: "parametres",  icon: <IcSettings /> },
];

/* ─── Libellés de nav (purs, réutilisés par la Sidebar ET le hub) ────── */
export function navLabelFor(t: Translations, key: NavKey): string {
  const map: Record<NavKey, string> = {
    dash: t.nav_dash, crm: t.nav_crm, orders: t.nav_orders,
    clients: t.nav_clients, personne: t.nav_personne, societe: t.nav_societe, clients_ai: t.nav_clients_ai,
    realestate: t.nav_realestate, realestate_process: t.nav_re_process,
    realestate_achat: t.nav_achat, realestate_vente: t.nav_vente, realestate_location: t.nav_location, realestate_marketing: t.nav_re_marketing, realestate_website: t.nav_re_website,
    realestate_buildings: t.nav_buildings, realestate_properties_map: t.nav_properties_map, realestate_units: t.nav_units, realestate_tenants: t.nav_tenants, realestate_owners: t.nav_owners, realestate_owner_portal: t.nav_owner_portal, realestate_developers: t.nav_developers, realestate_golden_visa: t.nav_golden_visa, realestate_contracts: t.nav_contracts_re, realestate_payments: t.nav_payments, realestate_cheques: t.nav_cheques, realestate_maintenance: t.nav_maintenance_re, realestate_inspections: t.nav_inspections, realestate_agenda: t.nav_agenda, realestate_comms: t.nav_comms, realestate_inbox: t.nav_inbox, realestate_tickets: t.nav_tickets, realestate_workflows: t.nav_workflows,
    realestate_branches: t.nav_branches, realestate_documents: t.nav_documents, realestate_settings: t.nav_re_settings,
    appadmin: t.nav_appadmin, appadmin_users: t.nav_appadmin_users, appadmin_audit: t.nav_appadmin_audit, appadmin_alerts: t.nav_appadmin_alerts, appadmin_infra: t.nav_appadmin_infra, appadmin_backups: t.nav_appadmin_backups, appadmin_honeytokens: t.nav_appadmin_honeytokens, appadmin_self_defense: t.nav_appadmin_self_defense,
    admin: t.nav_admin, tourisme: t.nav_tourisme, sante: t.nav_sante,
    assurance: t.nav_assurance, banques: t.nav_banques, amazon: t.nav_amazon, consultants: t.nav_consultants,
    travail: t.nav_travail, callcenter: t.nav_callcenter,
    tourisme_crm: t.nav_crm,  sante_crm: t.nav_crm,
    assurance_crm: t.nav_crm,  banques_crm: t.nav_crm,   amazon_crm: t.nav_crm,
    consultants_crm: t.nav_crm, admin_crm: t.nav_crm,   travail_crm: t.nav_crm,
    callcenter_crm: t.nav_crm,
    tourisme_news: t.nav_news, sante_news: t.nav_news,
    assurance_news: t.nav_news,  banques_news: t.nav_news,  amazon_news: t.nav_news,
    consultants_news: t.nav_news, admin_news: t.nav_news,  travail_news: t.nav_news,
    callcenter_news: t.nav_news,
    erp: t.nav_erp, workspace: t.nav_workspace, audit: t.nav_audit,
    backoffice: t.nav_backoffice, hr: t.nav_hr, it: t.nav_it, finance: t.nav_finance, accounting: t.nav_accounting, bank_recon: t.nav_bank, marketing: t.nav_marketing,
    fournisseurs: t.nav_fournisseurs,
    fournisseurs_fiches: t.nav_fournisseurs_fiches,
    fournisseurs_validation: t.nav_fournisseurs_validation,
    fournisseurs_ai: t.nav_fournisseurs_ai,
    report: t.nav_report, parametres: t.nav_parametres,
  };
  return map[key];
}

export function navSectionLabelFor(t: Translations, section: string): string {
  const map: Record<string, string> = {
    commercial: t.nav_re_sec_commercial,
    patrimoine: t.nav_re_sec_patrimoine,
    tiers: t.nav_re_sec_tiers,
    finance: t.nav_re_sec_finance,
    support: t.nav_re_sec_support,
  };
  return map[section] ?? section;
}

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

/* ─── Focus ring shared style ─────────────────────────────────────── */
const focusRingStyle: React.CSSProperties = {
  outline: "none",
};

function useFocusRing() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    style: focused
      ? { outline: "none", boxShadow: "0 0 0 3px rgba(184,146,79,0.28)" }
      : focusRingStyle,
  };
}

/* ─── Sidebar ─────────────────────────────────────────────────────── */
export function Sidebar({ active, onNavigate, onLogout, navMode = "classic", scope = null, onHome, onToggleMode }: {
  active: string;
  onNavigate: (key: string) => void;
  onLogout?: () => void;
  /** "hub" = sidebar limitée à la rubrique active (fonctions) + retour Accueil. */
  navMode?: "hub" | "classic";
  /** id de la rubrique à afficher seule en mode hub (null = item simple). */
  scope?: string | null;
  onHome?: () => void;
  onToggleMode?: () => void;
}) {
  const t = useT();
  const { lang } = useLang();
  const bp = useBreakpoint();
  const navGate = useNavGate();
  const { fullName } = useCurrentUser();
  // Favoris (raccourcis de nav, localStorage) — affichés en tête de sidebar,
  // + étoile sur chaque item pour ajouter/retirer depuis n'importe quelle page.
  const { favorites, hydrated: favHydrated, isFavorite, toggle: toggleFav } = useFavorites();
  // Identité affichée au footer : nom de session, repli neutre avant hydratation.
  const displayName = fullName ?? "—";
  const initials = (fullName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "•";
  const isMob = bp === "mobile";
  const isTab = bp === "tablet";

  // On tablet, default to collapsed
  const [collapsed, setCollapsed] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  // Pôles repliables à l'intérieur d'un groupe (ex. Immobilier) — accordéon
  // EXCLUSIF : ouvrir un pôle referme les autres (un seul ouvert à la fois).
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set());
  const toggleSection = (sec: string) =>
    setOpenSections(prev => (prev.has(sec) ? new Set() : new Set([sec])));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [status, setStatus] = useState<UserStatus>("online");
  const [showStatus, setShowStatus] = useState(false);
  const [statusBounds, setStatusBounds] = useState<DOMRect | null>(null);
  const currentStatus = STATUSES.find(s => s.key === status)!;
  const statusLabel = lang === "ar" ? currentStatus.label_ar : lang === "fr" ? currentStatus.label_fr : currentStatus.label_en;

  // Auto-collapse on tablet
  useEffect(() => {
    if (isTab) setCollapsed(true);
    else if (bp === "desktop") setCollapsed(false);
  }, [isTab, bp]);

  /* Auto-open the group — and its section — that contains the active child */
  useEffect(() => {
    for (const entry of NAV_ENTRIES) {
      if (entry.type !== "group") continue;
      const child = entry.children.find(c => c.key === active);
      if (!child) continue;
      setOpenGroup(entry.id);
      // Accordéon exclusif : seul le pôle de l'écran actif est ouvert.
      if (child.section) setOpenSections(new Set([child.section]));
      return;
    }
  }, [active]);

  const navLabel = (key: NavKey): string => navLabelFor(t, key);

  // Libellé d'un sous-thème (sous-titre interne à la rubrique Immobilier).
  const navSectionLabel = (section: string): string => navSectionLabelFor(t, section);

  // Icône par pôle (5 pôles Immobilier) — repère visuel fort et lisible.
  const navSectionIcon = (section: string): React.ReactElement => {
    const map: Record<string, React.ReactElement> = {
      commercial: <IcTrend />,
      patrimoine: <IcProp />,
      tiers: <IcClients />,
      finance: <IcFinance />,
      support: <IcSettings />,
    };
    return map[section] ?? <IcGrid />;
  };

  const handleNavigate = useCallback((key: string) => {
    onNavigate(key);
    if (isMob) setMobileOpen(false);
  }, [onNavigate, isMob]);

  function NavItemRow({ icon, navKey, badge, isActive, isChild = false, labelOverride }: {
    icon: React.ReactElement; navKey: NavKey; badge?: number; isActive: boolean; isChild?: boolean; labelOverride?: string;
  }) {
    const col = collapsed && !isMob;
    const label = labelOverride ?? navLabel(navKey);
    const displayBadge = badge !== undefined ? (badge > 9 ? "9+" : badge) : undefined;
    const [hovered, setHovered] = useState(false);
    const isFav = isFavorite(navKey);

    return (
      <div
        role="button"
        tabIndex={0}
        data-testid={`nav-${navKey}`}
        onClick={() => handleNavigate(navKey)}
        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleNavigate(navKey); }}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        title={col ? label : undefined}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex", alignItems: "center", gap: col ? 0 : 11,
          padding: col ? "10px 0" : isChild ? "8px 10px 8px 32px" : "9px 10px",
          justifyContent: col ? "center" : undefined,
          borderRadius: "var(--r)", cursor: "pointer",
          background: isActive ? "var(--gold-ghost)" : hovered ? "var(--gold-ghost)" : "transparent",
          color: isActive ? "var(--gold-deep)" : hovered ? "var(--gold-deep)" : "var(--ink-2)",
          position: "relative",
          transition: "background 0.15s ease, color 0.15s ease",
          overflowX: "hidden",
        }}
      >
        {/* Active indicator bar */}
        {isActive && (
          <div style={{
            position: "absolute",
            insetInlineStart: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 3,
            height: "70%",
            background: "var(--gold)",
            borderRadius: 2,
          }} />
        )}
        <span style={{
          width: 18, height: 18, display: "grid", placeItems: "center",
          color: isActive ? "var(--gold-deep)" : hovered ? "var(--gold-deep)" : "var(--gold)",
          flexShrink: 0, position: "relative",
          transition: "color 0.15s ease",
        }}>
          {icon}
          {col && badge && (
            <span style={{ position: "absolute", top: -3, insetInlineEnd: -3, width: 7, height: 7, borderRadius: 4, background: "var(--gold)" }} />
          )}
        </span>
        {!col && (
          <>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: lang === "ar" ? 13.5 : 14, fontWeight: 500, lineHeight: 1.2 }}>
                {label}
              </div>
            </div>
            {displayBadge !== undefined && (
              <span className="tnum" style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: "var(--gold)", color: "#1A1610", fontWeight: 700, minWidth: 20, textAlign: "center" }}>
                {displayBadge}
              </span>
            )}
            {/* Étoile favori — ajoute/retire cette page des favoris (sans naviguer). */}
            <span
              role="button"
              tabIndex={0}
              data-testid={`fav-toggle-${navKey}`}
              aria-label={isFav
                ? (lang === "ar" ? "إزالة من المفضلة" : lang === "fr" ? "Retirer des favoris" : "Remove from favorites")
                : (lang === "ar" ? "أضف إلى المفضلة" : lang === "fr" ? "Ajouter aux favoris" : "Add to favorites")}
              title={isFav
                ? (lang === "ar" ? "إزالة من المفضلة" : lang === "fr" ? "Retirer des favoris" : "Remove from favorites")
                : (lang === "ar" ? "أضف إلى المفضلة" : lang === "fr" ? "Ajouter aux favoris" : "Add to favorites")}
              onClick={(e) => { e.stopPropagation(); toggleFav(navKey); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); toggleFav(navKey); } }}
              style={{
                display: "grid", placeItems: "center", width: 22, height: 22, flexShrink: 0,
                borderRadius: 999, cursor: "pointer",
                color: isFav ? "var(--gold-deep)" : "var(--ink-4)",
                opacity: isFav || hovered ? 1 : 0, transition: "opacity 0.15s ease",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={isFav ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
              </svg>
            </span>
          </>
        )}
      </div>
    );
  }

  function GroupRow({ entry }: { entry: NavEntry & { type: "group" } }) {
    const col = collapsed && !isMob;
    const isGroupActive = entry.children.some(c => c.key === active) || active === entry.groupKey;
    const isOpen = openGroup === entry.id;
    const [hovered, setHovered] = useState(false);
    const label = navLabel(entry.groupKey);

    return (
      <div>
        {/* Group header */}
        <div
          role="button"
          tabIndex={0}
          data-testid={`navgroup-${entry.groupKey}`}
          onClick={() => {
            onNavigate(entry.groupKey);
            setOpenGroup(p => p === entry.id ? null : entry.id);
            if (isMob) setMobileOpen(false);
          }}
          onKeyDown={e => {
            if (e.key === "Enter" || e.key === " ") {
              onNavigate(entry.groupKey);
              setOpenGroup(p => p === entry.id ? null : entry.id);
              if (isMob) setMobileOpen(false);
            }
          }}
          aria-label={label}
          aria-expanded={isOpen}
          title={col ? label : undefined}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: "flex", alignItems: "center", gap: col ? 0 : 11,
            padding: col ? "10px 0" : "9px 10px",
            justifyContent: col ? "center" : undefined,
            borderRadius: "var(--r)", cursor: "pointer",
            background: isGroupActive ? "var(--gold-ghost)" : hovered ? "var(--gold-ghost)" : "transparent",
            color: isGroupActive ? "var(--gold-deep)" : hovered ? "var(--gold-deep)" : "var(--ink-2)",
            position: "relative",
            transition: "background 0.15s ease, color 0.15s ease",
            overflowX: "hidden",
          }}
        >
          {/* Active indicator bar */}
          {isGroupActive && (
            <div style={{
              position: "absolute",
              insetInlineStart: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: 3,
              height: "70%",
              background: "var(--gold)",
              borderRadius: 2,
            }} />
          )}
          <span style={{
            width: 18, height: 18, display: "grid", placeItems: "center",
            color: isGroupActive ? "var(--gold-deep)" : hovered ? "var(--gold-deep)" : "var(--gold)",
            flexShrink: 0,
            transition: "color 0.15s ease",
          }}>
            {entry.icon}
          </span>
          {!col && (
            <>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: lang === "ar" ? 13.5 : 14, fontWeight: 500, lineHeight: 1.2 }}>
                  {label}
                </div>
              </div>
              <span style={{ color: "var(--ink-4)", transition: "transform 0.22s ease", display: "block", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                <IcChevD />
              </span>
            </>
          )}
        </div>

        {/* Children — smooth max-height animation */}
        {!col && (() => {
          // Regroupe les enfants consécutifs par rubrique (section). Un groupe sans
          // section (Clients, Fournisseurs…) → un seul bloc, rendu à plat.
          const blocks: { section: string | null; items: NavItem[] }[] = [];
          for (const child of entry.children) {
            const sec = child.section ?? null;
            const last = blocks[blocks.length - 1];
            if (last && last.section === sec) last.items.push(child);
            else blocks.push({ section: sec, items: [child] });
          }
          // Hauteur du groupe ouvert : pire cas, toutes les rubriques dépliées.
          const outerMax = entry.children.length * 40 + blocks.length * 40 + 12;
          return (
            <div style={{
              overflow: "hidden",
              maxHeight: isOpen ? outerMax : 0,
              transition: "max-height 0.25s ease",
            }}>
              <div style={{ borderInlineStart: "1px solid var(--line-soft)", marginInlineStart: 18, marginBottom: 2, paddingTop: 2 }}>
                {blocks.map((block, i) => {
                  // Bloc sans rubrique : items à plat (comportement des autres groupes).
                  if (!block.section) {
                    return block.items.map(child => (
                      <NavItemRow key={child.key} icon={child.icon} navKey={child.key} badge={child.badge} isActive={child.key === active} isChild labelOverride={child.labelKey ? navLabel(child.labelKey) : undefined} />
                    ));
                  }
                  const isFirst = i === 0;
                  const secOpen = openSections.has(block.section);
                  const sectionLabel = navSectionLabel(block.section);
                  return (
                    <div key={`sec-${block.section}`}>
                      {/* En-tête de rubrique cliquable (repliable) */}
                      <div
                        role="button"
                        tabIndex={0}
                        data-testid={`navsection-${block.section}`}
                        aria-expanded={secOpen}
                        aria-label={sectionLabel}
                        onClick={() => toggleSection(block.section!)}
                        onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleSection(block.section!); } }}
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                          gap: 9,
                          cursor: "pointer",
                          padding: "8px 10px",
                          marginTop: isFirst ? 2 : 4,
                          borderRadius: "var(--r)",
                          background: secOpen ? "var(--gold-ghost)" : "transparent",
                          transition: "background 0.15s ease",
                        }}
                      >
                        {/* Barre d'accent dorée : pôle ouvert = « vous êtes ici » */}
                        {secOpen && (
                          <span style={{ position: "absolute", insetInlineStart: 0, top: "50%", transform: "translateY(-50%)", width: 3, height: "64%", background: "var(--gold)", borderRadius: 2 }} />
                        )}
                        {/* Icône du pôle : repère visuel fort et lisible */}
                        <span style={{ width: 18, height: 18, display: "grid", placeItems: "center", color: "var(--gold)", flexShrink: 0 }}>
                          {navSectionIcon(block.section)}
                        </span>
                        <span
                          className={lang === "ar" ? "font-ar" : "font-display"}
                          style={{
                            flex: 1, minWidth: 0,
                            fontSize: 13,
                            fontWeight: 600,
                            color: secOpen ? "var(--gold-deep)" : "var(--ink-2)",
                          }}
                        >
                          {sectionLabel}
                        </span>
                        {/* Pastille de comptage : volume du pôle */}
                        <span className="tnum" style={{ fontSize: 10.5, fontWeight: 600, color: secOpen ? "var(--gold-deep)" : "var(--ink-4)", background: secOpen ? "transparent" : "var(--line-soft)", borderRadius: 999, padding: "1px 7px", flexShrink: 0 }}>
                          {block.items.length}
                        </span>
                        <span style={{ color: "var(--ink-4)", transition: "transform 0.22s ease", display: "block", transform: secOpen ? "rotate(180deg)" : "rotate(0deg)" }}>
                          <IcChevD />
                        </span>
                      </div>
                      {/* Items de la rubrique — repli animé */}
                      <div style={{
                        overflow: "hidden",
                        maxHeight: secOpen ? block.items.length * 40 + 4 : 0,
                        transition: "max-height 0.22s ease",
                      }}>
                        {block.items.map(child => (
                          <NavItemRow key={child.key} icon={child.icon} navKey={child.key} badge={child.badge} isActive={child.key === active} isChild labelOverride={child.labelKey ? navLabel(child.labelKey) : undefined} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    );
  }

  function NavContent() {
    const col = collapsed && !isMob;
    // Mode hub : sidebar limitée à la rubrique active (ses fonctions) ; sinon arbre complet.
    const scoped = navMode === "hub" && scope != null;
    const entriesToRender = scoped
      ? NAV_ENTRIES.filter(e =>
          (e.type === "group" && e.id === scope) || (e.type === "item" && e.key === scope),
        )
      : NAV_ENTRIES;
    const homeLabel = lang === "ar" ? "الرئيسية" : lang === "fr" ? "Accueil" : "Home";
    const toggleLabel = navMode === "hub"
      ? (lang === "ar" ? "القائمة الكلاسيكية" : lang === "fr" ? "Menu classique" : "Classic menu")
      : (lang === "ar" ? "عرض الواجهة" : lang === "fr" ? "Vue hub" : "Hub view");
    return (
      <>
        <div style={{ padding: col ? "12px 6px" : "14px 10px", display: "flex", flexDirection: "column", gap: 2, flex: 1, overflowY: "auto", overflowX: "hidden" }}>
          {/* Retour Accueil (hub) — ramène au lanceur de rubriques. */}
          {navMode === "hub" && onHome && (
            <div
              role="button"
              tabIndex={0}
              data-testid="nav-home"
              onClick={() => { onHome(); if (isMob) setMobileOpen(false); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { onHome(); if (isMob) setMobileOpen(false); } }}
              aria-label={homeLabel}
              title={col ? homeLabel : undefined}
              style={{
                display: "flex", alignItems: "center", gap: col ? 0 : 11,
                padding: col ? "10px 0" : "9px 10px", justifyContent: col ? "center" : undefined,
                borderRadius: "var(--r)", cursor: "pointer", color: "var(--ink-2)",
                marginBottom: 4,
              }}
            >
              <span style={{ width: 18, height: 18, display: "grid", placeItems: "center", color: "var(--gold)", flexShrink: 0 }}><IcGrid /></span>
              {!col && <span className={lang === "ar" ? "font-ar" : "font-display"} style={{ fontSize: 14, fontWeight: 500 }}>{homeLabel}</span>}
            </div>
          )}
          {/* Favoris — raccourcis de navigation en tête de sidebar (localStorage). */}
          {favHydrated && favorites.length > 0 && (
            <>
              {!col && (
                <div className="eyebrow" style={{ padding: "8px 10px 6px" }}>
                  {lang === "ar" ? "المفضلة" : lang === "fr" ? "Favoris" : "Favorites"}
                </div>
              )}
              {favorites.map(favKey => (
                <NavItemRow
                  key={`fav-${favKey}`}
                  icon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M12 2l2.9 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l7.1-1.01L12 2z" />
                    </svg>
                  }
                  navKey={favKey as NavKey}
                  isActive={active === favKey}
                />
              ))}
              {!col && <div style={{ height: 1, background: "var(--line-soft)", margin: "8px 10px" }} />}
            </>
          )}
          {!col && navMode !== "hub" && <div className="eyebrow" style={{ padding: "8px 10px 6px" }}>{t.workspace}</div>}
          {entriesToRender.map(entry => {
            if (entry.type === "spacer") {
              if (scoped) return null;
              return <div key={entry.id} style={{ height: 1, background: "var(--line-soft)", margin: "8px 10px" }} />;
            }
            if (entry.type === "item") {
              // Gating IAM : on masque une entrée connue du catalogue et non autorisée.
              if (!navGate(entry.key)) return null;
              return <NavItemRow key={entry.key} icon={entry.icon} navKey={entry.key} badge={entry.badge} isActive={entry.key === active} />;
            }
            // Groupe : on ne garde que les enfants autorisés ; groupe vide → masqué.
            const visibleChildren = entry.children.filter(c => navGate(c.key));
            if (visibleChildren.length === 0) return null;
            return <GroupRow key={entry.id} entry={{ ...entry, children: visibleChildren }} />;
          })}
        </div>

        {/* User footer */}
        <div style={{ padding: col ? "12px 6px" : 12, borderTop: "1px solid var(--line-soft)", flexShrink: 0 }}>
          {/* Bascule hub ⇄ menu classique (préférence mémorisée côté shell). */}
          {!col && onToggleMode && (
            <button
              type="button"
              data-testid="nav-toggle-mode"
              onClick={onToggleMode}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                background: "transparent", border: "1px solid var(--line-soft)", borderRadius: "var(--r)",
                padding: "7px 10px", marginBottom: 8, cursor: "pointer",
                color: "var(--ink-3)", fontSize: 11.5, fontWeight: 600, font: "inherit",
              }}
            >
              <span style={{ width: 15, height: 15, display: "grid", placeItems: "center", color: "var(--gold)" }}><IcGrid /></span>
              {toggleLabel}
            </button>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: 8, justifyContent: col ? "center" : undefined }}>
            <div
              onClick={e => { const r = e.currentTarget.getBoundingClientRect(); setStatusBounds(r); setShowStatus(p => !p); }}
              title={statusLabel}
              style={{ position: "relative", flexShrink: 0, cursor: "pointer" }}
            >
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--ink)", color: "var(--gold)", display: "grid", placeItems: "center", fontFamily: "'Roboto', sans-serif", fontSize: 15, fontWeight: 600 }}>{initials}</div>
              <span style={{ position: "absolute", bottom: 1, insetInlineEnd: 1, width: 9, height: 9, borderRadius: "50%", background: currentStatus.color, border: "2px solid var(--bg-paper)", display: "block" }} />
            </div>
            {!col && (
              <>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink)" }}>{displayName}</div>
                  <button
                    onClick={e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); setStatusBounds(r); setShowStatus(p => !p); }}
                    aria-label="Change status"
                    style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 10.5, color: currentStatus.color, letterSpacing: "0.04em", marginTop: 2, outline: "none" }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: 3, background: currentStatus.color, display: "inline-block", flexShrink: 0 }} />
                    {statusLabel}
                  </button>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    title={t.logout}
                    aria-label={t.logout}
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
        <aside
          role="navigation"
          aria-label="Main navigation"
          style={{
            width: collapsed ? 62 : 232, flexShrink: 0,
            background: "var(--bg-paper)",
            borderInlineEnd: "1px solid var(--line-soft)",
            display: "flex", flexDirection: "column", height: "100%",
            transition: "width 0.25s ease",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div style={{
            padding: "16px 12px",
            borderBottom: "1px solid var(--line-soft)",
            display: "flex", alignItems: "center",
            justifyContent: collapsed ? "center" : "space-between", gap: 8,
            minHeight: 66, flexShrink: 0,
          }}>
            {collapsed ? <LogoMark size={32} /> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
                <Wordmark />
                <div style={{ fontSize: 10.5, color: "var(--ink-4)", fontWeight: 500, paddingInlineStart: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  Infinity International FM
                </div>
              </div>
            )}
            <button
              onClick={() => setCollapsed(c => !c)}
              title={collapsed ? "Expand" : "Collapse"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              style={{
                flexShrink: 0, width: 26, height: 26, borderRadius: "var(--r-sm)",
                display: "grid", placeItems: "center",
                background: "transparent", border: "1px solid var(--line-soft)",
                color: "var(--ink-4)", cursor: "pointer", transition: "all 0.15s",
                outline: "none",
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
              insetInlineStart: lang !== "ar" ? statusBounds.left : undefined,
              insetInlineEnd: lang === "ar" ? (window.innerWidth - statusBounds.right) : undefined,
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
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 14px", background: status === s.key ? "var(--gold-ghost)" : "transparent", border: "none", cursor: "pointer", fontSize: 12.5, color: status === s.key ? "var(--gold-deep)" : "var(--ink-2)", textAlign: "start", transition: "background 0.12s ease" }}
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
        aria-label="Open navigation menu"
        style={{
          position: "fixed", top: 14, insetInlineStart: 14, zIndex: 600,
          width: 38, height: 38, borderRadius: "var(--r)",
          display: "grid", placeItems: "center",
          background: "var(--bg-paper)", border: "1px solid var(--line-soft)",
          color: "var(--ink-2)", cursor: "pointer", boxShadow: "var(--shadow-1)",
          outline: "none",
        }}
      >
        <IcHamburger />
      </button>

      {/* Overlay + bottom sheet */}
      {mobileOpen && (
        <>
          <div
            onClick={() => setMobileOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 700, backdropFilter: "blur(2px)" }}
          />
          <nav
            role="navigation"
            aria-label="Main navigation"
            style={{
              position: "fixed", bottom: 0, insetInlineStart: 0, insetInlineEnd: 0, zIndex: 800,
              background: "var(--bg-paper)",
              borderRadius: "14px 14px 0 0",
              maxHeight: "85vh", display: "flex", flexDirection: "column",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.18)",
              animation: "slideUp 0.22s ease",
              overflowX: "hidden",
            }}
          >
            {/* Sheet handle + header */}
            <div style={{ padding: "10px 16px 12px", borderBottom: "1px solid var(--line-soft)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Wordmark />
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                style={{ width: 30, height: 30, borderRadius: "var(--r-sm)", display: "grid", placeItems: "center", background: "transparent", border: "1px solid var(--line-soft)", color: "var(--ink-4)", cursor: "pointer", outline: "none" }}
              >
                <IcClose />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", overflowY: "auto", flex: 1, overflowX: "hidden" }}>
              <NavContent />
            </div>
          </nav>
        </>
      )}
    </>
  );
}

/* ─── Notifications data ──────────────────────────────────────────── */
type NotifType = "lead" | "contract" | "payment" | "visa" | "reminder" | "alert";

const NOTIF_CFG: Record<NotifType, { icon: string; color: string; bg: string }> = {
  lead:     { icon: "👤", color: "var(--azure)",   bg: "rgba(74,107,130,0.12)"  },
  contract: { icon: "📄", color: "var(--emerald)", bg: "rgba(79,107,78,0.12)"   },
  payment:  { icon: "💳", color: "var(--gold)",    bg: "rgba(184,146,79,0.12)"  },
  visa:     { icon: "🌟", color: "#a259ff",        bg: "rgba(162,89,255,0.10)"  },
  reminder: { icon: "📅", color: "var(--ink-3)",   bg: "rgba(107,95,77,0.10)"   },
  alert:    { icon: "⚠️", color: "var(--rose)",    bg: "rgba(142,79,79,0.12)"   },
};

// Notification réelle renvoyée par l'API (back-office).
// Mappe le `type` métier du backend vers une catégorie d'affichage (icône/couleur).
function notifCategory(t: string): NotifType {
  if (t.startsWith("crm")) return "lead";
  if (t.includes("rental") || t.includes("contract") || t.includes("renewal")) return "contract";
  if (t.includes("invoice") || t.includes("payment") || t.includes("payout") || t.includes("pdc")) return "payment";
  if (t.includes("visa")) return "visa";
  if (t.includes("ticket") || t.includes("sla") || t.includes("breach") || t.includes("alert")) return "alert";
  return "reminder";
}

// Temps relatif compact (FR/EN/AR) depuis un ISO timestamp.
function timeAgo(iso: string, lang: "ar" | "en" | "fr"): string {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const m = Math.floor(diff / 60000);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const U = {
    ar: { now: "الآن", m: "د", h: "س", d: "ي" },
    en: { now: "now", m: "m", h: "h", d: "d" },
    fr: { now: "à l'instant", m: "min", h: "h", d: "j" },
  }[lang];
  if (d > 0) return `${d} ${U.d}`;
  if (h > 0) return `${h} ${U.h}`;
  if (m > 0) return `${m} ${U.m}`;
  return U.now;
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
  const [notifOpen, setNotifOpen]       = useState(false);
  // Temps réel : liste + compteur non-lus poussés via WebSocket (repli polling 25 s).
  const { items: notifs, unread, markRead, markAll: markAllRead } = useNotifications();
  const [themeRotating, setThemeRotating] = useState(false);
  const notifRef                        = useRef<HTMLDivElement>(null);
  const displayUnread                   = unread > 9 ? "9+" : unread;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function handleThemeToggle() {
    setThemeRotating(true);
    toggle();
    setTimeout(() => setThemeRotating(false), 400);
  }

  const bellFocus = useFocusRing();
  const themeFocus = useFocusRing();

  return (
    <header style={{
      height: 64, flexShrink: 0,
      paddingInlineStart: isMob ? 62 : 28, paddingInlineEnd: isMob ? 12 : 28,
      background: "var(--bg-cream)", borderBottom: "1px solid var(--line-soft)",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      overflowX: "hidden",
    }}>
      {/* Left: title + breadcrumb */}
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

      {/* Right: actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        {children}

        {/* Search shortcut */}
        <div
          onClick={() => window.dispatchEvent(new CustomEvent("open-global-search"))}
          role="button"
          aria-label="Open global search (⌘K)"
          style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "7px 12px", borderRadius: "var(--r)",
            background: "var(--bg-ivory)", border: "1px solid var(--line-soft)",
            color: "var(--ink-3)", fontSize: 12, cursor: "pointer",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--gold-line)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-gold)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line-soft)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; }}
        >
          <IcSearch />
          {!isMob && <span style={{ color: "var(--ink-4)" }}>{t.search}</span>}
          <kbd style={{
            fontSize: 10, padding: "1px 6px",
            border: "1px solid var(--line)", borderRadius: 4,
            color: "var(--ink-3)", background: "var(--bg-paper)",
            fontFamily: "inherit", letterSpacing: "0.02em",
            boxShadow: "0 1px 0 var(--line)",
          }}>⌘K</kbd>
        </div>

        {/* Notification bell */}
        <div ref={notifRef} style={{ position: "relative" }}>
          <button
            onClick={() => setNotifOpen(o => !o)}
            aria-label="Notifications"
            aria-expanded={notifOpen}
            onFocus={bellFocus.onFocus}
            onBlur={bellFocus.onBlur}
            style={{
              position: "relative", height: 36, width: 36,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: notifOpen ? "var(--gold-ghost)" : "var(--bg-ivory)",
              border: `1px solid ${notifOpen ? "var(--gold-line)" : "var(--line-soft)"}`,
              color: notifOpen ? "var(--gold)" : "var(--ink-2)",
              borderRadius: "var(--r)", cursor: "pointer",
              transition: "all 0.15s ease",
              ...bellFocus.style,
            }}
          >
            <IcBell />
            {unread > 0 && (
              <span style={{
                position: "absolute", top: 6, insetInlineEnd: 6,
                minWidth: 15, height: 15, borderRadius: 999,
                background: "var(--rose)", color: "#fff",
                fontSize: 9, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                padding: "0 3px", border: "1.5px solid var(--bg-cream)",
                animation: "sgi-pulse 2s ease-in-out infinite",
              }}>
                {displayUnread}
              </span>
            )}
          </button>

          {notifOpen && (
            <div style={{
              position: "absolute", insetInlineEnd: 0, top: 44,
              width: isMob ? "calc(100vw - 24px)" : 380,
              background: "var(--bg-paper)",
              border: "1px solid var(--line-soft)",
              borderRadius: "var(--r-md)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
              zIndex: 999, overflow: "hidden",
              display: "flex", flexDirection: "column",
              animation: "sgi-fade-in 0.18s ease",
            }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", borderBottom: "1px solid var(--line-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "var(--ink)" }}>
                    {lang === "ar" ? "الإشعارات" : "Notifications"}
                  </span>
                  {unread > 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "var(--rose)", color: "#fff" }}>{displayUnread}</span>
                  )}
                </div>
                {unread > 0 && (
                  <button onClick={markAllRead} style={{ fontSize: 11, color: "var(--gold-deep)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, padding: "2px 6px", outline: "none" }}>
                    {lang === "ar" ? "تحديد الكل كمقروء" : lang === "fr" ? "Tout marquer comme lu" : "Mark all as read"}
                  </button>
                )}
              </div>

              {/* List */}
              <div style={{ overflowY: "auto", maxHeight: 460 }}>
                {notifs.length === 0 && (
                  <div style={{ padding: "28px 16px", textAlign: "center", fontSize: 12.5, color: "var(--ink-4)" }}>
                    {lang === "ar" ? "لا إشعارات" : lang === "fr" ? "Aucune notification" : "No notifications"}
                  </div>
                )}
                {notifs.map((n, i) => {
                  const cfg = NOTIF_CFG[notifCategory(n.type)];
                  const read = n.status === "read";
                  return (
                    <div
                      key={n.id}
                      onClick={() => { if (!read) void markRead(n.id); }}
                      style={{
                        display: "flex", gap: 12, padding: "12px 16px",
                        borderBottom: i < notifs.length - 1 ? "1px solid var(--line-soft)" : "none",
                        cursor: "pointer",
                        background: read ? "transparent" : "var(--gold-ghost)",
                        transition: "background 0.15s ease",
                        animation: `sgi-slide-in 0.2s ease ${i * 0.03}s both`,
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = "var(--bg-cream)"}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = read ? "transparent" : "var(--gold-ghost)"}
                    >
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                        {cfg.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: read ? 500 : 700, color: "var(--ink)", lineHeight: 1.3 }}>{n.title}</span>
                          <span style={{ fontSize: 10.5, color: "var(--ink-4)", flexShrink: 0, marginTop: 1 }}>{timeAgo(n.created_at, lang)}</span>
                        </div>
                        {n.body && <div style={{ fontSize: 11.5, color: "var(--ink-3)", marginTop: 3, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.body}</div>}
                        {!read && <div style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, marginTop: 5 }} />}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Footer */}
              <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line-soft)", textAlign: "center" }}>
                <button style={{ fontSize: 12, color: "var(--gold-deep)", background: "none", border: "none", cursor: "pointer", fontWeight: 600, outline: "none" }}>
                  {lang === "ar" ? "عرض كل الإشعارات" : lang === "fr" ? "Voir toutes les notifications" : "View all notifications"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Theme toggle */}
        <button
          onClick={handleThemeToggle}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          onFocus={themeFocus.onFocus}
          onBlur={themeFocus.onBlur}
          style={{
            height: 36, width: 36,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: "var(--bg-ivory)", border: "1px solid var(--line-soft)",
            color: "var(--ink-2)", borderRadius: "var(--r)", cursor: "pointer",
            transition: "all 0.15s ease",
            ...themeFocus.style,
          }}
        >
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.4s ease",
            transform: themeRotating ? "rotate(180deg)" : "rotate(0deg)",
          }}>
            {theme === "dark" ? <IcSun /> : <IcMoon />}
          </span>
        </button>

        {/* Language switcher */}
        <div style={{ display: "flex", gap: 2, background: "var(--bg-ivory)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", padding: 3 }}>
          {(["ar", "en", "fr"] as const).map(l => (
            <button key={l} onClick={() => setLang(l)} style={{
              padding: "3px 9px", borderRadius: "var(--r-sm)",
              fontSize: 10.5, fontWeight: 600, letterSpacing: "0.08em",
              border: "none", cursor: "pointer",
              background: lang === l ? "var(--gold)" : "transparent",
              color: lang === l ? "#1A1610" : "var(--ink-4)",
              transition: "background 0.15s ease, color 0.15s ease",
              outline: "none",
            }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Global keyframe animations injected once */}
      <style>{`
        @keyframes sgi-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(142,79,79,0.5); }
          50%       { box-shadow: 0 0 0 4px rgba(142,79,79,0); }
        }
        @keyframes sgi-fade-in {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes sgi-slide-in {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
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

/* ─── ConfirmModal ──────────────────────────────────────────────────
 *  Modale de confirmation réutilisable pour toute action destructive.
 *  Usage:
 *    <ConfirmModal
 *      open={!!toDelete}
 *      title="Supprimer le document"
 *      message="Cette action est irréversible."
 *      onConfirm={() => { doDelete(); setToDelete(null); }}
 *      onCancel={() => setToDelete(null)}
 *    />
 * ─────────────────────────────────────────────────────────────────── */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter")  onConfirm();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "rgba(10,7,3,0.55)",
        backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "sgi-fade-in 0.15s ease",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "var(--bg-paper)",
          border: "1px solid var(--line)",
          borderRadius: "var(--r-md)",
          boxShadow: "var(--shadow-3)",
          padding: "28px 28px 24px",
          width: "min(380px, 90vw)",
          display: "flex", flexDirection: "column", gap: 16,
          animation: "sgi-fade-in 0.18s ease",
        }}
      >
        {/* Icon */}
        <div style={{
          width: 44, height: 44, borderRadius: "var(--r)",
          background: "var(--rose-soft)", border: "1px solid var(--rose)",
          display: "grid", placeItems: "center", color: "var(--rose)",
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </div>

        {/* Title + message */}
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
            {title}
          </div>
          {message && (
            <div style={{ fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.6 }}>
              {message}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 18px", borderRadius: "var(--r)",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              background: "var(--bg-ivory)", border: "1px solid var(--line)",
              color: "var(--ink-2)", transition: "all 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-inset)")}
            onMouseLeave={e => (e.currentTarget.style.background = "var(--bg-ivory)")}
          >
            {cancelLabel ?? "Annuler"}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 18px", borderRadius: "var(--r)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
              background: "var(--rose)", border: "1px solid var(--rose)",
              color: "#fff", transition: "opacity 0.15s",
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
            onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
          >
            {confirmLabel ?? "Supprimer"}
          </button>
        </div>
      </div>
    </div>
  );
}
