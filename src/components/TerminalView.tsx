import React, { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { SearchAddon } from '@xterm/addon-search';
import '@xterm/xterm/css/xterm.css';
import { HostProfile } from '../types';
import { FolderTree, Activity, Search, X, RotateCcw, Columns, Rows, Trash2, ArrowUpRight } from 'lucide-react';

interface TerminalViewProps {
  sessionId: string;
  host?: HostProfile;
  onOpenSftp: () => void;
  onOpenMonitor: () => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  sessionId,
  host,
  onOpenSftp,
  onOpenMonitor,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const searchAddonRef = useRef<SearchAddon | null>(null);

  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Cascadia Code, Consolas, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      letterSpacing: 0,
      theme: {
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
      },
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

    // Send initial resize
    if (window.api?.ssh) {
      window.api.ssh.resize(sessionId, term.cols, term.rows);
    }

    // Handle user keystrokes
    const onDataDispose = term.onData((data) => {
      window.api?.ssh.write(sessionId, data);
    });

    // Handle incoming data from backend SSH stream
    const unsubscribeData = window.api?.ssh.onData((payload) => {
      if (payload.sessionId === sessionId) {
        term.write(payload.data);
      }
    });

    // Handle session closed
    const unsubscribeClosed = window.api?.ssh.onClosed((payload) => {
      if (payload.sessionId === sessionId) {
        setIsConnected(false);
        term.write('\r\n\x1b[31m[Session closed by remote host]\x1b[0m\r\n');
      }
    });

    // Resize observer
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

    // Keyboard shortcut for search
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
      term.dispose();
    };
  }, [sessionId]);

  const handleSearchNext = () => {
    if (searchAddonRef.current && searchQuery) {
      searchAddonRef.current.findNext(searchQuery);
    }
  };

  const handleClear = () => {
    xtermInstance.current?.clear();
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] overflow-hidden relative">
      {/* Terminal Mini Toolbar */}
      <div className="h-8 bg-[#202020] border-b border-[#2d2d2d] flex items-center justify-between px-3 text-xs select-none">
        <div className="flex items-center space-x-2 font-mono text-[11px]">
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-500'
            }`}
          />
          <span className="text-slate-300 font-semibold truncate max-w-[200px]">
            {host ? `${host.username}@${host.host}` : 'SSH Session'}
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400 text-[10px]">xterm-256color</span>
        </div>

        {/* Action buttons */}
        <div className="flex items-center space-x-1">
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
            title="Clear scrollback"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <div className="h-4 w-px bg-[#333] mx-1" />
          <button
            onClick={onOpenSftp}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 text-[11px] font-medium transition-colors"
            title="Open SFTP file explorer for this server"
          >
            <FolderTree className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SFTP Files</span>
          </button>
          <button
            onClick={onOpenMonitor}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 hover:bg-purple-500/20 text-[11px] font-medium transition-colors"
            title="Open Server Resource Monitor"
          >
            <Activity className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Monitor</span>
          </button>
        </div>
      </div>

      {/* Floating Search Bar */}
      {showSearch && (
        <div className="absolute top-9 right-4 bg-[#252525] border border-[#3d3d3d] rounded-lg p-1.5 shadow-2xl flex items-center space-x-2 z-20">
          <Search className="w-3.5 h-3.5 text-slate-400 ml-1" />
          <input
            type="text"
            placeholder="Find in terminal..."
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
            className="bg-[#181818] border border-[#444] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-sky-500 w-44"
          />
          <button
            onClick={handleSearchNext}
            className="text-[11px] px-2 py-0.5 bg-[#333] hover:bg-sky-600 rounded text-slate-200 hover:text-white"
          >
            Next
          </button>
          <button
            onClick={() => setShowSearch(false)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* xterm canvas container */}
      <div ref={terminalRef} className="flex-1 w-full h-full p-1" />
    </div>
  );
};
