import net from 'net';
import { SSHClientManager } from './SSHClientManager';
import { TunnelConfig } from '../../src/types';
import { EventEmitter } from 'events';

export class TunnelManager extends EventEmitter {
  private activeServers: Map<string, net.Server> = new Map();

  constructor(private sshManager: SSHClientManager) {
    super();
  }

  public async startTunnel(tunnel: TunnelConfig): Promise<void> {
    if (this.activeServers.has(tunnel.id)) {
      throw new Error(`Tunnel ${tunnel.name} is already active`);
    }

    const client = this.sshManager.getClientForHost(tunnel.hostId);
    if (!client) {
      throw new Error(`Host connection for tunnel ${tunnel.name} is not active. Please connect to the host first.`);
    }

    if (tunnel.type === 'local') {
      const server = net.createServer((socket) => {
        const destHost = tunnel.remoteHost || '127.0.0.1';
        const destPort = tunnel.remotePort || 80;

        client.forwardOut(
          socket.remoteAddress || '127.0.0.1',
          socket.remotePort || 0,
          destHost,
          destPort,
          (err, stream) => {
            if (err) {
              socket.destroy();
              return;
            }
            socket.pipe(stream);
            stream.pipe(socket);

            socket.on('error', () => stream.destroy());
            stream.on('error', () => socket.destroy());
          }
        );
      });

      await new Promise<void>((resolve, reject) => {
        server.listen(tunnel.localPort, tunnel.localHost || '127.0.0.1', () => {
          this.activeServers.set(tunnel.id, server);
          resolve();
        });
        server.on('error', (e) => reject(e));
      });
    } else if (tunnel.type === 'dynamic') {
      // SOCKS5 Dynamic Proxy
      const server = net.createServer((socket) => {
        let handshaked = false;

        socket.on('data', (data) => {
          if (!handshaked) {
            // SOCKS5 greeting
            if (data[0] === 0x05) {
              // NO AUTH REQUIRED
              socket.write(Buffer.from([0x05, 0x00]));
              handshaked = true;
            } else {
              socket.destroy();
            }
          } else {
            // Connection request: [0x05, CMD, RSV, ATYP, DST.ADDR, DST.PORT]
            if (data[0] === 0x05 && data[1] === 0x01) {
              let host = '';
              let port = 0;
              const atyp = data[3];

              let offset = 4;
              if (atyp === 0x01) {
                // IPv4
                host = `${data[4]}.${data[5]}.${data[6]}.${data[7]}`;
                offset = 8;
              } else if (atyp === 0x03) {
                // Domain name
                const len = data[4];
                host = data.subarray(5, 5 + len).toString('ascii');
                offset = 5 + len;
              } else if (atyp === 0x04) {
                // IPv6
                socket.destroy();
                return;
              }

              port = data.readUInt16BE(offset);

              client.forwardOut(
                socket.remoteAddress || '127.0.0.1',
                socket.remotePort || 0,
                host,
                port,
                (err, stream) => {
                  if (err) {
                    socket.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
                    socket.destroy();
                    return;
                  }

                  // Success response
                  socket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
                  socket.pipe(stream);
                  stream.pipe(socket);
                }
              );
            }
          }
        });
      });

      await new Promise<void>((resolve, reject) => {
        server.listen(tunnel.localPort, tunnel.localHost || '127.0.0.1', () => {
          this.activeServers.set(tunnel.id, server);
          resolve();
        });
        server.on('error', (e) => reject(e));
      });
    }
  }

  public stopTunnel(tunnelId: string): void {
    const server = this.activeServers.get(tunnelId);
    if (server) {
      server.close();
      this.activeServers.delete(tunnelId);
    }
  }

  public isTunnelActive(tunnelId: string): boolean {
    return this.activeServers.has(tunnelId);
  }
}
