import React, { useState, useEffect, useRef } from 'react';
import { 
  SFTPFile, DirectorySyncConfig, STORAGE_KEY_DIR_SYNC, FolderClickMode, 
  STORAGE_KEY_FOLDER_CLICK_MODE, FileClipboardState, EVENT_DIR_SYNC_CHANGED, EVENT_SFTP_REFRESHED 
} from '../types';
import { useTranslation } from '../i18n';
import { sanitizeRemotePath } from '../utils/pathUtils';
import { setFileClipboard, getFileClipboard, clearFileClipboard } from '../utils/fileClipboard';
import { 
  Folder, File, CornerLeftUp, 
  RotateCw, Plus, Trash2, Edit, Key, Shield, Search, ArrowRight, Download, Upload, Terminal as TerminalIcon,
  ArrowLeftRight, MousePointerClick, Copy, Scissors, ClipboardPaste, Check, AlertCircle, Edit3, FilePlus
} from 'lucide-react';
import { formatSize, getFileIcon } from './sftp/sftpUtils';
import { NewFolderPrompt, RenamePrompt } from './sftp/SftpModals';
import { SftpContextMenu } from './sftp/SftpContextMenu';

interface SftpViewProps {
  sessionId: string;
  isLight?: boolean;
  initialPath?: string;
  folderClickMode?: FolderClickMode;
  onOpenFileInEditor: (filePath: string, fileName: string) => void;
  onNavigateToTerminal?: (directoryPath: string, shouldSwitchTab?: boolean) => void;
}

