import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { HostProfile, SFTPFile, ServerMetrics, RemoteProcess } from '../types';
import { useTranslation } from '../i18n';
import { 
  FolderTree, Activity, Search, X, Trash2, 
  Folder, FileText, FileCode, FileArchive, CornerLeftUp, 
  RotateCw, ChevronRight, ChevronLeft, Edit, Zap, PanelLeft, PanelRight, 
  Terminal as TerminalIcon, Clipboard, ArrowLeftRight, HardDrive, Cpu, Layers
} from 'lucide-react';

interface TerminalViewProps {
  sessionId: string;
  host?: HostProfile;
  isLight?: boolean;
  isActive?: boolean;
  onOpenSftp: () => void;
  onOpenMonitor: () => void;
  onOpenFileInEditor: (filePath: string, fileName: string) => void;
  onDuplicateSession: () => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  sessionId,
  host,
  isLight = false,
  isActive = true,
  onOpenSftp,
  onOpenMonitor,
  onOpenFileInEditor,
  onDuplicateSession,
}) => {
  const { t } = useTranslation();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(true);

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Sidebars State (Opposite side enforcement)
  const [showSftpSidebar, setShowSftpSidebar] = useState(true);
  const [sftpPosition, setSftpPosition] = useState<'left' | 'right'>('right');

  const [showMonitorSidebar, setShowMonitorSidebar] = useState(false);
  const [monitorPosition, setMonitorPosition] = useState<'left' | 'right'>('left');

  // Mini-Monitor Metrics State
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [processes, setProcesses] = useState<RemoteProcess[]>([]);

  // SFTP Files State
  const [sftpPath, setSftpPath] = useState(host?.defaultPath || '/');
  const [sftpFiles, setSftpFiles] = useState<SFTPFile[]>([]);
  const [isSftpLoading, setIsSftpLoading] = useState(false);
  const [sftpFilter, setSftpFilter] = useState('');

  // Paste command from clipboard into terminal
  const handlePasteFromClipboard = async () => {
    try {
      let text = '';
      if (window.api?.clipboard) {
        text = await window.api.clipboard.readText();
      } else {
        text = await navigator.clipboard.readText();
      }
      if (text) {
        window.api?.ssh.write(sessionId, text);
        xtermInstance.current?.focus();
      }
    } catch (err) {
      console.error('Failed to paste clipboard text:', err);
    }
  };

  // Enforce opposite sides when both sidebars are active
  const toggleSftpPosition = () => {
    const nextSftpPos = sftpPosition === 'left' ? 'right' : 'left';
    setSftpPosition(nextSftpPos);
    if (showMonitorSidebar) {
      setMonitorPosition(nextSftpPos === 'right' ? 'left' : 'right');
    }
    setTimeout(() => fitAddonRef.current?.fit(), 100);
  };

  const toggleMonitorPosition = () => {
    const nextMonPos = monitorPosition === 'left' ? 'right' : 'left';
    setMonitorPosition(nextMonPos);
    if (showSftpSidebar) {
      setSftpPosition(nextMonPos === 'right' ? 'left' : 'right');
    }
    setTimeout(() => fitAddonRef.current?.fit(), 100);
  };

  const handleSwapPanels = () => {
    const newSftpPos = sftpPosition === 'right' ? 'left' : 'right';
    const newMonPos = monitorPosition === 'right' ? 'left' : 'right';
    setSftpPosition(newSftpPos);
    setMonitorPosition(newMonPos);
    setTimeout(() => fitAddonRef.current?.fit(), 100);
  };

  // Toggle Mini-Monitor Sidebar
  const handleToggleMonitorSidebar = () => {
    const nextState = !showMonitorSidebar;
    setShowMonitorSidebar(nextState);
    if (nextState && showSftpSidebar) {
      // Ensure they don't collide on the same side
      setMonitorPosition(sftpPosition === 'right' ? 'left' : 'right');
    }
    setTimeout(() => fitAddonRef.current?.fit(), 100);
  };

  // Load directory in SFTP sidebar
  const loadSidebarDirectory = async (pathToGo: string) => {
    setIsSftpLoading(true);
    try {
      const res = await window.api?.sftp.list(sessionId, pathToGo);
      if (res) {
        setSftpPath(res.currentPath);
        setSftpFiles(res.files);
      }
    } catch (e) {
      // Ignore
    } finally {
      setIsSftpLoading(false);
    }
  };

  useEffect(() => {
    if (showSftpSidebar) {
      loadSidebarDirectory(sftpPath);
    }
  }, [showSftpSidebar, sessionId]);

  // Mini-Monitor Telemetry Lifecycle
  useEffect(() => {
    if (!showMonitorSidebar) return;

    window.api?.monitor.start(sessionId);

    const unsubscribe = window.api?.monitor.onStats((payload) => {
      if (payload.sessionId === sessionId) {
        setMetrics(payload.metrics);
        setProcesses(payload.processes);
      }
    });

    return () => {
      unsubscribe?.();
      if (!showMonitorSidebar) {
        window.api?.monitor.stop(sessionId);
      }
    };
  }, [showMonitorSidebar, sessionId]);

  // Terminal Setup
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
      brightWhite: '#ffffff',
    };

    const lightTheme = {
      background: '#fafafa',
      foreground: '#24292f',
      cursor: '#0067b8',
      cursorAccent: '#ffffff',
      selectionBackground: 'rgba(0, 103, 184, 0.25)',
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
      cursorStyle: 'block',
      fontFamily: 'Cascadia Code, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: isLight ? lightTheme : darkTheme,
      allowTransparency: true,
      scrollback: 10000,
    });

    const fitAddon = new FitAddon();
    const searchAddon = new SearchAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(searchAddon);
    term.loadAddon(webLinksAddon);

    term.open(terminalRef.current);

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

    // Attach custom keyboard shortcut handler for Ctrl+C, Ctrl+V, Ctrl+Shift+V
    term.attachCustomKeyEventHandler((event: KeyboardEvent) => {
      // Ctrl+C with active selection: copy to clipboard
      if (event.ctrlKey && !event.shiftKey && !event.altKey && event.code === 'KeyC') {
        if (term.hasSelection()) {
          const selection = term.getSelection();
          if (window.api?.clipboard) {
            window.api.clipboard.writeText(selection);
          } else {
            navigator.clipboard.writeText(selection);
          }
          return false; // Prevent sending SIGINT
        }
        return true; // No selection: send SIGINT
      }

      // Ctrl+V or Ctrl+Shift+V: paste from clipboard
      if ((event.ctrlKey && event.code === 'KeyV') || (event.ctrlKey && event.shiftKey && event.code === 'KeyV')) {
        if (event.type === 'keydown') {
          handlePasteFromClipboard();
        }
        return false;
      }

      return true;
    });

    const onDataDispose = term.onData((data) => {
      window.api?.ssh.write(sessionId, data);
    });

    const unsubscribeData = window.api?.ssh.onData((payload) => {
      if (payload.sessionId === sessionId) {
        term.write(payload.data);
      }
    });

    const unsubscribeClosed = window.api?.ssh.onClosed((payload) => {
      if (payload.sessionId === sessionId) {
        setIsConnected(false);
        term.write(`\r\n\x1b[31m${t('terminal.sessionClosed')}\x1b[0m\r\n`);
      }
    });

    const unsubscribeError = window.api?.ssh.onError((payload) => {
      if (payload.sessionId === sessionId) {
        term.write(`\r\n\x1b[31m[SSH Error]: ${payload.error}\x1b[0m\r\n`);
      }
    });

    // OSC 7 directory tracking
    const unsubscribeDir = window.api?.ssh.onDirectoryChanged((payload) => {
      if (payload.sessionId === sessionId && payload.directory) {
        setSftpPath(payload.directory);
        loadSidebarDirectory(payload.directory);
      }
    });

    // Safe ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 50 && entry.contentRect.height > 50) {
          try {
            fitAddon.fit();
            if (term.cols > 10 && term.rows > 4 && window.api?.ssh) {
              window.api.ssh.resize(sessionId, term.cols, term.rows);
            }
          } catch (e) {}
        }
      }
    });

    resizeObserver.observe(terminalRef.current);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.code === 'KeyF') {
        e.preventDefault();
        setShowSearch((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      resizeObserver.disconnect();
      onDataDispose.dispose();
      unsubscribeData?.();
      unsubscribeClosed?.();
      unsubscribeError?.();
      unsubscribeDir?.();
      term.dispose();
    };
  }, [sessionId, isLight]);

  // Handle Tab Visibility Changes: prevent terminal from shifting upwards
  useEffect(() => {
    if (isActive && xtermInstance.current && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          const term = xtermInstance.current;
          if (term && term.cols > 10 && term.rows > 4) {
            window.api?.ssh.resize(sessionId, term.cols, term.rows);
            term.scrollToBottom();
            term.focus();
          }
        } catch (e) {}
      }, 60);
    }
  }, [isActive]);

  const handleSearchNext = () => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findNext(searchQuery);
    }
  };

  const handleClear = () => {
    xtermInstance.current?.clear();
  };

  const handleSidebarNavigateUp = () => {
    if (sftpPath === '/' || sftpPath === '') return;
    const parts = sftpPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = '/' + parts.join('/');
    loadSidebarDirectory(upPath);
  };

  const handleSidebarFileClick = (file: SFTPFile) => {
    if (file.isDirectory) {
      loadSidebarDirectory(file.path);
    } else {
      onOpenFileInEditor(file.path, file.name);
    }
  };

  // Open folder directly in active terminal
  const handleOpenFolderInTerminal = (folderPath: string) => {
    window.api?.ssh.write(sessionId, `cd "${folderPath}"\n`);
    xtermInstance.current?.focus();
  };

  const handleKillProcess = async (pid: number) => {
    if (!confirm(t('monitor.killConfirm').replace('{pid}', String(pid)))) return;
    try {
      await window.api?.monitor.killProcess(sessionId, pid, 'SIGTERM');
    } catch (err: any) {
      alert(`Kill process failed: ${err.message}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    const units = ['B', 'K', 'M', 'G'];
    let idx = 0;
    let b = bytes;
    while (b >= 1024 && idx < units.length - 1) {
      b /= 1024;
      idx++;
    }
    return `${b.toFixed(idx === 0 ? 0 : 1)}${units[idx]}`;
  };

  const getFileIcon = (file: SFTPFile) => {
    if (file.isDirectory) return <Folder className="w-3.5 h-3.5 text-amber-400 fill-amber-400/20 flex-shrink-0" />;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['json', 'yaml', 'yml', 'js', 'ts', 'py', 'sh', 'php', 'html', 'css', 'conf'].includes(ext || '')) {
      return <FileCode className="w-3.5 h-3.5 text-sky-400 flex-shrink-0" />;
    }
    if (['tar', 'gz', 'zip', 'xz', 'bz2', '7z'].includes(ext || '')) {
      return <FileArchive className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />;
    }
    return <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />;
  };

  const filteredSidebarFiles = sftpFiles.filter((f) =>
    f.name.toLowerCase().includes(sftpFilter.toLowerCase())
  );

  // Close context menu on click anywhere
  useEffect(() => {
    const handleWindowClick = () => setContextMenu(null);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  // Render SFTP Sidebar Component
  const renderSftpSidebar = () => (
    <div className={`w-72 flex flex-col h-full select-none shadow-lg z-10 transition-all ${
      sftpPosition === 'right' ? 'border-l' : 'border-r'
    } ${
      isLight ? 'bg-[#f4f4f4] border-[#e0e0e0]' : 'bg-[#1c1c1c] border-[#2c2c2c]'
    }`}>
      {/* Sidebar Header & Path Navigation */}
      <div className={`p-2 border-b flex flex-col space-y-1.5 ${
        isLight ? 'bg-[#ececec] border-[#e0e0e0]' : 'bg-[#222222] border-[#2c2c2c]'
      }`}>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1">
            <FolderTree className="w-3.5 h-3.5" />
            <span>Remote Files</span>
          </span>
          <div className="flex items-center space-x-1">
            {/* Swap Panels Button (when both are shown) */}
            {showMonitorSidebar && (
              <button
                onClick={handleSwapPanels}
                className="p-1 rounded hover:bg-white/10 text-amber-400 hover:text-amber-300"
                title={t('terminal.swapPanels')}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            )}

            {/* Position Switch (Left / Right) */}
            <button
              onClick={toggleSftpPosition}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title={sftpPosition === 'left' ? 'Dock to Right' : 'Dock to Left'}
            >
              {sftpPosition === 'left' ? <PanelRight className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={handleSidebarNavigateUp}
              disabled={sftpPath === '/' || sftpPath === ''}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30"
              title={t('sftp.parentFolder')}
            >
              <CornerLeftUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => loadSidebarDirectory(sftpPath)}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title={t('sftp.refresh')}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSftpLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => {
                setShowSftpSidebar(false);
                setTimeout(() => fitAddonRef.current?.fit(), 100);
              }}
              className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              title="Close Sidebar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Path Breadcrumb Display + cd into terminal button */}
        <div className="flex items-center space-x-1">
          <div className={`flex-1 px-2 py-0.5 rounded text-[10px] font-mono truncate border ${
            isLight ? 'bg-white text-slate-700 border-slate-300' : 'bg-[#161616] text-slate-300 border-[#333]'
          }`} title={sftpPath}>
            {sftpPath}
          </div>
          <button
            onClick={() => handleOpenFolderInTerminal(sftpPath)}
            className="px-1.5 py-0.5 rounded bg-sky-600/20 border border-sky-500/30 text-sky-400 hover:bg-sky-600/30 text-[10px] font-mono flex items-center space-x-0.5"
            title={t('terminal.cdToTerminal')}
          >
            <TerminalIcon className="w-3 h-3" />
            <span>cd</span>
          </button>
        </div>

        {/* Quick Filter */}
        <input
          type="text"
          placeholder={t('sftp.filterFiles')}
          value={sftpFilter}
          onChange={(e) => setSftpFilter(e.target.value)}
          className={`w-full px-2 py-0.5 text-[11px] rounded border focus:outline-none focus:border-sky-500 ${
            isLight ? 'bg-white text-slate-900 border-slate-300' : 'bg-[#181818] text-white border-[#333]'
          }`}
        />
      </div>

      {/* Sidebar File Tree */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-500/10 text-xs font-mono">
        {filteredSidebarFiles.length === 0 ? (
          <div className="p-4 text-center text-[11px] text-slate-500">
            {isSftpLoading ? 'Loading...' : 'Folder is empty'}
          </div>
        ) : (
          filteredSidebarFiles.map((file) => (
            <div
              key={file.path}
              onDoubleClick={() => handleSidebarFileClick(file)}
              className={`flex items-center justify-between px-2 py-1.5 cursor-pointer group transition-colors ${
                isLight ? 'hover:bg-slate-200/80 text-slate-800' : 'hover:bg-[#252525] text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-1.5 truncate flex-1 mr-1">
                {getFileIcon(file)}
                <span className="truncate text-[11px] font-sans group-hover:font-medium">
                  {file.name}
                </span>
              </div>

              <div className="flex items-center space-x-1 text-[10px] text-slate-400 flex-shrink-0">
                {file.isDirectory && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenFolderInTerminal(file.path);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-sky-500/20 text-sky-400 rounded flex items-center space-x-0.5"
                    title={`Open in Terminal (cd "${file.path}")`}
                  >
                    <TerminalIcon className="w-3 h-3" />
                  </button>
                )}

                <span>{formatSize(file.size)}</span>
                {!file.isDirectory && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenFileInEditor(file.path, file.name);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-sky-500/20 text-sky-400 rounded"
                    title="Open in Monaco Editor"
                  >
                    <Edit className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  // Render Mini-Monitor Sidebar Component
  const renderMiniMonitorSidebar = () => (
    <div className={`w-72 flex flex-col h-full select-none shadow-lg z-10 transition-all ${
      monitorPosition === 'right' ? 'border-l' : 'border-r'
    } ${
      isLight ? 'bg-[#f4f4f4] border-[#e0e0e0]' : 'bg-[#1c1c1c] border-[#2c2c2c]'
    }`}>
      {/* Mini-Monitor Header */}
      <div className={`p-2 border-b flex items-center justify-between ${
        isLight ? 'bg-[#ececec] border-[#e0e0e0]' : 'bg-[#222222] border-[#2c2c2c]'
      }`}>
        <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center space-x-1.5">
          <Activity className="w-3.5 h-3.5" />
          <span>Mini Monitor</span>
        </span>
        <div className="flex items-center space-x-1">
          {/* Swap Panels Button (when both are shown) */}
          {showSftpSidebar && (
            <button
              onClick={handleSwapPanels}
              className="p-1 rounded hover:bg-white/10 text-amber-400 hover:text-amber-300"
              title={t('terminal.swapPanels')}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Position Switch */}
          <button
            onClick={toggleMonitorPosition}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            title={monitorPosition === 'left' ? 'Dock to Right' : 'Dock to Left'}
          >
            {monitorPosition === 'left' ? <PanelRight className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => {
              setShowMonitorSidebar(false);
              setTimeout(() => fitAddonRef.current?.fit(), 100);
            }}
            className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
            title="Close Mini-Monitor"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mini-Monitor Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 text-xs">
        {!metrics ? (
          <div className="p-4 text-center text-slate-500 flex flex-col items-center space-y-2">
            <Activity className="w-5 h-5 animate-pulse text-purple-400" />
            <span className="text-[11px]">{t('monitor.gathering')}</span>
          </div>
        ) : (
          <>
            {/* CPU Gauge Card */}
            <div className={`p-2 rounded-lg border ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#222222] border-[#2f2f2f]'
            }`}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-400 flex items-center space-x-1">
                  <Cpu className="w-3 h-3 text-sky-400" />
                  <span>CPU Usage</span>
                </span>
                <span className="font-mono font-bold text-sky-400">
                  {metrics.cpuUsage.toFixed(1)}%
                </span>
              </div>
              {/* Progress bar */}
              <div className="w-full h-1.5 bg-slate-700/30 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    metrics.cpuUsage > 85
                      ? 'bg-rose-500'
                      : metrics.cpuUsage > 60
                      ? 'bg-amber-500'
                      : 'bg-sky-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, metrics.cpuUsage))}%` }}
                />
              </div>
              <div className="mt-1 text-[10px] text-slate-500 font-mono">
                Load: {metrics.loadAvg.join(' ')}
              </div>
            </div>

            {/* RAM Memory Card */}
            <div className={`p-2 rounded-lg border ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#222222] border-[#2f2f2f]'
            }`}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className="text-slate-400 flex items-center space-x-1">
                  <Layers className="w-3 h-3 text-emerald-400" />
                  <span>RAM Memory</span>
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {metrics.memoryPercent}%
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-700/30 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    metrics.memoryPercent > 85
                      ? 'bg-rose-500'
                      : metrics.memoryPercent > 65
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, metrics.memoryPercent))}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-slate-500 font-mono">
                <span>{(metrics.memoryUsed / 1024).toFixed(1)} GB used</span>
                <span>{(metrics.memoryTotal / 1024).toFixed(1)} GB total</span>
              </div>
            </div>

            {/* Disks */}
            {metrics.disks && metrics.disks.length > 0 && (
              <div className={`p-2 rounded-lg border ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#222222] border-[#2f2f2f]'
              }`}>
                <div className="text-[11px] text-slate-400 flex items-center space-x-1 mb-1.5">
                  <HardDrive className="w-3 h-3 text-amber-400" />
                  <span>Disks</span>
                </div>
                <div className="space-y-1.5">
                  {metrics.disks.slice(0, 3).map((d, i) => (
                    <div key={i} className="text-[10px]">
                      <div className="flex justify-between text-slate-400 font-mono">
                        <span className="truncate max-w-[120px]">{d.mount}</span>
                        <span className="font-semibold">{d.percent}%</span>
                      </div>
                      <div className="w-full h-1 bg-slate-700/30 rounded-full overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${Math.min(100, d.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Running Processes */}
            <div className={`p-2 rounded-lg border flex-1 ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#222222] border-[#2f2f2f]'
            }`}>
              <div className="text-[11px] text-slate-400 flex items-center justify-between mb-1.5">
                <span className="font-semibold">Top Processes</span>
                <span className="text-[9px] text-slate-500">CPU / MEM</span>
              </div>
              <div className="divide-y divide-slate-700/20 font-mono text-[10px]">
                {processes.slice(0, 5).map((proc) => (
                  <div key={proc.pid} className="py-1 flex items-center justify-between group">
                    <div className="truncate flex-1 mr-1">
                      <div className="font-medium text-slate-300 truncate" title={proc.command}>
                        {proc.command.split(' ')[0]}
                      </div>
                      <div className="text-slate-500 text-[9px]">PID: {proc.pid} ({proc.user})</div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sky-400 font-semibold">{proc.cpu.toFixed(0)}%</span>
                      <span className="text-slate-400">{proc.mem.toFixed(0)}%</span>
                      <button
                        onClick={() => handleKillProcess(proc.pid)}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-rose-500/20 text-rose-400 rounded"
                        title="SIGTERM process"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden relative ${
      isLight ? 'bg-[#fafafa] text-slate-800' : 'bg-[#181818] text-slate-100'
    }`}>
      {/* Terminal Mini Toolbar */}
      <div className={`h-8 border-b flex items-center justify-between px-3 text-xs select-none ${
        isLight ? 'bg-[#f0f0f0] border-[#e0e0e0]' : 'bg-[#202020] border-[#2d2d2d]'
      }`}>
        <div className="flex items-center space-x-2 font-mono text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className={`font-semibold truncate max-w-[200px] ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
            {host ? `${host.username}@${host.host}` : 'SSH Session'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 text-[10px]">xterm-256color</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-1">
          {/* Clipboard Paste Toolbar Button */}
          <button
            onClick={handlePasteFromClipboard}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 text-[11px] font-medium transition-colors"
            title={`${t('terminal.paste')} (Ctrl+V)`}
          >
            <Clipboard className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('terminal.paste')}</span>
          </button>

          {/* Duplicate Session Magic Lightning Button (SmarTTY) */}
          <button
            onClick={onDuplicateSession}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500/25 text-[11px] font-semibold transition-all shadow-sm"
            title="Duplicate Tab: Open a new parallel terminal to this server"
          >
            <Zap className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="hidden sm:inline">Duplicate</span>
          </button>

          {/* SmarTTY SFTP Sidebar Toggle Button */}
          <button
            onClick={() => {
              setShowSftpSidebar(!showSftpSidebar);
              setTimeout(() => fitAddonRef.current?.fit(), 100);
            }}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              showSftpSidebar
                ? isLight ? 'bg-sky-100 text-sky-800 border border-sky-300' : 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                : isLight ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:bg-white/10'
            }`}
            title={t('terminal.toggleSidebar')}
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('terminal.sftpFiles')}</span>
          </button>

          {/* Mini-Monitor Sidebar Toggle Button */}
          <button
            onClick={handleToggleMonitorSidebar}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              showMonitorSidebar
                ? isLight ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : isLight ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:bg-white/10'
            }`}
            title={t('terminal.toggleMiniMonitor')}
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('terminal.miniMonitor')}</span>
          </button>

          {/* Swap Panels button if both sidebars are active */}
          {showSftpSidebar && showMonitorSidebar && (
            <button
              onClick={handleSwapPanels}
              className="p-1 rounded text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
              title={t('terminal.swapPanels')}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title="Search in terminal (Ctrl+F)"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleClear}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title={t('terminal.clear')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-slate-500/20 mx-1" />
          <button
            onClick={onOpenMonitor}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 text-[11px] font-medium transition-colors"
            title="Open Server Resource Monitor"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t('terminal.monitor')}</span>
          </button>
        </div>
      </div>

      {/* Floating Search Bar */}
      {showSearch && (
        <div className={`absolute top-9 right-4 border rounded-lg p-1.5 shadow-2xl flex items-center space-x-2 z-20 ${
          isLight ? 'bg-white border-slate-300' : 'bg-[#252525] border-[#3d3d3d]'
        }`}>
          <Search className="w-3.5 h-3.5 text-slate-400 ml-1" />
          <input
            type="text"
            placeholder={t('terminal.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              searchAddonRef.current?.findNext(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSearchNext();
              if (e.key === 'Escape') setShowSearch(false);
            }}
            autoFocus
            className={`border rounded px-2 py-0.5 text-xs focus:outline-none focus:border-sky-500 w-44 ${
              isLight ? 'bg-slate-50 text-slate-900 border-slate-300' : 'bg-[#181818] text-white border-[#444]'
            }`}
          />
          <button
            onClick={handleSearchNext}
            className="text-[11px] px-2 py-0.5 bg-sky-600 rounded text-white hover:bg-sky-500 font-medium"
          >
            {t('terminal.next')}
          </button>
          <button
            onClick={() => setShowSearch(false)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          className={`fixed z-50 border rounded-lg shadow-2xl py-1 text-xs select-none min-w-[170px] ${
            isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#252525] border-[#3d3d3d] text-slate-200'
          }`}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              handlePasteFromClipboard();
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center justify-between"
          >
            <span>{t('terminal.contextPaste')}</span>
            <span className="text-[10px] text-slate-500">Ctrl+V</span>
          </button>
          <button
            onClick={() => {
              if (xtermInstance.current?.hasSelection()) {
                const sel = xtermInstance.current.getSelection();
                if (window.api?.clipboard) {
                  window.api.clipboard.writeText(sel);
                } else {
                  navigator.clipboard.writeText(sel);
                }
              }
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center justify-between"
          >
            <span>{t('terminal.contextCopy')}</span>
            <span className="text-[10px] text-slate-500">Ctrl+C</span>
          </button>
          <div className="h-px bg-slate-500/20 my-1" />
          <button
            onClick={() => {
              xtermInstance.current?.selectAll();
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400"
          >
            {t('terminal.contextSelectAll')}
          </button>
          <button
            onClick={() => {
              handleClear();
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400"
          >
            {t('terminal.contextClear')}
          </button>
        </div>
      )}

      {/* Main Split Layout: Left Panel + Center Terminal + Right Panel */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side Slot */}
        {showSftpSidebar && sftpPosition === 'left' && renderSftpSidebar()}
        {showMonitorSidebar && monitorPosition === 'left' && renderMiniMonitorSidebar()}

        {/* Center Terminal Canvas */}
        <div
          ref={terminalRef}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu({ x: e.clientX, y: e.clientY });
          }}
          className="flex-1 h-full p-1 overflow-hidden"
        />

        {/* Right Side Slot */}
        {showSftpSidebar && sftpPosition === 'right' && renderSftpSidebar()}
        {showMonitorSidebar && monitorPosition === 'right' && renderMiniMonitorSidebar()}
      </div>
    </div>
  );
};
