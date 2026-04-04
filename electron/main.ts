import { app, BrowserWindow, ipcMain, Notification, dialog, shell } from 'electron'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

import { createServer } from '../server'
import { startSimConnect } from './simconnect/bridge'
import { getSupabaseClient, setSessionFromTokens } from './supabase'
import { createSyncEngine } from './sync/syncEngine'
import { createFlightDetector } from './simconnect/flightDetector'
import { createFlight } from '../server/services/flights'
import { computeYield } from '../server/services/yield'
import { computeCosts, recordCashflow } from '../server/services/cashflow'
import { computeWear, applyMaintenance } from '../server/services/maintenance'
import { deductMonthlyLeases, deductLoanPayment } from '../server/services/company'
import { deductMonthlySalaries, addDutyHours } from '../server/services/crew'
import { getRouteReputation, updateReputation } from '../server/services/reputation'
import { rollRandomEvent, getActiveEvents, getFuelMultiplier, getRouteLoadBonus, cleanExpiredEvents } from '../server/services/events'
import { findActiveDispatch, linkFlightToDispatch, setDispatchStatus } from '../server/services/dispatch'
import type { PrismaClient } from '../generated/prisma/client/client'
import type { SimData, FlightRecord } from './simconnect/types'

let mainWindow: BrowserWindow | null = null
let currentUserId: string | null = null

// ── Desktop notification helper ───────────────────────────────────────────

function notify(title: string, body: string) {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
}

// ── Get company ID (may not exist yet if onboarding hasn't completed) ────

