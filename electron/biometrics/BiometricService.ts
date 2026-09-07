import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import util from 'util';

const execFileAsync = util.promisify(execFile);

export interface BiometricAvailability {
  available: boolean;
  status: 'Available' | 'DeviceNotPresent' | 'NotConfiguredForUser' | 'DisabledByPolicy' | 'DeviceBusy' | 'UnsupportedPlatform' | 'Error';
  description?: string;
}

export class BiometricService {
  private getBinaryPath(): string | null {
    if (process.platform !== 'win32') {
      return null;
    }

    const candidates = [
      // Packaged app resourcesPath
      path.join(process.resourcesPath, 'bin', 'win-hello.exe'),
      // Dev mode app root resources/bin
      path.join(app.getAppPath(), 'resources', 'bin', 'win-hello.exe'),
      // Relative to current file
      path.join(__dirname, '../../resources/bin/win-hello.exe'),
      // Direct cwd
      path.join(process.cwd(), 'resources', 'bin', 'win-hello.exe'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return null;
  }

  public async checkAvailability(): Promise<BiometricAvailability> {
    if (process.platform !== 'win32') {
      return {
        available: false,
        status: 'UnsupportedPlatform',
        description: 'Биометрия Windows Hello поддерживается в Windows 10/11',
      };
    }

    const bin = this.getBinaryPath();
    if (!bin) {
      return {
        available: false,
        status: 'Error',
        description: 'Модуль биометрии win-hello.exe не найден',
      };
    }

    try {
      const { stdout } = await execFileAsync(bin, [], { timeout: 5000 });
      const line = stdout.trim();
      if (line.includes('AVAIL:Available')) {
        return { available: true, status: 'Available' };
      } else if (line.includes('AVAIL:DeviceNotPresent')) {
        return {
          available: false,
          status: 'DeviceNotPresent',
          description: 'Биометрический модуль (сканер отпечатка/камера) не обнаружен',
        };
      } else if (line.includes('AVAIL:NotConfiguredForUser')) {
        return {
          available: false,
          status: 'NotConfiguredForUser',
          description: 'Windows Hello не настроен в учетной записи Windows',
        };
      } else if (line.includes('AVAIL:DisabledByPolicy')) {
        return {
          available: false,
          status: 'DisabledByPolicy',
          description: 'Windows Hello отключен системными политиками',
        };
      } else {
        return { available: false, status: 'DeviceNotPresent' };
      }
    } catch (err: any) {
      if (err.stdout && typeof err.stdout === 'string') {
        if (err.stdout.includes('AVAIL:Available')) {
          return { available: true, status: 'Available' };
        }
        if (err.stdout.includes('AVAIL:DeviceNotPresent')) {
          return {
            available: false,
            status: 'DeviceNotPresent',
            description: 'Биометрический модуль (сканер отпечатка/камера) не обнаружен',
          };
        }
        if (err.stdout.includes('AVAIL:NotConfiguredForUser')) {
          return {
            available: false,
            status: 'NotConfiguredForUser',
            description: 'Windows Hello не настроен в учетной записи Windows',
          };
        }
      }
      return {
        available: false,
        status: 'Error',
        description: err.message || 'Ошибка проверки биометрии',
      };
    }
  }

  public async promptVerification(prompt: string = 'Подтвердите личность для доступа к BesTTY'): Promise<{ success: boolean; error?: string }> {
    if (process.platform !== 'win32') {
      return { success: false, error: 'Биометрия не поддерживается на этой платформе' };
    }

    const bin = this.getBinaryPath();
    if (!bin) {
      return { success: false, error: 'Модуль биометрии win-hello.exe не найден' };
    }

    try {
      const { stdout } = await execFileAsync(bin, ['verify', prompt], { timeout: 60000 });
      if (stdout.includes('RESULT:Verified')) {
        return { success: true };
      }
      return { success: false, error: 'Аутентификация отклонена или отменена пользователем' };
    } catch (err: any) {
      if (err.stdout && typeof err.stdout === 'string' && err.stdout.includes('RESULT:Verified')) {
        return { success: true };
      }
      return { success: false, error: err.message || 'Ошибка верификации биометрии' };
    }
  }
}
