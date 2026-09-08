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
 * Returns command string ending with '\n'.
 */
export function formatCdCommand(targetPath: string): string {
  const clean = sanitizeRemotePath(targetPath);
  // Linux bash/sh path escaping without quotes: escape spaces with '\ '
  const escaped = clean.replace(/ /g, '\\ ');
  return `cd ${escaped}\n`;
}
