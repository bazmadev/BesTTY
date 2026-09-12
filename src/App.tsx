import React, { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { TitleBar } from './components/TitleBar';
import { Sidebar } from './components/Sidebar';
import { HostList } from './components/HostList';
import { TabWorkspace } from './components/TabWorkspace';
import { EmptyStateView } from './components/EmptyStateView';
import type { AuthPromptResult } from './components/PasswordPromptModal';

// Code-split heavyweight views and modals via React.lazy
const MonacoEditorView = React.lazy(() => import('./components/MonacoEditorView').then(m => ({ default: m.MonacoEditorView })));
const MonitorView = React.lazy(() => import('./components/MonitorView').then(m => ({ default: m.MonitorView })));
const TunnelsView = React.lazy(() => import('./components/TunnelsView').then(m => ({ default: m.TunnelsView })));
const SnippetsView = React.lazy(() => import('./components/SnippetsView').then(m => ({ default: m.SnippetsView })));
const SettingsView = React.lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })));
const LocalFilesView = React.lazy(() => import('./components/LocalFilesView').then(m => ({ default: m.LocalFilesView })));
const HostModal = React.lazy(() => import('./components/HostModal').then(m => ({ default: m.HostModal })));
const VaultModal = React.lazy(() => import('./components/VaultModal').then(m => ({ default: m.VaultModal })));
const PasswordPromptModal = React.lazy(() => import('./components/PasswordPromptModal').then(m => ({ default: m.PasswordPromptModal })));
const HelpModal = React.lazy(() => import('./components/HelpModal').then(m => ({ default: m.HelpModal })));
const AboutModal = React.lazy(() => import('./components/AboutModal').then(m => ({ default: m.AboutModal })));
const ConnectHostModal = React.lazy(() => import('./components/ConnectHostModal').then(m => ({ default: m.ConnectHostModal })));

import { 
  TabItem, TabType, HostProfile, Snippet, TunnelConfig, 
  BesTTYSettings, VaultStatus, UpdateState, SplitLayoutMode, PaneConfig, PaneViewType 
} from './types';
import { I18nProvider, useTranslation } from './i18n';
import { parseSSHConnectionString } from './utils/sshParser';
import { sanitizeRemotePath, formatCdCommand } from './utils/pathUtils';
import { ShieldCheck, Lock, Radio, AlertCircle } from 'lucide-react';
import { TransferProgressDrawer } from './components/TransferProgressDrawer';
import appLogo from './assets/logo.png';

