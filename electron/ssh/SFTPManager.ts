import { SFTPWrapper } from 'ssh2';
import * as fs from 'fs';
import * as path from 'path';
import { SSHClientManager } from './SSHClientManager';
import { SFTPFile } from '../../src/types';

interface CachedDir {
  currentPath: string;
  files: SFTPFile[];
  timestamp: number;
}

export class SFTPManager {
  private sftpSessions: Map<string, SFTPWrapper> = new Map();
  private pendingSftpPromises: Map<string, Promise<SFTPWrapper>> = new Map();
  private dirCache: Map<string, CachedDir> = new Map();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds

  constructor(private sshManager: SSHClientManager) {}

  private getCacheKey(sessionId: string, remotePath: string): string {
    const normalized = remotePath.replace(/\/+$/, '') || '/';
    return `${sessionId}:${normalized}`;
  }

  public invalidateCacheForPath(sessionId: string, remotePath: string): void {
    const key = this.getCacheKey(sessionId, remotePath);
    this.dirCache.delete(key);

    // Also invalidate parent directory
    const clean = remotePath.replace(/\/+$/, '');
    const lastSlash = clean.lastIndexOf('/');
    if (lastSlash >= 0) {
      const parent = clean.substring(0, lastSlash) || '/';
      this.dirCache.delete(this.getCacheKey(sessionId, parent));
    }
  }

  public clearCacheForSession(sessionId: string): void {
    for (const key of this.dirCache.keys()) {
      if (key.startsWith(`${sessionId}:`)) {
        this.dirCache.delete(key);
      }
    }
  }

  public closeSession(sessionId: string): void {
    const sftp = this.sftpSessions.get(sessionId);
    if (sftp) {
      try {
        sftp.end();
      } catch {}
      this.sftpSessions.delete(sessionId);
    }
    this.pendingSftpPromises.delete(sessionId);
    this.clearCacheForSession(sessionId);
  }

  private async getSFTP(sessionId: string): Promise<SFTPWrapper> {
    const existing = this.sftpSessions.get(sessionId);
    if (existing) {
      return existing;
    }

    // Deduplicate concurrent calls for the same session to avoid opening multiple SFTP channels simultaneously
    const pending = this.pendingSftpPromises.get(sessionId);
    if (pending) {
      return pending;
    }

    const promise = (async () => {
      const session = this.sshManager.getSession(sessionId);
      if (!session || !session.client) {
        throw new Error(`SSH Session ${sessionId} not found or not connected`);
      }

      return new Promise<SFTPWrapper>((resolve, reject) => {
        let isSettled = false;
        const cleanup = () => {
          this.sftpSessions.delete(sessionId);
          this.pendingSftpPromises.delete(sessionId);
          this.clearCacheForSession(sessionId);
        };

        session.client.sftp((err, sftp) => {
          if (isSettled) return;
          isSettled = true;

          if (err) {
            cleanup();
            return reject(err);
          }

          this.sftpSessions.set(sessionId, sftp);

          sftp.on('close', cleanup);
          sftp.on('end', cleanup);
          sftp.on('error', (wrapErr: any) => {
            console.warn(`[SFTPManager] SFTP channel error on session ${sessionId}:`, wrapErr?.message || wrapErr);
            cleanup();
          });

          resolve(sftp);
        });
      });
    })();

    this.pendingSftpPromises.set(sessionId, promise);
    try {
      return await promise;
    } finally {
      this.pendingSftpPromises.delete(sessionId);
    }
  }

  private formatPermissions(mode: number): string {
    const isDir = (mode & 0o040000) === 0o040000;
    const isSymlink = (mode & 0o120000) === 0o120000;
    const prefix = isDir ? 'd' : isSymlink ? 'l' : '-';

    const chars = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
    const u = chars[(mode >> 6) & 7];
    const g = chars[(mode >> 3) & 7];
    const o = chars[mode & 7];

    return `${prefix}${u}${g}${o}`;
  }

  public async listDirectory(
    sessionId: string,
    remotePath: string = '.',
    forceRefresh: boolean = false
  ): Promise<{ currentPath: string; files: SFTPFile[] }> {
    try {
      return await this.executeListDirectory(sessionId, remotePath, forceRefresh);
    } catch (err: any) {
      const isChannelError =
        err?.message?.includes('Channel open failure') ||
        err?.message?.includes('No SFTP connection') ||
        err?.message?.includes('closed') ||
        err?.reason === 2;

      if (isChannelError) {
        console.warn(`[SFTPManager] Transient channel error on session ${sessionId}. Resetting channel and retrying...`);
        this.closeSession(sessionId);
        const session = this.sshManager.getSession(sessionId);
        if (session && session.client) {
          await new Promise((r) => setTimeout(r, 150));
          return await this.executeListDirectory(sessionId, remotePath, true);
        }
      }
      throw err;
    }
  }

