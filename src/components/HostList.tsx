import React, { useState } from 'react';
import { HostProfile } from '../types';
import { Server, Terminal, FolderTree, Activity, Plus, Search, Edit2, Trash2, Shield, Key, Lock, ArrowRight } from 'lucide-react';

interface HostListProps {
  hosts: HostProfile[];
  onConnect: (host: HostProfile, initialTab?: 'terminal' | 'sftp' | 'monitor') => void;
  onEdit: (host: HostProfile) => void;
  onDelete: (id: string) => void;
  onNewHost: () => void;
}

export const HostList: React.FC<HostListProps> = ({
  hosts,
  onConnect,
  onEdit,
  onDelete,
  onNewHost,
}) => {
  const [search, setSearch] = useState('');
  const [quickConnectInput, setQuickConnectInput] = useState('');

  const filteredHosts = hosts.filter((h) => {
    const query = search.toLowerCase();
    return (
      h.name.toLowerCase().includes(query) ||
      h.host.toLowerCase().includes(query) ||
      h.username.toLowerCase().includes(query) ||
      (h.group && h.group.toLowerCase().includes(query))
    );
  });

  // Group hosts by their group field
  const groupedHosts = filteredHosts.reduce<Record<string, HostProfile[]>>((acc, host) => {
    const group = host.group || 'Default';
    if (!acc[group]) acc[group] = [];
    acc[group].push(host);
    return acc;
  }, {});

  const handleQuickConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickConnectInput.trim()) return;

    // Parse user@host:port or host:port or host
    let username = 'root';
    let host = quickConnectInput.trim();
    let port = 22;

    if (host.includes('@')) {
      const parts = host.split('@');
      username = parts[0];
      host = parts[1];
    }

    if (host.includes(':')) {
      const parts = host.split(':');
      host = parts[0];
      port = parseInt(parts[1], 10) || 22;
    }

    const tempHost: HostProfile = {
      id: crypto.randomUUID(),
      name: `Quick: ${username}@${host}`,
      host,
      port,
      username,
      authType: 'password',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    onConnect(tempHost, 'terminal');
    setQuickConnectInput('');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] overflow-hidden p-6">
      {/* Top Header & Quick Connect */}
      <div className="mb-6 space-y-4 max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
              <Server className="w-6 h-6 text-sky-400" />
              <span>SSH Connection Manager</span>
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Select a Linux VPS/VDS server or use Quick Connect to start an instant session
            </p>
          </div>

          <button
            onClick={onNewHost}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Host</span>
          </button>
        </div>

        {/* Quick Connect & Search Bar */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Quick Connect */}
          <form onSubmit={handleQuickConnect} className="md:col-span-2 flex items-center space-x-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Quick Connect: root@192.168.1.100:22 or hostname"
                value={quickConnectInput}
                onChange={(e) => setQuickConnectInput(e.target.value)}
                className="w-full bg-[#222222] border border-[#333] rounded-lg px-4 py-2 text-xs text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>
            <button
              type="submit"
              className="bg-[#2d2d2d] hover:bg-sky-600 hover:text-white text-slate-200 px-4 py-2 rounded-lg text-xs font-medium flex items-center space-x-1.5 border border-[#444] transition-all"
            >
              <span>Connect</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Search filter */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search hosts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#222222] border border-[#333] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>
        </div>
      </div>

      {/* Host Groups & Cards */}
      <div className="flex-1 overflow-y-auto space-y-6 max-w-5xl mx-auto w-full pr-1">
        {hosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-[#2d2d2d] rounded-2xl p-8 text-center">
            <Server className="w-12 h-12 text-slate-600 mb-3" />
            <h3 className="text-sm font-semibold text-slate-300">No SSH Hosts Configured Yet</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1 mb-4">
              Add your Linux VPS, staging environment, or router to manage it with high-speed GPU terminal, SFTP file explorer, and in-place code editing.
            </p>
            <button
              onClick={onNewHost}
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-md transition-all flex items-center space-x-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Your First Server</span>
            </button>
          </div>
        ) : Object.keys(groupedHosts).length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No hosts matched your search "{search}"
          </div>
        ) : (
          Object.entries(groupedHosts).map(([groupName, groupHosts]) => (
            <div key={groupName} className="space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <span>{groupName}</span>
                <span className="text-[10px] bg-[#272727] text-slate-400 px-1.5 py-0.5 rounded-full">
                  {groupHosts.length}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {groupHosts.map((host) => (
                  <div
                    key={host.id}
                    className="group bg-[#202020] hover:bg-[#252525] border border-[#303030] hover:border-sky-500/40 rounded-xl p-4 transition-all shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2.5">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: host.color || '#0078d4' }}
                          />
                          <h4 className="text-sm font-semibold text-white truncate max-w-[160px]">
                            {host.name}
                          </h4>
                        </div>

                        {/* Auth Badge */}
                        <span className="flex items-center space-x-1 text-[10px] font-mono bg-[#181818] px-2 py-0.5 rounded text-slate-400 border border-[#333]">
                          {host.authType === 'password' && <Lock className="w-3 h-3 text-amber-400" />}
                          {host.authType === 'privateKey' && <Key className="w-3 h-3 text-emerald-400" />}
                          {host.authType === 'agent' && <Shield className="w-3 h-3 text-sky-400" />}
                          <span className="capitalize">{host.authType}</span>
                        </span>
                      </div>

                      <div className="font-mono text-xs text-slate-400 mb-4 truncate">
                        {host.username}@{host.host}:{host.port}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-3 border-t border-[#2a2a2a]">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onConnect(host, 'terminal')}
                          className="p-1.5 rounded-md hover:bg-sky-500/20 text-slate-300 hover:text-sky-400 transition-colors"
                          title="Open Terminal"
                        >
                          <Terminal className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onConnect(host, 'sftp')}
                          className="p-1.5 rounded-md hover:bg-amber-500/20 text-slate-300 hover:text-amber-400 transition-colors"
                          title="Open SFTP File Explorer"
                        >
                          <FolderTree className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onConnect(host, 'monitor')}
                          className="p-1.5 rounded-md hover:bg-purple-500/20 text-slate-300 hover:text-purple-400 transition-colors"
                          title="Open Server Health Monitor"
                        >
                          <Activity className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => onEdit(host)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                          title="Edit Host"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(host.id)}
                          className="p-1.5 rounded-md hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                          title="Delete Host"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
