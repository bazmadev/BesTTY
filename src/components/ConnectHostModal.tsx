import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, FolderTree, Activity, Server, Zap, Search, Plus, X, ArrowRight 
} from 'lucide-react';
import { HostProfile } from '../types';
import { useTranslation } from '../i18n';

interface ConnectHostModalProps {
  isOpen: boolean;
  viewType: 'terminal' | 'sftp' | 'monitor';
  hosts: HostProfile[];
  isLight?: boolean;
  onClose: () => void;
  onConnectHost: (host: HostProfile, targetType: 'terminal' | 'sftp' | 'monitor') => void;
  onQuickConnect: (command: string, targetType: 'terminal' | 'sftp' | 'monitor') => void;
  onNewHost: () => void;
}

export const ConnectHostModal: React.FC<ConnectHostModalProps> = ({
  isOpen,
  viewType,
  hosts,
  isLight = false,
  onClose,
  onConnectHost,
  onQuickConnect,
  onNewHost,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setQuickInput('');
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getHeaderDetails = () => {
    switch (viewType) {
      case 'terminal':
        return {
          icon: <Terminal className="w-5 h-5 text-sky-400" />,
          title: t('sidebar.newTerminal'),
          accentBg: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
          btnBg: 'bg-sky-600 hover:bg-sky-500 text-white',
        };
      case 'sftp':
        return {
          icon: <FolderTree className="w-5 h-5 text-amber-400" />,
          title: t('sidebar.newSftp'),
          accentBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
          btnBg: 'bg-amber-600 hover:bg-amber-500 text-white',
        };
      case 'monitor':
        return {
          icon: <Activity className="w-5 h-5 text-purple-400" />,
          title: t('sidebar.newMonitor'),
          accentBg: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
          btnBg: 'bg-purple-600 hover:bg-purple-500 text-white',
        };
    }
  };

  const header = getHeaderDetails();

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    onQuickConnect(quickInput.trim(), viewType);
    onClose();
  };

  const filteredHosts = hosts.filter((h) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (h.name && h.name.toLowerCase().includes(q)) ||
      (h.host && h.host.toLowerCase().includes(q)) ||
      (h.username && h.username.toLowerCase().includes(q)) ||
      (h.group && h.group.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div
        className={`w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-colors ${
          isLight
            ? 'bg-white border-slate-200 text-slate-800 shadow-slate-300/50'
            : 'bg-[#202020] border-[#333] text-slate-100 shadow-black/80'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#262626] border-[#333]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl border ${header.accentBg}`}>
              {header.icon}
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight">{header.title}</h2>
              <p className="text-xs text-slate-400 mt-0.5">{t('sidebar.selectHost')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Quick Connect Bar */}
          <form onSubmit={handleQuickSubmit} className="space-y-1.5">
            <div className="text-xs font-semibold text-slate-400 flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>{t('sidebar.quickConnect')}</span>
              </span>
              <span className="text-[11px] font-normal text-slate-500">ssh user@host[:port]</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="ssh ubuntu@89.169.186.231 -p 22"
                  value={quickInput}
                  onChange={(e) => setQuickInput(e.target.value)}
                  className={`w-full text-xs font-mono px-3 py-2 rounded-lg border outline-none transition-all ${
                    isLight
                      ? 'bg-slate-100 border-slate-300 focus:border-sky-500 focus:bg-white text-slate-800'
                      : 'bg-[#181818] border-[#3a3a3a] focus:border-sky-500 text-slate-100'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={!quickInput.trim()}
                className={`px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-40 flex items-center space-x-1.5 ${header.btnBg}`}
              >
                <span>{t('hosts.connect')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          <div className="h-px bg-slate-500/15" />

          {/* Search Saved Hosts */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400">{t('nav.hosts')}</span>
              <span className="text-xs text-slate-500 font-mono">
                {filteredHosts.length} / {hosts.length}
              </span>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={t('sidebar.searchHosts')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full text-xs pl-9 pr-4 py-2 rounded-lg border outline-none transition-all ${
                  isLight
                    ? 'bg-slate-100 border-slate-300 focus:border-sky-500 focus:bg-white text-slate-800'
                    : 'bg-[#181818] border-[#3a3a3a] focus:border-sky-500 text-slate-100'
                }`}
              />
            </div>

            {/* Hosts List */}
            <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar pt-1">
              {filteredHosts.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  {search ? t('hosts.noResults') : t('sidebar.noSavedHosts')}
                </div>
              ) : (
                filteredHosts.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => {
                      onConnectHost(h, viewType);
                      onClose();
                    }}
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-xl border cursor-pointer transition-all ${
                      isLight
                        ? 'bg-white hover:bg-sky-50 border-slate-200 hover:border-sky-300'
                        : 'bg-[#1a1a1a] hover:bg-[#252525] border-[#333] hover:border-sky-500/50'
                    }`}
                  >
                    <div className="flex items-center space-x-3 truncate">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center border font-bold text-xs"
                        style={{
                          backgroundColor: `${h.color || '#0078d4'}15`,
                          borderColor: `${h.color || '#0078d4'}40`,
                          color: h.color || '#0078d4',
                        }}
                      >
                        <Server className="w-4 h-4" />
                      </div>
                      <div className="truncate">
                        <div className="text-xs font-semibold group-hover:text-sky-400 transition-colors truncate">
                          {h.name || h.host}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono truncate">
                          {h.username}@{h.host}:{h.port || 22}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {h.group && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20 font-sans">
                          {h.group}
                        </span>
                      )}
                      <button
                        type="button"
                        className={`px-2.5 py-1 text-xs rounded-lg font-medium opacity-80 group-hover:opacity-100 transition-all ${header.btnBg}`}
                      >
                        {t('hosts.connect')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-between px-6 py-3.5 border-t text-xs ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#242424] border-[#333]'
          }`}
        >
          <button
            onClick={() => {
              onClose();
              onNewHost();
            }}
            className="flex items-center space-x-1.5 text-sky-400 hover:text-sky-300 font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>{t('hosts.newHost')}</span>
          </button>

          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-700/30 transition-colors"
          >
            {t('modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};
