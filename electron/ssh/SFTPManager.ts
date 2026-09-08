import { SFTPWrapper } from 'ssh2';
import { SSHClientManager } from './SSHClientManager';
import { SFTPFile } from '../../src/types';

interface CachedDir {
  currentPath: string;
  files: SFTPFile[];
  timestamp: number;
}

export class SFTPManager {
  private sftpSessions: Map<string, SFTPWrapper> = new Map();
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

  private async getSFTP(sessionId: string): Promise<SFTPWrapper> {
    const existing = this.sftpSessions.get(sessionId);
    if (existing) {
      return existing;
    }

    const session = this.sshManager.getSession(sessionId);
    if (!session || !session.client) {
      throw new Error(`SSH Session ${sessionId} not found or not connected`);
    }

    return new Promise((resolve, reject) => {
      session.client.sftp((err, sftp) => {
        if (err) {
          return reject(err);
        }
        this.sftpSessions.set(sessionId, sftp);
        sftp.on('close', () => {
          this.sftpSessions.delete(sessionId);
          this.clearCacheForSession(sessionId);
        });
        resolve(sftp);
      });
    });
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
    const sftp = await this.getSFTP(sessionId);

    // Resolve realpath
    const realPath = await new Promise<string>((resolve) => {
      sftp.realpath(remotePath, (err, resolved) => {
        if (err) resolve(remotePath);
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

  public async sudoWriteFile(sessionId: string, remotePath: string, content: string): Promise<void> {
    const session = this.sshManager.getSession(sessionId);
    if (!session || !session.client) {
      throw new Error(`SSH Session ${sessionId} not found`);
    }

    // Security: Prevent path traversal attacks and reject control characters
    if (/[\x00-\x1f]/.test(remotePath)) {
      throw new Error('Invalid path: contains illegal control characters');
    }

    // POSIX shell-safe escaping: wrap in single quotes and escape embedded single quotes
    const safePath = `'${remotePath.replace(/'/g, "'\\''")}'`;

    return new Promise((resolve, reject) => {
      // Use sudo tee with properly escaped path to safely write protected file
      session.client.exec(`sudo tee -- ${safePath} > /dev/null`, (err, stream) => {
        if (err) return reject(err);

        stream.on('close', (code: number) => {
          if (code === 0) {
            this.invalidateCacheForPath(sessionId, remotePath);
            resolve();
          } else {
            reject(new Error(`sudo tee exited with code ${code}`));
          }
        });
        stream.on('error', (e: any) => reject(e));

        stream.write(content);
        stream.end();
      });
    });
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

  public async deleteFile(sessionId: string, remotePath: string, isDirectory: boolean): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    const session = this.sshManager.getSession(sessionId);

    return new Promise((resolve, reject) => {
      if (isDirectory) {
        sftp.rmdir(remotePath, (err) => {
          if (!err) {
            this.invalidateCacheForPath(sessionId, remotePath);
            return resolve();
          }
          // If rmdir fails (directory not empty), fallback to rm -rf via ssh client
          if (session && session.client) {
            const safePath = `'${remotePath.replace(/'/g, "'\\''")}'`;
            session.client.exec(`rm -rf -- ${safePath}`, (execErr, stream) => {
              if (execErr) return reject(err);
              stream.on('close', (code: number) => {
                if (code === 0) {
                  this.invalidateCacheForPath(sessionId, remotePath);
                  resolve();
                } else {
                  reject(new Error(`Delete directory failed with exit code ${code}`));
                }
              });
              stream.on('error', (e: any) => reject(e));
            });
          } else {
            reject(err);
          }
        });
      } else {
        sftp.unlink(remotePath, (err) => {
          if (err) {
            reject(err);
          } else {
            this.invalidateCacheForPath(sessionId, remotePath);
            resolve();
          }
        });
      }
    });
  }

  public async copyFile(sessionId: string, srcPath: string, destPath: string): Promise<void> {
    const session = this.sshManager.getSession(sessionId);
    if (!session || !session.client) {
      throw new Error(`SSH Session ${sessionId} not found`);
    }

    const safeSrc = `'${srcPath.replace(/'/g, "'\\''")}'`;
    const safeDest = `'${destPath.replace(/'/g, "'\\''")}'`;

    return new Promise((resolve, reject) => {
      session.client.exec(`cp -r -- ${safeSrc} ${safeDest}`, (err, stream) => {
        if (err) return reject(err);
        stream.on('close', (code: number) => {
          if (code === 0) {
            this.invalidateCacheForPath(sessionId, destPath);
            resolve();
          } else {
            reject(new Error(`Remote copy failed with code ${code}`));
          }
        });
        stream.on('error', (e: any) => reject(e));
      });
    });
  }

  public async uploadFile(sessionId: string, localPath: string, remotePath: string): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    return new Promise((resolve, reject) => {
      sftp.fastPut(localPath, remotePath, (err) => {
        if (err) {
          reject(err);
        } else {
          this.invalidateCacheForPath(sessionId, remotePath);
          resolve();
        }
      });
    });
  }

  public async downloadFile(sessionId: string, remotePath: string, localPath: string): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    return new Promise((resolve, reject) => {
      sftp.fastGet(remotePath, localPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
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
