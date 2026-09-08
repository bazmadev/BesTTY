import React from 'react';
import { Sparkles, Folder, FileText, Zap, RotateCw, Terminal as TerminalIcon } from 'lucide-react';
import { SFTPFile, Snippet } from '../../types';

export interface SuggestionItem {
  id: string;
  name: string;
  insertText: string;
  type: 'command' | 'directory' | 'file' | 'snippet' | 'history';
  description?: string;
}

export const LINUX_COMMANDS = [
  { name: 'apt', desc: 'Package manager (Debian/Ubuntu)' },
  { name: 'apt-get', desc: 'APT package handling utility' },
  { name: 'awk', desc: 'Pattern scanning and processing language' },
  { name: 'bash', desc: 'GNU Bourne-Again SHell' },
  { name: 'cat', desc: 'Concatenate and display files' },
  { name: 'cd', desc: 'Change working directory' },
  { name: 'chmod', desc: 'Change file mode bits (permissions)' },
  { name: 'chown', desc: 'Change file owner and group' },
  { name: 'chgrp', desc: 'Change group ownership' },
  { name: 'clear', desc: 'Clear the terminal screen' },
  { name: 'cp', desc: 'Copy files and directories' },
  { name: 'curl', desc: 'Transfer data from or to a server' },
  { name: 'df', desc: 'Report file system disk space usage' },
  { name: 'diff', desc: 'Compare files line by line' },
  { name: 'dmesg', desc: 'Print or control the kernel ring buffer' },
  { name: 'dnf', desc: 'Package manager (Fedora/RHEL)' },
  { name: 'docker', desc: 'Container application platform' },
  { name: 'docker-compose', desc: 'Multi-container Docker applications' },
  { name: 'du', desc: 'Estimate file space usage' },
  { name: 'echo', desc: 'Display a line of text' },
  { name: 'env', desc: 'Run a program in a modified environment' },
  { name: 'exit', desc: 'Exit the current shell' },
  { name: 'export', desc: 'Set environment variables' },
  { name: 'find', desc: 'Search for files in a directory hierarchy' },
  { name: 'free', desc: 'Display amount of free and used memory' },
  { name: 'git', desc: 'Fast, scalable, distributed revision control' },
  { name: 'grep', desc: 'Print lines that match patterns' },
  { name: 'gzip', desc: 'Compress or expand files' },
  { name: 'head', desc: 'Output the first part of files' },
  { name: 'history', desc: 'Display GNU History list' },
  { name: 'htop', desc: 'Interactive process viewer' },
  { name: 'id', desc: 'Print real and effective user and group IDs' },
  { name: 'ifconfig', desc: 'Configure network interface parameters' },
  { name: 'ip', desc: 'Show / manipulate routing, devices, and tunnels' },
  { name: 'iptables', desc: 'Administration tool for IPv4 packet filtering' },
  { name: 'journalctl', desc: 'Query the systemd journal' },
  { name: 'kill', desc: 'Send signals to processes' },
  { name: 'killall', desc: 'Kill processes by name' },
  { name: 'less', desc: 'Opposite of more (paged file viewer)' },
  { name: 'ln', desc: 'Make links between files' },
  { name: 'ls', desc: 'List directory contents' },
  { name: 'mkdir', desc: 'Make directories' },
  { name: 'more', desc: 'File perusal filter for crt viewing' },
  { name: 'mv', desc: 'Move or rename files' },
  { name: 'nano', desc: 'Small and friendly text editor' },
  { name: 'netstat', desc: 'Print network connections and routing tables' },
  { name: 'nginx', desc: 'HTTP and reverse proxy server' },
  { name: 'node', desc: 'Server-side JavaScript runtime' },
  { name: 'npm', desc: 'Node package manager' },
  { name: 'ping', desc: 'Send ICMP ECHO_REQUEST to network hosts' },
  { name: 'pnpm', desc: 'Fast, disk space efficient package manager' },
  { name: 'ps', desc: 'Report a snapshot of the current processes' },
  { name: 'pwd', desc: 'Print name of current/working directory' },
  { name: 'python3', desc: 'Python 3 interpreted programming language' },
  { name: 'reboot', desc: 'Reboot the machine' },
  { name: 'rm', desc: 'Remove files or directories' },
  { name: 'rmdir', desc: 'Remove empty directories' },
  { name: 'rsync', desc: 'Remote file copying tool' },
  { name: 'scp', desc: 'OpenSSH secure file copy' },
  { name: 'sed', desc: 'Stream editor for filtering and transforming' },
  { name: 'service', desc: 'Run a System V init script' },
  { name: 'sh', desc: 'Standard command language interpreter' },
  { name: 'shutdown', desc: 'Halt, power-off or reboot the machine' },
  { name: 'sort', desc: 'Sort lines of text files' },
  { name: 'source', desc: 'Execute commands from a file in the current shell' },
  { name: 'ss', desc: 'Utility to investigate sockets' },
  { name: 'ssh', desc: 'OpenSSH remote login client' },
  { name: 'sudo', desc: 'Execute a command as another user' },
  { name: 'systemctl', desc: 'Control the systemd system and service manager' },
  { name: 'tail', desc: 'Output the last part of files' },
  { name: 'tar', desc: 'An archiving utility' },
  { name: 'tee', desc: 'Read from standard input and write to standard output and files' },
  { name: 'top', desc: 'Display Linux processes' },
  { name: 'touch', desc: 'Change file timestamps or create empty file' },
  { name: 'ufw', desc: 'Program for managing a netfilter firewall' },
  { name: 'uname', desc: 'Print system information' },
  { name: 'unzip', desc: 'List, test and extract compressed files in a ZIP archive' },
  { name: 'uptime', desc: 'Tell how long the system has been running' },
  { name: 'vi', desc: 'Screen-oriented (visual) display editor' },
  { name: 'vim', desc: 'Vi IMproved, a programmer text editor' },
  { name: 'wget', desc: 'The non-interactive network downloader' },
  { name: 'which', desc: 'Locate a command' },
  { name: 'whoami', desc: 'Print effective userid' },
  { name: 'yarn', desc: 'Fast, reliable, and secure dependency management' },
  { name: 'zip', desc: 'Package and compress (archive) files' },
  { name: 'zsh', desc: 'The Z shell' },
];

