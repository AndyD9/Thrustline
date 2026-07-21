'use strict'

const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('thrustline', {
  onSimData: (callback) => {
    ipcRenderer.removeAllListeners('sim:data')
    ipcRenderer.on('sim:data', (_event, data) => callback(data))
  },

  offAll: () => {
    ipcRenderer.removeAllListeners('sim:data')
    ipcRenderer.removeAllListeners('sim:status')
    ipcRenderer.removeAllListeners('flight:started')
    ipcRenderer.removeAllListeners('flight:ended')
    ipcRenderer.removeAllListeners('lease:deducted')
    ipcRenderer.removeAllListeners('aircraft:changed')
    ipcRenderer.removeAllListeners('dispatch:updated')
    ipcRenderer.removeAllListeners('salary:deducted')
    ipcRenderer.removeAllListeners('event:new')
    ipcRenderer.removeAllListeners('event:expired')
    ipcRenderer.removeAllListeners('loan:payment')
    ipcRenderer.removeAllListeners('auth:changed')
    ipcRenderer.removeAllListeners('sync:status')
  },

  onSimStatus: (callback) => {
    ipcRenderer.removeAllListeners('sim:status')
    ipcRenderer.on('sim:status', (_event, status) => callback(status))
  },

  onFlightStarted: (callback) => {
    ipcRenderer.removeAllListeners('flight:started')
    ipcRenderer.on('flight:started', () => callback())
  },

  onFlightEnded: (callback) => {
    ipcRenderer.removeAllListeners('flight:ended')
    ipcRenderer.on('flight:ended', (_event, record) => callback(record))
  },

  onLeaseDeducted: (callback) => {
    ipcRenderer.removeAllListeners('lease:deducted')
    ipcRenderer.on('lease:deducted', () => callback())
  },

  onAircraftChanged: (callback) => {
    ipcRenderer.removeAllListeners('aircraft:changed')
    ipcRenderer.on('aircraft:changed', (_event, aircraft) => callback(aircraft))
  },

  onDispatchUpdated: (callback) => {
    ipcRenderer.removeAllListeners('dispatch:updated')
    ipcRenderer.on('dispatch:updated', () => callback())
  },

  onSalaryDeducted: (callback) => {
    ipcRenderer.removeAllListeners('salary:deducted')
    ipcRenderer.on('salary:deducted', () => callback())
  },

  onEventNew: (callback) => {
    ipcRenderer.removeAllListeners('event:new')
    ipcRenderer.on('event:new', (_event, data) => callback(data))
  },

  onEventExpired: (callback) => {
    ipcRenderer.removeAllListeners('event:expired')
    ipcRenderer.on('event:expired', () => callback())
  },

  onLoanPayment: (callback) => {
    ipcRenderer.removeAllListeners('loan:payment')
    ipcRenderer.on('loan:payment', () => callback())
  },

  // Auth
  signUp:              (email, password) => ipcRenderer.invoke('auth:signUp', email, password),
  signIn:              (email, password) => ipcRenderer.invoke('auth:signInEmail', email, password),
  signInOAuth:         (provider)        => ipcRenderer.invoke('auth:signInOAuth', provider),
  signOut:             ()                => ipcRenderer.invoke('auth:signOut'),
  getSession:          ()                => ipcRenderer.invoke('auth:getSession'),
  onAuthChange: (callback) => {
    ipcRenderer.removeAllListeners('auth:changed')
    ipcRenderer.on('auth:changed', (_event, session) => callback(session))
  },

  // Sync
  syncNow:             ()  => ipcRenderer.invoke('sync:pushNow'),
  onSyncStatus: (callback) => {
    ipcRenderer.removeAllListeners('sync:status')
    ipcRenderer.on('sync:status', (_event, status) => callback(status))
  },

  openExternal:        (url)    => ipcRenderer.invoke('shell:openExternal', url),
  getFlights:          (limit)  => ipcRenderer.invoke('flights:getAll', limit),
  getSimStatus:        ()       => ipcRenderer.invoke('sim:getStatus'),
  exportFlights:       ()       => ipcRenderer.invoke('export:flights'),
  exportTransactions:  ()       => ipcRenderer.invoke('export:transactions'),
})
