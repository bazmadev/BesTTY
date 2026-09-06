import { contextBridge, ipcRenderer } from 'electron';
import { HostProfile, Snippet, TunnelConfig, BesTTYSettings, SFTPFile, ServerMetrics, RemoteProcess } from '../src/types';

contextBridge.exposeInMainWorld('api', {
  vault: {
    getStatus: () => ipcRenderer.invoke('vault:getStatus'),
    unlock: (password: string) => ipcRenderer.invoke('vault:unlock', password),
    lock: () => ipcRenderer.invoke('vault:lock'),
    getHosts: () => ipcRenderer.invoke('vault:getHosts'),
    saveHost: (host: HostProfile) => ipcRenderer.invoke('vault:saveHost', host),
    deleteHost: (id: string) => ipcRenderer.invoke('vault:deleteHost', id),
    getSnippets: () => ipcRenderer.invoke('vault:getSnippets'),
    saveSnippet: (snippet: Snippet) => ipcRenderer.invoke('vault:saveSnippet', snippet),
    deleteSnippet: (id: string) => ipcRenderer.invoke('vault:deleteSnippet', id),
    getTunnels: () => ipcRenderer.invoke('vault:getTunnels'),
    saveTunnel: (tunnel: TunnelConfig) => ipcRenderer.invoke('vault:saveTunnel', tunnel),
    deleteTunnel: (id: string) => ipcRenderer.invoke('vault:deleteTunnel', id),
    getSettings: () => ipcRenderer.invoke('vault:getSettings'),
    saveSettings: (settings: Partial<BesTTYSettings>) => ipcRenderer.invoke('vault:saveSettings', settings),
  },

  ssh: {
    connect: (sessionId: string, host: HostProfile, cols: number, rows: number) =>
      ipcRenderer.invoke('ssh:connect', sessionId, host, cols, rows),
    write: (sessionId: string, data: string) =>
      ipcRenderer.invoke('ssh:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('ssh:resize', sessionId, cols, rows),
    disconnect: (sessionId: string) =>
      ipcRenderer.invoke('ssh:disconnect', sessionId),
    onData: (callback: (payload: { sessionId: string; data: string }) => void) => {
      const handler = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('ssh:data', handler);
      return () => ipcRenderer.removeListener('ssh:data', handler);
    },
    onClosed: (callback: (payload: { sessionId: string }) => void) => {
      const handler = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('ssh:closed', handler);
      return () => ipcRenderer.removeListener('ssh:closed', handler);
    },
    onDirectoryChanged: (callback: (payload: { sessionId: string; directory: string }) => void) => {
      const handler = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('ssh:directory-changed', handler);
      return () => ipcRenderer.removeListener('ssh:directory-changed', handler);
    },
  },

  sftp: {
    list: (sessionId: string, path?: string) =>
      ipcRenderer.invoke('sftp:list', sessionId, path),
    readFile: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:readFile', sessionId, remotePath),
    writeFile: (sessionId: string, remotePath: string, content: string) =>
      ipcRenderer.invoke('sftp:writeFile', sessionId, remotePath, content),
    sudoWriteFile: (sessionId: string, remotePath: string, content: string) =>
      ipcRenderer.invoke('sftp:sudoWriteFile', sessionId, remotePath, content),
    mkdir: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:mkdir', sessionId, remotePath),
    delete: (sessionId: string, remotePath: string, isDirectory: boolean) =>
      ipcRenderer.invoke('sftp:delete', sessionId, remotePath, isDirectory),
    rename: (sessionId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('sftp:rename', sessionId, oldPath, newPath),
    chmod: (sessionId: string, remotePath: string, mode: number) =>
      ipcRenderer.invoke('sftp:chmod', sessionId, remotePath, mode),
  },

  monitor: {
    start: (sessionId: string) => ipcRenderer.invoke('monitor:start', sessionId),
    stop: (sessionId: string) => ipcRenderer.invoke('monitor:stop', sessionId),
    onStats: (callback: (payload: { sessionId: string; metrics: ServerMetrics; processes: RemoteProcess[] }) => void) => {
      const handler = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('monitor:stats', handler);
      return () => ipcRenderer.removeListener('monitor:stats', handler);
    },
    killProcess: (sessionId: string, pid: number, signal?: string) =>
      ipcRenderer.invoke('monitor:killProcess', sessionId, pid, signal),
  },

  tunnels: {
    start: (tunnel: TunnelConfig) => ipcRenderer.invoke('tunnels:start', tunnel),
    stop: (tunnelId: string) => ipcRenderer.invoke('tunnels:stop', tunnelId),
    isActive: (tunnelId: string) => ipcRenderer.invoke('tunnels:isActive', tunnelId),
  },

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
  },
});