export const computeSuggestions = (
  rawInput: string,
  files: SFTPFile[],
  userSnippets: Snippet[],
  history: string[]
): { suggestions: SuggestionItem[]; currentToken: string } => {
  const trimmed = rawInput.trimStart();
  if (!trimmed) return { suggestions: [], currentToken: '' };

  const tokens = trimmed.split(/\s+/);
  const currentToken = tokens[tokens.length - 1] || '';
  if (!currentToken) return { suggestions: [], currentToken: '' };

  const lowerToken = currentToken.toLowerCase();
  const isFirstToken = tokens.length === 1;
  const results: SuggestionItem[] = [];

  if (isFirstToken) {
    // 1. History items
    for (const hist of history) {
      if (hist.toLowerCase().startsWith(lowerToken) && hist.toLowerCase() !== lowerToken) {
        results.push({
          id: `hist-${hist}`,
          name: hist,
          insertText: hist,
          type: 'history',
          description: 'History',
        });
        if (results.length >= 4) break;
      }
    }

    // 2. Linux commands
    for (const cmd of LINUX_COMMANDS) {
      if (cmd.name.toLowerCase().startsWith(lowerToken) && cmd.name.toLowerCase() !== lowerToken) {
        results.push({
          id: `cmd-${cmd.name}`,
          name: cmd.name,
          insertText: cmd.name,
          type: 'command',
          description: cmd.desc,
        });
        if (results.length >= 6) break;
      }
    }

    // 3. Snippets
    for (const snip of userSnippets) {
      if (
        snip.name.toLowerCase().includes(lowerToken) ||
        snip.command.toLowerCase().startsWith(lowerToken)
      ) {
        results.push({
          id: `snip-${snip.id}`,
          name: snip.name,
          insertText: snip.command,
          type: 'snippet',
          description: snip.command,
        });
        if (results.length >= 6) break;
      }
    }
  } else {
    // Arguments: files and directories in current folder
    const prevCommand = tokens[0].toLowerCase();
    const isDirNavCommand = ['cd', 'rmdir', 'pushd'].includes(prevCommand);

    for (const file of files) {
      if (file.name.toLowerCase().startsWith(lowerToken) && file.name.toLowerCase() !== lowerToken) {
        if (isDirNavCommand && !file.isDirectory) continue;
        const completionText = file.name.includes(' ')
          ? `"${file.name}${file.isDirectory ? '/' : ''}"`
          : `${file.name}${file.isDirectory ? '/' : ''}`;
        results.push({
          id: `file-${file.path}`,
          name: file.name + (file.isDirectory ? '/' : ''),
          insertText: completionText,
          type: file.isDirectory ? 'directory' : 'file',
          description: file.isDirectory ? 'Directory' : `${(file.size / 1024).toFixed(1)} KB`,
        });
        if (results.length >= 6) break;
      }
    }
  }

  return { suggestions: results, currentToken };
};

