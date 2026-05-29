"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/sgi-ui";
import { apiLogout } from "@/lib/auth";
import { ScreenLogin } from "./screens/login";
import { ScreenDashboard } from "./screens/dashboard";
import { ScreenProperties } from "./screens/properties";
import { ScreenCRM } from "./screens/crm";
import { ScreenContracts } from "./screens/contracts";
import { ScreenGoldenVisa } from "./screens/golden-visa";
import { ScreenPortal } from "./screens/portal";
import { ScreenRentals } from "./screens/rentals";
import { ScreenAdministrations } from "./screens/administrations";
import { ScreenTourisme } from "./screens/tourisme";
import { ScreenSante } from "./screens/sante";
import { ScreenAssurance } from "./screens/assurance";
import { ScreenRealEstate } from "./screens/real-estate";
import { ScreenRealEstateAgenda } from "./screens/realestate-agenda";
import { ScreenBanques } from "./screens/banques";
import { ScreenConsultants } from "./screens/consultants";
import { ScreenAmazon } from "./screens/amazon";
import { ScreenCallCenter } from "./screens/callcenter";
import { ScreenFinance } from "./screens/finance";
import { ScreenReports } from "./screens/reports";
import { ScreenERP } from "./screens/erp";
import { ScreenWorkspace } from "./screens/workspace";
import { ScreenAudit } from "./screens/audit";
import { ScreenHR } from "./screens/hr";
import { ScreenIT } from "./screens/it";
import { ScreenBackOffice } from "./screens/backoffice";
import { ScreenParametres } from "./screens/parametres";
import { ScreenOrders } from "./screens/orders";
import { ScreenClients } from "./screens/clients";
import { ScreenClientsPersonne } from "./screens/clients-personne";
import { ScreenClientsSociete } from "./screens/clients-societe";
import { ScreenTravail } from "./screens/travail";
import { ScreenMarketing } from "./screens/marketing";
import { ScreenSectorCRM } from "./screens/sector-crm";
import { ScreenSectorNews } from "./screens/sector-news";
import { ScreenFournisseurValidation } from "./screens/fournisseur-validation";
import type { ConfirmedDeal } from "@/components/deal-wizard";
import { GlobalSearch } from "@/components/global-search";

// ─── Types ───────────────────────────────────────────────────────────────────

type ScreenKey =
  | "dash" | "prop" | "crm" | "orders" | "contract" | "rental"
  | "realestate" | "admin" | "travail"
  | "realestate_crm" | "tourisme_crm" | "sante_crm" | "assurance_crm"
  | "banques_crm" | "amazon_crm" | "consultants_crm" | "admin_crm" | "travail_crm" | "callcenter_crm"
  | "realestate_agenda"
  | "realestate_news" | "tourisme_news" | "sante_news" | "assurance_news"
  | "banques_news" | "amazon_news" | "consultants_news" | "admin_news" | "travail_news" | "callcenter_news"
  | "tourisme" | "sante" | "assurance" | "banques" | "amazon" | "consultants" | "callcenter"
  | "visa" | "erp" | "workspace" | "audit" | "backoffice" | "hr" | "it"
  | "finance" | "marketing" | "report" | "parametres"
  | "clients" | "personne" | "societe" | "fournisseurs";

type ScreenProps = {
  onNavigateToClient?: (name: string) => void;
  onDealConfirmed?: (deal: ConfirmedDeal) => void;
  onNavigate?: (screen: string) => void;
  initialSearch?: string;
  confirmedDeals?: ConfirmedDeal[];
};

// ─── Screen Registry ──────────────────────────────────────────────────────────

