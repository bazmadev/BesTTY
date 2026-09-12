import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { HostProfile, Snippet, TunnelConfig, BesTTYSettings, SFTPFile, ServerMetrics, RemoteProcess } from '../src/types';

contextBridge.exposeInMainWorld('api', {
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  vault: {
    getStatus: () => ipcRenderer.invoke('vault:getStatus'),
    unlock: (password: string) => ipcRenderer.invoke('vault:unlock', password),
    unlockWithBiometrics: () => ipcRenderer.invoke('vault:unlockWithBiometrics'),
    setupMasterPassword: (password: string, recoveryKey: string) =>
      ipcRenderer.invoke('vault:setupMasterPassword', password, recoveryKey),
    recoverWithKey: (recoveryKey: string, newPassword: string) =>
      ipcRenderer.invoke('vault:recoverWithKey', recoveryKey, newPassword),
    setProtectionMode: (mode: any, password?: string, recoveryKey?: string) =>
      ipcRenderer.invoke('vault:setProtectionMode', mode, password, recoveryKey),
    toggleBiometrics: (enabled: boolean) =>
      ipcRenderer.invoke('vault:toggleBiometrics', enabled),
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

  biometrics: {
    checkAvailability: () => ipcRenderer.invoke('biometrics:checkAvailability'),
    promptVerification: (prompt?: string) => ipcRenderer.invoke('biometrics:promptVerification', prompt),
  },

  ssh: {
    connect: (sessionId: string, host: HostProfile, cols: number, rows: number) =>
      ipcRenderer.invoke('ssh:connect', sessionId, host, cols, rows),
    testConnection: (host: HostProfile) =>
      ipcRenderer.invoke('ssh:testConnection', host),
    write: (sessionId: string, data: string) =>
      ipcRenderer.invoke('ssh:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number) =>
      ipcRenderer.invoke('ssh:resize', sessionId, cols, rows),
    disconnect: (sessionId: string) =>
      ipcRenderer.invoke('ssh:disconnect', sessionId),
    getCurrentDirectory: (sessionId: string) =>
      ipcRenderer.invoke('ssh:getCurrentDirectory', sessionId),
    isConnected: (sessionId: string) =>
      ipcRenderer.invoke('ssh:isConnected', sessionId),
    onData: (callback: (payload: { sessionId: string; data: string }) => void) => {
      const handler = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('ssh:data', handler);
      return () => {
        ipcRenderer.removeListener('ssh:data', handler);
      };
    },
    onClosed: (callback: (payload: { sessionId: string }) => void) => {
      const handler = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('ssh:closed', handler);
      return () => {
        ipcRenderer.removeListener('ssh:closed', handler);
      };
    },
    onConnected: (callback: (payload: { sessionId: string; hostId: string; fingerprint?: string }) => void) => {
      const handler = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('ssh:connected', handler);
      return () => {
        ipcRenderer.removeListener('ssh:connected', handler);
      };
    },
    onError: (callback: (payload: { sessionId: string; error: string }) => void) => {
      const handler = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('ssh:error', handler);
      return () => {
        ipcRenderer.removeListener('ssh:error', handler);
      };
    },
    onDirectoryChanged: (callback: (payload: { sessionId: string; directory: string }) => void) => {
      const handler = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('ssh:directoryChanged', handler);
      ipcRenderer.on('ssh:directory-changed', handler);
      return () => {
        ipcRenderer.removeListener('ssh:directoryChanged', handler);
        ipcRenderer.removeListener('ssh:directory-changed', handler);
      };
    },
  },

  sftp: {
    list: (sessionId: string, path?: string, forceRefresh?: boolean) =>
      ipcRenderer.invoke('sftp:list', sessionId, path, forceRefresh),
    readFile: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:readFile', sessionId, remotePath),
    writeFile: (sessionId: string, remotePath: string, content: string) =>
      ipcRenderer.invoke('sftp:writeFile', sessionId, remotePath, content),
    sudoWriteFile: (sessionId: string, remotePath: string, content: string, sudoPassword?: string) =>
      ipcRenderer.invoke('sftp:sudoWriteFile', sessionId, remotePath, content, sudoPassword),
    mkdir: (sessionId: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:mkdir', sessionId, remotePath),
    delete: (sessionId: string, remotePath: string, isDirectory?: boolean) =>
      ipcRenderer.invoke('sftp:delete', sessionId, remotePath, isDirectory),
    deleteBatch: (sessionId: string, paths: string[]) =>
      ipcRenderer.invoke('sftp:deleteBatch', sessionId, paths),
    rename: (sessionId: string, oldPath: string, newPath: string) =>
      ipcRenderer.invoke('sftp:rename', sessionId, oldPath, newPath),
    chmod: (sessionId: string, remotePath: string, mode: number) =>
      ipcRenderer.invoke('sftp:chmod', sessionId, remotePath, mode),
    copyFile: (sessionId: string, srcPath: string, destPath: string) =>
      ipcRenderer.invoke('sftp:copyFile', sessionId, srcPath, destPath),
    uploadFile: (sessionId: string, localPath: string, remotePath: string) =>
      ipcRenderer.invoke('sftp:uploadFile', sessionId, localPath, remotePath),
    downloadFile: (sessionId: string, remotePath: string, localPath: string) =>
      ipcRenderer.invoke('sftp:downloadFile', sessionId, remotePath, localPath),
    uploadBatch: (
      sessionId: string,
      items: Array<{ localPath: string; remoteDest: string }>,
      conflictPolicy?: 'overwrite' | 'skip' | 'rename'
    ) => ipcRenderer.invoke('sftp:uploadBatch', sessionId, items, conflictPolicy),
    downloadBatch: (sessionId: string, items: Array<{ remotePath: string; localDest: string }>) =>
      ipcRenderer.invoke('sftp:downloadBatch', sessionId, items),
    onTransferProgress: (callback: (payload: any) => void) => {
      const handler = (_: any, payload: any) => callback(payload);
      ipcRenderer.on('transfer:progress', handler);
      return () => {
        ipcRenderer.removeListener('transfer:progress', handler);
      };
    },
  },

  local: {
    list: (dirPath?: string) =>
      ipcRenderer.invoke('local:list', dirPath),
    getDrives: () =>
      ipcRenderer.invoke('local:getDrives'),
    mkdir: (dirPath: string) =>
      ipcRenderer.invoke('local:mkdir', dirPath),
    delete: (targetPath: string) =>
      ipcRenderer.invoke('local:delete', targetPath),
    deleteBatch: (paths: string[]) =>
      ipcRenderer.invoke('local:deleteBatch', paths),
    rename: (oldPath: string, newPath: string) =>
      ipcRenderer.invoke('local:rename', oldPath, newPath),
    copy: (srcPath: string, destPath: string) =>
      ipcRenderer.invoke('local:copy', srcPath, destPath),
    readFile: (targetPath: string) =>
      ipcRenderer.invoke('local:readFile', targetPath),
    writeFile: (targetPath: string, content: string) =>
      ipcRenderer.invoke('local:writeFile', targetPath, content),
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

  dialog: {
    openKeyFile: () => ipcRenderer.invoke('dialog:openKeyFile'),
    selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  },

  clipboard: {
    readText: () => ipcRenderer.invoke('clipboard:readText'),
    writeText: (text: string) => ipcRenderer.invoke('clipboard:writeText', text),
  },

  updater: {
    getStatus: () => ipcRenderer.invoke('updater:getStatus'),
    check: () => ipcRenderer.invoke('updater:check'),
    download: () => ipcRenderer.invoke('updater:download'),
    install: () => ipcRenderer.invoke('updater:install'),
    onStatus: (callback: (state: any) => void) => {
      const handler = (_: any, state: any) => callback(state);
      ipcRenderer.on('updater:status', handler);
      return () => ipcRenderer.removeListener('updater:status', handler);
    },
  },

  integrity: {
    verify: () => ipcRenderer.invoke('integrity:verify'),
  },
});
