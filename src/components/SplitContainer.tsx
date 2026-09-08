import React, { useState, useEffect, useRef } from 'react';
import { 
  Terminal, FolderTree, Activity, HardDrive, Code, ChevronDown, 
  Maximize2, Minimize2, X, Plus, Server, Check 
} from 'lucide-react';
import { SplitLayoutMode, PaneConfig, PaneViewType, TabItem, HostProfile, TabType } from '../types';
import { useTranslation } from '../i18n';
import { TerminalView } from './TerminalView';
import { SftpView } from './SftpView';
import { MonitorView } from './MonitorView';
import { LocalFilesView } from './LocalFilesView';
import { MonacoEditorView } from './MonacoEditorView';

export interface SplitContainerProps {
  splitMode: SplitLayoutMode;
  panes: PaneConfig[];
  onChangePane: (paneIndex: number, newConfig: PaneConfig) => void;
  onSetSplitMode: (mode: SplitLayoutMode) => void;
  tabs: TabItem[];
  activeSessions: Map<string, HostProfile>;
  hosts?: HostProfile[];
  isLight: boolean;
  settings: any;
  snippets: any[];
  onRunSnippet: (cmd: string) => void;
  onOpenSftp: (sessionId: string, targetPath?: string) => void;
  onOpenMonitor: (sessionId: string) => void;
  onOpenFileInEditor: (sessionId: string, filePath: string, fileName: string) => void;
  onDuplicateSession: (sessionId?: string) => void;
  onNavigateToTerminal: (sessionId: string, folderPath: string, shouldSwitchTab?: boolean) => void;
  onCloseTab: (tabId: string) => void;
  onNewConnection?: (type: TabType) => void;
  onReconnectSession?: (sessionId: string, host: HostProfile) => Promise<void>;
  onClosePane?: (paneIndex: number) => void;
}

