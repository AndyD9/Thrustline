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
  /** Aircraft trail — solid line showing the flown path */
  trail?: [number, number][];
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

// Aircraft marker — simple triangle pointing up (north=0°), rotated by heading
function aircraftIcon(heading: number) {
  return L.divIcon({
    className: "",
    html: `<div style="transform:rotate(${heading}deg);width:28px;height:28px;display:flex;align-items:center;justify-content:center">
      <svg viewBox="0 0 24 24" width="24" height="24" fill="#00b4d8" stroke="#00b4d8" stroke-width="0.5">
        <path d="M12 2 L16 20 L12 16 L8 20 Z"/>
      </svg>
    </div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
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
  trail,
  aircraft,
  height = "300px",
  interactive = true,
}: FlightMapProps) {
  const apIcon = useMemo(() => airportIcon(), []);

  // Build planned route line
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

        {/* Planned route polyline (dashed) */}
        {routePoints.length >= 2 && (
          <Polyline
            positions={routePoints}
            pathOptions={{ color: "#00b4d8", weight: 2, opacity: 0.4, dashArray: "6 4" }}
          />
        )}

        {/* Flown trail (solid) */}
        {trail && trail.length >= 2 && (
          <Polyline
            positions={trail}
            pathOptions={{ color: "#00b4d8", weight: 3, opacity: 0.9 }}
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
