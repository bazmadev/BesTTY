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
import { PasswordPromptModal, AuthPromptResult } from './components/PasswordPromptModal';
import { HelpModal } from './components/HelpModal';
import { TabItem, TabType, HostProfile, Snippet, TunnelConfig, BesTTYSettings, VaultStatus } from './types';
import { I18nProvider, useTranslation } from './i18n';

const MainApp: React.FC = () => {
  const { locale } = useTranslation();

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
    locale: 'ru',
    theme: 'system',
    fontFamily: 'Cascadia Code, Consolas, monospace',
    fontSize: 14,
    cursorStyle: 'block',
    cursorBlink: true,
    scrollback: 10000,
    confirmOnClose: true,
    sftpFollowTerminal: true,
    enableHardwareAcceleration: true,
  });

  // Windows System Theme Detection
  const [systemDark, setSystemDark] = useState<boolean>(
    window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const isLight =
    settings.theme === 'system' ? !systemDark : settings.theme === 'fluent-light';

  useEffect(() => {
    if (isLight) {
      document.documentElement.classList.add('light');
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
    }
  }, [isLight]);

  // Modals State
  const [isHostModalOpen, setIsHostModalOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [editingHost, setEditingHost] = useState<HostProfile | null>(null);

  // Quick Password / Auth Prompt State
  const [pendingPromptHost, setPendingPromptHost] = useState<HostProfile | null>(null);
  const [isPasswordPromptOpen, setIsPasswordPromptOpen] = useState(false);
  const [pendingInitialTab, setPendingInitialTab] = useState<TabType>('terminal');

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
    // If auth credentials not provided, prompt user with full multi-method prompt
    if (
      host.authType !== 'agent' &&
      !host.password &&
      !host.privateKeyPath &&
      !host.privateKeyContent
    ) {
      setPendingPromptHost(host);
      setPendingInitialTab(initialTabType);
      setIsPasswordPromptOpen(true);
      return;
    }

    await executeConnection(host, initialTabType);
  };

  const executeConnection = async (host: HostProfile, initialTabType: TabType = 'terminal') => {
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

  const handlePasswordPromptSubmit = async (result: AuthPromptResult, remember: boolean) => {
    if (!pendingPromptHost) return;

    const hostWithCredentials: HostProfile = {
      ...pendingPromptHost,
      authType: result.authType,
      password: result.authType === 'password' ? result.password : undefined,
      privateKeyPath: result.authType === 'privateKey' ? result.privateKeyPath : undefined,
      passphrase: result.authType === 'privateKey' ? result.passphrase : undefined,
    };

    if (remember) {
      await handleSaveHost(hostWithCredentials);
    }

    setIsPasswordPromptOpen(false);
    await executeConnection(hostWithCredentials, pendingInitialTab);
    setPendingPromptHost(null);
  };

  // SmarTTY Duplicate Tab Feature (⚡ Lightning button)
  const handleDuplicateSession = (targetSessionId?: string) => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const sid = targetSessionId || activeTab?.sessionId;
    if (!sid) return;

    const host = activeSessions.get(sid);
    if (host) {
      executeConnection(host, 'terminal');
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
  const canDuplicate = Boolean(activeTab?.sessionId && activeSessions.has(activeTab.sessionId));

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden ${
      isLight ? 'bg-[#f3f3f3] text-slate-800' : 'bg-[#181818] text-slate-100'
    }`}>
      {/* Titlebar with tabs and Windows 11 controls */}
      <TitleBar
        tabs={tabs}
        activeTabId={activeTabId}
        isLight={isLight}
        canDuplicate={canDuplicate}
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
        onDuplicateTab={() => handleDuplicateSession()}
        onOpenHelp={() => setIsHelpModalOpen(true)}
      />

      {/* Main App Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          isLight={isLight}
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
              isLight={isLight}
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

          {/* Persistent Terminal Views Container (Keeps DOM alive across tab switches!) */}
          {tabs
            .filter((t) => t.type === 'terminal' && t.sessionId)
            .map((tab) => {
              const isTabActive = currentView === 'terminal' && activeTabId === tab.id;
              return (
                <div
                  key={tab.sessionId}
                  className="w-full h-full"
                  style={{ display: isTabActive ? 'flex' : 'none' }}
                >
                  <TerminalView
                    sessionId={tab.sessionId!}
                    host={activeSessions.get(tab.sessionId!)}
                    isLight={isLight}
                    isActive={isTabActive}
                    onOpenSftp={() => handleOpenSftp(tab.sessionId!)}
                    onOpenMonitor={() => handleOpenMonitor(tab.sessionId!)}
                    onOpenFileInEditor={(filePath, fileName) =>
                      handleOpenFileInEditor(tab.sessionId!, filePath, fileName)
                    }
                    onDuplicateSession={() => handleDuplicateSession(tab.sessionId)}
                  />
                </div>
              );
            })}

          {/* Active SFTP Tab View */}
          {currentView === 'sftp' && activeTab && activeTab.sessionId && (
            <SftpView
              sessionId={activeTab.sessionId}
              isLight={isLight}
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
              isLight={isLight}
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
              isLight={isLight}
              hostName={activeSessions.get(activeTab.sessionId)?.name}
            />
          )}

          {/* Tunnels View */}
          {currentView === 'tunnels' && (
            <TunnelsView
              tunnels={tunnels}
              hosts={hosts}
              isLight={isLight}
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

          {/* Snippets View */}
          {currentView === 'editor' && !activeTab?.filePath && (
            <SnippetsView
              snippets={snippets}
              isLight={isLight}
              onRunSnippet={handleRunSnippet}
              onSaveSnippet={async (snippet) => {
                await window.api.vault.saveSnippet(snippet);
                setSnippets(await window.api.vault.getSnippets());
              }}
              onDeleteSnippet={async (id) => {
                await window.api.vault.deleteSnippet(id);
                setSnippets(await window.api.vault.getSnippets());
              }}
              hasActiveSession={activeSessions.size > 0}
            />
          )}

          {/* Settings View */}
          {currentView === 'settings' && (
            <SettingsView
              settings={settings}
              isLight={isLight}
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
        isLight={isLight}
        onClose={() => setIsHostModalOpen(false)}
        onSave={handleSaveHost}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        hostToEdit={editingHost}
        availableHosts={hosts}
      />

      <VaultModal
        isOpen={isVaultModalOpen}
        isLight={isLight}
        onClose={() => setIsVaultModalOpen(false)}
        vaultStatus={vaultStatus}
        onUnlockSuccess={loadVaultData}
      />

      <PasswordPromptModal
        isOpen={isPasswordPromptOpen}
        isLight={isLight}
        host={pendingPromptHost}
        onClose={() => {
          setIsPasswordPromptOpen(false);
          setPendingPromptHost(null);
        }}
        onSubmit={handlePasswordPromptSubmit}
      />

      <HelpModal
        isOpen={isHelpModalOpen}
        isLight={isLight}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <I18nProvider initialLocale="ru">
      <MainApp />
    </I18nProvider>
  );
};

export default App;
