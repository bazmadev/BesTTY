import React, { useState } from 'react';
import { Lock, X, AlertCircle } from 'lucide-react';
import { VaultStatus } from '../types';
import { useTranslation } from '../i18n';

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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vaultStatus.isConfigured && password !== confirmPassword) {
      setError(t('vault.mismatch'));
      return;
    }

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

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`border w-full max-w-sm rounded-xl shadow-2xl p-6 space-y-4 ${
        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#202020] border-[#383838] text-white'
      }`}>
        <div className={`flex items-center justify-between border-b pb-3 ${
          isLight ? 'border-slate-200' : 'border-[#303030]'
        }`}>
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-amber-500" />
            <h3 className="text-sm font-semibold">
              {vaultStatus.isConfigured ? t('vault.unlockTitle') : t('vault.setTitle')}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {vaultStatus.isConfigured
            ? t('vault.unlockDesc')
            : t('vault.setDesc')}
        </p>

        {error && (
          <div className="flex items-center space-x-1.5 p-2 bg-rose-500/15 border border-rose-500/40 rounded text-xs text-rose-600 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">{t('vault.masterPassword')}</label>
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

          {!vaultStatus.isConfigured && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">{t('vault.confirmPassword')}</label>
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
          )}

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-slate-400 hover:bg-slate-500/10"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow"
            >
              {loading
                ? t('vault.processing')
                : vaultStatus.isConfigured
                ? t('vault.unlock')
                : t('vault.setPassword')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
