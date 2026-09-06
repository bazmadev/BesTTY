import React, { useState } from 'react';
import { TunnelConfig, HostProfile } from '../types';
import { useTranslation } from '../i18n';
import { Network, Plus, Play, Square, Trash2, Globe, Shield, ArrowRight, X } from 'lucide-react';

interface TunnelsViewProps {
  tunnels: TunnelConfig[];
  hosts: HostProfile[];
  isLight?: boolean;
  onSaveTunnel: (tunnel: TunnelConfig) => void;
  onDeleteTunnel: (id: string) => void;
}

export const TunnelsView: React.FC<TunnelsViewProps> = ({
  tunnels,
  hosts,
  isLight = false,
  onSaveTunnel,
  onDeleteTunnel,
}) => {
  const { t } = useTranslation();
  const [activeTunnelIds, setActiveTunnelIds] = useState<Set<string>>(new Set());
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [hostId, setHostId] = useState(hosts[0]?.id || '');
  const [type, setType] = useState<'local' | 'remote' | 'dynamic'>('local');
  const [localPort, setLocalPort] = useState(8080);
  const [remoteHost, setRemoteHost] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState(80);

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
    <div className={`flex-1 flex flex-col h-full p-6 overflow-y-auto select-none ${
      isLight ? 'bg-[#f5f5f5] text-slate-800' : 'bg-[#181818] text-slate-100'
    }`}>
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center space-x-2">
              <Network className="w-6 h-6 text-cyan-500" />
              <span>{t('tunnels.title')}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {t('tunnels.subtitle')}
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{t('tunnels.addTunnel')}</span>
          </button>
        </div>

        {/* Tunnel List */}
        {tunnels.length === 0 ? (
          <div className={`border-2 border-dashed rounded-2xl p-12 text-center space-y-3 ${
            isLight ? 'border-slate-300 bg-white/50 text-slate-500' : 'border-[#303030] text-slate-500'
          }`}>
            <Network className="w-12 h-12 mx-auto text-slate-400" />
            <div className={`text-sm font-semibold ${isLight ? 'text-slate-800' : 'text-slate-300'}`}>
              {t('tunnels.emptyTitle')}
            </div>
            <p className="text-xs max-w-sm mx-auto">
              {t('tunnels.emptyDesc')}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tunnels.map((tItem) => {
              const isActive = activeTunnelIds.has(tItem.id);
              const host = hosts.find((h) => h.id === tItem.hostId);

              return (
                <div
                  key={tItem.id}
                  className={`border rounded-xl p-4 flex flex-col justify-between shadow-sm transition-all ${
                    isLight ? 'bg-white border-slate-200 hover:border-sky-400' : 'bg-[#202020] border-[#303030]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className={`text-sm font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                        {tItem.name}
                      </h4>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          isActive
                            ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30'
                            : isLight
                            ? 'bg-slate-100 text-slate-500 border border-slate-200'
                            : 'bg-[#181818] text-slate-500 border border-[#333]'
                        }`}
                      >
                        {isActive ? t('tunnels.active') : t('tunnels.inactive')}
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1 font-mono mb-4">
                      <div>
                        <span className="text-slate-400">{t('tunnels.host')}:</span> {host?.name || 'Unknown'}
                      </div>
                      <div>
                        <span className="text-slate-400">{t('tunnels.type')}:</span>{' '}
                        <span className="text-cyan-500 uppercase font-semibold">{tItem.type}</span>
                      </div>
                      <div className={isLight ? 'text-slate-700 font-semibold' : 'text-slate-200 font-semibold'}>
                        {tItem.type === 'dynamic' ? (
                          `SOCKS5: 127.0.0.1:${tItem.localPort}`
                        ) : (
                          `127.0.0.1:${tItem.localPort} -> ${tItem.remoteHost}:${tItem.remotePort}`
                        )}
                      </div>
                    </div>
                  </div>

                  <div className={`flex items-center justify-between pt-3 border-t ${
                    isLight ? 'border-slate-100' : 'border-[#2a2a2a]'
                  }`}>
                    <button
                      onClick={() => toggleTunnel(tItem)}
                      className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold shadow transition-all ${
                        isActive
                          ? 'bg-rose-600 hover:bg-rose-500 text-white'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      }`}
                    >
                      {isActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isActive ? t('tunnels.stop') : t('tunnels.start')}</span>
                    </button>

                    <button
                      onClick={() => onDeleteTunnel(tItem.id)}
                      className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-500 transition-colors"
                      title={t('tunnels.delete')}
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
            <div className={`border w-full max-w-md rounded-xl shadow-2xl p-6 space-y-4 ${
              isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#202020] border-[#383838] text-white'
            }`}>
              <div className={`flex items-center justify-between border-b pb-3 ${
                isLight ? 'border-slate-200' : 'border-[#303030]'
              }`}>
                <h3 className="text-sm font-semibold">{t('tunnels.addTunnel')}</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('tunnels.name')}</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Postgres DB or SOCKS5 Proxy"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                    }`}
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('tunnels.host')}</label>
                  <select
                    value={hostId}
                    onChange={(e) => setHostId(e.target.value)}
                    className={`w-full border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                    }`}
                  >
                    {hosts.map((h) => (
                      <option key={h.id} value={h.id}>
                        {h.name} ({h.username}@{h.host})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('tunnels.type')}</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    className={`w-full border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                    }`}
                  >
                    <option value="local">Local Port Forwarding (-L)</option>
                    <option value="dynamic">Dynamic SOCKS5 Proxy (-D)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">{t('tunnels.localPort')}</label>
                  <input
                    type="number"
                    required
                    value={localPort}
                    onChange={(e) => setLocalPort(Number(e.target.value))}
                    className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                    }`}
                  />
                </div>

                {type !== 'dynamic' && (
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-xs text-slate-400 mb-1">{t('tunnels.remoteHost')}</label>
                      <input
                        type="text"
                        required
                        value={remoteHost}
                        onChange={(e) => setRemoteHost(e.target.value)}
                        className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">{t('tunnels.remotePort')}</label>
                      <input
                        type="number"
                        required
                        value={remotePort}
                        onChange={(e) => setRemotePort(Number(e.target.value))}
                        className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                          isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                        }`}
                      />
                    </div>
                  </div>
                )}

                <div className={`flex items-center justify-end space-x-2 pt-3 border-t ${
                  isLight ? 'border-slate-200' : 'border-[#303030]'
                }`}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    className="px-3 py-1.5 rounded text-xs text-slate-400 hover:text-slate-600"
                  >
                    {t('modal.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow"
                  >
                    {t('tunnels.create')}
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

