import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SFTPFile } from '../../src/types';

export interface LocalDrive {
  name: string;
  path: string;
  isDrive: boolean;
}

export class LocalFSManager {
  private cachedDrives: LocalDrive[] | null = null;
  private lastDrivesScan: number = 0;
  private readonly DRIVES_CACHE_TTL = 60000; // 60 seconds

  /**
   * Detect accessible drives and common system locations on Windows/POSIX (cached with TTL)
   */
  public async getDrives(forceRefresh: boolean = false): Promise<LocalDrive[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedDrives && (now - this.lastDrivesScan < this.DRIVES_CACHE_TTL)) {
      return this.cachedDrives;
    }

    const drives: LocalDrive[] = [];

    if (process.platform === 'win32') {
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      for (const letter of letters) {
        const drivePath = `${letter}:\\`;
        try {
          if (fs.existsSync(drivePath)) {
            drives.push({
              name: `Local Disk (${letter}:)`,
              path: drivePath,
              isDrive: true,
            });
          }
        } catch {}
      }
    } else {
      drives.push({
        name: 'Root (/)',
        path: '/',
        isDrive: true,
      });
    }

    // Add User Profile Home directory
    const home = os.homedir();
    if (home) {
      drives.unshift({
        name: 'User Home',
        path: home,
        isDrive: false,
      });
    }

    this.cachedDrives = drives;
    this.lastDrivesScan = now;
    return drives;
  }

  private formatPermissions(mode: number, isDir: boolean): string {
    const prefix = isDir ? 'd' : '-';
    const chars = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
    const u = chars[(mode >> 6) & 7] || 'rw-';
    const g = chars[(mode >> 3) & 7] || 'r--';
    const o = chars[mode & 7] || 'r--';
    return `${prefix}${u}${g}${o}`;
  }

  public async listDirectory(dirPath?: string): Promise<{ currentPath: string; files: SFTPFile[]; drives: LocalDrive[] }> {
    let target = dirPath;
    if (!target) {
      target = os.homedir() || (process.platform === 'win32' ? 'C:\\' : '/');
    }

    // Normalize path
    target = path.resolve(target);

    const drives = await this.getDrives();

    try {
      const dirents = await fs.promises.readdir(target, { withFileTypes: true });

      // Run lstat calls in parallel across thread pool for max performance
      const files: SFTPFile[] = await Promise.all(
        dirents.map(async (dirent) => {
          const fullPath = path.join(target, dirent.name);
          const isDir = dirent.isDirectory();
          const isSymlink = dirent.isSymbolicLink();

          let size = 0;
          let mtime = Date.now();
          let mode = isDir ? 0o755 : 0o644;

          try {
            const stat = await fs.promises.lstat(fullPath);
            size = stat.size || 0;
            mtime = stat.mtimeMs || Date.now();
            mode = stat.mode || (isDir ? 0o755 : 0o644);
          } catch {
            // Unreadable or protected system file/broken symlink
          }

          return {
            name: dirent.name,
            path: fullPath,
            isDirectory: isDir,
            isSymlink,
            size,
            permissions: this.formatPermissions(mode, isDir),
            numericPermissions: mode & 0o777,
            modifyTime: mtime,
            owner: 0,
            group: 0,
          };
        })
      );

      // Sort directories first, then alphabetical
      files.sort((a, b) => {
        if (a.isDirectory === b.isDirectory) {
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        }
        return a.isDirectory ? -1 : 1;
      });

      return {
        currentPath: target,
        files,
        drives,
      };
    } catch (err: any) {
      return {
        currentPath: target,
        files: [],
        drives,
      };
    }
  }

  public async createDirectory(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  public async deleteFile(targetPath: string): Promise<void> {
    await fs.promises.rm(targetPath, { recursive: true, force: true });
  }

  public async deleteBatch(paths: string[]): Promise<void> {
    for (const targetPath of paths) {
      try {
        await fs.promises.rm(targetPath, { recursive: true, force: true });
      } catch (err) {
        console.error(`Failed to delete ${targetPath}:`, err);
      }
    }
  }

  public async renameFile(oldPath: string, newPath: string): Promise<void> {
    await fs.promises.rename(oldPath, newPath);
  }

  public async copyFile(srcPath: string, destPath: string): Promise<void> {
    const resolvedSrc = path.resolve(srcPath);
    const resolvedDest = path.resolve(destPath);
    if (resolvedSrc === resolvedDest) {
      throw new Error('Cannot copy file or folder into itself');
    }
    if (resolvedDest.startsWith(resolvedSrc + path.sep)) {
      throw new Error('Cannot copy a directory into its own subdirectory');
    }
    await fs.promises.cp(resolvedSrc, resolvedDest, { recursive: true });
  }

  public async readFile(targetPath: string): Promise<string> {
    return fs.promises.readFile(targetPath, 'utf-8');
  }

  public async writeFile(targetPath: string, content: string): Promise<void> {
    await fs.promises.writeFile(targetPath, content, 'utf-8');
  }
}
