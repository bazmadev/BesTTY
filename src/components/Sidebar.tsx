import React from 'react';
import { Server, FolderTree, Code, Activity, Network, Terminal, BookmarkCheck, Settings, Lock, Unlock } from 'lucide-react';
import { TabType, VaultStatus } from '../types';

interface SidebarProps {
  currentView: 'hosts' | TabType;
  onSelectView: (view: 'hosts' | TabType) => void;
  vaultStatus: VaultStatus;
  onToggleVault: () => void;
  connectedSessionCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  vaultStatus,
  onToggleVault,
  connectedSessionCount,
}) => {
  const navItems: Array<{ id: 'hosts' | TabType; label: string; icon: React.ReactNode; badge?: number }> = [
    { id: 'hosts', label: 'Hosts & Servers', icon: <Server className="w-5 h-5" /> },
    { id: 'terminal', label: 'Terminals', icon: <Terminal className="w-5 h-5" />, badge: connectedSessionCount },
    { id: 'sftp', label: 'SFTP File Explorer', icon: <FolderTree className="w-5 h-5" /> },
    { id: 'editor', label: 'Remote Code Editor', icon: <Code className="w-5 h-5" /> },
    { id: 'monitor', label: 'VPS Health Monitor', icon: <Activity className="w-5 h-5" /> },
    { id: 'tunnels', label: 'SSH Tunnels (Port Forwarding)', icon: <Network className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="w-14 bg-[#181818] border-r border-[#2d2d2d] flex flex-col items-center py-3 justify-between select-none z-40">
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
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-lg'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-[#262626]'
              }`}
              title={item.label}
            >
              {item.icon}

              {/* Indicator bar for active item */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-sky-400 rounded-r" />
              )}

              {/* Badge for active sessions */}
              {item.badge !== undefined && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-sky-500 text-white font-mono text-[9px] font-bold rounded-full flex items-center justify-center shadow">
                  {item.badge}
                </span>
              )}

              {/* Tooltip on hover */}
              <span className="absolute left-14 bg-[#2b2b2b] text-slate-100 text-xs px-2.5 py-1.5 rounded-md shadow-xl border border-white/10 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
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
              ? 'text-emerald-400 hover:bg-emerald-500/10'
              : 'text-amber-400 hover:bg-amber-500/10'
          }`}
          title={vaultStatus.isUnlocked ? 'Vault Unlocked (Click to lock)' : 'Vault Locked (Click to unlock)'}
        >
          {vaultStatus.isUnlocked ? (
            <Unlock className="w-5 h-5" />
          ) : (
            <Lock className="w-5 h-5" />
          )}

          <span className="absolute left-14 bg-[#2b2b2b] text-slate-100 text-xs px-2.5 py-1.5 rounded-md shadow-xl border border-white/10 whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50">
            {vaultStatus.isUnlocked ? 'Encrypted Vault Unlocked' : 'Encrypted Vault Locked'}
          </span>
        </button>
      </div>
    </div>
  );
};
