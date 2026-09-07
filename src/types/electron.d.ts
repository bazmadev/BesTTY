import { HostProfile, Snippet, TunnelConfig, BesTTYSettings, SFTPFile, ServerMetrics, RemoteProcess, VaultStatus, UpdateState } from './index';

declare global {
  interface Window {
    api: {
      vault: {
        getStatus: () => Promise<VaultStatus>;
        unlock: (password: string) => Promise<boolean>;
        unlockWithBiometrics: () => Promise<boolean>;
        setupMasterPassword: (password: string, recoveryKey: string) => Promise<{ success: boolean; error?: string }>;
        recoverWithKey: (recoveryKey: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
        setProtectionMode: (mode: VaultProtectionMode, password?: string, recoveryKey?: string) => Promise<{ success: boolean; error?: string }>;
        toggleBiometrics: (enabled: boolean) => Promise<{ success: boolean; error?: string }>;
        lock: () => Promise<void>;
        getHosts: () => Promise<HostProfile[]>;
        saveHost: (host: HostProfile) => Promise<void>;
        deleteHost: (id: string) => Promise<void>;
        getSnippets: () => Promise<Snippet[]>;
        saveSnippet: (snippet: Snippet) => Promise<void>;
        deleteSnippet: (id: string) => Promise<void>;
        getTunnels: () => Promise<TunnelConfig[]>;
        saveTunnel: (tunnel: TunnelConfig) => Promise<void>;
        deleteTunnel: (id: string) => Promise<void>;
        getSettings: () => Promise<BesTTYSettings>;
        saveSettings: (settings: Partial<BesTTYSettings>) => Promise<void>;
      };
      biometrics: {
        checkAvailability: () => Promise<{ available: boolean; status: string; description?: string }>;
        promptVerification: (prompt?: string) => Promise<{ success: boolean; error?: string }>;
      };
      ssh: {
        connect: (sessionId: string, host: HostProfile, cols: number, rows: number) => Promise<void>;
        testConnection: (host: HostProfile) => Promise<{ success: boolean; error?: string; fingerprint?: string }>;
        write: (sessionId: string, data: string) => Promise<void>;
        resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
        disconnect: (sessionId: string) => Promise<void>;
        onData: (callback: (payload: { sessionId: string; data: string }) => void) => () => void;
        onClosed: (callback: (payload: { sessionId: string }) => void) => () => void;
        onError: (callback: (payload: { sessionId: string; error: string }) => void) => () => void;
        onDirectoryChanged: (callback: (payload: { sessionId: string; directory: string }) => void) => () => void;
      };
      sftp: {
        list: (sessionId: string, path?: string) => Promise<{ currentPath: string; files: SFTPFile[] }>;
        readFile: (sessionId: string, remotePath: string) => Promise<string>;
        writeFile: (sessionId: string, remotePath: string, content: string) => Promise<void>;
        sudoWriteFile: (sessionId: string, remotePath: string, content: string) => Promise<void>;
        mkdir: (sessionId: string, remotePath: string) => Promise<void>;
        delete: (sessionId: string, remotePath: string, isDirectory: boolean) => Promise<void>;
        rename: (sessionId: string, oldPath: string, newPath: string) => Promise<void>;
        chmod: (sessionId: string, remotePath: string, mode: number) => Promise<void>;
      };
      monitor: {
        start: (sessionId: string) => Promise<void>;
        stop: (sessionId: string) => Promise<void>;
        onStats: (callback: (payload: { sessionId: string; metrics: ServerMetrics; processes: RemoteProcess[] }) => void) => () => void;
        killProcess: (sessionId: string, pid: number, signal?: string) => Promise<boolean>;
      };
      tunnels: {
        start: (tunnel: TunnelConfig) => Promise<void>;
        stop: (tunnelId: string) => Promise<void>;
        isActive: (tunnelId: string) => Promise<boolean>;
      };
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
      };
      dialog: {
        openKeyFile: () => Promise<string | null>;
      };
      clipboard: {
        readText: () => Promise<string>;
        writeText: (text: string) => Promise<void>;
      };
      updater: {
        getStatus: () => Promise<UpdateState>;
        check: () => Promise<UpdateState>;
        download: () => Promise<void>;
        install: () => Promise<void>;
        onStatus: (callback: (state: UpdateState) => void) => () => void;
      };
    };
  }
}
