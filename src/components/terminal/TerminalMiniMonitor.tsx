import React, { useState, useEffect } from 'react';
import { Activity, Cpu, Layers, HardDrive, Trash2, ArrowLeftRight, PanelLeft, PanelRight, X } from 'lucide-react';
import { ServerMetrics, RemoteProcess } from '../../types';

interface TerminalMiniMonitorProps {
  sessionId: string;
  width: number;
  position: 'left' | 'right';
  showSftpSidebar: boolean;
  isLight: boolean;
  t: (key: string) => string;
  onSwapPanels: () => void;
  onTogglePosition: () => void;
  onClose: () => void;
  onSendTerminalCommand: (cmd: string) => void;
}

export const TerminalMiniMonitor: React.FC<TerminalMiniMonitorProps> = React.memo(({
  sessionId,
  width,
  position,
  showSftpSidebar,
  isLight,
  t,
  onSwapPanels,
  onTogglePosition,
  onClose,
  onSendTerminalCommand,
}) => {
  const [metrics, setMetrics] = useState<ServerMetrics | null>(null);
  const [processes, setProcesses] = useState<RemoteProcess[]>([]);

  // Self-contained Telemetry Lifecycle (guarantees monitor.stop is called on unmount)
  useEffect(() => {
    window.api?.monitor.start(sessionId);

    const unsubscribe = window.api?.monitor.onStats((payload) => {
      if (payload.sessionId === sessionId) {
        setMetrics(payload.metrics);
        setProcesses(payload.processes);
      }
    });

    return () => {
      unsubscribe?.();
      window.api?.monitor.stop(sessionId);
    };
  }, [sessionId]);

  const handleKillProcess = (pid: number) => {
    onSendTerminalCommand(`kill -15 ${pid}\n`);
  };

  return (
    <div
      style={{ width: `${width}px` }}
      className={`flex flex-col h-full select-none shadow-lg z-10 flex-shrink-0 ${
        position === 'right' ? 'border-l' : 'border-r'
      } ${
        isLight ? 'bg-[#f4f4f4] border-[#e0e0e0]' : 'bg-[#1c1c1c] border-[#2c2c2c]'
      }`}
    >
      {/* Mini-Monitor Header */}
      <div className={`p-2 border-b flex items-center justify-between ${
        isLight ? 'bg-[#ececec] border-[#e0e0e0]' : 'bg-[#222222] border-[#2c2c2c]'
      }`}>
        <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center space-x-1.5 min-w-0 flex-1 truncate mr-1">
          <Activity className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="truncate">Mini Monitor</span>
        </span>
        <div className="flex items-center space-x-0.5 flex-shrink-0">
          {showSftpSidebar ? (
            <button
              onClick={onSwapPanels}
              className={`p-1 rounded flex-shrink-0 ${
                isLight ? 'text-amber-600 hover:text-amber-800 hover:bg-slate-200' : 'text-amber-400 hover:text-amber-300 hover:bg-white/10'
              }`}
              title={t('terminal.swapPanels')}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={onTogglePosition}
              className={`p-1 rounded flex-shrink-0 ${
                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={position === 'left' ? t('terminal.dockRight') : t('terminal.dockLeft')}
            >
              {position === 'left' ? <PanelRight className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={onClose}
            className={`p-1 rounded flex-shrink-0 ${
              isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
            title={t('terminal.closeSidebar')}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Mini-Monitor Body */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3 text-xs">
        {!metrics ? (
          <div className={`p-4 text-center flex flex-col items-center space-y-2 ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
            <Activity className="w-5 h-5 animate-pulse text-purple-400" />
            <span className="text-[11px]">{t('monitor.gathering')}</span>
          </div>
        ) : (
          <>
            {/* CPU Gauge Card */}
            <div className={`p-2 rounded-lg border ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#222222] border-[#2f2f2f]'
            }`}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className={`flex items-center space-x-1 ${isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                  <Cpu className="w-3 h-3 text-sky-400" />
                  <span>CPU Usage</span>
                </span>
                <span className="font-mono font-bold text-sky-400">
                  {metrics.cpuUsage.toFixed(1)}%
                </span>
              </div>
              <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-700/30'}`}>
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    metrics.cpuUsage > 85
                      ? 'bg-rose-500'
                      : metrics.cpuUsage > 60
                      ? 'bg-amber-500'
                      : 'bg-sky-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, metrics.cpuUsage))}%` }}
                />
              </div>
              <div className={`mt-1 text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
                Load: {metrics.loadAvg.join(' ')}
              </div>
            </div>

            {/* RAM Memory Card */}
            <div className={`p-2 rounded-lg border ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#222222] border-[#2f2f2f]'
            }`}>
              <div className="flex items-center justify-between text-[11px] mb-1">
                <span className={`flex items-center space-x-1 ${isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                  <Layers className="w-3 h-3 text-emerald-400" />
                  <span>RAM Memory</span>
                </span>
                <span className="font-mono font-bold text-emerald-400">
                  {metrics.memoryPercent}%
                </span>
              </div>
              <div className={`w-full h-1.5 rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-700/30'}`}>
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    metrics.memoryPercent > 85
                      ? 'bg-rose-500'
                      : metrics.memoryPercent > 65
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, metrics.memoryPercent))}%` }}
                />
              </div>
              <div className={`mt-1 flex justify-between text-[10px] font-mono ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
                <span>{(metrics.memoryUsed / 1024).toFixed(1)} GB used</span>
                <span>{(metrics.memoryTotal / 1024).toFixed(1)} GB total</span>
              </div>
            </div>

            {/* Disks */}
            {metrics.disks && metrics.disks.length > 0 && (
              <div className={`p-2 rounded-lg border ${
                isLight ? 'bg-white border-slate-200' : 'bg-[#222222] border-[#2f2f2f]'
              }`}>
                <div className={`text-[11px] flex items-center space-x-1 mb-1.5 ${isLight ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
                  <HardDrive className="w-3 h-3 text-amber-400" />
                  <span>Disks</span>
                </div>
                <div className="space-y-1.5">
                  {metrics.disks.slice(0, 3).map((d, i) => (
                    <div key={i} className="text-[10px]">
                      <div className={`flex justify-between font-mono ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                        <span className="truncate max-w-[120px]">{d.mount}</span>
                        <span className="font-semibold">{d.percent}%</span>
                      </div>
                      <div className={`w-full h-1 rounded-full overflow-hidden mt-0.5 ${isLight ? 'bg-slate-200' : 'bg-slate-700/30'}`}>
                        <div
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${Math.min(100, d.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Top Running Processes */}
            <div className={`p-2 rounded-lg border flex-1 ${
              isLight ? 'bg-white border-slate-200' : 'bg-[#222222] border-[#2f2f2f]'
            }`}>
              <div className={`text-[11px] flex items-center justify-between mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                <span className="font-semibold">Top Processes</span>
                <span className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>CPU / MEM</span>
              </div>
              <div className={`divide-y font-mono text-[10px] ${isLight ? 'divide-slate-200' : 'divide-slate-700/20'}`}>
                {processes.slice(0, 5).map((proc) => (
                  <div key={proc.pid} className="py-1 flex items-center justify-between group">
                    <div className="truncate flex-1 mr-1">
                      <div className={`font-medium truncate ${isLight ? 'text-slate-900 font-semibold' : 'text-slate-300'}`} title={proc.command}>
                        {proc.command.split(' ')[0]}
                      </div>
                      <div className={`text-[9px] ${isLight ? 'text-slate-500' : 'text-slate-500'}`}>PID: {proc.pid} ({proc.user})</div>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <span className="text-sky-400 font-semibold">{proc.cpu.toFixed(0)}%</span>
                      <span className={isLight ? 'text-slate-600' : 'text-slate-400'}>{proc.mem.toFixed(0)}%</span>
                      <button
                        onClick={() => handleKillProcess(proc.pid)}
                        className={`opacity-0 group-hover:opacity-100 p-0.5 rounded ${
                          isLight ? 'text-rose-600 hover:bg-rose-100' : 'text-rose-400 hover:bg-rose-500/20'
                        }`}
                        title="SIGTERM process"
                      >
                        <Trash2 className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});
