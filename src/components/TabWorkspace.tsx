import React from 'react';
import { 
  TabItem, HostProfile, BesTTYSettings, Snippet, 
  SplitLayoutMode, PaneConfig, PaneViewType, TabType 
} from '../types';
import { TerminalView } from './TerminalView';
import { SftpView } from './SftpView';
import { MonacoEditorView } from './MonacoEditorView';
import { MonitorView } from './MonitorView';
import { SplitContainer } from './SplitContainer';

export interface TabWorkspaceProps {
  tab: TabItem;
  isTabActive: boolean;
  tabs: TabItem[];
  activeSessions: Map<string, HostProfile>;
  hosts: HostProfile[];
  isLight: boolean;
  settings: BesTTYSettings;
  snippets: Snippet[];
  onRunSnippet: (cmd: string) => void;
  onOpenSftp: (sessionId: string, targetPath?: string) => void;
  onOpenMonitor: (sessionId: string) => void;
  onOpenFileInEditor: (sessionId: string, filePath: string, fileName: string) => void;
  onDuplicateSession: (sessionId?: string) => void;
  onNavigateToTerminal: (sessionId: string, folderPath: string, shouldSwitchTab?: boolean) => void;
  onCloseTab: (tabId: string) => void;
  onNewConnection?: (type: TabType) => void;
  onReconnectSession?: (sessionId: string, host: HostProfile) => Promise<void>;
  onChangePane: (paneIndex: number, newConfig: PaneConfig, tabId: string) => void;
  onSetSplitMode: (mode: SplitLayoutMode, tabIdTarget?: string) => void;
  onRemovePane: (paneIndex: number, tabId: string) => void;
  onTabModifiedChange: (tabId: string, isModified: boolean) => void;
}

export const TabWorkspace: React.FC<TabWorkspaceProps> = React.memo(({
  tab,
  isTabActive,
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
  onChangePane,
  onSetSplitMode,
  onRemovePane,
  onTabModifiedChange,
}) => {
  const isSplit = Boolean(tab.splitMode && tab.splitMode !== 'single');
  const sessionHost = tab.sessionId
    ? activeSessions.get(tab.sessionId) || hosts.find((h) => h.id === tab.hostId)
    : undefined;

  return (
    <div
      className="w-full h-full"
      style={{ display: isTabActive ? 'flex' : 'none' }}
    >
      {isSplit ? (
        <SplitContainer
          key={`split-${tab.id}`}
          splitMode={tab.splitMode!}
          panes={
            tab.panes || [
              { id: 'pane-0', viewType: tab.type as PaneViewType, tabId: tab.id },
              { id: 'pane-1', viewType: 'sftp' },
              { id: 'pane-2', viewType: 'local' },
            ]
          }
          onChangePane={(idx, cfg) => onChangePane(idx, cfg, tab.id)}
          onSetSplitMode={(mode) => onSetSplitMode(mode, tab.id)}
          onClosePane={(idx) => onRemovePane(idx, tab.id)}
          tabs={tabs}
          activeSessions={activeSessions}
          hosts={hosts}
          isLight={isLight}
          settings={settings}
          snippets={snippets}
          onRunSnippet={onRunSnippet}
          onOpenSftp={onOpenSftp}
          onOpenMonitor={onOpenMonitor}
          onOpenFileInEditor={onOpenFileInEditor}
          onDuplicateSession={onDuplicateSession}
          onNavigateToTerminal={onNavigateToTerminal}
          onCloseTab={onCloseTab}
          onNewConnection={onNewConnection}
          onReconnectSession={onReconnectSession}
        />
      ) : tab.type === 'terminal' && tab.sessionId ? (
        <TerminalView
          sessionId={tab.sessionId}
          host={sessionHost}
          isLight={isLight}
          isActive={isTabActive}
          snippets={snippets}
          onRunSnippet={onRunSnippet}
          onOpenSftp={(targetPath) => onOpenSftp(tab.sessionId!, targetPath)}
          onOpenMonitor={() => onOpenMonitor(tab.sessionId!)}
          onOpenFileInEditor={(filePath, fileName) =>
            onOpenFileInEditor(tab.sessionId!, filePath, fileName)
          }
          onDuplicateSession={() => onDuplicateSession(tab.sessionId)}
          folderClickMode={settings.folderClickMode || 'double'}
          onReconnectSession={onReconnectSession}
        />
      ) : tab.type === 'sftp' && tab.sessionId ? (
        <SftpView
          sessionId={tab.sessionId}
          isLight={isLight}
          folderClickMode={settings.folderClickMode || 'double'}
          initialPath={tab.initialPath || sessionHost?.defaultPath || '/'}
          onOpenFileInEditor={(filePath, fileName) =>
            onOpenFileInEditor(tab.sessionId!, filePath, fileName)
          }
          onNavigateToTerminal={(folderPath, shouldSwitch) =>
            onNavigateToTerminal(tab.sessionId!, folderPath, shouldSwitch)
          }
        />
      ) : tab.type === 'editor' && tab.sessionId && tab.filePath ? (
        <MonacoEditorView
          sessionId={tab.sessionId}
          filePath={tab.filePath}
          fileName={tab.title}
          isLight={isLight}
          onClose={() => onCloseTab(tab.id)}
          onModifiedChange={(isMod) => onTabModifiedChange(tab.id, isMod)}
        />
      ) : tab.type === 'monitor' && tab.sessionId ? (
        <MonitorView
          sessionId={tab.sessionId}
          isLight={isLight}
          hostName={sessionHost?.name}
        />
      ) : null}
    </div>
  );
});
