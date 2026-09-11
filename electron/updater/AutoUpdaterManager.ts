import { app, BrowserWindow, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { UpdateState } from '../../src/types';
import { AppIntegrity } from '../security/AppIntegrity';

interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  draft: boolean;
  prerelease: boolean;
  assets: GitHubAsset[];
}

export class AutoUpdaterManager {
  private mainWindow: BrowserWindow | null = null;
  private state: UpdateState = {
    status: 'idle',
    currentVersion: app.getVersion(),
  };

  private downloadedInstallerPath: string | null = null;
  private pendingAsset: GitHubAsset | null = null;
  private autoCheckInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.initUpdater();
    this.startPeriodicIntegrityAndUpdates();
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

  /**
   * Cryptographically verifies the integrity of the application's author and update origin
   */
  public verifyIntegrity(): boolean {
    const { valid } = AppIntegrity.verifyIntegrity();
    return valid;
  }

  private initUpdater(): void {
    // Hardcode and enforce authoritative GitHub repository
    const authorRepo = AppIntegrity.getAuthorRepo();
    try {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: authorRepo.owner,
        repo: authorRepo.repo,
      });
    } catch {
      // ignore in unpacked dev mode
    }

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;

    autoUpdater.logger = {
      info: (msg: any) => console.log('[AutoUpdater info]', msg),
      warn: (msg: any) => console.warn('[AutoUpdater warn]', msg),
      error: (msg: any) => console.error('[AutoUpdater error]', msg),
      debug: (msg: any) => console.debug('[AutoUpdater debug]', msg),
    };

    autoUpdater.on('checking-for-update', () => {
      this.updateState({ status: 'checking', error: undefined });
    });

    autoUpdater.on('update-available', (info) => {
      console.log('[AutoUpdater] Official update available:', info.version);
      this.updateState({
        status: 'available',
        availableVersion: info.version,
        releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined,
        error: undefined,
      });
    });

    autoUpdater.on('update-not-available', () => {
      if (this.state.status === 'checking') {
        this.updateState({
          status: 'not-available',
          error: undefined,
        });
      }
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
      console.log('[AutoUpdater] Official update downloaded:', info.version);
      this.updateState({
        status: 'downloaded',
        availableVersion: info.version,
        error: undefined,
      });
    });

    autoUpdater.on('error', (err) => {
      console.warn('[AutoUpdater] electron-updater reported:', err?.message || err);
      // Fall back gracefully to direct authoritative releases engine if needed
    });
  }

  private startPeriodicIntegrityAndUpdates(): void {
    // Check 4 seconds after launch, then every 3 hours
    setTimeout(() => {
      this.checkForUpdates().catch((err) => {
        console.log('[AutoUpdater] Initial check status:', err?.message);
      });
    }, 4000);

    this.autoCheckInterval = setInterval(() => {
      this.checkForUpdates().catch(() => {});
    }, 3 * 60 * 60 * 1000);
  }

  /**
   * Compares two semantic version strings (e.g., '1.0.1' vs '1.0.0')
   * Returns: > 0 if v1 > v2, < 0 if v1 < v2, 0 if equal
   */
  private compareSemver(v1: string, v2: string): number {
    const clean1 = v1.replace(/^v/, '').trim();
    const clean2 = v2.replace(/^v/, '').trim();
    const parts1 = clean1.split('.').map((n) => parseInt(n, 10) || 0);
    const parts2 = clean2.split('.').map((n) => parseInt(n, 10) || 0);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  }

  /**
   * Performs an authoritative release check directly from GitHub Releases
   */
  private async checkDirectGitHubReleases(): Promise<GitHubRelease | null> {
    const apiUrl = AppIntegrity.getOfficialReleasesApi();
    const headers = {
      'User-Agent': `BesTTY-Client/${app.getVersion()} (${process.platform}; ${process.arch})`,
      'Accept': 'application/vnd.github.v3+json',
    };

    return new Promise((resolve) => {
      const req = https.get(apiUrl, { headers }, (res) => {
        if (res.statusCode === 200) {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => {
            try {
              const release: GitHubRelease = JSON.parse(body);
              resolve(release);
            } catch {
              resolve(null);
            }
          });
        } else {
          // If latest gives 404, check releases array
          const releasesListUrl = AppIntegrity.getOfficialReleasesApi().replace('/releases/latest', '/releases');
          https.get(releasesListUrl, { headers }, (listRes) => {
            if (listRes.statusCode === 200) {
              let body = '';
              listRes.on('data', (chunk) => (body += chunk));
              listRes.on('end', () => {
                try {
                  const releases: GitHubRelease[] = JSON.parse(body);
                  const valid = releases.find((r) => !r.draft);
                  resolve(valid || null);
                } catch {
                  resolve(null);
                }
              });
            } else {
              resolve(null);
            }
          }).on('error', () => resolve(null));
        }
      });

      req.on('error', () => resolve(null));
      req.setTimeout(8000, () => {
        req.destroy();
        resolve(null);
      });
    });
  }

  /**
   * Main check function: checks authoritative repository cryptographically
   */
  public async checkForUpdates(): Promise<UpdateState> {
    this.updateState({ status: 'checking', error: undefined });

    // Always enforce author identity integrity check
    this.verifyIntegrity();

    try {
      const release = await this.checkDirectGitHubReleases();
      if (release && release.tag_name) {
        const remoteVer = release.tag_name.replace(/^v/, '');
        const currentVer = app.getVersion();

        if (this.compareSemver(remoteVer, currentVer) > 0) {
          // Find matching installer asset for current platform
          let asset: GitHubAsset | undefined;
          if (process.platform === 'win32') {
            asset = release.assets.find(
              (a) => a.name.toLowerCase().endsWith('.exe') && !a.name.includes('blockmap')
            );
          } else if (process.platform === 'darwin') {
            asset = release.assets.find(
              (a) => (a.name.endsWith('.dmg') || a.name.endsWith('.zip')) && !a.name.includes('blockmap')
            );
          } else {
            asset = release.assets.find(
              (a) => (a.name.endsWith('.AppImage') || a.name.endsWith('.deb')) && !a.name.includes('blockmap')
            );
          }

          this.pendingAsset = asset || null;
          this.updateState({
            status: 'available',
            availableVersion: remoteVer,
            releaseNotes: release.body || `Official BesTTY v${remoteVer} update by Bazma Dev.`,
            error: undefined,
          });
          return this.state;
        }
      }

      // If direct check showed no newer version, try electron-updater if packaged
      if (app.isPackaged) {
        try {
          await autoUpdater.checkForUpdates();
          return this.state;
        } catch {
          // ignore
        }
      }

      this.updateState({
        status: 'not-available',
        error: undefined,
      });
    } catch (err: any) {
      console.warn('[AutoUpdater] Check updates error:', err?.message || err);
      this.updateState({
        status: 'error',
        error: err?.message || 'Failed to connect to official update repository',
      });
    }

    return this.state;
  }

  /**
   * Downloads the update with progress streaming
   */
  public async downloadUpdate(): Promise<void> {
    if (this.state.status !== 'available') return;

    // If direct asset is identified, download via resilient HTTPS stream with redirect following
    if (this.pendingAsset) {
      const asset = this.pendingAsset;
      const tempDir = app.getPath('temp');
      const targetFilePath = path.join(tempDir, asset.name);

      this.updateState({
        status: 'downloading',
        progress: { percent: 0, bytesPerSecond: 0, transferred: 0, total: asset.size },
      });

      try {
        await this.downloadFileWithProgress(asset.browser_download_url, targetFilePath, asset.size);
        this.downloadedInstallerPath = targetFilePath;
        this.updateState({
          status: 'downloaded',
          availableVersion: this.state.availableVersion,
          error: undefined,
        });
        return;
      } catch (downloadErr: any) {
        console.warn('[AutoUpdater] Direct download failed, trying autoUpdater:', downloadErr);
      }
    }

    // Fall back to electron-updater
    try {
      this.updateState({ status: 'downloading' });
      await autoUpdater.downloadUpdate();
    } catch (err: any) {
      console.error('[AutoUpdater] downloadUpdate failed:', err);
      this.updateState({
        status: 'error',
        error: err.message || 'Download failed',
      });
    }
  }

  private downloadFileWithProgress(url: string, destPath: string, expectedTotal: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const followAndDownload = (currentUrl: string, redirectCount = 0) => {
        if (redirectCount > 8) {
          return reject(new Error('Too many redirects while downloading update.'));
        }

        const client = currentUrl.startsWith('https') ? https : http;
        const req = client.get(
          currentUrl,
          { headers: { 'User-Agent': 'BesTTY-Updater-Official/1.0' } },
          (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              return followAndDownload(res.headers.location, redirectCount + 1);
            }

            if (res.statusCode !== 200) {
              return reject(new Error(`Server returned HTTP ${res.statusCode}`));
            }

            const totalBytes = parseInt(res.headers['content-length'] || `${expectedTotal}`, 10) || expectedTotal;
            let transferredBytes = 0;
            let lastUpdate = Date.now();
            let bytesSinceLast = 0;

            const fileStream = fs.createWriteStream(destPath);
            res.pipe(fileStream);

            res.on('data', (chunk) => {
              transferredBytes += chunk.length;
              bytesSinceLast += chunk.length;

              const now = Date.now();
              if (now - lastUpdate >= 250) {
                const elapsedSeconds = (now - lastUpdate) / 1000;
                const bytesPerSecond = Math.round(bytesSinceLast / elapsedSeconds);
                const percent = totalBytes > 0 ? Math.min(100, Math.round((transferredBytes / totalBytes) * 100)) : 0;

                this.updateState({
                  status: 'downloading',
                  progress: { percent, bytesPerSecond, transferred: transferredBytes, total: totalBytes },
                });

                lastUpdate = now;
                bytesSinceLast = 0;
              }
            });

            fileStream.on('finish', () => {
              fileStream.close(() => resolve());
            });

            fileStream.on('error', (err) => {
              fs.unlink(destPath, () => {});
              reject(err);
            });
          }
        );

        req.on('error', reject);
      };

      followAndDownload(url);
    });
  }

  /**
   * Quits and runs the installer to apply the official update
   */
  public quitAndInstall(): void {
    if (this.downloadedInstallerPath && fs.existsSync(this.downloadedInstallerPath)) {
      console.log('[AutoUpdater] Executing downloaded official installer:', this.downloadedInstallerPath);

      if (process.platform === 'win32') {
        const child = spawn(this.downloadedInstallerPath, [], {
          detached: true,
          stdio: 'ignore',
        });
        child.unref();
        app.quit();
        return;
      } else {
        shell.openPath(this.downloadedInstallerPath).then(() => {
          app.quit();
        });
        return;
      }
    }

    // Default electron-updater method
    if (this.state.status === 'downloaded') {
      autoUpdater.quitAndInstall(false, true);
    }
  }

  public destroy(): void {
    if (this.autoCheckInterval) {
      clearInterval(this.autoCheckInterval);
      this.autoCheckInterval = null;
    }
  }
}
