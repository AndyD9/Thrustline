import { createRequire } from 'node:module'
import type { SimData } from './types'

const require = createRequire(import.meta.url)

const IS_WINDOWS = process.platform === 'win32'

type SimCallback = (data: SimData) => void

interface SimBridge {
  stop: () => void
  getStatus: () => 'connected' | 'mock' | 'disconnected'
}

export function startSimConnect(onData: SimCallback): SimBridge {
  if (!IS_WINDOWS) {
    return startMockSimConnect(onData)
  }
  return startRealSimConnect(onData)
}

// ── Mock ──────────────────────────────────────────────────────────────────

function startMockSimConnect(onData: SimCallback): SimBridge {
  // CDG → JFK mock route
  const depLat = 49.0097,  depLon =   2.5479
  const arrLat = 40.6413,  arrLon = -73.7781

  const CYCLE_DURATION = 60_000
  const startTime = Date.now()
  let fuel = 18000

  const interval = setInterval(() => {
    const elapsed  = (Date.now() - startTime) % CYCLE_DURATION
    const progress = elapsed / CYCLE_DURATION

    let altitude: number, groundSpeed: number, verticalSpeed: number
    let onGround: boolean, lat: number, lon: number

    if (progress < 0.1) {
      onGround = true; altitude = 392; groundSpeed = progress * 1500; verticalSpeed = 0
      lat = depLat; lon = depLon
    } else if (progress < 0.3) {
      const p = (progress - 0.1) / 0.2
      onGround = false; altitude = 392 + p * 34608; groundSpeed = 280 + p * 170; verticalSpeed = 2000
      lat = depLat + (arrLat - depLat) * p * 0.3; lon = depLon + (arrLon - depLon) * p * 0.3
    } else if (progress < 0.7) {
      const p = (progress - 0.3) / 0.4
      onGround = false; altitude = 35000; groundSpeed = 450; verticalSpeed = 0
      lat = depLat + (arrLat - depLat) * (0.3 + p * 0.4); lon = depLon + (arrLon - depLon) * (0.3 + p * 0.4)
    } else if (progress < 0.9) {
      const p = (progress - 0.7) / 0.2
      onGround = false; altitude = 35000 - p * 34987; groundSpeed = 450 - p * 300; verticalSpeed = -1800
      lat = depLat + (arrLat - depLat) * (0.7 + p * 0.3); lon = depLon + (arrLon - depLon) * (0.7 + p * 0.3)
    } else {
      onGround = true; altitude = 13; groundSpeed = Math.max(0, (1 - (progress - 0.9) / 0.1) * 150); verticalSpeed = 0
      lat = arrLat; lon = arrLon
    }

    fuel = Math.max(0, fuel - 3)

    // Compute screen-space heading: direction from current position toward destination
    const dx = arrLon - lon
    const dy = arrLat - lat
    const hdg = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360

    onData({
      latitude:         lat  + (Math.random() - 0.5) * 0.0001,
      longitude:        lon  + (Math.random() - 0.5) * 0.0001,
      altitude,
      groundSpeed,
      verticalSpeed,
      fuelQuantity:     fuel,
      simOnGround:      onGround,
      groundTrack:      hdg,
      heading:          hdg,
      timestamp:        Date.now(),
      aircraftIcaoType: 'B738',   // mock always simulates a 737-800
    })
  }, 1000)

  return {
    stop:      () => clearInterval(interval),
    getStatus: () => 'mock',
  }
}

// ── Real (Windows / SimConnect) ───────────────────────────────────────────

