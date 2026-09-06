import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { HostProfile, SFTPFile } from '../types';
import { useTranslation } from '../i18n';
import { 
  FolderTree, Activity, Search, X, RotateCcw, Trash2, 
  Folder, File, FileCode, FileArchive, FileText, CornerLeftUp, 
  RotateCw, ChevronRight, ChevronLeft, Edit, Plus
} from 'lucide-react';

interface TerminalViewProps {
  sessionId: string;
  host?: HostProfile;
  isLight?: boolean;
  onOpenSftp: () => void;
  onOpenMonitor: () => void;
  onOpenFileInEditor: (filePath: string, fileName: string) => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  sessionId,
  host,
  isLight = false,
  onOpenSftp,
  onOpenMonitor,
  onOpenFileInEditor,
}) => {
  const { t } = useTranslation();
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(true);

  // SmarTTY Killer Feature: Collapsible SFTP Sidebar inside the Terminal Tab!
  const [showSftpSidebar, setShowSftpSidebar] = useState(true);
  const [sftpPath, setSftpPath] = useState(host?.defaultPath || '/');
  const [sftpFiles, setSftpFiles] = useState<SFTPFile[]>([]);
  const [isSftpLoading, setIsSftpLoading] = useState(false);
  const [sftpFilter, setSftpFilter] = useState('');

  // Load directory in sidebar
  const loadSidebarDirectory = async (pathToGo: string) => {
    setIsSftpLoading(true);
    try {
      const res = await window.api?.sftp.list(sessionId, pathToGo);
      if (res) {
        setSftpPath(res.currentPath);
        setSftpFiles(res.files);
      }
    } catch (e) {
      // Ignore if not ready yet
    } finally {
      setIsSftpLoading(false);
    }
  };

  useEffect(() => {
    if (showSftpSidebar) {
      loadSidebarDirectory(sftpPath);
    }
  }, [showSftpSidebar, sessionId]);

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
    fitAddon.fit();

    xtermInstance.current = term;
    fitAddonRef.current = fitAddon;
    searchAddonRef.current = searchAddon;

    if (window.api?.ssh) {
      window.api.ssh.resize(sessionId, term.cols, term.rows);
    }

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

    // SmarTTY Killer Feature: OSC 7 auto-navigates sidebar when user does `cd` in terminal!
    const unsubscribeDir = window.api?.ssh.onDirectoryChanged((payload) => {
      if (payload.sessionId === sessionId && payload.directory) {
        setSftpPath(payload.directory);
        loadSidebarDirectory(payload.directory);
      }
    });

    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
        if (window.api?.ssh && term.cols > 0 && term.rows > 0) {
          window.api.ssh.resize(sessionId, term.cols, term.rows);
        }
      } catch (e) {
        // ignore
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
      unsubscribeDir?.();
      term.dispose();
    };
  }, [sessionId, isLight]);

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
          {/* SmarTTY Sidebar Toggle Button */}
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

      {/* Main Container: Terminal + SmarTTY Collapsible SFTP Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Terminal Canvas */}
        <div ref={terminalRef} className="flex-1 h-full p-1 overflow-hidden" />

        {/* SmarTTY Integrated SFTP Sidebar */}
        {showSftpSidebar && (
          <div className={`w-72 border-l flex flex-col h-full select-none shadow-lg z-10 transition-all ${
            isLight ? 'bg-[#f4f4f4] border-[#e0e0e0]' : 'bg-[#1c1c1c] border-[#2c2c2c]'
          }`}>
            {/* Sidebar Header & Path Navigation */}
            <div className={`p-2 border-b flex flex-col space-y-1.5 ${
              isLight ? 'bg-[#ececec] border-[#e0e0e0]' : 'bg-[#222222] border-[#2c2c2c]'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1">
                  <FolderTree className="w-3.5 h-3.5" />
                  <span>Remote Explorer</span>
                </span>
                <div className="flex items-center space-x-1">
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
                    onClick={() => setShowSftpSidebar(false)}
                    className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
                    title="Collapse Sidebar"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Path Breadcrumb Display */}
              <div className={`px-2 py-0.5 rounded text-[10px] font-mono truncate border ${
                isLight ? 'bg-white text-slate-700 border-slate-300' : 'bg-[#161616] text-slate-300 border-[#333]'
              }`} title={sftpPath}>
                {sftpPath}
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
                    <div className="flex items-center space-x-1.5 truncate flex-1 mr-2">
                      {getFileIcon(file)}
                      <span className="truncate text-[11px] font-sans group-hover:font-medium">
                        {file.name}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1 text-[10px] text-slate-400 flex-shrink-0">
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
        )}
      </div>
    </div>
  );
};
