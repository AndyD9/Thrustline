import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Tooltip,
  CircleMarker,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Airport } from "@/data/airports";

/** A historical route arc to display on the map */
export interface RouteArc {
  from: [number, number]; // [lat, lon]
  to: [number, number];
  fromIcao?: string;
  toIcao?: string;
}

interface FlightMapProps {
  origin?: Airport;
  destination?: Airport;
  waypoints?: [number, number][];
  /** Aircraft trail — solid line showing the flown path */
  trail?: [number, number][];
  /** Historical flight route arcs */
  routes?: RouteArc[];
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
    html: `<div style="width:10px;height:10px;border-radius:50%;background:#00b4d8;box-shadow:0 0 6px rgba(0,180,216,0.5);border:2px solid rgba(255,255,255,0.3)"></div>`,
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

/** Generate a curved arc (quadratic bezier) between two points */
function bezierArc(from: [number, number], to: [number, number], segments = 30): [number, number][] {
  const [lat1, lon1] = from;
  const [lat2, lon2] = to;
  const midLat = (lat1 + lat2) / 2;
  const midLon = (lon1 + lon2) / 2;

  // Offset the control point perpendicular to the line
  const dLat = lat2 - lat1;
  const dLon = lon2 - lon1;
  const dist = Math.sqrt(dLat * dLat + dLon * dLon);
  const offset = dist * 0.2; // 20% of distance as curve offset

  // Perpendicular direction (rotate 90°)
  const cpLat = midLat + (-dLon / dist) * offset;
  const cpLon = midLon + (dLat / dist) * offset;

  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    // Quadratic bezier: B(t) = (1-t)²P0 + 2(1-t)tP1 + t²P2
    const lat = u * u * lat1 + 2 * u * t * cpLat + t * t * lat2;
    const lon = u * u * lon1 + 2 * u * t * cpLon + t * t * lon2;
    points.push([lat, lon]);
  }
  return points;
}

// Auto-fit bounds
function FitBounds({
  origin,
  destination,
  aircraft,
  routes,
}: {
  origin?: Airport;
  destination?: Airport;
  aircraft?: { lat: number; lon: number };
  routes?: RouteArc[];
}) {
  const map = useMap();
  const prevBoundsKey = useRef("");

  useEffect(() => {
    const points: [number, number][] = [];
    if (origin) points.push([origin.lat, origin.lon]);
    if (destination) points.push([destination.lat, destination.lon]);
    if (aircraft && !origin && !destination && (!routes || routes.length === 0))
      points.push([aircraft.lat, aircraft.lon]);
    if (routes) {
      for (const r of routes) {
        points.push(r.from, r.to);
      }
    }

    const key = points.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join("|");
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
  }, [origin, destination, aircraft, routes, map]);

  return null;
}

function AircraftMarker({ lat, lon, heading }: { lat: number; lon: number; heading: number }) {
  const icon = useMemo(() => aircraftIcon(heading), [heading]);
  return <Marker position={[lat, lon]} icon={icon} />;
}

export default function FlightMap({
  origin,
  destination,
  waypoints,
  trail,
  routes,
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

  // Precompute bezier arcs for route history
  const arcs = useMemo(() => {
    if (!routes) return [];
    return routes.map((r) => ({
      ...r,
      points: bezierArc(r.from, r.to),
    }));
  }, [routes]);

  // Collect unique airport positions from routes for dot markers
  const routeAirports = useMemo(() => {
    if (!routes) return [];
    const seen = new Set<string>();
    const airports: { pos: [number, number]; icao?: string }[] = [];
    for (const r of routes) {
      const fk = `${r.from[0].toFixed(3)},${r.from[1].toFixed(3)}`;
      const tk = `${r.to[0].toFixed(3)},${r.to[1].toFixed(3)}`;
      if (!seen.has(fk)) { seen.add(fk); airports.push({ pos: r.from, icao: r.fromIcao }); }
      if (!seen.has(tk)) { seen.add(tk); airports.push({ pos: r.to, icao: r.toIcao }); }
    }
    return airports;
  }, [routes]);

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
        <FitBounds origin={origin} destination={destination} aircraft={aircraft} routes={routes} />

        {/* Historical route arcs */}
        {arcs.map((arc, i) => (
          <Polyline
            key={`arc-${i}`}
            positions={arc.points}
            pathOptions={{ color: "#00b4d8", weight: 1.5, opacity: 0.35 }}
          />
        ))}

        {/* Route airport dots */}
        {routeAirports.map((a, i) => (
          <CircleMarker
            key={`ra-${i}`}
            center={a.pos}
            radius={4}
            pathOptions={{ color: "#00b4d8", fillColor: "#00b4d8", fillOpacity: 0.8, weight: 1 }}
          >
            {a.icao && (
              <Tooltip direction="top" offset={[0, -6]} className="airport-tooltip">
                {a.icao}
              </Tooltip>
            )}
          </CircleMarker>
        ))}

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

        {/* Airport markers (single origin/dest) */}
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
