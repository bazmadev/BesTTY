import React, { useState } from 'react';
import { 
  X, Heart, Sparkles, Terminal, FolderTree, Code, Activity, 
  ShieldCheck, Network, Copy, Check, ExternalLink, CreditCard, Coins, Globe
} from 'lucide-react';
import { useTranslation } from '../i18n';

interface AboutModalProps {
  isOpen: boolean;
  isLight?: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({
  isOpen,
  isLight = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'mission' | 'donate'>('mission');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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
                  v1.0.0
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Open Source
                </span>
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
            <span>{t('about.missionTitle')} & {t('about.tasksTitle')}</span>
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
            <span>{t('about.donateTitle')}</span>
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
