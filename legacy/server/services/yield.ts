/**
 * YieldEngine — calcule le revenu billetterie d'un vol.
 * Inputs : distanceNm, icaoType de l'avion, identifiant de route optionnel.
 */
import { CATALOG_BY_TYPE } from './company'

const DEFAULT_ECO_SEATS = 150
const DEFAULT_BIZ_SEATS = 12

// Prix par siège par nm
const ECO_PRICE_PER_NM = 0.12  // USD
const BIZ_PRICE_PER_NM = 0.35  // USD

export interface YieldResult {
  revenue: number
  loadFactor: number  // 0–1
  ecoSeats: number
  bizSeats: number
  icaoType: string
}

/**
 * @param reputationScore 0–100, default 50 (neutral). Modifies load factor:
 *   score 0 → ×0.85, score 50 → ×1.0, score 100 → ×1.15
 * @param loadFactorBonus additive bonus from events (e.g., tourism boom +0.08)
 */
export function computeYield(distanceNm: number, icaoType: string, reputationScore = 50, loadFactorBonus = 0): YieldResult {
  const cat = CATALOG_BY_TYPE.get(icaoType.toUpperCase())
  const config = cat
    ? { ecoSeats: cat.seatsEco, bizSeats: cat.seatsBiz }
    : { ecoSeats: DEFAULT_ECO_SEATS, bizSeats: DEFAULT_BIZ_SEATS }

  // Reputation modifier: score 50 = ×1.0, score 100 = ×1.15, score 0 = ×0.85
  const reputationModifier = 0.85 + (reputationScore / 100) * 0.30

  // Load factor aléatoire 60–95%, légèrement plus élevé sur les longs courriers
  const minLoad = distanceNm > 2000 ? 0.70 : 0.60
  const baseLF  = minLoad + Math.random() * (0.95 - minLoad)
  const loadFactor = Math.max(0.30, Math.min(0.98, baseLF * reputationModifier + loadFactorBonus))

  const ecoRevenue = config.ecoSeats * loadFactor * ECO_PRICE_PER_NM * distanceNm
  const bizRevenue = config.bizSeats * loadFactor * BIZ_PRICE_PER_NM * distanceNm
  const revenue = Math.round((ecoRevenue + bizRevenue) * 100) / 100

  return {
    revenue,
    loadFactor: Math.round(loadFactor * 1000) / 1000,
    ecoSeats: config.ecoSeats,
    bizSeats: config.bizSeats,
    icaoType,
  }
}
