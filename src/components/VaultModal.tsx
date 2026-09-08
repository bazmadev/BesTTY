import React, { useState, useEffect } from 'react';
import { Lock, X, AlertCircle, Key, RefreshCw, Copy, Check, ShieldCheck, ArrowLeft, Fingerprint, Shield } from 'lucide-react';
import { VaultStatus } from '../types';
import { useTranslation } from '../i18n';
import { generateMnemonicPhrase, generateAlphanumericKey } from '../utils/recoveryKey';

interface VaultModalProps {
  isOpen: boolean;
  isLight?: boolean;
  onClose: () => void;
  vaultStatus: VaultStatus;
  onUnlockSuccess: () => void;
}

export const VaultModal: React.FC<VaultModalProps> = ({
  isOpen,
  isLight = false,
  onClose,
  vaultStatus,
  onUnlockSuccess,
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'unlock' | 'setup' | 'recover'>('unlock');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Setup mode recovery options
  const [recoveryType, setRecoveryType] = useState<'mnemonic' | 'alphanumeric'>('mnemonic');
  const [generatedRecoveryKey, setGeneratedRecoveryKey] = useState('');
  const [hasConfirmedSaved, setHasConfirmedSaved] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Recovery mode inputs
  const [inputRecoveryKey, setInputRecoveryKey] = useState('');

  const handleBiometricUnlock = async () => {
    setError(null);
    setLoading(true);
    try {
      const ok = await window.api.vault.unlockWithBiometrics();
      if (ok) {
        onUnlockSuccess();
        onClose();
      } else {
        setError(t('vault.incorrect') || 'Biometric verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Biometric error');
    } finally {
      setLoading(false);
    }
  };

  const handleSystemUnlock = async () => {
    setError(null);
    setLoading(true);
    try {
      const ok = await window.api.vault.unlock('');
      if (ok) {
        onUnlockSuccess();
        onClose();
      } else {
        setError(t('vault.incorrect') || 'Failed to unlock with Windows DPAPI');
      }
    } catch (err: any) {
      setError(err.message || 'System unlock error');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToSystem = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await window.api.vault.setProtectionMode('system');
      if (res.success) {
        onUnlockSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to switch mode');
      }
    } catch (err: any) {
      setError(err.message || 'Error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSuccessMsg(null);
      setPassword('');
      setConfirmPassword('');
      setInputRecoveryKey('');
      setHasConfirmedSaved(false);
      setIsCopied(false);

      if (!vaultStatus.isConfigured && vaultStatus.protectionMode === 'password') {
        setMode('setup');
        regenerateKey('mnemonic');
      } else {
        setMode('unlock');
      }
    }
  }, [isOpen, vaultStatus.isConfigured, vaultStatus.protectionMode]);

  const regenerateKey = (type: 'mnemonic' | 'alphanumeric') => {
    const key = type === 'mnemonic' ? generateMnemonicPhrase() : generateAlphanumericKey();
    setGeneratedRecoveryKey(key);
    setIsCopied(false);
  };

  const handleCopyKey = () => {
    if (generatedRecoveryKey) {
      if (window.api?.clipboard) {
        window.api.clipboard.writeText(generatedRecoveryKey);
      } else {
        navigator.clipboard.writeText(generatedRecoveryKey);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleDownloadKey = () => {
    const blob = new Blob([
      `BesTTY Encrypted Vault - Emergency Recovery Key\n` +
      `Date: ${new Date().toLocaleString()}\n` +
      `Type: ${recoveryType === 'mnemonic' ? '12-Word Mnemonic Phrase' : '24-Character Recovery Key'}\n\n` +
      `Key:\n${generatedRecoveryKey}\n\n` +
      `Keep this file safe! It is required to reset your master password without losing saved SSH hosts.`
    ], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bestty-vault-recovery-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  const handleUnlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const ok = await window.api.vault.unlock(password);
      if (ok) {
        onUnlockSuccess();
        onClose();
      } else {
        setError(t('vault.incorrect'));
      }
    } catch (err: any) {
      setError(err.message || 'Unlock error');
    } finally {
      setLoading(false);
    }
  };

  const handleSetupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(t('vault.mismatch'));
      return;
    }

    if (!hasConfirmedSaved) {
      setError(t('vault.savedKeyConfirm'));
      return;
    }

    setLoading(true);
    try {
      const res = await window.api.vault.setupMasterPassword(password, generatedRecoveryKey);
      if (res.success) {
        onUnlockSuccess();
        onClose();
      } else {
        setError(res.error || 'Failed to setup master password');
      }
    } catch (err: any) {
      setError(err.message || 'Setup error');
    } finally {
      setLoading(false);
    }
  };

  const handleRecoverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inputRecoveryKey.trim()) {
      setError('Please provide your recovery phrase or key');
      return;
    }

    if (password !== confirmPassword) {
      setError(t('vault.mismatch'));
      return;
    }

    setLoading(true);
    try {
      const res = await window.api.vault.recoverWithKey(inputRecoveryKey.trim(), password);
      if (res.success) {
        setSuccessMsg(t('vault.recoverySuccess'));
        setTimeout(() => {
          onUnlockSuccess();
          onClose();
        }, 1200);
      } else {
        setError(res.error || t('vault.recoveryFailed'));
      }
    } catch (err: any) {
      setError(err.message || t('vault.recoveryFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`border w-full ${mode === 'setup' ? 'max-w-lg' : 'max-w-md'} rounded-xl shadow-2xl p-6 space-y-4 transition-all ${
        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#202020] border-[#383838] text-white'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between border-b pb-3 ${
          isLight ? 'border-slate-200' : 'border-[#303030]'
        }`}>
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-semibold">
              {mode === 'unlock' && t('vault.unlockTitle')}
              {mode === 'setup' && t('vault.setTitle')}
              {mode === 'recover' && t('vault.recoverTitle')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className={`transition-colors ${isLight ? 'text-slate-500 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Description */}
        <p className={`text-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
          {mode === 'unlock' && (vaultStatus.protectionMode === 'system' ? t('vault.systemModeDesc') : t('vault.unlockDesc'))}
          {mode === 'setup' && t('vault.setDesc')}
          {mode === 'recover' && t('vault.recoverDesc')}
        </p>

        {/* Alerts */}
        {error && (
          <div className="flex items-center space-x-1.5 p-2 bg-rose-500/15 border border-rose-500/40 rounded text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center space-x-1.5 p-2 bg-emerald-500/15 border border-emerald-500/40 rounded text-xs text-emerald-600 dark:text-emerald-300">
            <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* MODE: UNLOCK */}
        {mode === 'unlock' && (
          vaultStatus.protectionMode === 'system' ? (
            <div className="space-y-4">
              <div className={`p-4 rounded-xl border flex flex-col items-center space-y-3 text-center ${
                isLight ? 'bg-sky-50/70 border-sky-200 text-slate-800' : 'bg-[#1a2230] border-sky-500/30 text-slate-200'
              }`}>
                <div className="w-12 h-12 rounded-full bg-sky-500/15 flex items-center justify-center text-sky-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-sky-400">
                    {t('vault.systemModeTitle')}
                  </h4>
                  <p className={`text-[11px] mt-1 max-w-xs leading-relaxed ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                    {t('vault.systemModeDesc')}
                  </p>
                </div>

                {vaultStatus.biometricsAvailable && vaultStatus.biometricsEnabled ? (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleBiometricUnlock}
                    className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition-all flex items-center justify-center space-x-2"
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span>{loading ? t('vault.processing') : t('vault.unlockWithHello')}</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSystemUnlock}
                    className="w-full py-2.5 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition-all flex items-center justify-center space-x-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>{loading ? t('vault.processing') : t('vault.unlockSystem')}</span>
                  </button>
                )}

                {vaultStatus.biometricsAvailable && vaultStatus.biometricsEnabled && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleSystemUnlock}
                    className={`text-[11px] hover:underline flex items-center space-x-1 ${
                      isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>{t('vault.unlockSystem')}</span>
                  </button>
                )}
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-slate-500/20">
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setMode('setup');
                    regenerateKey('mnemonic');
                  }}
                  className="text-[11px] text-amber-500 hover:text-amber-400 hover:underline flex items-center space-x-1 font-medium"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{t('vault.switchToPasswordMode')}</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-500/10'
                  }`}
                >
                  {t('modal.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {vaultStatus.biometricsAvailable && vaultStatus.biometricsEnabled && (
                <div className={`p-3.5 rounded-xl border flex flex-col items-center space-y-2.5 text-center ${
                  isLight ? 'bg-sky-50 border-sky-200' : 'bg-sky-950/20 border-sky-500/30'
                }`}>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleBiometricUnlock}
                    className="w-full py-2 px-4 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow transition-all flex items-center justify-center space-x-2"
                  >
                    <Fingerprint className="w-4 h-4" />
                    <span>{loading ? t('vault.processing') : t('vault.unlockWithHello')}</span>
                  </button>
                  <span className={`text-[11px] font-medium ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>— {t('vault.orEnterPassword')} —</span>
                </div>
              )}

              <form onSubmit={handleUnlockSubmit} className="space-y-4">
                <div>
                  <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('vault.masterPassword')}</label>
                  <input
                    type="password"
                    autoFocus={!vaultStatus.biometricsEnabled}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                    }`}
                  />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setMode('recover');
                    }}
                    className="text-sky-500 hover:underline hover:text-sky-400 text-[11px]"
                  >
                    {t('vault.forgotPassword')}
                  </button>
                </div>

                <div className="pt-2 flex items-center justify-end space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className={`px-3 py-1.5 rounded text-xs transition-colors ${
                      isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-500/10'
                    }`}
                  >
                    {t('modal.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow"
                  >
                    {loading ? t('vault.processing') : t('vault.unlock')}
                  </button>
                </div>
              </form>
            </div>
          )
        )}

        {/* MODE: SETUP MASTER PASSWORD WITH RECOVERY KEY */}
        {mode === 'setup' && (
          <form onSubmit={handleSetupSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('vault.masterPassword')}</label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('vault.confirmPassword')}</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                  }`}
                />
              </div>
            </div>

            {/* Recovery Choice Selector */}
            <div className={`p-3 rounded-lg border space-y-2.5 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#181818] border-[#303030]'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium flex items-center space-x-1.5 text-amber-500">
                  <Key className="w-3.5 h-3.5" />
                  <span>{t('vault.recoveryMethod')}</span>
                </span>
                {/* Method Switcher */}
                <div className="flex rounded border overflow-hidden text-[10px]">
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryType('mnemonic');
                      regenerateKey('mnemonic');
                    }}
                    className={`px-2 py-0.5 font-medium ${
                      recoveryType === 'mnemonic'
                        ? 'bg-sky-600 text-white'
                        : isLight ? 'bg-white text-slate-700 font-medium' : 'bg-[#222] text-slate-400'
                    }`}
                  >
                    12-Word Phrase
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecoveryType('alphanumeric');
                      regenerateKey('alphanumeric');
                    }}
                    className={`px-2 py-0.5 font-medium ${
                      recoveryType === 'alphanumeric'
                        ? 'bg-sky-600 text-white'
                        : isLight ? 'bg-white text-slate-700 font-medium' : 'bg-[#222] text-slate-400'
                    }`}
                  >
                    24-Char Key
                  </button>
                </div>
              </div>

              {/* Display Generated Key / Phrase */}
              <div className={`p-2.5 rounded border font-mono text-xs select-all break-words leading-relaxed relative ${
                isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#111111] border-[#383838] text-amber-300'
              }`}>
                {generatedRecoveryKey}
              </div>

              {/* Actions for Key */}
              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={handleCopyKey}
                    className="flex items-center space-x-1 px-2 py-1 rounded bg-sky-600/15 border border-sky-500/30 text-sky-400 hover:bg-sky-500/25 text-[11px] font-medium"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied!' : t('vault.copyKey')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadKey}
                    className={`flex items-center space-x-1 px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                      isLight
                        ? 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                        : 'bg-slate-500/15 border-slate-500/30 text-slate-300 hover:bg-slate-500/25'
                    }`}
                  >
                    <span>{t('vault.downloadKey')}</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => regenerateKey(recoveryType)}
                  className={`p-1 rounded transition-colors ${
                    isLight ? 'text-slate-500 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white'
                  }`}
                  title="Generate new key"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Confirmation Checkbox */}
              <label className={`flex items-start space-x-2 pt-1 text-[11px] cursor-pointer select-none ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                <input
                  type="checkbox"
                  required
                  checked={hasConfirmedSaved}
                  onChange={(e) => setHasConfirmedSaved(e.target.checked)}
                  className="mt-0.5 rounded border-slate-400 text-sky-600 focus:ring-0"
                />
                <span className={hasConfirmedSaved ? (isLight ? 'text-emerald-700 font-semibold' : 'text-emerald-400 font-medium') : (isLight ? 'text-slate-600' : 'text-slate-400')}>
                  {t('vault.savedKeyConfirm')}
                </span>
              </label>
            </div>

            <div className="pt-2 flex items-center justify-between border-t border-slate-500/20">
              <button
                type="button"
                onClick={handleSwitchToSystem}
                disabled={loading}
                className="text-[11px] text-sky-500 hover:text-sky-400 hover:underline flex items-center space-x-1 font-medium"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('vault.useWindowsDPAPI')}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-500/10'
                  }`}
                >
                  {t('modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading || !hasConfirmedSaved}
                  className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow"
                >
                  {loading ? t('vault.processing') : t('vault.setPassword')}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* MODE: RECOVER ACCESS USING RECOVERY KEY */}
        {mode === 'recover' && (
          <form onSubmit={handleRecoverSubmit} className="space-y-3.5">
            <div>
              <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
                {t('vault.recoveryKeyInput')}
              </label>
              <textarea
                required
                rows={3}
                autoFocus
                value={inputRecoveryKey}
                onChange={(e) => setInputRecoveryKey(e.target.value)}
                placeholder="e.g. apple brave cabin... or BEST-A7K9-MZ3X-W8QP-4TY2"
                className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                }`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('vault.newPassword')}</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                  }`}
                />
              </div>
              <div>
                <label className={`block text-xs mb-1 font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('vault.confirmNewPassword')}</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                  }`}
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode('unlock');
                }}
                className={`flex items-center space-x-1 text-xs transition-colors ${
                  isLight ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-white'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t('vault.backToUnlock')}</span>
              </button>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-3 py-1.5 rounded text-xs transition-colors ${
                    isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:bg-slate-500/10'
                  }`}
                >
                  {t('modal.cancel')}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow"
                >
                  {loading ? t('vault.processing') : t('vault.recoverAction')}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
