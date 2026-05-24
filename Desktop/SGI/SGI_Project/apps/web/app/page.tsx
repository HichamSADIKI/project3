"use client";

import React, { useState } from "react";
import { Sidebar } from "@/components/sgi-ui";
import { apiLogout } from "@/lib/auth";
import { useT } from "@/components/language-provider";
import { ScreenLogin } from "./screens/login";
import { ScreenDashboard } from "./screens/dashboard";
import { ScreenProperties } from "./screens/properties";
import { ScreenCRM } from "./screens/crm";
import { ScreenContracts } from "./screens/contracts";
import { ScreenGoldenVisa } from "./screens/golden-visa";
import { ScreenFinance } from "./screens/finance";
import { ScreenPortal } from "./screens/portal";

export default function App() {
  const [screen, setScreen] = useState<string>("login");

  async function handleLogout() {
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
        {screen === "rental"   && <ScreenRentals />}
        {screen === "visa"     && <ScreenGoldenVisa />}
        {screen === "finance"  && <ScreenFinance />}
        {screen === "report"   && <ScreenReports />}
      </div>
    </div>
  );
}

function ScreenRentals() {
  const t = useT();
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", background: "var(--bg-cream)", color: "var(--ink-3)" }}>
      <div style={{ textAlign: "center" }}>
        <div className="font-display" style={{ fontSize: 36, color: "var(--ink-4)" }}>{t.nav_rental}</div>
        <div style={{ fontSize: 13, marginTop: 8, color: "var(--ink-4)" }}>{t.coming_soon}</div>
      </div>
    </div>
  );
}

function ScreenReports() {
  const t = useT();
  return (
    <div style={{ flex: 1, display: "grid", placeItems: "center", background: "var(--bg-cream)", color: "var(--ink-3)" }}>
      <div style={{ textAlign: "center" }}>
        <div className="font-display" style={{ fontSize: 36, color: "var(--ink-4)" }}>{t.nav_report}</div>
        <div style={{ fontSize: 13, marginTop: 8, color: "var(--ink-4)" }}>{t.coming_soon}</div>
      </div>
    </div>
  );
}
