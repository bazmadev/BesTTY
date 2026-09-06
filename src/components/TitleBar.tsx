import React, { useEffect, useState } from 'react';
import { TabItem } from '../types';
import { Terminal, FolderTree, Code, Activity, Network, Settings, X, Plus, Minus, Square, Copy } from 'lucide-react';

interface TitleBarProps {
  tabs: TabItem[];
  activeTabId: string;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onNewTab,
}) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.api?.window.isMaximized().then(setIsMaximized);
  }, []);

  const handleMinimize = () => window.api?.window.minimize();
  const handleMaximize = () => {
    window.api?.window.maximize();
    setIsMaximized(!isMaximized);
  };
  const handleClose = () => window.api?.window.close();

  const getTabIcon = (type: TabItem['type']) => {
    switch (type) {
      case 'terminal':
        return <Terminal className="w-3.5 h-3.5 text-sky-400" />;
      case 'sftp':
        return <FolderTree className="w-3.5 h-3.5 text-amber-400" />;
      case 'editor':
        return <Code className="w-3.5 h-3.5 text-emerald-400" />;
      case 'monitor':
        return <Activity className="w-3.5 h-3.5 text-purple-400" />;
      case 'tunnels':
        return <Network className="w-3.5 h-3.5 text-cyan-400" />;
      case 'settings':
        return <Settings className="w-3.5 h-3.5 text-slate-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className="h-10 bg-[#1f1f1f] border-b border-[#2d2d2d] flex items-center justify-between select-none titlebar-drag-region px-2 z-50">
      {/* Brand & Tabs Region */}
      <div className="flex items-center space-x-2 flex-1 overflow-x-auto no-scrollbar titlebar-no-drag pr-4">
        <div className="flex items-center space-x-2 px-2 py-1 titlebar-drag-region">
          <div className="w-5 h-5 rounded-md bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center font-bold text-xs text-white shadow-sm">
            B
          </div>
          <span className="font-semibold text-xs text-slate-200 tracking-wide font-mono hidden sm:inline">
            BesTTY
          </span>
        </div>

        {/* Tab Items */}
        <div className="flex items-center space-x-1 flex-1 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`group flex items-center space-x-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer border-t-2 transition-all max-w-[200px] min-w-[120px] ${
                  isActive
                    ? 'bg-[#282828] border-sky-500 text-white font-medium shadow-inner'
                    : 'bg-[#181818]/60 border-transparent text-slate-400 hover:bg-[#232323] hover:text-slate-200'
                }`}
              >
                {getTabIcon(tab.type)}
                <span className="truncate flex-1 font-mono text-[11px]">
                  {tab.title}
                </span>

                {/* Modified file dot */}
                {tab.isModified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                )}

                {/* Close tab button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-white/10 text-slate-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Close tab"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          {/* New Tab Button */}
          <button
            onClick={onNewTab}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-[#2d2d2d] transition-colors"
            title="New Connection / Tab"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Windows 11 Titlebar Controls */}
      <div className="flex items-center space-x-0 titlebar-no-drag">
        <button
          onClick={handleMinimize}
          className="w-11 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-11 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          title="Maximize"
        >
          {isMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-3 h-3" />}
        </button>
        <button
          onClick={handleClose}
          className="w-11 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
