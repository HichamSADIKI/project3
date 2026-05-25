"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/sgi-ui";
import { apiLogout } from "@/lib/auth";
import { useT } from "@/components/language-provider";
import type { Translations } from "@/lib/i18n";
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
import { ScreenBanques } from "./screens/banques";
import { ScreenConsultants } from "./screens/consultants";
import { ScreenAmazon } from "./screens/amazon";
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
import { ScreenSectorCRM } from "./screens/sector-crm";
import type { ConfirmedDeal } from "@/components/deal-wizard";

export default function App() {
  const [screen, setScreen] = useState<string>("login");
  const [confirmedDeals, setConfirmedDeals] = useState<ConfirmedDeal[]>([]);

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
        {screen === "dash"     && <ScreenDashboard />}
        {screen === "prop"     && <ScreenProperties />}
        {screen === "crm"      && <ScreenCRM />}
        {screen === "orders"   && <ScreenOrders />}
        {screen === "contract" && <ScreenContracts />}
        {screen === "rental"    && <ScreenRentals />}
        {screen === "realestate" && <ScreenRealEstate />}
        {screen === "admin"     && <ScreenAdministrations />}
        {screen === "travail"   && <ScreenTravail />}
        {screen === "realestate_crm"  && <ScreenSectorCRM sector="realestate"  confirmedDeals={confirmedDeals} />}
        {screen === "tourisme_crm"    && <ScreenSectorCRM sector="tourisme"    confirmedDeals={confirmedDeals} />}
        {screen === "sante_crm"       && <ScreenSectorCRM sector="sante"       confirmedDeals={confirmedDeals} />}
        {screen === "assurance_crm"   && <ScreenSectorCRM sector="assurance"   confirmedDeals={confirmedDeals} />}
        {screen === "banques_crm"     && <ScreenSectorCRM sector="banques"     confirmedDeals={confirmedDeals} />}
        {screen === "amazon_crm"      && <ScreenSectorCRM sector="amazon"      confirmedDeals={confirmedDeals} />}
        {screen === "consultants_crm" && <ScreenSectorCRM sector="consultants" confirmedDeals={confirmedDeals} />}
        {screen === "admin_crm"       && <ScreenSectorCRM sector="admin"       confirmedDeals={confirmedDeals} />}
        {screen === "travail_crm"     && <ScreenSectorCRM sector="travail"     confirmedDeals={confirmedDeals} />}
        {screen === "tourisme"  && <ScreenTourisme />}
        {screen === "sante"     && <ScreenSante />}
        {screen === "assurance" && <ScreenAssurance />}
        {screen === "banques"   && <ScreenBanques />}
        {screen === "amazon"    && <ScreenAmazon />}
        {screen === "consultants" && <ScreenConsultants />}
        {screen === "visa"      && <ScreenGoldenVisa />}
        {screen === "erp"       && <ScreenERP />}
        {screen === "workspace" && <ScreenWorkspace />}
        {screen === "audit"     && <ScreenAudit />}
        {screen === "backoffice" && <ScreenBackOffice onNavigate={setScreen} />}
        {screen === "hr"        && <ScreenHR />}
        {screen === "it"        && <ScreenIT />}
        {screen === "finance"   && <ScreenFinance />}
        {screen === "report"    && <ScreenReports />}
        {screen === "parametres" && <ScreenParametres />}
        {screen === "clients"  && <ScreenClients onNavigate={setScreen} />}
        {screen === "personne" && <ScreenClientsPersonne onDealConfirmed={handleDealConfirmed} />}
        {screen === "societe"  && <ScreenClientsSociete onDealConfirmed={handleDealConfirmed} />}
      </div>
    </div>
  );
}

function ScreenPlaceholder({ navKey }: { navKey: keyof Translations }) {
  const t = useT();
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", background: "var(--bg-cream)" }}>
      <div style={{ textAlign: "center" }}>
        <div className="font-display" style={{ fontSize: 36, color: "var(--ink-4)" }}>{t[navKey] as string}</div>
        <div style={{ fontSize: 13, marginTop: 8, color: "var(--ink-4)" }}>{t.coming_soon}</div>
      </div>
    </div>
  );
}
