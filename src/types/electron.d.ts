import { HostProfile, Snippet, TunnelConfig, BesTTYSettings, SFTPFile, ServerMetrics, RemoteProcess, VaultStatus } from './index';

declare global {
  interface Window {
    api: {
      vault: {
        getStatus: () => Promise<VaultStatus>;
        unlock: (password: string) => Promise<boolean>;
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
      ssh: {
        connect: (sessionId: string, host: HostProfile, cols: number, rows: number) => Promise<void>;
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
    };
  }
}
