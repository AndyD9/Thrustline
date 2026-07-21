import type { SimData, FlightRecord, FlightState } from './types'
import { findNearestAirport } from '../../src/data/airports'

interface FlightCallbacks {
  onTakeoff: (departureIcao: string) => void
  onLanding: (record: FlightRecord) => void
}

interface FlightDetector {
  update: (data: SimData) => void
  getState: () => FlightState
}

/** Haversine distance in nautical miles */
function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065 // Earth radius in nm
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export function createFlightDetector(callbacks: FlightCallbacks): FlightDetector {
  let state: FlightState = 'idle'
  let prevOnGround: boolean | null = null
  let prevVerticalSpeed = 0

  // Takeoff snapshot
  let fuelAtDeparture = 0
  let departureTime = 0
  let departureLat = 0
  let departureLon = 0

  // Debounce: ignore transitions for 5s after landing
  let landingLockUntil = 0

  function update(data: SimData): void {
    const now = Date.now()

    // Skip if in debounce window
    if (now < landingLockUntil) {
      prevOnGround = data.simOnGround
      prevVerticalSpeed = data.verticalSpeed
      return
    }

    // Detect transitions
    if (prevOnGround !== null) {
      // Takeoff: was on ground → now airborne
      if (prevOnGround && !data.simOnGround) {
        state = 'airborne'
        fuelAtDeparture = data.fuelQuantity
        departureTime = now
        departureLat = data.latitude
        departureLon = data.longitude
        const depApt = findNearestAirport(departureLat, departureLon)
        callbacks.onTakeoff(depApt?.icao ?? '')
      }

      // Landing: was airborne → now on ground
      if (!prevOnGround && data.simOnGround && state === 'airborne') {
        state = 'landed'
        landingLockUntil = now + 5000

        const durationMin = Math.round((now - departureTime) / 60_000)
        const fuelUsedGal = Math.max(0, fuelAtDeparture - data.fuelQuantity)
        const distanceNm = haversineNm(departureLat, departureLon, data.latitude, data.longitude)

        // Use previous tick's VS — current tick may already read 0
        const landingVsFpm = prevVerticalSpeed

        const depApt = findNearestAirport(departureLat, departureLon)
        const arrApt = findNearestAirport(data.latitude, data.longitude)

        const record: FlightRecord = {
          departureIcao: depApt?.icao ?? 'UNKN',
          arrivalIcao:   arrApt?.icao ?? 'UNKN',
          departureLat,
          departureLon,
          arrivalLat: data.latitude,
          arrivalLon: data.longitude,
          durationMin: Math.max(1, durationMin),
          fuelUsedGal: Math.round(fuelUsedGal * 100) / 100,
          distanceNm: Math.round(distanceNm * 10) / 10,
          landingVsFpm: Math.round(landingVsFpm),
        }

        callbacks.onLanding(record)

        // Reset to idle after debounce
        setTimeout(() => {
          state = 'idle'
        }, 5000)
      }
    }

    prevOnGround = data.simOnGround
    prevVerticalSpeed = data.verticalSpeed
  }

  return {
    update,
    getState: () => state,
  }
}
