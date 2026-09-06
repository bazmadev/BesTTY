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
  createdAt: number;
  updatedAt: number;
}

export type TabType = 'terminal' | 'sftp' | 'editor' | 'monitor' | 'tunnels' | 'settings';

export interface TabItem {
  id: string;
  type: TabType;
  title: string;
  hostId?: string;
  sessionId?: string;
  filePath?: string;
  initialContent?: string;
  isModified?: boolean;
}

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
  locale: 'en' | 'ru';
  theme: 'system' | 'fluent-dark' | 'fluent-light' | 'dracula' | 'one-dark' | 'nord';
  fontFamily: string;
  fontSize: number;
  cursorStyle: 'block' | 'underline' | 'bar';
  cursorBlink: boolean;
  scrollback: number;
  confirmOnClose: boolean;
  sftpFollowTerminal: boolean; // SmarTTY OSC 7 directory tracking
  enableHardwareAcceleration: boolean;
}

export interface VaultStatus {
  isConfigured: boolean;
  isUnlocked: boolean;
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

