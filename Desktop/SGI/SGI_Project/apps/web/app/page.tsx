"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/sgi-ui";
import { apiLogout } from "@/lib/auth";
import { ScreenLogin } from "./screens/login";
import { ScreenDashboard } from "./screens/dashboard";
import { ScreenCRM } from "./screens/crm";
import { ScreenPortal } from "./screens/portal";
import { ScreenAdministrations } from "./screens/administrations";
import { ScreenTourisme } from "./screens/tourisme";
import { ScreenSante } from "./screens/sante";
import { ScreenAssurance } from "./screens/assurance";
import { ScreenRealEstate } from "./screens/real-estate";
import { ScreenRealEstateAchat } from "./screens/realestate-achat";
import { ScreenRealEstateVente } from "./screens/realestate-vente";
import { ScreenRealEstateLocation } from "./screens/realestate-location";
import { ScreenRealEstateBranches } from "./screens/realestate-branches";
import { ScreenRealEstateSettings } from "./screens/realestate-settings";
import { ScreenRealEstateDocuments } from "./screens/realestate-documents";
import { ScreenRealEstateBuildings } from "./screens/realestate-buildings";
import { ScreenRealEstateUnits } from "./screens/realestate-units";
import { ScreenRealEstateTenants } from "./screens/realestate-tenants";
import { ScreenRealEstateContracts } from "./screens/realestate-contracts";
import { ScreenRealEstateOwners } from "./screens/realestate-owners";
import { ScreenRealEstateDevelopers } from "./screens/realestate-developers";
import { ScreenRealEstateMarketing } from "./screens/realestate-marketing";
import { ScreenRealEstateWebsite } from "./screens/realestate-website";
import { ScreenRealEstateProcess } from "./screens/realestate-process";
import { ScreenRealEstateOwnerPortal } from "./screens/realestate-owner-portal";
import { ScreenRealEstatePayments } from "./screens/realestate-payments";
import { ScreenRealEstateCheques } from "./screens/realestate-cheques";
import { MaintenanceScreen } from "./screens/maintenance";
import { ScreenRealEstateComms } from "./screens/realestate-comms";
import { ScreenRealEstateInbox } from "./screens/realestate-inbox";
import { ScreenRealEstateTickets } from "./screens/realestate-tickets";
import { ScreenRealEstateWorkflows } from "./screens/realestate-workflows";
import { ScreenBanques } from "./screens/banques";
import { ScreenConsultants } from "./screens/consultants";
import { ScreenAmazon } from "./screens/amazon";
import { ScreenCallCenter } from "./screens/callcenter";
import { ScreenFinance } from "./screens/finance";
import { ScreenAccounting } from "./screens/accounting";
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
import { ScreenFournisseurs } from "./screens/fournisseurs";
import { ScreenFournisseursFiches } from "./screens/fournisseurs-fiches";
import type { ConfirmedDeal } from "@/components/deal-wizard";
import { GlobalSearch } from "@/components/global-search";
import { SoftphoneProvider } from "@/components/softphone/softphone-provider";
import { SoftphoneDock } from "@/components/softphone/softphone-dock";
import { AssistantDock } from "@/components/assistant/assistant-dock";
import { PermissionsProvider, useNavGate } from "@/lib/permissions";

// ─── Types ───────────────────────────────────────────────────────────────────

type ScreenKey =
  | "dash" | "crm" | "orders"
  | "realestate" | "realestate_process" | "realestate_achat" | "realestate_vente" | "realestate_location" | "realestate_marketing" | "realestate_website" | "realestate_buildings" | "realestate_units" | "realestate_tenants" | "realestate_owners" | "realestate_owner_portal" | "realestate_developers" | "realestate_contracts" | "realestate_payments" | "realestate_cheques" | "realestate_maintenance" | "realestate_comms" | "realestate_inbox" | "realestate_tickets" | "realestate_workflows" | "realestate_branches" | "realestate_settings" | "realestate_documents" | "admin" | "travail"
  | "tourisme_crm" | "sante_crm" | "assurance_crm"
  | "banques_crm" | "amazon_crm" | "consultants_crm" | "admin_crm" | "travail_crm" | "callcenter_crm"
  | "tourisme_news" | "sante_news" | "assurance_news"
  | "banques_news" | "amazon_news" | "consultants_news" | "admin_news" | "travail_news" | "callcenter_news"
  | "tourisme" | "sante" | "assurance" | "banques" | "amazon" | "consultants" | "callcenter"
  | "erp" | "workspace" | "audit" | "backoffice" | "hr" | "it"
  | "finance" | "accounting" | "marketing" | "report" | "parametres"
  | "clients" | "personne" | "societe"
  | "fournisseurs" | "fournisseurs_fiches" | "fournisseurs_validation";

type ScreenProps = {
  onNavigateToClient?: (name: string) => void;
  onDealConfirmed?: (deal: ConfirmedDeal) => void;
  onNavigate?: (screen: string) => void;
  initialSearch?: string;
  confirmedDeals?: ConfirmedDeal[];
  initialLead?: Record<string, string | number>;
  onPrefillConsumed?: () => void;
};

// ─── Screen Registry ──────────────────────────────────────────────────────────

