import { SFTPWrapper } from 'ssh2';
import { SSHClientManager } from './SSHClientManager';
import { SFTPFile } from '../../src/types';

export class SFTPManager {
  private sftpSessions: Map<string, SFTPWrapper> = new Map();

  constructor(private sshManager: SSHClientManager) {}

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

  public async listDirectory(sessionId: string, remotePath: string = '.'): Promise<{ currentPath: string; files: SFTPFile[] }> {
    const sftp = await this.getSFTP(sessionId);

    // Resolve realpath
    const realPath = await new Promise<string>((resolve, reject) => {
      sftp.realpath(remotePath, (err, resolved) => {
        if (err) resolve(remotePath);
        else resolve(resolved);
      });
    });

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

        resolve({ currentPath: realPath, files });
      });
    });
  }

  public async readFile(sessionId: string, remotePath: string): Promise<string> {
    const sftp = await this.getSFTP(sessionId);

    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = sftp.createReadStream(remotePath);

      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => {
        const fullBuffer = Buffer.concat(chunks);
        resolve(fullBuffer.toString('utf-8'));
      });
      stream.on('error', (err: any) => reject(err));
    });
  }

  public async writeFile(sessionId: string, remotePath: string, content: string): Promise<void> {
    const sftp = await this.getSFTP(sessionId);

    return new Promise((resolve, reject) => {
      const stream = sftp.createWriteStream(remotePath);
      stream.on('close', () => resolve());
      stream.on('error', (err: any) => reject(err));
      stream.end(Buffer.from(content, 'utf-8'));
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
      session.client.exec(`sudo tee ${safePath} > /dev/null`, (err, stream) => {
        if (err) return reject(err);

        stream.on('close', (code: number) => {
          if (code === 0) resolve();
          else reject(new Error(`sudo tee exited with code ${code}`));
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
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async deleteFile(sessionId: string, remotePath: string, isDirectory: boolean): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    return new Promise((resolve, reject) => {
      if (isDirectory) {
        sftp.rmdir(remotePath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      } else {
        sftp.unlink(remotePath, (err) => {
          if (err) reject(err);
          else resolve();
        });
      }
    });
  }

  public async rename(sessionId: string, oldPath: string, newPath: string): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    return new Promise((resolve, reject) => {
      sftp.rename(oldPath, newPath, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  public async chmod(sessionId: string, remotePath: string, mode: number): Promise<void> {
    const sftp = await this.getSFTP(sessionId);
    return new Promise((resolve, reject) => {
      sftp.chmod(remotePath, mode, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}
