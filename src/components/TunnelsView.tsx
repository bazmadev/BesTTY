import React, { useState } from 'react';
import { TunnelConfig, HostProfile } from '../types';
import { Network, Plus, Play, Square, Trash2, Globe, Shield, ArrowRight, X } from 'lucide-react';

interface TunnelsViewProps {
  tunnels: TunnelConfig[];
  hosts: HostProfile[];
  onSaveTunnel: (tunnel: TunnelConfig) => void;
  onDeleteTunnel: (id: string) => void;
}

export const TunnelsView: React.FC<TunnelsViewProps> = ({
  tunnels,
  hosts,
  onSaveTunnel,
  onDeleteTunnel,
}) => {
  const [activeTunnelIds, setActiveTunnelIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [hostId, setHostId] = useState(hosts[0]?.id || '');
  const [type, setType] = useState<'local' | 'remote' | 'dynamic'>('local');
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState(80);
  const [error, setError] = useState<string | null>(null);

  const toggleTunnel = async (tunnel: TunnelConfig) => {
    const isActive = activeTunnelIds.has(tunnel.id);
    try {
      if (isActive) {
        await window.api.tunnels.stop(tunnel.id);
        setActiveTunnelIds((prev) => {
          const next = new Set(prev);
          next.delete(tunnel.id);
          return next;
        });
      } else {
        await window.api.tunnels.start(tunnel);
        setActiveTunnelIds((prev) => new Set(prev).add(tunnel.id));
      }
    } catch (err: any) {
      alert(`Tunnel error: ${err.message}`);
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newTunnel: TunnelConfig = {
      id: crypto.randomUUID(),
      name: name.trim(),
      hostId,
      type,
      localPort: Number(localPort),
      remoteHost: type !== 'dynamic' ? remoteHost : undefined,
      remotePort: type !== 'dynamic' ? Number(remotePort) : undefined,
      status: 'inactive',
    };

    onSaveTunnel(newTunnel);
    setShowAddModal(false);
    setName('');
    setLocalPort(8080);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] p-6 overflow-y-auto select-none">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <Network className="w-6 h-6 text-cyan-400" />
              <span>SSH Port Forwarding & Tunnels</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Forward local ports, expose remote services, or create a dynamic SOCKS5 proxy via SSH.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Tunnel</span>
          </button>
        </div>

        {/* Tunnel List */}
        {tunnels.length === 0 ? (
          <div className="border-2 border-dashed border-[#303030] rounded-2xl p-12 text-center text-slate-500 space-y-3">
            <Network className="w-12 h-12 mx-auto text-slate-600" />
            <div className="text-sm font-semibold text-slate-300">No Tunnels Configured</div>
            <p className="text-xs max-w-sm mx-auto">
              Create a local port forward (e.g. forward local 8080 to remote Postgres 5432) or setup a Dynamic SOCKS5 proxy.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tunnels.map((t) => {
              const isActive = activeTunnelIds.has(t.id);
              const host = hosts.find((h) => h.id === t.hostId);

              return (
                <div
                  key={t.id}
                  className="bg-[#202020] border border-[#303030] rounded-xl p-4 flex flex-col justify-between shadow-sm"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-semibold text-white">{t.name}</h4>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-[#181818] text-slate-500 border border-[#333]'
                        }`}
                      >
                        {isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1 font-mono mb-4">
                      <div>
                        <span className="text-slate-500">Host:</span> {host?.name || 'Unknown'}
                      </div>
                      <div>
                        <span className="text-slate-500">Type:</span>{' '}
                        <span className="text-cyan-400 uppercase">{t.type}</span>
                      </div>
                      <div className="text-slate-200">
                        {t.type === 'dynamic' ? (
                          `SOCKS5: 127.0.0.1:${t.localPort}`
                        ) : (
                          `127.0.0.1:${t.localPort} -> ${t.remoteHost}:${t.remotePort}`
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#2a2a2a]">
                    <button
                      onClick={() => toggleTunnel(t)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isActive ? 'Stop' : 'Start'}</span>
                    </button>

                    <button
                      onClick={() => onDeleteTunnel(t.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                      title="Delete Tunnel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#202020] border border-[#383838] w-full max-w-md rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#303030] pb-3">
                <h3 className="text-sm font-semibold text-white">Create SSH Tunnel</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Tunnel Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Postgres DB or SOCKS5 Proxy"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">SSH Host</label>
                  <select
                    value={hostId}
                    onChange={(e) => setHostId(e.target.value)}
                    className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    {hosts.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.username}@{h.host})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Forwarding Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="local">Local Port Forwarding (-L)</option>
                    <option value="dynamic">Dynamic SOCKS5 Proxy (-D)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Local Port</label>
                  <input
                    type="number"
                    required
                    value={localPort}
                    onChange={(e) => setLocalPort(Number(e.target.value))}
                    className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                {type !== 'dynamic' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">Remote Host</label>
                      <input
                        type="text"
                        required
                        value={remoteHost}
                        onChange={(e) => setRemoteHost(e.target.value)}
                        className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Remote Port</label>
                      <input
                        type="number"
                        required
                        value={remotePort}
                        onChange={(e) => setRemotePort(Number(e.target.value))}
                        className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#303030]">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 rounded text-xs text-slate-300 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow"
                  >
                    Create Tunnel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
