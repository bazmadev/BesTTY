import React, { useState, useEffect } from 'react';
import { HostProfile, AuthType } from '../types';
import { useTranslation } from '../i18n';
import { parseSSHConnectionString } from '../utils/sshParser';
import { X, Key, Lock, Terminal, Shield, ChevronDown, ChevronUp, Eye, EyeOff, Sparkles, FolderOpen, HelpCircle, CheckCircle2, AlertTriangle, Loader2, Activity } from 'lucide-react';

interface HostModalProps {
  isOpen: boolean;
  isLight?: boolean;
  onClose: () => void;
  onSave: (host: HostProfile) => void;
  onOpenHelp?: () => void;
  hostToEdit?: HostProfile | null;
  availableHosts: HostProfile[];
}

export const HostModal: React.FC<HostModalProps> = ({
  isOpen,
  isLight = false,
  onClose,
  onSave,
  onOpenHelp,
  hostToEdit,
  availableHosts,
}) => {
  const { t } = useTranslation();
  const [smartPaste, setSmartPaste] = useState('');
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('root');
  const [authType, setAuthType] = useState<AuthType>('password');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [privateKeyContent, setPrivateKeyContent] = useState('');
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [group, setGroup] = useState('Default');
  const [color, setColor] = useState('#0078d4');
  const [defaultPath, setDefaultPath] = useState('');
  const [proxyJumpId, setProxyJumpId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Connection testing state
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    error?: string;
    fingerprint?: string;
  } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (hostToEdit) {
      setName(hostToEdit.name);
      setHost(hostToEdit.host);
      setPort(hostToEdit.port || 22);
      setUsername(hostToEdit.username || 'root');
      setAuthType(hostToEdit.authType || 'password');
      setPassword(hostToEdit.password || '');
      setPrivateKeyContent(hostToEdit.privateKeyContent || '');
      setPrivateKeyPath(hostToEdit.privateKeyPath || '');
      setPassphrase(hostToEdit.passphrase || '');
      setGroup(hostToEdit.group || 'Default');
      setColor(hostToEdit.color || '#0078d4');
      setDefaultPath(hostToEdit.defaultPath || '');
      setProxyJumpId(hostToEdit.proxyJumpId || '');
      setSmartPaste('');
    } else {
      setName('');
      setHost('');
      setPort(22);
      setUsername('root');
      setAuthType('password');
      setPassword('');
      setPrivateKeyContent('');
      setPrivateKeyPath('');
      setPassphrase('');
      setGroup('Default');
      setColor('#0078d4');
      setDefaultPath('');
      setProxyJumpId('');
      setSmartPaste('');
    }
    setTestResult(null);
    setSaveError(null);
    setIsTesting(false);
  }, [hostToEdit, isOpen]);

  // Handle Smart Paste decomposition
  const handleSmartPasteChange = (val: string) => {
    setSmartPaste(val);
    if (!val.trim()) return;

    const parsed = parseSSHConnectionString(val);
    if (parsed.host) {
      setHost(parsed.host);
      setUsername(parsed.username || 'root');
      setPort(parsed.port || 22);
      if (!name) {
        setName(`${parsed.username}@${parsed.host}`);
      }
      if (parsed.privateKeyPath) {
        setAuthType('privateKey');
        setPrivateKeyPath(parsed.privateKeyPath);
      }
    }
  };

  const buildCurrentProfile = (extraFingerprint?: string): HostProfile => {
    const rawUser = username.trim() || 'root';
    const cleanUser = rawUser.toLowerCase() === 'root' ? 'root' : rawUser;
    const cleanPassword = password ? password.replace(/[\r\n]+$/, '') : undefined;

    return {
      id: hostToEdit ? hostToEdit.id : crypto.randomUUID(),
      name: name.trim() || `${cleanUser}@${host.trim()}`,
      host: host.trim(),
      port: Number(port) || 22,
      username: cleanUser,
      authType,
      password: authType === 'password' ? cleanPassword : undefined,
      privateKeyContent: authType === 'privateKey' ? privateKeyContent : undefined,
      privateKeyPath: authType === 'privateKey' ? privateKeyPath.trim() : undefined,
      passphrase: authType === 'privateKey' && passphrase ? passphrase : undefined,
      group: group.trim() || 'Default',
      color,
      defaultPath: defaultPath.trim() || undefined,
      proxyJumpId: proxyJumpId || undefined,
      fingerprint: extraFingerprint || hostToEdit?.fingerprint,
      createdAt: hostToEdit ? hostToEdit.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
  };

  const handleRunManualTest = async () => {
    if (!host.trim() || !username.trim()) return;
    const profile = buildCurrentProfile();
    if (profile.authType === 'password' && !profile.password) {
      setTestResult({
        success: false,
        error: t('modal.passwordRequiredForTest'),
      });
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    setSaveError(null);
    try {
      const result = await window.api.ssh.testConnection(profile);
      setTestResult(result);
    } catch (e: any) {
      setTestResult({ success: false, error: e.message || String(e) });
    } finally {
      setIsTesting(false);
    }
  };

  const handleForceSave = () => {
    const profile = buildCurrentProfile(testResult?.fingerprint);
    onSave(profile);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!host.trim() || !username.trim()) return;

    setSaveError(null);
    const profile = buildCurrentProfile();

    // If password auth is selected but password is empty, user plans to enter it upon connection
    if (profile.authType === 'password' && !profile.password) {
      onSave(profile);
      onClose();
      return;
    }

    setIsTesting(true);
    try {
      const result = await window.api.ssh.testConnection(profile);
      setIsTesting(false);

      if (result.success) {
        const verifiedProfile = buildCurrentProfile(result.fingerprint);
        onSave(verifiedProfile);
        onClose();
      } else {
        setSaveError(result.error || t('modal.testFailedDesc'));
      }
    } catch (e: any) {
      setIsTesting(false);
      setSaveError(e.message || t('modal.testFailedDesc'));
    }
  };

  if (!isOpen) return null;

  const colors = ['#0078d4', '#107c41', '#d83b01', '#881798', '#e3008c', '#00b7c3', '#ffaa44'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
        isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#202020] border-[#383838] text-white'
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b flex items-center justify-between ${
          isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#252525] border-[#303030]'
        }`}>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="text-base font-semibold">
              {hostToEdit ? t('modal.editTitle') : t('modal.addTitle')}
            </h2>
          </div>
          <div className="flex items-center space-x-1">
            {onOpenHelp && (
              <button
                type="button"
                onClick={onOpenHelp}
                className="p-1.5 rounded-md text-slate-400 hover:text-sky-500 hover:bg-sky-500/10 transition-colors"
                title="Help"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-md text-slate-400 hover:text-slate-200 hover:bg-black/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Smart SSH Command Paste Bar */}
          <div className={`p-3 rounded-lg border flex flex-col space-y-1.5 ${
            isLight ? 'bg-sky-50/70 border-sky-200' : 'bg-sky-950/20 border-sky-500/30'
          }`}>
            <label className="text-xs font-semibold text-sky-500 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>{t('modal.smartPasteLabel')}</span>
            </label>
            <input
              type="text"
              placeholder={t('modal.smartPastePlaceholder')}
              value={smartPaste}
              onChange={(e) => handleSmartPasteChange(e.target.value)}
              className={`w-full border rounded px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                isLight ? 'bg-white border-sky-300 text-slate-900' : 'bg-[#181818] border-[#383838] text-white'
              }`}
            />
          </div>

          {/* Friendly Name & Group */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="block text-xs text-slate-400 mb-1 font-medium">{t('modal.sessionName')}</label>
              <input
                type="text"
                placeholder="e.g. Prod-Web-01"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">{t('modal.group')}</label>
              <input
                type="text"
                placeholder="Group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                }`}
              />
            </div>
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="block text-xs text-slate-400 mb-1 font-medium">{t('modal.hostIp')}</label>
              <input
                type="text"
                required
                placeholder="192.168.1.100 or server.domain.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className={`w-full border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-sky-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                }`}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">{t('modal.port')}</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className={`w-full border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-sky-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                }`}
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">{t('modal.username')}</label>
            <input
              type="text"
              required
              placeholder="root, ubuntu, debian..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => {
                if (username.trim().toLowerCase() === 'root') {
                  setUsername('root');
                }
              }}
              className={`w-full border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-sky-500 ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
              }`}
            />
          </div>

          {/* Authentication Tabs */}
          <div>
            <label className="block text-xs text-slate-400 mb-2 font-medium">{t('modal.authMethod')}</label>
            <div className={`grid grid-cols-3 gap-2 p-1 rounded-lg border ${
              isLight ? 'bg-slate-100 border-slate-200' : 'bg-[#181818] border-[#333]'
            }`}>
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`py-1.5 text-xs rounded-md font-medium transition-all ${
                  authType === 'password'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('modal.password')}
              </button>
              <button
                type="button"
                onClick={() => setAuthType('privateKey')}
                className={`py-1.5 text-xs rounded-md font-medium transition-all ${
                  authType === 'privateKey'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('modal.privateKey')}
              </button>
              <button
                type="button"
                onClick={() => setAuthType('agent')}
                className={`py-1.5 text-xs rounded-md font-medium transition-all ${
                  authType === 'agent'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t('modal.agent')}
              </button>
            </div>
          </div>

          {/* Password Input */}
          {authType === 'password' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">{t('modal.password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('modal.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`w-full border rounded-md px-3 py-1.5 pr-10 text-sm font-mono focus:outline-none focus:border-sky-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Private Key Inputs */}
          {authType === 'privateKey' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  {t('modal.keyPath')}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    placeholder="C:\Users\username\.ssh\id_ed25519"
                    value={privateKeyPath}
                    onChange={(e) => setPrivateKeyPath(e.target.value)}
                    className={`flex-1 border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const path = await window.api.dialog.openKeyFile();
                      if (path) setPrivateKeyPath(path);
                    }}
                    className={`px-3 py-1.5 rounded-md border text-xs font-medium flex items-center space-x-1.5 transition-colors ${
                      isLight
                        ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                        : 'bg-[#2a2a2a] hover:bg-[#333] border-[#444] text-slate-200'
                    }`}
                    title={t('modal.browseKey')}
                  >
                    <FolderOpen className="w-4 h-4" />
                    <span>{t('modal.browse')}</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  {t('modal.keyContent')}
                </label>
                <textarea
                  rows={3}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                  value={privateKeyContent}
                  onChange={(e) => setPrivateKeyContent(e.target.value)}
                  className={`w-full border rounded-md px-3 py-1.5 text-xs font-mono focus:outline-none focus:border-sky-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                  }`}
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">{t('modal.passphrase')}</label>
                <input
                  type="password"
                  placeholder="Passphrase"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className={`w-full border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-sky-500 ${
                    isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                  }`}
                />
              </div>
            </div>
          )}

          {/* SSH Agent Notice */}
          {authType === 'agent' && (
            <div className={`border rounded-lg p-3 text-xs flex items-center space-x-2 ${
              isLight ? 'bg-sky-50 border-sky-200 text-sky-900' : 'bg-[#181818] border-[#333] text-slate-300'
            }`}>
              <Shield className="w-5 h-5 text-sky-400 flex-shrink-0" />
              <span>{t('modal.agentNotice')}</span>
            </div>
          )}

          {/* Advanced Accordion */}
          <div className="pt-2 border-t border-slate-500/20">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-slate-200 py-1"
            >
              <span className="font-medium">{t('modal.advanced')}</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="space-y-3 pt-3">
                {/* ProxyJump */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">
                    {t('modal.proxyJump')}
                  </label>
                  <select
                    value={proxyJumpId}
                    onChange={(e) => setProxyJumpId(e.target.value)}
                    className={`w-full border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                    }`}
                  >
                    <option value="">{t('modal.directConnection')}</option>
                    {availableHosts
                      .filter((h) => h.id !== hostToEdit?.id)
                      .map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.name} ({h.username}@{h.host}:{h.port})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Default Remote Directory */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">
                    {t('modal.defaultPath')}
                  </label>
                  <input
                    type="text"
                    placeholder="/var/www/html or ~"
                    value={defaultPath}
                    onChange={(e) => setDefaultPath(e.target.value)}
                    className={`w-full border rounded-md px-3 py-1.5 text-sm font-mono focus:outline-none focus:border-sky-500 ${
                      isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#272727] border-[#3d3d3d] text-white'
                    }`}
                  />
                </div>

                {/* Color Tag */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">{t('modal.tagColor')}</label>
                  <div className="flex items-center space-x-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          color === c ? 'scale-110 border-white shadow' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Connection Test Result Feedback */}
          {testResult && !saveError && (
            <div
              className={`p-3 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                testResult.success
                  ? isLight
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
                  : isLight
                  ? 'bg-red-50 border-red-300 text-red-800'
                  : 'bg-red-950/40 border-red-500/30 text-red-300'
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1">
                <div className="font-semibold">
                  {testResult.success
                    ? t('modal.testSuccess')
                    : (testResult.error || t('modal.testFailed'))}
                </div>
                {testResult.fingerprint && (
                  <div className="text-[11px] font-mono opacity-80 mt-0.5 break-all">
                    {t('modal.fingerprint')} {testResult.fingerprint}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save Connection Failed - Action Banner */}
          {saveError && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-3 shadow-lg ${
                isLight
                  ? 'bg-red-50/90 border-red-300 text-red-900'
                  : 'bg-red-950/40 border-red-500/40 text-red-200'
              }`}
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold text-sm text-red-500 mb-1">
                    {t('modal.testFailed')}
                  </div>
                  <div className="font-mono text-[11px] leading-relaxed break-all opacity-90">
                    {saveError}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-red-500/20">
                <button
                  type="button"
                  onClick={() => setSaveError(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isLight
                      ? 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  }`}
                >
                  {t('modal.fixCredentials')}
                </button>
                <button
                  type="button"
                  onClick={handleForceSave}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-600 hover:bg-amber-500 text-white shadow transition-colors"
                >
                  {t('modal.ignoreAndSave')}
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-4 border-t border-slate-500/20 flex items-center justify-between">
            <button
              type="button"
              disabled={isTesting || !host.trim() || !username.trim()}
              onClick={handleRunManualTest}
              className={`px-3 py-2 rounded-md text-xs font-medium flex items-center gap-1.5 border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                isLight
                  ? 'border-slate-300 text-slate-700 hover:bg-slate-100'
                  : 'border-white/10 text-slate-300 hover:bg-white/5'
              }`}
            >
              {isTesting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-400" />
              ) : (
                <Activity className="w-3.5 h-3.5 text-sky-400" />
              )}
              <span>{isTesting ? t('modal.testing') : t('modal.testConnection')}</span>
            </button>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-md text-xs font-medium text-slate-400 hover:bg-slate-500/10 transition-colors"
              >
                {t('modal.cancel')}
              </button>
              <button
                type="submit"
                disabled={isTesting}
                className="px-4 py-2 rounded-md text-xs font-medium bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white shadow-lg transition-colors flex items-center gap-1.5"
              >
                {isTesting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>{hostToEdit ? t('modal.save') : t('modal.add')}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
