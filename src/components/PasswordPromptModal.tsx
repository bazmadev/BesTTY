import React, { useState, useEffect } from 'react';
import { KeyRound, X, Eye, EyeOff, FolderOpen, Shield, Key, Lock } from 'lucide-react';
import { HostProfile, AuthType } from '../types';
import { useTranslation } from '../i18n';

export interface AuthPromptResult {
  authType: AuthType;
  password?: string;
  privateKeyPath?: string;
  passphrase?: string;
}

interface PasswordPromptModalProps {
  isOpen: boolean;
  isLight?: boolean;
  host: HostProfile | null;
  onClose: () => void;
  onSubmit: (result: AuthPromptResult, remember: boolean) => void;
}

export const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({
  isOpen,
  isLight = false,
  host,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [authType, setAuthType] = useState<AuthType>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [remember, setRemember] = useState(false);

  useEffect(() => {
    if (host) {
      setAuthType(host.authType || 'password');
      setPassword(host.password || '');
      setPrivateKeyPath(host.privateKeyPath || '');
      setPassphrase(host.passphrase || '');
      setRemember(false);
    }
  }, [host, isOpen]);

  if (!isOpen || !host) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(
      {
        authType,
        password: authType === 'password' ? password : undefined,
        privateKeyPath: authType === 'privateKey' ? privateKeyPath : undefined,
        passphrase: authType === 'privateKey' && passphrase ? passphrase : undefined,
      },
      remember
    );
  };

  const handleBrowseKey = async () => {
    const filePath = await window.api.dialog.openKeyFile();
    if (filePath) {
      setPrivateKeyPath(filePath);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div
        className={`border w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4 ${
          isLight ? 'bg-white border-slate-200 text-slate-900' : 'bg-[#202020] border-[#383838] text-white'
        }`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between border-b pb-3 ${
            isLight ? 'border-slate-200' : 'border-[#303030]'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
              <KeyRound className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold tracking-tight">
              {t('authPrompt.title')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-lg transition-colors ${
              isLight ? 'text-slate-400 hover:text-slate-700 hover:bg-slate-100' : 'text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Target Info */}
        <div
          className={`px-3 py-2 rounded-lg text-xs font-mono flex items-center justify-between border ${
            isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#181818] border-[#333] text-slate-300'
          }`}
        >
          <span className="text-[11px] text-slate-400 font-sans">{t('authPrompt.target')}</span>
          <span className="font-semibold text-sky-500">
            {host.username}@{host.host}:{host.port}
          </span>
        </div>

        {/* Auth Method Selector */}
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            {t('authPrompt.authMethod')}
          </label>
          <div
            className={`grid grid-cols-3 gap-1.5 p-1 rounded-xl border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181818] border-[#303030]'
            }`}
          >
            <button
              type="button"
              onClick={() => setAuthType('password')}
              className={`flex items-center justify-center space-x-1.5 py-1.5 text-xs rounded-lg font-medium transition-all ${
                authType === 'password'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{t('authPrompt.password')}</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthType('privateKey')}
              className={`flex items-center justify-center space-x-1.5 py-1.5 text-xs rounded-lg font-medium transition-all ${
                authType === 'privateKey'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{t('authPrompt.privateKey')}</span>
            </button>
            <button
              type="button"
              onClick={() => setAuthType('agent')}
              className={`flex items-center justify-center space-x-1.5 py-1.5 text-xs rounded-lg font-medium transition-all ${
                authType === 'agent'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : isLight
                  ? 'text-slate-600 hover:text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              <span>{t('authPrompt.agent')}</span>
            </button>
          </div>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {authType === 'password' && (
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                {t('authPrompt.password')}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  required
                  placeholder={t('modal.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 pr-10 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                      : 'bg-[#272727] border-[#3d3d3d] text-white placeholder:text-slate-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-sky-500"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {authType === 'privateKey' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t('authPrompt.keyPath')}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    required
                    placeholder="C:\Users\...\.ssh\id_rsa"
                    value={privateKeyPath}
                    onChange={(e) => setPrivateKeyPath(e.target.value)}
                    className={`flex-1 border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400'
                        : 'bg-[#272727] border-[#3d3d3d] text-white placeholder:text-slate-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleBrowseKey}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                        : 'bg-[#2a2a2a] hover:bg-[#333] border-[#444] text-slate-200'
                    }`}
                    title={t('modal.browseKey')}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>{t('authPrompt.browse')}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {t('authPrompt.passphrase')}
                </label>
                <input
                  type="password"
                  placeholder="Passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className={`w-full border rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isLight
                      ? 'bg-slate-50 border-slate-300 text-slate-900'
                      : 'bg-[#272727] border-[#3d3d3d] text-white'
                  }`}
                />
              </div>
            </div>
          )}

          {authType === 'agent' && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center space-x-2.5 ${
                isLight ? 'bg-sky-50/70 border-sky-200 text-sky-900' : 'bg-[#181818] border-[#333] text-slate-300'
              }`}
            >
              <Shield className="w-5 h-5 text-sky-500 flex-shrink-0" />
              <span>{t('authPrompt.agentNotice')}</span>
            </div>
          )}

          <label className="flex items-center space-x-2.5 text-xs text-slate-400 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-4 h-4 accent-sky-500 rounded"
            />
            <span className={isLight ? 'text-slate-600' : 'text-slate-300'}>
              {t('authPrompt.remember')}
            </span>
          </label>

          <div
            className={`flex items-center justify-end space-x-2 pt-3 border-t ${
              isLight ? 'border-slate-200' : 'border-[#303030]'
            }`}
          >
            <button
              type="button"
              onClick={onClose}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                isLight
                  ? 'text-slate-600 hover:bg-slate-100'
                  : 'text-slate-300 hover:bg-white/10'
              }`}
            >
              {t('authPrompt.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition-all"
            >
              {t('authPrompt.connect')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

