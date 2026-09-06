import React, { useEffect, useState } from 'react';
import { TabItem } from '../types';
import { useTranslation } from '../i18n';
import { Terminal, FolderTree, Code, Activity, Network, Settings, X, Plus, Minus, Square, Copy, Zap, HelpCircle, Sparkles } from 'lucide-react';

interface TitleBarProps {
  tabs: TabItem[];
  activeTabId: string;
  isLight?: boolean;
  canDuplicate?: boolean;
  updateAvailable?: boolean;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onDuplicateTab?: () => void;
  onOpenHelp?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: () => void;
}

export const TitleBar: React.FC<TitleBarProps> = ({
  tabs,
  activeTabId,
  isLight = false,
  canDuplicate = false,
  updateAvailable = false,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onDuplicateTab,
  onOpenHelp,
  onOpenSettings,
  onOpenAbout,
}) => {
  const { t } = useTranslation();
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
        return <Terminal className="w-3.5 h-3.5 text-sky-500" />;
      case 'sftp':
        return <FolderTree className="w-3.5 h-3.5 text-amber-500" />;
      case 'editor':
        return <Code className="w-3.5 h-3.5 text-emerald-500" />;
      case 'monitor':
        return <Activity className="w-3.5 h-3.5 text-purple-500" />;
      case 'tunnels':
        return <Network className="w-3.5 h-3.5 text-cyan-500" />;
      case 'settings':
        return <Settings className="w-3.5 h-3.5 text-slate-400" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-slate-400" />;
    }
  };

  return (
    <div className={`h-10 border-b flex items-center justify-between select-none titlebar-drag-region px-2 z-50 transition-colors ${
      isLight ? 'bg-[#f8f8f8] border-[#e2e2e2] text-slate-800' : 'bg-[#1f1f1f] border-[#2d2d2d] text-slate-200'
    }`}>
      {/* Brand & Tabs Region */}
      <div className="flex items-center space-x-2 flex-1 overflow-x-auto no-scrollbar pr-4 titlebar-drag-region">
        <div
          onClick={onOpenAbout}
          className="flex items-center space-x-2 px-2 py-1 titlebar-no-drag cursor-pointer hover:opacity-80 transition-opacity group"
          title={t('about.title')}
        >
          <img
            src="/logo.png"
            alt="BesTTY"
            className="w-5 h-5 rounded object-contain drop-shadow shadow-sky-500/20 group-hover:scale-105 transition-transform"
          />
          <span className="font-semibold text-xs tracking-wide font-mono hidden sm:inline">
            BesTTY
          </span>
        </div>

        {/* Tab Items */}
        <div className="flex items-center space-x-1 flex-1 overflow-x-auto titlebar-drag-region">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`group flex items-center space-x-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer border-t-2 transition-all max-w-[200px] min-w-[120px] titlebar-no-drag ${
                  isActive
                    ? isLight
                      ? 'bg-white border-sky-600 text-slate-900 font-medium shadow-sm'
                      : 'bg-[#282828] border-sky-500 text-white font-medium shadow-inner'
                    : isLight
                      ? 'bg-slate-200/60 border-transparent text-slate-600 hover:bg-white hover:text-slate-900'
                      : 'bg-[#181818]/60 border-transparent text-slate-400 hover:bg-[#232323] hover:text-slate-200'
                }`}
              >
                {getTabIcon(tab.type)}
                <span className="truncate flex-1 font-mono text-[11px]">
                  {tab.title}
                </span>

                {tab.isModified && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  className="p-0.5 rounded hover:bg-black/10 text-slate-400 hover:text-slate-700 dark:hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  title={t('titlebar.closeTab')}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}

          <button
            onClick={onNewTab}
            className={`p-1.5 rounded-md transition-colors titlebar-no-drag ${
              isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-[#2d2d2d]'
            }`}
            title={t('titlebar.newTab')}
          >
            <Plus className="w-4 h-4" />
          </button>

          {canDuplicate && onDuplicateTab && (
            <button
              onClick={onDuplicateTab}
              className="p-1.5 rounded-md text-amber-500 hover:text-amber-400 hover:bg-amber-500/20 transition-colors titlebar-no-drag"
              title="Duplicate Session: Open a new tab to current host (SmarTTY)"
            >
              <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
            </button>
          )}
        </div>
      </div>

      {/* Windows 11 Titlebar Controls */}
      <div className="flex items-center space-x-0 titlebar-no-drag">
        {updateAvailable && onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="px-2.5 h-6 my-auto mr-2 flex items-center gap-1.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-md animate-pulse hover:animate-none transition-all cursor-pointer"
            title={t('updater.updateBadge')}
          >
            <Sparkles className="w-3 h-3 text-amber-200" />
            <span className="hidden sm:inline">{t('updater.updateBadge')}</span>
          </button>
        )}
        {onOpenHelp && (
          <button
            onClick={onOpenHelp}
            className={`w-9 h-10 flex items-center justify-center transition-colors ${
              isLight ? 'text-slate-500 hover:text-sky-600 hover:bg-slate-200' : 'text-slate-400 hover:text-sky-400 hover:bg-white/10'
            }`}
            title={t('help.title')}
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={handleMinimize}
          className={`w-11 h-10 flex items-center justify-center transition-colors ${
            isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title={t('titlebar.minimize')}
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleMaximize}
          className={`w-11 h-10 flex items-center justify-center transition-colors ${
            isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
          title={t('titlebar.maximize')}
        >
          {isMaximized ? <Copy className="w-3 h-3 rotate-180" /> : <Square className="w-3 h-3" />}
        </button>
        <button
          onClick={handleClose}
          className="w-11 h-10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-red-600 transition-colors"
          title={t('titlebar.close')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