function startRealSimConnect(onData: SimCallback): SimBridge {
  let status: 'connected' | 'disconnected' = 'disconnected'
  const intervals: ReturnType<typeof setInterval>[] = []

  // Current aircraft ICAO type — updated every 5 s from ATC MODEL
  let currentIcaoType = ''

  try {
    const { open, Protocol, SimConnectDataType } = require('node-simconnect')

    // Two separate definitions: one for numeric flight data, one for the aircraft type string
    const NUMERIC_DEF = 0, NUMERIC_REQ = 0
    const STRING_DEF  = 1, STRING_REQ  = 1

    open('Thrustline', Protocol.FSX_SP2)
      .then((handle: Record<string, Function>) => {
        status = 'connected'

        // ── Numeric data definition ──────────────────────────────────────
        handle['addToDataDefinition'](NUMERIC_DEF, 'PLANE LATITUDE',               'degrees',          SimConnectDataType.FLOAT64)
        handle['addToDataDefinition'](NUMERIC_DEF, 'PLANE LONGITUDE',              'degrees',          SimConnectDataType.FLOAT64)
        handle['addToDataDefinition'](NUMERIC_DEF, 'PLANE ALTITUDE',               'feet',             SimConnectDataType.FLOAT64)
        handle['addToDataDefinition'](NUMERIC_DEF, 'GROUND VELOCITY',              'knots',            SimConnectDataType.FLOAT64)
        handle['addToDataDefinition'](NUMERIC_DEF, 'VERTICAL SPEED',               'feet per minute',  SimConnectDataType.FLOAT64)
        handle['addToDataDefinition'](NUMERIC_DEF, 'FUEL TOTAL QUANTITY',          'gallons',          SimConnectDataType.FLOAT64)
        handle['addToDataDefinition'](NUMERIC_DEF, 'SIM ON GROUND',                'bool',             SimConnectDataType.INT32)
        handle['addToDataDefinition'](NUMERIC_DEF, 'GPS GROUND TRUE TRACK',        'degrees',          SimConnectDataType.FLOAT64)
        handle['addToDataDefinition'](NUMERIC_DEF, 'PLANE HEADING DEGREES TRUE',   'degrees',          SimConnectDataType.FLOAT64)

        // ── Aircraft type string definition (ATC MODEL = ICAO type code) ─
        // Unit is null/empty for string vars; STRING32 holds up to 32 chars
        handle['addToDataDefinition'](STRING_DEF, 'ATC MODEL', null, SimConnectDataType.STRING32)

        // Request numeric data every second
        intervals.push(setInterval(() => {
          handle['requestDataOnSimObject'](NUMERIC_REQ, NUMERIC_DEF, 0, 0, 0, 0)
        }, 1000))

        // Request aircraft type every 5 seconds (doesn't change often)
        intervals.push(setInterval(() => {
          handle['requestDataOnSimObject'](STRING_REQ, STRING_DEF, 0, 0, 0, 0)
        }, 5000))

        // ── Unified data handler ─────────────────────────────────────────
        handle['on']('simObjectData', (packet: Record<string, unknown>) => {
          const reqId = packet['requestID'] as number | undefined

          // ── String response (aircraft type) ──────────────────────────
          if (reqId === STRING_REQ) {
            try {
              const raw = packet['data'] as Record<string, unknown>
              // node-simconnect v2+ : read from buffer
              const val = typeof raw['readString'] === 'function'
                ? (raw['readString'] as Function)(32)
                : (raw['ATC MODEL'] as string ?? '')
              currentIcaoType = String(val).replace(/\0/g, '').trim().toUpperCase()
            } catch { /* ignore — type stays at last known value */ }
            return
          }

          // ── Numeric response (flight data) ────────────────────────────
          const d = packet['data'] as Record<string, number>
          onData({
            latitude:         d['PLANE LATITUDE'],
            longitude:        d['PLANE LONGITUDE'],
            altitude:         d['PLANE ALTITUDE'],
            groundSpeed:      d['GROUND VELOCITY'],
            verticalSpeed:    d['VERTICAL SPEED'],
            fuelQuantity:     d['FUEL TOTAL QUANTITY'],
            simOnGround:      d['SIM ON GROUND'] === 1,
            groundTrack:      d['GPS GROUND TRUE TRACK'],
            heading:          d['PLANE HEADING DEGREES TRUE'],
            timestamp:        Date.now(),
            aircraftIcaoType: currentIcaoType,
          })
        })

        handle['on']('close', () => { status = 'disconnected' })
      })
      .catch(() => { status = 'disconnected' })
  } catch {
    status = 'disconnected'
  }

  return {
    stop:      () => intervals.forEach(clearInterval),
    getStatus: () => status,
  }
}