async function getCompanyId(prisma: PrismaClient): Promise<string | null> {
  const where: Record<string, unknown> = { onboarded: true }
  if (currentUserId) where.userId = currentUserId
  const company = await prisma.company.findFirst({ where })
  return company?.id ?? null
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  // Set DATABASE_URL to a stable location for packaged builds
  const isProd = !process.env.VITE_DEV_SERVER_URL
  if (isProd) {
    const dbPath = path.join(app.getPath('userData'), 'thrustline.db')
    process.env.DATABASE_URL = `file:${dbPath}`
    console.log(`[Thrustline] Database path: ${dbPath}`)
  }

  const { fastify, prisma } = await createServer()

  try {
    await fastify.listen({ port: 3000, host: '127.0.0.1' })
    console.log('[Thrustline] Fastify listening on http://127.0.0.1:3000')
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[Thrustline] Failed to start server:', msg)
    if (msg.includes('EADDRINUSE')) {
      console.error('[Thrustline] Port 3000 already in use — kill with: lsof -ti:3000 | xargs kill -9')
    }
    app.quit()
    return
  }

  // companyId is resolved dynamically — may be null before onboarding
  let companyId: string | null = await getCompanyId(prisma)

  // ── Auto-detect active aircraft from sim ──────────────────────────────────

  let lastDetectedIcaoType = ''

  async function autoSetActiveAircraft(icaoType: string) {
    if (!icaoType || !companyId) return
    try {
      const aircraft = await prisma.aircraft.findFirst({ where: { icaoType, companyId } })
      if (!aircraft) return   // Not in fleet — ignore

      const co = await prisma.company.findFirst({ where: { id: companyId } })
      if (co?.activeAircraftId === aircraft.id) return  // Already set — nothing to do

      await prisma.company.update({
        where: { id: companyId },
        data:  { activeAircraftId: aircraft.id },
      })
      console.log(`[Thrustline] Auto-detected aircraft: ${aircraft.name} (${icaoType})`)
      mainWindow?.webContents.send('aircraft:changed', aircraft)
    } catch (err) {
      console.error('[Thrustline] autoSetActiveAircraft error:', err)
    }
  }

  // ── Window ────────────────────────────────────────────────────────────────

  mainWindow = new BrowserWindow({
    width:  1280,
    height: 800,
    title:  'Thrustline',
    webPreferences: {
      preload: process.env.VITE_DEV_SERVER_URL
        ? path.join(process.cwd(), 'electron', 'preload.cjs')
        : path.join(__dirname, 'preload.cjs'),
      nodeIntegration:  false,
      contextIsolation: true,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // ── Auth IPC handlers ─────────────────────────────────────────────────────

  ipcMain.handle('auth:signUp', async (_event, email: string, password: string) => {
    const sb = getSupabaseClient()
    const { data, error } = await sb.auth.signUp({ email, password })
    if (error) return { error: error.message }
    if (data.user) currentUserId = data.user.id
    return { user: data.user, session: data.session }
  })

  ipcMain.handle('auth:signInEmail', async (_event, email: string, password: string) => {
    const sb = getSupabaseClient()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    if (data.user) currentUserId = data.user.id
    mainWindow?.webContents.send('auth:changed', data.session)
    return { user: data.user, session: data.session }
  })

  ipcMain.handle('auth:signInOAuth', async (_event, provider: 'discord' | 'google') => {
    const sb = getSupabaseClient()
    const { data, error } = await sb.auth.signInWithOAuth({
      provider,
      options: { redirectTo: 'thrustline://auth/callback' },
    })
    if (error) return { error: error.message }

    // Open OAuth URL in a popup BrowserWindow
    if (data.url) {
      const authWindow = new BrowserWindow({
        width: 600, height: 700,
        parent: mainWindow ?? undefined,
        modal: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
      })
      authWindow.loadURL(data.url)

      // Listen for the deep-link redirect
      const handleRedirect = (url: string) => {
        if (!url.startsWith('thrustline://auth/callback')) return
        const hash = url.split('#')[1] || ''
        const params = new URLSearchParams(hash)
        const accessToken = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        if (accessToken && refreshToken) {
          setSessionFromTokens(accessToken, refreshToken)
            .then(async (session) => {
              if (session?.user) currentUserId = session.user.id
              mainWindow?.webContents.send('auth:changed', session)
            })
            .catch(console.error)
        }
        authWindow.close()
      }

      authWindow.webContents.on('will-navigate', (_e, url) => handleRedirect(url))
      authWindow.webContents.on('will-redirect', (_e, url) => handleRedirect(url))
    }

    return { url: data.url }
  })

  ipcMain.handle('auth:signOut', async () => {
    const sb = getSupabaseClient()
    await sb.auth.signOut()
    currentUserId = null
    mainWindow?.webContents.send('auth:changed', null)
    return { ok: true }
  })

  ipcMain.handle('auth:getSession', async () => {
    const sb = getSupabaseClient()
    const { data } = await sb.auth.getSession()
    if (data.session?.user) currentUserId = data.session.user.id
    return data.session
  })

  // Handle OAuth deep-link on macOS
  app.on('open-url', (_event, url) => {
    if (!url.startsWith('thrustline://auth/callback')) return
    const hash = url.split('#')[1] || ''
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (accessToken && refreshToken) {
      setSessionFromTokens(accessToken, refreshToken)
        .then(async (session) => {
          if (session?.user) currentUserId = session.user.id
          mainWindow?.webContents.send('auth:changed', session)
        })
        .catch(console.error)
    }
  })

  // ── processLanding ────────────────────────────────────────────────────────

  async function processLanding(record: FlightRecord) {
    // Resolve companyId dynamically (may have been set during onboarding)
    if (!companyId) companyId = await getCompanyId(prisma)
    if (!companyId) { console.error('[Thrustline] No company — skipping landing'); return }

    // Read active aircraft dynamically — user may have changed it via Fleet page
    const currentCompany  = await prisma.company.findFirst()
    const activeAircraft  = currentCompany?.activeAircraftId
      ? await prisma.aircraft.findUnique({ where: { id: currentCompany.activeAircraftId } })
      : await prisma.aircraft.findFirst()

    const icaoType   = activeAircraft?.icaoType ?? 'B738'
    const aircraftId = activeAircraft?.id

    // 1. Active events → fuel & demand modifiers
    const activeEvents   = await getActiveEvents(prisma, companyId)
    const fuelMultiplier = getFuelMultiplier(activeEvents)
    const loadBonus      = getRouteLoadBonus(activeEvents, record.departureIcao, record.arrivalIcao)

    // 2. Route reputation → influences load factor
    const routeRep = await getRouteReputation(prisma, record.departureIcao, record.arrivalIcao, companyId)

    // 3. Yield (reputation + event adjusted)
    const yieldResult = computeYield(record.distanceNm, icaoType, routeRep.score, loadBonus)

    // 4. Coûts (event-adjusted fuel price)
    const costs = computeCosts(record.fuelUsedGal, record.arrivalIcao, yieldResult.revenue, fuelMultiplier)

    // 3. Vol en DB
    const flight = await createFlight(prisma, {
      departureIcao: record.departureIcao,
      arrivalIcao:   record.arrivalIcao,
      durationMin:   record.durationMin,
      fuelUsedGal:   record.fuelUsedGal,
      distanceNm:    record.distanceNm,
      landingVsFpm:  record.landingVsFpm,
      revenue:       yieldResult.revenue,
      fuelCost:      costs.fuelCost,
      landingFee:    costs.landingFee,
      netResult:     costs.netResult,
      companyId,
      aircraftId:    aircraftId ?? undefined,
    })

    // 4. Cashflow
    await recordCashflow({
      prisma,
      companyId,
      flightId:   flight.id,
      revenue:    yieldResult.revenue,
      fuelCost:   costs.fuelCost,
      landingFee: costs.landingFee,
      netResult:  costs.netResult,
    })

    // 5. Maintenance
    let isHardLanding = false
    let grounded      = false
    let healthAfter: number | null = null

    if (aircraftId) {
      const currentAircraft = await prisma.aircraft.findUnique({ where: { id: aircraftId } })
      if (currentAircraft) {
        const wearResult = computeWear(
          currentAircraft.healthPct,
          record.durationMin,
          record.landingVsFpm,
        )

        await applyMaintenance({ prisma, aircraftId, companyId, flightId: flight.id, result: wearResult })

        await prisma.aircraft.update({
          where: { id: aircraftId },
          data: {
            totalHours: { increment: record.durationMin / 60 },
            cycles:     { increment: 1 },
          },
        })

        // 5b. Add duty hours to assigned crew
        await addDutyHours(prisma, aircraftId, record.durationMin / 60)

        isHardLanding = wearResult.isHardLanding
        grounded      = wearResult.grounded
        healthAfter   = wearResult.newHealthPct

        if (isHardLanding) console.log(`[Thrustline] Hard landing! VS=${record.landingVsFpm} fpm — health ${healthAfter}%`)
        if (grounded)      console.log('[Thrustline] Aircraft grounded — heavy maintenance required')
      }
    }

    // 6. Update reputation for this route
    const avgFleetHealth = await prisma.aircraft.aggregate({
      where: { companyId },
      _avg: { healthPct: true },
    })
    await updateReputation(prisma, record.departureIcao, record.arrivalIcao, companyId, {
      landingVsFpm:   record.landingVsFpm,
      loadFactor:     yieldResult.loadFactor,
      avgFleetHealth: avgFleetHealth._avg.healthPct ?? 100,
    })

    // 7. Desktop notification
    const netStr = costs.netResult >= 0
      ? `+$${Math.round(costs.netResult).toLocaleString()}`
      : `-$${Math.abs(Math.round(costs.netResult)).toLocaleString()}`

    if (grounded) {
      notify('🔴 Aircraft Grounded', `${activeAircraft?.name ?? 'Aircraft'} requires heavy maintenance — ${healthAfter?.toFixed(1)}% health`)
    } else if (isHardLanding) {
      notify('⚠️ Hard Landing', `${record.departureIcao}→${record.arrivalIcao} — VS ${record.landingVsFpm} fpm — health ${healthAfter?.toFixed(1)}%`)
    } else {
      notify('✈️ Flight Complete', `${record.departureIcao} → ${record.arrivalIcao} — net ${netStr}`)
    }

    console.log(
      `[Thrustline] Flight ${flight.id} | ${record.departureIcao}→${record.arrivalIcao} | ` +
      `rev $${yieldResult.revenue} | fuel $${costs.fuelCost} | net $${costs.netResult}`,
    )

    // Auto-link to matching dispatch if one exists
    const activeDispatch = await findActiveDispatch(prisma, record.departureIcao, record.arrivalIcao)
    if (activeDispatch) {
      await linkFlightToDispatch(prisma, activeDispatch.id, flight.id)
      console.log(`[Thrustline] Dispatch ${activeDispatch.flightNumber} completed → linked to flight ${flight.id}`)
      mainWindow?.webContents.send('dispatch:updated')
    }

    mainWindow?.webContents.send('flight:ended', { ...record, ...flight })
  }

  // ── SimConnect ────────────────────────────────────────────────────────────

  const detector = createFlightDetector({
    onTakeoff: (departureIcao: string) => {
      console.log(`[Thrustline] Takeoff detected from ${departureIcao || 'unknown'}`)
      mainWindow?.webContents.send('flight:started')

      // Auto-mark matching dispatch as "flying" if origin matches
      if (departureIcao) {
        prisma.dispatch.findFirst({
          where: { originIcao: departureIcao, status: { in: ['pending', 'dispatched'] } },
          orderBy: { createdAt: 'desc' },
        })
          .then(async (dispatch) => {
            if (!dispatch) return
            await prisma.dispatch.update({ where: { id: dispatch.id }, data: { status: 'flying' } })
            console.log(`[Thrustline] Dispatch ${dispatch.flightNumber} → flying`)
            mainWindow?.webContents.send('dispatch:updated')
          })
          .catch(console.error)
      }
    },
    onLanding: (record: FlightRecord) => {
      console.log('[Thrustline] Landing detected', record)
      processLanding(record).catch((err) =>
        console.error('[Thrustline] Error in processLanding:', err),
      )
    },
  })

  const simBridge = startSimConnect((data: SimData) => {
    mainWindow?.webContents.send('sim:data', data)
    detector.update(data)

    // Auto-detect aircraft type when it changes
    if (data.aircraftIcaoType && data.aircraftIcaoType !== lastDetectedIcaoType) {
      lastDetectedIcaoType = data.aircraftIcaoType
      autoSetActiveAircraft(data.aircraftIcaoType).catch(console.error)
    }
  })

  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('sim:status', simBridge.getStatus())
  })

  // ── IPC handlers ──────────────────────────────────────────────────────────

  ipcMain.handle('sim:getStatus', () => simBridge.getStatus())

  ipcMain.handle('shell:openExternal', (_event, url: string) => {
    // Only allow https URLs to SimBrief and known services
    if (/^https:\/\//.test(url)) shell.openExternal(url)
  })

  ipcMain.handle('flights:getAll', async (_event, limit?: number) =>
    prisma.flight.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit ?? 50,
      include: { aircraft: true },
    }),
  )

  // Export flights → CSV
  ipcMain.handle('export:flights', async () => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title:       'Export flights to CSV',
      defaultPath: 'thrustline-flights.csv',
      filters:     [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (canceled || !filePath) return false

    const flights = await prisma.flight.findMany({
      orderBy: { createdAt: 'desc' },
      include: { aircraft: true },
    })
    const header = 'Date,Departure,Arrival,Aircraft,Distance (nm),Duration (min),Fuel (gal),VS (fpm),Revenue ($),Fuel Cost ($),Landing Fee ($),Net ($)'
    const rows   = flights.map((f) => [
      f.createdAt.toISOString(),
      f.departureIcao,
      f.arrivalIcao,
      f.aircraft?.icaoType ?? '',
      f.distanceNm.toFixed(0),
      f.durationMin,
      f.fuelUsedGal.toFixed(0),
      f.landingVsFpm.toFixed(0),
      f.revenue.toFixed(0),
      f.fuelCost.toFixed(0),
      f.landingFee.toFixed(0),
      f.netResult.toFixed(0),
    ].join(','))
    fs.writeFileSync(filePath, [header, ...rows].join('\n'), 'utf8')
    return filePath
  })

  // Export transactions → CSV
  ipcMain.handle('export:transactions', async () => {
    const { filePath, canceled } = await dialog.showSaveDialog({
      title:       'Export transactions to CSV',
      defaultPath: 'thrustline-transactions.csv',
      filters:     [{ name: 'CSV', extensions: ['csv'] }],
    })
    if (canceled || !filePath) return false

    const txs  = await prisma.transaction.findMany({ orderBy: { createdAt: 'desc' } })
    const header = 'Date,Type,Description,Amount ($)'
    const rows   = txs.map((t) => [
      t.createdAt.toISOString(),
      t.type,
      `"${t.description.replace(/"/g, '""')}"`,
      t.amount.toFixed(0),
    ].join(','))
    fs.writeFileSync(filePath, [header, ...rows].join('\n'), 'utf8')
    return filePath
  })

  // ── Monthly lease deduction ───────────────────────────────────────────────

  const LEASE_INTERVAL_MS = 30_000
  const leaseInterval = setInterval(async () => {
    try {
      if (!companyId) companyId = await getCompanyId(prisma)
      if (!companyId) return  // Not onboarded yet

      const co = await prisma.company.findFirst({ include: { fleet: true, crew: true } })
      if (!co) return

      // Leases
      const leased = co.fleet.filter((a) => a.ownership === 'leased')
      if (leased.length > 0) {
        const totalLease = leased.reduce((s, a) => s + a.leaseCostMo, 0)
        await deductMonthlyLeases(prisma)
        notify('💳 Monthly Leases', `-$${totalLease.toLocaleString()} for ${leased.length} aircraft`)
      }

      // Salaries
      if (co.crew.length > 0) {
        const totalSalary = co.crew.reduce((s, c) => s + c.salaryMo, 0)
        await deductMonthlySalaries(prisma)
        notify('💳 Monthly Salaries', `-$${totalSalary.toLocaleString()} for ${co.crew.length} crew`)
        mainWindow?.webContents.send('salary:deducted')
      }

      // Loan payment
      const loanResult = await deductLoanPayment(prisma)
      if (loanResult) {
        notify('🏦 Loan Payment', `-$${loanResult.payment.toLocaleString()} (${loanResult.paidMonths}/${loanResult.totalMonths})`)
        mainWindow?.webContents.send('loan:payment')
      }

      mainWindow?.webContents.send('lease:deducted')
    } catch (err) {
      console.error('[Thrustline] Monthly deduction failed:', err)
    }
  }, LEASE_INTERVAL_MS)

  // ── Random events timer ────────────────────────────────────────────────

  const EVENT_INTERVAL_MS = 60_000  // check every 60s
  const eventInterval = setInterval(async () => {
    try {
      if (!companyId) companyId = await getCompanyId(prisma)
      if (!companyId) return  // Not onboarded yet

      // Clean expired events
      const cleaned = await cleanExpiredEvents(prisma)
      if (cleaned > 0) {
        mainWindow?.webContents.send('event:expired')
      }

      // Roll for a new event
      const event = await rollRandomEvent(prisma, companyId)
      if (event) {
        console.log(`[Thrustline] New event: ${event.title} (${event.scope}${event.targetId ? ` → ${event.targetId}` : ''})`)
        notify(`🎲 ${event.title}`, event.description)
        mainWindow?.webContents.send('event:new', event)
      }
    } catch (err) {
      console.error('[Thrustline] Event tick failed:', err)
    }
  }, EVENT_INTERVAL_MS)

  // ── Sync engine ────────────────────────────────────────────────────────────

  let syncEngine: ReturnType<typeof createSyncEngine> | null = null

  function initSyncEngine() {
    if (!currentUserId || syncEngine) return
    try {
      const sb = getSupabaseClient()
      syncEngine = createSyncEngine(prisma, sb, currentUserId)
      syncEngine.onStatus((s) => mainWindow?.webContents.send('sync:status', s))
      syncEngine.pullOnStartup().then(() => syncEngine!.start()).catch(console.error)
      console.log('[Thrustline] Sync engine started')
    } catch (err) {
      console.error('[Thrustline] Sync engine init failed:', err)
    }
  }

  // Start sync engine once userId is available (after auth)
  ipcMain.handle('sync:pushNow', async () => {
    await syncEngine?.pushNow()
  })

  // Listen for auth changes to start sync
  const originalOnAuthChanged = () => {
    if (currentUserId && !syncEngine) initSyncEngine()
  }
  // Check on a short delay after auth handlers fire
  setInterval(() => { if (currentUserId && !syncEngine) initSyncEngine() }, 5000)

  // ── Cleanup ───────────────────────────────────────────────────────────────

  function cleanup() {
    clearInterval(leaseInterval)
    clearInterval(eventInterval)
    syncEngine?.stop()
    simBridge.stop()
  }

  mainWindow.on('closed', () => { mainWindow = null })

  app.on('before-quit', async (e) => {
    e.preventDefault()
    cleanup()
    try { await syncEngine?.pushNow() } catch {}
    try { await fastify.close() } catch {}
    process.exit(0)
  })

  // Force-kill the process on crash or unhandled errors so nothing lingers
  process.on('uncaughtException', (err) => {
    console.error('[Thrustline] Uncaught exception:', err)
    cleanup()
    process.exit(1)
  })

  process.on('unhandledRejection', (err) => {
    console.error('[Thrustline] Unhandled rejection:', err)
    cleanup()
    process.exit(1)
  })

  app.on('render-process-gone', (_event, _webContents, details) => {
    console.error('[Thrustline] Render process gone:', details.reason)
    cleanup()
    process.exit(1)
  })

  app.on('child-process-gone', (_event, details) => {
    console.error('[Thrustline] Child process gone:', details.type, details.reason)
    cleanup()
    process.exit(1)
  })
}

// Register deep-link protocol for OAuth callbacks
app.setAsDefaultProtocolClient('thrustline')

app.whenReady().then(main)

app.on('window-all-closed', () => { app.quit() })
