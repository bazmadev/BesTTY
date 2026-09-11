import crypto from 'crypto';

/**
 * BesTTY Cryptographic Author Integrity & Anti-Tamper Anchor
 * 
 * Protects project provenance, author identity, and update integrity
 * against unauthorized commercial repackaging and donation hijacking.
 * 
 * Author: Bazma Dev (https://t.me/bazmadev)
 * Repository: https://github.com/bazmadev/BesTTY
 */

// Author Ed25519 Public Key for Release Signature Verification
const AUTHOR_PUBKEY_PEM = 
  '-----BEGIN PUBLIC KEY-----\n' +
  'MCowBQYDK2VwAyEA3chnYEGVrcd8cw3xQ5nFNDWi4NCzn0XDqVGY10gHtLQ=\n' +
  '-----END PUBLIC KEY-----\n';

// Obfuscated parts of authoritative endpoints (assembled at runtime to foil automated string-replace tools)
const _P1 = Buffer.from('YmF6bWFkZXY=', 'base64').toString('utf8'); // bazmadev
const _P2 = Buffer.from('QmVzVFRZ', 'base64').toString('utf8');     // BesTTY
const _P3 = Buffer.from('aHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy8=', 'base64').toString('utf8'); // https://api.github.com/repos/
const _P4 = Buffer.from('aHR0cHM6Ly9naXRodWIuY29tLw==', 'base64').toString('utf8'); // https://github.com/
const _P5 = Buffer.from('aHR0cHM6Ly90Lm1lL2Jhem1hZGV2', 'base64').toString('utf8'); // https://t.me/bazmadev

// Expected SHA-256 fingerprint of the authoritative repo identifier "bazmadev/BesTTY"
const AUTHOR_FINGERPRINT = 'c8c136558db6e3b0dd103569d1f371c264379b4351c726e9f14ff7311d1cb665';

export class AppIntegrity {
  public static readonly AUTHOR_NAME = 'Bazma Dev';

  /**
   * Returns the official author Telegram channel
   */
  public static getAuthorChannel(): string {
    return _P5;
  }

  /**
   * Returns the official GitHub repository URL
   */
  public static getOfficialRepoUrl(): string {
    return `${_P4}${_P1}/${_P2}`;
  }

  /**
   * Returns the authoritative releases API endpoint
   */
  public static getOfficialReleasesApi(): string {
    return `${_P3}${_P1}/${_P2}/releases/latest`;
  }

  /**
   * Returns the authoritative GitHub owner and repository
   */
  public static getAuthorRepo(): { owner: string; repo: string } {
    return {
      owner: _P1,
      repo: _P2,
    };
  }

  /**
   * Verifies the cryptographic integrity of the application's author provenance
   */
  public static verifyIntegrity(): { valid: boolean; author: string; repo: string } {
    try {
      const repoId = `${_P1}/${_P2}`;
      const hash = crypto.createHash('sha256').update(repoId).digest('hex');
      const valid = hash === AUTHOR_FINGERPRINT;

      if (!valid) {
        console.warn('[Security] Integrity mismatch detected. Restoring authoritative provenance.');
      }

      return {
        valid,
        author: this.AUTHOR_NAME,
        repo: repoId,
      };
    } catch (err) {
      console.error('[Security] Integrity check failed:', err);
      return {
        valid: false,
        author: this.AUTHOR_NAME,
        repo: `${_P1}/${_P2}`,
      };
    }
  }

  /**
   * Verifies an Ed25519 signature against the embedded Author Public Key
   */
  public static verifySignature(data: string | Buffer, signatureBase64: string): boolean {
    try {
      const bufferData = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
      const signatureBuffer = Buffer.from(signatureBase64, 'base64');
      return crypto.verify(null, bufferData, AUTHOR_PUBKEY_PEM, signatureBuffer);
    } catch (err) {
      console.warn('[Security] Signature verification error:', err);
      return false;
    }
  }

  /**
   * Verifies a SHA-256 checksum
   */
  public static verifyChecksum(data: Buffer, expectedSha256: string): boolean {
    const actual = crypto.createHash('sha256').update(data).digest('hex').toLowerCase();
    return actual === expectedSha256.toLowerCase();
  }
}
