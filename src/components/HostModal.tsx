import React, { useState, useEffect } from 'react';
import { HostProfile, AuthType } from '../types';
import { X, Key, Lock, Terminal, Shield, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';

interface HostModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (host: HostProfile) => void;
  hostToEdit?: HostProfile | null;
  availableHosts: HostProfile[];
}

export const HostModal: React.FC<HostModalProps> = ({
  isOpen,
  onClose,
  onSave,
  hostToEdit,
  availableHosts,
}) => {
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
    }
  }, [hostToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const profile: HostProfile = {
      id: hostToEdit ? hostToEdit.id : crypto.randomUUID(),
      name: name.trim() || `${username}@${host}`,
      host: host.trim(),
      port: Number(port) || 22,
      username: username.trim() || 'root',
      authType,
      password: authType === 'password' ? password : undefined,
      privateKeyContent: authType === 'privateKey' ? privateKeyContent : undefined,
      privateKeyPath: authType === 'privateKey' ? privateKeyPath : undefined,
      passphrase: authType === 'privateKey' && passphrase ? passphrase : undefined,
      group: group.trim() || 'Default',
      color,
      defaultPath: defaultPath.trim() || undefined,
      proxyJumpId: proxyJumpId || undefined,
      createdAt: hostToEdit ? hostToEdit.createdAt : Date.now(),
      updatedAt: Date.now(),
    };
    onSave(profile);
    onClose();
  };

  const colors = ['#0078d4', '#107c41', '#d83b01', '#881798', '#e3008c', '#00b7c3', '#ffaa44'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#202020] border border-[#383838] w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#303030] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
            <h2 className="text-base font-semibold text-white">
              {hostToEdit ? 'Edit SSH Connection' : 'New SSH Connection'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {/* Friendly Name & Color */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="block text-xs text-slate-400 mb-1 font-medium">Session Name</label>
              <input
                type="text"
                placeholder="e.g. Prod-Web-01"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Group</label>
              <input
                type="text"
                placeholder="Group"
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Host & Port */}
          <div className="grid grid-cols-4 gap-3">
            <div className="col-span-3">
              <label className="block text-xs text-slate-400 mb-1 font-medium">Host / IP Address *</label>
              <input
                type="text"
                required
                placeholder="192.168.1.100 or server.domain.com"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Port</label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
              />
            </div>
          </div>

          {/* Username */}
          <div>
            <label className="block text-xs text-slate-400 mb-1 font-medium">Username *</label>
            <input
              type="text"
              required
              placeholder="root, ubuntu, debian..."
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Authentication Tabs */}
          <div>
            <label className="block text-xs text-slate-400 mb-2 font-medium">Authentication Method</label>
            <div className="grid grid-cols-3 gap-2 bg-[#181818] p-1 rounded-lg border border-[#333]">
              <button
                type="button"
                onClick={() => setAuthType('password')}
                className={`py-1.5 text-xs rounded-md font-medium transition-all ${
                  authType === 'password'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Password
              </button>
              <button
                type="button"
                onClick={() => setAuthType('privateKey')}
                className={`py-1.5 text-xs rounded-md font-medium transition-all ${
                  authType === 'privateKey'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Private Key
              </button>
              <button
                type="button"
                onClick={() => setAuthType('agent')}
                className={`py-1.5 text-xs rounded-md font-medium transition-all ${
                  authType === 'agent'
                    ? 'bg-sky-600 text-white shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                SSH Agent
              </button>
            </div>
          </div>

          {/* Password Input */}
          {authType === 'password' && (
            <div>
              <label className="block text-xs text-slate-400 mb-1 font-medium">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Leave blank to prompt at connection"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 pr-10 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
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
                  Private Key File Path (OpenSSH / PPK / PEM)
                </label>
                <input
                  type="text"
                  placeholder="C:\Users\username\.ssh\id_ed25519"
                  value={privateKeyPath}
                  onChange={(e) => setPrivateKeyPath(e.target.value)}
                  className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">
                  Or Paste Key Content (RSA / Ed25519)
                </label>
                <textarea
                  rows={3}
                  placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                  value={privateKeyContent}
                  onChange={(e) => setPrivateKeyContent(e.target.value)}
                  className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium">Passphrase (optional)</label>
                <input
                  type="password"
                  placeholder="Passphrase to decrypt private key"
                  value={passphrase}
                  onChange={(e) => setPassphrase(e.target.value)}
                  className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
          )}

          {/* SSH Agent Notice */}
          {authType === 'agent' && (
            <div className="bg-[#181818] border border-[#333] rounded-lg p-3 text-xs text-slate-300 flex items-center space-x-2">
              <Shield className="w-5 h-5 text-sky-400 flex-shrink-0" />
              <span>
                Using Windows OpenSSH Agent (<code className="text-sky-300">\\.\pipe\openssh-ssh-agent</code>) or Pageant. Keys will be requested directly from your active agent.
              </span>
            </div>
          )}

          {/* Advanced Accordion */}
          <div className="pt-2 border-t border-[#303030]">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white py-1"
            >
              <span className="font-medium">Advanced Options (ProxyJump, Tag Color, Default Path)</span>
              {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {showAdvanced && (
              <div className="space-y-3 pt-3">
                {/* ProxyJump */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">
                    ProxyJump / Bastion Host
                  </label>
                  <select
                    value={proxyJumpId}
                    onChange={(e) => setProxyJumpId(e.target.value)}
                    className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 text-sm text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="">Direct Connection (No ProxyJump)</option>
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
                    Initial Remote Directory
                  </label>
                  <input
                    type="text"
                    placeholder="/var/www/html or ~"
                    value={defaultPath}
                    onChange={(e) => setDefaultPath(e.target.value)}
                    className="w-full bg-[#272727] border border-[#3d3d3d] rounded-md px-3 py-1.5 text-sm text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                {/* Color Tag */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-medium">Tag Color</label>
                  <div className="flex items-center space-x-2">
                    {colors.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setColor(c)}
                        className={`w-6 h-6 rounded-full border-2 transition-transform ${
                          color === c ? 'scale-110 border-white' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#303030] flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md text-xs font-medium text-slate-300 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-md text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white shadow-lg transition-colors"
            >
              {hostToEdit ? 'Save Changes' : 'Add Host'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
