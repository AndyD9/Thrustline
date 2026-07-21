import type { SimVar } from './types'

export const SIM_VARS: SimVar[] = [
  { name: 'PLANE LATITUDE', unit: 'degrees' },
  { name: 'PLANE LONGITUDE', unit: 'degrees' },
  { name: 'PLANE ALTITUDE', unit: 'feet' },
  { name: 'GROUND VELOCITY', unit: 'knots' },
  { name: 'VERTICAL SPEED', unit: 'feet per minute' },
  { name: 'FUEL TOTAL QUANTITY', unit: 'gallons' },
  { name: 'SIM ON GROUND', unit: 'bool' },
  { name: 'GPS GROUND TRUE TRACK', unit: 'degrees' },
  { name: 'PLANE HEADING DEGREES TRUE', unit: 'degrees' },
]