const SCREEN_REGISTRY: Record<ScreenKey, (props: ScreenProps) => React.ReactNode> = {
  // Core screens
  "dash":        (p)  => <ScreenDashboard onNavigate={p.onNavigate} />,
  "crm":         (p)  => <ScreenCRM onNavigateToClient={p.onNavigateToClient} initialLead={p.initialLead} onPrefillConsumed={p.onPrefillConsumed} />,
  "orders":      (_)  => <ScreenOrders />,
  "realestate":  (_)  => <ScreenRealEstate />,
  "realestate_achat": (_) => <ScreenRealEstateAchat />,
  "realestate_vente": (_) => <ScreenRealEstateVente />,
  "realestate_location": (_) => <ScreenRealEstateLocation />,
  "realestate_buildings": (_) => <ScreenRealEstateBuildings />,
  "realestate_units": (_) => <ScreenRealEstateUnits />,
  "realestate_tenants": (_) => <ScreenRealEstateTenants />,
  "realestate_contracts": (p) => <ScreenRealEstateContracts initialLead={p.initialLead} onPrefillConsumed={p.onPrefillConsumed} />,
  "realestate_payments": (p) => <ScreenRealEstatePayments initialLead={p.initialLead} onPrefillConsumed={p.onPrefillConsumed} />,
  "realestate_cheques": (_) => <ScreenRealEstateCheques />,
  "realestate_maintenance": (_) => <MaintenanceScreen />,
  "realestate_comms": (_) => <ScreenRealEstateComms />,
  "realestate_inbox": (_) => <ScreenRealEstateInbox />,
  "realestate_tickets": (_) => <ScreenRealEstateTickets />,
  "realestate_workflows": (_) => <ScreenRealEstateWorkflows />,
  "realestate_owners": (_) => <ScreenRealEstateOwners />,
  "realestate_owner_portal": (_) => <ScreenRealEstateOwnerPortal />,
  "realestate_developers": (_) => <ScreenRealEstateDevelopers />,
  "realestate_process": (p) => <ScreenRealEstateProcess onNavigate={p.onNavigate} />,
  "realestate_marketing": (_) => <ScreenRealEstateMarketing />,
  "realestate_website": (_) => <ScreenRealEstateWebsite />,
  "realestate_branches": (_) => <ScreenRealEstateBranches />,
  "realestate_settings": (_) => <ScreenRealEstateSettings />,
  "realestate_documents": (_) => <ScreenRealEstateDocuments />,
  "admin":       (_)  => <ScreenAdministrations />,
  "travail":     (_)  => <ScreenTravail />,

  // Sector CRM screens
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
  "erp":        (_)  => <ScreenERP />,
  "workspace":  (_)  => <ScreenWorkspace />,
  "audit":      (_)  => <ScreenAudit />,
  "backoffice": (p)  => <ScreenBackOffice onNavigate={p.onNavigate} />,
  "hr":         (_)  => <ScreenHR />,
  "it":         (_)  => <ScreenIT />,
  "finance":    (_)  => <ScreenFinance />,
  "accounting": (_)  => <ScreenAccounting />,
  "marketing":  (_)  => <ScreenMarketing />,
  "report":     (_)  => <ScreenReports />,
  "parametres": (_)  => <ScreenParametres />,

  // Fournisseurs (catégorie placée avant Clients)
  "fournisseurs":            (p) => <ScreenFournisseurs onNavigate={p.onNavigate} />,
  "fournisseurs_fiches":     (_) => <ScreenFournisseursFiches />,
  "fournisseurs_validation": (_) => <ScreenFournisseurValidation />,

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

// Gating IAM d'un écran : si l'écran (sa clé de nav) est connu du catalogue et
// non autorisé, on affiche un message d'accès refusé. La sécurité réelle reste
// côté backend (403) ; ceci évite juste d'afficher une page interdite.
function GatedScreen({ screen, children }: { screen: string; children: React.ReactNode }): React.ReactNode {
  const navGate = useNavGate();
  if (navGate(screen)) return children;
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "2rem" }}>
      <div style={{ textAlign: "center", color: "var(--ink-4)", maxWidth: 360 }}>
        <div style={{ fontSize: 40, marginBottom: 8 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink)" }}>403</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>
          Accès non autorisé · غير مصرح · Access denied
        </div>
      </div>
    </div>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<string>("login");
  const [confirmedDeals, setConfirmedDeals] = useState<ConfirmedDeal[]>([]);
  const [clientSearch, setClientSearch] = useState<string>("");
  // Pré-remplissage poussé par l'assistant (action guidée profonde), ciblé par écran.
  const [prefill, setPrefill] = useState<{ screen: string; fields: Record<string, string | number> } | null>(null);

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
    <PermissionsProvider>
      <SoftphoneProvider>
        <div
          data-testid="app-shell"
          style={{ height: "100vh", display: "flex", overflow: "hidden", background: "var(--bg-base)" }}
        >
          <Sidebar active={screen} onNavigate={setScreen} onLogout={handleLogout} />
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
            <GatedScreen screen={screen}>
              {renderScreen(screen, {
                onNavigateToClient: handleNavigateToClient,
                onDealConfirmed:    handleDealConfirmed,
                onNavigate:         setScreen,
                initialSearch:      clientSearch,
                confirmedDeals:     confirmedDeals,
                initialLead:        prefill && prefill.screen === screen ? prefill.fields : undefined,
                onPrefillConsumed:  () => setPrefill(null),
              })}
            </GatedScreen>
          </div>
          <GlobalSearch
            onNavigate={setScreen}
            onClientSearch={name => { setClientSearch(name); setScreen("personne"); }}
          />
          {/* Dock softphone persistant (téléphonie) — partage l'instance SIP/WS via le provider. */}
          <SoftphoneDock onOpenClient={handleNavigateToClient} />
          {/* Assistant in-app (chatbot robot) — à côté du softphone, aide + navigation guidée. */}
          <AssistantDock
            screen={screen}
            onNavigate={setScreen}
            onPrefill={(pf) => setPrefill(pf)}
          />
        </div>
      </SoftphoneProvider>
    </PermissionsProvider>
  );
}
