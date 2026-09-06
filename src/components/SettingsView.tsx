import React, { useState, useEffect } from 'react';
import { BesTTYSettings, UpdateState } from '../types';
import { useTranslation, SupportedLocale } from '../i18n';
import { Settings, Shield, Terminal, Palette, FolderTree, Check, Save, Languages, Sun, Moon, Download, RefreshCw, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface SettingsViewProps {
  settings: BesTTYSettings;
  isLight?: boolean;
  onSaveSettings: (settings: Partial<BesTTYSettings>) => void;
  onSetupVault: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  isLight = false,
  onSaveSettings,
  onSetupVault,
}) => {
  const { t, locale, setLocale } = useTranslation();
  const [localSettings, setLocalSettings] = useState<BesTTYSettings>(settings);
  const [saved, setSaved] = useState(false);

  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
    currentVersion: '1.0.0',
  });

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  useEffect(() => {
    if (!window.api?.updater) return;
    window.api.updater.getStatus().then(setUpdateState);
    const unsubscribe = window.api.updater.onStatus((st) => setUpdateState(st));
    return () => unsubscribe();
  }, []);

  const handleCheckUpdate = async () => {
    if (!window.api?.updater) return;
    try {
      const res = await window.api.updater.check();
      setUpdateState(res);
    } catch (e: any) {
      setUpdateState((prev) => ({ ...prev, status: 'error', error: e.message }));
    }
  };

  const handleDownloadUpdate = async () => {
    if (!window.api?.updater) return;
    await window.api.updater.download();
  };

  const handleInstallUpdate = () => {
    if (!window.api?.updater) return;
    window.api.updater.install();
  };

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

  return (
    <div className={`flex-1 flex flex-col h-full p-6 overflow-y-auto select-none ${
      isLight ? 'bg-[#f5f5f5] text-slate-800' : 'bg-[#181818] text-slate-100'
    }`}>
      <div className="max-w-3xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-500/20">
          <div>
            <h2 className="text-xl font-bold flex items-center space-x-2">
              <Settings className="w-6 h-6 text-sky-500" />
              <span>{t('settings.title')}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
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
              <label className="block text-xs text-slate-400 mb-1 font-medium">{t('settings.language')}</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleLanguageChange('ru')}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center space-x-2 transition-all ${
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
                  className={`py-2 px-3 rounded-lg text-xs font-medium border flex items-center justify-center space-x-2 transition-all ${
                    locale === 'en'
                      ? 'bg-sky-600 text-white border-sky-500 shadow'
                      : isLight ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200' : 'bg-[#272727] border-[#3d3d3d] text-slate-300 hover:bg-[#333]'
                  }`}
                >
                  <span>🇺🇸</span>
                  <span>English</span>
                </button>
              </div>
            </div>

            {/* Theme Selector */}
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">{t('settings.theme')}</label>
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

        {/* SmarTTY Signature Features */}
        <div className={`border rounded-xl p-5 space-y-4 shadow-sm ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
        }`}>
          <h3 className="text-sm font-semibold flex items-center space-x-2">
            <FolderTree className="w-4 h-4 text-amber-500" />
            <span>{t('settings.smarttyFeatures')}</span>
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-medium block">
                {t('settings.osc7Title')}
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
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
              <span className="text-[11px] text-slate-400 block mt-0.5">
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
              <label className="block text-xs text-slate-400 mb-1">{t('settings.fontFamily')}</label>
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
              <label className="block text-xs text-slate-400 mb-1">{t('settings.fontSize')}</label>
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
              <label className="block text-xs text-slate-400 mb-1">{t('settings.cursorStyle')}</label>
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
              <label className="block text-xs text-slate-400 mb-1">{t('settings.cursorBlink')}</label>
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
              <label className="block text-xs text-slate-400 mb-1">{t('settings.scrollback')}</label>
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
        <div className={`border rounded-xl p-5 space-y-4 shadow-sm ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
        }`}>
          <h3 className="text-sm font-semibold flex items-center space-x-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>{t('settings.securityTitle')}</span>
          </h3>
          <p className="text-xs text-slate-400">
            {t('settings.securityDesc')}
          </p>
          <button
            onClick={onSetupVault}
            className={`px-4 py-2 rounded-lg border text-xs font-semibold transition-colors ${
              isLight ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800' : 'bg-[#2b2b2b] hover:bg-[#333] border-[#444] text-slate-200 hover:text-white'
            }`}
          >
            {t('settings.changeMaster')}
          </button>
        </div>

        {/* OTA Updates Section */}
        <div className={`border rounded-xl p-5 space-y-4 shadow-sm ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
        }`}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center space-x-2">
              <Download className="w-4 h-4 text-sky-500" />
              <span>{t('updater.title')}</span>
            </h3>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/20 font-medium">
              v{updateState.currentVersion}
            </span>
          </div>

          <p className="text-xs text-slate-400">
            {t('updater.desc')}
          </p>

          {/* Status feedback block */}
          {updateState.status === 'not-available' && (
            <div className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
              isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-emerald-950/30 border-emerald-500/20 text-emerald-400'
            }`}>
              <Check className="w-4 h-4 text-emerald-500" />
              <span>{t('updater.upToDate')}</span>
            </div>
          )}

          {updateState.status === 'available' && (
            <div className={`p-3.5 rounded-lg border text-xs space-y-2.5 ${
              isLight ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-sky-950/30 border-sky-500/30 text-sky-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>{t('updater.available')} <strong className="font-mono text-sm">{updateState.availableVersion}</strong></span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadUpdate}
                  className="px-3 py-1.5 rounded-lg font-semibold bg-sky-600 hover:bg-sky-500 text-white shadow transition-all"
                >
                  {t('updater.downloadNow')}
                </button>
              </div>
            </div>
          )}

          {updateState.status === 'downloading' && (
            <div className={`p-3.5 rounded-lg border text-xs space-y-2 ${
              isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#282828] border-white/10'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-medium flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-500" />
                  {t('updater.downloading')}
                </span>
                <span className="font-mono font-bold text-sky-500">
                  {updateState.progress?.percent || 0}%
                </span>
              </div>
              <div className="w-full h-2 rounded-full bg-black/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-teal-400 transition-all duration-300"
                  style={{ width: `${updateState.progress?.percent || 0}%` }}
                />
              </div>
            </div>
          )}

          {updateState.status === 'downloaded' && (
            <div className={`p-3.5 rounded-lg border text-xs space-y-2.5 ${
              isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="font-semibold flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500" />
                  <span>{t('updater.downloaded')}</span>
                </div>
                <button
                  type="button"
                  onClick={handleInstallUpdate}
                  className="px-3.5 py-1.5 rounded-lg font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
                >
                  {t('updater.restartAndInstall')}
                </button>
              </div>
            </div>
          )}

          {updateState.status === 'error' && (
            <div className={`p-3 rounded-lg border text-xs text-red-400 flex items-start gap-2 ${
              isLight ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-950/30 border-red-500/20'
            }`}>
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{t('updater.updateError')} {updateState.error}</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              disabled={updateState.status === 'checking' || updateState.status === 'downloading'}
              onClick={handleCheckUpdate}
              className={`px-4 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 ${
                isLight
                  ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-800'
                  : 'bg-[#2b2b2b] hover:bg-[#333] border-[#444] text-slate-200 hover:text-white'
              }`}
            >
              {updateState.status === 'checking' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>{updateState.status === 'checking' ? t('updater.checking') : t('updater.checkNow')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
