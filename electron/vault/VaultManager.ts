import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { HostProfile, Snippet, TunnelConfig, BesTTYSettings } from '../../src/types';

interface VaultData {
  version: number;
  isMasterPasswordSet?: boolean;
  hosts: HostProfile[];
  snippets: Snippet[];
  tunnels: TunnelConfig[];
  settings: BesTTYSettings;
}

interface WrappedKey {
  salt: string; // hex
  iv: string;   // hex
  tag: string;  // hex
  ciphertext: string; // hex
}

interface VaultEnvelope {
  format: 'bestty-v2';
  isMasterPasswordSet: boolean;
  passwordSalt?: string;
  passwordWrappedDek?: {
    iv: string;
    tag: string;
    ciphertext: string;
  };
  recoverySalt?: string;
  recoveryKeyHash?: string;
  recoveryWrappedDek?: {
    iv: string;
    tag: string;
    ciphertext: string;
  };
  unprotectedWrappedDek?: {
    iv: string;
    tag: string;
    ciphertext: string;
  };
  payloadIv: string;
  payloadTag: string;
  payloadCiphertext: string;
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

function normalizeRecoveryKey(input: string): string {
  const trimmed = input.trim();
  if (trimmed.includes(' ')) {
    return trimmed.toLowerCase().replace(/\s+/g, ' ');
  }
  return trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export class VaultManager {
  private vaultPath: string;
  private isMasterPasswordSet: boolean = false;
  private isUnlocked: boolean = true;
  private dek: Buffer | null = null;
  private envelope: VaultEnvelope | null = null;
  private memoryData: VaultData;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.vaultPath = path.join(userDataPath, 'bestty-vault.enc');
    this.memoryData = {
      version: 2,
      isMasterPasswordSet: false,
      hosts: [],
      snippets: DEFAULT_SNIPPETS,
      tunnels: [],
      settings: DEFAULT_SETTINGS,
    };

    this.initFromDisk();
  }

  private deriveKey(passwordOrSecret: string, salt: Buffer): Buffer {
    // PBKDF2 with 100,000 iterations for strong brute force resistance
    return crypto.pbkdf2Sync(passwordOrSecret, salt, 100000, 32, 'sha512');
  }

  private getDefaultKey(): Buffer {
    return crypto.createHash('sha256').update('bestty-default-passphrase').digest();
  }

  private initFromDisk(): void {
    if (!fs.existsSync(this.vaultPath)) {
      this.isMasterPasswordSet = false;
      this.isUnlocked = true;
      this.dek = crypto.randomBytes(32);
      return;
    }

    try {
      const raw = fs.readFileSync(this.vaultPath);
      // Check if file starts with '{' (v2 format)
      if (raw.length > 0 && raw[0] === 0x7B) {
        const env = JSON.parse(raw.toString('utf8')) as VaultEnvelope;
        this.envelope = env;
        this.isMasterPasswordSet = env.isMasterPasswordSet;

        if (!env.isMasterPasswordSet && env.unprotectedWrappedDek) {
          // Unprotected vault: automatically unlock using fallback key
          const defaultKey = this.getDefaultKey();
          const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            defaultKey,
            Buffer.from(env.unprotectedWrappedDek.iv, 'hex')
          );
          decipher.setAuthTag(Buffer.from(env.unprotectedWrappedDek.tag, 'hex'));
          const dek = Buffer.concat([
            decipher.update(Buffer.from(env.unprotectedWrappedDek.ciphertext, 'hex')),
            decipher.final(),
          ]);

          this.dek = dek;
          // Decrypt payload
          const payloadDecipher = crypto.createDecipheriv(
            'aes-256-gcm',
            dek,
            Buffer.from(env.payloadIv, 'hex')
          );
          payloadDecipher.setAuthTag(Buffer.from(env.payloadTag, 'hex'));
          let decrypted = payloadDecipher.update(Buffer.from(env.payloadCiphertext, 'hex'), undefined, 'utf8');
          decrypted += payloadDecipher.final('utf8');

          this.memoryData = JSON.parse(decrypted);
          this.isUnlocked = true;
        } else {
          // Master password is configured: vault stays locked until unlock() is called
          this.isUnlocked = false;
        }
      } else {
        // v1 legacy binary format: [16b Salt][12b IV][16b AuthTag][Ciphertext...]
        // Attempt decrypting with fallback key
        try {
          const salt = raw.subarray(0, 16);
          const iv = raw.subarray(16, 28);
          const tag = raw.subarray(28, 44);
          const ciphertext = raw.subarray(44);

          const defaultKey = this.getDefaultKey();
          const decipher = crypto.createDecipheriv('aes-256-gcm', defaultKey, iv);
          decipher.setAuthTag(tag);
          let decrypted = decipher.update(ciphertext, undefined, 'utf8');
          decrypted += decipher.final('utf8');

          const data = JSON.parse(decrypted);
          this.memoryData = {
            version: 2,
            isMasterPasswordSet: false,
            hosts: data.hosts || [],
            snippets: data.snippets || DEFAULT_SNIPPETS,
            tunnels: data.tunnels || [],
            settings: data.settings || DEFAULT_SETTINGS,
          };
          this.isMasterPasswordSet = false;
          this.isUnlocked = true;
          this.dek = crypto.randomBytes(32);
          // Upgrade to v2 format
          this.save();
        } catch {
          // Fallback failed, meaning it was locked with an actual user password in v1
          this.isMasterPasswordSet = true;
          this.isUnlocked = false;
        }
      }
    } catch (err) {
      console.error('Failed to init vault from disk:', err);
      this.isMasterPasswordSet = false;
      this.isUnlocked = true;
      this.dek = crypto.randomBytes(32);
    }
  }

