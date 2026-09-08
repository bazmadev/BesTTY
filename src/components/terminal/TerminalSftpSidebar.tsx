import React, { useState, useEffect } from 'react';
import { 
  FolderTree, ArrowLeftRight, PanelLeft, PanelRight, CornerLeftUp, 
  MousePointerClick, RotateCw, X, Terminal as TerminalIcon, 
  Folder, FileText, Edit, FolderPlus, 
  FilePlus, Trash2, Edit3, Copy, Scissors, ClipboardPaste, Clipboard,
  Check, AlertCircle
} from 'lucide-react';
import { 
  SFTPFile, FolderClickMode, STORAGE_KEY_FOLDER_CLICK_MODE, 
  DirectorySyncConfig, STORAGE_KEY_DIR_SYNC, EVENT_DIR_SYNC_CHANGED, 
  EVENT_SFTP_REFRESHED 
} from '../../types';
import { sanitizeRemotePath } from '../../utils/pathUtils';
import { getFileClipboard, setFileClipboard, clearFileClipboard } from '../../utils/fileClipboard';
import { formatSize, getFileIcon } from '../sftp/sftpUtils';

interface TerminalSftpSidebarProps {
  sessionId: string;
  width: number;
  position: 'left' | 'right';
  currentPath: string;
  showMonitorSidebar: boolean;
  isLight: boolean;
  folderClickMode?: FolderClickMode;
  t: (key: string) => string;
  onSwapPanels: () => void;
  onTogglePosition: () => void;
  onClose: () => void;
  onOpenFileInEditor: (filePath: string, fileName: string) => void;
  onNavigateFolderInTerminal: (folderPath: string) => void;
}

