import React, { useState, useEffect } from 'react';
import { SFTPFile } from '../types';
import { useTranslation } from '../i18n';
import { 
  Folder, File, FileCode, FileText, FileArchive, CornerLeftUp, 
  RotateCw, Plus, Trash2, Edit, Key, Shield, Search, ArrowRight, Download, Upload
} from 'lucide-react';

interface SftpViewProps {
  sessionId: string;
  isLight?: boolean;
  initialPath?: string;
  onOpenFileInEditor: (filePath: string, fileName: string) => void;
}

export const SftpView: React.FC<SftpViewProps> = ({
  sessionId,
  isLight = false,
  initialPath = '/',
  onOpenFileInEditor,
}) => {
  const { t } = useTranslation();
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [inputPath, setInputPath] = useState(initialPath);
  const [files, setFiles] = useState<SFTPFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SFTPFile | null>(null);
  const [newName, setNewName] = useState('');

  const loadDirectory = async (pathToGo: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await window.api.sftp.list(sessionId, pathToGo);
      setCurrentPath(res.currentPath);
      setInputPath(res.currentPath);
      setFiles(res.files);
    } catch (e: any) {
      setError(e.message || 'Failed to list directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);

    // SmarTTY Killer Feature: Listen to OSC 7 directory changes from terminal
    const unsubscribe = window.api?.ssh.onDirectoryChanged((payload) => {
      if (payload.sessionId === sessionId && payload.directory) {
        loadDirectory(payload.directory);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [sessionId]);

  const handleNavigateUp = () => {
    if (currentPath === '/' || currentPath === '') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = '/' + parts.join('/');
    loadDirectory(upPath);
  };

  const handleFileClick = (file: SFTPFile) => {
    if (file.isDirectory) {
      loadDirectory(file.path);
    } else {
      onOpenFileInEditor(file.path, file.name);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const target = currentPath.endsWith('/')
        ? `${currentPath}${newFolderName}`
        : `${currentPath}/${newFolderName}`;
      await window.api.sftp.mkdir(sessionId, target);
      setNewFolderName('');
      setShowNewFolder(false);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Error creating directory: ${err.message}`);
    }
  };

  const handleDelete = async (file: SFTPFile) => {
    if (!confirm(t('sftp.deleteConfirm').replace('{name}', file.name))) return;
    try {
      await window.api.sftp.delete(sessionId, file.path, file.isDirectory);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !newName.trim()) return;
    try {
      const parentDir = currentPath.endsWith('/') ? currentPath : `${currentPath}/`;
      const target = `${parentDir}${newName.trim()}`;
      await window.api.sftp.rename(sessionId, renameTarget.path, target);
      setRenameTarget(null);
      setNewName('');
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Rename failed: ${err.message}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let idx = 0;
    let b = bytes;
    while (b >= 1024 && idx < units.length - 1) {
      b /= 1024;
      idx++;
    }
    return `${b.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
  };

  const getFileIcon = (file: SFTPFile) => {
    if (file.isDirectory) return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20" />;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['json', 'yaml', 'yml', 'js', 'ts', 'py', 'sh', 'php', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-sky-400" />;
    }
    if (['tar', 'gz', 'zip', 'xz', 'bz2', '7z'].includes(ext || '')) {
      return <FileArchive className="w-4 h-4 text-rose-400" />;
    }
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  // Breadcrumbs
  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden select-none ${
      isLight ? 'bg-[#f8f8f8] text-slate-800' : 'bg-[#181818] text-slate-100'
    }`}>
      {/* Navigation and Toolbar */}
      <div className={`h-10 border-b flex items-center justify-between px-3 space-x-2 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#2d2d2d]'
      }`}>
        <div className="flex items-center space-x-1">
          <button
            onClick={handleNavigateUp}
            disabled={currentPath === '/'}
            className={`p-1.5 rounded transition-colors ${
              isLight
                ? 'hover:bg-slate-100 text-slate-600 disabled:opacity-30'
                : 'hover:bg-white/10 text-slate-300 disabled:opacity-30'
            }`}
            title={t('sftp.parentFolder')}
          >
            <CornerLeftUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => loadDirectory(currentPath)}
            className={`p-1.5 rounded transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-slate-300'
            }`}
            title={t('sftp.refresh')}
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            className={`p-1.5 rounded transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-slate-300'
            }`}
            title={t('sftp.createFolder')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Path Breadcrumbs / Input */}
        <div className={`flex-1 flex items-center border rounded-md px-2 py-0.5 text-xs font-mono overflow-x-auto ${
          isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#181818] border-[#333] text-slate-200'
        }`}>
          <button
            onClick={() => loadDirectory('/')}
            className="text-sky-500 hover:underline px-1 font-bold"
          >
            /
          </button>
          {pathParts.map((part, index) => {
            const fullSubPath = '/' + pathParts.slice(0, index + 1).join('/');
            return (
              <React.Fragment key={fullSubPath}>
                <span className="text-slate-400">/</span>
                <button
                  onClick={() => loadDirectory(fullSubPath)}
                  className={`hover:underline px-1 truncate max-w-[120px] ${
                    isLight ? 'text-slate-700 hover:text-sky-600' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-44">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          <input
            type="text"
            placeholder={t('sftp.filterFiles')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={`w-full border rounded px-2 pl-7 py-1 text-xs focus:outline-none focus:border-sky-500 ${
              isLight
                ? 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400'
                : 'bg-[#181818] border-[#333] text-white placeholder:text-slate-500'
            }`}
          />
        </div>
      </div>

      {/* New Folder Prompt */}
      {showNewFolder && (
        <div className={`border-b p-3 flex items-center space-x-3 ${
          isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#242424] border-[#333]'
        }`}>
          <span className="text-xs text-slate-400 font-medium">{t('sftp.folderName')}</span>
          <form onSubmit={handleCreateFolder} className="flex items-center space-x-2 flex-1">
            <input
              type="text"
              autoFocus
              placeholder="new_directory"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className={`border rounded px-3 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 flex-1 ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181818] border-[#444] text-white'
              }`}
            />
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1 rounded shadow font-medium"
            >
              {t('sftp.create')}
            </button>
            <button
              type="button"
              onClick={() => setShowNewFolder(false)}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1"
            >
              {t('sftp.cancel')}
            </button>
          </form>
        </div>
      )}

      {/* Rename Prompt */}
      {renameTarget && (
        <div className={`border-b p-3 flex items-center space-x-3 ${
          isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#242424] border-[#333]'
        }`}>
          <span className="text-xs text-slate-400 font-medium">
            {t('sftp.renamePrompt').replace('{name}', renameTarget.name)}
          </span>
          <form onSubmit={handleRename} className="flex items-center space-x-2 flex-1">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`border rounded px-3 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 flex-1 ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181818] border-[#444] text-white'
              }`}
            />
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1 rounded shadow font-medium"
            >
              {t('sftp.rename')}
            </button>
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              className="text-slate-400 hover:text-slate-200 text-xs px-2 py-1"
            >
              {t('sftp.cancel')}
            </button>
          </form>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="p-2 bg-red-950/50 border-b border-red-800 text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* File Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead className={`sticky top-0 border-b text-slate-400 ${
            isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-[#1d1d1d] border-[#2d2d2d]'
          }`}>
            <tr>
              <th className="py-2 px-3 font-semibold w-8"></th>
              <th className="py-2 px-3 font-semibold">{t('sftp.name')}</th>
              <th className="py-2 px-3 font-semibold w-24 text-right">{t('sftp.size')}</th>
              <th className="py-2 px-3 font-semibold w-28 text-center">{t('sftp.permissions')}</th>
              <th className="py-2 px-3 font-semibold w-40">{t('sftp.modified')}</th>
              <th className="py-2 px-3 font-semibold w-20 text-center">{t('sftp.actions')}</th>
            </tr>
          </thead>
          <tbody className={isLight ? 'divide-y divide-slate-200' : 'divide-y divide-[#222222]'}>
            {filteredFiles.map((file) => (
              <tr
                key={file.path}
                onDoubleClick={() => handleFileClick(file)}
                className={`cursor-pointer group transition-colors ${
                  isLight ? 'hover:bg-slate-100/80' : 'hover:bg-[#232323]'
                }`}
              >
                <td className="py-1.5 px-3">{getFileIcon(file)}</td>
                <td className={`py-1.5 px-3 font-sans truncate max-w-xs font-medium ${
                  isLight ? 'text-slate-800 group-hover:text-sky-600' : 'text-slate-200 group-hover:text-white'
                }`}>
                  {file.name}
                </td>
                <td className="py-1.5 px-3 text-right text-slate-400">
                  {formatSize(file.size)}
                </td>
                <td className="py-1.5 px-3 text-center text-slate-400 font-mono text-[11px]">
                  {file.permissions}
                </td>
                <td className="py-1.5 px-3 text-slate-400 text-[11px]">
                  {file.modifyTime ? new Date(file.modifyTime).toLocaleString() : '-'}
                </td>
                <td className="py-1.5 px-3 text-center">
                  <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!file.isDirectory && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFileInEditor(file.path, file.name);
                        }}
                        className="p-1 hover:bg-sky-500/20 text-sky-500 rounded"
                        title={t('sftp.editInMonaco')}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameTarget(file);
                        setNewName(file.name);
                      }}
                      className={`p-1 rounded transition-colors ${
                        isLight ? 'hover:bg-slate-200 text-slate-500 hover:text-slate-900' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                      }`}
                      title={t('sftp.rename')}
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file);
                      }}
                      className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-500 rounded transition-colors"
                      title={t('sftp.delete')}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
