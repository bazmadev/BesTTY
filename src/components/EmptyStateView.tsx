import React, { useState } from 'react';
import {
  Terminal,
  FolderGit2,
  Activity,
  Plus,
  Zap,
  Server,
  ArrowRight,
  Shield,
  Key,
} from 'lucide-react';
import { HostProfile, TabType } from '../types';
import { useTranslation } from '../i18n';

interface EmptyStateViewProps {
  viewType: 'terminal' | 'sftp' | 'monitor';
  hosts: HostProfile[];
  isLight: boolean;
  onConnectHost: (host: HostProfile, initialTab: TabType) => void;
  onQuickConnect: (rawCommand: string, initialTab: TabType) => void;
  onNewHost: () => void;
}

export const EmptyStateView: React.FC<EmptyStateViewProps> = ({
  viewType,
  hosts,
  isLight,
  onConnectHost,
  onQuickConnect,
  onNewHost,
}) => {
  const { t } = useTranslation();
  const [quickInput, setQuickInput] = useState('');

  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickInput.trim()) {
      onQuickConnect(quickInput.trim(), viewType);
    }
  };

  const getHeaderInfo = () => {
    switch (viewType) {
      case 'terminal':
        return {
          icon: <Terminal className="w-10 h-10 text-cyan-400" />,
          title: t('emptyState.terminalTitle'),
          desc: t('emptyState.terminalDesc'),
          accentColor: 'border-cyan-500/30 text-cyan-400',
        };
      case 'sftp':
        return {
          icon: <FolderGit2 className="w-10 h-10 text-blue-400" />,
          title: t('emptyState.sftpTitle'),
          desc: t('emptyState.sftpDesc'),
          accentColor: 'border-blue-500/30 text-blue-400',
        };
      case 'monitor':
        return {
          icon: <Activity className="w-10 h-10 text-emerald-400" />,
          title: t('emptyState.monitorTitle'),
          desc: t('emptyState.monitorDesc'),
          accentColor: 'border-emerald-500/30 text-emerald-400',
        };
    }
  };

  const header = getHeaderInfo();

  return (
    <div
      className={`w-full h-full flex flex-col items-center justify-start overflow-y-auto p-8 transition-colors ${
        isLight ? 'bg-[#f3f3f3] text-gray-800' : 'bg-[#181818] text-gray-200'
      }`}
    >
      <div className="max-w-4xl w-full flex flex-col items-center">
        {/* View Icon & Heading */}
        <div
          className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-4 shadow-xl border ${
            isLight
              ? 'bg-white border-gray-200 shadow-gray-200/60'
              : 'bg-[#212121] border-white/5 shadow-black/40'
          }`}
        >
          {header.icon}
        </div>

        <h2
          className={`text-2xl font-semibold mb-2 text-center ${
            isLight ? 'text-gray-900' : 'text-white'
          }`}
        >
          {header.title}
        </h2>
        <p
          className={`text-sm text-center max-w-xl mb-6 leading-relaxed ${
            isLight ? 'text-gray-600' : 'text-gray-400'
          }`}
        >
          {header.desc}
        </p>

        {/* Quick Connect Bar */}
        <div
          className={`w-full max-w-2xl p-4 rounded-xl border mb-8 backdrop-blur-md shadow-lg ${
            isLight
              ? 'bg-white border-gray-200 shadow-gray-200/50'
              : 'bg-[#202020]/90 border-white/10 shadow-black/40'
          }`}
        >
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-500">
            <Zap className="w-3.5 h-3.5" />
            {t('emptyState.quickConnect')}
          </div>
          <form onSubmit={handleQuickSubmit} className="flex gap-2">
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              placeholder={t('emptyState.quickConnectPlaceholder')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm border outline-none font-mono transition-all ${
                isLight
                  ? 'bg-gray-50 border-gray-300 text-gray-900 focus:border-cyan-500 focus:bg-white'
                  : 'bg-[#181818] border-white/10 text-gray-100 focus:border-cyan-500 focus:bg-[#121212]'
              }`}
            />
            <button
              type="submit"
              disabled={!quickInput.trim()}
              className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg flex items-center gap-2 shadow-md hover:shadow-cyan-500/20 transition-all"
            >
              <span>{t('emptyState.connectButton')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Saved Hosts Section */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-4">
            <h3
              className={`text-sm font-semibold uppercase tracking-wider ${
                isLight ? 'text-gray-700' : 'text-gray-400'
              }`}
            >
              {hosts.length > 0
                ? t('emptyState.selectHost')
                : t('emptyState.noSavedHosts')}
            </h3>
            <button
              onClick={onNewHost}
              className={`text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
                isLight
                  ? 'bg-gray-200/80 hover:bg-gray-300 text-gray-800'
                  : 'bg-white/10 hover:bg-white/15 text-gray-200'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('emptyState.createHost')}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hosts.map((host) => {
              const tagColor = host.color || '#0078d4';
              return (
                <div
                  key={host.id}
                  onClick={() => onConnectHost(host, viewType)}
                  className={`group relative p-4 rounded-xl border cursor-pointer transition-all duration-200 hover:-translate-y-0.5 shadow-md flex flex-col justify-between ${
                    isLight
                      ? 'bg-white border-gray-200 hover:border-cyan-500 hover:shadow-lg shadow-gray-200/40'
                      : 'bg-[#202020] border-white/5 hover:border-cyan-500/50 hover:bg-[#252525] shadow-black/30'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-white font-semibold text-xs shadow-sm"
                        style={{ backgroundColor: tagColor }}
                      >
                        <Server className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div
                          className={`font-semibold text-sm truncate ${
                            isLight ? 'text-gray-900' : 'text-gray-100'
                          }`}
                        >
                          {host.name || `${host.username}@${host.host}`}
                        </div>
                        <div
                          className={`text-xs font-mono truncate ${
                            isLight ? 'text-gray-500' : 'text-gray-400'
                          }`}
                        >
                          {host.username}@{host.host}:{host.port || 22}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                    <div className="flex items-center gap-2 text-xs">
                      {host.authType === 'password' && (
                        <span
                          className={`flex items-center gap-1 text-[11px] ${
                            isLight ? 'text-gray-500' : 'text-gray-400'
                          }`}
                        >
                          <Shield className="w-3 h-3 text-cyan-500" />
                          Password
                        </span>
                      )}
                      {host.authType === 'privateKey' && (
                        <span
                          className={`flex items-center gap-1 text-[11px] ${
                            isLight ? 'text-gray-500' : 'text-gray-400'
                          }`}
                        >
                          <Key className="w-3 h-3 text-amber-500" />
                          Key
                        </span>
                      )}
                      {host.authType === 'agent' && (
                        <span
                          className={`flex items-center gap-1 text-[11px] ${
                            isLight ? 'text-gray-500' : 'text-gray-400'
                          }`}
                        >
                          <Zap className="w-3 h-3 text-emerald-500" />
                          Agent
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-cyan-500 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      {t('emptyState.launchSession')}
                      <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}

            {/* Dashed Add New Host Card */}
            <div
              onClick={onNewHost}
              className={`p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center min-h-[110px] cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${
                isLight
                  ? 'border-gray-300 hover:border-cyan-500 hover:bg-cyan-50/40 text-gray-500 hover:text-cyan-600'
                  : 'border-white/10 hover:border-cyan-500/60 hover:bg-cyan-500/5 text-gray-400 hover:text-cyan-400'
              }`}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-cyan-500/10 text-cyan-500 mb-1.5">
                <Plus className="w-4 h-4" />
              </div>
              <span className="text-xs font-medium">
                {t('emptyState.createHost')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