  public isVaultConfigured(): boolean {
    return this.isMasterPasswordSet;
  }

  public getStatus() {
    return {
      isConfigured: this.isVaultConfigured(),
      isUnlocked: this.isUnlocked,
    };
  }

  public setupMasterPassword(password: string, recoveryKey: string): { success: boolean; error?: string } {
    try {
      if (!password || password.length < 1) {
        return { success: false, error: 'Password cannot be empty' };
      }
      if (!recoveryKey || recoveryKey.length < 4) {
        return { success: false, error: 'Recovery key cannot be empty' };
      }

      const normalizedRecovery = normalizeRecoveryKey(recoveryKey);
      if (!this.dek) {
        this.dek = crypto.randomBytes(32);
      }

      // Derive Password KEK
      const passwordSalt = crypto.randomBytes(16);
      const passwordKek = this.deriveKey(password, passwordSalt);

      // Wrap DEK with passwordKek
      const pwdIv = crypto.randomBytes(12);
      const pwdCipher = crypto.createCipheriv('aes-256-gcm', passwordKek, pwdIv);
      const pwdCiphertext = Buffer.concat([pwdCipher.update(this.dek), pwdCipher.final()]);
      const pwdTag = pwdCipher.getAuthTag();

      // Derive Recovery Key KEK
      const recoverySalt = crypto.randomBytes(16);
      const recoveryKek = this.deriveKey(normalizedRecovery, recoverySalt);
      const recoveryKeyHash = crypto.createHash('sha256').update(normalizedRecovery).digest('hex');

      // Wrap DEK with recoveryKek
      const recIv = crypto.randomBytes(12);
      const recCipher = crypto.createCipheriv('aes-256-gcm', recoveryKek, recIv);
      const recCiphertext = Buffer.concat([recCipher.update(this.dek), recCipher.final()]);
      const recTag = recCipher.getAuthTag();

      // Encrypt Memory Data with DEK
      const payloadIv = crypto.randomBytes(12);
      const payloadCipher = crypto.createCipheriv('aes-256-gcm', this.dek, payloadIv);
      const dataStr = JSON.stringify(this.memoryData);
      const payloadCiphertext = Buffer.concat([payloadCipher.update(dataStr, 'utf8'), payloadCipher.final()]);
      const payloadTag = payloadCipher.getAuthTag();

      const newEnvelope: VaultEnvelope = {
        format: 'bestty-v2',
        isMasterPasswordSet: true,
        passwordSalt: passwordSalt.toString('hex'),
        passwordWrappedDek: {
          iv: pwdIv.toString('hex'),
          tag: pwdTag.toString('hex'),
          ciphertext: pwdCiphertext.toString('hex'),
        },
        recoverySalt: recoverySalt.toString('hex'),
        recoveryKeyHash,
        recoveryWrappedDek: {
          iv: recIv.toString('hex'),
          tag: recTag.toString('hex'),
          ciphertext: recCiphertext.toString('hex'),
        },
        payloadIv: payloadIv.toString('hex'),
        payloadTag: payloadTag.toString('hex'),
        payloadCiphertext: payloadCiphertext.toString('hex'),
      };

      this.envelope = newEnvelope;
      this.isMasterPasswordSet = true;
      this.isUnlocked = true;
      fs.writeFileSync(this.vaultPath, JSON.stringify(newEnvelope, null, 2), 'utf8');
      return { success: true };
    } catch (err: any) {
      console.error('Failed to setup master password:', err);
      return { success: false, error: err.message || 'Failed to setup master password' };
    }
  }

