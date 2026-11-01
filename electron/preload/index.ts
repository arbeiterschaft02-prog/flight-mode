import { contextBridge, ipcRenderer } from 'electron';
import type { FlightEvent, FlightModeApi } from '../../src/types';

// Channel names are duplicated from main/ipc.ts on purpose: the sandboxed
// preload must not import main-process modules.
const api: FlightModeApi = {
  getSnapshot: () => ipcRenderer.invoke('fm:get-snapshot'),
  updateSettings: (patch) => ipcRenderer.invoke('fm:update-settings', patch),
  startFlight: (input) => ipcRenderer.invoke('fm:start-flight', input),
  pauseFlight: () => ipcRenderer.invoke('fm:pause-flight'),
  resumeFlight: () => ipcRenderer.invoke('fm:resume-flight'),
  emergencyLanding: () => ipcRenderer.invoke('fm:emergency-landing'),
  checkLanding: () => ipcRenderer.invoke('fm:check-landing'),
  deleteRecord: (id) => ipcRenderer.invoke('fm:delete-record', id),
  clearSiteBlocks: () => ipcRenderer.invoke('fm:clear-site-blocks'),
  getBlockStatus: () => ipcRenderer.invoke('fm:get-block-status'),
  getRunningBrowsers: () => ipcRenderer.invoke('fm:get-running-browsers'),
  restartBrowsers: () => ipcRenderer.invoke('fm:restart-browsers'),
  onFlightEvent: (listener) => {
    const handler = (_e: Electron.IpcRendererEvent, event: FlightEvent) => listener(event);
    ipcRenderer.on('fm:flight-event', handler);
    return () => ipcRenderer.removeListener('fm:flight-event', handler);
  }
};

contextBridge.exposeInMainWorld('flightMode', api);
