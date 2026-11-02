/** Narrow contextBridge API. No Node primitives ever cross into the renderer. */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('everlasting', {
  platform: process.platform,
  save: {
    read: (slot: number) => ipcRenderer.invoke('save:read', slot),
    write: (slot: number, data: string) => ipcRenderer.invoke('save:write', slot, data),
    list: () => ipcRenderer.invoke('save:list'),
  },
  settings: {
    read: () => ipcRenderer.invoke('settings:read'),
    write: (data: string) => ipcRenderer.invoke('settings:write', data),
  },
  quit: () => ipcRenderer.send('app:quit'),
  onBlur: (handler: () => void) => {
    const listener = (): void => handler();
    ipcRenderer.on('window:blurred', listener);
    return () => ipcRenderer.removeListener('window:blurred', listener);
  },
  onFocus: (handler: () => void) => {
    const listener = (): void => handler();
    ipcRenderer.on('window:focused', listener);
    return () => ipcRenderer.removeListener('window:focused', listener);
  },
});
