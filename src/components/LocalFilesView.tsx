import React, { useState, useEffect, useRef } from 'react';
import { SFTPFile, FolderClickMode, STORAGE_KEY_FOLDER_CLICK_MODE, LocalDrive, FileClipboardState } from '../types';
import { useTranslation } from '../i18n';
import { setFileClipboard, getFileClipboard, clearFileClipboard } from '../utils/fileClipboard';
import { 
  Folder, File, FileCode, FileText, FileArchive, CornerLeftUp, 
  RotateCw, Plus, Trash2, Edit3, Search, HardDrive, Home, Copy, Scissors, ClipboardPaste,
  MousePointerClick, Check, AlertCircle, ArrowRight
} from 'lucide-react';

interface LocalFilesViewProps {
  isLight?: boolean;
  initialPath?: string;
  folderClickMode?: FolderClickMode;
  onOpenFileInEditor?: (filePath: string, fileName: string) => void;
}

export const LocalFilesView: React.FC<LocalFilesViewProps> = ({
  isLight = false,
  initialPath,
  folderClickMode = 'double',
  onOpenFileInEditor,
}) => {
  const { t } = useTranslation();
  const [clickMode, setClickMode] = useState<FolderClickMode>(() => {
    return (localStorage.getItem(STORAGE_KEY_FOLDER_CLICK_MODE) as FolderClickMode) || folderClickMode || 'double';
  });

  useEffect(() => {
    const handleStorageChange = (e: any) => {
      const mode = e.detail || localStorage.getItem(STORAGE_KEY_FOLDER_CLICK_MODE);
      if (mode === 'single' || mode === 'double') {
        setClickMode(mode);
      }
    };
    window.addEventListener('bestty_folder_click_mode_changed', handleStorageChange);
    return () => window.removeEventListener('bestty_folder_click_mode_changed', handleStorageChange);
  }, []);

  const toggleClickMode = () => {
    const next = clickMode === 'single' ? 'double' : 'single';
    setClickMode(next);
    localStorage.setItem(STORAGE_KEY_FOLDER_CLICK_MODE, next);
    window.dispatchEvent(new CustomEvent('bestty_folder_click_mode_changed', { detail: next }));
  };

  const [currentPath, setCurrentPath] = useState<string>(initialPath || '');
  const [inputPath, setInputPath] = useState<string>(initialPath || '');
  const [files, setFiles] = useState<SFTPFile[]>([]);
  const [drives, setDrives] = useState<LocalDrive[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);

  // Dialog states
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SFTPFile | null>(null);
  const [newName, setNewName] = useState('');

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: SFTPFile | null } | null>(null);

  // Shared Clipboard State
  const [clipboard, setClipboard] = useState<FileClipboardState | null>(getFileClipboard);

  // Drag and drop
  const [isDragOver, setIsDragOver] = useState(false);
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const handleClipboardChange = (e: any) => {
      setClipboard(e.detail || getFileClipboard());
    };
    window.addEventListener('bestty_clipboard_change', handleClipboardChange);
    return () => window.removeEventListener('bestty_clipboard_change', handleClipboardChange);
  }, []);

  useEffect(() => {
    const handleWindowClick = () => setContextMenu(null);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const isInitialPathMount = useRef(true);

  const loadDirectory = async (pathToGo?: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await window.api.local.list(pathToGo || currentPath);
      if (res) {
        setCurrentPath(res.currentPath);
        setInputPath(res.currentPath);
        setFiles(res.files);
        setDrives(res.drives || []);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to list local directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialPathMount.current) {
      isInitialPathMount.current = false;
      loadDirectory(initialPath);
      return;
    }
    if (initialPath && initialPath !== currentPath) {
      loadDirectory(initialPath);
    }
  }, [initialPath]);

  const navigateToFolder = (pathToGo: string) => {
    loadDirectory(pathToGo);
  };

  const handleNavigateUp = () => {
    if (!currentPath) return;
    // Handle Windows drive root (e.g. C:\)
    if (/^[a-zA-Z]:\\?$/.test(currentPath) || currentPath === '/') {
      return;
    }
    const lastSlash = Math.max(currentPath.lastIndexOf('\\'), currentPath.lastIndexOf('/'));
    if (lastSlash > 0) {
      const parent = currentPath.substring(0, lastSlash);
      navigateToFolder(/^[a-zA-Z]:$/.test(parent) ? `${parent}\\` : parent);
    } else if (lastSlash === 0) {
      navigateToFolder('/');
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    const separator = currentPath.includes('/') ? '/' : '\\';
    const targetPath = currentPath.endsWith(separator)
      ? `${currentPath}${newFolderName.trim()}`
      : `${currentPath}${separator}${newFolderName.trim()}`;

    try {
      await window.api.local.mkdir(targetPath);
      setNewFolderName('');
      setShowNewFolder(false);
      loadDirectory(currentPath);
      showToast(t('sftp.create') + ': ' + newFolderName.trim(), 'success');
    } catch (e: any) {
      setError(`Failed to create folder: ${e.message}`);
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !newName.trim() || newName.trim() === renameTarget.name) {
      setRenameTarget(null);
      return;
    }
    const separator = currentPath.includes('/') ? '/' : '\\';
    const targetPath = currentPath.endsWith(separator)
      ? `${currentPath}${newName.trim()}`
      : `${currentPath}${separator}${newName.trim()}`;

    try {
      await window.api.local.rename(renameTarget.path, targetPath);
      setRenameTarget(null);
      loadDirectory(currentPath);
      showToast(t('sftp.rename') + ': ' + newName.trim(), 'success');
    } catch (e: any) {
      setError(`Failed to rename: ${e.message}`);
    }
  };

  const handleDelete = async (file: SFTPFile) => {
    if (window.confirm(t('sftp.deleteConfirm').replace('{name}', file.name))) {
      try {
        await window.api.local.delete(file.path);
        loadDirectory(currentPath);
        showToast(t('sftp.delete') + ': ' + file.name, 'info');
      } catch (e: any) {
        setError(`Failed to delete: ${e.message}`);
      }
    }
  };

  const handleCopy = (file: SFTPFile) => {
    setFileClipboard({
      action: 'copy',
      source: 'local',
      files: [file.path],
    });
    showToast(t('sftp.copiedToast'), 'info');
  };

  const handleCut = (file: SFTPFile) => {
    setFileClipboard({
      action: 'cut',
      source: 'local',
      files: [file.path],
    });
    showToast(t('sftp.cutToast'), 'info');
  };

  const handlePaste = async (targetFolder: string = currentPath) => {
    const cb = getFileClipboard();
    if (!cb || cb.files.length === 0) return;

    const separator = targetFolder.includes('/') ? '/' : '\\';

    try {
      setIsLoading(true);
      for (const src of cb.files) {
        let fileName = src.split(/[\\/]/).pop() || 'file';
        let dest = targetFolder.endsWith(separator)
          ? `${targetFolder}${fileName}`
          : `${targetFolder}${separator}${fileName}`;

        // If copying in the same directory, add a copy suffix
        if (cb.action === 'copy' && src.toLowerCase() === dest.toLowerCase()) {
          const extIndex = fileName.lastIndexOf('.');
          if (extIndex > 0) {
            const namePart = fileName.slice(0, extIndex);
            const extPart = fileName.slice(extIndex);
            fileName = `${namePart} - Copy${extPart}`;
          } else {
            fileName = `${fileName} - Copy`;
          }
          dest = targetFolder.endsWith(separator)
            ? `${targetFolder}${fileName}`
            : `${targetFolder}${separator}${fileName}`;
        }

        if (cb.source === 'local') {
          if (cb.action === 'cut') {
            await window.api.local.rename(src, dest);
          } else {
            await window.api.local.copy(src, dest);
          }
        } else if (cb.source === 'remote' && cb.sessionId) {
          // Download remote file from SFTP session directly into local target
          await window.api.sftp.downloadFile(cb.sessionId, src, dest);
          if (cb.action === 'cut') {
            try {
              await window.api.sftp.delete(cb.sessionId, src, false);
            } catch {}
          }
        }
      }

      // If cut action, clear clipboard after paste
      if (cb.action === 'cut') {
        clearFileClipboard();
      }

      showToast(t('sftp.paste') + ' ' + t('editor.savedSuccess'), 'success');
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(`Paste error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Drag and drop
  const handleDragStart = (e: React.DragEvent, file: SFTPFile) => {
    e.dataTransfer.setData('application/x-bestty-local', JSON.stringify({
      path: file.path,
      name: file.name,
      isDirectory: file.isDirectory,
    }));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDrop = async (e: React.DragEvent, targetDir: string = currentPath) => {
    e.preventDefault();
    setIsDragOver(false);
    setDragOverFolder(null);

    const separator = targetDir.includes('/') ? '/' : '\\';

    // 1. Files dropped from external OS (Windows Explorer)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try {
        setIsLoading(true);
        for (const file of Array.from(e.dataTransfer.files)) {
          const srcPath = (file as any).path;
          if (!srcPath) continue;
          const fileName = file.name || srcPath.split(/[\\/]/).pop();
          const destPath = targetDir.endsWith(separator)
            ? `${targetDir}${fileName}`
            : `${targetDir}${separator}${fileName}`;
          if (srcPath.toLowerCase() !== destPath.toLowerCase()) {
            await window.api.local.copy(srcPath, destPath);
          }
        }
        showToast(t('sftp.uploadSuccess'), 'success');
        loadDirectory(currentPath);
      } catch (err: any) {
        setError(`Drop error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2. Dropped from Remote SFTP pane! (Transfer remote -> local download)
    const remoteData = e.dataTransfer.getData('application/x-bestty-sftp');
    if (remoteData) {
      try {
        const item = JSON.parse(remoteData);
        if (item.sessionId && item.path) {
          setIsLoading(true);
          const destPath = targetDir.endsWith(separator)
            ? `${targetDir}${item.name}`
            : `${targetDir}${separator}${item.name}`;
          await window.api.sftp.downloadFile(item.sessionId, item.path, destPath);
          showToast(t('sftp.downloadSuccess') + ': ' + item.name, 'success');
          loadDirectory(currentPath);
        }
      } catch (err: any) {
        setError(`SFTP Download error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 3. Dropped from Local Files pane (move/copy within local)
    const localData = e.dataTransfer.getData('application/x-bestty-local');
    if (localData) {
      try {
        const item = JSON.parse(localData);
        if (item.path) {
          const destPath = targetDir.endsWith(separator)
            ? `${targetDir}${item.name}`
            : `${targetDir}${separator}${item.name}`;

          if (item.path.toLowerCase() === destPath.toLowerCase()) return;
          // Prevent dropping folder into its own subfolder
          if (item.isDirectory && destPath.toLowerCase().startsWith(item.path.toLowerCase() + separator)) {
            showToast('Cannot copy a folder into its own subfolder', 'error');
            return;
          }

          await window.api.local.copy(item.path, destPath);
          showToast(t('sftp.paste') + ': ' + item.name, 'success');
          loadDirectory(currentPath);
        }
      } catch (err: any) {
        setError(`Local copy error: ${err.message}`);
      }
    }
  };

  const getFileIcon = (file: SFTPFile) => {
    if (file.isDirectory) return <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20" />;
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'json':
      case 'py':
      case 'sh':
      case 'yml':
      case 'yaml':
        return <FileCode className="w-4 h-4 text-sky-400" />;
      case 'txt':
      case 'md':
      case 'log':
      case 'conf':
        return <FileText className="w-4 h-4 text-emerald-400" />;
      case 'zip':
      case 'tar':
      case 'gz':
      case '7z':
      case 'rar':
        return <FileArchive className="w-4 h-4 text-purple-400" />;
      default:
        return <File className="w-4 h-4 text-slate-400" />;
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => handleDrop(e, currentPath)}
      className={`flex-1 flex flex-col h-full overflow-hidden select-none relative ${
        isLight ? 'bg-white text-slate-800' : 'bg-[#181818] text-slate-100'
      }`}
    >
      {/* Toast Notification */}
      {toast && (
        <div className={`absolute top-12 right-6 z-50 px-3 py-1.5 rounded-lg shadow-xl border text-xs flex items-center space-x-2 animate-in fade-in slide-in-from-top-2 ${
          toast.type === 'success'
            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
            : toast.type === 'error'
              ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              : 'bg-sky-500/20 text-sky-400 border-sky-500/40'
        }`}>
          {toast.type === 'success' ? <Check className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Top Toolbar */}
      <div className={`h-11 border-b flex items-center justify-between px-3 text-xs shrink-0 ${
        isLight ? 'bg-[#f4f4f4] border-[#e0e0e0]' : 'bg-[#222222] border-[#2e2e2e]'
      }`}>
        {/* Drive Buttons */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-1">
          {drives.map((d) => {
            const isSelected = currentPath.toLowerCase().startsWith(d.path.toLowerCase());
            return (
              <button
                key={d.path}
                onClick={() => navigateToFolder(d.path)}
                className={`px-2 py-1 rounded text-xs font-mono font-semibold flex items-center space-x-1.5 transition-colors shrink-0 ${
                  isSelected
                    ? isLight
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'bg-sky-600 text-white shadow-md'
                    : isLight
                      ? 'bg-slate-200 hover:bg-slate-300 text-slate-700'
                      : 'bg-[#2b2b2b] hover:bg-[#383838] text-slate-300'
                }`}
                title={d.name}
              >
                {d.isDrive ? <HardDrive className="w-3.5 h-3.5" /> : <Home className="w-3.5 h-3.5" />}
                <span>{d.name.includes('(') ? d.name.match(/\((.*?)\)/)?.[1] || d.name : d.name}</span>
              </button>
            );
          })}
        </div>

        {/* Action Buttons & Search */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={isLoading}
            className={`p-1.5 rounded transition-colors ${
              isLight ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-white/10 text-slate-300'
            }`}
            title={t('local.refresh')}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-500' : ''}`} />
          </button>

          <button
            onClick={() => setShowNewFolder(true)}
            className={`p-1.5 rounded transition-colors ${
              isLight ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-white/10 text-slate-300'
            }`}
            title={t('local.newFolder')}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Click Mode Toggle */}
          <button
            onClick={toggleClickMode}
            className={`px-1.5 py-1 rounded flex items-center space-x-1 text-xs font-mono transition-colors shrink-0 ${
              clickMode === 'single'
                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                : isLight
                  ? 'hover:bg-slate-200 text-slate-600'
                  : 'hover:bg-white/10 text-slate-300'
            }`}
            title={t('sftp.clickModeDesc')}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span className="font-bold">{clickMode === 'single' ? '1' : '2'}</span>
          </button>

          {clipboard && (
            <button
              onClick={() => handlePaste(currentPath)}
              className="p-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 transition-colors"
              title={t('sftp.paste')}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="relative w-36 sm:w-44">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 pointer-events-none" />
            <input
              type="text"
              placeholder={t('local.filterFiles')}
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
      </div>

      {/* Path Breadcrumbs Bar */}
      <div className={`h-8 border-b flex items-center px-3 text-xs shrink-0 ${
        isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#1c1c1c] border-[#292929] text-slate-300'
      }`}>
        <button
          onClick={handleNavigateUp}
          className="p-1 mr-2 rounded hover:bg-slate-500/10 text-slate-400 hover:text-sky-400 transition-colors"
          title={t('sftp.upOneLevelTip')}
        >
          <CornerLeftUp className="w-3.5 h-3.5" />
        </button>
        <span className="font-mono text-[11px] truncate flex-1">{currentPath}</span>
      </div>

      {/* New Folder Inline Form */}
      {showNewFolder && (
        <div className={`border-b p-2.5 flex items-center space-x-2 ${
          isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#242424] border-[#333]'
        }`}>
          <span className="text-xs text-slate-400">{t('sftp.folderName')}</span>
          <form onSubmit={handleCreateFolder} className="flex items-center space-x-2 flex-1">
            <input
              type="text"
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className={`border rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 flex-1 ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181818] border-[#444] text-white'
              }`}
            />
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-2.5 py-1 rounded font-medium"
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

      {/* Rename Inline Form */}
      {renameTarget && (
        <div className={`border-b p-2.5 flex items-center space-x-2 ${
          isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#242424] border-[#333]'
        }`}>
          <span className="text-xs text-slate-400 truncate max-w-xs">
            {t('sftp.renamePrompt').replace('{name}', renameTarget.name)}
          </span>
          <form onSubmit={handleRename} className="flex items-center space-x-2 flex-1">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`border rounded px-2.5 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 flex-1 ${
                isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181818] border-[#444] text-white'
              }`}
            />
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-2.5 py-1 rounded font-medium"
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

      {/* Error Bar */}
      {error && (
        <div className="p-2 bg-rose-950/40 border-b border-rose-800 text-xs text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* File Table */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar"
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, file: null });
        }}
      >
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead className={`sticky top-0 border-b text-slate-400 ${
            isLight ? 'bg-slate-100 border-slate-200 text-slate-600' : 'bg-[#1d1d1d] border-[#2d2d2d]'
          }`}>
            <tr>
              <th className="py-2 px-3 font-semibold w-8"></th>
              <th className="py-2 px-3 font-semibold">{t('sftp.name')}</th>
              <th className="py-2 px-3 font-semibold w-24 text-right">{t('sftp.size')}</th>
              <th className="py-2 px-3 font-semibold w-36">{t('sftp.modified')}</th>
              <th className="py-2 px-3 font-semibold w-24 text-center">{t('sftp.actions')}</th>
            </tr>
          </thead>
          <tbody className={isLight ? 'divide-y divide-slate-200' : 'divide-y divide-[#222222]'}>
            {/* Full-width "Up one level" (..) row */}
            {currentPath !== '/' && !/^[a-zA-Z]:\\?$/.test(currentPath) && (
              <tr
                onClick={() => {
                  if (clickMode === 'single') handleNavigateUp();
                }}
                onDoubleClick={() => {
                  if (clickMode === 'double') handleNavigateUp();
                }}
                className={`cursor-pointer group transition-colors select-none ${
                  isLight ? 'hover:bg-slate-200/80 bg-slate-100/50' : 'hover:bg-[#282828] bg-[#1a1a1a]/50'
                }`}
                title={t('sftp.upOneLevelTip')}
              >
                <td className="py-2 px-3">
                  <CornerLeftUp className="w-4 h-4 text-sky-400 group-hover:-translate-y-0.5 transition-transform" />
                </td>
                <td colSpan={4} className="py-2 px-3 font-semibold font-mono text-xs text-sky-400">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm">..</span>
                    <span className="text-[11px] font-sans font-normal text-slate-400">
                      ({t('sftp.parentDirectory')})
                    </span>
                  </div>
                </td>
              </tr>
            )}

            {filteredFiles.map((file) => (
              <tr
                key={file.path}
                draggable
                onDragStart={(e) => handleDragStart(e, file)}
                onDragOver={(e) => {
                  if (file.isDirectory) {
                    e.preventDefault();
                    setDragOverFolder(file.path);
                  }
                }}
                onDragLeave={() => setDragOverFolder(null)}
                onDrop={(e) => {
                  if (file.isDirectory) {
                    e.stopPropagation();
                    handleDrop(e, file.path);
                  }
                }}
                onClick={() => {
                  setSelectedPath(file.path);
                  if (file.isDirectory && clickMode === 'single') {
                    navigateToFolder(file.path);
                  }
                }}
                onDoubleClick={() => {
                  if (file.isDirectory) {
                    if (clickMode === 'double') {
                      navigateToFolder(file.path);
                    }
                  } else if (onOpenFileInEditor) {
                    onOpenFileInEditor(file.path, file.name);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedPath(file.path);
                  setContextMenu({ x: e.clientX, y: e.clientY, file });
                }}
                className={`cursor-pointer group transition-colors ${
                  dragOverFolder === file.path
                    ? 'bg-amber-500/20 ring-2 ring-amber-400'
                    : selectedPath === file.path
                      ? isLight
                        ? 'bg-sky-100/90 text-sky-900 ring-1 ring-inset ring-sky-300 font-medium'
                        : 'bg-sky-500/20 text-white ring-1 ring-inset ring-sky-500/40 font-medium'
                      : isLight
                        ? 'hover:bg-slate-100/80'
                        : 'hover:bg-[#232323]'
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
                <td className="py-1.5 px-3 text-slate-400 text-[11px]">
                  {file.modifyTime ? new Date(file.modifyTime).toLocaleString() : '-'}
                </td>
                <td className="py-1.5 px-3 text-center">
                  {/* Quick Action Icons on Hover */}
                  <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(file);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-sky-400 hover:bg-sky-500/15 transition-colors"
                      title={t('sftp.copy')}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameTarget(file);
                        setNewName(file.name);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/15 transition-colors"
                      title={t('sftp.rename')}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file);
                      }}
                      className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/15 transition-colors"
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

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          className={`fixed z-50 rounded-xl shadow-2xl border py-1.5 text-xs select-none min-w-[160px] animate-in fade-in zoom-in-95 ${
            isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#232323] border-[#383838] text-slate-200'
          }`}
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 250), left: Math.min(contextMenu.x, window.innerWidth - 180) }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.file ? (
            <>
              <button
                onClick={() => {
                  handleCopy(contextMenu.file!);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t('sftp.copy')}</span>
              </button>
              <button
                onClick={() => {
                  handleCut(contextMenu.file!);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{t('sftp.cut')}</span>
              </button>
              <button
                onClick={() => {
                  setRenameTarget(contextMenu.file);
                  setNewName(contextMenu.file!.name);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-amber-500/15 hover:text-amber-400 flex items-center space-x-2"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{t('sftp.rename')}</span>
              </button>
              <div className="h-px bg-slate-500/15 my-1" />
              <button
                onClick={() => {
                  handleDelete(contextMenu.file!);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-500/15 text-rose-400 flex items-center space-x-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('sftp.delete')}</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setShowNewFolder(true);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('local.newFolder')}</span>
              </button>
              {clipboard && (
                <button
                  onClick={() => {
                    handlePaste(currentPath);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>{t('sftp.paste')}</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};
