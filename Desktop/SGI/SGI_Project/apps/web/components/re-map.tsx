"use client";

// Wrapper dynamique SSR-off du composant carte Leaflet. Les écrans importent
// CE fichier (jamais re-map-view directement) : Leaflet ne tourne qu'au client.

import dynamic from "next/dynamic";
import type { MapMarker } from "./re-map-view";

export type { MapMarker };

const ReMapView = dynamic(() => import("./re-map-view").then((m) => m.ReMapView), {
  ssr: false,
  loading: () => (
    <div style={{ width: "100%", height: 520, borderRadius: "var(--r)", border: "1px solid var(--line-soft)", background: "var(--bg-cream)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--ink-4)", fontSize: 13 }}>
      …
    </div>
  ),
});

export function ReMap(props: { markers: MapMarker[]; height?: number; emptyLabel?: string }) {
  return <ReMapView {...props} />;
}
