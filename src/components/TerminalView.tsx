import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { 
  HostProfile, SFTPFile, Snippet, DirectorySyncConfig, 
  STORAGE_KEY_DIR_SYNC, FolderClickMode, EVENT_DIR_SYNC_CHANGED, EVENT_SFTP_REFRESHED 
} from '../types';
import { useTranslation } from '../i18n';
import { sanitizeRemotePath, formatCdCommand } from '../utils/pathUtils';
import { 
  FolderTree, Activity, Search, X, Broom, RefreshCw,
  RotateCw, ArrowLeftRight, Code, ChevronDown, Play, AlertCircle
} from 'lucide-react';

import { TerminalAutocomplete, SuggestionItem, computeSuggestions } from './terminal/TerminalAutocomplete';
import { TerminalDropOverlay } from './terminal/TerminalDropOverlay';
import { TerminalMiniMonitor } from './terminal/TerminalMiniMonitor';
import { TerminalBreadcrumbs } from './terminal/TerminalBreadcrumbs';
import { TerminalSftpSidebar } from './terminal/TerminalSftpSidebar';

export type { SuggestionItem };

interface TerminalViewProps {
  sessionId: string;
  host?: HostProfile;
  isLight?: boolean;
  isActive?: boolean;
  snippets?: Snippet[];
  folderClickMode?: FolderClickMode;
  onRunSnippet?: (cmd: string) => void;
  onOpenSftp: (targetPath?: string) => void;
  onOpenMonitor: () => void;
  onOpenFileInEditor: (filePath: string, fileName: string) => void;
  onDuplicateSession: () => void;
  onReconnectSession?: (sessionId: string, host: HostProfile) => Promise<void>;
}

interface TerminalLayoutConfig {
  sftpWidth: number;
  monitorWidth: number;
  showSftp: boolean;
  showMonitor: boolean;
  sftpPos: 'left' | 'right';
  monitorPos: 'left' | 'right';
}

const STORAGE_KEY_LAYOUT = 'bestty_terminal_layout_v1';

const getInitialLayoutConfig = (): TerminalLayoutConfig => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LAYOUT);
    if (raw) {
      const parsed = JSON.parse(raw);
      const sftpWidth =
        typeof parsed.sftpWidth === 'number' && parsed.sftpWidth >= 210 ? parsed.sftpWidth : 288;
      const monitorWidth =
        typeof parsed.monitorWidth === 'number' && parsed.monitorWidth >= 210 ? parsed.monitorWidth : 288;
      const showSftp = typeof parsed.showSftp === 'boolean' ? parsed.showSftp : true;
      const showMonitor = typeof parsed.showMonitor === 'boolean' ? parsed.showMonitor : false;
      const sftpPos: 'left' | 'right' = parsed.sftpPos === 'left' ? 'left' : 'right';
      let monitorPos: 'left' | 'right' = parsed.monitorPos === 'right' ? 'right' : 'left';
      if (showSftp && showMonitor && sftpPos === monitorPos) {
        monitorPos = sftpPos === 'right' ? 'left' : 'right';
      }
      return { sftpWidth, monitorWidth, showSftp, showMonitor, sftpPos, monitorPos };
    }
  } catch (e) {}
  return {
    sftpWidth: 288,
    monitorWidth: 288,
    showSftp: true,
    showMonitor: false,
    sftpPos: 'right',
    monitorPos: 'left',
  };
};

