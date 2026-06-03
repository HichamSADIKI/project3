"use client";

// Implémentation Leaflet de la carte vitrine. NE PAS importer directement :
// passer par `property-map.tsx` (wrapper dynamique SSR-off) — Leaflet a besoin
// de `window` et casse au rendu serveur.

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type PropertyMarker = {
  slug: string;
  lat: number;
  lng: number;
  title: string;
  priceLabel: string;
  dealLabel: string;
  href: string;
};

// Dubaï par défaut (WGS84).
const DEFAULT_CENTER: [number, number] = [25.2048, 55.2708];
const DEFAULT_ZOOM = 10;

// Pin doré en divIcon → évite le bug d'icône par défaut de Leaflet avec les
// bundlers, et colle au thème.
const goldPin = L.divIcon({
  className: "re-map-pin",
  html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#B8924F;border:2px solid #1A1610;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 18],
  popupAnchor: [0, -16],
});

function FitBounds({ markers }: { markers: PropertyMarker[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [markers, map]);
  return null;
}

export function PropertyMapView({
  markers,
  height = 560,
}: {
  markers: PropertyMarker[];
  height?: number;
}) {
  return (
    <div style={{ width: "100%", height, borderRadius: "var(--r-md, 12px)", overflow: "hidden", border: "1px solid var(--line-soft)" }}>
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds markers={markers} />
        {markers.map((m) => (
          <Marker key={m.slug} position={[m.lat, m.lng]} icon={goldPin}>
            <Popup>
              <a href={m.href} style={{ textDecoration: "none", color: "#111827" }}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{m.title}</div>
                <div style={{ color: "#B8924F", fontWeight: 600 }}>{m.priceLabel}</div>
                <div style={{ color: "#6B7280", fontSize: 12, marginTop: 2 }}>{m.dealLabel}</div>
              </a>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
