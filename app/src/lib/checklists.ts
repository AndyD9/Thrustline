/**
 * Generic aircraft checklists for the EFB.
 * Can be expanded per-aircraft type later.
 */

export interface ChecklistItem {
  label: string;
  detail?: string;
}

export interface ChecklistSection {
  title: string;
  items: ChecklistItem[];
}

export const DEFAULT_CHECKLIST: ChecklistSection[] = [
  {
    title: "Pre-Flight",
    items: [
      { label: "Parking brake", detail: "SET" },
      { label: "Battery", detail: "ON" },
      { label: "Fuel quantity", detail: "CHECK" },
      { label: "Avionics", detail: "ON" },
      { label: "Flight plan", detail: "LOADED" },
      { label: "Weather briefing", detail: "CHECK" },
    ],
  },
  {
    title: "Before Taxi",
    items: [
      { label: "Beacon light", detail: "ON" },
      { label: "Flaps", detail: "CHECK" },
      { label: "Instruments", detail: "CHECK" },
      { label: "Altimeter", detail: "SET QNH" },
      { label: "Transponder", detail: "STANDBY" },
    ],
  },
  {
    title: "Before Takeoff",
    items: [
      { label: "Flaps", detail: "TAKEOFF POSITION" },
      { label: "Trim", detail: "SET" },
      { label: "Transponder", detail: "ON" },
      { label: "Landing lights", detail: "ON" },
      { label: "Strobe lights", detail: "ON" },
      { label: "Engines", detail: "CHECK" },
    ],
  },
  {
    title: "Climb",
    items: [
      { label: "Gear", detail: "UP" },
      { label: "Flaps", detail: "UP" },
      { label: "Autopilot", detail: "ENGAGE" },
      { label: "Landing lights", detail: "OFF above 10,000ft" },
    ],
  },
  {
    title: "Cruise",
    items: [
      { label: "Altitude", detail: "CHECK" },
      { label: "Fuel", detail: "MONITOR" },
      { label: "Autopilot", detail: "CHECK" },
      { label: "Seatbelt sign", detail: "AS REQUIRED" },
    ],
  },
  {
    title: "Descent",
    items: [
      { label: "ATIS/Weather", detail: "CHECK" },
      { label: "Altimeter", detail: "SET LOCAL QNH" },
      { label: "Approach briefing", detail: "COMPLETE" },
      { label: "Landing lights", detail: "ON below 10,000ft" },
    ],
  },
  {
    title: "Approach",
    items: [
      { label: "Gear", detail: "DOWN" },
      { label: "Flaps", detail: "APPROACH SETTING" },
      { label: "Speed", detail: "VREF" },
      { label: "Autopilot", detail: "DISENGAGE (if manual)" },
    ],
  },
  {
    title: "After Landing",
    items: [
      { label: "Flaps", detail: "UP" },
      { label: "Transponder", detail: "STANDBY" },
      { label: "Landing lights", detail: "OFF" },
      { label: "Strobe lights", detail: "OFF" },
      { label: "APU", detail: "START (if needed)" },
    ],
  },
];
