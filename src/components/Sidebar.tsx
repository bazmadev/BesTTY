import React from 'react';
import { Server, FolderTree, Code, Activity, Network, Terminal, Settings, Lock, Unlock } from 'lucide-react';
import { TabType, VaultStatus } from '../types';
import { useTranslation } from '../i18n';

interface SidebarProps {
  currentView: 'hosts' | TabType;
  isLight?: boolean;
  onSelectView: (view: 'hosts' | TabType) => void;
  vaultStatus: VaultStatus;
  onToggleVault: () => void;
  connectedSessionCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  isLight = false,
  onSelectView,
  vaultStatus,
  onToggleVault,
  connectedSessionCount,
}) => {
  const { t } = useTranslation();

  const navItems: Array<{ id: 'hosts' | TabType; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'hosts', label: t('nav.hosts'), icon: <Server className="w-5 h-5" /> },
    { id: 'terminal', label: t('nav.terminal'), icon: <Terminal className="w-5 h-5" />, badge: connectedSessionCount },
    { id: 'sftp', label: t('nav.sftp'), icon: <FolderTree className="w-5 h-5" /> },
    { id: 'editor', label: t('nav.editor'), icon: <Code className="w-5 h-5" /> },
    { id: 'monitor', label: t('nav.monitor'), icon: <Activity className="w-5 h-5" /> },
    { id: 'tunnels', label: t('nav.tunnels'), icon: <Network className="w-5 h-5" /> },
    { id: 'settings', label: t('nav.settings'), icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className={`w-14 border-r flex flex-col items-center py-3 justify-between select-none z-40 transition-colors ${
      isLight ? 'bg-[#eaeaea] border-[#dcdcdc]' : 'bg-[#181818] border-[#2d2d2d]'
    }`}>
      {/* Navigation Buttons */}
      <div className="flex flex-col items-center space-y-2 w-full">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`relative group w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                isActive
                  ? isLight
                    ? 'bg-sky-500/20 text-sky-700 border border-sky-400/50 shadow-sm'
                    : 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-lg'
                  : isLight
                    ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-[#262626]'
              }`}
              title={item.label}
            >
              {item.icon}

              {/* Indicator bar for active item */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-sky-500 rounded-r" />
              )}

              {/* Badge for active sessions */}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-sky-500 text-white font-mono text-[9px] font-bold rounded-full flex items-center justify-center shadow">
                  {item.badge}
                </span>
              )}

              {/* Tooltip on hover */}
              <span className={`absolute left-14 text-xs px-2.5 py-1.5 rounded-md shadow-xl border whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 ${
                isLight ? 'bg-white text-slate-800 border-slate-200 shadow-md' : 'bg-[#2b2b2b] text-slate-100 border-white/10'
              }`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Vault Status Indicator & Lock Button */}
      <div className="flex flex-col items-center w-full">
        <button
          onClick={onToggleVault}
          className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            vaultStatus.isUnlocked
              ? 'text-emerald-500 hover:bg-emerald-500/10'
              : 'text-amber-500 hover:bg-amber-500/10'
          }`}
          title={vaultStatus.isUnlocked ? t('nav.vaultUnlocked') : t('nav.vaultLocked')}
        >
          {vaultStatus.isUnlocked ? (
            <Unlock className="w-5 h-5" />
          ) : (
            <Lock className="w-5 h-5" />
          )}

          <span className={`absolute left-14 text-xs px-2.5 py-1.5 rounded-md shadow-xl border whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 ${
            isLight ? 'bg-white text-slate-800 border-slate-200 shadow-md' : 'bg-[#2b2b2b] text-slate-100 border-white/10'
          }`}>
            {vaultStatus.isUnlocked ? t('nav.vaultUnlocked') : t('nav.vaultLocked')}
          </span>
        </button>
      </div>
    </div>
  );
};
