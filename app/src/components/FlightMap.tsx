import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Airport } from "@/data/airports";

interface FlightMapProps {
  origin?: Airport;
  destination?: Airport;
  waypoints?: [number, number][];
  aircraft?: { lat: number; lon: number; heading: number };
  height?: string;
  interactive?: boolean;
}

const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION = '&copy; <a href="https://carto.com/">CARTO</a>';

// Cyan airport marker
function airportIcon() {
  return L.divIcon({
    className: "",
    html: `<div style="width:10px;height:10px;border-radius:50%;background:oklch(0.58 0.18 195);box-shadow:0 0 6px oklch(0.58 0.18 195 / 0.5);border:2px solid rgba(255,255,255,0.3)"></div>`,
    iconSize: [10, 10],
    iconAnchor: [5, 5],
  });
}

// Aircraft marker (rotated plane SVG)
function aircraftIcon(heading: number) {
  return L.divIcon({
    className: "",
    html: `<div style="transform:rotate(${heading}deg);width:24px;height:24px;display:flex;align-items:center;justify-content:center">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="oklch(0.58 0.18 195)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>
      </svg>
    </div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

// Auto-fit bounds when origin/dest change
function FitBounds({
  origin,
  destination,
  aircraft,
}: {
  origin?: Airport;
  destination?: Airport;
  aircraft?: { lat: number; lon: number };
}) {
  const map = useMap();
  const prevBoundsKey = useRef("");

  useEffect(() => {
    const points: [number, number][] = [];
    if (origin) points.push([origin.lat, origin.lon]);
    if (destination) points.push([destination.lat, destination.lon]);
    if (aircraft && !origin && !destination) points.push([aircraft.lat, aircraft.lon]);

    const key = points.map((p) => `${p[0]},${p[1]}`).join("|");
    if (key === prevBoundsKey.current || points.length === 0) return;
    prevBoundsKey.current = key;

    if (points.length === 1) {
      map.setView(points[0], 6, { animate: true });
    } else {
      map.fitBounds(L.latLngBounds(points.map((p) => L.latLng(p[0], p[1]))), {
        padding: [40, 40],
        animate: true,
        maxZoom: 8,
      });
    }
  }, [origin, destination, aircraft, map]);

  return null;
}

// Update aircraft marker position smoothly
function AircraftMarker({ lat, lon, heading }: { lat: number; lon: number; heading: number }) {
  const icon = useMemo(() => aircraftIcon(heading), [heading]);
  return <Marker position={[lat, lon]} icon={icon} />;
}

export default function FlightMap({
  origin,
  destination,
  waypoints,
  aircraft,
  height = "300px",
  interactive = true,
}: FlightMapProps) {
  const apIcon = useMemo(() => airportIcon(), []);

  // Build route line
  const routePoints: [number, number][] = [];
  if (origin) routePoints.push([origin.lat, origin.lon]);
  if (waypoints) routePoints.push(...waypoints);
  if (destination) routePoints.push([destination.lat, destination.lon]);

  const center: [number, number] = origin
    ? [origin.lat, origin.lon]
    : aircraft
      ? [aircraft.lat, aircraft.lon]
      : [30, 0];

  return (
    <div className="relative z-0 overflow-hidden rounded-xl border border-white/[0.06]" style={{ height }}>
      <MapContainer
        center={center}
        zoom={4}
        style={{ height: "100%", width: "100%", background: "#0a0f18" }}
        zoomControl={interactive}
        dragging={interactive}
        scrollWheelZoom={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        attributionControl={false}
      >
        <TileLayer url={DARK_TILES} attribution={ATTRIBUTION} />
        <FitBounds origin={origin} destination={destination} aircraft={aircraft} />

        {/* Route polyline */}
        {routePoints.length >= 2 && (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: "oklch(0.58 0.18 195)", weight: 2, opacity: 0.6, dashArray: "6 4" }}
          />
        )}

        {/* Airport markers */}
        {origin && (
          <Marker position={[origin.lat, origin.lon]} icon={apIcon}>
            <Tooltip direction="top" offset={[0, -8]} permanent className="airport-tooltip">
              {origin.icao}
            </Tooltip>
          </Marker>
        )}
        {destination && (
          <Marker position={[destination.lat, destination.lon]} icon={apIcon}>
            <Tooltip direction="top" offset={[0, -8]} permanent className="airport-tooltip">
              {destination.icao}
            </Tooltip>
          </Marker>
        )}

        {/* Aircraft marker */}
        {aircraft && <AircraftMarker lat={aircraft.lat} lon={aircraft.lon} heading={aircraft.heading} />}
      </MapContainer>
    </div>
  );
}
