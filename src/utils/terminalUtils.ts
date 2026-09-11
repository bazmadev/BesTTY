/**
 * Utility functions for terminal text processing and formatting.
 */

/**
 * Formats incoming terminal stream data to render shell prompts in bold.
 * Matches standard Unix/Linux prompts:
 * - root@mail:/opt/assis-vk-bridge# 
 * - ubuntu@vm:~$
 * - [root@centos /var/log]#
 * - (venv) user@host:~/app$
 * - alpine:/#
 * 
 * Preserves existing ANSI colors while ensuring the prompt is bold,
 * and turns off bold immediately after the prompt so command text remains normal weight.
 */
export function emboldenPrompt(chunk: string): string {
  if (!chunk || typeof chunk !== 'string') return chunk;

  // Fast short-circuit: if chunk does not contain prompt indicator characters, skip regex
  if (!chunk.includes('@') && !chunk.includes(':') && !chunk.includes('[')) {
    return chunk;
  }

  const ansi = '(?:\x1b\\[[0-9;?]*[a-zA-Z])*';
  const envPrefix = `(?:\\([\\w.-]+\\)\\s+)?`;
  // Pattern 1: [env] user@host:path[$#%>] or user@host path[$#%>] or host:path[$#%>]
  const hostAndPath = `(?:${ansi}[\\w.-]+@${ansi}[\\w.-]+${ansi}(?::${ansi}[^\\r\\n#$%>]*?|\\s+${ansi}[^\\r\\n#$%>]*?)?|${ansi}[\\w.-]+:${ansi}[~/][^\\r\\n#$%>]*?)${ansi}[$#%>]\\s?`;
  const pattern1 = `${envPrefix}${hostAndPath}`;
  // Pattern 2: [env] [user@host path][$#%>]
  const pattern2 = `${envPrefix}\\[${ansi}[\\w.-]+@${ansi}[\\w.-]+${ansi}(?:\\s+${ansi}[^\\r\\n\\]]*?)?${ansi}\\]${ansi}[$#%>]\\s?`;

  const fullPromptRegex = new RegExp(
    `(^|\\r\\n|\\r|\\n|(?:\x1b\\[\\?2004h)|(?:\x1b\\[K))(${pattern1}|${pattern2})`,
    'g'
  );

  return chunk.replace(fullPromptRegex, (match, prefix, promptPart) => {
    // Re-inject \x1b[1m after any internal \x1b[0m or \x1b[00m reset code inside prompt
    const emboldened = promptPart.replace(/\x1b\[0*m/g, '\x1b[0m\x1b[1m');
    return `${prefix}\x1b[1m${emboldened}\x1b[22m`;
  });
}
