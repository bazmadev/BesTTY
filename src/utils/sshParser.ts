export interface ParsedSSHConnection {
  protocol: 'ssh' | 'sftp';
  username: string;
  host: string;
  port: number;
  privateKeyPath?: string;
  rawInput: string;
}

/**
 * Splits a command line string into separate arguments, respecting single and double quotes.
 */
function tokenizeCommandLine(cmd: string): string[] {
  const args: string[] = [];
  let current = '';
  let inQuote: '"' | "'" | null = null;

  for (let i = 0; i < cmd.length; i++) {
    const char = cmd[i];
    if (inQuote) {
      if (char === inQuote) {
        inQuote = null;
      } else {
        current += char;
      }
    } else if (char === '"' || char === "'") {
      inQuote = char;
    } else if (/\s/.test(char)) {
      if (current.length > 0) {
        args.push(current);
        current = '';
      }
    } else {
      current += char;
    }
  }
  if (current.length > 0) {
    args.push(current);
  }
  return args;
}

/**
 * Parses user input strings such as:
 * - "ssh ubuntu@89.169.186.231"
 * - "ssh -l ubuntu 89.169.186.231" (Yandex Cloud, OpenSSH CLI standard)
 * - "ssh -p 2222 -l ubuntu 89.169.186.231"
 * - "ssh -i ~/.ssh/id_ed25519 -p 2200 user@1.2.3.4"
 * - "ssh -o StrictHostKeyChecking=no -l ubuntu 89.169.186.231"
 * - "ubuntu@89.169.186.231:2222"
 * - "ssh://ubuntu@89.169.186.231:2222"
 * - "89.169.186.231"
 */
export function parseSSHConnectionString(input: string): ParsedSSHConnection {
  const trimmed = input.trim();
  if (!trimmed) {
    return {
      protocol: 'ssh',
      username: 'root',
      host: '',
      port: 22,
      rawInput: '',
    };
  }

  // 1. URL format: ssh://user:pass@host:port or sftp://...
  if (/^(ssh|sftp):\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const protocol = (url.protocol.replace(':', '').toLowerCase() as 'ssh' | 'sftp') || 'ssh';
      const username = url.username || 'root';
      const host = url.hostname;
      const port = url.port ? parseInt(url.port, 10) : 22;
      return { protocol, username, host, port, rawInput: trimmed };
    } catch {
      // fallback to token-based parsing
    }
  }

  const tokens = tokenizeCommandLine(trimmed);
  if (tokens.length === 0) {
    return {
      protocol: 'ssh',
      username: 'root',
      host: '',
      port: 22,
      rawInput: trimmed,
    };
  }

  let protocol: 'ssh' | 'sftp' = 'ssh';
  let port: number | undefined;
  let username: string | undefined;
  let host = '';
  let privateKeyPath: string | undefined;

  let startIndex = 0;
  if (/^(ssh|sftp)$/i.test(tokens[0])) {
    protocol = tokens[0].toLowerCase() as 'ssh' | 'sftp';
    startIndex = 1;
  }

  // Flags that take a following argument in SSH/SFTP
  const flagsWithArg = new Set([
    '-l', '-p', '-P', '-i', '-o', '-c', '-m', '-F', '-b', '-J', '-L', '-R', '-D', '-W'
  ]);

  const positionalArgs: string[] = [];

  for (let i = startIndex; i < tokens.length; i++) {
    const token = tokens[i];

    // Check -l <user> or -l<user>
    if (token === '-l') {
      if (i + 1 < tokens.length) {
        username = tokens[++i];
      }
    } else if (token.startsWith('-l') && token.length > 2) {
      username = token.slice(2);
    }
    // Check -p <port> or -P <port> or -p<port> or -P<port>
    else if (token === '-p' || token === '-P') {
      if (i + 1 < tokens.length) {
        const parsedPort = parseInt(tokens[++i], 10);
        if (!isNaN(parsedPort) && parsedPort > 0) {
          port = parsedPort;
        }
      }
    } else if ((token.startsWith('-p') || token.startsWith('-P')) && token.length > 2 && /^-[pP]\d+$/.test(token)) {
      const parsedPort = parseInt(token.slice(2), 10);
      if (!isNaN(parsedPort) && parsedPort > 0) {
        port = parsedPort;
      }
    }
    // Check -i <keyPath> or -i<keyPath>
    else if (token === '-i') {
      if (i + 1 < tokens.length) {
        privateKeyPath = tokens[++i];
      }
    } else if (token.startsWith('-i') && token.length > 2) {
      privateKeyPath = token.slice(2);
    }
    // Flags that take an option argument (e.g. -o Option=Value, -F config)
    else if (flagsWithArg.has(token)) {
      if (i + 1 < tokens.length) {
        i++; // skip next argument
      }
    }
    // Self-contained flag with argument (e.g. -oStrictHostKeyChecking=no, -Fconfig)
    else if (
      token.startsWith('-o') ||
      token.startsWith('-F') ||
      token.startsWith('-c') ||
      token.startsWith('-m') ||
      token.startsWith('-b') ||
      token.startsWith('-J')
    ) {
      continue;
    }
    // Any other flag starting with '-' (e.g. -v, -C, -4, -6)
    else if (token.startsWith('-')) {
      continue;
    }
    // Positional argument
    else {
      positionalArgs.push(token);
    }
  }

  const destination = positionalArgs[0] || '';

  if (destination) {
    if (destination.includes('@')) {
      const atIdx = destination.lastIndexOf('@');
      const userPart = destination.slice(0, atIdx);
      const hostPart = destination.slice(atIdx + 1);

      if (!username || userPart) {
        username = userPart;
      }

      if (hostPart.startsWith('[') && hostPart.includes(']')) {
        const closeBracket = hostPart.indexOf(']');
        host = hostPart.slice(1, closeBracket);
        const after = hostPart.slice(closeBracket + 1);
        if (after.startsWith(':')) {
          const parsedPort = parseInt(after.slice(1), 10);
          if (!port && !isNaN(parsedPort) && parsedPort > 0) {
            port = parsedPort;
          }
        }
      } else if (hostPart.includes(':')) {
        const colonIdx = hostPart.lastIndexOf(':');
        host = hostPart.slice(0, colonIdx);
        const portStr = hostPart.slice(colonIdx + 1);
        const parsedPort = parseInt(portStr, 10);
        if (!port && !isNaN(parsedPort) && parsedPort > 0) {
          port = parsedPort;
        }
      } else {
        host = hostPart;
      }
    } else if (destination.startsWith('[') && destination.includes(']')) {
      const closeBracket = destination.indexOf(']');
      host = destination.slice(1, closeBracket);
      const after = destination.slice(closeBracket + 1);
      if (after.startsWith(':')) {
        const parsedPort = parseInt(after.slice(1), 10);
        if (!port && !isNaN(parsedPort) && parsedPort > 0) {
          port = parsedPort;
        }
      }
    } else if (destination.includes(':')) {
      const colonIdx = destination.lastIndexOf(':');
      host = destination.slice(0, colonIdx);
      const portStr = destination.slice(colonIdx + 1);
      const parsedPort = parseInt(portStr, 10);
      if (!port && !isNaN(parsedPort) && parsedPort > 0) {
        port = parsedPort;
      }
    } else {
      host = destination;
    }
  }

  const cleanUser = (username || 'root').trim();
  const effectiveUser = cleanUser.toLowerCase() === 'root' ? 'root' : cleanUser;

  return {
    protocol,
    username: effectiveUser,
    host: host || '',
    port: port || 22,
    privateKeyPath,
    rawInput: trimmed,
  };
}
