import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { HostProfile } from '../../src/types';

export interface SSHSessionInfo {
  id: string;
  hostId: string;
  title: string;
  client: Client;
  shellStream?: ClientChannel;
  currentDirectory: string;
  fingerprint?: string;
}

export const SSH_ALGORITHMS = {
  kex: {
    append: [
      'diffie-hellman-group-exchange-sha1',
      'diffie-hellman-group14-sha1',
      'diffie-hellman-group1-sha1',
    ],
  },
  cipher: {
    append: [
      'aes256-cbc',
      'aes192-cbc',
      'aes128-cbc',
      '3des-cbc',
    ],
  },
  serverHostKey: {
    append: [
      'ssh-rsa',
      'ssh-dss',
    ],
  },
  hmac: {
    append: [
      'hmac-sha1',
      'hmac-md5',
    ],
  },
};

function applyAuthConfig(config: ConnectConfig, host: HostProfile): void {
  if (host.authType === 'password') {
    if (host.password) {
      config.password = host.password;
    } else {
      // Smart fallback: try local ssh-agent or default user keys (~/.ssh/id_ed25519, ~/.ssh/id_rsa)
      const agentPipe = process.platform === 'win32'
        ? '\\\\.\\pipe\\openssh-ssh-agent'
        : process.env.SSH_AUTH_SOCK;
      config.agent = agentPipe;

      const homeDir = os.homedir();
      const defaultEd25519 = path.join(homeDir, '.ssh', 'id_ed25519');
      const defaultRsa = path.join(homeDir, '.ssh', 'id_rsa');
      if (fs.existsSync(defaultEd25519)) {
        try {
          config.privateKey = fs.readFileSync(defaultEd25519);
        } catch {
          // ignore
        }
      } else if (fs.existsSync(defaultRsa)) {
        try {
          config.privateKey = fs.readFileSync(defaultRsa);
        } catch {
          // ignore
        }
      }
    }
  } else if (host.authType === 'privateKey') {
    if (host.privateKeyContent) {
      config.privateKey = host.privateKeyContent;
    } else if (host.privateKeyPath && fs.existsSync(host.privateKeyPath)) {
      try {
        config.privateKey = fs.readFileSync(host.privateKeyPath);
      } catch {
        // ignore
      }
    }
    if (host.passphrase) {
      config.passphrase = host.passphrase;
    }
  } else if (host.authType === 'agent') {
    const agentPipe = process.platform === 'win32'
      ? '\\\\.\\pipe\\openssh-ssh-agent'
      : process.env.SSH_AUTH_SOCK;
    config.agent = agentPipe;
  }
}

export class SSHClientManager extends EventEmitter {
  private sessions: Map<string, SSHSessionInfo> = new Map();

  constructor() {
    super();
    // Safety: prevent Node.js Uncaught Exception if 'error' is emitted
    this.on('error', (err) => {
      console.warn('[SSHClientManager] Handled internal error:', err);
    });
  }

  public async connect(sessionId: string, host: HostProfile, cols: number = 80, rows: number = 24): Promise<void> {
    return new Promise((resolve, reject) => {
      let isResolved = false;
      const client = new Client();
      let detectedFingerprint = '';

      const config: ConnectConfig = {
        host: host.host,
        port: host.port || 22,
        username: host.username,
        keepaliveInterval: (host.keepAliveInterval || 30) * 1000,
        readyTimeout: 25000,
        tryKeyboard: true, // Enables PAM / keyboard-interactive authentication fallback
        hostHash: 'sha256',
        hostVerifier: (fingerprint: string) => {
          detectedFingerprint = `SHA256:${fingerprint}`;
          return true; // TOFU (Trust On First Use)
        },
        algorithms: SSH_ALGORITHMS as any,
      };

      // Configure Authentication
      applyAuthConfig(config, host);

      // Handle PAM / keyboard-interactive challenges (resolves 'All configured authentication methods failed')
      client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
        if (prompts && prompts.length > 0 && host.password) {
          finish(prompts.map(() => host.password!));
        } else {
          finish([]);
        }
      });

      client.on('ready', () => {
        // Open interactive PTY shell
        client.shell(
          {
            term: 'xterm-256color',
            cols: Math.max(cols, 20),
            rows: Math.max(rows, 10),
          },
          (err, stream) => {
            if (err) {
              client.end();
              if (!isResolved) {
                isResolved = true;
                return reject(err);
              }
              return;
            }

            const sessionInfo: SSHSessionInfo = {
              id: sessionId,
              hostId: host.id,
              title: host.name || `${host.username}@${host.host}`,
              client,
              shellStream: stream,
              currentDirectory: host.defaultPath || '~',
              fingerprint: detectedFingerprint || host.fingerprint,
            };

            this.sessions.set(sessionId, sessionInfo);

            // Handle incoming data from remote server
            stream.on('data', (data: Buffer) => {
              const str = data.toString('utf-8');

              // SmarTTY: Parse OSC 7 directory update sequence
              const osc7Match = str.match(/\x1b\]7;file:\/\/[^\/]*(\/[^\x07\x1b]*)(?:\x07|\x1b\\)/);
              if (osc7Match && osc7Match[1]) {
                const detectedDir = decodeURIComponent(osc7Match[1]);
                sessionInfo.currentDirectory = detectedDir;
                this.emit('directory-changed', { sessionId, directory: detectedDir });
              }

              this.emit('data', { sessionId, data: str });
            });

            stream.on('close', () => {
              this.emit('closed', { sessionId });
              this.disconnect(sessionId);
            });

            this.emit('connected', { sessionId, hostId: host.id, fingerprint: detectedFingerprint });
            if (!isResolved) {
              isResolved = true;
              resolve();
            }
          }
        );
      });

