/**
 * Utility functions for sanitizing and formatting remote Linux paths
 */

/**
 * Strips prompt symbols (#, $, %, >, :), quotes, leading/trailing spaces,
 * and ensures path is normalized and valid.
 */
export function sanitizeRemotePath(rawPath: string): string {
  if (!rawPath) return '/';
  let p = rawPath.trim();
  // Strip enclosing quotes ('...' or "...")
  p = p.replace(/^['"]+|['"]+$/g, '').trim();
  // Strip trailing shell prompt artifacts (#, $, %, >, :, spaces)
  p = p.replace(/[#$%>:\s]+$/, '').trim();
  // Strip again in case quotes were inside prompt characters
  p = p.replace(/^['"]+|['"]+$/g, '').trim();

  // Ensure path starts with / unless it's home ~
  if (!p.startsWith('/') && !p.startsWith('~')) {
    p = '/' + p;
  }
  // Remove redundant consecutive slashes (e.g. //var///www -> /var/www)
  p = p.replace(/\/+/g, '/');
  if (!p) p = '/';
  return p;
}

/**
 * Formats a clean cd command without quotes.
 * If the path contains spaces, escapes them with a backslash (\ ).
 * Includes a leading space (' cd ...') so that GNU Bash (HISTCONTROL=ignorespace/ignoreboth),
 * Fish shell, and Zsh (HIST_IGNORE_SPACE) automatically exclude this automated command
 * from the remote shell history buffer.
 * Returns command string ending with '\n'.
 */
export function formatCdCommand(targetPath: string): string {
  const clean = sanitizeRemotePath(targetPath);
  // Linux bash/sh path escaping without quotes: escape spaces with '\ '
  const escaped = clean.replace(/ /g, '\\ ');
  return ` cd ${escaped}\n`;
}

/**
 * Intelligently cleans, parses, and normalizes a remote Linux path from arbitrary user inputs.
 * Strips noise, shell commands ('cd ...'), shell prompt artifacts ('root@mail:/opt# cd ...'),
 * Windows drive letters ('C:\...'), WSL prefixes, backslashes, enclosing quotes, URLs ('file://', 'sftp://'),
 * and resolves relative paths ('..', 'subdir') against currentDir.
 */
export function parseSmartRemotePath(rawText?: string | null, currentDir: string = '/'): string | null {
  if (!rawText || typeof rawText !== 'string') return null;

  let text = rawText.trim();
  if (!text) return null;

  // 1. If input contains multiple lines, pick the line most likely to be a path or cd command
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 0) {
    const candidate = lines.find((l) => l.includes('/') || l.includes('\\') || l.startsWith('cd ') || l.includes(':')) || lines[0];
    text = candidate;
  }

  // 2. Strip URL / protocol prefixes (file://, sftp://host:port/path, etc.)
  text = text.replace(/^(?:file:\/\/|sftp:\/\/[^/]*|ssh:\/\/[^/]*)/i, '');

  // 3. Strip WSL UNC path prefixes (\\wsl$\Distro\... or \\wsl.localhost\Distro\...)
  text = text.replace(/^[\\/]{2}wsl(?:\$|\.localhost)[\\/][^\\/]+[\\/]/i, '/');

  // 4. Strip shell prompt prefixes
  // e.g. "root@mail:/opt/assis-vk-bridge# cd /var/www"
  // or "root@mail:/opt/assis-vk-bridge# npm run dev" (extracts "/opt/assis-vk-bridge")
  // or "ubuntu@server:~$ "
  const promptWithCmdMatch = text.match(/^(?:\[?[^@\s]+@[^:\s]+[:\s]+)([^#$%>]+)[#$%>]\s*(?:cd\s+)?(.*)$/);
  if (promptWithCmdMatch) {
    const promptPath = promptWithCmdMatch[1].trim();
    const afterPrompt = promptWithCmdMatch[2].trim();
    if (afterPrompt && (afterPrompt.startsWith('/') || afterPrompt.startsWith('~') || afterPrompt.includes('/') || afterPrompt.includes('\\'))) {
      text = afterPrompt;
    } else if (afterPrompt.startsWith('cd ')) {
      text = afterPrompt.slice(3).trim();
    } else if (promptPath) {
      text = promptPath;
    }
  } else {
    // Check if whole line is just a prompt like "root@mail:/opt/assis-vk-bridge#"
    const purePromptMatch = text.match(/^(?:\[?[^@\s]+@[^:\s]+[:\s]+)([^#$%>]+)[#$%>:]?\s*$/);
    if (purePromptMatch) {
      text = purePromptMatch[1].trim();
    }
  }

  // 5. Strip shell navigation commands & prefixes ("cd ...", "sudo cd ...", "builtin cd ...", "pushd ...")
  text = text.replace(/^(?:sudo\s+)?(?:builtin\s+)?(?:cd|pushd)\s+/i, '').trim();

  // 6. Strip enclosing quotes or backticks ('...', "...", `...`)
  text = text.replace(/^['"`]+|['"`]+$/g, '').trim();

  // 7. Normalize backslashes to forward slashes, preserving escaped spaces (\ )
  text = text.replace(/\\ /g, '___SPACE___');
  text = text.replace(/\\+/g, '/');
  text = text.replace(/___SPACE___/g, ' ');

  // 8. Strip Windows drive letters (e.g. "C:/var/www" -> "/var/www", "C:\" -> "/")
  text = text.replace(/^[a-zA-Z]:/i, '');

  // 9. Strip trailing shell characters or punctuation: ;, :, #, $, %, >, spaces
  text = text.replace(/[;#$%>:\s]+$/, '').trim();

  // Strip enclosing quotes again if they were inside
  text = text.replace(/^['"`]+|['"`]+$/g, '').trim();

  // 10. Handle relative paths (e.g. "..", "../foo", "dist", "./build")
  if (text === '..') {
    const parts = (currentDir || '/').split('/').filter(Boolean);
    parts.pop();
    return '/' + parts.join('/');
  }

  if (text === '.' || text === './') {
    return currentDir || '/';
  }

  if (text.startsWith('./')) {
    text = text.slice(2);
  }

  // If path doesn't start with / or ~
  if (!text.startsWith('/') && !text.startsWith('~')) {
    if (currentDir && currentDir !== '/') {
      text = `${currentDir.replace(/\/+$/, '')}/${text}`;
    } else {
      text = '/' + text;
    }
  }

  // 11. Normalize multiple slashes //var///www -> /var/www
  text = text.replace(/\/+/g, '/');

  // Strip trailing slash unless it's just root "/"
  if (text.length > 1 && text.endsWith('/')) {
    text = text.slice(0, -1);
  }

  return text || '/';
}