const MainApp: React.FC = () => {
  const { t, locale } = useTranslation();

  // Navigation & Tabs State
  const [tabs, setTabs] = useState<TabItem[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('hosts-view');
  const [currentView, setCurrentView] = useState<'hosts' | TabType>('hosts');
  const [connectModalType, setConnectModalType] = useState<'terminal' | 'sftp' | 'monitor' | null>(null);
  const [connectingHostInfo, setConnectingHostInfo] = useState<{ hostId: string; type: TabType } | null>(null);

  // Track the most recent active tab for each view type
  const lastActiveTabByType = useRef<Record<string, string>>({});

  useEffect(() => {
    const currentTab = tabs.find((t) => t.id === activeTabId);
    if (currentTab) {
      lastActiveTabByType.current[currentTab.type] = currentTab.id;
    }
  }, [activeTabId, tabs]);

  // About Modal State
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [aboutModalTab, setAboutModalTab] = useState<'mission' | 'updates' | 'donate'>('mission');

  const handleOpenAbout = (tab: 'mission' | 'updates' | 'donate' = 'mission') => {
    setAboutModalTab(tab);
    setIsAboutModalOpen(true);
  };

  // Vault & Data State
  const [vaultStatus, setVaultStatus] = useState<VaultStatus>({
    isConfigured: true,
    isUnlocked: true,
    protectionMode: 'system',
    biometricsAvailable: false,
    biometricsEnabled: false,
  });
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
    folderClickMode: 'double',
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
  const lastKnownSessionHostsRef = useRef<Map<string, HostProfile>>(new Map());
  const connectingHostIdsRef = useRef<Set<string>>(new Set());

  // Listen for SSH session closed events from backend
  useEffect(() => {
    if (!window.api?.ssh?.onClosed) return;
    const unsubscribe = window.api.ssh.onClosed(({ sessionId }: { sessionId: string }) => {
      setActiveSessions((prev) => {
        if (!prev.has(sessionId)) return prev;
        const next = new Map(prev);
        next.delete(sessionId);
        return next;
      });
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  const handleToggleTheme = async () => {
    const nextTheme = isLight ? 'fluent-dark' : 'fluent-light';
    const updated: BesTTYSettings = { ...settings, theme: nextTheme };
    setSettings(updated);
    if (window.api?.vault) {
      await window.api.vault.saveSettings(updated);
    }
  };

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

  // OTA Updater State
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
    currentVersion: '1.0.0',
  });

  useEffect(() => {
    if (!window.api?.updater) return;
    window.api.updater.getStatus().then(setUpdateState);
    const unsubscribe = window.api.updater.onStatus((st) => setUpdateState(st));
    return () => unsubscribe();
  }, []);

  // Connect to Host
  const handleConnect = async (host: HostProfile, initialTabType: TabType = 'terminal') => {
    // Prevent duplicate triggers (e.g. rapid double clicking)
    if (host.id && connectingHostIdsRef.current.has(host.id)) {
      return;
    }

    // If specialized tab (SFTP/Monitor) is requested and we already have an active session for this host, reuse it!
    if (initialTabType !== 'terminal' && host.id) {
      for (const [sId, sHost] of activeSessions.entries()) {
        if (sHost.id === host.id) {
          if (initialTabType === 'sftp') {
            handleOpenSftp(sId);
            return;
          }
          if (initialTabType === 'monitor') {
            handleOpenMonitor(sId);
            return;
          }
        }
      }
    }

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
    if (host.id && connectingHostIdsRef.current.has(host.id)) {
      return;
    }
    if (host.id) {
      connectingHostIdsRef.current.add(host.id);
      setConnectingHostInfo({ hostId: host.id, type: initialTabType });
    }

    const sessionId = crypto.randomUUID();

    try {
      // Dynamically calculate initial PTY geometry from window size to prevent readline wrap desync
      const initialCols = Math.max(80, Math.floor((window.innerWidth - 60) / 9));
      const initialRows = Math.max(24, Math.floor((window.innerHeight - 70) / 18));
      await window.api.ssh.connect(sessionId, host, initialCols, initialRows);

      lastKnownSessionHostsRef.current.set(sessionId, host);
      setActiveSessions((prev) => new Map(prev).set(sessionId, host));

      if (initialTabType === 'terminal') {
        const terminalTab: TabItem = {
          id: `tab-${sessionId}-terminal`,
          type: 'terminal',
          title: `${host.name || host.host} (Terminal)`,
          hostId: host.id,
          sessionId,
        };
        setTabs((prev) => [...prev, terminalTab]);
        setActiveTabId(terminalTab.id);
        setCurrentView('terminal');
      } else {
        const specializedTab: TabItem = {
          id: `tab-${sessionId}-${initialTabType}`,
          type: initialTabType,
          title: `${host.name || host.host} (${initialTabType.toUpperCase()})`,
          hostId: host.id,
          sessionId,
        };
        // ONLY open the specialized tab - no unrequested duplicate terminal tab
        setTabs((prev) => [...prev, specializedTab]);
        setActiveTabId(specializedTab.id);
        setCurrentView(initialTabType);
      }
    } catch (err: any) {
      alert(`SSH Connection Failed to ${host.host}: ${err.message}`);
    } finally {
      if (host.id) {
        setTimeout(() => {
          connectingHostIdsRef.current.delete(host.id);
        }, 600);
      }
      setConnectingHostInfo(null);
    }
  };

  const handleQuickConnect = (rawCommand: string, initialTab: TabType = 'terminal') => {
    const parsed = parseSSHConnectionString(rawCommand);
    if (!parsed.host) return;

    const tempHost: HostProfile = {
      id: crypto.randomUUID(),
      name: `Quick: ${parsed.username}@${parsed.host}`,
      host: parsed.host,
      port: parsed.port,
      username: parsed.username,
      authType: parsed.privateKeyPath ? 'privateKey' : 'password',
      privateKeyPath: parsed.privateKeyPath,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    handleConnect(tempHost, initialTab);
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

  // Duplicate Tab Feature (⚡ Lightning button)
  const handleDuplicateSession = useCallback((targetSessionId?: string) => {
    const activeTab = tabs.find((t) => t.id === activeTabId);
    const sid = targetSessionId || activeTab?.sessionId;
    if (!sid) return;

    const host = activeSessions.get(sid);
    if (host) {
      executeConnection(host, 'terminal');
    }
  }, [tabs, activeTabId, activeSessions]);

  // Reconnect SSH Session
  const handleReconnectSession = useCallback(async (sessionId: string, host?: HostProfile) => {
    const targetHost = host || lastKnownSessionHostsRef.current.get(sessionId) || hosts.find((h) => {
      const tab = tabs.find((t) => t.sessionId === sessionId);
      return h.id === tab?.hostId;
    });
    if (!targetHost) {
      throw new Error('Host profile not found for session');
    }

    const isAlreadyConnected = await window.api?.ssh?.isConnected?.(sessionId).catch(() => false);
    if (!isAlreadyConnected) {
      const initialCols = Math.max(80, Math.floor((window.innerWidth - 60) / 9));
      const initialRows = Math.max(24, Math.floor((window.innerHeight - 70) / 18));
      await window.api.ssh.connect(sessionId, targetHost, initialCols, initialRows);
    }
    lastKnownSessionHostsRef.current.set(sessionId, targetHost);
    setActiveSessions((prev) => new Map(prev).set(sessionId, targetHost));
  }, [hosts, tabs]);

  // Open Remote File in In-Place Monaco Editor
  const handleOpenFileInEditor = useCallback((sessionId: string, filePath: string, fileName: string) => {
    const editorTabId = `editor-${sessionId}-${filePath}`;
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === editorTabId);
      if (existing) {
        setActiveTabId(existing.id);
        setCurrentView('editor');
        return prev;
      }

      const newTab: TabItem = {
        id: editorTabId,
        type: 'editor',
        title: fileName,
        sessionId,
        filePath,
      };

      setActiveTabId(newTab.id);
      setCurrentView('editor');
      return [...prev, newTab];
    });
  }, []);

  // Open SFTP tab for existing session
  const handleOpenSftp = useCallback((sessionId: string, targetPath?: string) => {
    const sftpTabId = `sftp-${sessionId}`;
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === sftpTabId);
      if (existing) {
        setActiveTabId(existing.id);
        setCurrentView('sftp');
        if (targetPath) {
          return prev.map((t) => (t.id === existing.id ? { ...t, initialPath: targetPath } : t));
        }
        return prev;
      }

      const sessionHost = activeSessions.get(sessionId);
      const newTab: TabItem = {
        id: sftpTabId,
        type: 'sftp',
        title: `${sessionHost?.name || 'Server'} (SFTP)`,
        sessionId,
        hostId: sessionHost?.id,
        initialPath: targetPath,
      };

      setActiveTabId(newTab.id);
      setCurrentView('sftp');
      return [...prev, newTab];
    });
  }, [activeSessions]);

  // Open Monitor tab for existing session
  const handleOpenMonitor = useCallback((sessionId: string) => {
    const monTabId = `monitor-${sessionId}`;
    setTabs((prev) => {
      const existing = prev.find((t) => t.id === monTabId);
      if (existing) {
        setActiveTabId(existing.id);
        setCurrentView('monitor');
        return prev;
      }

      const sessionHost = activeSessions.get(sessionId);
      const newTab: TabItem = {
        id: monTabId,
        type: 'monitor',
        title: `${sessionHost?.name || 'Server'} (Stats)`,
        sessionId,
        hostId: sessionHost?.id,
      };

      setActiveTabId(newTab.id);
      setCurrentView('monitor');
      return [...prev, newTab];
    });
  }, [activeSessions]);

  // Close Tab
  const handleCloseTab = useCallback((tabId: string) => {
    const tabToClose = tabs.find((t) => t.id === tabId);
    const nextTabs = tabs.filter((t) => t.id !== tabId);
    setTabs(nextTabs);

    if (tabToClose?.sessionId) {
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
  }, [tabs, activeTabId]);

  // Run Snippet in active terminal
  const handleRunSnippet = useCallback((cmd: string) => {
    const activeTab = tabs.find((t) => t.id === activeTabId && t.type === 'terminal');
    const targetSessionId = activeTab?.sessionId || tabs.find((t) => t.type === 'terminal')?.sessionId;

    if (targetSessionId) {
      window.api?.ssh.write(targetSessionId, cmd + '\n');
    } else {
      alert('Please connect to an SSH terminal first to execute this command.');
    }
  }, [tabs, activeTabId]);

  // Host CRUD
  const handleSaveHost = async (host: HostProfile) => {
    if (!vaultStatus.isUnlocked) {
      setIsVaultModalOpen(true);
      return;
    }
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
      if (vaultStatus.protectionMode === 'system' && !vaultStatus.biometricsEnabled) {
        // In DPAPI mode without biometrics/master password, locking cannot be guarded against current session.
        // Direct the user to configure security (Master Password or Biometrics)
        setIsVaultModalOpen(true);
        return;
      }
      await window.api.vault.lock();
      setVaultStatus({ ...vaultStatus, isUnlocked: false });
      setHosts([]);
    } else {
      if (vaultStatus.protectionMode === 'system') {
        if (vaultStatus.biometricsAvailable && vaultStatus.biometricsEnabled) {
          const ok = await window.api.vault.unlockWithBiometrics();
          if (ok) {
            await loadVaultData();
            return;
          }
        }
      }
      setIsVaultModalOpen(true);
    }
  };

  const activeTab = tabs.find((t) => t.id === activeTabId);
  const canDuplicate = Boolean(activeTab?.sessionId && activeSessions.has(activeTab.sessionId));
  const activeSplitMode: SplitLayoutMode = activeTab?.splitMode || 'single';
  const activePanes: PaneConfig[] = activeTab?.panes || [
    { id: 'pane-0', viewType: (activeTab?.type as PaneViewType) || 'terminal', tabId: activeTab?.id },
    { id: 'pane-1', viewType: 'sftp' },
    { id: 'pane-2', viewType: 'local' },
  ];

  const handleSelectTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    const selectedTab = tabs.find((t) => t.id === tabId);
    if (selectedTab) {
      setCurrentView(selectedTab.type);
      lastActiveTabByType.current[selectedTab.type] = tabId;
      if (selectedTab.originalType) {
        lastActiveTabByType.current[selectedTab.originalType] = tabId;
      }
    }
  }, [tabs]);

  // Per-Tab Split Layout Operations
  const handleSetSplitMode = useCallback((mode: SplitLayoutMode, tabIdTarget?: string) => {
    const targetTab = (tabIdTarget ? tabs.find((t) => t.id === tabIdTarget) : null) || activeTab;
    if (!targetTab) return;

    if (mode === 'single') {
      // Disabling split: collapse right-to-left!
      // In mono, the leftmost pane (pane 0) becomes the mono tab.
      const leftPane = targetTab.panes?.[0];
      const targetType = (leftPane?.viewType as TabType) || targetTab.type;
      const linkedTab = leftPane?.tabId ? tabs.find((t) => t.id === leftPane.tabId) : undefined;
      const targetSessionId = linkedTab?.sessionId || (targetType === 'local' ? undefined : targetTab.sessionId);
      let targetTitle = (linkedTab?.title || targetTab.originalTitle || targetTab.title).replace(/\s*\[.*\]$/, '').replace(/\s*\(\d+\)$/, '');
      if (targetType === 'local') {
        targetTitle = 'Локальные файлы';
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === targetTab.id
            ? {
                ...t,
                splitMode: 'single',
                type: targetType,
                originalType: targetType,
                originalTitle: targetTitle,
                title: targetTitle,
                sessionId: targetSessionId,
                panes: undefined,
              }
            : t
        )
      );
      if (activeTabId === targetTab.id) {
        setCurrentView(targetType);
        lastActiveTabByType.current[targetType] = targetTab.id;
      }
    } else if (mode === 'split-2') {
      if (targetTab.splitMode === 'split-3') {
        // Collapsing from 3 to 2 panes: drop the rightmost pane (pane 2)!
        const currentPanes = targetTab.panes || [];
        const nextPanes: PaneConfig[] = [
          { ...(currentPanes[0] || { id: 'pane-0', viewType: targetTab.type }), id: 'pane-0' },
          { ...(currentPanes[1] || { id: 'pane-1', viewType: 'sftp' }), id: 'pane-1' },
        ];
        const baseTitle = targetTab.originalTitle || targetTab.title.replace(/\s*\[.*\]$/, '').replace(/\s*\(\d+\)$/, '');
        const newTitle = `${baseTitle} [${nextPanes[0].viewType.toUpperCase()} + ${nextPanes[1].viewType.toUpperCase()}]`;

        setTabs((prev) =>
          prev.map((t) =>
            t.id === targetTab.id
              ? {
                  ...t,
                  splitMode: 'split-2',
                  panes: nextPanes,
                  title: newTitle,
                }
              : t
          )
        );
      } else {
        // Upgrading from single to 2 panes:
        // The current surviving tab view ALWAYS becomes pane-0 (the primary left pane)!
        const currentType = (targetTab.type) as PaneViewType;
        let secondType: PaneViewType = 'terminal';
        if (currentType === 'terminal') {
          secondType = 'sftp';
        } else if (currentType === 'sftp') {
          secondType = 'terminal';
        } else if (currentType === 'local') {
          secondType = targetTab.sessionId ? 'sftp' : 'terminal';
        } else {
          secondType = 'terminal';
        }

        const baseTitle = (targetTab.originalTitle || targetTab.title).replace(/\s*\[.*\]$/, '').replace(/\s*\(\d+\)$/, '');
        const newTitle = `${baseTitle} [${currentType.toUpperCase()} + ${secondType.toUpperCase()}]`;

        const initialPanes: PaneConfig[] = [
          { id: 'pane-0', viewType: currentType, tabId: targetTab.id },
          { id: 'pane-1', viewType: secondType },
        ];

        setTabs((prev) =>
          prev.map((t) =>
            t.id === targetTab.id
              ? {
                  ...t,
                  splitMode: 'split-2',
                  originalType: currentType as TabType,
                  originalTitle: baseTitle,
                  panes: initialPanes,
                  title: newTitle,
                }
              : t
          )
        );
      }
    } else if (mode === 'split-3') {
      const currentPanes = targetTab.panes && targetTab.panes.length > 0
        ? targetTab.panes
        : [
            { id: 'pane-0', viewType: targetTab.type as PaneViewType, tabId: targetTab.id },
            { id: 'pane-1', viewType: 'sftp' as PaneViewType },
          ];

      const thirdType: PaneViewType = currentPanes.some((p) => p.viewType === 'local') ? 'terminal' : 'local';
      const nextPanes: PaneConfig[] = [
        { ...currentPanes[0], id: 'pane-0' },
        { ...(currentPanes[1] || { viewType: 'sftp' }), id: 'pane-1' },
        { id: 'pane-2', viewType: thirdType },
      ];

      const baseTitle = targetTab.originalTitle || targetTab.title.replace(/\s*\[.*\]$/, '').replace(/\s*\(\d+\)$/, '');
      const newTitle = `${baseTitle} [${nextPanes[0].viewType.toUpperCase()} + ${nextPanes[1].viewType.toUpperCase()} + ${nextPanes[2].viewType.toUpperCase()}]`;

      setTabs((prev) =>
        prev.map((t) =>
          t.id === targetTab.id
            ? {
                ...t,
                splitMode: 'split-3',
                originalType: targetTab.type,
                originalTitle: baseTitle,
                panes: nextPanes,
                title: newTitle,
              }
            : t
        )
      );
    }

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }, [activeTab, activeTabId, tabs]);

  // Close specific pane in split layout
  const handleRemovePane = useCallback((paneIndex: number, tabIdTarget?: string) => {
    const targetTab = (tabIdTarget ? tabs.find((t) => t.id === tabIdTarget) : null) || activeTab;
    if (!targetTab) return;
    const currentPanes = targetTab.panes && targetTab.panes.length > 0
      ? targetTab.panes
      : [
          { id: 'pane-0', viewType: targetTab.type as PaneViewType, tabId: targetTab.id },
          { id: 'pane-1', viewType: 'sftp' as PaneViewType },
        ];

    if (currentPanes.length <= 1) return;

    if (targetTab.splitMode === 'split-3') {
      const remainingPanes = currentPanes.filter((_, idx) => idx !== paneIndex);
      const nextPanes: PaneConfig[] = [
        { ...remainingPanes[0], id: 'pane-0' },
        { ...remainingPanes[1], id: 'pane-1' },
      ];
      const baseTitle = (targetTab.originalTitle || targetTab.title).replace(/\s*\[.*\]$/, '').replace(/\s*\(\d+\)$/, '');
      const newTitle = `${baseTitle} [${nextPanes[0].viewType.toUpperCase()} + ${nextPanes[1].viewType.toUpperCase()}]`;

      setTabs((prev) =>
        prev.map((t) =>
          t.id === targetTab.id
            ? {
                ...t,
                splitMode: 'split-2',
                panes: nextPanes,
                title: newTitle,
              }
            : t
        )
      );
    } else {
      // 2 panes -> 1 pane: the surviving pane becomes the 100% full width single tab content
      const survivingPane = currentPanes.find((_, idx) => idx !== paneIndex) || currentPanes[0];
      const survivingType = (survivingPane.viewType as TabType) || 'terminal';

      const linkedTab = survivingPane.tabId ? tabs.find((t) => t.id === survivingPane.tabId) : undefined;
      const survivingSessionId = linkedTab?.sessionId || (survivingType === 'local' ? undefined : targetTab.sessionId);

      let baseTitle = (linkedTab?.title || targetTab.originalTitle || targetTab.title).replace(/\s*\[.*\]$/, '').replace(/\s*\(\d+\)$/, '');
      if (survivingType === 'local') {
        baseTitle = 'Локальные файлы';
      } else if (survivingSessionId && activeSessions.has(survivingSessionId)) {
        const host = activeSessions.get(survivingSessionId);
        baseTitle = `${host?.name || 'Server'} (${survivingType.toUpperCase()})`;
      }

      setTabs((prev) =>
        prev.map((t) =>
          t.id === targetTab.id
            ? {
                ...t,
                splitMode: 'single',
                type: survivingType,
                originalType: survivingType, // Clear/reset to surviving type so re-split anchors on survivor!
                originalTitle: baseTitle,
                title: baseTitle,
                sessionId: survivingSessionId,
                panes: undefined,
              }
            : t
        )
      );
      if (activeTabId === targetTab.id) {
        setCurrentView(survivingType);
        lastActiveTabByType.current[survivingType] = targetTab.id;
      }
    }

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }, [activeTab, activeTabId, tabs, activeSessions]);

  // Swap adjacent panes
  const handleSwapPanes = useCallback((indexA: number, indexB: number, tabIdTarget?: string) => {
    const targetId = tabIdTarget || activeTabId;
    if (!targetId) return;

    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== targetId) return tab;
        const currentPanes = tab.panes && tab.panes.length > 0
          ? [...tab.panes]
          : [
              { id: 'pane-0', viewType: tab.type as PaneViewType, tabId: tab.id },
              { id: 'pane-1', viewType: 'sftp' as PaneViewType },
            ];

        if (!currentPanes[indexA] || !currentPanes[indexB]) return tab;

        const temp = currentPanes[indexA];
        currentPanes[indexA] = currentPanes[indexB];
        currentPanes[indexB] = temp;

        const baseTitle = (tab.originalTitle || tab.title).replace(/\s*\[.*\]$/, '').replace(/\s*\(\d+\)$/, '');
        const paneTypesStr = currentPanes.map((p) => p.viewType.toUpperCase()).join(' + ');
        const newTitle = `${baseTitle} [${paneTypesStr}]`;

        return {
          ...tab,
          panes: currentPanes,
          title: newTitle,
        };
      })
    );

    setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 50);
  }, [activeTabId]);

  const handleChangePane = useCallback((paneIndex: number, newConfig: PaneConfig, tabIdTarget?: string) => {
    const targetId = tabIdTarget || activeTabId;
    if (!targetId) return;
    setTabs((prev) =>
      prev.map((tab) => {
        if (tab.id !== targetId) return tab;
        const nextPanes = [...(tab.panes || [])];
        nextPanes[paneIndex] = newConfig;
        return { ...tab, panes: nextPanes };
      })
    );
  }, [activeTabId]);

  const handleNavigateToTerminal = useCallback((sessionId: string, folderPath: string, shouldSwitchTab = true) => {
    const cleanPath = sanitizeRemotePath(folderPath);
    const cdCmd = formatCdCommand(cleanPath);

    // Check if the current active tab has a visible terminal pane in a split layout
    const hasAdjacentTerminal = Boolean(
      activeTab &&
      activeTab.splitMode &&
      activeTab.splitMode !== 'single' &&
      activeTab.panes?.some((p) => p.viewType === 'terminal')
    );

    if (!shouldSwitchTab) {
      // Background sync during SFTP browsing: ONLY sync if a terminal pane is visible right next to SFTP in this tab!
      if (hasAdjacentTerminal) {
        window.api?.ssh.write(sessionId, cdCmd.endsWith('\n') ? cdCmd : `${cdCmd}\n`);
      }
      // Otherwise do NOTHING: do not switch tabs, do not launch new connections, do not mutate background tabs
      return;
    }

    // User explicitly requested "Open in Terminal" (shouldSwitchTab === true)
    if (hasAdjacentTerminal) {
      window.api?.ssh.write(sessionId, cdCmd.endsWith('\n') ? cdCmd : `${cdCmd}\n`);
      return;
    }

    const termTab = tabs.find((t) => t.sessionId === sessionId && t.type === 'terminal');
    if (termTab) {
      setActiveTabId(termTab.id);
      setCurrentView('terminal');
      window.api?.ssh.write(sessionId, cdCmd.endsWith('\n') ? cdCmd : `${cdCmd}\n`);
    } else {
      const host = activeSessions.get(sessionId);
      if (host) {
        executeConnection(host, 'terminal');
        setTimeout(() => {
          window.api?.ssh.write(sessionId, cdCmd.endsWith('\n') ? cdCmd : `${cdCmd}\n`);
        }, 600);
      }
    }
  }, [tabs, activeTab, activeSessions]);

  const handleTabModifiedChange = useCallback((tabId: string, isModified: boolean) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, isModified } : t))
    );
  }, []);

  const handleNewConnectionModal = useCallback((type: TabType) => {
    if (type === 'terminal' || type === 'sftp' || type === 'monitor') {
      setConnectModalType(type);
    }
  }, []);

  return (
    <div className={`flex flex-col h-screen w-screen overflow-hidden select-none ${
      isLight ? 'bg-[#f3f3f3] text-slate-800' : 'bg-[#181818] text-slate-200'
    }`}>
      {/* Titlebar with tabs and Windows 11 controls */}
      <TitleBar
        tabs={tabs}
        activeTabId={activeTabId}
        isLight={isLight}
        canDuplicate={canDuplicate}
        updateAvailable={updateState.status === 'available' || updateState.status === 'downloaded'}
        splitMode={activeSplitMode}
        onSetSplitMode={handleSetSplitMode}
        onToggleTheme={handleToggleTheme}
        onSelectTab={handleSelectTab}
        onCloseTab={handleCloseTab}
        onNewTab={() => {
          setCurrentView('hosts');
          setActiveTabId('hosts-view');
        }}
        onDuplicateTab={() => handleDuplicateSession()}
        onOpenHelp={() => setIsHelpModalOpen(true)}
        onOpenSettings={() => setCurrentView('settings')}
        onOpenAbout={(tab) => handleOpenAbout(tab || 'updates')}
      />

      {/* Main App Workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Navigation Sidebar */}
        <Sidebar
          currentView={currentView}
          isLight={isLight}
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={handleSelectTab}
          onCloseTab={handleCloseTab}
          onNewConnection={(type) => {
            if (type === 'terminal' || type === 'sftp' || type === 'monitor') {
              setConnectModalType(type);
            }
          }}
          onSelectView={(view) => {
            setCurrentView(view);
            if (view === 'hosts') {
              setActiveTabId('hosts-view');
              return;
            }
            if (view === 'settings') {
              setActiveTabId('settings-view');
              return;
            }
            if (view === 'tunnels') {
              setActiveTabId('tunnels-view');
              return;
            }

            // Find all tabs matching this view type (including split tabs containing this view)
            const matchingTabs = tabs.filter(
              (t) => t.type === view || t.originalType === view || t.panes?.some((p) => p.viewType === view)
            );
            if (matchingTabs.length === 0) {
              setActiveTabId(`${view}-view`);
              return;
            }

            // If the current active tab is already one of the matching tabs, cycle to the NEXT matching tab!
            const currentIndex = matchingTabs.findIndex((t) => t.id === activeTabId);
            if (currentIndex !== -1 && matchingTabs.length > 1) {
              const nextIndex = (currentIndex + 1) % matchingTabs.length;
              const nextTab = matchingTabs[nextIndex];
              setActiveTabId(nextTab.id);
              lastActiveTabByType.current[view] = nextTab.id;
            } else {
              // Otherwise, activate the last used or first tab of this type
              const lastId = lastActiveTabByType.current[view];
              const targetTab = matchingTabs.find((t) => t.id === lastId) || matchingTabs[0];
              setActiveTabId(targetTab.id);
              lastActiveTabByType.current[view] = targetTab.id;
            }
          }}
          vaultStatus={vaultStatus}
          onToggleVault={handleToggleVault}
          onOpenAbout={(tab) => handleOpenAbout(tab || 'mission')}
          connectedSessionCount={tabs.filter((t) => t.type === 'terminal').length}
        />

        {/* Dynamic Center Stage */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* Hosts Management View (Kept alive for instant zero-jank switching) */}
          <div
            className="w-full h-full"
            style={{ display: currentView === 'hosts' ? 'flex' : 'none' }}
          >
            <HostList
              hosts={hosts}
              isLight={isLight}
              isVaultLocked={!vaultStatus.isUnlocked}
              onUnlockVault={() => setIsVaultModalOpen(true)}
              onConnect={handleConnect}
              onEdit={(h) => {
                if (!vaultStatus.isUnlocked) {
                  setIsVaultModalOpen(true);
                  return;
                }
                setEditingHost(h);
                setIsHostModalOpen(true);
              }}
              onDelete={handleDeleteHost}
              onNewHost={() => {
                if (!vaultStatus.isUnlocked) {
                  setIsVaultModalOpen(true);
                  return;
                }
                setEditingHost(null);
                setIsHostModalOpen(true);
              }}
              connectingInfo={connectingHostInfo}
            />
          </div>

          {/* Views Area wrapped in Suspense for Lazy Loading */}
          <Suspense fallback={
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin" />
            </div>
          }>
            {/* Persistent Tab Views (Kept alive across all tab & view switches) */}
            {tabs.map((tab) => {
              const isSplit = Boolean(tab.splitMode && tab.splitMode !== 'single');
              const isTabActive = Boolean(
                activeTabId === tab.id &&
                currentView !== 'hosts' &&
                currentView !== 'settings' &&
                currentView !== 'tunnels' &&
                (currentView === tab.type ||
                  isSplit ||
                  tab.originalType === currentView ||
                  tab.panes?.some((p) => p.viewType === currentView))
              );

              return (
                <TabWorkspace
                  key={tab.id}
                  tab={tab}
                  isTabActive={isTabActive}
                  tabs={tabs}
                  activeSessions={activeSessions}
                  hosts={hosts}
                  isLight={isLight}
                  settings={settings}
                  snippets={snippets}
                  onRunSnippet={handleRunSnippet}
                  onOpenSftp={handleOpenSftp}
                  onOpenMonitor={handleOpenMonitor}
                  onOpenFileInEditor={handleOpenFileInEditor}
                  onDuplicateSession={handleDuplicateSession}
                  onNavigateToTerminal={handleNavigateToTerminal}
                  onCloseTab={handleCloseTab}
                  onNewConnection={handleNewConnectionModal}
                  onReconnectSession={handleReconnectSession}
                  onChangePane={handleChangePane}
                  onSetSplitMode={handleSetSplitMode}
                  onRemovePane={handleRemovePane}
                  onSwapPanes={handleSwapPanes}
                  onTabModifiedChange={handleTabModifiedChange}
                />
              );
            })}

            {/* Dedicated Local Files View (Kept alive across all tab & view switches) */}
            <div
              className="w-full h-full flex-shrink-0"
              style={{ display: currentView === 'local' && activeTabId === 'local-view' ? 'flex' : 'none' }}
            >
              <LocalFilesView
                isLight={isLight}
                folderClickMode={settings.folderClickMode || 'double'}
                activeSessions={activeSessions}
                onOpenFileInEditor={(filePath, fileName) => {
                  const firstSessionId = Array.from(activeSessions.keys())[0];
                  if (firstSessionId) {
                    handleOpenFileInEditor(firstSessionId, filePath, fileName);
                  }
                }}
              />
            </div>

            {/* Terminal Empty State when no terminal tabs exist or dedicated view is active */}
            {currentView === 'terminal' && (activeTabId === 'terminal-view' || !tabs.some((t) => t.id === activeTabId)) && (
              <EmptyStateView
                viewType="terminal"
                hosts={hosts}
                isLight={isLight}
                onConnectHost={(h) => handleConnect(h, 'terminal')}
                onQuickConnect={(cmd) => handleQuickConnect(cmd, 'terminal')}
                onNewHost={() => {
                  setEditingHost(null);
                  setIsHostModalOpen(true);
                }}
              />
            )}

            {/* SFTP Empty State when no SFTP tabs exist or dedicated view is active */}
            {currentView === 'sftp' && (activeTabId === 'sftp-view' || !tabs.some((t) => t.id === activeTabId)) && (
              <EmptyStateView
                viewType="sftp"
                hosts={hosts}
                isLight={isLight}
                onConnectHost={(h) => handleConnect(h, 'sftp')}
                onQuickConnect={(cmd) => handleQuickConnect(cmd, 'sftp')}
                onNewHost={() => {
                  setEditingHost(null);
                  setIsHostModalOpen(true);
                }}
              />
            )}

            {/* Monitor Empty State when no monitor tabs exist or dedicated view is active */}
            {currentView === 'monitor' && (activeTabId === 'monitor-view' || !tabs.some((t) => t.id === activeTabId)) && (
              <EmptyStateView
                viewType="monitor"
                hosts={hosts}
                isLight={isLight}
                onConnectHost={(h) => handleConnect(h, 'monitor')}
                onQuickConnect={(cmd) => handleQuickConnect(cmd, 'monitor')}
                onNewHost={() => {
                  setEditingHost(null);
                  setIsHostModalOpen(true);
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

          {/* Settings View */}
          {currentView === 'settings' && (
            <SettingsView
              settings={settings}
              vaultStatus={vaultStatus}
              isLight={isLight}
              onSaveSettings={async (newSettings) => {
                await window.api.vault.saveSettings(newSettings);
                setSettings(await window.api.vault.getSettings());
              }}
              onSetupVault={() => setIsVaultModalOpen(true)}
              onReloadVaultStatus={loadVaultData}
              onOpenAbout={(tab) => handleOpenAbout(tab)}
            />
          )}
          </Suspense>
        </div>
      </div>

      {/* Modern Fluent Bottom Status Bar (Height 24px) */}
      <div className={`h-6.5 border-t px-3 flex items-center justify-between text-[11px] select-none z-10 ${
        isLight ? 'bg-[#ebebeb] border-slate-300 text-slate-700' : 'bg-[#181818] border-[#2c2c2c] text-slate-400'
      }`}>
        {/* Left: Active connection indicator & sessions count */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5 font-mono">
            <span className={`w-2 h-2 rounded-full ${
              activeSessions.size > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
            }`} />
            <span>
              {activeSessions.size > 0
                ? `${t('statusBar.connected')} ${
                    tabs.find((t) => t.id === activeTabId && t.sessionId)
                      ? `${activeSessions.get(tabs.find((t) => t.id === activeTabId)!.sessionId!)?.username || ''}@${
                          activeSessions.get(tabs.find((t) => t.id === activeTabId)!.sessionId!)?.host || 'server'
                        }`
                      : `${activeSessions.size} ${t('statusBar.sessions')}`
                  }`
                : t('statusBar.noSessions')}
            </span>
          </div>

          {tunnels.filter((t) => t.status === 'active').length > 0 && (
            <div className="flex items-center space-x-1 text-sky-400">
              <Radio className="w-3 h-3" />
              <span>
                {tunnels.filter((t) => t.status === 'active').length} {t('statusBar.tunnelsActive')}
              </span>
            </div>
          )}
        </div>

        {/* Center: Encrypted Vault Indicator */}
        <div
          onClick={() => {
            if (vaultStatus.protectionMode === 'password' && !vaultStatus.isUnlocked) {
              setIsVaultModalOpen(true);
            } else {
              setCurrentView('settings');
            }
          }}
          className="flex items-center space-x-1.5 cursor-pointer hover:text-sky-400 transition-colors"
          title="Click to view Vault Security Settings"
        >
          {vaultStatus.protectionMode === 'plain' ? (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-medium text-amber-400">Vault: Plaintext</span>
            </>
          ) : vaultStatus.protectionMode === 'system' ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium text-emerald-400">DPAPI Защищено</span>
            </>
          ) : vaultStatus.isUnlocked ? (
            <>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-medium text-emerald-400">{t('statusBar.vaultProtected')}</span>
            </>
          ) : (
            <>
              <Lock className="w-3.5 h-3.5 text-rose-400" />
              <span className="font-medium text-rose-400">Vault Locked</span>
            </>
          )}
        </div>

        {/* Right: Encoding, Terminal type, and App version with Logo */}
        <div className="flex items-center space-x-3 font-mono text-[10px]">
          <span className="text-slate-500">UTF-8</span>
          <span className="text-slate-500">xterm-256color</span>
          <div
            onClick={() => handleOpenAbout('mission')}
            className="flex items-center space-x-1.5 cursor-pointer hover:opacity-80 transition-opacity"
            title={t('about.title')}
          >
            <img src={appLogo} alt="BesTTY" className="w-3.5 h-3.5 rounded object-contain" />
            <span className="font-semibold text-sky-400">
              BesTTY v{updateState.currentVersion || '1.0.0'}
            </span>
          </div>
        </div>
      </div>

      {/* Modals rendered on-demand */}
      <Suspense fallback={null}>
        {isHostModalOpen && (
          <HostModal
            isOpen={isHostModalOpen}
            isLight={isLight}
            onClose={() => setIsHostModalOpen(false)}
            onSave={handleSaveHost}
            onOpenHelp={() => setIsHelpModalOpen(true)}
            hostToEdit={editingHost}
            availableHosts={hosts}
          />
        )}

        {isVaultModalOpen && (
          <VaultModal
            isOpen={isVaultModalOpen}
            isLight={isLight}
            onClose={() => setIsVaultModalOpen(false)}
            vaultStatus={vaultStatus}
            onUnlockSuccess={loadVaultData}
          />
        )}

        {isPasswordPromptOpen && (
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
        )}

        {isHelpModalOpen && (
          <HelpModal
            isOpen={isHelpModalOpen}
            isLight={isLight}
            onClose={() => setIsHelpModalOpen(false)}
          />
        )}

        {isAboutModalOpen && (
          <AboutModal
            isOpen={isAboutModalOpen}
            isLight={isLight}
            initialTab={aboutModalTab}
            onClose={() => setIsAboutModalOpen(false)}
          />
        )}

        {connectModalType && (
          <ConnectHostModal
            isOpen={!!connectModalType}
            viewType={connectModalType}
            hosts={hosts}
            isLight={isLight}
            onClose={() => setConnectModalType(null)}
            onConnectHost={(h, targetType) => handleConnect(h, targetType)}
            onQuickConnect={(cmd, targetType) => handleQuickConnect(cmd, targetType)}
            onNewHost={() => {
              setEditingHost(null);
              setIsHostModalOpen(true);
            }}
          />
        )}
      </Suspense>

      <TransferProgressDrawer isLight={isLight} />
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