      client.on('error', (err) => {
        console.error(`SSH Client error for session ${sessionId}:`, err.message);
        this.emit('ssh-error', { sessionId, error: err.message });
        if (!isResolved) {
          isResolved = true;
          reject(err);
        }
      });

      client.on('end', () => {
        this.emit('disconnected', { sessionId });
      });

      client.on('close', () => {
        this.emit('closed', { sessionId });
      });

      try {
        client.connect(config);
      } catch (e: any) {
        if (!isResolved) {
          isResolved = true;
          reject(e);
        }
      }
    });
  }

  /**
   * Fast connection test handshake without spawning a shell.
   * Resolves connection status, error details, and host fingerprint.
   */
  public async testConnection(host: HostProfile): Promise<{ success: boolean; error?: string; fingerprint?: string }> {
    return new Promise((resolve) => {
      let isFinished = false;
      const client = new Client();
      let detectedFingerprint = '';

      const cleanupAndResolve = (success: boolean, error?: string) => {
        if (isFinished) return;
        isFinished = true;
        clearTimeout(timer);
        try {
          client.end();
        } catch {
          // ignore
        }
        resolve({
          success,
          error,
          fingerprint: detectedFingerprint,
        });
      };

      const timer = setTimeout(() => {
        cleanupAndResolve(false, 'Connection timeout (10s): Remote host did not respond');
      }, 10000);

      const config: ConnectConfig = {
        host: host.host,
        port: host.port || 22,
        username: host.username,
        readyTimeout: 10000,
        tryKeyboard: true,
        hostHash: 'sha256',
        hostVerifier: (fingerprint: string) => {
          detectedFingerprint = `SHA256:${fingerprint}`;
          return true; // TOFU
        },
        algorithms: SSH_ALGORITHMS as any,
      };

      applyAuthConfig(config, host);

      client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
        if (prompts && prompts.length > 0 && host.password) {
          finish(prompts.map(() => host.password!));
        } else {
          finish([]);
        }
      });

      client.on('ready', () => {
        cleanupAndResolve(true);
      });

      client.on('error', (err) => {
        cleanupAndResolve(false, err.message || String(err));
      });

      try {
        client.connect(config);
      } catch (err: any) {
        cleanupAndResolve(false, err.message || String(err));
      }
    });
  }

  public write(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session && session.shellStream) {
      session.shellStream.write(data);
    }
  }

  public resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId);
    if (session && session.shellStream && cols > 5 && rows > 2) {
      try {
        session.shellStream.setWindow(rows, cols, 0, 0);
      } catch (e) {
        // ignore
      }
    }
  }

  public getSession(sessionId: string): SSHSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  public getClientForHost(hostId: string): Client | undefined {
    for (const session of this.sessions.values()) {
      if (session.hostId === hostId && session.client) {
        return session.client;
      }
    }
    return undefined;
  }

  public disconnect(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        if (session.shellStream) {
          session.shellStream.close();
        }
        session.client.end();
      } catch (e) {
        // ignore
      }
      this.sessions.delete(sessionId);
    }
  }
}

