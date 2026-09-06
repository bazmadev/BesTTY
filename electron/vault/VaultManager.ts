import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { HostProfile, Snippet, TunnelConfig, BesTTYSettings } from '../../src/types';

interface VaultData {
  version: number;
  hosts: HostProfile[];
  snippets: Snippet[];
  tunnels: TunnelConfig[];
  settings: BesTTYSettings;
}

const DEFAULT_SETTINGS: BesTTYSettings = {
  locale: 'ru',
  theme: 'fluent-dark',
  fontFamily: 'Cascadia Code, Consolas, monospace',
  fontSize: 14,
  cursorStyle: 'block',
  cursorBlink: true,
  scrollback: 10000,
  confirmOnClose: true,
  sftpFollowTerminal: true,
  enableHardwareAcceleration: true,
};

const DEFAULT_SNIPPETS: Snippet[] = [
  { id: '1', name: 'System Info', command: 'uname -a && cat /etc/os-release', category: 'General', description: 'Display OS and kernel information' },
  { id: '2', name: 'Disk Free Space', command: 'df -h', category: 'System', description: 'Show human-readable disk usage' },
  { id: '3', name: 'Memory Usage', command: 'free -h', category: 'System', description: 'Show RAM and Swap usage' },
  { id: '4', name: 'Docker Containers', command: 'docker ps -a', category: 'Docker', description: 'List all docker containers' },
  { id: '5', name: 'Network Ports', command: 'ss -tulnp', category: 'Network', description: 'Show listening ports and services' },
  { id: '6', name: 'Live Logs (Syslog)', command: 'journalctl -f -n 100', category: 'Logs', description: 'Follow systemd journal logs' },
];

export class VaultManager {
  private vaultPath: string;
  private isUnlocked: boolean = false;
  private currentKey: Buffer | null = null;
  private memoryData: VaultData;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.vaultPath = path.join(userDataPath, 'bestty-vault.enc');
    this.memoryData = {
      version: 1,
      hosts: [],
      snippets: DEFAULT_SNIPPETS,
      tunnels: [],
      settings: DEFAULT_SETTINGS,
    };
  }

  public isVaultConfigured(): boolean {
    return fs.existsSync(this.vaultPath);
  }

  public getStatus() {
    return {
      isConfigured: this.isVaultConfigured(),
      isUnlocked: this.isUnlocked || !this.isVaultConfigured(),
    };
  }

  private deriveKey(password: string, salt: Buffer): Buffer {
    // PBKDF2 with 100,000 iterations for strong protection against brute force
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha512');
  }

  public unlock(password: string): boolean {
    if (!this.isVaultConfigured()) {
      // First-time setup: initialize with this password
      const salt = crypto.randomBytes(16);
      this.currentKey = this.deriveKey(password, salt);
      this.isUnlocked = true;
      this.save(salt);
      return true;
    }

    try {
      const encryptedFile = fs.readFileSync(this.vaultPath);
      // File format: [16 bytes Salt][12 bytes IV][16 bytes Auth Tag][Ciphertext...]
      const salt = encryptedFile.subarray(0, 16);
      const iv = encryptedFile.subarray(16, 28);
      const tag = encryptedFile.subarray(28, 44);
      const ciphertext = encryptedFile.subarray(44);

      const key = this.deriveKey(password, salt);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);

      let decrypted = decipher.update(ciphertext, undefined, 'utf8');
      decrypted += decipher.final('utf8');

      this.memoryData = JSON.parse(decrypted);
      this.currentKey = key;
      this.isUnlocked = true;
      return true;
    } catch (err) {
      console.error('Failed to unlock vault:', err);
      return false;
    }
  }

  public save(customSalt?: Buffer): boolean {
    try {
      const dataStr = JSON.stringify(this.memoryData);
      
      let salt: Buffer;
      let key: Buffer;

      if (this.currentKey) {
        salt = customSalt || crypto.randomBytes(16);
        key = this.currentKey;
      } else {
        // Unprotected fallback (e.g. quick mode without master password)
        salt = Buffer.alloc(16);
        key = crypto.createHash('sha256').update('bestty-default-passphrase').digest();
      }

      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      let ciphertext = cipher.update(dataStr, 'utf8');
      ciphertext = Buffer.concat([ciphertext, cipher.final()]);
      const tag = cipher.getAuthTag();

      const combined = Buffer.concat([salt, iv, tag, ciphertext]);
      fs.writeFileSync(this.vaultPath, combined);
      return true;
    } catch (err) {
      console.error('Failed to save vault:', err);
      return false;
    }
  }

  public lock(): void {
    this.isUnlocked = false;
    this.currentKey = null;
  }

  // Hosts
  public getHosts(): HostProfile[] {
    return this.memoryData.hosts;
  }

  public saveHost(host: HostProfile): void {
    const idx = this.memoryData.hosts.findIndex(h => h.id === host.id);
    if (idx >= 0) {
      this.memoryData.hosts[idx] = { ...host, updatedAt: Date.now() };
    } else {
      this.memoryData.hosts.push({ ...host, createdAt: Date.now(), updatedAt: Date.now() });
    }
    this.save();
  }

  public deleteHost(id: string): void {
    this.memoryData.hosts = this.memoryData.hosts.filter(h => h.id !== id);
    this.save();
  }

  // Snippets
  public getSnippets(): Snippet[] {
    return this.memoryData.snippets;
  }

  public saveSnippet(snippet: Snippet): void {
    const idx = this.memoryData.snippets.findIndex(s => s.id === snippet.id);
    if (idx >= 0) {
      this.memoryData.snippets[idx] = snippet;
    } else {
      this.memoryData.snippets.push(snippet);
    }
    this.save();
  }

  public deleteSnippet(id: string): void {
    this.memoryData.snippets = this.memoryData.snippets.filter(s => s.id !== id);
    this.save();
  }

  // Tunnels
  public getTunnels(): TunnelConfig[] {
    return this.memoryData.tunnels;
  }

  public saveTunnel(tunnel: TunnelConfig): void {
    const idx = this.memoryData.tunnels.findIndex(t => t.id === tunnel.id);
    if (idx >= 0) {
      this.memoryData.tunnels[idx] = tunnel;
    } else {
      this.memoryData.tunnels.push(tunnel);
    }
    this.save();
  }

  public deleteTunnel(id: string): void {
    this.memoryData.tunnels = this.memoryData.tunnels.filter(t => t.id !== id);
    this.save();
  }

  // Settings
  public getSettings(): BesTTYSettings {
    return this.memoryData.settings || DEFAULT_SETTINGS;
  }

  public saveSettings(settings: Partial<BesTTYSettings>): void {
    this.memoryData.settings = { ...this.getSettings(), ...settings };
    this.save();
  }
}
