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
import { ScreenFinance } from "./screens/finance";
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
import { ScreenReports } from "./screens/reports";
import { ScreenClients } from "./screens/clients";
import { ScreenClientsPersonne } from "./screens/clients-personne";
import { ScreenClientsSociete } from "./screens/clients-societe";

export default function App() {
  const [screen, setScreen] = useState<string>("login");

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
        {screen === "contract" && <ScreenContracts />}
        {screen === "rental"    && <ScreenRentals />}
        {screen === "realestate" && <ScreenRealEstate />}
        {screen === "admin"     && <ScreenAdministrations />}
        {screen === "tourisme"  && <ScreenTourisme />}
        {screen === "sante"     && <ScreenSante />}
        {screen === "assurance" && <ScreenAssurance />}
        {screen === "banques"   && <ScreenBanques />}
        {screen === "amazon"    && <ScreenAmazon />}
        {screen === "consultants" && <ScreenConsultants />}
        {screen === "visa"      && <ScreenGoldenVisa />}
        {screen === "finance"  && <ScreenFinance />}
        {screen === "report"   && <ScreenReports />}
        {screen === "clients"  && <ScreenClients onNavigate={setScreen} />}
        {screen === "personne" && <ScreenClientsPersonne />}
        {screen === "societe"  && <ScreenClientsSociete />}
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
