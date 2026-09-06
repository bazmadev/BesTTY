import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import { EventEmitter } from 'events';
import fs from 'fs';
import net from 'net';
import { HostProfile } from '../../src/types';

export interface SSHSessionInfo {
  id: string;
  hostId: string;
  title: string;
  client: Client;
  shellStream?: ClientChannel;
  currentDirectory: string;
}

export class SSHClientManager extends EventEmitter {
  private sessions: Map<string, SSHSessionInfo> = new Map();
  // Shared connections cache for multiplexing: hostId -> Client
  private sharedClients: Map<string, Client> = new Map();

  constructor() {
    super();
  }

  public async connect(sessionId: string, host: HostProfile, cols: number = 80, rows: number = 24): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = new Client();

      const config: ConnectConfig = {
        host: host.host,
        port: host.port || 22,
        username: host.username,
        keepaliveInterval: (host.keepAliveInterval || 30) * 1000,
        readyTimeout: 20000,
      };

      // Configure Authentication
      if (host.authType === 'password') {
        config.password = host.password;
      } else if (host.authType === 'privateKey') {
        if (host.privateKeyContent) {
          config.privateKey = host.privateKeyContent;
        } else if (host.privateKeyPath && fs.existsSync(host.privateKeyPath)) {
          config.privateKey = fs.readFileSync(host.privateKeyPath);
        }
        if (host.passphrase) {
          config.passphrase = host.passphrase;
        }
      } else if (host.authType === 'agent') {
        // Windows OpenSSH agent pipe or Unix socket
        const agentPipe = process.platform === 'win32'
          ? '\\\\.\\pipe\\openssh-ssh-agent'
          : process.env.SSH_AUTH_SOCK;
        config.agent = agentPipe;
      }

      client.on('ready', () => {
        this.sharedClients.set(host.id, client);

        // Open interactive PTY shell
        client.shell(
          {
            term: 'xterm-256color',
            cols,
            rows,
          },
          (err, stream) => {
            if (err) {
              client.end();
              return reject(err);
            }

            const sessionInfo: SSHSessionInfo = {
              id: sessionId,
              hostId: host.id,
              title: host.name || `${host.username}@${host.host}`,
              client,
              shellStream: stream,
              currentDirectory: host.defaultPath || '~',
            };

            this.sessions.set(sessionId, sessionInfo);

            // Handle incoming data from remote server
            stream.on('data', (data: Buffer) => {
              const str = data.toString('utf-8');
              
              // SmarTTY Killer Feature: Parse OSC 7 directory update sequence
              // \x1b]7;file://hostname/path\x07 or \x1b]7;file://hostname/path\x1b\\
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

            this.emit('connected', { sessionId, hostId: host.id });
            resolve();
          }
        );
      });

      client.on('error', (err) => {
        console.error(`SSH Client error for session ${sessionId}:`, err);
        this.emit('error', { sessionId, error: err.message });
        reject(err);
      });

      client.on('end', () => {
        this.emit('disconnected', { sessionId });
      });

      try {
        client.connect(config);
      } catch (e: any) {
        reject(e);
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
    if (session && session.shellStream) {
      session.shellStream.setWindow(rows, cols, 0, 0);
    }
  }

  public getSession(sessionId: string): SSHSessionInfo | undefined {
    return this.sessions.get(sessionId);
  }

  public getClientForHost(hostId: string): Client | undefined {
    return this.sharedClients.get(hostId);
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
        console.error('Error during disconnect:', e);
      }
      this.sessions.delete(sessionId);
      this.sharedClients.delete(session.hostId);
    }
  }
}
