import { app, BrowserWindow, ipcMain, dialog, clipboard, shell, session } from 'electron';
import path from 'path';
import fs from 'fs';
import { VaultManager } from './vault/VaultManager';
import { BiometricService } from './biometrics/BiometricService';
import { SSHClientManager } from './ssh/SSHClientManager';
import { SFTPManager } from './ssh/SFTPManager';
import { MonitorService } from './ssh/MonitorService';
import { TunnelManager } from './ssh/TunnelManager';
import { AutoUpdaterManager } from './updater/AutoUpdaterManager';
import { LocalFSManager } from './fs/LocalFSManager';
import { AppIntegrity } from './security/AppIntegrity';

let mainWindow: BrowserWindow | null = null;

const biometricService = new BiometricService();
const vault = new VaultManager(biometricService);
const sshManager = new SSHClientManager();
const sftpManager = new SFTPManager(sshManager);
const localFSManager = new LocalFSManager();
const monitorService = new MonitorService(sshManager);
const tunnelManager = new TunnelManager(sshManager);
const autoUpdaterManager = new AutoUpdaterManager();

// Global SSH & Monitor event forwarders (singleton registration prevents duplicate listeners)
sshManager.on('data', (payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ssh:data', payload);
  }
});

sshManager.on('connected', (payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ssh:connected', payload);
  }
});

sshManager.on('ssh-error', (payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ssh:error', payload);
  }
});

sshManager.on('error', (payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ssh:error', payload);
  }
});

sshManager.on('closed', (payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ssh:closed', payload);
  }
  sftpManager.closeSession(payload.sessionId);
  monitorService.stopMonitoring(payload.sessionId);
});

sshManager.on('disconnected', (payload) => {
  sftpManager.closeSession(payload.sessionId);
  monitorService.stopMonitoring(payload.sessionId);
});

sshManager.on('directory-changed', (payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('ssh:directoryChanged', payload);
    mainWindow.webContents.send('ssh:directory-changed', payload);
  }
});

monitorService.on('stats', (payload) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('monitor:stats', payload);
  }
});

function createWindow() {
  const iconCandidates = [
    path.join(__dirname, '../../public/icon.ico'),
    path.join(app.getAppPath(), 'public/icon.ico'),
    path.join(app.getAppPath(), 'dist/icon.ico'),
    path.join(__dirname, '../../public/icon.png'),
    path.join(__dirname, '../../public/logo.png'),
    path.join(app.getAppPath(), 'public/icon.png'),
    path.join(app.getAppPath(), 'dist/icon.png'),
    path.join(app.getAppPath(), 'public/logo.png'),
  ];
  const iconPath = iconCandidates.find((p) => fs.existsSync(p));

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    frame: false, // Custom modern Windows 11 title bar
    backgroundColor: '#181818',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }

  // Security: Prevent window navigation to untrusted external URLs
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isAllowedInternal =
      url.startsWith('http://127.0.0.1:5173') ||
      url.startsWith('http://localhost:5173') ||
      url.startsWith('file://');
    if (!isAllowedInternal) {
      event.preventDefault();
      try {
        const parsed = new URL(url);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          shell.openExternal(url);
        }
      } catch {
        // ignore invalid url
      }
    }
  });

  // Security: Handle target="_blank" and window.open by opening in default system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch {
      // ignore invalid url
    }
    return { action: 'deny' };
  });

  autoUpdaterManager.setWindow(mainWindow);

  mainWindow.on('closed', () => {
    autoUpdaterManager.setWindow(null);
    mainWindow = null;
  });
}

