import { app, BrowserWindow } from 'electron';
import { autoUpdater } from 'electron-updater';
import { UpdateState } from '../../src/types';

export class AutoUpdaterManager {
  private mainWindow: BrowserWindow | null = null;
  private state: UpdateState = {
    status: 'idle',
    currentVersion: app.getVersion(),
  };

  constructor() {
    this.initUpdater();
  }

  public setWindow(window: BrowserWindow | null): void {
    this.mainWindow = window;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.broadcastState();
    }
  }

  private broadcastState(): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('updater:status', this.state);
    }
  }

  private updateState(partial: Partial<UpdateState>): void {
    this.state = {
      ...this.state,
      ...partial,
      currentVersion: app.getVersion(),
    };
    this.broadcastState();
  }

  public getState(): UpdateState {
    return { ...this.state, currentVersion: app.getVersion() };
  }

  private initUpdater(): void {
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    // Optional logger to avoid crashes
    autoUpdater.logger = {
      info: (msg: any) => console.log('[AutoUpdater info]', msg),
      warn: (msg: any) => console.warn('[AutoUpdater warn]', msg),
      error: (msg: any) => console.error('[AutoUpdater error]', msg),
      debug: (msg: any) => console.debug('[AutoUpdater debug]', msg),
    };

    autoUpdater.on('checking-for-update', () => {
      console.log('[AutoUpdater] Checking for updates...');
      this.updateState({ status: 'checking', error: undefined });
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdater] Update available:', info.version);
      this.updateState({
        status: 'available',
        availableVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        error: undefined,
      });
    });

    autoUpdater.on('update-not-available', () => {
      console.log('[AutoUpdater] No updates available.');
      this.updateState({
        status: 'not-available',
        error: undefined,
      });
    });

    autoUpdater.on('download-progress', (progressObj) => {
      this.updateState({
        status: 'downloading',
        progress: {
          percent: Math.round(progressObj.percent),
          bytesPerSecond: progressObj.bytesPerSecond,
          transferred: progressObj.transferred,
          total: progressObj.total,
        },
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('[AutoUpdater] Update downloaded:', info.version);
      this.updateState({
        status: 'downloaded',
        availableVersion: info.version,
        error: undefined,
      });
    });

    autoUpdater.on('error', (err) => {
      console.warn('[AutoUpdater] Update error:', err.message);
      // In development mode, autoUpdater will fail because app-update.yml is not packaged
      if (!app.isPackaged) {
        this.updateState({
          status: 'not-available',
          error: undefined,
        });
      } else {
        this.updateState({
          status: 'error',
          error: err.message || 'Failed to check for updates',
        });
      }
    });
  }

  public async checkForUpdates(): Promise<UpdateState> {
    this.updateState({ status: 'checking', error: undefined });

    if (!app.isPackaged) {
      // In dev mode, gracefully simulate after short delay
      await new Promise((resolve) => setTimeout(resolve, 800));
      this.updateState({
        status: 'not-available',
        error: undefined,
      });
      return this.state;
    }

    try {
      await autoUpdater.checkForUpdates();
    } catch (err: any) {
      console.warn('[AutoUpdater] checkForUpdates exception:', err.message);
      this.updateState({
        status: 'error',
        error: err.message,
      });
    }

    return this.state;
  }

  public async downloadUpdate(): Promise<void> {
    if (this.state.status !== 'available') return;
    this.updateState({ status: 'downloading' });
    try {
      await autoUpdater.downloadUpdate();
    } catch (err: any) {
      console.error('[AutoUpdater] downloadUpdate failed:', err);
      this.updateState({
        status: 'error',
        error: err.message || 'Download failed',
      });
    }
  }

  public quitAndInstall(): void {
    if (this.state.status === 'downloaded') {
      autoUpdater.quitAndInstall(false, true);
    }
  }
}