export const TerminalSftpSidebar: React.FC<TerminalSftpSidebarProps> = React.memo(({
  sessionId,
  width,
  position,
  currentPath: propCurrentPath,
  showMonitorSidebar,
  isLight,
  folderClickMode = 'double',
  t,
  onSwapPanels,
  onTogglePosition,
  onClose,
  onOpenFileInEditor,
  onNavigateFolderInTerminal,
}) => {
  const [sftpPath, setSftpPath] = useState(propCurrentPath || '/');
  const [sidebarFiles, setSidebarFiles] = useState<SFTPFile[]>([]);
  const [isSftpLoading, setIsSftpLoading] = useState(false);
  const [sftpFilter, setSftpFilter] = useState('');
  const [selectedSidebarPath, setSelectedSidebarPath] = useState<string | null>(null);

  // Click Mode State (1-click or 2-clicks)
  const [clickMode, setClickMode] = useState<FolderClickMode>(() => {
    return (localStorage.getItem(STORAGE_KEY_FOLDER_CLICK_MODE) as FolderClickMode) || folderClickMode || 'double';
  });

  // Directory Sync Configuration State
  const [syncConfig, setSyncConfig] = useState<DirectorySyncConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_DIR_SYNC);
      if (saved) return JSON.parse(saved);
    } catch {}
    return { terminalToBrowser: true, browserToTerminal: false };
  });

  // Modals and dialogs
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [renameTarget, setRenameTarget] = useState<SFTPFile | null>(null);
  const [newName, setNewName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SFTPFile | null>(null);

  // Drag and Drop over subfolders and container
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [isDragOverContainer, setIsDragOverContainer] = useState(false);

  // Toast feedback
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Context Menu
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: SFTPFile | null;
  } | null>(null);

  // Sync listener across windows/tabs
  useEffect(() => {
    const handleSyncChange = (e: any) => {
      const detail = e.detail;
      if (detail) {
        setSyncConfig(detail);
      }
    };
    window.addEventListener(EVENT_DIR_SYNC_CHANGED, handleSyncChange);
    return () => window.removeEventListener(EVENT_DIR_SYNC_CHANGED, handleSyncChange);
  }, []);

  // Refresh listener
  useEffect(() => {
    const handleSftpRefresh = () => {
      loadSidebarDirectory(sftpPath);
    };
    window.addEventListener(EVENT_SFTP_REFRESHED, handleSftpRefresh);
    return () => window.removeEventListener(EVENT_SFTP_REFRESHED, handleSftpRefresh);
  }, [sftpPath]);

  // Click mode listener
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

  // Close context menu on outside click
  useEffect(() => {
    const handleOutsideClick = () => {
      setContextMenu(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const toggleClickMode = () => {
    const next = clickMode === 'single' ? 'double' : 'single';
    setClickMode(next);
    localStorage.setItem(STORAGE_KEY_FOLDER_CLICK_MODE, next);
    window.dispatchEvent(new CustomEvent('bestty_folder_click_mode_changed', { detail: next }));
  };

  const loadSidebarDirectory = async (pathToGo: string, forceRefresh = false) => {
    setIsSftpLoading(true);
    try {
      const res = await window.api?.sftp.list(sessionId, pathToGo, forceRefresh);
      if (res) {
        setSftpPath(res.currentPath);
        setSidebarFiles(res.files);
      }
    } catch (e) {
      // ignore
    } finally {
      setIsSftpLoading(false);
    }
  };

  useEffect(() => {
    if (propCurrentPath && propCurrentPath !== sftpPath) {
      setSftpPath(propCurrentPath);
      loadSidebarDirectory(propCurrentPath);
    }
  }, [propCurrentPath]);

  useEffect(() => {
    loadSidebarDirectory(sftpPath);
  }, [sessionId]);

  // Navigate folder and sync to terminal if browserToTerminal is enabled
  const navigateToDirectory = (pathToGo: string) => {
    const clean = sanitizeRemotePath(pathToGo);
    loadSidebarDirectory(clean);
    if (syncConfig.browserToTerminal) {
      onNavigateFolderInTerminal(clean);
    }
  };

  const handleSidebarNavigateUp = () => {
    if (sftpPath === '/' || sftpPath === '') return;
    const parts = sftpPath.split('/').filter(Boolean);
    parts.pop();
    const parentPath = '/' + parts.join('/');
    navigateToDirectory(parentPath);
  };

  const handleSidebarFileClick = (file: SFTPFile) => {
    if (file.isDirectory) {
      navigateToDirectory(file.path);
    } else {
      onOpenFileInEditor(file.path, file.name);
    }
  };

  // File Creation Operations
  const handleCreateFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    try {
      const target = sftpPath.endsWith('/')
        ? `${sftpPath}${newFileName.trim()}`
        : `${sftpPath}/${newFileName.trim()}`;
      await window.api.sftp.writeFile(sessionId, target, '');
      setNewFileName('');
      setShowNewFileModal(false);
      loadSidebarDirectory(sftpPath);
      showToast(`${t('sftp.createFile') || 'Файл создан'}: ${newFileName.trim()}`, 'success');
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
    } catch (err: any) {
      showToast(`Error creating file: ${err.message}`, 'error');
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      const target = sftpPath.endsWith('/')
        ? `${sftpPath}${newFolderName.trim()}`
        : `${sftpPath}/${newFolderName.trim()}`;
      await window.api.sftp.mkdir(sessionId, target);
      setNewFolderName('');
      setShowNewFolderModal(false);
      loadSidebarDirectory(sftpPath);
      showToast(`${t('sftp.createFolder') || 'Папка создана'}: ${newFolderName.trim()}`, 'success');
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
    } catch (err: any) {
      showToast(`Error creating folder: ${err.message}`, 'error');
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameTarget || !newName.trim()) return;
    try {
      const parentDir = sftpPath.endsWith('/') ? sftpPath : `${sftpPath}/`;
      const target = `${parentDir}${newName.trim()}`;
      await window.api.sftp.rename(sessionId, renameTarget.path, target);
      setRenameTarget(null);
      setNewName('');
      loadSidebarDirectory(sftpPath);
      showToast(`${t('sftp.rename')}: ${newName.trim()}`, 'success');
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
    } catch (err: any) {
      showToast(`Rename failed: ${err.message}`, 'error');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await window.api.sftp.delete(sessionId, deleteTarget.path, deleteTarget.isDirectory);
      setDeleteTarget(null);
      loadSidebarDirectory(sftpPath);
      showToast(`${t('sftp.delete')}: ${deleteTarget.name}`, 'info');
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
    } catch (err: any) {
      showToast(`Delete failed: ${err.message}`, 'error');
    }
  };

  // Clipboard Operations
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

  const handlePaste = async (targetFolder: string = sftpPath) => {
    const cb = getFileClipboard();
    if (!cb || cb.files.length === 0) return;

    try {
      setIsSftpLoading(true);
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
          await window.api.sftp.uploadFile(sessionId, src, dest);
          if (cb.action === 'cut') {
            try {
              await window.api.local.delete(src);
            } catch {}
          }
        }
      }

      if (cb.action === 'cut') {
        clearFileClipboard();
      }

      showToast(`${t('sftp.paste')} (${cb.files.length})`, 'success');
      loadSidebarDirectory(sftpPath);
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
    } catch (err: any) {
      showToast(`Paste failed: ${err.message}`, 'error');
    } finally {
      setIsSftpLoading(false);
    }
  };

  // Drag and drop handler (dropping into target folder or sftpPath)
  const handleDrop = async (e: React.DragEvent, targetDir: string = sftpPath) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOverContainer(false);
    setDragOverFolder(null);

    const cleanTarget = sanitizeRemotePath(targetDir);

    // 1. Files from Windows Explorer
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try {
        setIsSftpLoading(true);
        for (const file of Array.from(e.dataTransfer.files)) {
          const localPath = (file as any).path;
          if (!localPath) continue;
          const fileName = file.name || localPath.split(/[\\/]/).pop();
          const remoteDest = cleanTarget.endsWith('/')
            ? `${cleanTarget}${fileName}`
            : `${cleanTarget}/${fileName}`;
          await window.api.sftp.uploadFile(sessionId, localPath, remoteDest);
        }
        showToast(
          (t('sftp.uploadedToFolder') || 'Файл успешно загружен в {folder}').replace('{folder}', cleanTarget),
          'success'
        );
        loadSidebarDirectory(sftpPath);
        window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
      } catch (err: any) {
        showToast(`Upload error: ${err.message}`, 'error');
      } finally {
        setIsSftpLoading(false);
      }
      return;
    }

    // 2. From Local Files browser pane
    const localData = e.dataTransfer.getData('application/x-bestty-local');
    if (localData) {
      try {
        const item = JSON.parse(localData);
        if (item.path) {
          setIsSftpLoading(true);
          const remoteDest = cleanTarget.endsWith('/')
            ? `${cleanTarget}${item.name}`
            : `${cleanTarget}/${item.name}`;
          await window.api.sftp.uploadFile(sessionId, item.path, remoteDest);
          showToast(
            (t('sftp.uploadedToFolder') || 'Файл успешно загружен в {folder}').replace('{folder}', cleanTarget) + `: ${item.name}`,
            'success'
          );
          loadSidebarDirectory(sftpPath);
          window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
        }
      } catch (err: any) {
        showToast(`Upload error: ${err.message}`, 'error');
      } finally {
        setIsSftpLoading(false);
      }
      return;
    }

    // 3. From SFTP internally
    const remoteData = e.dataTransfer.getData('application/x-bestty-sftp');
    if (remoteData) {
      try {
        const item = JSON.parse(remoteData);
        if (item.path && item.sessionId === sessionId) {
          const remoteDest = cleanTarget.endsWith('/')
            ? `${cleanTarget}${item.name}`
            : `${cleanTarget}/${item.name}`;
          if (item.path !== remoteDest) {
            await window.api.sftp.copyFile(sessionId, item.path, remoteDest);
            showToast(`${t('sftp.copiedToast')}: ${item.name}`, 'success');
            loadSidebarDirectory(sftpPath);
            window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
          }
        }
      } catch (err: any) {}
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

  const filteredSidebarFiles = sidebarFiles.filter((f) =>
    f.name.toLowerCase().includes(sftpFilter.toLowerCase())
  );

  const activeClipboard = getFileClipboard();

  return (
    <div
      style={{ width: `${width}px` }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOverContainer(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsDragOverContainer(false);
        }
      }}
      onDrop={(e) => handleDrop(e, sftpPath)}
      className={`flex flex-col h-full select-none shadow-lg z-10 flex-shrink-0 relative ${
        position === 'right' ? 'border-l' : 'border-r'
      } ${
        isLight ? 'bg-[#f4f4f4] border-[#e0e0e0]' : 'bg-[#1c1c1c] border-[#2c2c2c]'
      } ${isDragOverContainer ? 'ring-2 ring-sky-500/80 bg-sky-500/5' : ''}`}
    >
      {/* SFTP Header */}
      <div className={`p-2 border-b flex flex-col space-y-1.5 ${
        isLight ? 'bg-[#ececec] border-[#e0e0e0]' : 'bg-[#222222] border-[#2c2c2c]'
      }`}>
        <div className="flex items-center justify-between">
          <span className={`text-[11px] font-bold uppercase tracking-wider flex items-center space-x-1.5 min-w-0 flex-1 truncate mr-1 ${
            isLight ? 'text-sky-600' : 'text-sky-400'
          }`}>
            <FolderTree className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">SFTP Files</span>
          </span>
          <div className="flex items-center space-x-0.5 flex-shrink-0">
            {/* New File Button */}
            <button
              onClick={() => {
                setNewFileName('');
                setShowNewFileModal(true);
              }}
              className={`p-1 rounded flex-shrink-0 transition-colors ${
                isLight ? 'text-emerald-600 hover:text-emerald-700 hover:bg-slate-200' : 'text-emerald-400 hover:text-emerald-300 hover:bg-white/10'
              }`}
              title={t('sftp.createFile') || 'Создать файл'}
            >
              <FilePlus className="w-3.5 h-3.5" />
            </button>

            {/* New Folder Button */}
            <button
              onClick={() => {
                setNewFolderName('');
                setShowNewFolderModal(true);
              }}
              className={`p-1 rounded flex-shrink-0 transition-colors ${
                isLight ? 'text-sky-600 hover:text-sky-700 hover:bg-slate-200' : 'text-sky-400 hover:text-sky-300 hover:bg-white/10'
              }`}
              title={t('sftp.createFolder') || 'Создать папку'}
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>

            {showMonitorSidebar ? (
              <button
                onClick={onSwapPanels}
                className={`p-1 rounded flex-shrink-0 transition-colors ${
                  isLight ? 'text-amber-600 hover:text-amber-700 hover:bg-slate-200' : 'text-amber-400 hover:text-amber-300 hover:bg-white/10'
                }`}
                title={t('terminal.swapPanels')}
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                onClick={onTogglePosition}
                className={`p-1 rounded flex-shrink-0 transition-colors ${
                  isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title={position === 'left' ? t('terminal.dockRight') : t('terminal.dockLeft')}
              >
                {position === 'left' ? <PanelRight className="w-3.5 h-3.5" /> : <PanelLeft className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              onClick={handleSidebarNavigateUp}
              disabled={sftpPath === '/' || sftpPath === ''}
              className={`p-1 rounded disabled:opacity-30 flex-shrink-0 transition-colors ${
                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={t('sftp.parentFolder')}
            >
              <CornerLeftUp className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={toggleClickMode}
              className={`px-1.5 py-0.5 rounded flex items-center space-x-1 text-[10px] font-mono transition-colors flex-shrink-0 ${
                clickMode === 'single'
                  ? isLight ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : isLight ? 'hover:bg-slate-200 text-slate-600 hover:text-slate-900' : 'hover:bg-white/10 text-slate-400 hover:text-white'
              }`}
              title={t('sftp.clickModeDesc')}
            >
              <MousePointerClick className="w-3 h-3" />
              <span className="font-bold text-[11px]">{clickMode === 'single' ? '1' : '2'}</span>
            </button>

            <button
              onClick={() => loadSidebarDirectory(sftpPath, true)}
              className={`p-1 rounded flex-shrink-0 transition-colors ${
                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={t('sftp.refresh')}
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSftpLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onClose}
              className={`p-1 rounded flex-shrink-0 transition-colors ${
                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={t('terminal.closeSidebar')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Path Breadcrumb Display + cd into terminal button */}
        <div className="flex items-center space-x-1">
          <div className={`flex-1 px-2 py-0.5 rounded text-[10px] font-mono truncate border ${
            isLight ? 'bg-white text-slate-700 border-slate-300' : 'bg-[#161616] text-slate-300 border-[#333]'
          }`} title={sftpPath}>
            {sftpPath}
          </div>
          <button
            onClick={() => onNavigateFolderInTerminal(sftpPath)}
            className="px-1.5 py-0.5 rounded bg-sky-600/20 border border-sky-500/30 text-sky-400 hover:bg-sky-600/30 text-[10px] font-mono flex items-center space-x-0.5"
            title={t('terminal.cdToTerminal')}
          >
            <TerminalIcon className="w-3 h-3" />
            <span>cd</span>
          </button>
        </div>

        {/* Quick Filter */}
        <input
          type="text"
          placeholder={t('sftp.filterFiles')}
          value={sftpFilter}
          onChange={(e) => setSftpFilter(e.target.value)}
          className={`w-full px-2 py-0.5 text-[11px] rounded border focus:outline-none focus:border-sky-500 ${
            isLight ? 'bg-white text-slate-900 border-slate-300' : 'bg-[#181818] text-white border-[#333]'
          }`}
        />
      </div>

      {/* Sidebar File Tree */}
      <div 
        onContextMenu={(e) => {
          e.preventDefault();
          setContextMenu({ x: e.clientX, y: e.clientY, file: null });
        }}
        className="flex-1 overflow-y-auto divide-y divide-slate-500/10 text-xs font-mono relative"
      >
        {sftpPath !== '/' && sftpPath !== '' && (
          <div
            onClick={() => {
              if (clickMode === 'single') handleSidebarNavigateUp();
            }}
            onDoubleClick={() => {
              if (clickMode === 'double') handleSidebarNavigateUp();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const parts = sftpPath.split('/').filter(Boolean);
              parts.pop();
              setDragOverFolder('/' + parts.join('/'));
            }}
            onDragLeave={() => setDragOverFolder(null)}
            onDrop={(e) => {
              e.stopPropagation();
              const parts = sftpPath.split('/').filter(Boolean);
              parts.pop();
              handleDrop(e, '/' + parts.join('/'));
            }}
            className={`w-full flex items-center px-2 py-1.5 cursor-pointer group transition-colors select-none ${
              dragOverFolder && dragOverFolder !== sftpPath
                ? 'bg-amber-500/20 ring-2 ring-amber-400'
                : isLight ? 'hover:bg-slate-200/80 bg-slate-100/60 text-slate-800' : 'hover:bg-[#282828] bg-[#1a1a1a]/60 text-slate-200'
            }`}
            title={t('sftp.upOneLevelTip')}
          >
            <div className="flex items-center space-x-1.5 truncate flex-1">
              <CornerLeftUp className="w-3.5 h-3.5 text-sky-400 group-hover:-translate-y-0.5 transition-transform flex-shrink-0" />
              <span className="font-bold text-xs font-mono text-sky-400">..</span>
              <span className={`text-[10px] font-sans truncate ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                ({t('sftp.parentDirectory')})
              </span>
            </div>
          </div>
        )}

        {filteredSidebarFiles.length === 0 ? (
          <div className={`p-4 text-center text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
            {isSftpLoading ? 'Loading...' : 'Folder is empty'}
          </div>
        ) : (
          filteredSidebarFiles.map((file) => {
            const isTargetFolderOver = file.isDirectory && dragOverFolder === file.path;
            return (
              <div
                key={file.path}
                draggable
                onDragStart={(e) => handleDragStart(e, file)}
                onDragOver={(e) => {
                  if (file.isDirectory) {
                    e.preventDefault();
                    e.stopPropagation();
                    setDragOverFolder(file.path);
                  }
                }}
                onDragLeave={() => {
                  if (file.isDirectory) setDragOverFolder(null);
                }}
                onDrop={(e) => {
                  if (file.isDirectory) {
                    e.stopPropagation();
                    handleDrop(e, file.path);
                  }
                }}
                onClick={() => {
                  setSelectedSidebarPath(file.path);
                  if (file.isDirectory && clickMode === 'single') {
                    handleSidebarFileClick(file);
                  }
                }}
                onDoubleClick={() => {
                  if (file.isDirectory) {
                    if (clickMode === 'double') {
                      handleSidebarFileClick(file);
                    }
                  } else {
                    onOpenFileInEditor(file.path, file.name);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSelectedSidebarPath(file.path);
                  setContextMenu({ x: e.clientX, y: e.clientY, file });
                }}
                className={`flex items-center justify-between px-2 py-1.5 cursor-pointer group transition-colors ${
                  isTargetFolderOver
                    ? 'bg-amber-500/25 ring-2 ring-amber-400 text-amber-200'
                    : selectedSidebarPath === file.path
                      ? isLight
                        ? 'bg-sky-100/90 text-sky-900 ring-1 ring-inset ring-sky-300 font-medium'
                        : 'bg-sky-500/20 text-white ring-1 ring-inset ring-sky-500/40 font-medium'
                      : isLight
                        ? 'hover:bg-slate-200/80 text-slate-800'
                        : 'hover:bg-[#252525] text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-1.5 truncate flex-1 mr-1">
                  {getFileIcon(file)}
                  <span className="truncate text-[11px] font-sans group-hover:font-medium">
                    {file.name}
                  </span>
                </div>

                <div className={`flex items-center space-x-1 text-[10px] flex-shrink-0 ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {file.isDirectory && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateFolderInTerminal(file.path);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-sky-500/20 text-sky-400 rounded flex items-center space-x-0.5"
                      title={`Open in Terminal (cd ${file.path})`}
                    >
                      <TerminalIcon className="w-3 h-3" />
                    </button>
                  )}

                  <span>{formatSize(file.size)}</span>
                  {!file.isDirectory && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFileInEditor(file.path, file.name);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-sky-500/20 text-sky-400 rounded"
                      title="Open in Monaco Editor"
                    >
                      <Edit className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Floating Toast Notification */}
      {toast && (
        <div className={`absolute bottom-2 left-2 right-2 p-2 rounded-lg text-[11px] shadow-xl flex items-center space-x-1.5 z-50 animate-in fade-in slide-in-from-bottom-2 ${
          toast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-slate-800 text-white border border-slate-700'
        }`}>
          {toast.type === 'success' ? (
            <Check className="w-3.5 h-3.5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          )}
          <span className="truncate flex-1">{toast.message}</span>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          className={`fixed z-50 rounded-xl shadow-2xl border py-1 text-xs select-none min-w-[170px] backdrop-blur-md animate-in fade-in zoom-in-95 ${
            isLight ? 'bg-white/95 border-slate-200 text-slate-800 shadow-slate-300' : 'bg-[#222]/95 border-[#3d3d3d] text-slate-100 shadow-black/80'
          }`}
          style={{
            top: Math.min(contextMenu.y, window.innerHeight - 280),
            left: Math.min(contextMenu.x, window.innerWidth - 190),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.file ? (
            <>
              {/* File / Folder Actions */}
              {!contextMenu.file.isDirectory ? (
                <button
                  onClick={() => {
                    onOpenFileInEditor(contextMenu.file!.path, contextMenu.file!.name);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
                >
                  <Edit className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t('sftp.editInMonaco')}</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    onNavigateFolderInTerminal(contextMenu.file!.path);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
                >
                  <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
                  <span>{t('sftp.openInTerminal')}</span>
                </button>
              )}

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

              {contextMenu.file.isDirectory && activeClipboard && (
                <button
                  onClick={() => {
                    handlePaste(contextMenu.file!.path);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 text-emerald-400 font-medium"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>{t('sftp.paste')}</span>
                </button>
              )}

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

              <button
                onClick={() => {
                  navigator.clipboard.writeText(contextMenu.file!.path);
                  showToast(t('terminal.pathCopied') || 'Путь скопирован', 'info');
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
              >
                <Clipboard className="w-3.5 h-3.5" />
                <span>{t('terminal.copyPath')}</span>
              </button>

              <div className="h-px bg-slate-500/15 my-1" />

              <button
                onClick={() => {
                  setDeleteTarget(contextMenu.file);
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
              {/* Empty Space Actions */}
              <button
                onClick={() => {
                  setNewFileName('');
                  setShowNewFileModal(true);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/15 hover:text-emerald-400 flex items-center space-x-2"
              >
                <FilePlus className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t('sftp.createFile') || 'Создать файл'}</span>
              </button>

              <button
                onClick={() => {
                  setNewFolderName('');
                  setShowNewFolderModal(true);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
              >
                <FolderPlus className="w-3.5 h-3.5 text-sky-400" />
                <span>{t('sftp.createFolder') || 'Создать папку'}</span>
              </button>

              {activeClipboard && (
                <button
                  onClick={() => {
                    handlePaste(sftpPath);
                    setContextMenu(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 text-emerald-400 font-medium"
                >
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  <span>{t('sftp.paste')}</span>
                </button>
              )}

              <div className="h-px bg-slate-500/15 my-1" />

              <button
                onClick={() => {
                  loadSidebarDirectory(sftpPath);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>{t('sftp.refresh')}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Modal: New File */}
      {showNewFileModal && (
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
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {sftpPath}
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
                onClick={() => setShowNewFileModal(false)}
                className="px-3 py-1 rounded-lg text-xs hover:bg-white/10 text-slate-400"
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

      {/* Modal: New Folder */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateFolder}
            className={`w-80 rounded-2xl shadow-2xl border p-4 flex flex-col space-y-3 ${
              isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#222] border-[#383838] text-slate-100'
            }`}
          >
            <div className="flex items-center space-x-2 text-sky-400 font-semibold text-sm">
              <FolderPlus className="w-4 h-4" />
              <span>{t('sftp.createFolder') || 'Создать папку'}</span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono truncate">
              {sftpPath}
            </p>
            <input
              type="text"
              placeholder="new_directory"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none font-mono focus:border-sky-500 ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#181818] border-[#333] text-white'
              }`}
              autoFocus
            />
            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-3 py-1 rounded-lg text-xs hover:bg-white/10 text-slate-400"
              >
                {t('sftp.cancel')}
              </button>
              <button
                type="submit"
                disabled={!newFolderName.trim()}
                className="px-3 py-1 rounded-lg text-xs bg-sky-600 hover:bg-sky-500 text-white disabled:opacity-40"
              >
                {t('sftp.create')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Rename */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleRename}
            className={`w-80 rounded-2xl shadow-2xl border p-4 flex flex-col space-y-3 ${
              isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#222] border-[#383838] text-slate-100'
            }`}
          >
            <div className="flex items-center space-x-2 text-amber-400 font-semibold text-sm">
              <Edit3 className="w-4 h-4" />
              <span>{t('sftp.rename')}</span>
            </div>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className={`w-full px-3 py-1.5 text-xs rounded-lg border outline-none font-mono focus:border-amber-500 ${
                isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#181818] border-[#333] text-white'
              }`}
              autoFocus
            />
            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setRenameTarget(null)}
                className="px-3 py-1 rounded-lg text-xs hover:bg-white/10 text-slate-400"
              >
                {t('sftp.cancel')}
              </button>
              <button
                type="submit"
                disabled={!newName.trim()}
                className="px-3 py-1 rounded-lg text-xs bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-40"
              >
                {t('sftp.rename')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div
            className={`w-80 rounded-2xl shadow-2xl border p-4 flex flex-col space-y-3 ${
              isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#222] border-[#383838] text-slate-100'
            }`}
          >
            <div className="flex items-center space-x-2 text-rose-400 font-semibold text-sm">
              <Trash2 className="w-4 h-4" />
              <span>{t('sftp.delete')}</span>
            </div>
            <p className="text-xs text-slate-300">
              {t('sftp.deleteConfirm').replace('{name}', deleteTarget.name)}
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-3 py-1 rounded-lg text-xs hover:bg-white/10 text-slate-400"
              >
                {t('sftp.cancel')}
              </button>
              <button
                onClick={handleDelete}
                className="px-3 py-1 rounded-lg text-xs bg-rose-600 hover:bg-rose-500 text-white font-medium"
              >
                {t('sftp.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
