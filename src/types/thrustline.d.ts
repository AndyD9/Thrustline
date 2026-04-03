// ── SimConnect ────────────────────────────────────────────────────────────

export interface SimData {
  latitude: number
  longitude: number
  altitude: number
  groundSpeed: number
  verticalSpeed: number
  fuelQuantity: number
  simOnGround: boolean
  groundTrack: number
  heading: number
  timestamp: number
}

// ── Domain models ─────────────────────────────────────────────────────────

export interface Aircraft {
  id: string
  name: string
  icaoType: string
  healthPct: number
  leaseCostMo: number
  totalHours: number
  cycles: number
  ownership: 'leased' | 'owned'
  purchasePrice: number | null
  purchasedAt: string | null
  companyId: string
  _count?: { flights: number }
}

export interface FlightRecord {
  id: string
  departureIcao: string
  arrivalIcao: string
  durationMin: number
  fuelUsedGal: number
  distanceNm: number
  landingVsFpm: number
  revenue: number
  fuelCost: number
  landingFee: number
  netResult: number
  createdAt: string
  aircraft?: Pick<Aircraft, 'name' | 'icaoType'> | null
}

export interface Transaction {
  id: string
  type: 'revenue' | 'fuel' | 'landing_fee' | 'lease' | 'maintenance'
  amount: number
  description: string
  flightId: string | null
  companyId: string
  createdAt: string
}

export interface Company {
  id: string
  name: string
  capital: number
  hubIcao: string | null
  activeAircraftId: string | null
  airlineCode: string
  simbriefUsername: string | null
  onboarded: boolean
  createdAt: string
  fleet: Aircraft[]
  _count: { flights: number }
}

export interface Loan {
  id: string
  principal: number
  monthlyPayment: number
  remainingAmount: number
  totalMonths: number
  paidMonths: number
  interestRate: number
  companyId: string
  createdAt: string
}

export interface LoanOption {
  key: string
  label: string
  principal: number
  totalMonths: number
  rate: number
  monthlyPayment: number
}

export interface Dispatch {
  id: string
  flightNumber: string
  originIcao: string
  destIcao: string
  icaoType: string
  distanceNm: number
  ecoPax: number
  bizPax: number
  cargoKg: number
  estimFuelLbs: number
  cruiseAlt: number
  status: 'pending' | 'dispatched' | 'flying' | 'completed'
  ofpData: string | null   // JSON string → parse to SimbriefOFPSummary
  flightId: string | null
  aircraftId: string | null
  companyId: string
  createdAt: string
}

export interface SimbriefOFPSummary {
  origin: string
  destination: string
  aircraft: string
  flightNumber: string
  route: string
  fuelPlanLbs: number
  paxCount: number
  cargoLbs: number
  flightTime: string
  cruiseAlt: string
  generatedAt: number
}

// ── Routes ────────────────────────────────────────────────────────────────

export interface DiscoveredRoute {
  departureIcao: string
  arrivalIcao: string
  flightCount: number
  totalRevenue: number
  totalNet: number
  avgNet: number
  avgVsFpm: number
  avgDistanceNm: number
  worstVsFpm: number
}

export interface SavedRoute {
  id: string
  originIcao: string
  destIcao: string
  distanceNm: number
  basePrice: number
  active: boolean
  companyId: string
}

// ── Events ───────────────────────────────────────────────────────────

export interface GameEvent {
  id: string
  type: string
  scope: 'global' | 'route' | 'aircraft'
  targetId: string | null
  title: string
  description: string
  modifier: number
  startsAt: string
  expiresAt: string
  companyId: string
}

// ── Reputation ───────────────────────────────────────────────────────

export interface RouteReputation {
  id: string
  originIcao: string
  destIcao: string
  score: number
  flightCount: number
  companyId: string
}

// ── Crew ─────────────────────────────────────────────────────────────

export interface CrewMember {
  id: string
  firstName: string
  lastName: string
  rank: 'captain' | 'first_officer'
  experience: number
  salaryMo: number
  dutyHours: number
  maxDutyH: number
  status: 'available' | 'flying' | 'resting'
  aircraftId: string | null
  aircraft: { id: string; name: string; icaoType: string } | null
  companyId: string
  hiredAt: string
}

export interface CrewCandidate {
  firstName: string
  lastName: string
  rank: 'captain' | 'first_officer'
  experience: number
  salaryMo: number
}

// ── Catalog ───────────────────────────────────────────────────────────────

export interface CatalogEntry {
  name: string
  icaoType: string
  category: 'regional' | 'narrowbody' | 'widebody'
  leaseCostMo: number
  purchasePrice: number
  seatsEco: number
  seatsBiz: number
  rangeNm: number
  cruiseKtas: number
  fuelBurnGalH: number
  fuelLbsPerNm: number
  mtowLbs: number
}

// ── Preload API ───────────────────────────────────────────────────────────

interface ThrustlineAPI {
  onSimData: (callback: (data: SimData) => void) => void
  offAll: () => void
  onSimStatus: (callback: (status: string) => void) => void
  onFlightStarted: (callback: () => void) => void
  onFlightEnded: (callback: (record: FlightRecord) => void) => void
  onLeaseDeducted:    (callback: () => void) => void
  onAircraftChanged:  (callback: (aircraft: Aircraft) => void) => void
  onDispatchUpdated:  (callback: () => void) => void
  onSalaryDeducted:   (callback: () => void) => void
  onEventNew:         (callback: (event: GameEvent) => void) => void
  onEventExpired:     (callback: () => void) => void
  onLoanPayment:      (callback: () => void) => void
  getFlights:         (limit?: number) => Promise<FlightRecord[]>
  getSimStatus:       () => Promise<string>
  exportFlights:      () => Promise<string | false>
  exportTransactions: () => Promise<string | false>
  openExternal:       (url: string) => Promise<void>
}

declare global {
  interface Window {
    thrustline: ThrustlineAPI
  }
}