const SCREEN_REGISTRY: Record<ScreenKey, (props: ScreenProps) => React.ReactNode> = {
  // Core screens
  "dash":        (p)  => <ScreenDashboard onNavigate={p.onNavigate} />,
  "prop":        (_)  => <ScreenProperties />,
  "crm":         (p)  => <ScreenCRM onNavigateToClient={p.onNavigateToClient} />,
  "orders":      (_)  => <ScreenOrders />,
  "contract":    (_)  => <ScreenContracts />,
  "rental":      (_)  => <ScreenRentals />,
  "realestate":  (_)  => <ScreenRealEstate />,
  "realestate_agenda": (_) => <ScreenRealEstateAgenda />,
  "admin":       (_)  => <ScreenAdministrations />,
  "travail":     (_)  => <ScreenTravail />,

  // Sector CRM screens
  "realestate_crm":  (p) => <ScreenSectorCRM sector="realestate"  confirmedDeals={p.confirmedDeals} onNavigateToClient={p.onNavigateToClient} />,
  "tourisme_crm":    (p) => <ScreenSectorCRM sector="tourisme"    confirmedDeals={p.confirmedDeals} onNavigateToClient={p.onNavigateToClient} />,
  "sante_crm":       (p) => <ScreenSectorCRM sector="sante"       confirmedDeals={p.confirmedDeals} onNavigateToClient={p.onNavigateToClient} />,
  "assurance_crm":   (p) => <ScreenSectorCRM sector="assurance"   confirmedDeals={p.confirmedDeals} onNavigateToClient={p.onNavigateToClient} />,
  "banques_crm":     (p) => <ScreenSectorCRM sector="banques"     confirmedDeals={p.confirmedDeals} onNavigateToClient={p.onNavigateToClient} />,
  "amazon_crm":      (p) => <ScreenSectorCRM sector="amazon"      confirmedDeals={p.confirmedDeals} onNavigateToClient={p.onNavigateToClient} />,
  "consultants_crm": (p) => <ScreenSectorCRM sector="consultants" confirmedDeals={p.confirmedDeals} onNavigateToClient={p.onNavigateToClient} />,
  "admin_crm":       (p) => <ScreenSectorCRM sector="admin"       confirmedDeals={p.confirmedDeals} onNavigateToClient={p.onNavigateToClient} />,
  "travail_crm":     (p) => <ScreenSectorCRM sector="travail"     confirmedDeals={p.confirmedDeals} onNavigateToClient={p.onNavigateToClient} />,
  "callcenter_crm":  (p) => <ScreenSectorCRM sector="callcenter"  confirmedDeals={p.confirmedDeals} onNavigateToClient={p.onNavigateToClient} />,

  // Sector News screens
  "realestate_news":  (_) => <ScreenSectorNews sector="realestate" />,
  "tourisme_news":    (_) => <ScreenSectorNews sector="tourisme" />,
  "sante_news":       (_) => <ScreenSectorNews sector="sante" />,
  "assurance_news":   (_) => <ScreenSectorNews sector="assurance" />,
  "banques_news":     (_) => <ScreenSectorNews sector="banques" />,
  "amazon_news":      (_) => <ScreenSectorNews sector="amazon" />,
  "consultants_news": (_) => <ScreenSectorNews sector="consultants" />,
  "admin_news":       (_) => <ScreenSectorNews sector="admin" />,
  "travail_news":     (_) => <ScreenSectorNews sector="travail" />,
  "callcenter_news":  (_) => <ScreenSectorNews sector="callcenter" />,

  // Sector home screens
  "tourisme":    (_) => <ScreenTourisme />,
  "sante":       (_) => <ScreenSante />,
  "assurance":   (_) => <ScreenAssurance />,
  "banques":     (_) => <ScreenBanques />,
  "amazon":      (_) => <ScreenAmazon />,
  "consultants": (_) => <ScreenConsultants />,
  "callcenter":  (_) => <ScreenCallCenter />,

  // Back-office & tools
  "visa":       (_)  => <ScreenGoldenVisa />,
  "erp":        (_)  => <ScreenERP />,
  "workspace":  (_)  => <ScreenWorkspace />,
  "audit":      (_)  => <ScreenAudit />,
  "backoffice": (p)  => <ScreenBackOffice onNavigate={p.onNavigate} />,
  "hr":         (_)  => <ScreenHR />,
  "it":         (_)  => <ScreenIT />,
  "finance":    (_)  => <ScreenFinance />,
  "marketing":  (_)  => <ScreenMarketing />,
  "fournisseurs": (_) => <ScreenFournisseurValidation />,
  "report":     (_)  => <ScreenReports />,
  "parametres": (_)  => <ScreenParametres />,

  // Client screens
  "clients":  (p) => <ScreenClients onNavigate={p.onNavigate} />,
  "personne": (p) => <ScreenClientsPersonne onDealConfirmed={p.onDealConfirmed} initialSearch={p.initialSearch} />,
  "societe":  (p) => <ScreenClientsSociete onDealConfirmed={p.onDealConfirmed} />,
};

function renderScreen(screen: string, handlers: ScreenProps): React.ReactNode {
  const factory = SCREEN_REGISTRY[screen as ScreenKey];
  if (!factory) return null;
  return factory(handlers);
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<string>("login");
  const [confirmedDeals, setConfirmedDeals] = useState<ConfirmedDeal[]>([]);
  const [clientSearch, setClientSearch] = useState<string>("");

  function handleNavigateToClient(name: string) {
    setClientSearch(name);
    setScreen("personne");
  }

  function handleDealConfirmed(deal: ConfirmedDeal) {
    setConfirmedDeals(prev => [...prev, deal]);
  }

  async function handleLogout() {
    localStorage.setItem("sgi_last_logout", new Date().toISOString());
    await apiLogout();
    setScreen("login");
  }

  if (screen === "login") return <ScreenLogin onLogin={() => setScreen("dash")} />;
  if (screen === "portal") return <ScreenPortal />;

  return (
    <div style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--bg-base)" }}>
      <Sidebar active={screen} onNavigate={setScreen} onLogout={handleLogout} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
        {renderScreen(screen, {
          onNavigateToClient: handleNavigateToClient,
          onDealConfirmed:    handleDealConfirmed,
          onNavigate:         setScreen,
          initialSearch:      clientSearch,
          confirmedDeals:     confirmedDeals,
        })}
      </div>
      <GlobalSearch
        onNavigate={setScreen}
        onClientSearch={name => { setClientSearch(name); setScreen("personne"); }}
      />
    </div>
  );
}
