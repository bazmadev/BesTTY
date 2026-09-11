import React, { useEffect, useState } from 'react';
import { ServerMetrics, RemoteProcess } from '../types';
import { useTranslation } from '../i18n';
import { Activity, Cpu, HardDrive, Server, Clock, AlertTriangle, RefreshCw, XCircle } from 'lucide-react';

interface MonitorViewProps {
  sessionId: string;
  isLight?: boolean;
  hostName?: string;
}

export const MonitorView: React.FC<MonitorViewProps> = ({ sessionId, isLight = false, hostName }) => {
  const { t } = useTranslation();
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [processes, setProcesses] = useState<RemoteProcess[]>([]);
  const [isKilling, setIsKilling] = useState<number | null>(null);

  useEffect(() => {
    window.api?.monitor.start(sessionId);

    const unsubscribe = window.api?.monitor.onStats((payload) => {
      if (payload.sessionId === sessionId) {
        setMetrics(payload.metrics);
        setProcesses(payload.processes);
      }
    });

    return () => {
      window.api?.monitor.stop(sessionId);
      unsubscribe?.();
    };
  }, [sessionId]);

  const handleKill = async (pid: number) => {
    if (!confirm(t('monitor.killConfirm').replace('{pid}', String(pid)))) return;
    setIsKilling(pid);
    try {
      await window.api.monitor.killProcess(sessionId, pid, 'SIGTERM');
    } catch (e: any) {
      alert(`Failed to kill process: ${e.message}`);
    } finally {
      setIsKilling(null);
    }
  };

  const getUsageColor = (pct: number) => {
    if (pct > 85) return 'text-rose-500 bg-rose-500';
    if (pct > 65) return 'text-amber-500 bg-amber-500';
    return 'text-emerald-500 bg-emerald-500';
  };

  return (
    <div className={`flex-1 flex flex-col w-full h-full overflow-y-auto p-6 select-none ${
      isLight ? 'bg-[#f5f5f5] text-slate-800' : 'bg-[#181818] text-slate-100'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold flex items-center space-x-2">
            <Activity className="w-6 h-6 text-purple-500" />
            <span>{t('monitor.title')}</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {t('monitor.subtitle').replace('{host}', hostName || 'Remote VPS')}
          </p>
        </div>

        {metrics && (
          <div className={`flex items-center space-x-2 border px-3 py-1.5 rounded-lg text-xs font-mono ${
            isLight ? 'bg-white border-slate-300 text-slate-700' : 'bg-[#202020] border-[#333] text-slate-300'
          }`}>
            <Clock className="w-3.5 h-3.5 text-sky-500" />
            <span>{metrics.uptime}</span>
          </div>
        )}
      </div>

      {!metrics ? (
        <div className="flex flex-col items-center justify-center h-64 text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 animate-spin text-purple-500" />
          <span className="text-xs font-mono">{t('monitor.gathering')}</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* CPU Usage */}
            <div className={`border rounded-xl p-4 shadow-sm ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
                  <Cpu className="w-4 h-4 text-sky-500" />
                  <span>{t('monitor.cpu')}</span>
                </span>
                <span className={`text-xs font-bold font-mono ${getUsageColor(metrics.cpuUsage).split(' ')[0]}`}>
                  {metrics.cpuUsage}%
                </span>
              </div>
              <div className={`w-full rounded-full h-2 overflow-hidden border mb-1.5 ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181818] border-[#333]'
              }`}>
                <div
                  className={`h-full transition-all duration-500 ${getUsageColor(metrics.cpuUsage).split(' ')[1]}`}
                  style={{ width: `${Math.min(100, metrics.cpuUsage)}%` }}
                />
              </div>
            </div>

            {/* RAM Usage */}
            <div className={`border rounded-xl p-4 shadow-sm ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
                  <Server className="w-4 h-4 text-emerald-500" />
                  <span>{t('monitor.memory')}</span>
                </span>
                <span className={`text-xs font-bold font-mono ${getUsageColor(metrics.memoryPercent).split(' ')[0]}`}>
                  {metrics.memoryPercent}%
                </span>
              </div>
              <div className={`w-full rounded-full h-2 overflow-hidden border mb-1.5 ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181818] border-[#333]'
              }`}>
                <div
                  className={`h-full transition-all duration-500 ${getUsageColor(metrics.memoryPercent).split(' ')[1]}`}
                  style={{ width: `${Math.min(100, metrics.memoryPercent)}%` }}
                />
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex justify-between">
                <span>{(metrics.memoryUsed / 1024).toFixed(1)} GB {t('monitor.used')}</span>
                <span>{(metrics.memoryTotal / 1024).toFixed(1)} GB {t('monitor.total')}</span>
              </div>
            </div>

            {/* Swap Usage */}
            <div className={`border rounded-xl p-4 shadow-sm ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 flex items-center space-x-1.5">
                  <HardDrive className="w-4 h-4 text-amber-500" />
                  <span>{t('monitor.swap')}</span>
                </span>
                <span className={`text-xs font-bold font-mono ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  {metrics.swapTotal > 0
                    ? `${Math.round((metrics.swapUsed / metrics.swapTotal) * 100)}%`
                    : 'N/A'}
                </span>
              </div>
              <div className={`w-full rounded-full h-2 overflow-hidden border mb-1.5 ${
                isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181818] border-[#333]'
              }`}>
                <div
                  className="h-full bg-amber-500 transition-all duration-500"
                  style={{
                    width: `${metrics.swapTotal > 0 ? (metrics.swapUsed / metrics.swapTotal) * 100 : 0}%`,
                  }}
                />
              </div>
              <div className="text-[11px] font-mono text-slate-400 flex justify-between">
                <span>{metrics.swapUsed} MB {t('monitor.used')}</span>
                <span>{metrics.swapTotal} MB {t('monitor.total')}</span>
              </div>
            </div>

            {/* Load Average */}
            <div className={`border rounded-xl p-4 shadow-sm ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
            }`}>
              <span className="text-xs font-semibold text-slate-400 block mb-2">
                {t('monitor.loadAvg')}
              </span>
              <div className={`flex items-center space-x-2 font-mono text-sm font-bold ${
                isLight ? 'text-slate-800' : 'text-white'
              }`}>
                <span className={`px-2 py-1 rounded border ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181818] border-[#333]'
                }`}>
                  {metrics.loadAvg[0]?.toFixed(2)}
                </span>
                <span className={`px-2 py-1 rounded border ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181818] border-[#333]'
                }`}>
                  {metrics.loadAvg[1]?.toFixed(2)}
                </span>
                <span className={`px-2 py-1 rounded border ${
                  isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181818] border-[#333]'
                }`}>
                  {metrics.loadAvg[2]?.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Disk Partitions */}
          <div className={`border rounded-xl p-4 shadow-sm ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
          }`}>
            <h3 className={`text-xs font-semibold mb-3 flex items-center space-x-2 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <HardDrive className="w-4 h-4 text-sky-500" />
              <span>{t('monitor.disks')}</span>
            </h3>
            <div className="space-y-3">
              {metrics.disks.map((d) => (
                <div key={d.mount} className="space-y-1">
                  <div className="flex justify-between text-xs font-mono">
                    <span className={`font-semibold ${isLight ? 'text-slate-900' : 'text-white'}`}>
                      {d.mount} ({d.filesystem})
                    </span>
                    <span className="text-slate-400">
                      {d.used} MB / {d.total} MB ({d.percent}%)
                    </span>
                  </div>
                  <div className={`w-full rounded-full h-2 overflow-hidden border ${
                    isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181818] border-[#333]'
                  }`}>
                    <div
                      className={`h-full ${getUsageColor(d.percent).split(' ')[1]}`}
                      style={{ width: `${Math.min(100, d.percent)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Top Running Processes */}
          <div className={`border rounded-xl p-4 shadow-sm ${
            isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
          }`}>
            <h3 className={`text-xs font-semibold mb-3 flex items-center space-x-2 ${
              isLight ? 'text-slate-700' : 'text-slate-300'
            }`}>
              <Activity className="w-4 h-4 text-purple-500" />
              <span>{t('monitor.processes')}</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className={`border-b text-slate-400 ${
                    isLight ? 'border-slate-200' : 'border-[#303030]'
                  }`}>
                    <th className="py-2 px-3">PID</th>
                    <th className="py-2 px-3">User</th>
                    <th className="py-2 px-3 text-right">CPU %</th>
                    <th className="py-2 px-3 text-right">MEM %</th>
                    <th className="py-2 px-3">Command</th>
                    <th className="py-2 px-3 text-center">{t('sftp.actions')}</th>
                  </tr>
                </thead>
                <tbody className={isLight ? 'divide-y divide-slate-100' : 'divide-y divide-[#282828]'}>
                  {processes.map((p) => (
                    <tr key={p.pid} className={`transition-colors ${
                      isLight ? 'hover:bg-slate-50' : 'hover:bg-[#252525]'
                    }`}>
                      <td className="py-2 px-3 text-sky-500 font-semibold">{p.pid}</td>
                      <td className={`py-2 px-3 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>{p.user}</td>
                      <td className="py-2 px-3 text-right text-amber-500 font-bold">{p.cpu}%</td>
                      <td className="py-2 px-3 text-right text-emerald-500">{p.mem}%</td>
                      <td className={`py-2 px-3 truncate max-w-md ${isLight ? 'text-slate-800' : 'text-slate-200'}`}>
                        {p.command}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => handleKill(p.pid)}
                          disabled={isKilling === p.pid}
                          className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-colors text-[11px] font-medium"
                          title="Terminate process (SIGTERM)"
                        >
                          {t('monitor.kill')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