export const TerminalView: React.FC<TerminalViewProps> = React.memo(({
  sessionId,
  host,
  isLight = false,
  isActive = true,
  snippets = [],
  folderClickMode = 'double',
  onOpenSftp,
  onOpenMonitor,
  onOpenFileInEditor,
  onReconnectSession,
}) => {
  const { t } = useTranslation();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  // Preserve host reference in case activeSessions deletes it upon connection loss
  const hostRef = useRef<HostProfile | undefined>(host);
  useEffect(() => {
    if (host) {
      hostRef.current = host;
    }
  }, [host]);

  const [isConnected, setIsConnected] = useState(true);
  const isConnectedRef = useRef(isConnected);
  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  const [isReconnecting, setIsReconnecting] = useState(false);
  const [currentDirectory, setCurrentDirectory] = useState<string>(() => host?.defaultPath || hostRef.current?.defaultPath || '~');
  const currentDirectoryRef = useRef(currentDirectory);
  useEffect(() => {
    currentDirectoryRef.current = currentDirectory;
  }, [currentDirectory]);

  // Persistent Layout State
  const initialLayout = useRef(getInitialLayoutConfig()).current;
  const [showSftpSidebar, setShowSftpSidebar] = useState(initialLayout.showSftp);
  const [showMonitorSidebar, setShowMonitorSidebar] = useState(initialLayout.showMonitor);
  const [sftpSidebarWidth, setSftpSidebarWidth] = useState(initialLayout.sftpWidth);
  const [monitorSidebarWidth, setMonitorSidebarWidth] = useState(initialLayout.monitorWidth);
  const [sftpPosition, setSftpPosition] = useState<'left' | 'right'>(initialLayout.sftpPos);
  const [monitorPosition, setMonitorPosition] = useState<'left' | 'right'>(initialLayout.monitorPos);

  // Splitter Resizing (disable CSS transitions and pointer events while dragging to prevent stutter)
  const [isResizing, setIsResizing] = useState(false);
  const resizeStateRef = useRef<{
    panel: 'sftp' | 'monitor';
    dock: 'left' | 'right';
    startX: number;
    startWidth: number;
  } | null>(null);

  // Search Bar
  const [showSearch, setShowSearch] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Snippets Quick Bar
  const [showSnippetDropdown, setShowSnippetDropdown] = useState(false);
  const snippetDropdownRef = useRef<HTMLDivElement>(null);

  // Autocomplete state
  const [autocompleteEnabled, setAutocompleteEnabled] = useState<boolean>(() => {
    return localStorage.getItem('bestty_terminal_autocomplete') !== 'false';
  });
  const autocompleteEnabledRef = useRef(autocompleteEnabled);
  useEffect(() => {
    autocompleteEnabledRef.current = autocompleteEnabled;
  }, [autocompleteEnabled]);

  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const suggestionsRef = useRef(suggestions);
  useEffect(() => {
    suggestionsRef.current = suggestions;
  }, [suggestions]);

  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const selectedSuggestionIndexRef = useRef(selectedSuggestionIndex);
  useEffect(() => {
    selectedSuggestionIndexRef.current = selectedSuggestionIndex;
  }, [selectedSuggestionIndex]);

  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const showAutocompleteRef = useRef(showAutocomplete);
  useEffect(() => {
    showAutocompleteRef.current = showAutocomplete;
  }, [showAutocomplete]);

  const typedBufferRef = useRef('');
  const commandHistoryRef = useRef<string[]>([]);
  const cachedDirectoryFilesRef = useRef<SFTPFile[]>([]);

  // Drag and drop overlay
  const [isDragOverTerminal, setIsDragOverTerminal] = useState(false);

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Path copied indicator
  const [isPathCopied, setIsPathCopied] = useState(false);

  // Directory Sync Configuration
  const [syncConfig, setSyncConfig] = useState<DirectorySyncConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DIR_SYNC);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { terminalToBrowser: true, browserToTerminal: false };
  });

  const updateSyncConfig = (next: DirectorySyncConfig) => {
    setSyncConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY_DIR_SYNC, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(EVENT_DIR_SYNC_CHANGED, { detail: next }));
    } catch {}
  };

  useEffect(() => {
    const handleSyncChange = (e: any) => {
      if (e.detail) {
        setSyncConfig(e.detail);
      }
    };
    window.addEventListener(EVENT_DIR_SYNC_CHANGED, handleSyncChange);
    return () => window.removeEventListener(EVENT_DIR_SYNC_CHANGED, handleSyncChange);
  }, []);

  // Save layout config
  useEffect(() => {
    const config: TerminalLayoutConfig = {
      sftpWidth: sftpSidebarWidth,
      monitorWidth: monitorSidebarWidth,
      showSftp: showSftpSidebar,
      showMonitor: showMonitorSidebar,
      sftpPos: sftpPosition,
      monitorPos: monitorPosition,
    };
    try {
      localStorage.setItem(STORAGE_KEY_LAYOUT, JSON.stringify(config));
    } catch {}
  }, [sftpSidebarWidth, monitorSidebarWidth, showSftpSidebar, showMonitorSidebar, sftpPosition, monitorPosition]);

  // Terminal Setup & Connection
  useEffect(() => {
    if (!terminalRef.current) return;

    const darkTheme = {
      background: '#181818',
      foreground: '#e6edf3',
      cursor: '#60cdff',
      cursorAccent: '#181818',
      selectionBackground: 'rgba(96, 205, 255, 0.3)',
      black: '#181818',
      red: '#ff7b72',
      green: '#7ee787',
      yellow: '#f2cc60',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39c5cf',
      white: '#d2a8ff',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#f0f6fc',
    };

    const lightTheme = {
      background: '#ffffff',
      foreground: '#24292f',
      cursor: '#0969da',
      cursorAccent: '#ffffff',
      selectionBackground: 'rgba(9, 105, 218, 0.25)',
      black: '#24292f',
      red: '#cf222e',
      green: '#116329',
      yellow: '#4d2d00',
      blue: '#0969da',
      magenta: '#8250df',
      cyan: '#1b7c83',
      white: '#6e7781',
      brightBlack: '#57606a',
      brightRed: '#a40e26',
      brightGreen: '#1a7f37',
      brightYellow: '#633c01',
      brightBlue: '#218bff',
      brightMagenta: '#a475f9',
      brightCyan: '#3192aa',
      brightWhite: '#8c959f',
    };

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 13,
      fontFamily: "Consolas, 'Cascadia Code', 'Fira Code', Menlo, 'Courier New', monospace",
      theme: isLight ? lightTheme : darkTheme,
      allowTransparency: true,
      smoothScrollDuration: 100,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      window.open(uri, '_blank');
    });

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);

    // Synchronize remote PTY geometry on every terminal resize
    const onResizeDispose = term.onResize(({ cols, rows }) => {
      if (cols > 5 && rows > 2) {
        window.api?.ssh.resize(sessionId, cols, rows);
      }
    });

    // Ensure viewport immediately tracks the bottom line on any keypress
    const onKeyDispose = term.onKey(() => {
      term.scrollToBottom();
    });

    // Initial safe fit
    setTimeout(() => {
      try {
        fitAddon.fit();
        if (term.cols > 10 && term.rows > 4 && window.api?.ssh) {
          window.api.ssh.resize(sessionId, term.cols, term.rows);
        }
      } catch (e) {}
    }, 50);

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    // Attach custom keyboard shortcut handler for Tab, ArrowDown, ArrowUp, Escape
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      if (showAutocompleteRef.current && suggestionsRef.current.length > 0) {
        if (event.key === 'Tab') {
          if (event.type === 'keydown') {
            event.preventDefault();
            event.stopPropagation();
            handleApplySuggestion(suggestionsRef.current[selectedSuggestionIndexRef.current]);
          }
          return false;
        }
        if (event.key === 'ArrowDown') {
          if (event.type === 'keydown') {
            event.preventDefault();
            event.stopPropagation();
            setSelectedSuggestionIndex((prev) => (prev + 1) % suggestionsRef.current.length);
          }
          return false;
        }
        if (event.key === 'ArrowUp') {
          if (event.type === 'keydown') {
            event.preventDefault();
            event.stopPropagation();
            setSelectedSuggestionIndex(
              (prev) => (prev - 1 + suggestionsRef.current.length) % suggestionsRef.current.length
            );
          }
          return false;
        }
        if (event.key === 'Escape') {
          if (event.type === 'keydown') {
            event.preventDefault();
            event.stopPropagation();
            setShowAutocomplete(false);
          }
          return false;
        }
      }

      // Clipboard shortcuts (Ctrl+Shift+C / Ctrl+Shift+V or Ctrl+C / Ctrl+V when selection)
      if (event.ctrlKey && event.shiftKey && event.key === 'C') {
        if (term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection());
          return false;
        }
      }

      return true;
    });

    // Handle user keystrokes sent to remote SSH PTY
    const onDataDispose = term.onData((data) => {
      // Prevent sending keystrokes and accumulating autocomplete buffer when disconnected
      if (!isConnectedRef.current) {
        return;
      }

      window.api?.ssh.write(sessionId, data);

      if (!autocompleteEnabledRef.current) {
        return;
      }

      // Track buffer for autocomplete
      if (data === '\r' || data === '\n') {
        const cmd = typedBufferRef.current.trim();
        if (cmd && !commandHistoryRef.current.includes(cmd)) {
          commandHistoryRef.current.unshift(cmd);
          if (commandHistoryRef.current.length > 30) commandHistoryRef.current.pop();
        }
        typedBufferRef.current = '';
        setShowAutocomplete(false);
      } else if (data === '\x7f' || data === '\b') {
        // Backspace
        typedBufferRef.current = typedBufferRef.current.slice(0, -1);
        updateSuggestions(typedBufferRef.current);
      } else if (data === '\x03' || data === '\x15') {
        // Ctrl+C or Ctrl+U
        typedBufferRef.current = '';
        setShowAutocomplete(false);
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        typedBufferRef.current += data;
        updateSuggestions(typedBufferRef.current);
      }
    });

    // Subscribe to SSH stream output
    const unsubscribeData = window.api?.ssh.onData((payload) => {
      if (payload.sessionId === sessionId) {
        term.write(payload.data);
      }
    });

    const unsubscribeClosed = window.api?.ssh.onClosed((payload) => {
      if (payload.sessionId === sessionId) {
        setIsConnected(false);
        isConnectedRef.current = false;
        setShowAutocomplete(false);
        typedBufferRef.current = '';
        term.write('\r\n\x1b[31m[Connection closed by remote host]\x1b[0m\r\n');
      }
    });

    const unsubscribeError = window.api?.ssh.onError?.((payload) => {
      if (payload.sessionId === sessionId) {
        setIsConnected(false);
        isConnectedRef.current = false;
        setShowAutocomplete(false);
        typedBufferRef.current = '';
        term.write(`\r\n\x1b[31m[Connection error: ${payload.error}]\x1b[0m\r\n`);
      }
    });

    const unsubscribeDir = window.api?.ssh.onDirectoryChanged((payload) => {
      if (payload.sessionId === sessionId && payload.directory) {
        setCurrentDirectory(payload.directory);
      }
    });

    // Handle container resize
    const resizeObserver = new ResizeObserver(() => {
      try {
        if (fitAddonRef.current && terminalRef.current) {
          fitAddonRef.current.fit();
        }
      } catch (e) {}
    });
    resizeObserver.observe(terminalRef.current);

    return () => {
      resizeObserver.disconnect();
      unsubscribeData?.();
      unsubscribeClosed?.();
      unsubscribeError?.();
      unsubscribeDir?.();
      onResizeDispose.dispose();
      onKeyDispose.dispose();
      onDataDispose.dispose();
      term.dispose();
      xtermInstance.current = null;
    };
  }, [sessionId, isLight]);

  // Immediate fit and focus when tab becomes active / visible
  useEffect(() => {
    if (isActive) {
      const rafId = requestAnimationFrame(() => {
        try {
          if (fitAddonRef.current && xtermInstance.current) {
            fitAddonRef.current.fit();
            const term = xtermInstance.current;
            if (term.cols > 10 && term.rows > 4 && window.api?.ssh) {
              window.api.ssh.resize(sessionId, term.cols, term.rows);
            }
            term.focus();
          }
        } catch {}
      });
      return () => cancelAnimationFrame(rafId);
    }
  }, [isActive, sessionId]);

  // Initial directory fetch
  useEffect(() => {
    window.api?.ssh.getCurrentDirectory(sessionId).then((dir) => {
      if (dir) setCurrentDirectory(dir);
    });
  }, [sessionId]);

  // Cache folder files for autocomplete whenever directory changes
  useEffect(() => {
    if (!currentDirectory) return;
    const clean = sanitizeRemotePath(currentDirectory);
    window.api?.sftp.list(sessionId, clean).then((res) => {
      if (res?.files) {
        cachedDirectoryFilesRef.current = res.files;
      }
    }).catch(() => {});
  }, [sessionId, currentDirectory]);

  // Compute suggestions on typing
  const updateSuggestions = useCallback((buffer: string) => {
    if (!isActive) return;
    const { suggestions: list } = computeSuggestions(
      buffer,
      cachedDirectoryFilesRef.current,
      snippets,
      commandHistoryRef.current
    );
    setSuggestions(list);
    setSelectedSuggestionIndex(0);
    setShowAutocomplete(list.length > 0);
  }, [snippets, isActive]);

  const handleApplySuggestion = (item: SuggestionItem) => {
    if (!xtermInstance.current || !item) return;

    const raw = typedBufferRef.current;
    const tokens = raw.trimStart().split(/\s+/);
    const currentToken = tokens[tokens.length - 1] || '';

    // Send backspaces to delete currently typed incomplete token
    if (currentToken.length > 0) {
      const backspaces = '\b \b'.repeat(currentToken.length);
      window.api?.ssh.write(sessionId, backspaces);
    }

    // Write full completion
    window.api?.ssh.write(sessionId, item.insertText);

    // Update internal buffer
    const prefix = raw.slice(0, raw.length - currentToken.length);
    typedBufferRef.current = prefix + item.insertText;

    setShowAutocomplete(false);
  };

  // Reconnection
  const handleReconnect = async () => {
    const targetHost = host || hostRef.current;
    if (!targetHost) {
      xtermInstance.current?.write('\r\n\x1b[31m[Reconnect error: No host profile available]\x1b[0m\r\n');
      return;
    }
    setIsReconnecting(true);
    try {
      xtermInstance.current?.write(`\r\n\x1b[33m[${t('terminal.reconnecting') || 'Reconnecting to server...'}]\x1b[0m\r\n`);
      const cols = xtermInstance.current?.cols || 80;
      const rows = xtermInstance.current?.rows || 24;
      await window.api.ssh.connect(sessionId, targetHost, cols, rows);
      setIsConnected(true);
      isConnectedRef.current = true;
      if (onReconnectSession) {
        await onReconnectSession(sessionId, targetHost);
      }
      xtermInstance.current?.write(`\x1b[32m[${t('terminal.reconnected') || 'Connection restored successfully'}]\x1b[0m\r\n`);
      xtermInstance.current?.focus();
    } catch (e: any) {
      xtermInstance.current?.write(`\x1b[31m[Reconnect failed: ${e.message || String(e)}]\x1b[0m\r\n`);
    } finally {
      setIsReconnecting(false);
    }
  };

  // Clear Terminal
  const handleClear = () => {
    xtermInstance.current?.clear();
  };

  // Search in Terminal
  const handleSearchNext = () => {
    if (searchAddonRef.current && searchTerm) {
      searchAddonRef.current.findNext(searchTerm);
    }
  };

  const handleSearchPrev = () => {
    if (searchAddonRef.current && searchTerm) {
      searchAddonRef.current.findPrevious(searchTerm);
    }
  };

  // Send command to terminal
  const handleSendCommand = (cmd: string) => {
    window.api?.ssh.write(sessionId, cmd);
    xtermInstance.current?.focus();
  };

  // Drag and drop splitter resizing
  const handleStartResize = (e: React.MouseEvent, panel: 'sftp' | 'monitor', dock: 'left' | 'right') => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStateRef.current = {
      panel,
      dock,
      startX: e.clientX,
      startWidth: panel === 'sftp' ? sftpSidebarWidth : monitorSidebarWidth,
    };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeStateRef.current) return;
      const { panel, dock, startX, startWidth } = resizeStateRef.current;
      const deltaX = dock === 'left' ? e.clientX - startX : startX - e.clientX;
      const newWidth = Math.max(210, Math.min(600, startWidth + deltaX));

      if (panel === 'sftp') {
        setSftpSidebarWidth(newWidth);
      } else {
        setMonitorSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (resizeStateRef.current) {
        resizeStateRef.current = null;
        setIsResizing(false);
        setTimeout(() => fitAddonRef.current?.fit(), 30);
      }
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  // Swap panels positions
  const handleSwapPanels = () => {
    const nextSftpPos = sftpPosition === 'left' ? 'right' : 'left';
    const nextMonPos = monitorPosition === 'left' ? 'right' : 'left';
    setSftpPosition(nextSftpPos);
    setMonitorPosition(nextMonPos);
    setTimeout(() => fitAddonRef.current?.fit(), 100);
  };

  // Breadcrumb navigation
  const handleNavigateBreadcrumb = (targetDir: string) => {
    const clean = sanitizeRemotePath(targetDir);
    const cdCmd = formatCdCommand(clean);
    handleSendCommand(cdCmd.endsWith('\n') ? cdCmd : `${cdCmd}\n`);
    setCurrentDirectory(clean);
  };

  const handleNavigateUp = () => {
    if (currentDirectory === '/' || currentDirectory === '') return;
    const parts = currentDirectory.split('/').filter(Boolean);
    parts.pop();
    const upPath = '/' + parts.join('/');
    handleNavigateBreadcrumb(upPath);
  };

  const handleCopyPath = () => {
    navigator.clipboard.writeText(currentDirectory);
    setIsPathCopied(true);
    setTimeout(() => setIsPathCopied(false), 2000);
  };

  // Terminal Drop handling (from Windows Explorer or Local Browser)
  const handleTerminalDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOverTerminal(false);
    const targetDir = currentDirectory || host?.defaultPath || '/root';

    // 1. Files from Windows Explorer
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try {
        for (const file of Array.from(e.dataTransfer.files)) {
          const localPath = (file as any).path;
          if (!localPath) continue;
          const fileName = file.name || localPath.split(/[\\/]/).pop();
          const remoteDest = targetDir.endsWith('/') ? `${targetDir}${fileName}` : `${targetDir}/${fileName}`;
          await window.api.sftp.uploadFile(sessionId, localPath, remoteDest);
          xtermInstance.current?.write(`\r\n\x1b[32m[BesTTY] Uploaded: ${fileName} -> ${remoteDest}\x1b[0m\r\n`);
        }
        window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
      } catch (err: any) {
        xtermInstance.current?.write(`\r\n\x1b[31m[BesTTY Upload Failed]: ${err.message || String(err)}\x1b[0m\r\n`);
      }
      return;
    }

    // 2. From Local Files Browser pane
    const localData = e.dataTransfer.getData('application/x-bestty-local');
    if (localData) {
      try {
        const item = JSON.parse(localData);
        if (item.path) {
          const remoteDest = targetDir.endsWith('/') ? `${targetDir}${item.name}` : `${targetDir}/${item.name}`;
          await window.api.sftp.uploadFile(sessionId, item.path, remoteDest);
          xtermInstance.current?.write(`\r\n\x1b[32m[BesTTY] Uploaded: ${item.name} -> ${remoteDest}\x1b[0m\r\n`);
          window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
        }
      } catch (err: any) {
        xtermInstance.current?.write(`\r\n\x1b[31m[BesTTY Upload Failed]: ${err.message || String(err)}\x1b[0m\r\n`);
      }
    }
  };

  // Render Splitter bar
  const renderSplitter = (panel: 'sftp' | 'monitor', dock: 'left' | 'right') => {
    const isSftp = panel === 'sftp';
    return (
      <div
        onMouseDown={(e) => handleStartResize(e, panel, dock)}
        onDoubleClick={() => {
          if (isSftp) setSftpSidebarWidth(288);
          else setMonitorSidebarWidth(288);
          setTimeout(() => fitAddonRef.current?.fit(), 50);
        }}
        title={t('terminal.resizerTooltip')}
        className={`w-1 hover:w-1.5 cursor-col-resize flex-shrink-0 relative group select-none z-20 ${
          isLight
            ? 'bg-slate-200/90 hover:bg-sky-400 active:bg-sky-500'
            : isSftp
              ? 'bg-[#2a2a2a] hover:bg-sky-500/80 active:bg-sky-500'
              : 'bg-[#2a2a2a] hover:bg-purple-500/80 active:bg-purple-500'
        } ${isResizing ? (isSftp ? 'bg-sky-500 w-1.5' : 'bg-purple-500 w-1.5') : ''}`}
      >
        <div className="absolute inset-y-0 -left-1.5 -right-1.5 cursor-col-resize" />
      </div>
    );
  };

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden relative ${
      isLight ? 'bg-[#fafafa] text-slate-800' : 'bg-[#181818] text-slate-100'
    }`}>
      {/* Main Split Layout: Left Panel + Center Terminal + Right Panel */}
      <div className="flex-1 flex overflow-hidden relative min-h-0">
        {/* Left Side Slot */}
        {showSftpSidebar && sftpPosition === 'left' && (
          <>
            <TerminalSftpSidebar
              sessionId={sessionId}
              width={sftpSidebarWidth}
              position="left"
              currentPath={currentDirectory}
              showMonitorSidebar={showMonitorSidebar}
              isLight={isLight}
              folderClickMode={folderClickMode}
              t={t}
              onSwapPanels={handleSwapPanels}
              onTogglePosition={() => {
                setSftpPosition('right');
                setTimeout(() => fitAddonRef.current?.fit(), 100);
              }}
              onClose={() => {
                setShowSftpSidebar(false);
                setTimeout(() => fitAddonRef.current?.fit(), 100);
              }}
              onOpenFileInEditor={onOpenFileInEditor}
              onNavigateFolderInTerminal={(path) => handleNavigateBreadcrumb(path)}
            />
            {renderSplitter('sftp', 'left')}
          </>
        )}

        {showMonitorSidebar && monitorPosition === 'left' && (
          <>
            <TerminalMiniMonitor
              sessionId={sessionId}
              width={monitorSidebarWidth}
              position="left"
              showSftpSidebar={showSftpSidebar}
              isLight={isLight}
              t={t}
              onSwapPanels={handleSwapPanels}
              onTogglePosition={() => {
                setMonitorPosition('right');
                setTimeout(() => fitAddonRef.current?.fit(), 100);
              }}
              onClose={() => {
                setShowMonitorSidebar(false);
                setTimeout(() => fitAddonRef.current?.fit(), 100);
              }}
              onSendTerminalCommand={handleSendCommand}
            />
            {renderSplitter('monitor', 'left')}
          </>
        )}

        {/* Center Terminal Column */}
        <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
          {/* Mini Toolbar inside Terminal Zone */}
          <div className={`h-8 border-b flex items-center justify-between px-3 text-xs select-none flex-shrink-0 ${
            isLight ? 'bg-[#f0f0f0] border-[#e0e0e0]' : 'bg-[#202020] border-[#2d2d2d]'
          }`}>
            {/* Left: Session info & search */}
            <div className="flex items-center space-x-2 min-w-0">
              <div className="flex items-center space-x-1.5 font-mono text-[11px] min-w-0">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
                }`} />
                <span className={`font-semibold truncate max-w-[150px] ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
                  {host || hostRef.current ? `${(host || hostRef.current)!.username}@${(host || hostRef.current)!.host}` : 'SSH'}
                </span>
                {!isConnected && (
                  <span className="text-[10px] text-red-400 font-sans font-medium px-1.5 py-0.2 bg-red-500/10 rounded border border-red-500/20 flex-shrink-0">
                    {t('terminal.disconnected') || 'Отключено'}
                  </span>
                )}
              </div>

              {/* Search Toggle */}
              <button
                onClick={() => setShowSearch(!showSearch)}
                className={`p-1 rounded transition-colors flex-shrink-0 ${
                  showSearch ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400 hover:text-white'
                }`}
                title={t('terminal.search')}
              >
                <Search className="w-3.5 h-3.5" />
              </button>

              {showSearch && (
                <div className="flex items-center space-x-1 bg-black/40 px-1.5 py-0.5 rounded border border-slate-700 flex-shrink-0">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (e.shiftKey) handleSearchPrev();
                        else handleSearchNext();
                      }
                    }}
                    placeholder={t('terminal.search')}
                    className="bg-transparent border-none outline-none text-[11px] w-24 text-white font-mono"
                    autoFocus
                  />
                  <button onClick={handleSearchPrev} className="text-slate-400 hover:text-white text-[10px]">▲</button>
                  <button onClick={handleSearchNext} className="text-slate-400 hover:text-white text-[10px]">▼</button>
                  <button onClick={() => setShowSearch(false)} className="text-slate-400 hover:text-white">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Right: Quick actions & Terminal Actions flush to right edge (adjacent to right divider line) */}
            <div className="flex items-center space-x-1 flex-shrink-0">
              {/* Toggle SFTP Sidebar */}
              <button
                onClick={() => {
                  setShowSftpSidebar(!showSftpSidebar);
                  setTimeout(() => fitAddonRef.current?.fit(), 100);
                }}
                className={`p-1 rounded transition-colors ${
                  showSftpSidebar ? 'bg-sky-500/20 text-sky-400' : 'text-slate-400 hover:text-white'
                }`}
                title="Toggle SFTP Files Sidebar"
              >
                <FolderTree className="w-3.5 h-3.5" />
              </button>

              {/* Toggle Mini-Monitor Sidebar */}
              <button
                onClick={() => {
                  setShowMonitorSidebar(!showMonitorSidebar);
                  setTimeout(() => fitAddonRef.current?.fit(), 100);
                }}
                className={`p-1 rounded transition-colors ${
                  showMonitorSidebar ? 'bg-purple-500/20 text-purple-400' : 'text-slate-400 hover:text-white'
                }`}
                title="Toggle Mini-Monitor Sidebar"
              >
                <Activity className="w-3.5 h-3.5" />
              </button>

              <div className="w-[1px] h-3.5 bg-slate-700/50 mx-1" />

              {/* Reconnect Button */}
              {(!isConnected || isReconnecting) && (
                <button
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className={`flex items-center space-x-1 px-2.5 py-0.5 rounded text-[11px] font-medium transition-all shadow-sm cursor-pointer ${
                    isReconnecting
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 cursor-wait'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold'
                  }`}
                  title={t('terminal.reconnect')}
                >
                  <RotateCw className={`w-3.5 h-3.5 ${isReconnecting ? 'animate-spin' : ''}`} />
                  <span>{isReconnecting ? (t('terminal.reconnecting') || 'Подключение...') : (t('terminal.reconnect') || 'Переподключиться')}</span>
                </button>
              )}

              {/* Snippets Launcher */}
              {snippets.length > 0 && (
                <div className="relative" ref={snippetDropdownRef}>
                  <button
                    onClick={() => setShowSnippetDropdown(!showSnippetDropdown)}
                    className="flex items-center space-x-1 px-1.5 py-0.5 rounded hover:bg-white/10 text-amber-400 text-[11px] transition-colors"
                    title={t('snippets.title')}
                  >
                    <Code className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[10px]">{t('snippets.title')}</span>
                    <ChevronDown className="w-3 h-3" />
                  </button>

                  {showSnippetDropdown && (
                    <div
                      className={`absolute right-0 mt-1 w-64 max-h-60 overflow-y-auto rounded-xl border shadow-2xl p-1 z-50 text-xs ${
                        isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#222222] border-[#3a3a3a] text-slate-100'
                      }`}
                    >
                      <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-700/40 uppercase">
                        {t('snippets.title')}
                      </div>
                      {snippets.map((snip) => (
                        <button
                          key={snip.id}
                          onClick={() => {
                            handleSendCommand(snip.command.endsWith('\n') ? snip.command : `${snip.command}\n`);
                            setShowSnippetDropdown(false);
                          }}
                          className="w-full text-left px-2 py-1.5 rounded hover:bg-sky-500/20 flex items-center justify-between group"
                        >
                          <span className="font-medium truncate mr-2">{snip.name}</span>
                          <Play className="w-3 h-3 text-sky-400 opacity-0 group-hover:opacity-100" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Clear screen */}
              <button
                onClick={handleClear}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                title={t('terminal.clear')}
              >
                <Broom className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Center Terminal Canvas */}
          <div
            ref={terminalRef}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY });
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isDragOverTerminal) setIsDragOverTerminal(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setIsDragOverTerminal(false);
              }
            }}
            onDrop={handleTerminalDrop}
            className={`flex-1 h-full p-1 overflow-hidden relative ${isResizing ? 'pointer-events-none select-none' : ''}`}
          >
            {/* Disconnected Overlay Banner */}
            {!isConnected && (
              <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-red-950/85 border border-red-500/40 text-red-200 text-xs shadow-xl backdrop-blur-sm">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{t('terminal.disconnected') || 'Сессия отключена'}</span>
                <button
                  onClick={handleReconnect}
                  disabled={isReconnecting}
                  className="flex items-center space-x-1 px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] transition-colors shadow cursor-pointer"
                >
                  <RotateCw className={`w-3 h-3 ${isReconnecting ? 'animate-spin' : ''}`} />
                  <span>{isReconnecting ? (t('terminal.reconnecting') || 'Подключение...') : (t('terminal.reconnect') || 'Переподключиться')}</span>
                </button>
              </div>
            )}

            {/* File Drop Overlay */}
            <TerminalDropOverlay
              isDragOver={isDragOverTerminal}
              currentDirectory={currentDirectory}
              defaultPath={host?.defaultPath || hostRef.current?.defaultPath}
              titleText={t('terminal.dropUploadTitle') || 'Загрузить файлы в терминал'}
              hintText={t('split.dragHint') || 'Отпустите файлы для немедленной загрузки на сервер'}
            />

            {/* Autocomplete Floating Popup */}
            {showAutocomplete && isConnected && (
              <TerminalAutocomplete
                suggestions={suggestions}
                selectedIndex={selectedSuggestionIndex}
                isLight={isLight}
                hintText={t('terminal.autocompleteHint')}
                titleText={t('terminal.autocomplete')}
                onApply={handleApplySuggestion}
                onHoverIndex={setSelectedSuggestionIndex}
              />
            )}
          </div>
        </div>

        {/* Right Side Slot */}
        {showMonitorSidebar && monitorPosition === 'right' && (
          <>
            {renderSplitter('monitor', 'right')}
            <TerminalMiniMonitor
              sessionId={sessionId}
              width={monitorSidebarWidth}
              position="right"
              showSftpSidebar={showSftpSidebar}
              isLight={isLight}
              t={t}
              onSwapPanels={handleSwapPanels}
              onTogglePosition={() => {
                setMonitorPosition('left');
                setTimeout(() => fitAddonRef.current?.fit(), 100);
              }}
              onClose={() => {
                setShowMonitorSidebar(false);
                setTimeout(() => fitAddonRef.current?.fit(), 100);
              }}
              onSendTerminalCommand={handleSendCommand}
            />
          </>
        )}

        {showSftpSidebar && sftpPosition === 'right' && (
          <>
            {renderSplitter('sftp', 'right')}
            <TerminalSftpSidebar
              sessionId={sessionId}
              width={sftpSidebarWidth}
              position="right"
              currentPath={currentDirectory}
              showMonitorSidebar={showMonitorSidebar}
              isLight={isLight}
              folderClickMode={folderClickMode}
              t={t}
              onSwapPanels={handleSwapPanels}
              onTogglePosition={() => {
                setSftpPosition('left');
                setTimeout(() => fitAddonRef.current?.fit(), 100);
              }}
              onClose={() => {
                setShowSftpSidebar(false);
                setTimeout(() => fitAddonRef.current?.fit(), 100);
              }}
              onOpenFileInEditor={onOpenFileInEditor}
              onNavigateFolderInTerminal={(path) => handleNavigateBreadcrumb(path)}
            />
          </>
        )}
      </div>

      {/* Bottom: Breadcrumbs & Directory Sync Bar */}
      <TerminalBreadcrumbs
        sessionId={sessionId}
        currentDirectory={currentDirectory}
        isLight={isLight}
        syncConfig={syncConfig}
        onUpdateSyncConfig={updateSyncConfig}
        onNavigateBreadcrumb={handleNavigateBreadcrumb}
        onNavigateUp={handleNavigateUp}
        onOpenInSftp={() => onOpenSftp(currentDirectory)}
        onCopyPath={handleCopyPath}
        isPathCopied={isPathCopied}
        t={t}
      />
    </div>
  );
});
