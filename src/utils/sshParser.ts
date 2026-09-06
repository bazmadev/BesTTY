export interface ParsedSSHConnection {
  protocol: 'ssh' | 'sftp';
  username: string;
  host: string;
  port: number;
  privateKeyPath?: string;
  rawInput: string;
}

/**
 * Parses user input strings such as:
 * - "ssh ubuntu@89.169.186.231"
 * - "ssh -p 2222 root@my-server.com"
 * - "ssh -i ~/.ssh/id_ed25519 -p 2200 user@1.2.3.4"
 * - "ubuntu@89.169.186.231:2222"
 * - "ssh://ubuntu@89.169.186.231:2222"
 * - "89.169.186.231"
 */
export function parseSSHConnectionString(input: string): ParsedSSHConnection {
  const trimmed = input.trim();
  let remaining = trimmed;

  let protocol: 'ssh' | 'sftp' = 'ssh';
  let port = 22;
  let username = 'root';
  let host = '';
  let privateKeyPath: string | undefined;

  // 1. URL format: ssh://user:pass@host:port or sftp://...
  if (remaining.startsWith('ssh://') || remaining.startsWith('sftp://')) {
    try {
      const url = new URL(remaining);
      protocol = url.protocol.replace(':', '') as 'ssh' | 'sftp';
      username = url.username || 'root';
      host = url.hostname;
      port = url.port ? parseInt(url.port, 10) : 22;
      return { protocol, username, host, port, rawInput: trimmed };
    } catch {
      // fallback to regex
    }
  }

  // 2. Remove leading command "ssh" or "sftp"
  if (/^(ssh|sftp)\s+/i.test(remaining)) {
    const match = remaining.match(/^(ssh|sftp)\s+/i);
    if (match) {
      protocol = match[1].toLowerCase() as 'ssh' | 'sftp';
      remaining = remaining.slice(match[0].length).trim();
    }
  }

  // 3. Extract -i <keyPath> (private key)
  const identityMatch = remaining.match(/-i\s+("[^"]+"|\S+)/);
  if (identityMatch) {
    privateKeyPath = identityMatch[1].replace(/^"|"$/g, '');
    remaining = remaining.replace(identityMatch[0], '').trim();
  }

  // 4. Extract port -p <port> or -P <port>
  const portMatch = remaining.match(/-[pP]\s+(\d+)/);
  if (portMatch) {
    port = parseInt(portMatch[1], 10);
    remaining = remaining.replace(portMatch[0], '').trim();
  }

  // 5. Look for user@host:port or user@host or host:port or host
  // Strip any remaining flags (e.g. -v, -C, -o StrictHostKeyChecking=no)
  const tokens = remaining.split(/\s+/).filter((t) => !t.startsWith('-'));
  const targetToken = tokens[0] || '';

  if (targetToken.includes('@')) {
    const atIdx = targetToken.lastIndexOf('@');
    username = targetToken.slice(0, atIdx);
    const hostPart = targetToken.slice(atIdx + 1);

    if (hostPart.includes(':')) {
      const [h, p] = hostPart.split(':');
      host = h;
      if (p && !portMatch) {
        port = parseInt(p, 10) || 22;
      }
    } else {
      host = hostPart;
    }
  } else if (targetToken.includes(':')) {
    const [h, p] = targetToken.split(':');
    host = h;
    if (p && !portMatch) {
      port = parseInt(p, 10) || 22;
    }
  } else if (targetToken) {
    host = targetToken;
  }

  return {
    protocol,
    username: username || 'root',
    host: host || trimmed,
    port: port || 22,
    privateKeyPath,
    rawInput: trimmed,
  };
}
