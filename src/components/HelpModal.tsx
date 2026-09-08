import React, { useState } from 'react';
import { HelpCircle, X, Code, Shield, Network, Zap } from 'lucide-react';
import { useTranslation } from '../i18n';

interface HelpModalProps {
  isOpen: boolean;
  isLight?: boolean;
  initialTab?: 'editor' | 'vault' | 'tunnels' | 'smart';
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  isLight = false,
  initialTab = 'editor',
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'editor' | 'vault' | 'tunnels' | 'smart'>(initialTab);

  if (!isOpen) return null;

  const tabs = [
    { id: 'editor', label: t('help.tabEditor'), icon: Code },
    { id: 'vault', label: t('help.tabVault'), icon: Shield },
    { id: 'tunnels', label: t('help.tabTunnels'), icon: Network },
    { id: 'smart', label: t('help.tabSmart'), icon: Zap },
  ] as const;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div
        className={`border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#1e1e1e] border-[#333] text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between px-6 py-4 border-b ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#252525] border-[#303030]'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">{t('help.title')}</h3>
              <p className={`text-xs ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>{t('help.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div
          className={`flex border-b px-6 pt-2 space-x-2 ${
            isLight ? 'bg-slate-100/70 border-slate-200' : 'bg-[#181818] border-[#2d2d2d]'
          }`}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3.5 py-2.5 text-xs font-semibold rounded-t-lg transition-all border-b-2 ${
                  isActive
                    ? isLight
                      ? 'bg-white text-sky-600 border-sky-600 shadow-sm'
                      : 'bg-[#1e1e1e] text-sky-400 border-sky-500'
                    : isLight
                    ? 'text-slate-600 hover:text-slate-900 border-transparent'
                    : 'text-slate-400 hover:text-slate-200 border-transparent'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Content Area */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs leading-relaxed">
          {activeTab === 'editor' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Code className="w-5 h-5 text-emerald-500" />
                <h4 className="text-sm font-bold">{t('help.editorTitle')}</h4>
              </div>
              <p className={isLight ? 'text-slate-600' : 'text-slate-300'}>
                {t('help.editorP1')}
              </p>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                }`}
              >
                <span className="font-semibold block mb-1">⚡ In-Memory Stream:</span>
                {t('help.editorP2')}
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-amber-50/70 border-amber-200 text-amber-900' : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                }`}
              >
                <span className="font-semibold block mb-1">🛡️ Sudo Save (Elevation):</span>
                {t('help.editorP3')}
              </div>
            </div>
          )}

          {activeTab === 'vault' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-sky-500" />
                <h4 className="text-sm font-bold">{t('help.vaultTitle')}</h4>
              </div>
              <p className={isLight ? 'text-slate-600' : 'text-slate-300'}>
                {t('help.vaultP1')}
              </p>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-sky-50/70 border-sky-200 text-sky-900' : 'bg-sky-950/20 border-sky-800/40 text-sky-300'
                }`}
              >
                <span className="font-semibold block mb-1">🔑 PBKDF2 + AES-256-GCM:</span>
                {t('help.vaultP2')}
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-slate-100 border-slate-200 text-slate-800' : 'bg-[#252525] border-[#383838] text-slate-300'
                }`}
              >
                <span className="font-semibold block mb-1">🌐 Zero-Cloud Principle:</span>
                {t('help.vaultP3')}
              </div>
            </div>
          )}

          {activeTab === 'tunnels' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Network className="w-5 h-5 text-cyan-500" />
                <h4 className="text-sm font-bold">{t('help.tunnelsTitle')}</h4>
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#252525] border-[#383838] text-slate-300'
                }`}
              >
                <span className="font-semibold text-sky-500 block mb-1">🔹 Local Port Forward (-L):</span>
                {t('help.tunnelsP1')}
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#252525] border-[#383838] text-slate-300'
                }`}
              >
                <span className="font-semibold text-emerald-500 block mb-1">🔹 Remote Port Forward (-R):</span>
                {t('help.tunnelsP2')}
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-[#252525] border-[#383838] text-slate-300'
                }`}
              >
                <span className="font-semibold text-purple-500 block mb-1">🔹 Dynamic SOCKS5 Proxy (-D):</span>
                {t('help.tunnelsP3')}
              </div>
            </div>
          )}

          {activeTab === 'smart' && (
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-bold">{t('help.smartTitle')}</h4>
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-amber-50/60 border-amber-200 text-amber-900' : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
                }`}
              >
                <span className="font-semibold block mb-1">⚡ Auto-Decomposer:</span>
                {t('help.smartP1')}
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-sky-50/60 border-sky-200 text-sky-900' : 'bg-sky-950/20 border-sky-800/40 text-sky-300'
                }`}
              >
                <span className="font-semibold block mb-1">📂 OSC 7 Directory Sync:</span>
                {t('help.smartP2')}
              </div>
              <div
                className={`p-3.5 rounded-xl border ${
                  isLight ? 'bg-purple-50/60 border-purple-200 text-purple-900' : 'bg-purple-950/20 border-purple-800/40 text-purple-300'
                }`}
              >
                <span className="font-semibold block mb-1">🚀 WebGL GPU Acceleration:</span>
                {t('help.smartP3')}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className={`flex items-center justify-end px-6 py-3 border-t ${
            isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#252525] border-[#303030]'
          }`}
        >
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition-all"
          >
            {t('help.close')}
          </button>
        </div>
      </div>
    </div>
  );
};