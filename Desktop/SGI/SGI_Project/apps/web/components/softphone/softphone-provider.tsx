"use client";

/**
 * Provider React du softphone : une SEULE instance partagée entre le dock
 * persistant et l'onglet « Appels » du screen Communication. Monté haut dans
 * l'arbre (app shell), il garde l'enregistrement SIP et la WS actifs pendant
 * la navigation entre écrans.
 */

import React, { createContext, useContext } from "react";

import { useSoftphone, type SoftphoneController } from "./use-softphone";

const SoftphoneContext = createContext<SoftphoneController | null>(null);

export function SoftphoneProvider({ children }: { children: React.ReactNode }) {
  const controller = useSoftphone();
  return (
    <SoftphoneContext.Provider value={controller}>{children}</SoftphoneContext.Provider>
  );
}

/** Accès au softphone partagé. Lève si utilisé hors du provider. */
export function useSoftphoneContext(): SoftphoneController {
  const ctx = useContext(SoftphoneContext);
  if (!ctx) {
    throw new Error("useSoftphoneContext doit être utilisé dans <SoftphoneProvider>.");
  }
  return ctx;
}
