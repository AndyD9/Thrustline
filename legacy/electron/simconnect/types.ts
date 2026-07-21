export interface SimData {
  latitude: number
  longitude: number
  altitude: number          // feet
  groundSpeed: number       // knots
  verticalSpeed: number     // feet per minute
  fuelQuantity: number      // gallons
  simOnGround: boolean
  groundTrack: number       // degrees
  heading: number           // degrees
  timestamp: number         // Date.now()
  /** ICAO type code of the current aircraft (e.g. "B738", "A20N") — empty string if unknown */
  aircraftIcaoType: string
}

export type FlightState = 'idle' | 'airborne' | 'landed'

export interface FlightRecord {
  departureIcao: string
  arrivalIcao: string
  departureLat: number
  departureLon: number
  arrivalLat: number
  arrivalLon: number
  durationMin: number
  fuelUsedGal: number
  distanceNm: number
  landingVsFpm: number
}

export interface SimVar {
  name: string
  unit: string
}
