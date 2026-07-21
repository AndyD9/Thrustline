import { contextBridge, ipcRenderer } from 'electron'

export interface ThrustlineAPI {
  onSimData: (callback: (data: unknown) => void) => void
  offAll: () => void
  onSimStatus: (callback: (status: string) => void) => void
  onFlightStarted: (callback: () => void) => void
  onFlightEnded: (callback: (record: unknown) => void) => void
  getFlights: (limit?: number) => Promise<unknown[]>
  getSimStatus: () => Promise<string>
}

contextBridge.exposeInMainWorld('thrustline', {
  onSimData: (callback: (data: unknown) => void) => {
    ipcRenderer.removeAllListeners('sim:data')
    ipcRenderer.on('sim:data', (_event, data) => callback(data))
  },
  // Removes all registered listeners at once (call on unmount)
  offAll: () => {
    ipcRenderer.removeAllListeners('sim:data')
    ipcRenderer.removeAllListeners('sim:status')
    ipcRenderer.removeAllListeners('flight:started')
    ipcRenderer.removeAllListeners('flight:ended')
  },
  onSimStatus: (callback: (status: string) => void) => {
    ipcRenderer.removeAllListeners('sim:status')
    ipcRenderer.on('sim:status', (_event, status) => callback(status))
  },
  onFlightStarted: (callback: () => void) => {
    ipcRenderer.removeAllListeners('flight:started')
    ipcRenderer.on('flight:started', () => callback())
  },
  onFlightEnded: (callback: (record: unknown) => void) => {
    ipcRenderer.removeAllListeners('flight:ended')
    ipcRenderer.on('flight:ended', (_event, record) => callback(record))
  },
  getFlights: (limit?: number) => {
    return ipcRenderer.invoke('flights:getAll', limit)
  },
  // Invoke instead of event — avoids the startup race condition
  getSimStatus: () => {
    return ipcRenderer.invoke('sim:getStatus')
  },
} satisfies ThrustlineAPI)
