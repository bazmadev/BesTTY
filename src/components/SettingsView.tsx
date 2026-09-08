import React, { useState, useEffect } from 'react';
import { BesTTYSettings, VaultStatus, VaultProtectionMode } from '../types';
import { useTranslation, SupportedLocale } from '../i18n';
import { Settings, Shield, Terminal, Palette, FolderTree, Check, Save, Languages, Sun, Moon, Sparkles, Heart, Download, ShieldCheck, KeyRound, AlertTriangle, Fingerprint } from 'lucide-react';
import appLogo from '../assets/logo.png';

interface SettingsViewProps {
  settings: BesTTYSettings;
  vaultStatus?: VaultStatus;
  isLight?: boolean;
  onSaveSettings: (settings: Partial<BesTTYSettings>) => void;
  onSetupVault: () => void;
  onReloadVaultStatus?: () => void;
  onOpenAbout?: (tab?: 'mission' | 'updates' | 'donate') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  vaultStatus,
  isLight = false,
  onSaveSettings,
  onSetupVault,
  onReloadVaultStatus,
  onOpenAbout,
}) => {
  const { t, locale, setLocale } = useTranslation();
  const [localSettings, setLocalSettings] = useState<BesTTYSettings>(settings);
  const [saved, setSaved] = useState(false);
  const [bioTesting, setBioTesting] = useState(false);
  const [bioTestMsg, setBioTestMsg] = useState<string | null>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleLanguageChange = (newLocale: SupportedLocale) => {
    setLocale(newLocale);
    const updated = { ...localSettings, locale: newLocale };
    setLocalSettings(updated);
    onSaveSettings(updated);
  };

  const handleThemeChange = (newTheme: BesTTYSettings['theme']) => {
    const updated = { ...localSettings, theme: newTheme };
    setLocalSettings(updated);
    onSaveSettings(updated);
  };

  const handleSave = () => {
    onSaveSettings(localSettings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const [modeChanging, setModeChanging] = useState(false);

  const handleSetProtectionMode = async (newMode: VaultProtectionMode) => {
    if (newMode === vaultStatus?.protectionMode) return;

    if (newMode === 'password') {
      onSetupVault();
      return;
    }

    if (newMode === 'plain') {
      const confirmed = window.confirm(t('settings.modePlainWarning'));
      if (!confirmed) return;
    }

    setModeChanging(true);
    try {
      const res = await window.api.vault.setProtectionMode(newMode);
      if (res.success) {
        onReloadVaultStatus?.();
      } else {
        alert(res.error || 'Failed to switch protection mode');
      }
    } catch (err: any) {
      alert(err.message || 'Error switching mode');
    } finally {
      setModeChanging(false);
    }
  };

  const handleToggleBiometrics = async (enabled: boolean) => {
    try {
      const res = await window.api.vault.toggleBiometrics(enabled);
      if (res.success) {
        onReloadVaultStatus?.();
      } else {
        alert(res.error || 'Failed to toggle biometrics');
      }
    } catch (err: any) {
      alert(err.message || 'Error toggling biometrics');
    }
  };

  const handleTestBiometrics = async () => {
    setBioTesting(true);
    setBioTestMsg(null);
    try {
      const res = await window.api.biometrics.promptVerification('Проверка биометрии Windows Hello в BesTTY');
      if (res.success) {
        setBioTestMsg(t('settings.biometricsTestSuccess'));
        setTimeout(() => setBioTestMsg(null), 4000);
      } else {
        alert(res.error || 'Биометрическая проверка отклонена');
      }
    } catch (err: any) {
      alert(err.message || 'Ошибка проверки биометрии');
    } finally {
      setBioTesting(false);
    }
  };

  return (
    <div className={`flex-1 flex flex-col h-full p-6 overflow-y-auto select-none ${
      isLight ? 'bg-[#f5f5f5] text-slate-800' : 'bg-[#181818] text-slate-100'
    }`}>
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-500/20">
          <div>
            <h2 className="text-xl font-bold tracking-tight flex items-center space-x-2">
              <Settings className="w-6 h-6 text-sky-500" />
              <span>{t('settings.title')}</span>
            </h2>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('settings.subtitle')}
            </p>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center space-x-1.5 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg shadow transition-all"
          >
            {saved ? <Check className="w-4 h-4 text-emerald-300" /> : <Save className="w-4 h-4" />}
            <span>{saved ? t('settings.saved') : t('settings.saveSettings')}</span>
          </button>
        </div>

        {/* Language & Theme Customization */}
        <div className={`border rounded-xl p-5 space-y-4 shadow-sm ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
        }`}>
          <h3 className="text-sm font-semibold flex items-center space-x-2">
            <Languages className="w-4 h-4 text-sky-500" />
            <span>{t('settings.language')} & {t('settings.theme')}</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Language Selector */}
            <div>
              <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('settings.language')}</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('ru')}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                    locale === 'ru'
                      ? 'bg-sky-600 text-white border-sky-500 shadow'
                      : isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-[#272727] border-[#3d3d3d] text-slate-300 hover:bg-[#333]'
                  }`}
                >
                  <span>🇷🇺</span>
                  <span>Русский</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('en')}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                    locale === 'en'
                      ? 'bg-sky-600 text-white border-sky-500 shadow'
                      : isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-[#272727] border-[#3d3d3d] text-slate-300 hover:bg-[#333]'
                  }`}
                >
                  <span>🇬🇧</span>
                  <span>English</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange('hy')}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                    locale === 'hy'
                      ? 'bg-sky-600 text-white border-sky-500 shadow'
                      : isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-[#272727] border-[#3d3d3d] text-slate-300 hover:bg-[#333]'
                  }`}
                >
                  <span>🇦🇲</span>
                  <span>Հայերեն</span>
                </button>
              </div>
            </div>

            {/* Theme Selector */}
            <div>
              <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('settings.theme')}</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleThemeChange('system')}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                    localSettings.theme === 'system'
                      ? 'bg-sky-600 text-white border-sky-500 shadow'
                      : isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-[#272727] border-[#3d3d3d] text-slate-300 hover:bg-[#333]'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span className="truncate">{t('settings.themeSystem')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('fluent-dark')}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                    localSettings.theme === 'fluent-dark'
                      ? 'bg-sky-600 text-white border-sky-500 shadow'
                      : isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-[#272727] border-[#3d3d3d] text-slate-300 hover:bg-[#333]'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span className="truncate">{t('settings.themeDark')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange('fluent-light')}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border flex items-center justify-center space-x-1.5 transition-all ${
                    localSettings.theme === 'fluent-light'
                      ? 'bg-sky-600 text-white border-sky-500 shadow'
                      : isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-[#272727] border-[#3d3d3d] text-slate-300 hover:bg-[#333]'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span className="truncate">{t('settings.themeLight')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Smart Shell Integration */}
        <div className={`border rounded-xl p-5 space-y-4 shadow-sm ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
        }`}>
          <h3 className="text-sm font-semibold flex items-center space-x-2">
            <FolderTree className="w-4 h-4 text-amber-500" />
            <span>{t('settings.smartFeatures')}</span>
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium block">
                {t('settings.osc7Title')}
              </span>
              <span className={`text-[11px] block mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                {t('settings.osc7Desc')}
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

          <div className="flex items-center justify-between pt-3 border-t border-slate-500/15">
            <div>
              <span className="text-xs font-medium block">
                {t('settings.gpuTitle')}
              </span>
              <span className={`text-[11px] block mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                {t('settings.gpuDesc')}
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
        <div className={`border rounded-xl p-5 space-y-4 shadow-sm ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
        }`}>
          <h3 className="text-sm font-semibold flex items-center space-x-2">
            <Terminal className="w-4 h-4 text-sky-500" />
            <span>{t('settings.terminalAppearance')}</span>
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('settings.fontFamily')}</label>
              <select
                value={localSettings.fontFamily}
                onChange={(e) => setLocalSettings({ ...localSettings, fontFamily: e.target.value })}
                className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                }`}
              >
                <option value="Cascadia Code, Consolas, monospace">Cascadia Code (Windows 11 Native)</option>
                <option value="JetBrains Mono, monospace">JetBrains Mono</option>
                <option value="Fira Code, monospace">Fira Code (with Ligatures)</option>
                <option value="Consolas, monospace">Consolas</option>
              </select>
            </div>

            <div>
              <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('settings.fontSize')}</label>
              <input
                type="number"
                min={10}
                max={24}
                value={localSettings.fontSize}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, fontSize: Number(e.target.value) })
                }
                className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                }`}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div>
              <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('settings.cursorStyle')}</label>
              <select
                value={localSettings.cursorStyle}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, cursorStyle: e.target.value as any })
                }
                className={`w-full border rounded px-3 py-1.5 text-xs focus:outline-none focus:border-sky-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                }`}
              >
                <option value="block">Block</option>
                <option value="underline">Underline</option>
                <option value="bar">Bar</option>
              </select>
            </div>

            <div>
              <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('settings.cursorBlink')}</label>
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
              <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('settings.scrollback')}</label>
              <input
                type="number"
                value={localSettings.scrollback}
                onChange={(e) =>
                  setLocalSettings({ ...localSettings, scrollback: Number(e.target.value) })
                }
                className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                }`}
              />
            </div>
          </div>
        </div>

        {/* Security & Vault */}
        <div className={`border rounded-xl p-5 space-y-5 shadow-sm ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
        }`}>
          <div>
            <h3 className="text-sm font-semibold flex items-center space-x-2">
              <Shield className="w-4 h-4 text-emerald-500" />
              <span>{t('settings.securityTitle')}</span>
            </h3>
            <p className={`text-xs mt-1 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('settings.securityDesc')}
            </p>
          </div>

          {/* Protection Mode Cards */}
          <div className="space-y-2">
            <label className={`block text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
              {t('settings.protectionMode')}
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* 1. System DPAPI */}
              <div
                onClick={() => !modeChanging && handleSetProtectionMode('system')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2.5 ${
                  vaultStatus?.protectionMode === 'system'
                    ? 'border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/30'
                    : isLight
                    ? 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    : 'border-[#333] bg-[#262626] hover:border-[#444]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  {vaultStatus?.protectionMode === 'system' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Активен
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold">{t('settings.modeSystem')}</div>
                  <div className={`text-[11px] mt-1 leading-snug ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{t('settings.modeSystemDesc')}</div>
                </div>
              </div>

              {/* 2. Password */}
              <div
                onClick={() => !modeChanging && handleSetProtectionMode('password')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2.5 ${
                  vaultStatus?.protectionMode === 'password'
                    ? 'border-sky-500 bg-sky-500/10 shadow-sm ring-1 ring-sky-500/30'
                    : isLight
                    ? 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    : 'border-[#333] bg-[#262626] hover:border-[#444]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="w-7 h-7 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  {vaultStatus?.protectionMode === 'password' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                      Активен
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold">{t('settings.modePassword')}</div>
                  <div className={`text-[11px] mt-1 leading-snug ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{t('settings.modePasswordDesc')}</div>
                </div>
              </div>

              {/* 3. Plain */}
              <div
                onClick={() => !modeChanging && handleSetProtectionMode('plain')}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2.5 ${
                  vaultStatus?.protectionMode === 'plain'
                    ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/30'
                    : isLight
                    ? 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    : 'border-[#333] bg-[#262626] hover:border-[#444]'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4" />
                  </div>
                  {vaultStatus?.protectionMode === 'plain' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                      Активен
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs font-semibold">{t('settings.modePlain')}</div>
                  <div className={`text-[11px] mt-1 leading-snug ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{t('settings.modePlainDesc')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Biometrics (Windows Hello) Block */}
          <div className={`p-4 rounded-xl border space-y-3 ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#1c1c1c] border-[#2c2c2c]'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  vaultStatus?.biometricsAvailable ? 'bg-sky-500/20 text-sky-400' : 'bg-slate-700/20 text-slate-500'
                }`}>
                  <Fingerprint className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold">{t('settings.biometricsTitle')}</h4>
                  <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {vaultStatus?.biometricsAvailable
                      ? t('settings.biometricsAvailable')
                      : t('settings.biometricsUnavailable')}
                  </p>
                </div>
              </div>

              {vaultStatus?.biometricsAvailable && (
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(vaultStatus?.biometricsEnabled)}
                    onChange={(e) => handleToggleBiometrics(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-sky-600"></div>
                </label>
              )}
            </div>

            {vaultStatus?.biometricsAvailable && (
              <div className="flex items-center space-x-3 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={handleTestBiometrics}
                  disabled={bioTesting}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center space-x-1.5 transition-all ${
                    isLight
                      ? 'bg-white hover:bg-slate-100 border-slate-300 text-slate-700'
                      : 'bg-[#2b2b2b] hover:bg-[#333] border-[#444] text-slate-200'
                  }`}
                >
                  <Fingerprint className="w-3.5 h-3.5 text-sky-400" />
                  <span>{bioTesting ? 'Проверка...' : t('settings.biometricsTest')}</span>
                </button>
                {bioTestMsg && (
                  <span className="text-[11px] text-emerald-400 font-medium flex items-center space-x-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>{bioTestMsg}</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-3 pt-1">
            {vaultStatus?.protectionMode === 'password' && (
              <button
                type="button"
                onClick={onSetupVault}
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-semibold transition-colors ${
                  isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-[#2b2b2b] hover:bg-[#333] border-[#444] text-slate-200 hover:text-white'
                }`}
              >
                {t('settings.changeMaster')}
              </button>
            )}
            {vaultStatus?.isUnlocked && (
              <button
                type="button"
                onClick={async () => {
                  await window.api.vault.lock();
                  onReloadVaultStatus?.();
                }}
                className="px-3.5 py-1.5 rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-xs font-semibold transition-colors"
              >
                {t('settings.lockVault')}
              </button>
            )}
          </div>
        </div>

        {/* About BesTTY Section */}
        <div className={`border rounded-xl p-5 space-y-4 shadow-sm relative overflow-hidden ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3.5">
              <img
                src={appLogo}
                alt="BesTTY"
                className="w-12 h-12 rounded-xl object-contain drop-shadow-md border border-white/10"
              />
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-bold font-mono">BesTTY</h3>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/20 font-medium">
                    v1.0.0
                  </span>
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                    Open Source
                  </span>
                </div>
                <p className={`text-xs mt-0.5 max-w-md ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {t('about.tagline')}
                </p>
              </div>
            </div>

            {onOpenAbout && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => onOpenAbout('updates')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border flex items-center space-x-1.5 transition-all ${
                    isLight 
                      ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' 
                      : 'bg-[#2b2b2b] hover:bg-[#333] border-[#444] text-slate-200'
                  }`}
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t('updater.title')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onOpenAbout('mission')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow transition-all flex items-center space-x-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t('about.title')}</span>
                </button>
              </div>
            )}
          </div>

          <div className={`p-3.5 rounded-lg border text-xs flex items-center justify-between ${
            isLight ? 'bg-rose-50/70 border-rose-200' : 'bg-rose-950/20 border-rose-500/20'
          }`}>
            <div className="space-y-0.5">
              <span className="font-semibold text-rose-500 flex items-center space-x-1.5">
                <Heart className="w-4 h-4 fill-rose-500" />
                <span>{t('about.donateTitle')}</span>
              </span>
              <p className={`text-[11px] max-w-lg ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                {t('about.donateSubtitle')}
              </p>
            </div>

            {onOpenAbout && (
              <button
                type="button"
                onClick={() => onOpenAbout('donate')}
                className="px-4 py-2 rounded-lg text-xs font-bold bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-md transition-all flex items-center space-x-1.5 flex-shrink-0"
              >
                <Heart className="w-3.5 h-3.5 fill-white" />
                <span>{t('about.donateTitle')}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