export const SftpView: React.FC<SftpViewProps> = React.memo(({
  sessionId,
  isLight = false,
  initialPath = '/',
  folderClickMode = 'double',
  onOpenFileInEditor,
  onNavigateToTerminal,
}) => {
  const { t } = useTranslation();
  const [clickMode, setClickMode] = useState<FolderClickMode>(() => {
    return (localStorage.getItem(STORAGE_KEY_FOLDER_CLICK_MODE) as FolderClickMode) || folderClickMode || 'double';
  });

  useEffect(() => {
    if (folderClickMode) {
      setClickMode(folderClickMode);
    }
  }, [folderClickMode]);

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
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [inputPath, setInputPath] = useState(initialPath);
  const [files, setFiles] = useState<SFTPFile[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Two-Way Directory Sync Config
  const [syncConfig, setSyncConfig] = useState<DirectorySyncConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DIR_SYNC);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { terminalToBrowser: true, browserToTerminal: false };
  });
  const [showSyncPopover, setShowSyncPopover] = useState(false);
  const syncPopoverRef = useRef<HTMLDivElement>(null);
  const syncConfigRef = useRef(syncConfig);
  useEffect(() => {
    syncConfigRef.current = syncConfig;
  }, [syncConfig]);

  const updateSyncConfig = (next: DirectorySyncConfig) => {
    setSyncConfig(next);
    try {
      localStorage.setItem(STORAGE_KEY_DIR_SYNC, JSON.stringify(next));
      window.dispatchEvent(new CustomEvent(EVENT_DIR_SYNC_CHANGED, { detail: next }));
    } catch {}
  };

  useEffect(() => {
    const handleSyncChange = (e: any) => {
      if (e.detail) {
        setSyncConfig(e.detail);
      }
    };
    window.addEventListener(EVENT_DIR_SYNC_CHANGED, handleSyncChange);
    return () => window.removeEventListener(EVENT_DIR_SYNC_CHANGED, handleSyncChange);
  }, []);

  useEffect(() => {
    const handleSftpRefresh = () => {
      loadDirectory(currentPath);
    };
    window.addEventListener(EVENT_SFTP_REFRESHED, handleSftpRefresh);
    return () => window.removeEventListener(EVENT_SFTP_REFRESHED, handleSftpRefresh);
  }, [currentPath]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (syncPopoverRef.current && !syncPopoverRef.current.contains(e.target as Node)) {
        setShowSyncPopover(false);
      }
    };
    if (showSyncPopover) {
      window.addEventListener('mousedown', handleOutsideClick);
      return () => window.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [showSyncPopover]);

  // Dialog states
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SFTPFile | null>(null);
  const [newName, setNewName] = useState('');

  // Context Menu & Toast & Clipboard State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: SFTPFile | null } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const [clipboard, setClipboard] = useState<FileClipboardState | null>(getFileClipboard);
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

  const loadDirectory = async (pathToGo: string, forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await window.api.sftp.list(sessionId, pathToGo, forceRefresh);
      if (res) {
        setCurrentPath(res.currentPath);
        setInputPath(res.currentPath);
        setFiles(res.files);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to list directory');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = (pathToGo: string) => {
    const cleanPath = sanitizeRemotePath(pathToGo);
    loadDirectory(cleanPath);
    if (syncConfigRef.current.browserToTerminal) {
      onNavigateToTerminal?.(cleanPath, false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);

    // Listen to directory changes from terminal
    const unsubscribe = window.api?.ssh.onDirectoryChanged((payload) => {
      if (payload.sessionId === sessionId && payload.directory) {
        if (syncConfigRef.current.terminalToBrowser) {
          loadDirectory(payload.directory);
        }
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [sessionId]);

  // Synchronize when initialPath prop changes from external tabs
  useEffect(() => {
    if (isInitialPathMount.current) {
      isInitialPathMount.current = false;
      return;
    }
    if (initialPath && initialPath !== currentPath) {
      setCurrentPath(initialPath);
      setInputPath(initialPath);
      loadDirectory(initialPath);
    }
  }, [initialPath]);

  const handleNavigateUp = () => {
    if (currentPath === '/' || currentPath === '') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = '/' + parts.join('/');
    navigateToFolder(upPath);
  };

  const handleFileClick = (file: SFTPFile) => {
    if (file.isDirectory) {
      navigateToFolder(file.path);
    } else {
      onOpenFileInEditor(file.path, file.name);
    }
  };

  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    try {
      const target = currentPath.endsWith('/')
        ? `${currentPath}${newFileName.trim()}`
        : `${currentPath}/${newFileName.trim()}`;
      await window.api.sftp.writeFile(sessionId, target, '');
      setNewFileName('');
      setShowNewFile(false);
      loadDirectory(currentPath);
      showToast((t('sftp.createFile') || 'Создать файл') + ': ' + newFileName.trim(), 'success');
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
    } catch (err: any) {
      setError(`Error creating file: ${err.message}`);
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
      showToast(t('sftp.create') + ': ' + newFolderName, 'success');
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
    } catch (err: any) {
      setError(`Error creating directory: ${err.message}`);
    }
  };

  const handleDelete = async (file: SFTPFile) => {
    if (!confirm(t('sftp.deleteConfirm').replace('{name}', file.name))) return;
    try {
      await window.api.sftp.delete(sessionId, file.path, file.isDirectory);
      loadDirectory(currentPath);
      showToast(t('sftp.delete') + ': ' + file.name, 'info');
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
    } catch (err: any) {
      setError(`Delete failed: ${err.message}`);
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
      showToast(t('sftp.rename') + ': ' + newName.trim(), 'success');
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
    } catch (err: any) {
      setError(`Rename failed: ${err.message}`);
    }
  };

  const handleCopy = (file: SFTPFile) => {
    setFileClipboard({
      action: 'copy',
      source: 'remote',
      sessionId,
      files: [file.path],
    });
    showToast(t('sftp.copiedToast'), 'info');
  };

  const handleCut = (file: SFTPFile) => {
    setFileClipboard({
      action: 'cut',
      source: 'remote',
      sessionId,
      files: [file.path],
    });
    showToast(t('sftp.cutToast'), 'info');
  };

  const handlePaste = async (targetFolder: string = currentPath) => {
    const cb = getFileClipboard();
    if (!cb || cb.files.length === 0) return;

    try {
      setIsLoading(true);
      for (const src of cb.files) {
        let fileName = src.split(/[\\/]/).pop() || 'file';
        let dest = targetFolder.endsWith('/')
          ? `${targetFolder}${fileName}`
          : `${targetFolder}/${fileName}`;

        // If copying in the same folder, add a copy suffix
        if (cb.action === 'copy' && src === dest) {
          const extIndex = fileName.lastIndexOf('.');
          if (extIndex > 0) {
            const namePart = fileName.slice(0, extIndex);
            const extPart = fileName.slice(extIndex);
            fileName = `${namePart} - Copy${extPart}`;
          } else {
            fileName = `${fileName} - Copy`;
          }
          dest = targetFolder.endsWith('/')
            ? `${targetFolder}${fileName}`
            : `${targetFolder}/${fileName}`;
        }

        if (cb.source === 'remote' && cb.sessionId === sessionId) {
          if (cb.action === 'copy') {
            await window.api.sftp.copyFile(sessionId, src, dest);
          } else {
            await window.api.sftp.rename(sessionId, src, dest);
          }
        } else if (cb.source === 'local') {
          // Upload from local into remote SFTP target
          await window.api.sftp.uploadFile(sessionId, src, dest);
          if (cb.action === 'cut') {
            try {
              await window.api.local.delete(src);
            } catch {}
          }
        }
      }

      // If cut action, clear clipboard after successful paste
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

  const handleDragStart = (e: React.DragEvent, file: SFTPFile) => {
    e.dataTransfer.setData('application/x-bestty-sftp', JSON.stringify({
      sessionId,
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

    // 1. Files from external OS (Windows Explorer)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try {
        setIsLoading(true);
        for (const file of Array.from(e.dataTransfer.files)) {
          const localPath = (file as any).path;
          if (!localPath) continue;
          const fileName = file.name || localPath.split(/[\\/]/).pop();
          const remoteDest = targetDir.endsWith('/')
            ? `${targetDir}${fileName}`
            : `${targetDir}/${fileName}`;
          await window.api.sftp.uploadFile(sessionId, localPath, remoteDest);
        }
        showToast(t('sftp.uploadSuccess'), 'success');
        loadDirectory(currentPath);
      } catch (err: any) {
        setError(`Upload error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 2. From Local Files browser pane
    const localData = e.dataTransfer.getData('application/x-bestty-local');
    if (localData) {
      try {
        const item = JSON.parse(localData);
        if (item.path) {
          setIsLoading(true);
          const remoteDest = targetDir.endsWith('/')
            ? `${targetDir}${item.name}`
            : `${targetDir}/${item.name}`;
          await window.api.sftp.uploadFile(sessionId, item.path, remoteDest);
          showToast(t('sftp.uploadSuccess') + ': ' + item.name, 'success');
          loadDirectory(currentPath);
        }
      } catch (err: any) {
        setError(`Upload error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 3. From another SFTP pane or within same SFTP session
    const remoteData = e.dataTransfer.getData('application/x-bestty-sftp');
    if (remoteData) {
      try {
        const item = JSON.parse(remoteData);
        if (item.path && item.sessionId === sessionId) {
          const remoteDest = targetDir.endsWith('/')
            ? `${targetDir}${item.name}`
            : `${targetDir}/${item.name}`;
          if (item.path !== remoteDest) {
            await window.api.sftp.copyFile(sessionId, item.path, remoteDest);
            showToast(t('sftp.copiedToast') + ': ' + item.name, 'success');
            loadDirectory(currentPath);
          }
        }
      } catch (err: any) {}
    }
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
            onClick={() => loadDirectory(currentPath, true)}
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
          <button
            onClick={() => {
              setNewFileName('');
              setShowNewFile(true);
            }}
            className={`p-1.5 rounded transition-colors ${
              isLight ? 'hover:bg-slate-100 text-emerald-600' : 'hover:bg-white/10 text-emerald-400'
            }`}
            title={t('sftp.createFile') || 'Создать файл'}
          >
            <FilePlus className="w-4 h-4" />
          </button>
        </div>

        {/* Path Breadcrumbs / Input */}
        <div className={`flex-1 flex items-center border rounded-md px-2 py-0.5 text-xs font-mono overflow-x-auto ${
          isLight ? 'bg-slate-50 border-slate-300 text-slate-800' : 'bg-[#181818] border-[#333] text-slate-200'
        }`}>
          <button
            onClick={() => navigateToFolder('/')}
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
                  onClick={() => navigateToFolder(fullSubPath)}
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

        {/* Go to Directory in Active Terminal Button */}
        <button
          onClick={() => onNavigateToTerminal?.(currentPath, true)}
          className={`px-2.5 py-1 rounded text-xs font-medium flex items-center space-x-1 border transition-colors shadow-sm ${
            isLight
              ? 'bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100'
              : 'bg-sky-500/15 border-sky-500/30 text-sky-400 hover:bg-sky-500/25'
          }`}
          title={t('sftp.openInTerminalTip')}
        >
          <TerminalIcon className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-mono">{t('sftp.openInTerminal')}</span>
        </button>

        {/* Directory Sync Popover Button in SFTP */}
        <div className="relative" ref={syncPopoverRef}>
          <button
            onClick={() => setShowSyncPopover(!showSyncPopover)}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 border transition-colors shadow-sm ${
              syncConfig.terminalToBrowser || syncConfig.browserToTerminal
                ? isLight
                  ? 'bg-sky-50 border-sky-300 text-sky-700'
                  : 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                : isLight
                  ? 'text-slate-600 hover:bg-slate-100 border-slate-300'
                  : 'text-slate-400 hover:bg-white/10 border-[#3a3a3a]'
            }`}
            title={t('terminal.syncSettings')}
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span className="hidden md:inline font-mono text-[11px]">
              {syncConfig.terminalToBrowser && syncConfig.browserToTerminal
                ? '↔ Sync'
                : syncConfig.terminalToBrowser
                  ? '→ SFTP'
                  : syncConfig.browserToTerminal
                    ? '← Term'
                    : 'Sync Off'}
            </span>
          </button>

          {/* Sync Settings Dropdown Popover */}
          {showSyncPopover && (
            <div
              className={`absolute top-full right-0 mt-1.5 w-72 rounded-xl border shadow-2xl p-3 z-50 text-xs ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-800'
                  : 'bg-[#222222] border-[#3a3a3a] text-slate-100'
              }`}
            >
              <div className="font-semibold mb-2 flex items-center space-x-1.5 text-sky-400">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>{t('terminal.syncSettings')}</span>
              </div>

              <div className="space-y-2.5">
                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncConfig.terminalToBrowser}
                    onChange={(e) =>
                      updateSyncConfig({ ...syncConfig, terminalToBrowser: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-600 text-sky-500 focus:ring-sky-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-xs">{t('terminal.syncTermToBrowser')}</div>
                    <div className={`text-[10px] leading-tight mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {t('terminal.syncTermToBrowserDesc')}
                    </div>
                  </div>
                </label>

                <label className="flex items-start space-x-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncConfig.browserToTerminal}
                    onChange={(e) =>
                      updateSyncConfig({ ...syncConfig, browserToTerminal: e.target.checked })
                    }
                    className="mt-0.5 rounded border-slate-600 text-sky-500 focus:ring-sky-500"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-xs">{t('terminal.syncBrowserToTerm')}</div>
                    <div className={`text-[10px] leading-tight mt-0.5 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {t('terminal.syncBrowserToTermDesc')}
                    </div>
                  </div>
                </label>
              </div>

              <div className="h-px bg-slate-500/20 my-2.5" />

              <button
                onClick={() => {
                  onNavigateToTerminal?.(currentPath, true);
                  setShowSyncPopover(false);
                }}
                className="w-full py-1 px-2 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-400 font-medium text-[11px] flex items-center justify-center space-x-1.5 transition-colors"
              >
                <TerminalIcon className="w-3 h-3" />
                <span>{t('sftp.openInTerminal')}</span>
              </button>
            </div>
          )}
        </div>

          {/* Click Mode Toggle (1 vs 2) */}
          <button
            onClick={toggleClickMode}
            className={`px-2 py-1 rounded text-xs font-semibold flex items-center space-x-1 border transition-colors shadow-sm ${
              clickMode === 'single'
                ? isLight
                  ? 'bg-amber-50 border-amber-300 text-amber-700'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                : isLight
                  ? 'text-slate-600 hover:bg-slate-100 border-slate-300'
                  : 'text-slate-400 hover:bg-white/10 border-[#3a3a3a]'
            }`}
            title={t('sftp.clickModeDesc')}
          >
            <MousePointerClick className="w-3.5 h-3.5" />
            <span className="font-mono text-xs">{clickMode === 'single' ? '1' : '2'}</span>
          </button>

          {/* Paste button if clipboard active */}
          {clipboard && (
            <button
              onClick={() => handlePaste(currentPath)}
              className="p-1.5 rounded bg-sky-500/20 hover:bg-sky-500/30 text-sky-400 transition-colors"
              title={t('sftp.paste')}
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
            </button>
          )}

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

      {/* New Folder Prompt */}
      {showNewFolder && (
        <NewFolderPrompt
          isLight={isLight}
          folderName={newFolderName}
          onChangeFolderName={setNewFolderName}
          onSubmit={handleCreateFolder}
          onCancel={() => setShowNewFolder(false)}
        />
      )}

      {/* Rename Prompt */}
      {renameTarget && (
        <RenamePrompt
          isLight={isLight}
          target={renameTarget}
          newName={newName}
          onChangeNewName={setNewName}
          onSubmit={handleRename}
          onCancel={() => setRenameTarget(null)}
        />
      )}

      {/* Error display */}
      {error && (
        <div className="p-2 bg-red-950/50 border-b border-red-800 text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* File Table with Drop Zone & Context Menu */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={(e) => handleDrop(e, currentPath)}
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, file: null });
        }}
        className="flex-1 overflow-y-auto relative custom-scrollbar"
      >
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
              <th className="py-2 px-3 font-semibold w-28 text-center">{t('sftp.actions')}</th>
            </tr>
          </thead>
          <tbody className={isLight ? 'divide-y divide-slate-200' : 'divide-y divide-[#222222]'}>
            {/* Full-width "Up one level" (..) row */}
            {currentPath !== '/' && (
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
                <td colSpan={5} className="py-2 px-3 font-semibold font-mono text-xs text-sky-400">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-sm">..</span>
                    <span className={`text-[11px] font-sans font-normal ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
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
                  } else {
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
                <td className={`py-1.5 px-3 text-right ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {formatSize(file.size)}
                </td>
                <td className={`py-1.5 px-3 text-center font-mono text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {file.permissions}
                </td>
                <td className={`py-1.5 px-3 text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {file.modifyTime ? new Date(file.modifyTime).toLocaleString() : '-'}
                </td>
                <td className="py-1.5 px-3 text-center">
                  {/* Quick Action Buttons on Hover */}
                  <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.isDirectory && onNavigateToTerminal && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigateToTerminal(file.path);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isLight ? 'hover:bg-sky-50 text-sky-600' : 'hover:bg-sky-500/20 text-sky-400'
                        }`}
                        title={t('sftp.openInTerminalTip')}
                      >
                        <TerminalIcon className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {!file.isDirectory && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFileInEditor(file.path, file.name);
                        }}
                        className={`p-1 rounded transition-colors ${
                          isLight ? 'hover:bg-sky-50 text-sky-600' : 'hover:bg-sky-500/20 text-sky-500'
                        }`}
                        title={t('sftp.editInMonaco')}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(file);
                      }}
                      className={`p-1 rounded transition-colors ${
                        isLight ? 'hover:bg-sky-50 text-slate-600 hover:text-sky-600' : 'hover:bg-sky-500/20 text-slate-400 hover:text-sky-400'
                      }`}
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
                      className={`p-1 rounded transition-colors ${
                        isLight ? 'hover:bg-slate-200 text-slate-600 hover:text-slate-900' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                      }`}
                      title={t('sftp.rename')}
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file);
                      }}
                      className={`p-1 rounded transition-colors ${
                        isLight ? 'hover:bg-red-50 text-slate-600 hover:text-red-600' : 'hover:bg-red-500/20 text-slate-400 hover:text-red-500'
                      }`}
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
        <SftpContextMenu
          isLight={isLight}
          menu={contextMenu}
          clipboard={clipboard}
          onClose={() => setContextMenu(null)}
          onOpenFileInEditor={onOpenFileInEditor}
          onNavigateToTerminal={onNavigateToTerminal}
          onCopyFile={handleCopy}
          onCutFile={handleCut}
          onPaste={handlePaste}
          onStartRename={(file) => {
            setRenameTarget(file);
            setNewName(file.name);
          }}
          onDeleteFile={handleDelete}
          onNewFolder={() => setShowNewFolder(true)}
          onNewFile={() => {
            setNewFileName('');
            setShowNewFile(true);
          }}
          onRefresh={() => loadDirectory(currentPath, true)}
          currentPath={currentPath}
        />
      )}

      {/* New File Modal */}
      {showNewFile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFile}
            className={`w-80 rounded-2xl shadow-2xl border p-4 flex flex-col space-y-3 ${
              isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#222] border-[#383838] text-slate-100'
            }`}
          >
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
              <FilePlus className="w-4 h-4" />
              <span>{t('sftp.createFile') || 'Создать файл'}</span>
            </div>
            <p className={`text-[11px] font-mono truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {currentPath}
            </p>
            <input
              type="text"
              placeholder="example.txt"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none font-mono focus:border-emerald-500 ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#181818] border-[#333] text-white'
              }`}
              autoFocus
            />
            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewFile(false)}
                className={`px-3 py-1 rounded-lg text-xs transition-colors ${
                  isLight ? 'hover:bg-slate-200 text-slate-600 hover:text-slate-900' : 'hover:bg-white/10 text-slate-400'
                }`}
              >
                {t('sftp.cancel')}
              </button>
              <button
                type="submit"
                disabled={!newFileName.trim()}
                className="px-3 py-1 rounded-lg text-xs bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-40"
              >
                {t('sftp.create')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
});
