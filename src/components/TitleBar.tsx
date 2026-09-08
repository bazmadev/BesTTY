import React, { useEffect, useState, useRef } from 'react';
import { TabItem, SplitLayoutMode } from '../types';
import { useTranslation, SupportedLocale } from '../i18n';
import { 
  Terminal, FolderTree, Code, Activity, Network, Settings, X, 
  Plus, Minus, Square, Copy, Zap, HelpCircle, Sparkles, Sun, Moon, Globe, ChevronDown,
  Columns2, Columns3, HardDrive, Heart
} from 'lucide-react';
import appLogo from '../assets/logo.png';

interface TitleBarProps {
  tabs: TabItem[];
  activeTabId: string;
  isLight?: boolean;
  canDuplicate?: boolean;
  updateAvailable?: boolean;
  splitMode?: SplitLayoutMode;
  onSetSplitMode?: (mode: SplitLayoutMode) => void;
  onToggleTheme?: () => void;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewTab: () => void;
  onDuplicateTab?: () => void;
  onOpenHelp?: () => void;
  onOpenSettings?: () => void;
  onOpenAbout?: (tab?: 'mission' | 'updates' | 'donate') => void;
}

export const TitleBar: React.FC<TitleBarProps> = React.memo(({
  tabs,
  activeTabId,
  isLight = false,
  canDuplicate = false,
  updateAvailable = false,
  splitMode = 'single',
  onSetSplitMode,
  onToggleTheme,
  onSelectTab,
  onCloseTab,
  onNewTab,
  onDuplicateTab,
  onOpenHelp,
  onOpenSettings,
  onOpenAbout,
}) => {
  const { t, locale, setLocale } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setIsLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    window.api?.window.isMaximized().then(setIsMaximized);
  }, []);

  const handleMinimize = () => window.api?.window.minimize();
  const handleMaximize = () => {
    window.api?.window.maximize();
    setIsMaximized(!isMaximized);
  };
  const handleClose = () => window.api?.window.close();

  const getPaneMiniIcon = (viewType: string) => {
    switch (viewType) {
      case 'terminal':
        return <Terminal className="w-2.5 h-2.5 text-sky-400" />;
      case 'sftp':
        return <FolderTree className="w-2.5 h-2.5 text-amber-400" />;
      case 'editor':
        return <Code className="w-2.5 h-2.5 text-blue-400" />;
      case 'monitor':
        return <Activity className="w-2.5 h-2.5 text-purple-400" />;
      case 'local':
        return <HardDrive className="w-2.5 h-2.5 text-emerald-400" />;
      default:
        return <Terminal className="w-2.5 h-2.5 text-slate-400" />;
    }
  };

  const getTabIcon = (tab: TabItem) => {
    if (tab.splitMode === 'split-2' || tab.splitMode === 'split-3') {
      const panes = tab.panes || (tab.splitMode === 'split-3' ? [
        { id: 'p0', viewType: (tab.originalType || tab.type) as any },
        { id: 'p1', viewType: 'sftp' as any },
        { id: 'p2', viewType: 'local' as any },
      ] : [
        { id: 'p0', viewType: (tab.originalType || tab.type) as any },
        { id: 'p1', viewType: 'local' as any },
      ]);

      const tooltipText = panes.map((p) => p.viewType.toUpperCase()).join(' + ');

      return (
        <div
          className="flex items-center -space-x-1.5 flex-shrink-0"
          title={`Split: ${tooltipText}`}
        >
          {panes.map((p, idx) => (
            <div
              key={idx}
              className={`w-4 h-4 rounded-md flex items-center justify-center border shadow-sm transition-transform hover:scale-110 ${
                isLight
                  ? 'bg-white border-slate-300 shadow-slate-200'
                  : 'bg-[#222] border-[#444] shadow-black/40'
              }`}
              style={{ zIndex: idx + 1 }}
            >
              {getPaneMiniIcon(p.viewType)}
            </div>
          ))}
        </div>
      );
    }
    switch (tab.type) {
      case 'terminal':
        return <Terminal className="w-3.5 h-3.5 text-sky-500 flex-shrink-0" />;
      case 'sftp':
        return <FolderTree className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />;
      case 'editor':
        return <Code className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />;
      case 'monitor':
        return <Activity className="w-3.5 h-3.5 text-purple-500 flex-shrink-0" />;
      case 'local':
        return <HardDrive className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />;
      case 'tunnels':
        return <Network className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />;
      case 'settings':
        return <Settings className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />;
      default:
        return <Terminal className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />;
    }
  };

  return (
    <div className={`h-10 border-b flex items-center justify-between select-none titlebar-drag-region px-2 z-50 transition-colors ${
      isLight ? 'bg-[#f8f8f8] border-[#e2e2e2] text-slate-800' : 'bg-[#1f1f1f] border-[#2d2d2d] text-slate-200'
    }`}>
      {/* Brand & Tabs Region */}
      <div className="flex items-center space-x-2 flex-1 overflow-x-auto no-scrollbar pr-4 titlebar-drag-region">
        <div
          onClick={() => onOpenAbout?.('mission')}
          className="flex items-center space-x-2 px-2 py-1 titlebar-no-drag cursor-pointer hover:opacity-80 transition-opacity group"
          title={t('about.title')}
        >
          <img
            src={appLogo}
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
                className={`group flex items-center space-x-2 px-3 py-1.5 rounded-t-lg text-xs cursor-pointer border-t-2 transition-colors max-w-[250px] min-w-[120px] titlebar-no-drag ${
                  isActive
                    ? isLight
                      ? 'bg-white border-sky-600 text-slate-900 font-medium shadow-sm'
                      : 'bg-[#282828] border-sky-500 text-white font-medium shadow-inner'
                    : isLight
                      ? 'bg-slate-200/60 border-transparent text-slate-600 hover:bg-white hover:text-slate-900'
                      : 'bg-[#181818]/60 border-transparent text-slate-400 hover:bg-[#232323] hover:text-slate-200'
                }`}
              >
                {getTabIcon(tab)}
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
              title={t('titlebar.duplicateTab')}
            >
              <Zap className="w-4 h-4 fill-amber-500 text-amber-500" />
            </button>
          )}
        </div>
      </div>

      {/* Windows 11 Titlebar Controls */}
      <div className="flex items-center space-x-0 titlebar-no-drag">
        {updateAvailable && (onOpenAbout || onOpenSettings) && (
          <button
            onClick={() => (onOpenAbout ? onOpenAbout('updates') : onOpenSettings?.())}
            className="px-2.5 h-6 my-auto mr-2 flex items-center gap-1.5 rounded-full text-[11px] font-medium bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white shadow-md animate-pulse hover:animate-none transition-all cursor-pointer"
            title={t('updater.updateBadge')}
          >
            <Sparkles className="w-3 h-3 text-amber-200" />
            <span className="hidden sm:inline">{t('updater.updateBadge')}</span>
          </button>
        )}
        {/* Split Screen Mode Switcher */}
        {onSetSplitMode && (
          <div className="flex items-center p-0.5 rounded-lg bg-black/10 dark:bg-white/5 border border-black/5 dark:border-white/10 mr-2">
            <button
              onClick={() => onSetSplitMode('single')}
              className={`px-1.5 py-1 rounded flex items-center justify-center transition-all ${
                splitMode === 'single'
                  ? isLight ? 'bg-white text-sky-600 shadow-sm' : 'bg-[#333] text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t('split.single')}
            >
              <Square className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSetSplitMode('split-2')}
              className={`px-1.5 py-1 rounded flex items-center justify-center transition-all ${
                splitMode === 'split-2'
                  ? isLight ? 'bg-white text-sky-600 shadow-sm' : 'bg-[#333] text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t('split.split2')}
            >
              <Columns2 className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => onSetSplitMode('split-3')}
              className={`px-1.5 py-1 rounded flex items-center justify-center transition-all ${
                splitMode === 'split-3'
                  ? isLight ? 'bg-white text-sky-600 shadow-sm' : 'bg-[#333] text-sky-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title={t('split.split3')}
            >
              <Columns3 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Language Selector Dropdown */}
        <div className="relative" ref={langMenuRef}>
          <button
            onClick={() => setIsLangMenuOpen(!isLangMenuOpen)}
            className={`h-7 px-2 my-auto flex items-center space-x-1 rounded-md text-[11px] font-medium transition-colors ${
              isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title={t('titlebar.language')}
          >
            <Globe className="w-3.5 h-3.5" />
            <span className="font-mono uppercase text-[10px]">{locale}</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </button>

          {isLangMenuOpen && (
            <div className={`absolute right-0 top-full mt-1 w-32 rounded-lg border shadow-xl py-1 z-50 text-xs ${
              isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#222] border-[#333] text-white shadow-2xl'
            }`}>
              {[
                { code: 'ru' as SupportedLocale, label: 'Русский', flag: '🇷🇺' },
                { code: 'en' as SupportedLocale, label: 'English', flag: '🇬🇧' },
                { code: 'hy' as SupportedLocale, label: 'Հայերեն', flag: '🇦🇲' },
              ].map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLocale(lang.code);
                    setIsLangMenuOpen(false);
                  }}
                  className={`w-full px-3 py-1.5 flex items-center space-x-2 text-left hover:bg-sky-500/10 transition-colors ${
                    locale === lang.code ? 'text-sky-500 font-semibold bg-sky-500/5' : ''
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        {onToggleTheme && (
          <button
            onClick={onToggleTheme}
            className={`w-9 h-10 flex items-center justify-center transition-colors ${
              isLight ? 'text-slate-500 hover:text-amber-500 hover:bg-slate-200' : 'text-slate-400 hover:text-amber-400 hover:bg-white/10'
            }`}
            title={t('titlebar.themeToggle')}
          >
            {isLight ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        )}

        {onOpenAbout && (
          <button
            onClick={() => onOpenAbout('donate')}
            className={`w-9 h-10 flex items-center justify-center transition-colors ${
              isLight ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50' : 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
            }`}
            title={t('about.tabDonate')}
          >
            <Heart className="w-4 h-4 fill-rose-500/20" />
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
});
