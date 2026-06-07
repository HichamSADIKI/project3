"use client";

// Implémentation Leaflet de la carte real estate. NE PAS importer directement
// depuis un écran : passer par `re-map.tsx` (wrapper dynamique SSR-off), car
// Leaflet a besoin de `window` et casse au rendu serveur.

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string;
  badge?: string;
};

// Dubai par défaut (chiffres latins, WGS84).
const DEFAULT_CENTER: [number, number] = [25.2048, 55.2708];
const DEFAULT_ZOOM = 10;

// Marqueur « pin » or maison, en divIcon → évite le bug d'icône par défaut de
// Leaflet avec les bundlers (URLs cassées) et colle au thème.
const goldPin = L.divIcon({
  className: "re-map-pin",
  html: '<div style="width:18px;height:18px;border-radius:50% 50% 50% 0;background:#D4A037;border:2px solid #1A1610;transform:rotate(-45deg);box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 18],
  popupAnchor: [0, -16],
});

function FitBounds({ markers }: { markers: MapMarker[] }) {
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

export function ReMapView({
  markers,
  height = 520,
  emptyLabel,
}: {
  markers: MapMarker[];
  height?: number;
  emptyLabel?: string;
}) {
  return (
    <div style={{ position: "relative", width: "100%", height, borderRadius: "var(--r)", overflow: "hidden", border: "1px solid var(--line-soft)" }}>
      {markers.length === 0 && emptyLabel && (
        <div style={{ position: "absolute", insetInlineStart: 12, insetBlockStart: 12, zIndex: 1000, background: "var(--bg-paper)", color: "var(--ink-4)", fontSize: 12.5, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--line-soft)" }}>
          {emptyLabel}
        </div>
      )}
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ width: "100%", height: "100%" }} scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds markers={markers} />
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={goldPin}>
            <Popup>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{m.title}</div>
              {m.subtitle && <div style={{ color: "#666", fontSize: 12 }}>{m.subtitle}</div>}
              {m.badge && <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600 }}>{m.badge}</div>}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