export const SplitContainer: React.FC<SplitContainerProps> = React.memo(({
  splitMode,
  panes,
  onChangePane,
  onSetSplitMode,
  tabs,
  activeSessions,
  hosts,
  isLight,
  settings,
  snippets,
  onRunSnippet,
  onOpenSftp,
  onOpenMonitor,
  onOpenFileInEditor,
  onDuplicateSession,
  onNavigateToTerminal,
  onCloseTab,
  onNewConnection,
  onReconnectSession,
  onClosePane,
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);

  const paneCount = splitMode === 'split-3' ? 3 : 2;

  // Percentage widths
  const [paneWidths, setPaneWidths] = useState<number[]>(() => {
    return splitMode === 'split-3' ? [33.33, 33.33, 33.34] : [50, 50];
  });

  // Re-initialize widths if splitMode changes
  useEffect(() => {
    if (splitMode === 'split-3') {
      setPaneWidths([33.33, 33.33, 33.34]);
    } else {
      setPaneWidths([50, 50]);
    }
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }, [splitMode]);

  // Maximize single pane state
  const [maximizedPaneIndex, setMaximizedPaneIndex] = useState<number | null>(null);

  // Dropdown menus open state per pane
  const [openDropdownPane, setOpenDropdownPane] = useState<number | null>(null);

  // Resizing state
  const resizingRef = useRef<{
    dividerIndex: number;
    startX: number;
    startWidths: number[];
  } | null>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setOpenDropdownPane(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleStartResize = (dividerIndex: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      dividerIndex,
      startX: e.clientX,
      startWidths: [...paneWidths],
    };
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (moveEvt: MouseEvent) => {
      if (!resizingRef.current || !containerRef.current) return;
      const totalWidth = containerRef.current.offsetWidth;
      if (totalWidth <= 0) return;

      const deltaX = moveEvt.clientX - resizingRef.current.startX;
      const deltaPercent = (deltaX / totalWidth) * 100;
      const { dividerIndex: dIdx, startWidths } = resizingRef.current;

      const newWidths = [...startWidths];
      const minW = 15; // Minimum 15% width per pane

      let wLeft = startWidths[dIdx] + deltaPercent;
      let wRight = startWidths[dIdx + 1] - deltaPercent;

      if (wLeft < minW) {
        wRight -= minW - wLeft;
        wLeft = minW;
      }
      if (wRight < minW) {
        wLeft -= minW - wRight;
        wRight = minW;
      }

      if (wLeft >= minW && wRight >= minW) {
        newWidths[dIdx] = Math.round(wLeft * 10) / 10;
        newWidths[dIdx + 1] = Math.round(wRight * 10) / 10;
        setPaneWidths(newWidths);
      }
    };

    const onMouseUp = () => {
      resizingRef.current = null;
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 50);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleResetWidths = () => {
    if (splitMode === 'split-3') {
      setPaneWidths([33.33, 33.33, 33.34]);
    } else {
      setPaneWidths([50, 50]);
    }
    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  };

  const handleClosePane = (paneIndex: number) => {
    if (onClosePane) {
      onClosePane(paneIndex);
      return;
    }
    if (splitMode === 'split-3') {
      // Transition from 3 to 2 panes
      onSetSplitMode('split-2');
    } else {
      // Transition from 2 to single
      onSetSplitMode('single');
    }
  };

  const getPaneTitle = (config: PaneConfig): { label: string; icon: React.ReactNode } => {
    if (config.viewType === 'local') {
      return {
        label: t('split.localFiles') || 'Локальные файлы',
        icon: <HardDrive className="w-3.5 h-3.5 text-emerald-400" />,
      };
    }

    const tab = tabs.find((t) => t.id === config.tabId && t.type === config.viewType) ||
      tabs.find((t) => t.type === config.viewType);

    if (config.viewType === 'terminal') {
      const name = tab?.title || (tab?.sessionId ? activeSessions.get(tab.sessionId)?.name : '') || 'Terminal';
      return {
        label: name,
        icon: <Terminal className="w-3.5 h-3.5 text-sky-400" />,
      };
    }

    if (config.viewType === 'sftp') {
      const name = tab?.title || (tab?.sessionId ? activeSessions.get(tab.sessionId)?.name : '') || 'SFTP';
      return {
        label: name,
        icon: <FolderTree className="w-3.5 h-3.5 text-amber-400" />,
      };
    }

    if (config.viewType === 'monitor') {
      const name = tab?.title || (tab?.sessionId ? activeSessions.get(tab.sessionId)?.name : '') || 'Monitor';
      return {
        label: name,
        icon: <Activity className="w-3.5 h-3.5 text-purple-400" />,
      };
    }

    if (config.viewType === 'editor') {
      return {
        label: tab?.title || 'Editor',
        icon: <Code className="w-3.5 h-3.5 text-blue-400" />,
      };
    }

    return {
      label: 'Pane',
      icon: <Server className="w-3.5 h-3.5 text-slate-400" />,
    };
  };

  const renderPaneContent = (config: PaneConfig, paneIndex: number) => {
    if (config.viewType === 'local') {
      return (
        <LocalFilesView
          isLight={isLight}
          folderClickMode={settings?.folderClickMode || 'double'}
          onOpenFileInEditor={(filePath, fileName) => {
            const firstSessionId = Array.from(activeSessions.keys())[0];
            if (firstSessionId) {
              onOpenFileInEditor(firstSessionId, filePath, fileName);
            }
          }}
        />
      );
    }

    // Find tab or fallback to first of matching type
    const tab = tabs.find((t) => t.id === config.tabId && t.type === config.viewType) ||
      tabs.find((t) => t.type === config.viewType);

    if (!tab || !tab.sessionId) {
      return (
        <div className={`flex-1 flex flex-col items-center justify-center p-6 text-center select-none ${
          isLight ? 'bg-slate-50 text-slate-600' : 'bg-[#181818] text-slate-400'
        }`}>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 ${
            isLight ? 'bg-slate-200 text-slate-500' : 'bg-white/5 text-slate-400'
          }`}>
            {config.viewType === 'terminal' ? <Terminal className="w-6 h-6" /> :
             config.viewType === 'sftp' ? <FolderTree className="w-6 h-6" /> :
             config.viewType === 'monitor' ? <Activity className="w-6 h-6" /> :
             <Server className="w-6 h-6" />}
          </div>
          <div className="font-semibold text-sm mb-1 text-slate-800 dark:text-slate-200">
            {t('split.noSession')}
          </div>
          <p className="text-xs text-slate-500 max-w-xs mb-4">
            {t('split.selectView')}
          </p>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onChangePane(paneIndex, { ...config, viewType: 'local' })}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white shadow transition-all flex items-center space-x-1.5"
            >
              <HardDrive className="w-3.5 h-3.5" />
              <span>{t('split.localFiles')}</span>
            </button>
            {onNewConnection && (
              <button
                onClick={() => onNewConnection(config.viewType as TabType)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center space-x-1.5 ${
                  isLight
                    ? 'border-slate-300 hover:bg-slate-200 text-slate-700'
                    : 'border-white/10 hover:bg-white/10 text-slate-300'
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('split.newConnection')}</span>
              </button>
            )}
          </div>
        </div>
      );
    }

    if (config.viewType === 'terminal') {
      return (
        <TerminalView
          sessionId={tab.sessionId}
          host={activeSessions.get(tab.sessionId) || hosts?.find((h) => h.id === tab.hostId)}
          isLight={isLight}
          isActive={true}
          snippets={snippets}
          onRunSnippet={onRunSnippet}
          onOpenSftp={(targetPath) => onOpenSftp(tab.sessionId!, targetPath)}
          onOpenMonitor={() => onOpenMonitor(tab.sessionId!)}
          onOpenFileInEditor={(filePath, fileName) => onOpenFileInEditor(tab.sessionId!, filePath, fileName)}
          onDuplicateSession={() => onDuplicateSession(tab.sessionId)}
          folderClickMode={settings?.folderClickMode || 'double'}
          onReconnectSession={onReconnectSession}
        />
      );
    }

    if (config.viewType === 'sftp') {
      return (
        <SftpView
          sessionId={tab.sessionId}
          isLight={isLight}
          folderClickMode={settings?.folderClickMode || 'double'}
          initialPath={tab.initialPath || activeSessions.get(tab.sessionId)?.defaultPath || '/'}
          onOpenFileInEditor={(filePath, fileName) => onOpenFileInEditor(tab.sessionId!, filePath, fileName)}
          onNavigateToTerminal={(folderPath, shouldSwitch) => onNavigateToTerminal(tab.sessionId!, folderPath, shouldSwitch)}
        />
      );
    }

    if (config.viewType === 'monitor') {
      return (
        <MonitorView
          sessionId={tab.sessionId}
          isLight={isLight}
          hostName={activeSessions.get(tab.sessionId)?.name}
        />
      );
    }

    if (config.viewType === 'editor' && tab.filePath) {
      return (
        <MonacoEditorView
          sessionId={tab.sessionId}
          filePath={tab.filePath}
          fileName={tab.title}
          isLight={isLight}
          onClose={() => onCloseTab(tab.id)}
        />
      );
    }

    return null;
  };

  const terminalTabs = tabs.filter((t) => t.type === 'terminal' && t.sessionId);
  const sftpTabs = tabs.filter((t) => t.type === 'sftp' && t.sessionId);
  const monitorTabs = tabs.filter((t) => t.type === 'monitor' && t.sessionId);
  const editorTabs = tabs.filter((t) => t.type === 'editor' && t.sessionId);

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex w-full h-full overflow-hidden relative ${
        isLight ? 'bg-[#f4f4f4]' : 'bg-[#181818]'
      }`}
    >
      {/* Resizing blocker overlay */}
      {isResizing && (
        <div className="absolute inset-0 z-50 cursor-col-resize select-none" />
      )}

      {Array.from({ length: paneCount }).map((_, idx) => {
        const config = panes[idx] || { id: `pane-${idx}`, viewType: idx === 0 ? 'terminal' : idx === 1 ? 'sftp' : 'local' };
        const isMaximized = maximizedPaneIndex === idx;
        const isHidden = maximizedPaneIndex !== null && !isMaximized;

        if (isHidden) return null;

        const currentTitle = getPaneTitle(config);
        const widthStyle = maximizedPaneIndex !== null ? '100%' : `${paneWidths[idx] || (100 / paneCount)}%`;

        return (
          <React.Fragment key={`${config.id || `pane-${idx}`}-${config.viewType}-${config.tabId || ''}`}>
            <div
              className="flex flex-col h-full overflow-hidden relative"
              style={{ width: widthStyle }}
            >
              {/* Modern Fluent Pane Header (Height 34px) */}
              <div
                className={`h-8.5 px-2.5 flex items-center justify-between text-xs shrink-0 select-none border-b ${
                  isLight
                    ? 'bg-[#eaeaea] border-[#d8d8d8] text-slate-800'
                    : 'bg-[#202020] border-[#2c2c2c] text-slate-200'
                }`}
              >
                {/* Left: View Switcher Dropdown */}
                <div className="relative">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenDropdownPane(openDropdownPane === idx ? null : idx);
                    }}
                    className={`h-6 px-2 rounded-md flex items-center space-x-1.5 font-medium transition-all ${
                      isLight
                        ? 'hover:bg-slate-300/70 text-slate-800'
                        : 'hover:bg-white/10 text-slate-200'
                    }`}
                    title={t('split.paneSwitcher')}
                  >
                    {currentTitle.icon}
                    <span className="font-mono text-[11px] truncate max-w-[140px] sm:max-w-[200px]">
                      {currentTitle.label}
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                  </button>

                  {/* Dropdown Menu */}
                  {openDropdownPane === idx && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute left-0 top-full mt-1 w-64 rounded-xl border shadow-2xl py-1.5 z-50 text-xs backdrop-blur-md max-h-96 overflow-y-auto ${
                        isLight
                          ? 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-400/40'
                          : 'bg-[#222222]/95 border-[#383838] text-slate-100 shadow-black/80'
                      }`}
                    >
                      {/* Local Files Option */}
                      <button
                        onClick={() => {
                          onChangePane(idx, { id: `pane-${idx}`, viewType: 'local' });
                          setOpenDropdownPane(null);
                        }}
                        className={`w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-emerald-500/10 transition-colors ${
                          config.viewType === 'local' ? 'text-emerald-500 font-semibold bg-emerald-500/10' : ''
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <HardDrive className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span className="truncate">{t('split.localFiles') || 'Локальные файлы'}</span>
                        </div>
                        {config.viewType === 'local' && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                      </button>

                      {/* Terminals Group */}
                      {terminalTabs.length > 0 && (
                        <>
                          <div className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            isLight ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            {t('split.terminals')}
                          </div>
                          {terminalTabs.map((tItem) => {
                            const isSelected = config.viewType === 'terminal' && config.tabId === tItem.id;
                            return (
                              <button
                                key={tItem.id}
                                onClick={() => {
                                  onChangePane(idx, { id: `pane-${idx}`, viewType: 'terminal', tabId: tItem.id });
                                  setOpenDropdownPane(null);
                                }}
                                className={`w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-sky-500/10 transition-colors ${
                                  isSelected ? 'text-sky-500 font-semibold bg-sky-500/10' : ''
                                }`}
                              >
                                <div className="flex items-center space-x-2 truncate">
                                  <Terminal className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                                  <span className="truncate font-mono text-[11px]">{tItem.title}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-sky-500" />}
                              </button>
                            );
                          })}
                        </>
                      )}

                      {/* SFTP Group */}
                      {sftpTabs.length > 0 && (
                        <>
                          <div className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            isLight ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            {t('split.sftp')}
                          </div>
                          {sftpTabs.map((tItem) => {
                            const isSelected = config.viewType === 'sftp' && config.tabId === tItem.id;
                            return (
                              <button
                                key={tItem.id}
                                onClick={() => {
                                  onChangePane(idx, { id: `pane-${idx}`, viewType: 'sftp', tabId: tItem.id });
                                  setOpenDropdownPane(null);
                                }}
                                className={`w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-amber-500/10 transition-colors ${
                                  isSelected ? 'text-amber-500 font-semibold bg-amber-500/10' : ''
                                }`}
                              >
                                <div className="flex items-center space-x-2 truncate">
                                  <FolderTree className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                  <span className="truncate font-mono text-[11px]">{tItem.title}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-amber-500" />}
                              </button>
                            );
                          })}
                        </>
                      )}

                      {/* Monitor Group */}
                      {monitorTabs.length > 0 && (
                        <>
                          <div className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            isLight ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            {t('split.monitors')}
                          </div>
                          {monitorTabs.map((tItem) => {
                            const isSelected = config.viewType === 'monitor' && config.tabId === tItem.id;
                            return (
                              <button
                                key={tItem.id}
                                onClick={() => {
                                  onChangePane(idx, { id: `pane-${idx}`, viewType: 'monitor', tabId: tItem.id });
                                  setOpenDropdownPane(null);
                                }}
                                className={`w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-purple-500/10 transition-colors ${
                                  isSelected ? 'text-purple-500 font-semibold bg-purple-500/10' : ''
                                }`}
                              >
                                <div className="flex items-center space-x-2 truncate">
                                  <Activity className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                                  <span className="truncate font-mono text-[11px]">{tItem.title}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-purple-500" />}
                              </button>
                            );
                          })}
                        </>
                      )}

                      {/* Editor Group */}
                      {editorTabs.length > 0 && (
                        <>
                          <div className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                            isLight ? 'text-slate-400' : 'text-slate-500'
                          }`}>
                            {t('split.editors')}
                          </div>
                          {editorTabs.map((tItem) => {
                            const isSelected = config.viewType === 'editor' && config.tabId === tItem.id;
                            return (
                              <button
                                key={tItem.id}
                                onClick={() => {
                                  onChangePane(idx, { id: `pane-${idx}`, viewType: 'editor', tabId: tItem.id });
                                  setOpenDropdownPane(null);
                                }}
                                className={`w-full px-3 py-1.5 flex items-center justify-between text-left hover:bg-blue-500/10 transition-colors ${
                                  isSelected ? 'text-blue-500 font-semibold bg-blue-500/10' : ''
                                }`}
                              >
                                <div className="flex items-center space-x-2 truncate">
                                  <Code className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                  <span className="truncate font-mono text-[11px]">{tItem.title}</span>
                                </div>
                                {isSelected && <Check className="w-3.5 h-3.5 text-blue-500" />}
                              </button>
                            );
                          })}
                        </>
                      )}

                      {/* New Connection Button */}
                      {onNewConnection && (
                        <div className="border-t border-slate-500/20 pt-1 mt-1">
                          <button
                            onClick={() => {
                              onNewConnection('terminal');
                              setOpenDropdownPane(null);
                            }}
                            className={`w-full px-3 py-1.5 flex items-center space-x-2 text-left transition-colors ${
                              isLight ? 'hover:bg-slate-100 text-slate-700' : 'hover:bg-white/10 text-slate-300'
                            }`}
                          >
                            <Plus className="w-3.5 h-3.5 text-sky-400" />
                            <span>{t('split.newConnection')}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right: Actions (Maximize / Close) */}
                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => {
                      setMaximizedPaneIndex(isMaximized ? null : idx);
                      setTimeout(() => {
                        window.dispatchEvent(new Event('resize'));
                      }, 50);
                    }}
                    className={`p-1 rounded transition-colors ${
                      isLight ? 'hover:bg-slate-300/70 text-slate-600' : 'hover:bg-white/10 text-slate-400'
                    }`}
                    title={isMaximized ? t('split.restore') : t('split.maximize')}
                  >
                    {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    onClick={() => handleClosePane(idx)}
                    className={`p-1 rounded transition-colors ${
                      isLight ? 'hover:bg-slate-300/70 text-slate-600' : 'hover:bg-white/10 text-slate-400'
                    }`}
                    title={t('split.close')}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Pane Body */}
              <div className="flex-1 overflow-hidden relative">
                {renderPaneContent(config, idx)}
              </div>
            </div>

            {/* Draggable Vertical Splitter Divider between panes */}
            {idx < paneCount - 1 && maximizedPaneIndex === null && (
              <div
                onMouseDown={(e) => handleStartResize(idx, e)}
                onDoubleClick={handleResetWidths}
                className={`w-1.5 relative cursor-col-resize shrink-0 group transition-colors select-none ${
                  isLight
                    ? 'bg-[#d8d8d8] hover:bg-sky-500 active:bg-sky-600'
                    : 'bg-[#2b2b2b] hover:bg-sky-500 active:bg-sky-600'
                }`}
                title="Double click to reset equal widths"
              >
                {/* Visual grab accent */}
                <div className="absolute inset-y-0 -left-1 -right-1 z-30" />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
});
