import { Client, ClientChannel, ConnectConfig } from 'ssh2';
import { EventEmitter } from 'events';
import { StringDecoder } from 'string_decoder';
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
  homeDirectory?: string;
  fingerprint?: string;
  host?: HostProfile;
}

function extractDirectoryFromStream(str: string, homeDir?: string): string | null {
  // 1. SmarTTY / iTerm / VTE: Parse OSC 7 directory update sequence
  const osc7Match = str.match(/\x1b\]7;file:\/\/[^\/]*(\/[^\x07\x1b]*)(?:\x07|\x1b\\)/);
  if (osc7Match && osc7Match[1]) {
    try {
      const rawDir = decodeURIComponent(osc7Match[1]);
      const cleanDir = rawDir
        .replace(/[\x00-\x1f]/g, '')
        .replace(/^['"\s]+|['"\s]+$/g, '')
        .replace(/[#$%>:\s]+$/, '')
        .trim();
      return path.posix.normalize(cleanDir);
    } catch {
      // ignore
    }
  }

  // 2. Shell Prompt Detection
  // Strip ANSI escape codes
  const stripped = str
    .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
    .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
    .replace(/\r/g, '');

  let extractedPath: string | null = null;

  // Ubuntu / Debian / Standard PS1: (user@host:|host:)(path)([$#%>])
  const m1 = stripped.match(/(?:[\w.-]+@[\w.-]+:|[\w.-]+:)\s*([/~][^\r\n#$%>]*?)\s*[$#%>]\s*$/);
  if (m1 && m1[1]) {
    extractedPath = m1[1].trim();
  }

  // CentOS / RedHat bracketed PS1: [user@host path][$#%>]
  if (!extractedPath) {
    const m2 = stripped.match(/\[[\w.-]+@[\w.-]+\s+([/~][^\]\r\n]*?)\]\s*[$#%>]\s*$/);
    if (m2 && m2[1]) {
      extractedPath = m2[1].trim();
    }
  }

  // Zsh / Fish default: user@host path [%$#>]
  if (!extractedPath) {
    const m3 = stripped.match(/[\w.-]+@[\w.-]+\s+([/~][^\r\n#$%>]*?)\s*[$#%>]\s*$/);
    if (m3 && m3[1]) {
      extractedPath = m3[1].trim();
    }
  }

  if (extractedPath) {
    // Strip any quotes, trailing prompt symbols (#, $, %, >), colons, and whitespace
    extractedPath = extractedPath
      .replace(/^['"\s]+|['"\s]+$/g, '')
      .replace(/[#$%>:\s]+$/, '')
      .trim();

    const effectiveHome = homeDir || '/root';
    let resolved = extractedPath;
    if (resolved === '~') {
      resolved = effectiveHome;
    } else if (resolved.startsWith('~/')) {
      resolved = path.posix.join(effectiveHome, resolved.slice(2));
    }
    const cleanDir = resolved
      .replace(/[\x00-\x1f]/g, '')
      .replace(/^['"\s]+|['"\s]+$/g, '')
      .replace(/[#$%>:\s]+$/, '')
      .trim();
    const normalized = path.posix.normalize(cleanDir);
    if (normalized.startsWith('/') && normalized.length > 0) {
      return normalized;
    }
  }

  return null;
}

/**
 * Legacy / weak algorithms for compatibility with ancient embedded hardware/routers.
 * These are only appended if the user explicitly enables `allowLegacyCiphers` in host settings.
 * Includes: 3des-cbc (Sweet32 vulnerability), hmac-md5, diffie-hellman-group1-sha1 (Logjam 768-1024b), ssh-dss.
 */
export const LEGACY_SSH_ALGORITHMS = {
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
export const SSH_ALGORITHMS = LEGACY_SSH_ALGORITHMS;

/**
 * RFC 4254 & RFC 8160 Terminal Modes buffer:
 * Specifically includes opcode 42 (IUTF8 = 1), instructing the remote Linux kernel tty driver
 * to treat input as UTF-8. Without IUTF8, pressing Backspace on a 2-byte UTF-8 character (like Cyrillic 'ф')
 * only erases 1 byte, leaving corrupted characters/orphaned bytes in the tty line buffer.
 */
export const DEFAULT_PTY_MODES = Buffer.from([
  42, 0, 0, 0, 1,   // IUTF8: 1 (RFC 8160: UTF-8 input mode)
  3,  0, 0, 0, 127, // VERASE: 127 (0x7F / DEL, standard Unix backspace)
  53, 0, 0, 0, 1,   // ECHO: 1
  54, 0, 0, 0, 1,   // ECHOE: 1 (visual erase as BS-SP-BS)
  61, 0, 0, 0, 1,   // ECHOKE: 1 (visual erase for line kill)
  51, 0, 0, 0, 1,   // ICANON: 1 (canonical input processing)
  50, 0, 0, 0, 1,   // ISIG: 1 (signals enabled)
  36, 0, 0, 0, 1,   // ICRNL: 1 (map CR to NL on input)
  38, 0, 0, 0, 1,   // IXON: 1
  59, 0, 0, 0, 1,   // IEXTEN: 1
  0                 // TTY_OP_END
]);

function getEffectiveUsername(username?: string): string {
  const trimmed = (username || 'root').trim();
  return trimmed.toLowerCase() === 'root' ? 'root' : trimmed;
}

function getEffectivePassword(password?: string): string | undefined {
  if (!password) return undefined;
  return password.replace(/[\r\n]+$/, '');
}

function applyAuthConfig(config: ConnectConfig, host: HostProfile): void {
  const cleanPassword = getEffectivePassword(host.password);
  if (host.authType === 'password') {
    if (cleanPassword) {
      config.password = cleanPassword;
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

function setupAuthPipeline(
  config: ConnectConfig,
  host: HostProfile,
  client: Client
): { getServerMethodsAllowed: () => string[] | null } {
  let serverMethodsAllowed: string[] | null = null;
  const triedMethods = new Set<string>();
  const cleanPassword = getEffectivePassword(host.password);

  config.authHandler = (methodsLeft, _partial, _cb) => {
    if (methodsLeft && Array.isArray(methodsLeft)) {
      serverMethodsAllowed = methodsLeft;
    }
    if (!methodsLeft) {
      return 'none';
    }

    // 1. Try password if available and accepted by server
    if (
      config.password !== undefined &&
      methodsLeft.includes('password') &&
      !triedMethods.has('password')
    ) {
      triedMethods.add('password');
      return 'password';
    }

    // 2. Try keyboard-interactive (PAM) if enabled and accepted by server
    if (
      config.tryKeyboard &&
      methodsLeft.includes('keyboard-interactive') &&
      !triedMethods.has('keyboard-interactive')
    ) {
      triedMethods.add('keyboard-interactive');
      return 'keyboard-interactive';
    }

    // 3. Try publickey if configured and accepted by server
    if (
      config.privateKey !== undefined &&
      methodsLeft.includes('publickey') &&
      !triedMethods.has('publickey')
    ) {
      triedMethods.add('publickey');
      return 'publickey';
    }

    // 4. Try agent if configured and accepted by server
    if (
      config.agent !== undefined &&
      methodsLeft.includes('agent') &&
      !triedMethods.has('agent')
    ) {
      triedMethods.add('agent');
      return 'agent';
    }

    return false;
  };

  client.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
    if (prompts && prompts.length > 0 && cleanPassword) {
      finish(prompts.map(() => cleanPassword));
    } else {
      finish([]);
    }
  });

  return {
    getServerMethodsAllowed: () => serverMethodsAllowed,
  };
}

function formatAuthError(
  rawError: string,
  host: HostProfile,
  serverMethods: string[] | null,
  detectedFingerprint?: string
): string {
  const username = getEffectiveUsername(host.username);

  if (rawError.includes('Host key verification failed')) {
    return `КРИТИЧЕСКОЕ ПРЕДУПРЕЖДЕНИЕ БЕЗОПАСНОСТИ (TOFU): Отпечаток открытого ключа сервера изменился!\nОжидаемый: ${host.fingerprint}\nПолученный: ${detectedFingerprint || 'неизвестно'}\nВозможно, сервер был переустановлен, либо происходит атака типа Man-in-the-Middle (перехват сетевого трафика). BesTTY заблокировал подключение для защиты ваших учетных данных. Если сервер действительно был переустановлен, обновите или сотрите отпечаток в свойствах хоста.`;
  }

  if (rawError.includes('All configured authentication methods failed')) {
    if (serverMethods && serverMethods.length > 0) {
      const allowsPassword =
        serverMethods.includes('password') || serverMethods.includes('keyboard-interactive');
      if (!allowsPassword) {
        return `Сервер отклонил вход по паролю: авторизация по паролю отключена в настройках SSH-сервера (разрешены только методы: ${serverMethods.join(', ')}). Для пользователя "${username}" на большинстве Linux-серверов активен запрет входа по паролю (PermitRootLogin prohibit-password в /etc/ssh/sshd_config). Используйте SSH-ключ или разрешите вход по паролю на сервере.`;
      } else {
        return `Сервер отклонил пароль для пользователя "${username}". Проверьте правильность пароля и имя пользователя (в Linux имя root пишется строчными буквами).`;
      }
    }
    if (host.authType === 'password' && !host.password) {
      return `Пароль для пользователя "${username}" не указан.`;
    }
    return `Ошибка аутентификации пользователя "${username}". Проверьте учетные данные или способ авторизации.`;
  }
  return rawError;
}

export class SSHClientManager extends EventEmitter {
  private sessions: Map<string, SSHSessionInfo> = new Map();
  private batchers: Map<string, {
    decoder: StringDecoder;
    buffer: string;
    timer: NodeJS.Timeout | null;
  }> = new Map();

  private getOrCreateBatcher(sessionId: string) {
    let batcher = this.batchers.get(sessionId);
    if (!batcher) {
      batcher = {
        decoder: new StringDecoder('utf8'),
        buffer: '',
        timer: null,
      };
      this.batchers.set(sessionId, batcher);
    }
    return batcher;
  }

  private flushBatcher(sessionId: string): void {
    const batcher = this.batchers.get(sessionId);
    if (!batcher) return;
    if (batcher.timer) {
      clearTimeout(batcher.timer);
      batcher.timer = null;
    }
    if (batcher.buffer.length > 0) {
      const data = batcher.buffer;
      batcher.buffer = '';
      this.emit('data', { sessionId, data });
    }
  }

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

      const username = getEffectiveUsername(host.username);
      const config: ConnectConfig = {
        host: host.host,
        port: host.port || 22,
        username,
        keepaliveInterval: (host.keepAliveInterval || 30) * 1000,
        readyTimeout: 25000,
        tryKeyboard: true, // Enables PAM / keyboard-interactive authentication fallback
        hostHash: 'sha256',
        hostVerifier: (fingerprint: string) => {
          detectedFingerprint = `SHA256:${fingerprint}`;
          // True TOFU check: If we have an established fingerprint, verify against MITM
          if (host.fingerprint && host.fingerprint.trim()) {
            const expected = host.fingerprint.trim();
            const actual = detectedFingerprint.trim();
            if (expected !== actual) {
              console.error(`[SSH Security Alert] Host key mismatch for ${host.host}! Expected: ${expected}, Received: ${actual}`);
              return false; // Abort connection! Protects against Man-in-the-Middle attack
            }
          }
          return true;
        },
        // Security: only enable weak/legacy ciphers (3DES, MD5, SHA1) if explicitly allowed
        ...(host.allowLegacyCiphers ? { algorithms: LEGACY_SSH_ALGORITHMS as any } : {}),
      };

      // Configure Authentication & Pipeline
      applyAuthConfig(config, host);
      const authPipeline = setupAuthPipeline(config, host, client);

      client.on('ready', () => {
        // Open interactive PTY shell with proper UTF-8 line editing and backspacing
        client.shell(
          {
            term: 'xterm-256color',
            cols: Math.max(cols, 20),
            rows: Math.max(rows, 10),
            modes: DEFAULT_PTY_MODES as any,
          },
          {
            env: {
              LANG: 'en_US.UTF-8',
              LC_ALL: 'en_US.UTF-8',
              HISTCONTROL: 'ignoreboth',
            },
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

            const effectiveUser = host.username?.trim();
            const homeDir = effectiveUser === 'root' ? '/root' : (effectiveUser ? `/home/${effectiveUser}` : '/root');
            const initialDir = host.defaultPath ? path.posix.normalize(host.defaultPath) : homeDir;

            const sessionInfo: SSHSessionInfo = {
              id: sessionId,
              hostId: host.id,
              title: host.name || `${host.username}@${host.host}`,
              client,
              shellStream: stream,
              currentDirectory: initialDir,
              homeDirectory: homeDir,
              fingerprint: detectedFingerprint || host.fingerprint,
              host,
            };

            this.sessions.set(sessionId, sessionInfo);

            // Handle incoming data from remote server with stream batching and UTF-8 decoding
            stream.on('data', (data: Buffer) => {
              const batcher = this.getOrCreateBatcher(sessionId);
              const str = batcher.decoder.write(data);
              if (!str) return;

              // Automatically detect directory updates from OSC 7 escape sequences or shell prompt
              const detectedDir = extractDirectoryFromStream(str, sessionInfo.homeDirectory);
              if (detectedDir && detectedDir !== sessionInfo.currentDirectory) {
                sessionInfo.currentDirectory = detectedDir;
                this.emit('directory-changed', { sessionId, directory: detectedDir });
              }

              batcher.buffer += str;
              if (batcher.buffer.length >= 32768) {
                this.flushBatcher(sessionId);
              } else if (!batcher.timer) {
                batcher.timer = setTimeout(() => {
                  this.flushBatcher(sessionId);
                }, 10);
              }
            });

            stream.on('error', (streamErr: any) => {
              console.warn(`[SSHClientManager] Stream error on session ${sessionId}:`, streamErr);
              this.emit('ssh-error', { sessionId, error: streamErr.message || String(streamErr) });
            });

            stream.on('close', () => {
              this.flushBatcher(sessionId);
              const batcher = this.batchers.get(sessionId);
              if (batcher) {
                const remaining = batcher.decoder.end();
                if (remaining) {
                  this.emit('data', { sessionId, data: remaining });
                }
              }
              this.emit('closed', { sessionId });
              this.disconnect(sessionId);
            });

            this.emit('connected', { sessionId, hostId: host.id, fingerprint: detectedFingerprint });
            // Emit initial directory immediately upon connection
            this.emit('directory-changed', { sessionId, directory: sessionInfo.currentDirectory });
            if (!isResolved) {
              isResolved = true;
              resolve();
            }
          }
        );
      });

      client.on('error', (err: any) => {
        const isNetworkReset =
          err?.message?.includes('ECONNRESET') ||
          err?.message?.includes('ETIMEDOUT') ||
          err?.message?.includes('EPIPE') ||
          err?.message?.includes('ECONNREFUSED');

        const diagnosticError = formatAuthError(
          err?.message || String(err),
          host,
          authPipeline.getServerMethodsAllowed(),
          detectedFingerprint
        );

        if (isNetworkReset) {
          console.warn(`[SSHClientManager] Network disconnect on session ${sessionId}: ${err?.message || err}`);
        } else {
          console.error(`SSH Client error for session ${sessionId}:`, diagnosticError);
        }

        this.emit('ssh-error', { sessionId, error: diagnosticError });
        if (!isResolved) {
          isResolved = true;
          reject(new Error(diagnosticError));
        }

        // Clean up dead session immediately on socket error so no zombie sessions remain
        this.disconnect(sessionId);
      });

      client.on('end', () => {
        this.emit('disconnected', { sessionId });
        this.disconnect(sessionId);
      });

      client.on('close', () => {
        this.emit('closed', { sessionId });
        this.disconnect(sessionId);
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

      const username = getEffectiveUsername(host.username);
      const config: ConnectConfig = {
        host: host.host,
        port: host.port || 22,
        username,
        readyTimeout: 10000,
        tryKeyboard: true,
        hostHash: 'sha256',
        hostVerifier: (fingerprint: string) => {
          detectedFingerprint = `SHA256:${fingerprint}`;
          if (host.fingerprint && host.fingerprint.trim()) {
            const expected = host.fingerprint.trim();
            const actual = detectedFingerprint.trim();
            if (expected !== actual) {
              console.error(`[SSH Security Alert] Host key mismatch in testConnection for ${host.host}! Expected: ${expected}, Received: ${actual}`);
              return false;
            }
          }
          return true; // TOFU
        },
        // Security: only enable weak/legacy ciphers (3DES, MD5, SHA1) if explicitly allowed
        ...(host.allowLegacyCiphers ? { algorithms: LEGACY_SSH_ALGORITHMS as any } : {}),
      };

      applyAuthConfig(config, host);
      const authPipeline = setupAuthPipeline(config, host, client);

      client.on('ready', () => {
        cleanupAndResolve(true);
      });

      client.on('error', (err) => {
        const diagnosticError = formatAuthError(
          err.message || String(err),
          host,
          authPipeline.getServerMethodsAllowed(),
          detectedFingerprint
        );
        cleanupAndResolve(false, diagnosticError);
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

  public getCurrentDirectory(sessionId: string): string | undefined {
    return this.sessions.get(sessionId)?.currentDirectory;
  }

  public disconnect(sessionId: string): void {
    this.flushBatcher(sessionId);
    const batcher = this.batchers.get(sessionId);
    if (batcher) {
      if (batcher.timer) clearTimeout(batcher.timer);
      this.batchers.delete(sessionId);
    }

    const session = this.sessions.get(sessionId);
    if (session) {
      try {
        if (session.shellStream) {
          session.shellStream.removeAllListeners();
          session.shellStream.close();
        }
        session.client.end();
        // Give 800ms for graceful FIN handshake, then force destroy to prevent zombie TCP connections
        setTimeout(() => {
          try {
            session.client.destroy();
          } catch {}
        }, 800);
      } catch (e) {
        try {
          session.client.destroy();
        } catch {}
      }
      this.sessions.delete(sessionId);
    }
  }
}

