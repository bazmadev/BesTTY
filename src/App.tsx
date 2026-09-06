import React, { useState, useEffect } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { HostList } from './components/HostList';
import { HostModal } from './components/HostModal';
import { TerminalView } from './components/TerminalView';
import { SftpView } from './components/SftpView';
import { MonacoEditorView } from './components/MonacoEditorView';
import { MonitorView } from './components/MonitorView';
import { TunnelsView } from './components/TunnelsView';
import { SnippetsView } from './components/SnippetsView';
import { SettingsView } from './components/SettingsView';
import { VaultModal } from './components/VaultModal';
import { TabItem, TabType, HostProfile, Snippet, TunnelConfig, BesTTYSettings, VaultStatus } from './types';

export const App: React.FC = () => {
  // Navigation & Tabs State
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('hosts-view');
  const [currentView, setCurrentView] = useState<'hosts' | TabType>('hosts');

  // Vault & Data State
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>({ isConfigured: false, isUnlocked: true });
  const [isVaultModalOpen, setIsVaultModalOpen] = useState(false);
  const [hosts, setHosts] = useState<HostProfile[]>([]);
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [tunnels, setTunnels] = useState<TunnelConfig[]>([]);
  const [settings, setSettings] = useState<BesTTYSettings>({
    theme: 'fluent-dark',
    fontFamily: 'Cascadia Code, Consolas, monospace',
    fontSize: 14,
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 10000,
    confirmOnClose: true,
    sftpFollowTerminal: true,
    enableHardwareAcceleration: true,
  });

  // Host Management Modals
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostProfile | null>(null);

  // Active SSH Sessions cache: sessionId -> HostProfile
  const [activeSessions, setActiveSessions] = useState<Map<string, HostProfile>>(new Map());

  // Initial Load from Electron Vault
  const loadVaultData = async () => {
    if (!window.api?.vault) return;
    try {
      const status = await window.api.vault.getStatus();
      setVaultStatus(status);

      if (status.isUnlocked) {
        const [loadedHosts, loadedSnippets, loadedTunnels, loadedSettings] = await Promise.all([
          window.api.vault.getHosts(),
          window.api.vault.getSnippets(),
          window.api.vault.getTunnels(),
          window.api.vault.getSettings(),
        ]);
        setHosts(loadedHosts || []);
        setSnippets(loadedSnippets || []);
        setTunnels(loadedTunnels || []);
        if (loadedSettings) setSettings(loadedSettings);
      } else {
        setIsVaultModalOpen(true);
      }
    } catch (e) {
      console.error('Failed to load vault:', e);
    }
  };

  useEffect(() => {
    loadVaultData();
  }, []);

  // Connect to Host
  const handleConnect = async (host: HostProfile, initialTabType: TabType = 'terminal') => {
    const sessionId = crypto.randomUUID();

    try {
      // Connect backend SSH client
      await window.api.ssh.connect(sessionId, host, 100, 30);

      setActiveSessions((prev) => new Map(prev).set(sessionId, host));

      const newTab: TabItem = {
        id: `tab-${sessionId}-${initialTabType}`,
        type: initialTabType,
        title: `${host.name || host.host} (${initialTabType})`,
        hostId: host.id,
        sessionId,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newTab.id);
      setCurrentView(initialTabType);
    } catch (err: any) {
      alert(`SSH Connection Failed to ${host.host}: ${err.message}`);
    }
  };

  // Open Remote File in In-Place Monaco Editor
  const handleOpenFileInEditor = (sessionId: string, filePath: string, fileName: string) => {
    const editorTabId = `editor-${sessionId}-${filePath}`;
    const existing = tabs.find((t) => t.id === editorTabId);

    if (existing) {
      setActiveTabId(existing.id);
      setCurrentView('editor');
      return;
    }

    const newTab: TabItem = {
      id: editorTabId,
      type: 'editor',
      title: fileName,
      sessionId,
      filePath,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setCurrentView('editor');
  };

  // Open SFTP tab for existing session
  const handleOpenSftp = (sessionId: string) => {
    const sftpTabId = `sftp-${sessionId}`;
    const existing = tabs.find((t) => t.id === sftpTabId);

    if (existing) {
      setActiveTabId(existing.id);
      setCurrentView('sftp');
      return;
    }

    const sessionHost = activeSessions.get(sessionId);
    const newTab: TabItem = {
      id: sftpTabId,
      type: 'sftp',
      title: `${sessionHost?.name || 'Server'} (SFTP)`,
      sessionId,
      hostId: sessionHost?.id,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setCurrentView('sftp');
  };

  // Open Monitor tab for existing session
  const handleOpenMonitor = (sessionId: string) => {
    const monTabId = `monitor-${sessionId}`;
    const existing = tabs.find((t) => t.id === monTabId);

    if (existing) {
      setActiveTabId(existing.id);
      setCurrentView('monitor');
      return;
    }

    const sessionHost = activeSessions.get(sessionId);
    const newTab: TabItem = {
      id: monTabId,
      type: 'monitor',
      title: `${sessionHost?.name || 'Server'} (Stats)`,
      sessionId,
      hostId: sessionHost?.id,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setCurrentView('monitor');
  };

  // Close Tab
  const handleCloseTab = (tabId: string) => {
    const tabToClose = tabs.find((t) => t.id === tabId);
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);

    if (tabToClose?.sessionId && tabToClose.type === 'terminal') {
      // Check if other tabs use this session
      const hasOtherTabsWithSession = nextTabs.some((t) => t.sessionId === tabToClose.sessionId);
      if (!hasOtherTabsWithSession) {
        window.api?.ssh.disconnect(tabToClose.sessionId);
        setActiveSessions((prev) => {
          const next = new Map(prev);
          next.delete(tabToClose.sessionId!);
          return next;
        });
      }
    }

    if (activeTabId === tabId) {
      if (nextTabs.length > 0) {
        const last = nextTabs[nextTabs.length - 1];
        setActiveTabId(last.id);
        setCurrentView(last.type);
      } else {
        setActiveTabId('hosts-view');
        setCurrentView('hosts');
      }
    }
  };

  // Run Snippet in active terminal
  const handleRunSnippet = (cmd: string) => {
    const activeTab = tabs.find((t) => t.id === activeTabId && t.type === 'terminal');
    const targetSessionId = activeTab?.sessionId || tabs.find((t) => t.type === 'terminal')?.sessionId;

    if (targetSessionId) {
      window.api?.ssh.write(targetSessionId, cmd + '\n');
    } else {
      alert('Please connect to an SSH terminal first to execute this command.');
    }
  };

  // Host CRUD
  const handleSaveHost = async (host: HostProfile) => {
    await window.api.vault.saveHost(host);
    setHosts(await window.api.vault.getHosts());
  };

  const handleDeleteHost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this host profile?')) return;
    await window.api.vault.deleteHost(id);
    setHosts(await window.api.vault.getHosts());
  };

  // Vault Lock Toggle
  const handleToggleVault = async () => {
    if (vaultStatus.isUnlocked) {
      await window.api.vault.lock();
      setVaultStatus({ ...vaultStatus, isUnlocked: false });
      setHosts([]);
    } else {
      setIsVaultModalOpen(true);
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex flex-col h-screen w-screen bg-[#181818] overflow-hidden">
      {/* Titlebar with tabs and Windows 11 controls */}
      <TitleBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={(id) => {
          setActiveTabId(id);
          const t = tabs.find((item) => item.id === id);
          if (t) setCurrentView(t.type);
        }}
        onCloseTab={handleCloseTab}
        onNewTab={() => {
          setCurrentView('hosts');
          setActiveTabId('hosts-view');
        }}
      />

      {/* Main App Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          onSelectView={(view) => {
            setCurrentView(view);
            if (view !== 'hosts') {
              const matchingTab = tabs.find((t) => t.type === view);
              if (matchingTab) setActiveTabId(matchingTab.id);
            } else {
              setActiveTabId('hosts-view');
            }
          }}
          vaultStatus={vaultStatus}
          onToggleVault={handleToggleVault}
          connectedSessionCount={activeSessions.size}
        />

        {/* Dynamic Center Stage */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Hosts Management View */}
          {currentView === 'hosts' && (
            <HostList
              hosts={hosts}
              onConnect={handleConnect}
              onEdit={(h) => {
                setEditingHost(h);
                setIsHostModalOpen(true);
              }}
              onDelete={handleDeleteHost}
              onNewHost={() => {
                setEditingHost(null);
                setIsHostModalOpen(true);
              }}
            />
          )}

          {/* Active Terminal Tab View */}
          {currentView === 'terminal' && activeTab && activeTab.sessionId && (
            <TerminalView
              sessionId={activeTab.sessionId}
              host={activeSessions.get(activeTab.sessionId)}
              onOpenSftp={() => handleOpenSftp(activeTab.sessionId!)}
              onOpenMonitor={() => handleOpenMonitor(activeTab.sessionId!)}
            />
          )}

          {/* Active SFTP Tab View */}
          {currentView === 'sftp' && activeTab && activeTab.sessionId && (
            <SftpView
              sessionId={activeTab.sessionId}
              initialPath={activeSessions.get(activeTab.sessionId)?.defaultPath || '/'}
              onOpenFileInEditor={(filePath, fileName) =>
                handleOpenFileInEditor(activeTab.sessionId!, filePath, fileName)
              }
            />
          )}

          {/* Active Monaco Editor Tab View */}
          {currentView === 'editor' && activeTab && activeTab.sessionId && activeTab.filePath && (
            <MonacoEditorView
              sessionId={activeTab.sessionId}
              filePath={activeTab.filePath}
              fileName={activeTab.title}
              onClose={() => handleCloseTab(activeTab.id)}
              onModifiedChange={(isMod) => {
                setTabs((prev) =>
                  prev.map((t) => (t.id === activeTab.id ? { ...t, isModified: isMod } : t))
                );
              }}
            />
          )}

          {/* Active Monitor Tab View */}
          {currentView === 'monitor' && activeTab && activeTab.sessionId && (
            <MonitorView
              sessionId={activeTab.sessionId}
              hostName={activeSessions.get(activeTab.sessionId)?.name}
            />
          )}

          {/* Tunnels View */}
          {currentView === 'tunnels' && (
            <TunnelsView
              tunnels={tunnels}
              hosts={hosts}
              onSaveTunnel={async (tunnel) => {
                await window.api.vault.saveTunnel(tunnel);
                setTunnels(await window.api.vault.getTunnels());
              }}
              onDeleteTunnel={async (id) => {
                await window.api.vault.deleteTunnel(id);
                setTunnels(await window.api.vault.getTunnels());
              }}
            />
          )}

          {/* Settings View */}
          {currentView === 'settings' && (
            <SettingsView
              settings={settings}
              onSaveSettings={async (newSettings) => {
                await window.api.vault.saveSettings(newSettings);
                setSettings(await window.api.vault.getSettings());
              }}
              onSetupVault={() => setIsVaultModalOpen(true)}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <HostModal
        isOpen={isHostModalOpen}
        onClose={() => setIsHostModalOpen(false)}
        onSave={handleSaveHost}
        hostToEdit={editingHost}
        availableHosts={hosts}
      />

      <VaultModal
        isOpen={isVaultModalOpen}
        onClose={() => setIsVaultModalOpen(false)}
        vaultStatus={vaultStatus}
        onUnlockSuccess={loadVaultData}
      />
    </div>
  );
};

export default App;