  private async executeListDirectory(
    sessionId: string,
    remotePath: string = '.',
    forceRefresh: boolean = false
  ): Promise<{ currentPath: string; files: SFTPFile[] }> {
    const sftp = await this.getSFTP(sessionId);

    // Normalize tilde and relative paths
    let pathToResolve = (!remotePath || remotePath === '~' || remotePath === '.') ? '.' : remotePath;

    // Expand ~/ if path starts with ~/
    if (pathToResolve.startsWith('~/')) {
      const home = await new Promise<string>((res) => {
        sftp.realpath('.', (err, resolved) => {
          res(err ? '/root' : resolved);
        });
      });
      pathToResolve = `${home.replace(/\/+$/, '')}/${pathToResolve.slice(2)}`;
    }

    // Resolve realpath
    const realPath = await new Promise<string>((resolve) => {
      sftp.realpath(pathToResolve, (err, resolved) => {
        if (err) resolve(pathToResolve);
        else resolve(resolved);
      });
    });

    // Check fast in-memory directory cache
    const cacheKey = this.getCacheKey(sessionId, realPath);
    if (!forceRefresh) {
      const cached = this.dirCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return { currentPath: cached.currentPath, files: cached.files };
      }
    }

    return new Promise((resolve, reject) => {
      sftp.readdir(realPath, (err, list) => {
        if (err) {
          // If directory listing fails because path does not exist, return empty list gracefully
          if ((err as any).code === 2) {
            return resolve({ currentPath: realPath, files: [] });
          }
          return reject(err);
        }

        const files: SFTPFile[] = list.map((item) => {
          const isDir = (item.attrs.mode & 0o040000) === 0o040000;
          const isLink = (item.attrs.mode & 0o120000) === 0o120000;
          const fullPath = realPath.endsWith('/')
            ? `${realPath}${item.filename}`
            : `${realPath}/${item.filename}`;

          return {
            name: item.filename,
            path: fullPath,
            isDirectory: isDir,
            isSymlink: isLink,
            size: item.attrs.size || 0,
            permissions: this.formatPermissions(item.attrs.mode),
            numericPermissions: item.attrs.mode & 0o777,
            modifyTime: (item.attrs.mtime || 0) * 1000,
            owner: item.attrs.uid,
            group: item.attrs.gid,
          };
        });

        // Sort directories first, then alphabetical
        files.sort((a, b) => {
          if (a.isDirectory && !b.isDirectory) return -1;
          if (!a.isDirectory && b.isDirectory) return 1;
          return a.name.localeCompare(b.name);
        });

        this.dirCache.set(cacheKey, {
          currentPath: realPath,
          files,
          timestamp: Date.now(),
        });

        resolve({ currentPath: realPath, files });
      });
    });
  }

  public async readFile(sessionId: string, remotePath: string): Promise<string> {
    const sftp = await this.getSFTP(sessionId);

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          reject(new Error(`SFTP read timeout for ${remotePath}`));
        }
      }, 15000);

      sftp.readFile(remotePath, (err: any, buffer: Buffer) => {
        if (isSettled) return;
        clearTimeout(timer);
        isSettled = true;
        if (err) {
          return reject(err);
        }
        resolve(buffer.toString('utf-8'));
      });
    });
  }

  public async writeFile(sessionId: string, remotePath: string, content: string): Promise<void> {
    const sftp = await this.getSFTP(sessionId);

    return new Promise((resolve, reject) => {
      let isSettled = false;
      const timer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          reject(new Error(`SFTP write timeout for ${remotePath}`));
        }
      }, 15000);

      sftp.writeFile(remotePath, Buffer.from(content, 'utf-8'), (err: any) => {
        if (isSettled) return;
        clearTimeout(timer);
        isSettled = true;
        if (err) return reject(err);
        this.invalidateCacheForPath(sessionId, remotePath);
        resolve();
      });
    });
  }

  public async sudoWriteFile(
    sessionId: string,
    remotePath: string,
    content: string,
    sudoPassword?: string
  ): Promise<void> {
    const session = this.sshManager.getSession(sessionId);
    if (!session || !session.client) {
      throw new Error(`SSH Session ${sessionId} not found`);
    }

    // Security: Prevent path traversal attacks and reject control characters
    if (/[\x00-\x1f]/.test(remotePath)) {
      throw new Error('Invalid path: contains illegal control characters');
    }

    // Step 1: Upload to a secure temporary file in /tmp via standard SFTP
    // /tmp has 1777 permissions and is always writable by any remote user
    const tempFileName = `.bestty_save_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const tempPath = `/tmp/${tempFileName}`;

    await this.writeFile(sessionId, tempPath, content);

    // Step 2: Elevate via sudo to copy the temp file to destination
    const safeTempPath = `'${tempPath.replace(/'/g, "'\\''")}'`;
    const safeDestPath = `'${remotePath.replace(/'/g, "'\\''")}'`;

    const passwordToTry = sudoPassword ?? (session.host && session.host.password) ?? '';

    const runExec = (cmd: string, inputData?: string): Promise<{ code: number; stdout: string; stderr: string }> => {
      return new Promise((resolve, reject) => {
        let settled = false;
        let exitCode: number | null = null;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve({ code: exitCode ?? 0, stdout: '', stderr: 'Execution timeout' });
          }
        }, 15000);

        session.client.exec(cmd, { pty: false }, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            settled = true;
            return reject(err);
          }

          let stdout = '';
          let stderr = '';

          stream.on('exit', (c) => {
            exitCode = c;
          });

          stream.on('data', (d: Buffer) => {
            stdout += d.toString();
          });

          stream.stderr.on('data', (d: Buffer) => {
            stderr += d.toString();
          });

          stream.on('close', (code: number) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve({ code: exitCode ?? code ?? 0, stdout, stderr });
          });

          stream.on('error', (e: any) => {
            if (!settled) {
              settled = true;
              clearTimeout(timer);
              reject(e);
            }
          });

          if (inputData !== undefined) {
            stream.write(inputData);
          }
          stream.end();
          stream.resume();
          stream.stderr.resume();
        });
      });
    };

    try {
      let result: { code: number; stdout: string; stderr: string };

      if (passwordToTry) {
        // Use sudo -S to read password from stdin
        const cmd = `sudo -S -p '' -- cp -f ${safeTempPath} ${safeDestPath} && rm -f ${safeTempPath}`;
        result = await runExec(cmd, `${passwordToTry}\n`);
      } else {
        // Try passwordless sudo (-n)
        const cmd = `sudo -n -- cp -f ${safeTempPath} ${safeDestPath} && rm -f ${safeTempPath}`;
        result = await runExec(cmd);
      }

      if (result.code === 0) {
        this.invalidateCacheForPath(sessionId, remotePath);
        return;
      }

      const combinedErr = (result.stderr + '\n' + result.stdout).trim();

      // Check if sudo failed because password or TTY was required
      const isPasswordError =
        /password/i.test(combinedErr) ||
        /no tty/i.test(combinedErr) ||
        /terminal is required/i.test(combinedErr) ||
        /askpass/i.test(combinedErr);

      if (isPasswordError) {
        throw new Error(`SUDO_PASSWORD_REQUIRED: ${combinedErr || 'Password required for sudo elevation'}`);
      }

      throw new Error(`Sudo save failed (code ${result.code}): ${combinedErr}`);
    } finally {
      // Always cleanup temp file if it still exists
      this.deleteFile(sessionId, tempPath, false).catch(() => {});
    }
  }

  public async mkdir(sessionId: string, remotePath: string): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    return new Promise((resolve, reject) => {
      sftp.mkdir(remotePath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.invalidateCacheForPath(sessionId, remotePath);
          resolve();
        }
      });
    });
  }

  public async deleteFile(sessionId: string, remotePath: string, isDirectory?: boolean): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    const session = this.sshManager.getSession(sessionId);

    this.invalidateCacheForPath(sessionId, remotePath);

    if (session && session.client) {
      return new Promise<void>((resolve, reject) => {
        const safePath = `'${remotePath.replace(/'/g, "'\\''")}'`;
        const cmd = `rm -rf -- ${safePath}`;

        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            this.invalidateCacheForPath(sessionId, remotePath);
            resolve();
          }
        }, 15000);

        session.client.exec(cmd, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            settled = true;
            return this.deleteViaSFTP(sftp, remotePath, isDirectory).then(resolve, reject);
          }

          let exitCode: number | null = null;
          let stderrText = '';

          stream.on('exit', (code) => {
            exitCode = code;
          });

          stream.stderr.on('data', (chunk) => {
            stderrText += chunk.toString();
          });

          stream.on('data', () => {}); // drain stdout

          stream.on('close', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            this.invalidateCacheForPath(sessionId, remotePath);

            if (exitCode === 0 || exitCode === null) {
              resolve();
            } else {
              if (stderrText.toLowerCase().includes('permission denied')) {
                reject(new Error(stderrText.trim()));
              } else {
                this.deleteViaSFTP(sftp, remotePath, isDirectory).then(resolve, reject);
              }
            }
          });

          stream.on('error', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            this.deleteViaSFTP(sftp, remotePath, isDirectory).then(resolve, reject);
          });

          stream.resume();
          stream.stderr.resume();
        });
      });
    }

    return this.deleteViaSFTP(sftp, remotePath, isDirectory);
  }

  public async deleteBatch(sessionId: string, remotePaths: string[]): Promise<void> {
    if (remotePaths.length === 0) return;
    const sftp = await this.getSFTP(sessionId);
    const session = this.sshManager.getSession(sessionId);

    for (const p of remotePaths) {
      this.invalidateCacheForPath(sessionId, p);
    }

    if (session && session.client) {
      return new Promise<void>((resolve, reject) => {
        const safePaths = remotePaths.map((p) => `'${p.replace(/'/g, "'\\''")}'`).join(' ');
        const cmd = `rm -rf -- ${safePaths}`;

        let settled = false;
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            resolve();
          }
        }, 20000);

        session.client.exec(cmd, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            settled = true;
            return Promise.all(remotePaths.map((p) => this.deleteViaSFTP(sftp, p))).then(() => resolve(), reject);
          }

          let exitCode: number | null = null;
          let stderrText = '';

          stream.on('exit', (code) => {
            exitCode = code;
          });

          stream.stderr.on('data', (chunk) => {
            stderrText += chunk.toString();
          });

          stream.on('data', () => {}); // drain stdout

          stream.on('close', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            for (const p of remotePaths) {
              this.invalidateCacheForPath(sessionId, p);
            }
            if (exitCode === 0 || exitCode === null) {
              resolve();
            } else {
              if (stderrText.toLowerCase().includes('permission denied')) {
                reject(new Error(stderrText.trim()));
              } else {
                Promise.all(remotePaths.map((p) => this.deleteViaSFTP(sftp, p))).then(() => resolve(), reject);
              }
            }
          });

          stream.on('error', () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            Promise.all(remotePaths.map((p) => this.deleteViaSFTP(sftp, p))).then(() => resolve(), reject);
          });

          stream.resume();
          stream.stderr.resume();
        });
      });
    }

    for (const p of remotePaths) {
      await this.deleteViaSFTP(sftp, p);
    }
  }

  private async deleteViaSFTP(sftp: SFTPWrapper, remotePath: string, isDirectory?: boolean): Promise<void> {
    let isDir = isDirectory;
    if (isDir === undefined) {
      try {
        const stat = await new Promise<any>((res, rej) => sftp.stat(remotePath, (e, s) => (e ? rej(e) : res(s))));
        isDir = (stat.mode & 0o040000) === 0o040000;
      } catch {
        isDir = false;
      }
    }

    if (!isDir) {
      return new Promise((resolve, reject) => {
        sftp.unlink(remotePath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    let entries: any[] = [];
    try {
      entries = await new Promise<any[]>((resolve, reject) => {
        sftp.readdir(remotePath, (err, list) => {
          if (err) reject(err);
          else resolve(list || []);
        });
      });
    } catch {}

    for (const entry of entries) {
      if (entry.filename === '.' || entry.filename === '..') continue;
      const subPath = `${remotePath.replace(/\/+$/, '')}/${entry.filename}`;
      const subIsDir = (entry.attrs.mode & 0o040000) === 0o040000;
      await this.deleteViaSFTP(sftp, subPath, subIsDir);
    }

    return new Promise((resolve, reject) => {
      sftp.rmdir(remotePath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async copyFile(sessionId: string, srcPath: string, destPath: string): Promise<void> {
    const session = this.sshManager.getSession(sessionId);
    if (!session || !session.client) {
      throw new Error(`SSH Session ${sessionId} not found`);
    }

    const safeSrc = `'${srcPath.replace(/'/g, "'\\''")}'`;
    const safeDest = `'${destPath.replace(/'/g, "'\\''")}'`;
    const cmd = `cp -r -- ${safeSrc} ${safeDest}`;

    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.invalidateCacheForPath(sessionId, destPath);
          this.invalidateCacheForPath(sessionId, srcPath);
          resolve();
        }
      }, 15000);

      session.client.exec(cmd, (err, stream) => {
        if (err) {
          clearTimeout(timer);
          settled = true;
          return reject(err);
        }

        let exitCode: number | null = null;
        let stderrText = '';

        stream.on('exit', (code) => {
          exitCode = code;
        });

        stream.stderr.on('data', (chunk) => {
          stderrText += chunk.toString();
        });

        stream.on('data', () => {}); // drain stdout

        stream.on('close', () => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          this.invalidateCacheForPath(sessionId, destPath);
          this.invalidateCacheForPath(sessionId, srcPath);

          if (exitCode === 0 || exitCode === null) {
            resolve();
          } else {
            reject(new Error(`Remote copy failed (exit code ${exitCode}): ${stderrText.trim()}`));
          }
        });

        stream.on('error', (e: any) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(e);
          }
        });

        stream.resume();
        stream.stderr.resume();
      });
    });
  }

  public async ensureRemoteDir(sftp: SFTPWrapper, remoteDir: string): Promise<void> {
    const normalized = remoteDir.replace(/\\/g, '/');
    const segments = normalized.split('/').filter(Boolean);
    let current = normalized.startsWith('/') ? '' : '.';
    for (const segment of segments) {
      current = `${current}/${segment}`;
      await new Promise<void>((resolve) => {
        sftp.stat(current, (err, stats) => {
          if (err || !stats || (stats.mode & 0o040000) !== 0o040000) {
            sftp.mkdir(current, () => resolve());
          } else {
            resolve();
          }
        });
      });
    }
  }

  public async uploadDirectory(
    sessionId: string,
    localDir: string,
    remoteDir: string,
    onFileUploaded?: (fileRelPath: string, bytes: number) => void
  ): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    await this.ensureRemoteDir(sftp, remoteDir);

    const entries = await fs.promises.readdir(localDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryLocalPath = path.join(localDir, entry.name);
      const entryRemotePath = `${remoteDir.replace(/\/+$/, '')}/${entry.name}`;

      if (entry.isDirectory()) {
        await this.uploadDirectory(sessionId, entryLocalPath, entryRemotePath, onFileUploaded);
      } else {
        await new Promise<void>((resolve, reject) => {
          sftp.fastPut(entryLocalPath, entryRemotePath, (err) => {
            if (err) return reject(err);
            this.invalidateCacheForPath(sessionId, entryRemotePath);
            try {
              const stat = fs.statSync(entryLocalPath);
              onFileUploaded?.(entry.name, stat.size);
            } catch {
              onFileUploaded?.(entry.name, 0);
            }
            resolve();
          });
        });
      }
    }
  }

  public async downloadDirectory(
    sessionId: string,
    remoteDir: string,
    localDir: string,
    onFileDownloaded?: (fileRelPath: string, bytes: number) => void
  ): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    await fs.promises.mkdir(localDir, { recursive: true });

    const entries = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(remoteDir, (err, list) => {
        if (err) return reject(err);
        resolve(list || []);
      });
    });

    for (const entry of entries) {
      if (entry.filename === '.' || entry.filename === '..') continue;
      const entryRemotePath = `${remoteDir.replace(/\/+$/, '')}/${entry.filename}`;
      const entryLocalPath = path.join(localDir, entry.filename);

      const isDir = (entry.attrs.mode & 0o040000) === 0o040000;
      if (isDir) {
        await this.downloadDirectory(sessionId, entryRemotePath, entryLocalPath, onFileDownloaded);
      } else {
        await new Promise<void>((resolve, reject) => {
          sftp.fastGet(entryRemotePath, entryLocalPath, (err) => {
            if (err) return reject(err);
            onFileDownloaded?.(entry.filename, entry.attrs.size || 0);
            resolve();
          });
        });
      }
    }
  }

  public async uploadFile(
    sessionId: string,
    localPath: string,
    remotePath: string,
    onProgress?: (bytes: number) => void
  ): Promise<void> {
    const stat = await fs.promises.lstat(localPath);
    if (stat.isDirectory()) {
      await this.uploadDirectory(sessionId, localPath, remotePath, (_, bytes) => {
        onProgress?.(bytes);
      });
      this.invalidateCacheForPath(sessionId, remotePath);
      return;
    }

    const sftp = await this.getSFTP(sessionId);
    const lastSlash = remotePath.lastIndexOf('/');
    if (lastSlash > 0) {
      await this.ensureRemoteDir(sftp, remotePath.substring(0, lastSlash));
    }

    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, {
        chunkSize: 32768,
        concurrency: 64,
        step: (transferred) => {
          onProgress?.(transferred);
        },
      }, (err) => {
        if (err) {
          reject(err);
        } else {
          this.invalidateCacheForPath(sessionId, remotePath);
          onProgress?.(stat.size);
          resolve();
        }
      });
    });
  }

  public async downloadFile(
    sessionId: string,
    remotePath: string,
    localPath: string,
    onProgress?: (bytes: number) => void
  ): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    const remoteStat = await new Promise<any>((resolve, reject) => {
      sftp.stat(remotePath, (err, stats) => {
        if (err) reject(err);
        else resolve(stats);
      });
    });

    const isDir = (remoteStat.mode & 0o040000) === 0o040000;
    if (isDir) {
      await this.downloadDirectory(sessionId, remotePath, localPath, (_, bytes) => {
        onProgress?.(bytes);
      });
      return;
    }

    await fs.promises.mkdir(path.dirname(localPath), { recursive: true });
    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, {
        chunkSize: 32768,
        concurrency: 64,
        step: (transferred) => {
          onProgress?.(transferred);
        },
      }, (err) => {
        if (err) reject(err);
        else {
          onProgress?.(remoteStat.size || 0);
          resolve();
        }
      });
    });
  }

  public async uploadBatch(
    sessionId: string,
    items: Array<{ localPath: string; remoteDest: string }>,
    conflictPolicy: 'overwrite' | 'skip' | 'rename' = 'overwrite',
    progressCallback?: (payload: any) => void
  ): Promise<{ success: boolean; errors: string[] }> {
    const sftp = await this.getSFTP(sessionId);
    const transferId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const errors: string[] = [];

    // 1. Scan and plan all files & directories
    const dirsToCreate = new Set<string>();
    const filesToUpload: Array<{ localPath: string; remotePath: string; displayName: string; size: number }> = [];

    for (const item of items) {
      try {
        const stat = await fs.promises.stat(item.localPath);
        if (stat.isDirectory()) {
          dirsToCreate.add(item.remoteDest.replace(/\\/g, '/'));

          const walk = async (currentLocal: string, currentRemote: string, relPrefix: string) => {
            const entries = await fs.promises.readdir(currentLocal, { withFileTypes: true });
            for (const entry of entries) {
              const subLocal = path.join(currentLocal, entry.name);
              const subRemote = `${currentRemote.replace(/\/+$/, '')}/${entry.name}`;
              const subRel = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;

              if (entry.isDirectory()) {
                dirsToCreate.add(subRemote);
                await walk(subLocal, subRemote, subRel);
              } else if (entry.isFile()) {
                try {
                  const s = await fs.promises.stat(subLocal);
                  filesToUpload.push({
                    localPath: subLocal,
                    remotePath: subRemote,
                    displayName: subRel,
                    size: s.size,
                  });
                } catch {
                  filesToUpload.push({
                    localPath: subLocal,
                    remotePath: subRemote,
                    displayName: subRel,
                    size: 0,
                  });
                }
              }
            }
          };

          await walk(item.localPath, item.remoteDest.replace(/\\/g, '/'), path.basename(item.localPath));
        } else {
          // File
          const remoteDir = path.dirname(item.remoteDest).replace(/\\/g, '/');
          dirsToCreate.add(remoteDir);
          filesToUpload.push({
            localPath: item.localPath,
            remotePath: item.remoteDest.replace(/\\/g, '/'),
            displayName: path.basename(item.localPath),
            size: stat.size,
          });
        }
      } catch (err: any) {
        errors.push(`${path.basename(item.localPath)}: ${err.message}`);
      }
    }

    const totalFiles = filesToUpload.length;
    const totalBytes = filesToUpload.reduce((acc, f) => acc + f.size, 0);
    const startTime = Date.now();
    let completedFiles = 0;
    let completedBytesSoFar = 0;
    let lastProgressEmit = 0;

    progressCallback?.({
      transferId,
      type: 'upload',
      status: 'starting',
      currentFile: filesToUpload[0]?.displayName || (items[0] ? path.basename(items[0].localPath) : ''),
      fileIndex: 0,
      totalFiles,
      bytesTransferred: 0,
      totalBytes,
      speedBytesPerSec: 0,
    });

    // 2. Ensure all remote directories exist
    const sortedDirs = Array.from(dirsToCreate).sort((a, b) => a.split('/').length - b.split('/').length);
    for (const dir of sortedDirs) {
      if (dir && dir !== '/' && dir !== '.') {
        await this.ensureRemoteDir(sftp, dir);
      }
    }

    // If no files to upload (e.g. only empty folders), finish now
    if (totalFiles === 0) {
      progressCallback?.({
        transferId,
        type: 'upload',
        status: errors.length > 0 ? 'error' : 'completed',
        currentFile: '',
        fileIndex: 0,
        totalFiles: 0,
        bytesTransferred: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      });
      return { success: errors.length === 0, errors };
    }

    // 3. Upload all files sequentially with live chunk progress & conflict handling
    for (let i = 0; i < filesToUpload.length; i++) {
      const file = filesToUpload[i];
      let targetRemotePath = file.remotePath;

      // Conflict handling if file exists remotely
      if (conflictPolicy === 'skip' || conflictPolicy === 'rename') {
        let exists = false;
        try {
          await new Promise<void>((res, rej) => {
            sftp.stat(targetRemotePath, (err) => (err ? rej(err) : res()));
          });
          exists = true;
        } catch {
          exists = false;
        }

        if (exists) {
          if (conflictPolicy === 'skip') {
            completedFiles++;
            completedBytesSoFar += file.size;
            progressCallback?.({
              transferId,
              type: 'upload',
              status: 'progress',
              currentFile: `${file.displayName} (пропущен)`,
              fileIndex: completedFiles,
              totalFiles,
              bytesTransferred: completedBytesSoFar,
              totalBytes,
              speedBytesPerSec: 0,
            });
            continue;
          } else if (conflictPolicy === 'rename') {
            const dir = path.dirname(targetRemotePath).replace(/\\/g, '/');
            const ext = path.extname(targetRemotePath);
            const base = path.basename(targetRemotePath, ext);
            let counter = 1;
            let candidate = `${dir}/${base} (${counter})${ext}`;
            while (counter < 100) {
              try {
                await new Promise<void>((res, rej) => {
                  sftp.stat(candidate, (err) => (err ? rej(err) : res()));
                });
                counter++;
                candidate = `${dir}/${base} (${counter})${ext}`;
              } catch {
                break;
              }
            }
            targetRemotePath = candidate;
          }
        }
      }

      const parentDir = path.dirname(targetRemotePath).replace(/\\/g, '/');
      await this.ensureRemoteDir(sftp, parentDir);

      try {
        await new Promise<void>((resolve, reject) => {
          sftp.fastPut(file.localPath, targetRemotePath, {
            chunkSize: 32768,
            concurrency: 64,
            step: (transferredChunk) => {
              const now = Date.now();
              if (now - lastProgressEmit >= 100) {
                lastProgressEmit = now;
                const currentTotal = completedBytesSoFar + transferredChunk;
                const elapsedSec = (now - startTime) / 1000 || 0.1;
                const speed = Math.round(currentTotal / elapsedSec);

                progressCallback?.({
                  transferId,
                  type: 'upload',
                  status: 'progress',
                  currentFile: file.displayName,
                  fileIndex: completedFiles + 1,
                  totalFiles,
                  bytesTransferred: currentTotal,
                  totalBytes,
                  speedBytesPerSec: speed,
                });
              }
            },
          }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        completedBytesSoFar += file.size;
        completedFiles++;
        this.invalidateCacheForPath(sessionId, targetRemotePath);

        const now = Date.now();
        lastProgressEmit = now;
        const elapsedSec = (now - startTime) / 1000 || 0.1;
        const speed = Math.round(completedBytesSoFar / elapsedSec);

        progressCallback?.({
          transferId,
          type: 'upload',
          status: 'progress',
          currentFile: file.displayName,
          fileIndex: completedFiles,
          totalFiles,
          bytesTransferred: completedBytesSoFar,
          totalBytes,
          speedBytesPerSec: speed,
        });
      } catch (err: any) {
        errors.push(`${file.displayName}: ${err.message}`);
      }
    }

    const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
    progressCallback?.({
      transferId,
      type: 'upload',
      status: errors.length === totalFiles && totalFiles > 0 ? 'error' : 'completed',
      currentFile: '',
      fileIndex: completedFiles,
      totalFiles,
      bytesTransferred: completedBytesSoFar,
      totalBytes,
      speedBytesPerSec: Math.round(completedBytesSoFar / elapsedSec),
      error: errors.length > 0 ? errors.join('; ') : undefined,
    });

    return { success: errors.length === 0, errors };
  }

  public async downloadBatch(
    sessionId: string,
    items: Array<{ remotePath: string; localDest: string }>,
    progressCallback?: (payload: any) => void
  ): Promise<{ success: boolean; errors: string[] }> {
    const sftp = await this.getSFTP(sessionId);
    const transferId = `down_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const errors: string[] = [];

    // 1. Scan and plan all files & directories
    const filesToDownload: Array<{ remotePath: string; localPath: string; displayName: string; size: number }> = [];

    for (const item of items) {
      try {
        const stat = await new Promise<any>((resolve, reject) => {
          sftp.stat(item.remotePath, (err, stats) => {
            if (err) reject(err);
            else resolve(stats);
          });
        });

        const isDir = (stat.mode & 0o040000) === 0o040000;
        if (isDir) {
          await fs.promises.mkdir(item.localDest, { recursive: true });

          const walkRemote = async (currRemote: string, currLocal: string, relPrefix: string) => {
            await fs.promises.mkdir(currLocal, { recursive: true });
            const entries = await new Promise<any[]>((resolve, reject) => {
              sftp.readdir(currRemote, (err, list) => {
                if (err) reject(err);
                else resolve(list || []);
              });
            });

            for (const entry of entries) {
              if (entry.filename === '.' || entry.filename === '..') continue;
              const subRemote = `${currRemote.replace(/\/+$/, '')}/${entry.filename}`;
              const subLocal = path.join(currLocal, entry.filename);
              const subRel = relPrefix ? `${relPrefix}/${entry.filename}` : entry.filename;
              const isSubDir = (entry.attrs.mode & 0o040000) === 0o040000;

              if (isSubDir) {
                await walkRemote(subRemote, subLocal, subRel);
              } else {
                filesToDownload.push({
                  remotePath: subRemote,
                  localPath: subLocal,
                  displayName: subRel,
                  size: entry.attrs.size || 0,
                });
              }
            }
          };

          await walkRemote(item.remotePath, item.localDest, path.basename(item.remotePath));
        } else {
          await fs.promises.mkdir(path.dirname(item.localDest), { recursive: true });
          filesToDownload.push({
            remotePath: item.remotePath,
            localPath: item.localDest,
            displayName: path.basename(item.remotePath),
            size: stat.size || 0,
          });
        }
      } catch (err: any) {
        errors.push(`${path.basename(item.remotePath)}: ${err.message}`);
      }
    }

    const totalFiles = filesToDownload.length;
    const totalBytes = filesToDownload.reduce((acc, f) => acc + f.size, 0);
    const startTime = Date.now();
    let completedFiles = 0;
    let completedBytesSoFar = 0;
    let lastProgressEmit = 0;

    progressCallback?.({
      transferId,
      type: 'download',
      status: 'starting',
      currentFile: filesToDownload[0]?.displayName || '',
      fileIndex: 0,
      totalFiles,
      bytesTransferred: 0,
      totalBytes,
      speedBytesPerSec: 0,
    });

    if (totalFiles === 0) {
      progressCallback?.({
        transferId,
        type: 'download',
        status: errors.length > 0 ? 'error' : 'completed',
        currentFile: '',
        fileIndex: 0,
        totalFiles: 0,
        bytesTransferred: 0,
        totalBytes: 0,
        speedBytesPerSec: 0,
        error: errors.length > 0 ? errors.join('; ') : undefined,
      });
      return { success: errors.length === 0, errors };
    }

    for (let i = 0; i < filesToDownload.length; i++) {
      const file = filesToDownload[i];
      await fs.promises.mkdir(path.dirname(file.localPath), { recursive: true });

      try {
        await new Promise<void>((resolve, reject) => {
          sftp.fastGet(file.remotePath, file.localPath, {
            chunkSize: 32768,
            concurrency: 64,
            step: (transferredChunk) => {
              const now = Date.now();
              if (now - lastProgressEmit >= 100) {
                lastProgressEmit = now;
                const currentTotal = completedBytesSoFar + transferredChunk;
                const elapsedSec = (now - startTime) / 1000 || 0.1;
                const speed = Math.round(currentTotal / elapsedSec);

                progressCallback?.({
                  transferId,
                  type: 'download',
                  status: 'progress',
                  currentFile: file.displayName,
                  fileIndex: completedFiles + 1,
                  totalFiles,
                  bytesTransferred: currentTotal,
                  totalBytes,
                  speedBytesPerSec: speed,
                });
              }
            },
          }, (err) => {
            if (err) reject(err);
            else resolve();
          });
        });

        completedBytesSoFar += file.size;
        completedFiles++;

        const now = Date.now();
        lastProgressEmit = now;
        const elapsedSec = (now - startTime) / 1000 || 0.1;
        const speed = Math.round(completedBytesSoFar / elapsedSec);

        progressCallback?.({
          transferId,
          type: 'download',
          status: 'progress',
          currentFile: file.displayName,
          fileIndex: completedFiles,
          totalFiles,
          bytesTransferred: completedBytesSoFar,
          totalBytes,
          speedBytesPerSec: speed,
        });
      } catch (err: any) {
        errors.push(`${file.displayName}: ${err.message}`);
      }
    }

    const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
    progressCallback?.({
      transferId,
      type: 'download',
      status: errors.length === totalFiles && totalFiles > 0 ? 'error' : 'completed',
      currentFile: '',
      fileIndex: completedFiles,
      totalFiles,
      bytesTransferred: completedBytesSoFar,
      totalBytes,
      speedBytesPerSec: Math.round(completedBytesSoFar / elapsedSec),
      error: errors.length > 0 ? errors.join('; ') : undefined,
    });

    return { success: errors.length === 0, errors };
  }

  public async rename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.invalidateCacheForPath(sessionId, oldPath);
          this.invalidateCacheForPath(sessionId, newPath);
          resolve();
        }
      });
    });
  }

  public async chmod(sessionId: string, remotePath: string, mode: number): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    return new Promise((resolve, reject) => {
      sftp.chmod(remotePath, mode, (err) => {
        if (err) {
          reject(err);
        } else {
          this.invalidateCacheForPath(sessionId, remotePath);
          resolve();
        }
      });
    });
  }
}
