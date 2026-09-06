import React, { useState, useEffect } from 'react';
import { 
  X, Heart, Sparkles, Terminal, FolderTree, Code, Activity, 
  ShieldCheck, Network, Copy, Check, ExternalLink, CreditCard, Coins,
  Download, RefreshCw, Loader2, AlertCircle
} from 'lucide-react';
import { useTranslation } from '../i18n';
import { UpdateState } from '../types';

interface AboutModalProps {
  isOpen: boolean;
  isLight?: boolean;
  initialTab?: 'mission' | 'updates' | 'donate';
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  isLight = false,
  initialTab = 'mission',
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'mission' | 'updates' | 'donate'>(initialTab);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // OTA Updater state inside About modal
  const [updateState, setUpdateState] = useState<UpdateState>({
    status: 'idle',
    currentVersion: '1.0.0',
  });

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, isOpen]);

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

  if (!isOpen) return null;

  const handleCopy = (text: string, key: string) => {
    if (window.api?.clipboard) {
      window.api.clipboard.writeText(text);
    } else {
      navigator.clipboard.writeText(text);
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const solvedTasks = [
    {
      icon: <Terminal className="w-4 h-4 text-sky-400 flex-shrink-0" />,
      title: 'GPU Terminal',
      desc: t('about.taskGpu'),
    },
    {
      icon: <FolderTree className="w-4 h-4 text-amber-400 flex-shrink-0" />,
      title: 'Smart OSC 7 Sync',
      desc: t('about.taskOsc7'),
    },
    {
      icon: <Code className="w-4 h-4 text-emerald-400 flex-shrink-0" />,
      title: 'Monaco Editor & Sudo',
      desc: t('about.taskEditor'),
    },
    {
      icon: <Activity className="w-4 h-4 text-purple-400 flex-shrink-0" />,
      title: 'Mini-Monitor',
      desc: t('about.taskMonitor'),
    },
    {
      icon: <ShieldCheck className="w-4 h-4 text-teal-400 flex-shrink-0" />,
      title: 'AES-256-GCM Vault',
      desc: t('about.taskVault'),
    },
    {
      icon: <Network className="w-4 h-4 text-blue-400 flex-shrink-0" />,
      title: 'Tunnels & SOCKS5',
      desc: t('about.taskTunnels'),
    },
  ];

  const cryptoWallets = [
    {
      name: 'USDT (TRC-20)',
      address: 'TXq7s92mQZk9vQ4m8L7wP91vX5aK8j1eNp',
      network: 'Tron Network',
    },
    {
      name: 'TON (The Open Network)',
      address: 'EQDYP_1k9Vxm8qW5aK7sQ92mZk8vP91wX5aK8j1eNp4mL7wP',
      network: 'TON',
    },
    {
      name: 'Bitcoin (BTC)',
      address: 'bc1q9v8k7s6m5w4a3x2z1y0p9o8n7m6l5k4j3h2g1f',
      network: 'Bitcoin Native SegWit',
    },
    {
      name: 'Ethereum (ETH / ERC-20)',
      address: '0x71C8F39B92b5e28a47B79B51E2b4352f195861F3',
      network: 'Ethereum Mainnet',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className={`border w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden transition-all ${
        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#1c1c1c] border-[#383838] text-white'
      }`}>
        {/* Header Hero with BesTTY Logo */}
        <div className={`p-6 border-b flex items-start justify-between relative overflow-hidden ${
          isLight 
            ? 'bg-gradient-to-r from-sky-50 via-slate-50 to-indigo-50 border-slate-200' 
            : 'bg-gradient-to-r from-[#182028] via-[#1a1a1a] to-[#221828] border-[#2e2e2e]'
        }`}>
          {/* Ambient Glow */}
          <div className="absolute top-0 left-10 w-40 h-40 bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />

          <div className="flex items-center space-x-4 relative z-10">
            <img
              src="/logo.png"
              alt="BesTTY Logo"
              className="w-16 h-16 rounded-2xl object-contain drop-shadow-xl shadow-sky-500/20 border border-white/10"
            />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-black tracking-tight font-mono">BesTTY</h2>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-400 border border-sky-500/30">
                  v{updateState.currentVersion || '1.0.0'}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Open Source
                </span>

                {(updateState.status === 'available' || updateState.status === 'downloaded') && (
                  <button
                    type="button"
                    onClick={() => setActiveTab('updates')}
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow animate-pulse hover:animate-none flex items-center space-x-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3 text-amber-200" />
                    <span>{t('updater.updateBadge')}</span>
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                {t('about.subtitle')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors relative z-10 ${
              isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className={`flex border-b px-6 pt-2 space-x-4 ${
          isLight ? 'border-slate-200 bg-slate-50/50' : 'border-[#2d2d2d] bg-[#181818]'
        }`}>
          <button
            onClick={() => setActiveTab('mission')}
            className={`pb-2.5 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition-all ${
              activeTab === 'mission'
                ? 'border-sky-500 text-sky-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('about.tabMission')}</span>
          </button>

          <button
            onClick={() => setActiveTab('updates')}
            className={`pb-2.5 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition-all relative ${
              activeTab === 'updates'
                ? 'border-sky-500 text-sky-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>{t('about.tabUpdates')}</span>
            {(updateState.status === 'available' || updateState.status === 'downloaded') && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping absolute -top-0.5 right-0" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('donate')}
            className={`pb-2.5 text-xs font-semibold flex items-center space-x-1.5 border-b-2 transition-all ${
              activeTab === 'donate'
                ? 'border-rose-500 text-rose-500'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
            <span>{t('about.tabDonate')}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'mission' && (
            <>
              {/* Mission Statement */}
              <div className={`p-4 rounded-xl border space-y-2 leading-relaxed ${
                isLight ? 'bg-sky-50/50 border-sky-200 text-slate-800' : 'bg-sky-950/20 border-sky-500/20 text-slate-200'
              }`}>
                <div className="flex items-center space-x-2 text-sky-400 font-bold text-xs uppercase tracking-wider">
                  <Sparkles className="w-4 h-4" />
                  <span>{t('about.missionTitle')}</span>
                </div>
                <p className="text-xs leading-relaxed">
                  {t('about.missionText')}
                </p>
              </div>

              {/* Solved Problems Grid */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {t('about.tasksTitle')}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {solvedTasks.map((task, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border flex items-start space-x-3 transition-colors ${
                        isLight ? 'bg-slate-50 border-slate-200 hover:bg-slate-100' : 'bg-[#222222] border-[#303030] hover:bg-[#282828]'
                      }`}
                    >
                      <div className="mt-0.5 p-1.5 rounded-lg bg-black/10 dark:bg-white/5">
                        {task.icon}
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-xs font-semibold text-sky-500 dark:text-sky-400">{task.title}</div>
                        <div className="text-[11px] text-slate-400 leading-snug">{task.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'updates' && (
            <div className="space-y-5">
              {/* Updater Status Card */}
              <div className={`p-4 rounded-xl border space-y-3 ${
                isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#202020] border-[#303030]'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 rounded-lg bg-sky-500/10 text-sky-500">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold">{t('updater.title')}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">{t('updater.desc')}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] text-slate-400 block">{t('updater.currentVersion')}</span>
                    <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/20">
                      v{updateState.currentVersion}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status feedback block */}
              {updateState.status === 'not-available' && (
                <div className={`p-4 rounded-xl border text-xs flex items-center space-x-3 ${
                  isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-emerald-950/30 border-emerald-500/20 text-emerald-400'
                }`}>
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 flex-shrink-0">
                    <Check className="w-5 h-5 text-emerald-500" />
                  </div>
                  <div>
                    <div className="font-semibold">{t('updater.upToDate')}</div>
                    <div className="text-[11px] opacity-80 mt-0.5 font-mono">BesTTY v{updateState.currentVersion}</div>
                  </div>
                </div>
              )}

              {updateState.status === 'available' && (
                <div className={`p-4 rounded-xl border text-xs space-y-3 ${
                  isLight ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-sky-950/30 border-sky-500/30 text-sky-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 flex-shrink-0">
                        <Sparkles className="w-5 h-5 text-amber-400" />
                      </div>
                      <div>
                        <div className="font-bold text-sm">
                          {t('updater.available')} <span className="font-mono text-sky-400">v{updateState.availableVersion}</span>
                        </div>
                        <div className="text-[11px] opacity-80 mt-0.5">Готово к скачиванию через защищенный канал</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDownloadUpdate}
                      className="px-4 py-2 rounded-lg font-bold bg-sky-600 hover:bg-sky-500 text-white shadow transition-all flex items-center space-x-1.5 flex-shrink-0"
                    >
                      <Download className="w-4 h-4" />
                      <span>{t('updater.downloadNow')}</span>
                    </button>
                  </div>
                </div>
              )}

              {updateState.status === 'downloading' && (
                <div className={`p-4 rounded-xl border text-xs space-y-3 ${
                  isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#282828] border-white/10'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-sky-500" />
                      <span>{t('updater.downloading')}</span>
                    </span>
                    <span className="font-mono font-bold text-sm text-sky-500">
                      {updateState.progress?.percent || 0}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full bg-black/20 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-500 to-teal-400 transition-all duration-300"
                      style={{ width: `${updateState.progress?.percent || 0}%` }}
                    />
                  </div>
                </div>
              )}

              {updateState.status === 'downloaded' && (
                <div className={`p-4 rounded-xl border text-xs space-y-3 ${
                  isLight ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 flex-shrink-0">
                        <Check className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <div className="font-bold text-sm">{t('updater.downloaded')}</div>
                        <div className="text-[11px] opacity-80 mt-0.5">Перезапустите приложение для применения обновления</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleInstallUpdate}
                      className="px-4 py-2 rounded-lg font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all flex items-center space-x-1.5 flex-shrink-0"
                    >
                      <RefreshCw className="w-4 h-4" />
                      <span>{t('updater.restartAndInstall')}</span>
                    </button>
                  </div>
                </div>
              )}

              {updateState.status === 'error' && (
                <div className={`p-3.5 rounded-xl border text-xs text-red-400 flex items-start gap-2.5 ${
                  isLight ? 'bg-red-50 border-red-200 text-red-700' : 'bg-red-950/30 border-red-500/20'
                }`}>
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">{t('updater.updateError')}</div>
                    <div className="text-[11px] opacity-90 mt-0.5">{updateState.error}</div>
                  </div>
                </div>
              )}

              {/* Action Button: Check for updates */}
              <div className="pt-1 flex items-center justify-between">
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

                <span className="text-[11px] text-slate-400 font-mono">
                  GitHub Releases • OTA Stream
                </span>
              </div>
            </div>
          )}

          {activeTab === 'donate' && (
            <div className="space-y-6">
              {/* Donate Header Banner */}
              <div className={`p-4 rounded-xl border text-center space-y-2 ${
                isLight ? 'bg-rose-50/60 border-rose-200 text-slate-800' : 'bg-rose-950/20 border-rose-500/20 text-slate-200'
              }`}>
                <div className="inline-flex p-2.5 rounded-full bg-rose-500/15 text-rose-500 mb-1">
                  <Heart className="w-6 h-6 fill-rose-500" />
                </div>
                <h3 className="text-sm font-bold">{t('about.donateTitle')}</h3>
                <p className="text-xs text-slate-400 max-w-lg mx-auto leading-relaxed">
                  {t('about.donateSubtitle')}
                </p>
              </div>

              {/* Direct Donation Channels */}
              <div className="space-y-4">
                {/* Bank Card / СБП */}
                <div className={`p-4 rounded-xl border space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#222222] border-[#303030]'
                }`}>
                  <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-400">
                    <CreditCard className="w-4 h-4" />
                    <span>{t('about.donateCard')}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Быстрый перевод через Систему быстрых платежей (СБП), банковские карты МИР / Visa / MasterCard или ЮMoney.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <a
                      href="https://boosty.to"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow transition-all"
                    >
                      <span>Boosty</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://yoomoney.ru"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold flex items-center space-x-1.5 shadow transition-all"
                    >
                      <span>ЮMoney / Банковская карта</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                    <a
                      href="https://github.com/sponsors"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold flex items-center space-x-1.5 shadow transition-all"
                    >
                      <span>GitHub Sponsors</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>

                {/* Cryptocurrency Wallets */}
                <div className={`p-4 rounded-xl border space-y-3 ${
                  isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#222222] border-[#303030]'
                }`}>
                  <div className="flex items-center space-x-2 text-xs font-semibold text-amber-400">
                    <Coins className="w-4 h-4" />
                    <span>{t('about.donateCrypto')}</span>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    {cryptoWallets.map((w, idx) => (
                      <div
                        key={idx}
                        className={`p-2.5 rounded-lg border flex items-center justify-between transition-colors ${
                          isLight ? 'bg-white border-slate-300' : 'bg-[#181818] border-[#383838]'
                        }`}
                      >
                        <div className="truncate flex-1 mr-2">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-sky-400">{w.name}</span>
                            <span className="text-[10px] text-slate-500 font-sans">({w.network})</span>
                          </div>
                          <div className="text-[11px] text-slate-400 truncate select-all">{w.address}</div>
                        </div>

                        <button
                          onClick={() => handleCopy(w.address, w.name)}
                          className="px-2.5 py-1 rounded bg-sky-600/15 hover:bg-sky-600/25 border border-sky-500/30 text-sky-400 text-[11px] font-sans font-medium flex items-center space-x-1 flex-shrink-0 transition-all"
                        >
                          {copiedKey === w.name ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">{t('about.copySuccess')}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>{t('about.copyButton')}</span>
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Thank You Note */}
              <div className="text-center text-xs text-slate-400 font-medium pt-2">
                {t('about.thankYou')}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className={`px-6 py-3 border-t flex items-center justify-between text-xs text-slate-400 ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#222222] border-[#2e2e2e]'
        }`}>
          <span className="font-mono text-[11px]">BesTTY &copy; 2026 • Windows 11 Fluent App</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white font-semibold shadow transition-all"
          >
            {t('about.close')}
          </button>
        </div>
      </div>
    </div>
  );
};
