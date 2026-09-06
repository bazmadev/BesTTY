import React, { useState, useEffect } from 'react';
import { BesTTYSettings } from '../types';
import { useTranslation, SupportedLocale } from '../i18n';
import { Settings, Shield, Terminal, Palette, FolderTree, Check, Save, Languages, Sun, Moon, Sparkles, Heart, Download } from 'lucide-react';

interface SettingsViewProps {
  settings: BesTTYSettings;
  isLight?: boolean;
  onSaveSettings: (settings: Partial<BesTTYSettings>) => void;
  onSetupVault: () => void;
  onOpenAbout?: (tab?: 'mission' | 'updates' | 'donate') => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  isLight = false,
  onSaveSettings,
  onSetupVault,
  onOpenAbout,
}) => {
  const { t, locale, setLocale } = useTranslation();
  const [localSettings, setLocalSettings] = useState<BesTTYSettings>(settings);
  const [saved, setSaved] = useState(false);

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

        {/* About BesTTY Section */}
        <div className={`border rounded-xl p-5 space-y-4 shadow-sm relative overflow-hidden ${
          isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#303030]'
        }`}>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3.5">
              <img
                src="/logo.png"
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
                <p className="text-xs text-slate-400 mt-0.5 max-w-md">
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
              <p className="text-[11px] text-slate-400 max-w-lg">
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
