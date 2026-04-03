import type { Company, FlightRecord, Transaction, Aircraft, CatalogEntry, DiscoveredRoute, SavedRoute, Dispatch, SimbriefOFPSummary, CrewMember, CrewCandidate, RouteReputation, GameEvent, Loan, LoanOption } from '../types/thrustline'
import type { AirportInfo } from '../data/airports'

const BASE = 'http://localhost:3000/api'

async function getAuthToken(): Promise<string | null> {
  try {
    const session = await window.thrustline.getSession()
    return session?.access_token ?? null
  } catch {
    return null
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const hasBody = options?.body !== undefined && options.body !== null
  const token = await getAuthToken()
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(await res.text())
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string) => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  // Airport lookup (static DB first, then server-side API fallback)
  lookupAirport: (icao: string) => request<AirportInfo>(`/airport/${icao.toUpperCase()}`),

  // Typed shortcuts
  flights:      (limit = 50)  => request<FlightRecord[]>(`/flights?limit=${limit}`),
  company:      ()            => request<Company>('/company'),
  fleet:        ()            => request<Aircraft[]>('/fleet'),
  transactions: (limit = 100) => request<Transaction[]>(`/transactions?limit=${limit}`),
  catalog:      ()            => request<CatalogEntry[]>('/catalog'),

  // Dispatch
  dispatches:      () => request<Dispatch[]>('/dispatches'),
  createDispatch:  (body: { originIcao: string; destIcao: string; distanceNm: number; aircraftId?: string }) =>
    request<Dispatch>('/dispatches', { method: 'POST', body: JSON.stringify(body) }),
  deleteDispatch:  (id: string) => request<void>(`/dispatches/${id}`, { method: 'DELETE' }),
  simbriefUrl:     (id: string) => request<{ url: string }>(`/dispatches/${id}/simbrief-url`),
  fetchOfp:           (id: string) => request<SimbriefOFPSummary>(`/dispatches/${id}/fetch-ofp`, { method: 'POST' }),
  setDispatchStatus:  (id: string, status: string) =>
    request<Dispatch>(`/dispatches/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),

  // Onboarding
  loanOptions:      ()  => request<LoanOption[]>('/company/loan-options'),
  setupCompany:     (data: { name: string; airlineCode: string; hubIcao: string; loanOption: string; aircraftIcaoType?: string; aircraftMode?: 'lease' | 'buy'; simbriefUsername?: string }) =>
    request<Company>('/company/setup', { method: 'POST', body: JSON.stringify(data) }),
  loan:             ()  => request<Loan | null>('/company/loan'),

  // Company settings
  updateCompany:    (data: { name?: string; hubIcao?: string; airlineCode?: string; simbriefUsername?: string }) =>
    request<Company>('/company', { method: 'PATCH', body: JSON.stringify(data) }),
  resetCompany:     () => request<void>('/company/reset', { method: 'POST' }),
  activateAircraft: (id: string) => request<void>(`/fleet/${id}/activate`, { method: 'PATCH' }),

  // Routes
  discoveredRoutes: ()                                       => request<DiscoveredRoute[]>('/routes/discovered'),
  savedRoutes:      ()                                       => request<SavedRoute[]>('/routes'),
  saveRoute:        (originIcao: string, destIcao: string)   => request<SavedRoute>('/routes', { method: 'POST', body: JSON.stringify({ originIcao, destIcao }) }),
  deleteRoute:      (id: string)                             => request<void>(`/routes/${id}`, { method: 'DELETE' }),

  // Events
  activeEvents:     ()  => request<GameEvent[]>('/events'),
  eventHistory:     (limit = 20) => request<GameEvent[]>(`/events/history?limit=${limit}`),

  // Reputation
  reputations:      ()  => request<RouteReputation[]>('/reputation'),
  reputationScore:  ()  => request<{ score: number }>('/reputation/score'),

  // Crew
  crew:         ()                   => request<CrewMember[]>('/crew'),
  crewPool:     ()                   => request<CrewCandidate[]>('/crew/pool'),
  hireCrew:     (candidate: CrewCandidate) => request<CrewMember>('/crew/hire', { method: 'POST', body: JSON.stringify(candidate) }),
  fireCrew:     (id: string)         => request<void>(`/crew/${id}`, { method: 'DELETE' }),
  assignCrew:   (id: string, aircraftId: string) => request<CrewMember>(`/crew/${id}/assign`, { method: 'PATCH', body: JSON.stringify({ aircraftId }) }),
  unassignCrew: (id: string)         => request<CrewMember>(`/crew/${id}/unassign`, { method: 'PATCH' }),

  // Fleet actions
  leaseAircraft:    (icaoType: string)   => request<Aircraft>('/fleet', { method: 'POST', body: JSON.stringify({ icaoType }) }),
  buyAircraft:      (icaoType: string)   => request<Aircraft>('/fleet/buy', { method: 'POST', body: JSON.stringify({ icaoType }) }),
  sellAircraft:     (id: string)         => request<{ salePrice: number; aircraftName: string }>(`/fleet/${id}/sell`, { method: 'POST' }),
  resaleValue:      (id: string)         => request<{ resaleValue: number; healthPct: number }>(`/fleet/${id}/resale-value`),
  maintainAircraft: (id: string)         => request<{ cost: number; newHealth: number }>(`/fleet/${id}/maintain`, { method: 'POST' }),
  maintainCost:     (id: string)         => request<{ cost: number; healthPct: number }>(`/fleet/${id}/maintain-cost`),
}
