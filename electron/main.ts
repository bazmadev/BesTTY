import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { VaultManager } from './vault/VaultManager';
import { SSHClientManager } from './ssh/SSHClientManager';
import { SFTPManager } from './ssh/SFTPManager';
import { MonitorService } from './ssh/MonitorService';
import { TunnelManager } from './ssh/TunnelManager';

let mainWindow: BrowserWindow | null = null;

const vault = new VaultManager();
const sshManager = new SSHClientManager();
const sftpManager = new SFTPManager(sshManager);
const monitorService = new MonitorService(sshManager);
const tunnelManager = new TunnelManager(sshManager);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    frame: false, // Custom modern Windows 11 title bar
    backgroundColor: '#181818',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  const isDev = process.env.NODE_ENV !== 'production' && !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'));
  }

  // SSH Manager event forwarders
  sshManager.on('data', (payload) => {
    mainWindow?.webContents.send('ssh:data', payload);
  });

  sshManager.on('ssh-error', (payload) => {
    mainWindow?.webContents.send('ssh:error', payload);
  });

  sshManager.on('error', (payload) => {
    mainWindow?.webContents.send('ssh:error', payload);
  });

  sshManager.on('closed', (payload) => {
    mainWindow?.webContents.send('ssh:closed', payload);
    monitorService.stopMonitoring(payload.sessionId);
  });

  sshManager.on('directory-changed', (payload) => {
    mainWindow?.webContents.send('ssh:directory-changed', payload);
  });

  // Monitor event forwarder
  monitorService.on('stats', (payload) => {
    mainWindow?.webContents.send('monitor:stats', payload);
  });

  mainWindow.on('closed', () => {
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

  // Vault
  ipcMain.handle('vault:getStatus', () => vault.getStatus());
  ipcMain.handle('vault:unlock', (_, password: string) => vault.unlock(password));
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
    sshManager.disconnect(sessionId);
    monitorService.stopMonitoring(sessionId);
  });

  // SFTP
  ipcMain.handle('sftp:list', async (_, sessionId, remotePath) => {
    return sftpManager.listDirectory(sessionId, remotePath);
  });
  ipcMain.handle('sftp:readFile', async (_, sessionId, remotePath) => {
    return sftpManager.readFile(sessionId, remotePath);
  });
  ipcMain.handle('sftp:writeFile', async (_, sessionId, remotePath, content) => {
    return sftpManager.writeFile(sessionId, remotePath, content);
  });
  ipcMain.handle('sftp:sudoWriteFile', async (_, sessionId, remotePath, content) => {
    return sftpManager.sudoWriteFile(sessionId, remotePath, content);
  });
  ipcMain.handle('sftp:mkdir', async (_, sessionId, remotePath) => {
    return sftpManager.mkdir(sessionId, remotePath);
  });
  ipcMain.handle('sftp:delete', async (_, sessionId, remotePath, isDirectory) => {
    return sftpManager.deleteFile(sessionId, remotePath, isDirectory);
  });
  ipcMain.handle('sftp:rename', async (_, sessionId, oldPath, newPath) => {
    return sftpManager.rename(sessionId, oldPath, newPath);
  });
  ipcMain.handle('sftp:chmod', async (_, sessionId, remotePath, mode) => {
    return sftpManager.chmod(sessionId, remotePath, mode);
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
}

app.whenReady().then(() => {
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
