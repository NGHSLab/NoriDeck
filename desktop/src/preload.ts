/**
 * preload: 렌더러(콘솔 runtime)에 window.norideck 브리지를 노출한다.
 * 계약(타입)은 runtime/src/platform/bridge.d.ts 가 정의하고, 여기서 구현한다.
 * 렌더러는 Node/Electron API 를 직접 만질 수 없다 (contextIsolation + sandbox).
 */
import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  DesktopBridge,
  DesktopLibraryEntry,
  DesktopWindowState,
} from '../../runtime/src/platform/bridge';

const bridge: DesktopBridge = {
  isDesktop: true,
  platform: process.platform,
  version: () => ipcRenderer.invoke('app:version') as Promise<string>,
  dataRoot: () =>
    ipcRenderer.invoke('app:data-root') as Promise<{ path: string; portable: boolean }>,
  save: {
    read: (cartId, slot) => ipcRenderer.invoke('save:read', cartId, slot) as Promise<string | null>,
    write: (cartId, slot, raw) =>
      ipcRenderer.invoke('save:write', cartId, slot, raw) as Promise<void>,
    remove: (cartId, slot) => ipcRenderer.invoke('save:remove', cartId, slot) as Promise<void>,
    list: (cartId) => ipcRenderer.invoke('save:list', cartId) as Promise<string[]>,
    clear: (cartId) => ipcRenderer.invoke('save:clear', cartId) as Promise<void>,
  },
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize') as Promise<void>,
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-maximize') as Promise<void>,
    close: () => ipcRenderer.invoke('window:close') as Promise<void>,
    setFullscreen: (on) => ipcRenderer.invoke('window:set-fullscreen', on) as Promise<void>,
    setContentSize: (width, height) =>
      ipcRenderer.invoke('window:set-content-size', width, height) as Promise<void>,
    getState: () => ipcRenderer.invoke('window:get-state') as Promise<DesktopWindowState>,
    onStateChange: (listener) => {
      const handler = (_event: IpcRendererEvent, state: DesktopWindowState) => listener(state);
      ipcRenderer.on('window:state', handler);
      return () => ipcRenderer.removeListener('window:state', handler);
    },
  },
  system: {
    openFolder: (folder) => ipcRenderer.invoke('system:open-folder', folder) as Promise<string>,
    toggleDevTools: () => ipcRenderer.invoke('system:toggle-devtools') as Promise<void>,
    saveFile: (options) =>
      ipcRenderer.invoke('system:save-file', options) as Promise<string | null>,
  },
  library: {
    list: () => ipcRenderer.invoke('library:list') as Promise<DesktopLibraryEntry[]>,
    import: (input) => ipcRenderer.invoke('library:import', input) as Promise<DesktopLibraryEntry>,
    read: (id) => ipcRenderer.invoke('library:read', id) as Promise<Uint8Array>,
    remove: (id) => ipcRenderer.invoke('library:remove', id) as Promise<void>,
    openFolder: (id) => ipcRenderer.invoke('library:open-folder', id) as Promise<string>,
    export: (id) => ipcRenderer.invoke('library:export', id) as Promise<string | null>,
  },
};

contextBridge.exposeInMainWorld('norideck', bridge);
