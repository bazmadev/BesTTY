import React, { useState } from 'react';
import { Shield, Lock, Key, X, AlertCircle } from 'lucide-react';
import { VaultStatus } from '../types';

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaultStatus: VaultStatus;
  onUnlockSuccess: () => void;
}

export const VaultModal: React.FC<VaultModalProps> = ({
  isOpen,
  onClose,
  vaultStatus,
  onUnlockSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!vaultStatus.isConfigured && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const ok = await window.api.vault.unlock(password);
      if (ok) {
        onUnlockSuccess();
        onClose();
      } else {
        setError('Incorrect master password');
      }
    } catch (err: any) {
      setError(err.message || 'Unlock error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#202020] border border-[#383838] w-full max-w-sm rounded-xl shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#303030] pb-3">
          <div className="flex items-center space-x-2">
            <Lock className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              {vaultStatus.isConfigured ? 'Unlock Secure Vault' : 'Set Master Password'}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-400 leading-relaxed">
          {vaultStatus.isConfigured
            ? 'Enter your master password to decrypt saved SSH server credentials, passwords, and private keys.'
            : 'Protect your server keys and login credentials with AES-256-GCM encryption derived from your master password.'}
        </p>

        {error && (
          <div className="flex items-center space-x-1.5 p-2 bg-rose-950/50 border border-rose-800 rounded text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Master Password</label>
            <input
              type="password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
            />
          </div>

          {!vaultStatus.isConfigured && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-slate-300 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold shadow"
            >
              {loading
                ? 'Processing...'
                : vaultStatus.isConfigured
                ? 'Unlock'
                : 'Set Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
