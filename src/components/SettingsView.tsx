import React, { useState, useEffect } from 'react';
import { BesTTYSettings } from '../types';
import { Settings, Shield, Terminal, Palette, FolderTree, Check, Save } from 'lucide-react';

interface SettingsViewProps {
  settings: BesTTYSettings;
  onSaveSettings: (settings: Partial<BesTTYSettings>) => void;
  onSetupVault: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onSaveSettings,
  onSetupVault,
}) => {
  const [localSettings, setLocalSettings] = useState<BesTTYSettings>(settings);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSave = () => {
    onSaveSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] p-6 overflow-y-auto select-none">
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#2d2d2d]">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <Settings className="w-6 h-6 text-sky-400" />
              <span>Application Settings</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Configure terminal emulation, SmarTTY features, themes and security.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow transition-all"
          >
            {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            <span>{saved ? 'Saved!' : 'Save Settings'}</span>
          </button>
        </div>

        {/* SmarTTY Signature Features */}
        <div className="bg-[#202020] border border-[#303030] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <FolderTree className="w-4 h-4 text-amber-400" />
            <span>SmarTTY Smart Bash Integration</span>
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-slate-200 block">
                Auto-sync SFTP Explorer with Terminal Working Directory (OSC 7)
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                When you run <code className="text-sky-300">cd /var/www</code> in the terminal, the SFTP panel will automatically navigate to that directory.
              </span>
            </div>
            <input
              type="checkbox"
              checked={localSettings.sftpFollowTerminal}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, sftpFollowTerminal: e.target.checked })
              }
              className="w-4 h-4 accent-sky-500"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#2a2a2a]">
            <div>
              <span className="text-xs font-medium text-slate-200 block">
                DirectX / GPU Hardware Acceleration
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Utilize Windows GPU text rendering pipeline for smooth 120+ FPS terminal scrolling.
              </span>
            </div>
            <input
              type="checkbox"
              checked={localSettings.enableHardwareAcceleration}
              onChange={(e) =>
                setLocalSettings({ ...localSettings, enableHardwareAcceleration: e.target.checked })
              }
              className="w-4 h-4 accent-sky-500"
            />
          </div>
        </div>

        {/* Terminal Emulation Settings */}
        <div className="bg-[#202020] border border-[#303030] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-sky-400" />
            <span>Terminal Appearance & Font</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Font Family</label>
              <select
                value={localSettings.fontFamily}
                onChange={(e) => setLocalSettings({ ...localSettings, fontFamily: e.target.value })}
                className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              >
                <option value="Cascadia Code, Consolas, monospace">Cascadia Code (Windows 11 Native)</option>
                <option value="JetBrains Mono, monospace">JetBrains Mono</option>
                <option value="Fira Code, monospace">Fira Code (with Ligatures)</option>
                <option value="Consolas, monospace">Consolas</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Font Size (px)</label>
              <input
                type="number"
                min={10}
                max={24}
                value={localSettings.fontSize}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, fontSize: Number(e.target.value) })
                }
                className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Cursor Style</label>
              <select
                value={localSettings.cursorStyle}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, cursorStyle: e.target.value as any })
                }
                className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
              >
                <option value="block">Block</option>
                <option value="underline">Underline</option>
                <option value="bar">Bar</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Cursor Blinking</label>
              <div className="pt-2">
                <input
                  type="checkbox"
                  checked={localSettings.cursorBlink}
                  onChange={(e) =>
                    setLocalSettings({ ...localSettings, cursorBlink: e.target.checked })
                  }
                  className="w-4 h-4 accent-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Scrollback Lines</label>
              <input
                type="number"
                value={localSettings.scrollback}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, scrollback: Number(e.target.value) })
                }
                className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>
        </div>

        {/* Security & Vault */}
        <div className="bg-[#202020] border border-[#303030] rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Encrypted Vault & Master Key</span>
          </h3>
          <p className="text-xs text-slate-400">
            BesTTY encrypts your server passwords, private keys and tunnel settings locally using AES-256-GCM.
          </p>
          <button
            onClick={onSetupVault}
            className="px-4 py-2 rounded-lg bg-[#2b2b2b] hover:bg-[#333] border border-[#444] text-xs font-semibold text-slate-200 hover:text-white transition-colors"
          >
            Configure / Change Master Password
          </button>
        </div>
      </div>
    </div>
  );
};
