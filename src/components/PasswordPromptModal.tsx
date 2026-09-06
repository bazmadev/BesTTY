import React, { useState } from 'react';
import { KeyRound, X, Eye, EyeOff } from 'lucide-react';
import { HostProfile } from '../types';
import { useTranslation } from '../i18n';

interface PasswordPromptModalProps {
  isOpen: boolean;
  host: HostProfile | null;
  onClose: () => void;
  onSubmit: (password: string, remember: boolean) => void;
}

export const PasswordPromptModal: React.FC<PasswordPromptModalProps> = ({
  isOpen,
  host,
  onClose,
  onSubmit,
}) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);

  if (!isOpen || !host) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(password, remember);
    setPassword('');
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 select-none">
      <div className="bg-[#202020] border border-[#383838] w-full max-w-sm rounded-xl shadow-2xl p-6 space-y-4 text-white">
        <div className="flex items-center justify-between border-b border-[#303030] pb-3">
          <div className="flex items-center space-x-2">
            <KeyRound className="w-5 h-5 text-sky-400" />
            <h3 className="text-sm font-semibold">
              SSH Authentication
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          Enter password for <span className="font-mono text-sky-300 font-semibold">{host.username}@{host.host}:{host.port}</span>:
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              autoFocus
              required
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-2 pr-10 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>

          <label className="flex items-center space-x-2 text-xs text-slate-400 cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-3.5 h-3.5 accent-sky-500"
            />
            <span>Remember in Vault</span>
          </label>

          <div className="flex items-center justify-end space-x-2 pt-2 border-t border-[#303030]">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-xs text-slate-300 hover:bg-white/10"
            >
              {t('modal.cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow"
            >
              {t('hosts.connect')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