interface TerminalAutocompleteProps {
  suggestions: SuggestionItem[];
  selectedIndex: number;
  isLight: boolean;
  hintText: string;
  titleText: string;
  onApply: (item: SuggestionItem) => void;
  onHoverIndex: (index: number) => void;
}

export const TerminalAutocomplete: React.FC<TerminalAutocompleteProps> = React.memo(({
  suggestions,
  selectedIndex,
  isLight,
  hintText,
  titleText,
  onApply,
  onHoverIndex,
}) => {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div
      className={`absolute bottom-2 left-3 z-40 w-80 max-w-[calc(100%-1.5rem)] rounded-xl border shadow-2xl overflow-hidden text-xs backdrop-blur-md transition-all ${
        isLight
          ? 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-400/40'
          : 'bg-[#222222]/95 border-[#3d3d3d] text-slate-100 shadow-black/80'
      }`}
    >
      {/* Header */}
      <div
        className={`px-2.5 py-1.5 border-b flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider select-none ${
          isLight ? 'bg-slate-100 border-slate-200 text-slate-500' : 'bg-[#1a1a1a] border-[#2c2c2c] text-slate-400'
        }`}
      >
        <div className="flex items-center space-x-1 text-amber-400">
          <Sparkles className="w-3 h-3 fill-amber-400/20" />
          <span>{titleText}</span>
        </div>
        <span className="font-normal lowercase text-[9px] text-slate-500">
          {hintText}
        </span>
      </div>

      {/* Suggestions List */}
      <div className="max-h-52 overflow-y-auto divide-y divide-slate-500/10 p-1">
        {suggestions.map((item, idx) => {
          const isSelected = idx === selectedIndex;
          return (
            <div
              key={item.id}
              onClick={() => onApply(item)}
              onMouseEnter={() => onHoverIndex(idx)}
              className={`px-2.5 py-1.5 rounded-lg cursor-pointer flex items-center justify-between transition-colors ${
                isSelected
                  ? isLight
                    ? 'bg-sky-500/15 text-sky-900 font-medium'
                    : 'bg-sky-500/20 text-white font-medium'
                  : isLight
                    ? 'hover:bg-slate-100 text-slate-700'
                    : 'hover:bg-white/5 text-slate-300'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
                {item.type === 'directory' ? (
                  <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                ) : item.type === 'file' ? (
                  <FileText className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />
                ) : item.type === 'snippet' ? (
                  <Zap className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                ) : item.type === 'history' ? (
                  <RotateCw className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                ) : (
                  <TerminalIcon className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                )}
                <span className="truncate font-mono text-[11px]">{item.name}</span>
              </div>
              {item.description && (
                <span className="text-[10px] text-slate-400 truncate max-w-[120px] font-sans">
                  {item.description}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
