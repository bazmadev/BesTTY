import { SSHClientManager } from './SSHClientManager';
import { ServerMetrics, RemoteProcess, DiskMetric } from '../../src/types';
import { EventEmitter } from 'events';

export class MonitorService extends EventEmitter {
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private sshManager: SSHClientManager) {
    super();
  }

  public startMonitoring(sessionId: string, intervalMs: number = 3000): void {
    if (this.intervals.has(sessionId)) {
      return;
    }

    const runCheck = async () => {
      try {
        const stats = await this.collectStats(sessionId);
        if (stats) {
          this.emit('stats', { sessionId, ...stats });
        }
      } catch (e) {
        // Silently skip if connection closed or busy
      }
    };

    // Run immediately once, then set interval
    runCheck();
    const timer = setInterval(runCheck, intervalMs);
    this.intervals.set(sessionId, timer);
  }

  public stopMonitoring(sessionId: string): void {
    const timer = this.intervals.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.intervals.delete(sessionId);
    }
  }

  public async collectStats(sessionId: string): Promise<{ metrics: ServerMetrics; processes: RemoteProcess[] } | null> {
    const session = this.sshManager.getSession(sessionId);
    if (!session || !session.client) {
      return null;
    }

    const cmd = "sh -c 'echo \"===LOAD===\"; cat /proc/loadavg 2>/dev/null; uptime 2>/dev/null; echo \"===MEM===\"; free -m 2>/dev/null; echo \"===DF===\"; df -m -x tmpfs -x devtmpfs -x overlay -x squashfs 2>/dev/null; echo \"===PS===\"; ps -eo pid,user,%cpu,%mem,comm --sort=-%cpu 2>/dev/null | head -n 12'";

    return new Promise((resolve) => {
      session.client.exec(cmd, (err, stream) => {
        if (err) return resolve(null);

        let output = '';
        stream.on('data', (d: Buffer) => {
          output += d.toString('utf-8');
        });

        stream.on('close', () => {
          const parsed = this.parseOutput(output);
          resolve(parsed);
        });

        stream.on('error', () => resolve(null));
      });
    });
  }

  private parseOutput(raw: string): { metrics: ServerMetrics; processes: RemoteProcess[] } {
    const sections = raw.split(/===([A-Z]+)===/);
    
    let loadAvg: [number, number, number] = [0, 0, 0];
    let uptimeStr = 'N/A';
    let memTotal = 0, memUsed = 0, memPercent = 0, swapTotal = 0, swapUsed = 0;
    const disks: DiskMetric[] = [];
    const processes: RemoteProcess[] = [];
    let cpuUsage = 0;

    for (let i = 1; i < sections.length; i += 2) {
      const sectionName = sections[i];
      const content = sections[i + 1] ? sections[i + 1].trim() : '';

      if (sectionName === 'LOAD') {
        const lines = content.split('\n');
        if (lines[0]) {
          const parts = lines[0].trim().split(/\s+/);
          if (parts.length >= 3) {
            loadAvg = [parseFloat(parts[0]) || 0, parseFloat(parts[1]) || 0, parseFloat(parts[2]) || 0];
          }
        }
        if (lines[1]) {
          uptimeStr = lines[1].trim();
        }
      } else if (sectionName === 'MEM') {
        const lines = content.split('\n');
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts[0] && parts[0].startsWith('Mem:')) {
            memTotal = parseInt(parts[1], 10) || 0;
            memUsed = parseInt(parts[2], 10) || 0;
            memPercent = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0;
          } else if (parts[0] && parts[0].startsWith('Swap:')) {
            swapTotal = parseInt(parts[1], 10) || 0;
            swapUsed = parseInt(parts[2], 10) || 0;
          }
        }
      } else if (sectionName === 'DF') {
        const lines = content.split('\n').slice(1); // skip header
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 6) {
            const total = parseInt(parts[1], 10) || 0;
            const used = parseInt(parts[2], 10) || 0;
            const free = parseInt(parts[3], 10) || 0;
            const percent = parseInt(parts[4].replace('%', ''), 10) || 0;
            disks.push({
              filesystem: parts[0],
              mount: parts[5],
              total,
              used,
              free,
              percent,
            });
          }
        }
      } else if (sectionName === 'PS') {
        const lines = content.split('\n').slice(1); // skip header
        let totalCpu = 0;
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const cpu = parseFloat(parts[2]) || 0;
            totalCpu += cpu;
            processes.push({
              pid: parseInt(parts[0], 10) || 0,
              user: parts[1],
              cpu,
              mem: parseFloat(parts[3]) || 0,
              command: parts.slice(4).join(' '),
            });
          }
        }
        cpuUsage = Math.min(100, Math.round(totalCpu));
      }
    }

    return {
      metrics: {
        cpuUsage,
        memoryTotal: memTotal,
        memoryUsed: memUsed,
        memoryPercent: memPercent,
        swapTotal,
        swapUsed,
        uptime: uptimeStr,
        loadAvg,
        disks,
        networkRxSec: 0,
        networkTxSec: 0,
      },
      processes,
    };
  }

  public async killProcess(sessionId: string, pid: number, signal: string = 'SIGTERM'): Promise<boolean> {
    const session = this.sshManager.getSession(sessionId);
    if (!session || !session.client) return false;

    // Security: strictly validate PID to prevent command injection or killing systemd/init
    const numericPid = Number(pid);
    if (!Number.isInteger(numericPid) || numericPid <= 1) {
      console.warn(`[MonitorService Security] Rejected invalid or dangerous PID: ${pid}`);
      return false;
    }

    // Security: strictly allowlist valid POSIX signals
    const allowedSignals = ['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGHUP', 'SIGQUIT', '9', '15'];
    const safeSignal = allowedSignals.includes(signal) ? signal : 'SIGTERM';

    return new Promise((resolve) => {
      session.client.exec(`kill -s ${safeSignal} ${numericPid}`, (err, stream) => {
        if (err) return resolve(false);
        stream.on('close', (code: number) => resolve(code === 0));
        stream.on('error', () => resolve(false));
      });
    });
  }
}
