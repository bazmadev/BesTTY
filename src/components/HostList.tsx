import React, { useState } from 'react';
import { HostProfile } from '../types';
import { useTranslation } from '../i18n';
import { parseSSHConnectionString } from '../utils/sshParser';
import { 
  Server, Terminal, FolderTree, Activity, Plus, Search, 
  Edit2, Trash2, Shield, Key, Lock, ArrowRight, Sparkles, Loader2 
} from 'lucide-react';
import { TabType } from '../types';

interface HostListProps {
  hosts: HostProfile[];
  isLight?: boolean;
  isVaultLocked?: boolean;
  onUnlockVault?: () => void;
  onConnect: (host: HostProfile, initialTab?: 'terminal' | 'sftp' | 'monitor') => void;
  onEdit: (host: HostProfile) => void;
  onDelete: (id: string) => void;
  onNewHost: () => void;
  connectingInfo?: { hostId: string; type: TabType } | null;
}

export const HostList: React.FC<HostListProps> = ({
  hosts,
  isLight = false,
  isVaultLocked = false,
  onUnlockVault,
  onConnect,
  onEdit,
  onDelete,
  onNewHost,
  connectingInfo,
}) => {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [quickConnectInput, setQuickConnectInput] = useState('');

  const handleNewHostClick = () => {
    if (isVaultLocked && onUnlockVault) {
      onUnlockVault();
      return;
    }
    onNewHost();
  };

  const filteredHosts = hosts.filter((h) => {
    const query = search.toLowerCase();
    return (
      h.name.toLowerCase().includes(query) ||
      h.host.toLowerCase().includes(query) ||
      h.username.toLowerCase().includes(query) ||
      (h.group && h.group.toLowerCase().includes(query))
    );
  });

  const groupedHosts = filteredHosts.reduce<Record<string, HostProfile[]>>((acc, host) => {
    const group = host.group || 'Default';
    if (!acc[group]) acc[group] = [];
    acc[group].push(host);
    return acc;
  }, {});

  const handleQuickConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickConnectInput.trim()) return;

    // Smart Auto-splitting via parseSSHConnectionString!
    const parsed = parseSSHConnectionString(quickConnectInput);

    const tempHost: HostProfile = {
      id: `quick-${crypto.randomUUID()}`,
      name: `Quick: ${parsed.username}@${parsed.host}`,
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      authType: parsed.privateKeyPath ? 'privateKey' : 'password',
      privateKeyPath: parsed.privateKeyPath,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onConnect(tempHost, 'terminal');
    setQuickConnectInput('');
  };

  // Live parsed preview hint
  const preview = quickConnectInput.trim() ? parseSSHConnectionString(quickConnectInput) : null;

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden p-6 ${
      isLight ? 'bg-[#f5f5f5] text-slate-800' : 'bg-[#181818] text-slate-100'
    }`}>
      {/* Top Header & Quick Connect */}
      <div className="mb-6 space-y-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight flex items-center space-x-2">
              <Server className="w-6 h-6 text-sky-500" />
              <span>{t('hosts.title')}</span>
            </h1>
            <p className={`text-xs mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('hosts.subtitle')}
            </p>
          </div>

          <button
            onClick={handleNewHostClick}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('hosts.newHost')}</span>
          </button>
        </div>

        {/* Quick Connect & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Quick Connect with Smart Auto-split */}
          <div className="md:col-span-2 flex flex-col space-y-1">
            <form onSubmit={handleQuickConnect} className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder={t('hosts.quickConnectPlaceholder')}
                  value={quickConnectInput}
                  onChange={(e) => setQuickConnectInput(e.target.value)}
                  className={`w-full border rounded-lg px-4 py-2 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isLight ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400' : 'bg-[#222222] border-[#333] text-white placeholder:text-slate-500'
                  }`}
                />
              </div>
              <button
                type="submit"
                disabled={Boolean(connectingInfo)}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center space-x-1.5 shadow transition-all"
              >
                {connectingInfo?.hostId.startsWith('quick-') ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t('hosts.connecting')}</span>
                  </>
                ) : (
                  <>
                    <span>{t('hosts.connect')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </form>

            {/* Smart Decomposition Badge */}
            {preview && preview.host && (
              <div className={`flex items-center space-x-2 text-[11px] font-mono px-2.5 py-1 rounded-md border ${
                isLight ? 'bg-sky-50 border-sky-200 text-sky-700' : 'bg-sky-500/10 border-sky-500/20 text-sky-400'
              }`}>
                <Sparkles className="w-3 h-3 flex-shrink-0" />
                <span>Auto-parsed:</span>
                <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>proto:</span> <span>{preview.protocol}</span>
                <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>user:</span> <span>{preview.username}</span>
                <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>host:</span> <span>{preview.host}</span>
                <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>port:</span> <span>{preview.port}</span>
                {preview.privateKeyPath && (
                  <>
                    <span className={`font-semibold ${isLight ? 'text-slate-800' : 'text-white'}`}>key:</span> <span>{preview.privateKeyPath}</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Search filter */}
          <div className="relative">
            <Search className={`w-4 h-4 absolute left-3 top-2.5 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
            <input
              type="text"
              placeholder={t('hosts.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`w-full border rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:border-sky-500 ${
                isLight ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400' : 'bg-[#222222] border-[#333] text-white placeholder:text-slate-500'
              }`}
            />
          </div>
        </div>
      </div>

      {/* Host Groups & Cards */}
      <div className="flex-1 overflow-y-auto space-y-6 max-w-5xl mx-auto w-full pr-1">
        {isVaultLocked ? (
          <div className={`flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-2xl p-8 text-center ${
            isLight ? 'border-amber-300 bg-amber-50/50' : 'border-amber-500/30 bg-amber-500/5'
          }`}>
            <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
              <Lock className="w-6 h-6 text-amber-500" />
            </div>
            <h3 className="text-sm font-semibold">{t('hosts.vaultLockedTitle')}</h3>
            <p className={`text-xs max-w-md mt-1 mb-4 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('hosts.vaultLockedDesc')}
            </p>
            <button
              onClick={onUnlockVault}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-md transition-all flex items-center space-x-1.5"
            >
              <Lock className="w-4 h-4" />
              <span>{t('hosts.unlockVault')}</span>
            </button>
          </div>
        ) : hosts.length === 0 ? (
          <div className={`flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-2xl p-8 text-center ${
            isLight ? 'border-slate-300 bg-white/50' : 'border-[#2d2d2d]'
          }`}>
            <Server className={`w-12 h-12 mb-3 ${isLight ? 'text-slate-500' : 'text-slate-400'}`} />
            <h3 className="text-sm font-semibold">{t('hosts.emptyTitle')}</h3>
            <p className={`text-xs max-w-md mt-1 mb-4 ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
              {t('hosts.emptyDesc')}
            </p>
            <button
              onClick={handleNewHostClick}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-md transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>{t('hosts.addFirst')}</span>
            </button>
          </div>
        ) : Object.keys(groupedHosts).length === 0 ? (
          <div className={`text-center py-12 text-xs ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
            {t('hosts.noResults')} "{search}"
          </div>
        ) : (
          Object.entries(groupedHosts).map(([groupName, groupHosts]) => (
            <div key={groupName} className="space-y-3">
              <div className={`flex items-center space-x-2 text-xs font-semibold uppercase tracking-wider ${
                isLight ? 'text-slate-600' : 'text-slate-400'
              }`}>
                <span>{groupName}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  isLight ? 'bg-slate-200 text-slate-700 font-medium' : 'bg-[#272727] text-slate-400'
                }`}>
                  {groupHosts.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupHosts.map((host) => {
                  const isConnecting = connectingInfo?.hostId === host.id;

                  return (
                    <div
                      key={host.id}
                      className={`group border rounded-xl p-4 transition-all shadow-sm flex flex-col justify-between ${
                        isLight ? 'bg-white border-slate-200 hover:border-sky-400 hover:shadow-md' : 'bg-[#202020] hover:bg-[#252525] border-[#303030] hover:border-sky-500/40'
                      } ${isConnecting ? 'ring-1 ring-sky-500/50' : ''}`}
                    >
                      <div>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2.5">
                            <div
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{ backgroundColor: host.color || '#0078d4' }}
                            />
                            <h4 className="text-sm font-semibold truncate max-w-[160px]">
                              {host.name}
                            </h4>
                          </div>

                          {/* Auth / Connecting Badge */}
                          {isConnecting ? (
                            <span className="flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded border border-sky-500/40 bg-sky-500/10 text-sky-400 animate-pulse">
                              <Loader2 className="w-3 h-3 animate-spin text-sky-400" />
                              <span>{t('hosts.connecting')}</span>
                            </span>
                          ) : (
                            <span className={`flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded border ${
                              isLight ? 'bg-slate-100 text-slate-700 font-medium border-slate-300' : 'bg-[#181818] text-slate-400 border-[#333]'
                            }`}>
                              {host.authType === 'password' && <Lock className="w-3 h-3 text-amber-500" />}
                              {host.authType === 'privateKey' && <Key className="w-3 h-3 text-emerald-500" />}
                              {host.authType === 'agent' && <Shield className="w-3 h-3 text-sky-500" />}
                              <span className="capitalize">{host.authType}</span>
                            </span>
                          )}
                        </div>

                        <div className={`font-mono text-xs mb-4 truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                          {host.username}@{host.host}:{host.port}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-500/15">
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => onConnect(host, 'terminal')}
                            disabled={Boolean(connectingInfo)}
                            className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
                              isConnecting && connectingInfo?.type === 'terminal'
                                ? 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500'
                                : isLight
                                  ? 'text-slate-600 hover:text-sky-600 hover:bg-sky-50'
                                  : 'hover:bg-sky-500/20 text-slate-400 hover:text-sky-500'
                            }`}
                            title={t('hosts.openTerminal')}
                          >
                            {isConnecting && connectingInfo?.type === 'terminal' ? (
                              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                            ) : (
                              <Terminal className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => onConnect(host, 'sftp')}
                            disabled={Boolean(connectingInfo)}
                            className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
                              isConnecting && connectingInfo?.type === 'sftp'
                                ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500'
                                : isLight
                                  ? 'text-slate-600 hover:text-amber-600 hover:bg-amber-50'
                                  : 'hover:bg-amber-500/20 text-slate-400 hover:text-amber-500'
                            }`}
                            title={t('hosts.openSftp')}
                          >
                            {isConnecting && connectingInfo?.type === 'sftp' ? (
                              <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                            ) : (
                              <FolderTree className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => onConnect(host, 'monitor')}
                            disabled={Boolean(connectingInfo)}
                            className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
                              isConnecting && connectingInfo?.type === 'monitor'
                                ? 'bg-purple-500/20 text-purple-400 ring-1 ring-purple-500'
                                : isLight
                                  ? 'text-slate-600 hover:text-purple-600 hover:bg-purple-50'
                                  : 'hover:bg-purple-500/20 text-slate-400 hover:text-purple-500'
                            }`}
                            title={t('hosts.openMonitor')}
                          >
                            {isConnecting && connectingInfo?.type === 'monitor' ? (
                              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
                            ) : (
                              <Activity className="w-4 h-4" />
                            )}
                          </button>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => onEdit(host)}
                            disabled={Boolean(connectingInfo)}
                            className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
                              isLight
                                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                                : 'hover:bg-slate-500/10 text-slate-400 hover:text-slate-200'
                            }`}
                            title={t('hosts.editHost')}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onDelete(host.id)}
                            disabled={Boolean(connectingInfo)}
                            className={`p-1.5 rounded-md transition-colors disabled:opacity-40 ${
                              isLight
                                ? 'text-slate-600 hover:text-red-600 hover:bg-red-50'
                                : 'hover:bg-red-500/20 text-slate-400 hover:text-red-500'
                            }`}
                            title={t('hosts.deleteHost')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Dashed Add Host Card */}
                <button
                  type="button"
                  onClick={handleNewHostClick}
                  className={`border-2 border-dashed rounded-xl p-5 transition-all flex flex-col items-center justify-center space-y-2 min-h-[140px] group cursor-pointer ${
                    isLight
                      ? 'border-slate-300 hover:border-sky-500 bg-white/60 hover:bg-sky-50/50 text-slate-600 hover:text-sky-600 shadow-sm'
                      : 'border-[#333] hover:border-sky-500/60 bg-[#1e1e1e]/40 hover:bg-sky-500/5 text-slate-400 hover:text-sky-400'
                  }`}
                >
                  <div
                    className={`p-2.5 rounded-full transition-colors ${
                      isLight
                        ? 'bg-slate-100 group-hover:bg-sky-100 text-slate-600 group-hover:text-sky-600'
                        : 'bg-[#272727] group-hover:bg-sky-500/20 text-slate-400 group-hover:text-sky-400'
                    }`}
                  >
                    <Plus className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold">{t('hosts.newHost')}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
