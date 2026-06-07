"use client";

// Wrapper dynamique SSR-off de la carte vitrine. Les pages importent CE fichier
// (jamais property-map-view) : Leaflet ne tourne qu'au client.

import dynamic from "next/dynamic";
import type { PropertyMarker } from "./property-map-view";

export type { PropertyMarker };

const PropertyMapView = dynamic(
  () => import("./property-map-view").then((m) => m.PropertyMapView),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: "100%",
          height: 560,
          borderRadius: "var(--r-md, 12px)",
          border: "1px solid var(--line-soft)",
          background: "var(--bg-cream)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-4)",
          fontSize: 13,
        }}
      >
        …
      </div>
    ),
  },
);

export function PropertyMap(props: { markers: PropertyMarker[]; height?: number }) {
  return <PropertyMapView {...props} />;
}