  public recoverWithKey(recoveryKey: string, newPassword: string): { success: boolean; error?: string } {
    try {
      if (!fs.existsSync(this.vaultPath)) {
        return { success: false, error: 'Vault file not found' };
      }

      const raw = fs.readFileSync(this.vaultPath);
      let env: VaultEnvelope;
      try {
        env = JSON.parse(raw.toString('utf8')) as VaultEnvelope;
      } catch {
        return { success: false, error: 'Legacy vault format does not support key recovery' };
      }

      if (!env.recoveryWrappedDek || !env.recoverySalt || !env.recoveryKeyHash) {
        return { success: false, error: 'No recovery key registered for this vault' };
      }

      const normalizedRecovery = normalizeRecoveryKey(recoveryKey);
      const hash = crypto.createHash('sha256').update(normalizedRecovery).digest('hex');

      if (hash !== env.recoveryKeyHash) {
        return { success: false, error: 'Invalid recovery phrase or key' };
      }

      // Derive recovery KEK
      const recoveryKek = this.deriveKey(normalizedRecovery, Buffer.from(env.recoverySalt, 'hex'));
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        recoveryKek,
        Buffer.from(env.recoveryWrappedDek.iv, 'hex')
      );
      decipher.setAuthTag(Buffer.from(env.recoveryWrappedDek.tag, 'hex'));
      const dek = Buffer.concat([
        decipher.update(Buffer.from(env.recoveryWrappedDek.ciphertext, 'hex')),
        decipher.final(),
      ]);

      // Verify payload decryption with unwrapped DEK
      const payloadDecipher = crypto.createDecipheriv(
        'aes-256-gcm',
        dek,
        Buffer.from(env.payloadIv, 'hex')
      );
      payloadDecipher.setAuthTag(Buffer.from(env.payloadTag, 'hex'));
      let decrypted = payloadDecipher.update(Buffer.from(env.payloadCiphertext, 'hex'), undefined, 'utf8');
      decrypted += payloadDecipher.final('utf8');

      this.memoryData = JSON.parse(decrypted);
      this.dek = dek;
      this.isUnlocked = true;

      // Re-setup with the new password and preserve recovery key
      return this.setupMasterPassword(newPassword, recoveryKey);
    } catch (err: any) {
      console.error('Failed to recover vault with key:', err);
      return { success: false, error: err.message || 'Recovery failed' };
    }
  }

  public unlock(password: string): boolean {
    if (!fs.existsSync(this.vaultPath)) {
      // First-time setup: initialize with default recovery key
      const result = this.setupMasterPassword(password, 'BEST-DEFAULT-RECOVERY-KEY');
      return result.success;
    }

    try {
      const raw = fs.readFileSync(this.vaultPath);
      if (raw.length > 0 && raw[0] === 0x7B) {
        // v2 envelope
        const env = JSON.parse(raw.toString('utf8')) as VaultEnvelope;
        if (!env.isMasterPasswordSet) {
          this.isUnlocked = true;
          return true;
        }

        if (!env.passwordSalt || !env.passwordWrappedDek) {
          return false;
        }

        const passwordSalt = Buffer.from(env.passwordSalt, 'hex');
        const passwordKek = this.deriveKey(password, passwordSalt);

        const decipher = crypto.createDecipheriv(
          'aes-256-gcm',
          passwordKek,
          Buffer.from(env.passwordWrappedDek.iv, 'hex')
        );
        decipher.setAuthTag(Buffer.from(env.passwordWrappedDek.tag, 'hex'));
        const dek = Buffer.concat([
          decipher.update(Buffer.from(env.passwordWrappedDek.ciphertext, 'hex')),
          decipher.final(),
        ]);

        const payloadDecipher = crypto.createDecipheriv(
          'aes-256-gcm',
          dek,
          Buffer.from(env.payloadIv, 'hex')
        );
        payloadDecipher.setAuthTag(Buffer.from(env.payloadTag, 'hex'));
        let decrypted = payloadDecipher.update(Buffer.from(env.payloadCiphertext, 'hex'), undefined, 'utf8');
        decrypted += payloadDecipher.final('utf8');

        this.memoryData = JSON.parse(decrypted);
        this.dek = dek;
        this.envelope = env;
        this.isUnlocked = true;
        return true;
      } else {
        // Legacy v1 binary format
        const salt = raw.subarray(0, 16);
        const iv = raw.subarray(16, 28);
        const tag = raw.subarray(28, 44);
        const ciphertext = raw.subarray(44);

        const key = this.deriveKey(password, salt);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(ciphertext, undefined, 'utf8');
        decrypted += decipher.final('utf8');

        this.memoryData = JSON.parse(decrypted);
        this.isMasterPasswordSet = true;
        this.isUnlocked = true;
        this.dek = crypto.randomBytes(32);
        // Upgrade to v2 format
        this.setupMasterPassword(password, 'BEST-UPGRADED-VAULT-RECOVERY');
        return true;
      }
    } catch (err) {
      console.error('Failed to unlock vault:', err);
      return false;
    }
  }

  public save(): boolean {
    try {
      if (!this.dek) {
        this.dek = crypto.randomBytes(32);
      }

      const dataStr = JSON.stringify(this.memoryData);
      const payloadIv = crypto.randomBytes(12);
      const payloadCipher = crypto.createCipheriv('aes-256-gcm', this.dek, payloadIv);
      const payloadCiphertext = Buffer.concat([payloadCipher.update(dataStr, 'utf8'), payloadCipher.final()]);
      const payloadTag = payloadCipher.getAuthTag();

      if (this.isMasterPasswordSet && this.envelope) {
        // Vault has master password: keep existing wrapped DEKs, update payload
        const updatedEnvelope: VaultEnvelope = {
          ...this.envelope,
          payloadIv: payloadIv.toString('hex'),
          payloadTag: payloadTag.toString('hex'),
          payloadCiphertext: payloadCiphertext.toString('hex'),
        };
        this.envelope = updatedEnvelope;
        fs.writeFileSync(this.vaultPath, JSON.stringify(updatedEnvelope, null, 2), 'utf8');
        return true;
      }

      // Unprotected mode (no master password set yet)
      const defaultKey = this.getDefaultKey();
      const unprotIv = crypto.randomBytes(12);
      const unprotCipher = crypto.createCipheriv('aes-256-gcm', defaultKey, unprotIv);
      const unprotCiphertext = Buffer.concat([unprotCipher.update(this.dek), unprotCipher.final()]);
      const unprotTag = unprotCipher.getAuthTag();

      const newEnvelope: VaultEnvelope = {
        format: 'bestty-v2',
        isMasterPasswordSet: false,
        unprotectedWrappedDek: {
          iv: unprotIv.toString('hex'),
          tag: unprotTag.toString('hex'),
          ciphertext: unprotCiphertext.toString('hex'),
        },
        payloadIv: payloadIv.toString('hex'),
        payloadTag: payloadTag.toString('hex'),
        payloadCiphertext: payloadCiphertext.toString('hex'),
      };

      this.envelope = newEnvelope;
      fs.writeFileSync(this.vaultPath, JSON.stringify(newEnvelope, null, 2), 'utf8');
      return true;
    } catch (err) {
      console.error('Failed to save vault:', err);
      return false;
    }
  }

  public lock(): void {
    if (this.isMasterPasswordSet) {
      this.isUnlocked = false;
      this.dek = null;
      // Security: Flush plaintext credentials, passwords and keys from RAM
      this.memoryData = {
        version: 2,
        isMasterPasswordSet: true,
        hosts: [],
        snippets: this.memoryData.snippets || DEFAULT_SNIPPETS,
        tunnels: [],
        settings: this.memoryData.settings || DEFAULT_SETTINGS,
      };
    }
  }

  // Hosts
  public getHosts(): HostProfile[] {
    if (!this.isUnlocked) {
      return [];
    }
    return this.memoryData.hosts;
  }

  public saveHost(host: HostProfile): void {
    if (!this.isUnlocked) {
      throw new Error('Vault is locked. Unlock the vault to modify hosts.');
    }
    const idx = this.memoryData.hosts.findIndex(h => h.id === host.id);
    if (idx >= 0) {
      this.memoryData.hosts[idx] = { ...host, updatedAt: Date.now() };
    } else {
      this.memoryData.hosts.push({ ...host, createdAt: Date.now(), updatedAt: Date.now() });
    }
    this.save();
  }

  public deleteHost(id: string): void {
    if (!this.isUnlocked) {
      throw new Error('Vault is locked. Unlock the vault to delete hosts.');
    }
    this.memoryData.hosts = this.memoryData.hosts.filter(h => h.id !== id);
    this.save();
  }

  // Snippets
  public getSnippets(): Snippet[] {
    return this.memoryData.snippets;
  }

  public saveSnippet(snippet: Snippet): void {
    if (!this.isUnlocked) {
      throw new Error('Vault is locked. Unlock the vault to modify snippets.');
    }
    const idx = this.memoryData.snippets.findIndex(s => s.id === snippet.id);
    if (idx >= 0) {
      this.memoryData.snippets[idx] = snippet;
    } else {
      this.memoryData.snippets.push(snippet);
    }
    this.save();
  }

  public deleteSnippet(id: string): void {
    if (!this.isUnlocked) {
      throw new Error('Vault is locked. Unlock the vault to delete snippets.');
    }
    this.memoryData.snippets = this.memoryData.snippets.filter(s => s.id !== id);
    this.save();
  }

  // Tunnels
  public getTunnels(): TunnelConfig[] {
    if (!this.isUnlocked) {
      return [];
    }
    return this.memoryData.tunnels;
  }

  public saveTunnel(tunnel: TunnelConfig): void {
    if (!this.isUnlocked) {
      throw new Error('Vault is locked. Unlock the vault to modify tunnels.');
    }
    const idx = this.memoryData.tunnels.findIndex(t => t.id === tunnel.id);
    if (idx >= 0) {
      this.memoryData.tunnels[idx] = tunnel;
    } else {
      this.memoryData.tunnels.push(tunnel);
    }
    this.save();
  }

  public deleteTunnel(id: string): void {
    if (!this.isUnlocked) {
      throw new Error('Vault is locked. Unlock the vault to delete tunnels.');
    }
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
