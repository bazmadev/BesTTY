export type AuthType = 'password' | 'privateKey' | 'agent';

export interface HostProfile {
  id: string;
  name: string;
  group?: string;
  host: string;
  port: number;
  username: string;
  authType: AuthType;
  password?: string;
  privateKeyPath?: string;
  privateKeyContent?: string;
  passphrase?: string;
  proxyJumpId?: string; // Bastion jump host ID
  color?: string;
  tags?: string[];
  defaultPath?: string;
  keepAliveInterval?: number;
  notes?: string;
  fingerprint?: string; // SSH host key fingerprint (TOFU)
  allowLegacyCiphers?: boolean; // Allow weak/legacy algorithms (3DES, MD5, SHA-1)
  createdAt: number;
  updatedAt: number;
}

export type TabType = 'terminal' | 'sftp' | 'editor' | 'monitor' | 'tunnels' | 'settings' | 'local';

export type SplitLayoutMode = 'single' | 'split-2' | 'split-3';

export type PaneViewType = 'terminal' | 'sftp' | 'monitor' | 'local' | 'editor';

export interface PaneConfig {
  id: string;
  viewType: PaneViewType;
  tabId?: string;
}

export interface LocalDrive {
  name: string;
  path: string;
  isDrive: boolean;
}

export interface FileClipboardState {
  action: 'copy' | 'cut';
  source: 'remote' | 'local';
  sessionId?: string;
  files: string[];
}

export interface TransferBatchItem {
  sourcePath: string;
  destPath: string;
  isDirectory?: boolean;
}

export interface TransferProgressPayload {
  transferId: string;
  type: 'upload' | 'download';
  status: 'starting' | 'progress' | 'completed' | 'error';
  currentFile: string;
  fileIndex: number;
  totalFiles: number;
  bytesTransferred: number;
  totalBytes: number;
  speedBytesPerSec: number;
  error?: string;
}


export interface TabItem {
  id: string;
  type: TabType;
  title: string;
  hostId?: string;
  sessionId?: string;
  filePath?: string;
  initialPath?: string;
  initialContent?: string;
  isModified?: boolean;
  splitMode?: SplitLayoutMode;
  panes?: PaneConfig[];
  originalType?: TabType;
  originalTitle?: string;
}

export interface DirectorySyncConfig {
  terminalToBrowser: boolean;
  browserToTerminal: boolean;
}

export const STORAGE_KEY_DIR_SYNC = 'bestty_directory_sync_config';
export const STORAGE_KEY_FOLDER_CLICK_MODE = 'bestty_folder_click_mode';
export const EVENT_DIR_SYNC_CHANGED = 'bestty_dir_sync_changed';
export const EVENT_SFTP_REFRESHED = 'bestty_sftp_refreshed';
export type FolderClickMode = 'single' | 'double';

export interface SFTPFile {
  name: string;
  path: string;
  isDirectory: boolean;
  isSymlink: boolean;
  size: number;
  permissions: string; // e.g., 'rwxr-xr-x'
  numericPermissions: number; // e.g. 0755
  modifyTime: number;
  owner?: number;
  group?: number;
}

export interface DiskMetric {
  filesystem: string;
  mount: string;
  total: number; // MB
  used: number; // MB
  free: number; // MB
  percent: number;
}

export interface ServerMetrics {
  cpuUsage: number; // 0-100%
  memoryTotal: number; // MB
  memoryUsed: number; // MB
  memoryPercent: number;
  swapTotal: number;
  swapUsed: number;
  uptime: string;
  loadAvg: [number, number, number];
  disks: DiskMetric[];
  networkRxSec: number; // KB/s
  networkTxSec: number; // KB/s
}

export interface RemoteProcess {
  pid: number;
  user: string;
  cpu: number;
  mem: number;
  command: string;
}

export interface TunnelConfig {
  id: string;
  name: string;
  hostId: string;
  type: 'local' | 'remote' | 'dynamic';
  localHost?: string;
  localPort: number;
  remoteHost?: string;
  remotePort?: number;
  status: 'active' | 'inactive' | 'error';
  errorMessage?: string;
}

export interface Snippet {
  id: string;
  name: string;
  command: string;
  description?: string;
  category?: string;
}

export interface BesTTYSettings {
  locale: 'en' | 'ru' | 'hy';
  theme: 'system' | 'fluent-dark' | 'fluent-light' | 'dracula' | 'one-dark' | 'nord';
  fontFamily: string;
  fontSize: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  confirmOnClose: boolean;
  sftpFollowTerminal: boolean; // OSC 7 directory tracking
  enableHardwareAcceleration: boolean;
  folderClickMode?: FolderClickMode;
}

export type VaultProtectionMode = 'system' | 'password' | 'plain';

export interface VaultStatus {
  isConfigured: boolean;
  isUnlocked: boolean;
  protectionMode: VaultProtectionMode;
  biometricsAvailable: boolean;
  biometricsEnabled: boolean;
  biometricsStatus?: string;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';

export interface UpdateState {
  status: UpdateStatus;
  currentVersion: string;
  availableVersion?: string;
  releaseNotes?: string;
  progress?: UpdateProgress;
  error?: string;
}