// Register IPC Handlers
function registerIpcHandlers() {
  // Window controls
  ipcMain.handle('window:minimize', () => mainWindow?.minimize());
  ipcMain.handle('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });
  ipcMain.handle('window:close', () => mainWindow?.close());
  ipcMain.handle('window:isMaximized', () => mainWindow?.isMaximized() || false);

  // Clipboard
  ipcMain.handle('clipboard:readText', () => clipboard.readText());
  ipcMain.handle('clipboard:writeText', (_, text: string) => clipboard.writeText(text));

  // Vault
  ipcMain.handle('vault:getStatus', () => vault.getStatus());
  ipcMain.handle('vault:unlock', (_, password: string) => vault.unlock(password));
  ipcMain.handle('vault:unlockWithBiometrics', () => vault.unlockWithBiometrics());
  ipcMain.handle('vault:setupMasterPassword', (_, password: string, recoveryKey: string) =>
    vault.setupMasterPassword(password, recoveryKey)
  );
  ipcMain.handle('vault:recoverWithKey', (_, recoveryKey: string, newPassword: string) =>
    vault.recoverWithKey(recoveryKey, newPassword)
  );
  ipcMain.handle('vault:setProtectionMode', (_, mode, password, recoveryKey) =>
    vault.setProtectionMode(mode, password, recoveryKey)
  );
  ipcMain.handle('vault:toggleBiometrics', (_, enabled: boolean) =>
    vault.toggleBiometrics(enabled)
  );
  ipcMain.handle('vault:lock', () => vault.lock());
  ipcMain.handle('vault:getHosts', () => vault.getHosts());
  ipcMain.handle('vault:saveHost', (_, host) => vault.saveHost(host));
  ipcMain.handle('vault:deleteHost', (_, id) => vault.deleteHost(id));
  ipcMain.handle('vault:getSnippets', () => vault.getSnippets());
  ipcMain.handle('vault:saveSnippet', (_, snippet) => vault.saveSnippet(snippet));
  ipcMain.handle('vault:deleteSnippet', (_, id) => vault.deleteSnippet(id));
  ipcMain.handle('vault:getTunnels', () => vault.getTunnels());
  ipcMain.handle('vault:saveTunnel', (_, tunnel) => vault.saveTunnel(tunnel));
  ipcMain.handle('vault:deleteTunnel', (_, id) => vault.deleteTunnel(id));
  ipcMain.handle('vault:getSettings', () => vault.getSettings());
  ipcMain.handle('vault:saveSettings', (_, settings) => vault.saveSettings(settings));

  // Biometrics
  ipcMain.handle('biometrics:checkAvailability', () => biometricService.checkAvailability());
  ipcMain.handle('biometrics:promptVerification', (_, prompt) => biometricService.promptVerification(prompt));

  // SSH
  ipcMain.handle('ssh:connect', async (_, sessionId, host, cols, rows) => {
    return sshManager.connect(sessionId, host, cols, rows);
  });
  ipcMain.handle('ssh:write', (_, sessionId, data) => {
    sshManager.write(sessionId, data);
  });
  ipcMain.handle('ssh:resize', (_, sessionId, cols, rows) => {
    sshManager.resize(sessionId, cols, rows);
  });
  ipcMain.handle('ssh:disconnect', (_, sessionId) => {
    sftpManager.closeSession(sessionId);
    sshManager.disconnect(sessionId);
    monitorService.stopMonitoring(sessionId);
  });
  ipcMain.handle('ssh:testConnection', async (_, host) => {
    return sshManager.testConnection(host);
  });
  ipcMain.handle('ssh:getCurrentDirectory', (_, sessionId) => {
    return sshManager.getCurrentDirectory(sessionId);
  });
  ipcMain.handle('ssh:isConnected', (_, sessionId) => {
    return sshManager.isConnected(sessionId);
  });

  // SFTP
  ipcMain.handle('sftp:list', async (_, sessionId, remotePath, forceRefresh) => {
    return sftpManager.listDirectory(sessionId, remotePath, forceRefresh);
  });
  ipcMain.handle('sftp:readFile', async (_, sessionId, remotePath) => {
    return sftpManager.readFile(sessionId, remotePath);
  });
  ipcMain.handle('sftp:writeFile', async (_, sessionId, remotePath, content) => {
    return sftpManager.writeFile(sessionId, remotePath, content);
  });
  ipcMain.handle('sftp:sudoWriteFile', async (_, sessionId, remotePath, content, sudoPassword) => {
    return sftpManager.sudoWriteFile(sessionId, remotePath, content, sudoPassword);
  });
  ipcMain.handle('sftp:mkdir', async (_, sessionId, remotePath) => {
    return sftpManager.mkdir(sessionId, remotePath);
  });
  ipcMain.handle('sftp:delete', async (_, sessionId, remotePath, isDirectory) => {
    return sftpManager.deleteFile(sessionId, remotePath, isDirectory);
  });
  ipcMain.handle('sftp:deleteBatch', async (_, sessionId, paths) => {
    return sftpManager.deleteBatch(sessionId, paths);
  });
  ipcMain.handle('sftp:rename', async (_, sessionId, oldPath, newPath) => {
    return sftpManager.rename(sessionId, oldPath, newPath);
  });
  ipcMain.handle('sftp:chmod', async (_, sessionId, remotePath, mode) => {
    return sftpManager.chmod(sessionId, remotePath, mode);
  });
  ipcMain.handle('sftp:copyFile', async (_, sessionId, srcPath, destPath) => {
    return sftpManager.copyFile(sessionId, srcPath, destPath);
  });
  ipcMain.handle('sftp:uploadFile', async (_, sessionId, localPath, remotePath) => {
    return sftpManager.uploadFile(sessionId, localPath, remotePath);
  });
  ipcMain.handle('sftp:downloadFile', async (_, sessionId, remotePath, localPath) => {
    return sftpManager.downloadFile(sessionId, remotePath, localPath);
  });
  ipcMain.handle('sftp:uploadBatch', async (event, sessionId, items, conflictPolicy) => {
    return sftpManager.uploadBatch(sessionId, items, conflictPolicy, (payload) => {
      event.sender.send('transfer:progress', payload);
    });
  });
  ipcMain.handle('sftp:downloadBatch', async (event, sessionId, items) => {
    return sftpManager.downloadBatch(sessionId, items, (payload) => {
      event.sender.send('transfer:progress', payload);
    });
  });

  // Local Files
  ipcMain.handle('local:list', async (_, dirPath) => {
    return localFSManager.listDirectory(dirPath);
  });
  ipcMain.handle('local:getDrives', async () => {
    return localFSManager.getDrives();
  });
  ipcMain.handle('local:mkdir', async (_, dirPath) => {
    return localFSManager.createDirectory(dirPath);
  });
  ipcMain.handle('local:delete', async (_, targetPath) => {
    return localFSManager.deleteFile(targetPath);
  });
  ipcMain.handle('local:deleteBatch', async (_, paths) => {
    return localFSManager.deleteBatch(paths);
  });
  ipcMain.handle('local:rename', async (_, oldPath, newPath) => {
    return localFSManager.renameFile(oldPath, newPath);
  });
  ipcMain.handle('local:copy', async (_, srcPath, destPath) => {
    return localFSManager.copyFile(srcPath, destPath);
  });
  ipcMain.handle('local:readFile', async (_, targetPath) => {
    return localFSManager.readFile(targetPath);
  });
  ipcMain.handle('local:writeFile', async (_, targetPath, content) => {
    return localFSManager.writeFile(targetPath, content);
  });

  // Monitor
  ipcMain.handle('monitor:start', (_, sessionId) => {
    monitorService.startMonitoring(sessionId);
  });
  ipcMain.handle('monitor:stop', (_, sessionId) => {
    monitorService.stopMonitoring(sessionId);
  });
  ipcMain.handle('monitor:killProcess', async (_, sessionId, pid, signal) => {
    return monitorService.killProcess(sessionId, pid, signal);
  });

  // Tunnels
  ipcMain.handle('tunnels:start', async (_, tunnel) => {
    return tunnelManager.startTunnel(tunnel);
  });
  ipcMain.handle('tunnels:stop', (_, tunnelId) => {
    tunnelManager.stopTunnel(tunnelId);
  });
  ipcMain.handle('tunnels:isActive', (_, tunnelId) => {
    return tunnelManager.isTunnelActive(tunnelId);
  });

  // Native File Dialog
  ipcMain.handle('dialog:openKeyFile', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select SSH Private Key',
      properties: ['openFile'],
      filters: [
        { name: 'All SSH Key Files (*.*)', extensions: ['*'] },
        { name: 'PuTTY Private Keys (*.ppk)', extensions: ['ppk'] },
        { name: 'OpenSSH / PEM Keys (*.pem, *.key, id_*)', extensions: ['pem', 'key', 'id_rsa', 'id_ed25519'] },
      ],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  ipcMain.handle('dialog:selectFolder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Select Destination Folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Auto Updater
  ipcMain.handle('updater:getStatus', () => {
    return autoUpdaterManager.getState();
  });
  ipcMain.handle('updater:check', async () => {
    return autoUpdaterManager.checkForUpdates();
  });
  ipcMain.handle('updater:download', async () => {
    return autoUpdaterManager.downloadUpdate();
  });
  ipcMain.handle('updater:install', () => {
    autoUpdaterManager.quitAndInstall();
  });

  // Security & Provenance
  ipcMain.handle('integrity:verify', () => {
    return AppIntegrity.verifyIntegrity();
  });
}

app.whenReady().then(async () => {
  // Cryptographic provenance check
  const integrity = AppIntegrity.verifyIntegrity();
  if (!integrity.valid) {
    console.warn('[Security] BesTTY provenance integrity check failed. Restoring author defaults.');
  }

  // Allow external widgets (e.g. YooMoney fundraise widget) to be framed securely
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    const lowerUrl = details.url.toLowerCase();
    if (lowerUrl.includes('yoomoney.ru') || lowerUrl.includes('tips.tips')) {
      for (const header of Object.keys(responseHeaders)) {
        if (header.toLowerCase() === 'x-frame-options') {
          delete responseHeaders[header];
        }
      }
    }
    callback({ responseHeaders });
  });

  await vault.init();
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
