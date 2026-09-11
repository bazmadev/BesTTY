import React, { useState, useEffect, useRef } from 'react';
import { SFTPFile, FolderClickMode, STORAGE_KEY_FOLDER_CLICK_MODE, LocalDrive, FileClipboardState } from '../types';
import { useTranslation } from '../i18n';
import { setFileClipboard, getFileClipboard, clearFileClipboard } from '../utils/fileClipboard';
import { 
  Folder, File, FileCode, FileText, FileArchive, CornerLeftUp, 
  RotateCw, Plus, Trash2, Edit3, Search, HardDrive, Home, Copy, Scissors, ClipboardPaste,
  MousePointerClick, Check, AlertCircle, ArrowRight, X, UploadCloud, Clipboard
} from 'lucide-react';

interface LocalFilesViewProps {
  isLight?: boolean;
  initialPath?: string;
  folderClickMode?: FolderClickMode;
  onOpenFileInEditor?: (filePath: string, fileName: string) => void;
  activeSessions?: Map<string, any>;
  activeSessionId?: string;
  currentRemotePath?: string;
  onUploadToRemote?: (localPaths: string[]) => void;
}

export const LocalFilesView: React.FC<LocalFilesViewProps> = ({
  isLight = false,
  initialPath,
  folderClickMode = 'double',
  onOpenFileInEditor,
  activeSessions,
  activeSessionId,
  currentRemotePath,
  onUploadToRemote,
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

  const toggleClickMode = () => {
    setClickMode((prev) => (prev === 'single' ? 'double' : 'single'));
  };

  const [currentPath, setCurrentPath] = useState<string>(initialPath || '');
  const [inputPath, setInputPath] = useState<string>(initialPath || '');
  const [files, setFiles] = useState<SFTPFile[]>([]);
  const [drives, setDrives] = useState<LocalDrive[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
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

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [isPathCopied, setIsPathCopied] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const isCompact = containerWidth < 560;
  const isVeryCompact = containerWidth < 400;

  const handleCopyCurrentPath = () => {
    navigator.clipboard.writeText(currentPath);
    setIsPathCopied(true);
    setTimeout(() => setIsPathCopied(false), 2000);
  };

  const [activeRemotePath, setActiveRemotePath] = useState<string>(() => {
    try {
      return sessionStorage.getItem('bestty_last_sftp_path') || '/';
    } catch {
      return '/';
    }
  });

  useEffect(() => {
    const handlePathChange = (e: any) => {
      if (e.detail?.path) {
        setActiveRemotePath(e.detail.path);
      }
    };
    window.addEventListener('bestty_sftp_path_changed', handlePathChange);
    return () => window.removeEventListener('bestty_sftp_path_changed', handlePathChange);
  }, []);

  const [uploadModal, setUploadModal] = useState<{
    isOpen: boolean;
    paths: string[];
    targetFolder: string;
    conflictPolicy: 'overwrite' | 'skip' | 'rename';
  } | null>(null);

  const handleUploadToServer = (targetPathsOverride?: string[]) => {
    const targetPaths = targetPathsOverride || Array.from(selectedPaths);
    if (targetPaths.length === 0) return;

    if (onUploadToRemote) {
      onUploadToRemote(targetPaths);
      return;
    }

    let targetSessionId = activeSessionId;
    if (!targetSessionId && activeSessions && activeSessions.size > 0) {
      targetSessionId = Array.from(activeSessions.keys())[0];
    }

    if (!targetSessionId) {
      showToast(t('local.noActiveSession') || 'Нет активного SSH подключения к серверу', 'error');
      return;
    }

    const targetRemoteDir = currentRemotePath || activeRemotePath || '/';
    setUploadModal({
      isOpen: true,
      paths: targetPaths,
      targetFolder: targetRemoteDir,
      conflictPolicy: 'overwrite',
    });
  };

  const handleConfirmUpload = async () => {
    if (!uploadModal) return;
    const { paths, targetFolder, conflictPolicy } = uploadModal;
    setUploadModal(null);

    let targetSessionId = activeSessionId;
    if (!targetSessionId && activeSessions && activeSessions.size > 0) {
      targetSessionId = Array.from(activeSessions.keys())[0];
    }

    if (!targetSessionId) {
      showToast(t('local.noActiveSession') || 'Нет активного SSH подключения к серверу', 'error');
      return;
    }

    const cleanDir = targetFolder.trim() || '/';
    const batch = paths.map((p) => {
      const fileName = p.split(/[/\\]/).pop() || 'item';
      const remoteDest = `${cleanDir.replace(/\/+$/, '')}/${fileName}`;
      return { localPath: p, remoteDest };
    });

    try {
      showToast(t('local.uploadStarting') || `Отправка ${batch.length} объектов на сервер...`, 'info');
      const result = await window.api.sftp.uploadBatch(targetSessionId, batch, conflictPolicy);
      if (result.success) {
        showToast(t('local.uploadSuccess') || 'Файлы успешно отправлены на сервер', 'success');
        window.dispatchEvent(new CustomEvent('bestty_sftp_refreshed'));
      } else if (result.errors && result.errors.length > 0) {
        showToast(`${t('local.uploadErrors') || 'Ошибки'}: ${result.errors[0]}`, 'error');
      }
    } catch (err: any) {
      showToast(`Upload error: ${err.message}`, 'error');
    }
  };

  const localPathParts = React.useMemo(() => {
    if (!currentPath) return [];
    const normalized = currentPath.replace(/\\/g, '/');
    const driveMatch = normalized.match(/^([a-zA-Z]:)\/?(.*)$/);
    if (driveMatch) {
      const drive = driveMatch[1];
      const rest = driveMatch[2] ? driveMatch[2].split('/').filter(Boolean) : [];
      const parts = [{ name: drive + '\\', path: drive + '\\' }];
      let accum = drive + '\\';
      for (const seg of rest) {
        accum += (accum.endsWith('\\') ? '' : '\\') + seg;
        parts.push({ name: seg, path: accum });
      }
      return parts;
    }
    const segments = normalized.split('/').filter(Boolean);
    const parts = [{ name: '/', path: '/' }];
    let accum = '';
    for (const seg of segments) {
      accum += '/' + seg;
      parts.push({ name: seg, path: accum });
    }
    return parts;
  }, [currentPath]);

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
    setSelectedPaths(new Set());
    setLastSelectedPath(null);
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

  const handleDelete = async (file?: SFTPFile) => {
    let targets: string[] = [];
    if (file && !selectedPaths.has(file.path)) {
      targets = [file.path];
    } else if (selectedPaths.size > 0) {
      targets = Array.from(selectedPaths);
    } else if (file) {
      targets = [file.path];
    }
    if (targets.length === 0) return;

    const count = targets.length;
    const confirmMsg = count === 1
      ? t('sftp.deleteConfirm').replace('{name}', files.find((f) => f.path === targets[0])?.name || targets[0])
      : (t('sftp.deleteBatchConfirm')?.replace('{count}', String(count)) || `Вы уверены, что хотите удалить ${count} элементов?`);

    if (!window.confirm(confirmMsg)) return;

    try {
      setIsLoading(true);
      await window.api.local.deleteBatch(targets);
      setSelectedPaths(new Set());
      setLastSelectedPath(null);
      loadDirectory(currentPath);
      showToast(t('sftp.delete') + (count > 1 ? ` (${count})` : ''), 'info');
    } catch (e: any) {
      setError(`Failed to delete: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (file?: SFTPFile) => {
    let paths: string[] = [];
    if (file && !selectedPaths.has(file.path)) {
      paths = [file.path];
    } else if (selectedPaths.size > 0) {
      paths = Array.from(selectedPaths);
    } else if (file) {
      paths = [file.path];
    }
    if (paths.length === 0) return;

    setFileClipboard({
      action: 'copy',
      source: 'local',
      files: paths,
    });
    showToast(t('sftp.copiedToast') + (paths.length > 1 ? ` (${paths.length})` : ''), 'info');
  };

  const handleCut = (file?: SFTPFile) => {
    let paths: string[] = [];
    if (file && !selectedPaths.has(file.path)) {
      paths = [file.path];
    } else if (selectedPaths.size > 0) {
      paths = Array.from(selectedPaths);
    } else if (file) {
      paths = [file.path];
    }
    if (paths.length === 0) return;

    setFileClipboard({
      action: 'cut',
      source: 'local',
      files: paths,
    });
    showToast(t('sftp.cutToast') + (paths.length > 1 ? ` (${paths.length})` : ''), 'info');
  };

  const handlePaste = async (targetFolder: string = currentPath) => {
    const cb = getFileClipboard();
    if (!cb || cb.files.length === 0) return;

    const separator = targetFolder.includes('/') ? '/' : '\\';

    try {
      setIsLoading(true);
      if (cb.source === 'local') {
        for (const src of cb.files) {
          let fileName = src.split(/[\\/]/).pop() || 'file';
          let dest = targetFolder.endsWith(separator)
            ? `${targetFolder}${fileName}`
            : `${targetFolder}${separator}${fileName}`;

          if (cb.action === 'copy' && src.toLowerCase() === dest.toLowerCase()) {
            const extIndex = fileName.lastIndexOf('.');
            const namePart = extIndex > 0 ? fileName.slice(0, extIndex) : fileName;
            const extPart = extIndex > 0 ? fileName.slice(extIndex) : '';

            let candidate = `${namePart} - Copy${extPart}`;
            let counter = 2;
            const existingNames = new Set(files.map((f) => f.name.toLowerCase()));
            while (existingNames.has(candidate.toLowerCase())) {
              candidate = `${namePart} - Copy (${counter})${extPart}`;
              counter++;
            }
            fileName = candidate;
            dest = targetFolder.endsWith(separator)
              ? `${targetFolder}${fileName}`
              : `${targetFolder}${separator}${fileName}`;
          }

          if (cb.action === 'cut') {
            await window.api.local.rename(src, dest);
          } else {
            await window.api.local.copy(src, dest);
          }
        }
      } else if (cb.source === 'remote' && cb.sessionId) {
        const items = cb.files.map((src) => {
          const fileName = src.split('/').pop() || 'file';
          const dest = targetFolder.endsWith(separator)
            ? `${targetFolder}${fileName}`
            : `${targetFolder}${separator}${fileName}`;
          return { remotePath: src, localDest: dest };
        });

        await window.api.sftp.downloadBatch(cb.sessionId, items);
        if (cb.action === 'cut') {
          for (const src of cb.files) {
            try {
              await window.api.sftp.delete(cb.sessionId, src, false);
            } catch {}
          }
        }
      }

      if (cb.action === 'cut') {
        clearFileClipboard();
      }

      showToast(t('sftp.paste') + ' ' + (t('editor.savedSuccess') || 'успешно'), 'success');
      await loadDirectory(currentPath);
    } catch (err: any) {
      setError(`Paste error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCheckbox = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
    setLastSelectedPath(path);
  };

  const handleRowClick = (file: SFTPFile, e: React.MouseEvent) => {
    // 1. Ctrl / Meta key: toggle item in selection
    if (e.ctrlKey || e.metaKey) {
      setSelectedPaths((prev) => {
        const next = new Set(prev);
        if (next.has(file.path)) next.delete(file.path);
        else next.add(file.path);
        return next;
      });
      setLastSelectedPath(file.path);
      return;
    }

    // 2. Shift key: range selection (combining with existing selection)
    if (e.shiftKey) {
      if (lastSelectedPath) {
        const idx1 = filteredFiles.findIndex((f) => f.path === lastSelectedPath);
        const idx2 = filteredFiles.findIndex((f) => f.path === file.path);
        if (idx1 !== -1 && idx2 !== -1) {
          const start = Math.min(idx1, idx2);
          const end = Math.max(idx1, idx2);
          const rangePaths = filteredFiles.slice(start, end + 1).map((f) => f.path);
          setSelectedPaths((prev) => {
            const next = new Set(prev);
            rangePaths.forEach((p) => next.add(p));
            return next;
          });
          return;
        }
      }
      setSelectedPaths(new Set([file.path]));
      setLastSelectedPath(file.path);
      return;
    }

    // 3. Normal click without Ctrl or Shift: reset selection per UX requirement
    setSelectedPaths(new Set());
    setLastSelectedPath(file.path);

    // If folder and single-click mode: enter folder
    if (file.isDirectory && clickMode === 'single') {
      navigateToFolder(file.path);
    }
  };

  const handleSelectAll = () => {
    setSelectedPaths(new Set(filteredFiles.map((f) => f.path)));
  };

  const handleClearSelection = () => {
    setSelectedPaths(new Set());
    setLastSelectedPath(null);
  };

  const handleDragStart = (e: React.DragEvent, file: SFTPFile) => {
    const items = selectedPaths.has(file.path)
      ? Array.from(selectedPaths).map((p) => {
          const f = files.find((x) => x.path === p);
          return { path: p, name: f?.name || p.split(/[\\/]/).pop() || 'file', isDirectory: !!f?.isDirectory };
        })
      : [{ path: file.path, name: file.name, isDirectory: file.isDirectory }];

    e.dataTransfer.setData('application/x-bestty-local', JSON.stringify({
      items,
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
          let srcPath = (file as any).path;
          if (!srcPath && window.api?.getPathForFile) {
            srcPath = window.api.getPathForFile(file);
          }
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
        const payload = JSON.parse(remoteData);
        if (payload.sessionId) {
          setIsLoading(true);
          const itemsToDownload = payload.items || (payload.path ? [{ path: payload.path, name: payload.name }] : []);
          const batch = itemsToDownload.map((it: any) => ({
            remotePath: it.path,
            localDest: targetDir.endsWith(separator)
              ? `${targetDir}${it.name || it.path.split('/').pop()}`
              : `${targetDir}${separator}${it.name || it.path.split('/').pop()}`
          }));

          await window.api.sftp.downloadBatch(payload.sessionId, batch);
          showToast(t('sftp.downloadSuccess'), 'success');
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
        const payload = JSON.parse(localData);
        const itemsToCopy = payload.items || (payload.path ? [{ path: payload.path, name: payload.name }] : []);
        setIsLoading(true);
        for (const it of itemsToCopy) {
          const destPath = targetDir.endsWith(separator)
            ? `${targetDir}${it.name}`
            : `${targetDir}${separator}${it.name}`;

          if (it.path.toLowerCase() === destPath.toLowerCase()) continue;
          if (it.isDirectory && destPath.toLowerCase().startsWith(it.path.toLowerCase() + separator)) {
            continue;
          }
          await window.api.local.copy(it.path, destPath);
        }
        showToast(t('sftp.paste'), 'success');
        loadDirectory(currentPath);
      } catch (err: any) {
        setError(`Local copy error: ${err.message}`);
      } finally {
        setIsLoading(false);
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedPaths(new Set(filteredFiles.map((f) => f.path)));
      } else if (e.key === 'Escape') {
        setSelectedPaths(new Set());
        setLastSelectedPath(null);
      } else if (e.key === 'Delete') {
        if (selectedPaths.size > 0) {
          e.preventDefault();
          handleDelete();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
        if (selectedPaths.size > 0) {
          e.preventDefault();
          handleCopy();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
        if (selectedPaths.size > 0) {
          e.preventDefault();
          handleCut();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePaste(currentPath);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredFiles, selectedPaths, currentPath]);

  return (
    <div
      ref={containerRef}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => handleDrop(e, currentPath)}
      className={`flex-1 flex flex-col w-full h-full overflow-hidden select-none relative ${
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
      <div className={`h-10 border-b flex items-center justify-between px-2.5 text-xs shrink-0 space-x-2 ${
        isLight ? 'bg-[#f8f8f8] border-slate-200' : 'bg-[#202020] border-[#2d2d2d]'
      }`}>
        {/* Drive Buttons + Up one level */}
        <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0 mr-2">
          <button
            onClick={handleNavigateUp}
            disabled={!currentPath || /^[a-zA-Z]:\\?$/.test(currentPath) || currentPath === '/'}
            className={`p-1.5 rounded transition-colors shrink-0 ${
              isLight
                ? 'hover:bg-slate-200 text-slate-600 disabled:opacity-30'
                : 'hover:bg-white/10 text-slate-300 disabled:opacity-30'
            }`}
            title={t('sftp.upOneLevelTip')}
          >
            <CornerLeftUp className="w-3.5 h-3.5" />
          </button>
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
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
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
        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            onClick={() => loadDirectory(currentPath)}
            disabled={isLoading}
            className={`p-1.5 rounded transition-colors ${
              isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-white/10 text-slate-300'
            }`}
            title={t('local.refresh')}
          >
            <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-sky-500' : ''}`} />
          </button>

          <button
            onClick={() => setShowNewFolder(true)}
            className={`px-2 py-1 rounded flex items-center space-x-1 text-xs transition-colors border shadow-sm ${
              isLight 
                ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700' 
                : 'bg-[#262626] border-[#383838] hover:bg-[#303030] text-slate-200'
            }`}
            title={t('local.newFolder')}
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            {!isCompact && <span className="font-medium text-[11px]">{t('local.newFolder')}</span>}
          </button>

          {/* Click Mode Toggle */}
          <button
            onClick={toggleClickMode}
            className={`px-1.5 py-1 rounded flex items-center space-x-1 text-xs font-mono transition-colors border shadow-sm shrink-0 ${
              clickMode === 'single'
                ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                : isLight
                  ? 'hover:bg-slate-100 text-slate-600 border-slate-300'
                  : 'hover:bg-white/10 text-slate-300 border-[#383838]'
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

          <div className={`relative transition-all duration-150 ${
            isVeryCompact ? 'w-24' : isCompact ? 'w-32' : 'w-44'
          }`}>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 pointer-events-none" />
            <input
              type="text"
              placeholder={isVeryCompact ? '...' : t('local.filterFiles')}
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

      {/* New Folder Inline Form */}
      {showNewFolder && (
        <div className={`border-b p-2.5 flex items-center space-x-2 ${
          isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#242424] border-[#333]'
        }`}>
          <span className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('sftp.folderName')}</span>
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
              className={`text-xs px-2 py-1 rounded transition-colors ${
                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-slate-200'
              }`}
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
          <span className={`text-xs font-medium truncate max-w-xs ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
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
              className={`text-xs px-2 py-1 rounded transition-colors ${
                isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-slate-200'
              }`}
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

      {/* Multi-selection Action Toolbar */}
      {selectedPaths.size > 0 && (
        <div className={`px-3 py-1.5 flex items-center justify-between border-b text-xs animate-in slide-in-from-top-2 duration-150 select-none overflow-x-auto no-scrollbar gap-2 shrink-0 ${
          isLight
            ? 'bg-sky-50/90 border-sky-200 text-sky-900'
            : 'bg-sky-950/40 border-sky-800/40 text-sky-200'
        }`}>
          <div className="flex items-center space-x-2 shrink-0 whitespace-nowrap">
            <span className="font-semibold text-xs">
              {isVeryCompact ? `${selectedPaths.size}` : `${t('sftp.selectedCount') || 'Выбрано'}: ${selectedPaths.size}`}
            </span>
            <button
              onClick={handleSelectAll}
              className="text-[11px] underline opacity-80 hover:opacity-100 transition-opacity"
            >
              {t('sftp.selectAll') || 'Все'}
            </button>
          </div>

          <div className="flex items-center space-x-1.5 shrink-0 whitespace-nowrap">
            <button
              onClick={() => handleUploadToServer()}
              className="px-2 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white flex items-center space-x-1 transition-colors shadow-sm font-medium whitespace-nowrap text-xs shrink-0"
              title={`${t('local.uploadToServer') || 'Закачать на сервер'} (${activeRemotePath || '/'})`}
            >
              <UploadCloud className="w-3.5 h-3.5 shrink-0" />
              {!isCompact && <span>{t('local.uploadToServer') || 'Закачать на сервер'}</span>}
              <span className="font-mono text-[11px] font-bold">({selectedPaths.size})</span>
            </button>
            <button
              onClick={() => handleCopy()}
              className={`px-2 py-1 rounded-md border flex items-center space-x-1 transition-colors whitespace-nowrap text-xs shrink-0 ${
                isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-[#222] border-[#444] text-slate-200 hover:bg-[#333]'
              }`}
              title={`${t('sftp.copy')} (Ctrl+C)`}
            >
              <Copy className="w-3.5 h-3.5 shrink-0" />
              {!isCompact && <span>{t('sftp.copy')}</span>}
            </button>
            <button
              onClick={() => handleCut()}
              className={`px-2 py-1 rounded-md border flex items-center space-x-1 transition-colors whitespace-nowrap text-xs shrink-0 ${
                isLight ? 'bg-white border-slate-300 text-slate-700 hover:bg-slate-100' : 'bg-[#222] border-[#444] text-slate-200 hover:bg-[#333]'
              }`}
              title={`${t('sftp.cut')} (Ctrl+X)`}
            >
              <Scissors className="w-3.5 h-3.5 shrink-0" />
              {!isCompact && <span>{t('sftp.cut')}</span>}
            </button>
            <button
              onClick={() => handleDelete()}
              className="px-2 py-1 rounded-md bg-rose-600/90 hover:bg-rose-500 text-white flex items-center space-x-1 transition-colors shadow-sm whitespace-nowrap text-xs shrink-0"
              title={`${t('sftp.delete')} (Delete)`}
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" />
              {!isCompact && <span>{t('sftp.delete')}</span>}
            </button>
            <button
              onClick={handleClearSelection}
              className="p-1 rounded hover:bg-slate-500/20 transition-colors ml-0.5 shrink-0"
              title="Снять выделение (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
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
              <th
                className="py-2 px-3 font-semibold w-8 text-center cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  if (filteredFiles.length > 0 && selectedPaths.size === filteredFiles.length) {
                    handleClearSelection();
                  } else {
                    handleSelectAll();
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={filteredFiles.length > 0 && selectedPaths.size === filteredFiles.length}
                  onChange={() => {}}
                  className="w-3.5 h-3.5 rounded border-slate-400 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  title={t('sftp.selectAll') || 'Выбрать все'}
                />
              </th>
              <th className="py-2 px-1 font-semibold w-6"></th>
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
                  setSelectedPaths(new Set());
                  setLastSelectedPath(null);
                  if (clickMode === 'single') handleNavigateUp();
                }}
                onDoubleClick={() => {
                  setSelectedPaths(new Set());
                  setLastSelectedPath(null);
                  if (clickMode === 'double') handleNavigateUp();
                }}
                className={`cursor-pointer group transition-colors select-none ${
                  isLight ? 'hover:bg-slate-200/80 bg-slate-100/50' : 'hover:bg-[#282828] bg-[#1a1a1a]/50'
                }`}
                title={t('sftp.upOneLevelTip')}
              >
                <td className="py-2 px-3 text-center">
                  <CornerLeftUp className="w-4 h-4 text-sky-400 group-hover:-translate-y-0.5 transition-transform inline" />
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
                onClick={(e) => handleRowClick(file, e)}
                onDoubleClick={() => {
                  if (file.isDirectory) {
                    if (clickMode === 'double') {
                      setSelectedPaths(new Set());
                      setLastSelectedPath(null);
                      navigateToFolder(file.path);
                    }
                  } else if (onOpenFileInEditor) {
                    onOpenFileInEditor(file.path, file.name);
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!selectedPaths.has(file.path)) {
                    setSelectedPaths(new Set([file.path]));
                    setLastSelectedPath(file.path);
                  }
                  setContextMenu({ x: e.clientX, y: e.clientY, file });
                }}
                className={`cursor-pointer group transition-colors select-none ${
                  dragOverFolder === file.path
                    ? 'bg-amber-500/20 ring-2 ring-amber-400'
                    : selectedPaths.has(file.path)
                      ? isLight
                        ? 'bg-sky-100/90 text-sky-900 ring-1 ring-inset ring-sky-300 font-medium'
                        : 'bg-sky-500/25 text-white ring-1 ring-inset ring-sky-500/40 font-medium'
                      : isLight
                        ? 'hover:bg-slate-100/80'
                        : 'hover:bg-[#232323]'
                }`}
              >
                <td
                  className="py-1.5 px-3 text-center cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleCheckbox(file.path);
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPaths.has(file.path)}
                    onChange={() => {}}
                    className="w-3.5 h-3.5 rounded border-slate-400 text-sky-600 focus:ring-sky-500 cursor-pointer"
                  />
                </td>
                <td className="py-1.5 px-1">{getFileIcon(file)}</td>
                <td className={`py-1.5 px-3 font-sans truncate max-w-xs font-medium ${
                  isLight ? 'text-slate-800 group-hover:text-sky-600' : 'text-slate-200 group-hover:text-white'
                }`}>
                  {file.name}
                </td>
                <td className={`py-1.5 px-3 text-right ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {formatSize(file.size)}
                </td>
                <td className={`py-1.5 px-3 text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {file.modifyTime ? new Date(file.modifyTime).toLocaleString() : '-'}
                </td>
                <td className="py-1.5 px-3 text-center">
                  {/* Quick Action Icons on Hover */}
                  <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUploadToServer([file.path]);
                      }}
                      className={`p-1 rounded transition-colors ${
                        isLight ? 'text-slate-600 hover:text-sky-600 hover:bg-sky-50' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-500/15'
                      }`}
                      title={`${t('local.uploadToServer') || 'Закачать на сервер'} (${activeRemotePath || '/'})`}
                    >
                      <UploadCloud className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(file);
                      }}
                      className={`p-1 rounded transition-colors ${
                        isLight ? 'text-slate-600 hover:text-sky-600 hover:bg-sky-50' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-500/15'
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
                        isLight ? 'text-slate-600 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-amber-400 hover:bg-amber-500/15'
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
                        isLight ? 'text-slate-600 hover:text-rose-600 hover:bg-rose-50' : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/15'
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

      {/* Bottom Status & Breadcrumbs Bar */}
      <div className={`h-8 border-t flex items-center justify-between px-3 text-xs shrink-0 select-none ${
        isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#1c1c1c] border-[#292929] text-slate-300'
      }`}>
        {/* Breadcrumb segments */}
        <div className="flex items-center space-x-1 font-mono text-[11px] overflow-x-auto no-scrollbar flex-1 min-w-0 mr-2 py-0.5">
          <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0 mr-0.5" />
          {localPathParts.map((part, index) => {
            const isLast = index === localPathParts.length - 1;
            return (
              <React.Fragment key={part.path}>
                {index > 0 && <span className="text-slate-400 shrink-0">/</span>}
                <button
                  onClick={() => navigateToFolder(part.path)}
                  className={`hover:underline px-1 truncate max-w-[140px] shrink-0 ${
                    isLast
                      ? isLight ? 'text-sky-700 font-semibold' : 'text-sky-400 font-semibold'
                      : isLight ? 'text-slate-700 hover:text-sky-600' : 'text-slate-300 hover:text-white'
                  }`}
                  title={part.path}
                >
                  {part.name}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Right Info & Actions: Copy Path + Total Count */}
        <div className="flex items-center space-x-2 shrink-0 text-[11px]">
          <button
            onClick={handleCopyCurrentPath}
            className={`p-1 rounded transition-colors ${
              isPathCopied
                ? 'text-emerald-400 bg-emerald-500/10'
                : isLight
                  ? 'hover:bg-slate-200 text-slate-500'
                  : 'hover:bg-white/10 text-slate-400'
            }`}
            title={isPathCopied ? 'Скопировано!' : 'Копировать путь'}
          >
            {isPathCopied ? <Check className="w-3.5 h-3.5" /> : <Clipboard className="w-3.5 h-3.5" />}
          </button>

          <span className={`text-[11px] font-mono border-l pl-2 ${
            isLight ? 'border-slate-300 text-slate-500' : 'border-[#333] text-slate-400'
          }`}>
            {files.length} {t('sftp.items') || 'объектов'}
          </span>
        </div>
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
                  const paths = selectedPaths.size > 0 && selectedPaths.has(contextMenu.file!.path)
                    ? Array.from(selectedPaths)
                    : [contextMenu.file!.path];
                  handleUploadToServer(paths);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 text-sky-400 font-medium"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>
                  {t('local.uploadToServer') || 'Закачать на сервер'}{' '}
                  {selectedPaths.size > 1 && selectedPaths.has(contextMenu.file!.path) ? `(${selectedPaths.size})` : ''}
                </span>
              </button>
              <div className="h-px bg-slate-500/15 my-1" />
              <button
                onClick={() => {
                  handleCopy(contextMenu.file!);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{t('sftp.copy')} {selectedPaths.size > 1 ? `(${selectedPaths.size})` : ''}</span>
              </button>
              <button
                onClick={() => {
                  handleCut(contextMenu.file!);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span>{t('sftp.cut')} {selectedPaths.size > 1 ? `(${selectedPaths.size})` : ''}</span>
              </button>
              {selectedPaths.size <= 1 && (
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
              )}
              <div className="h-px bg-slate-500/15 my-1" />
              <button
                onClick={() => {
                  handleDelete(contextMenu.file!);
                  setContextMenu(null);
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-rose-500/15 text-rose-400 flex items-center space-x-2"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t('sftp.delete')} {selectedPaths.size > 1 ? `(${selectedPaths.size})` : ''}</span>
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

      {/* Upload Confirmation & Conflict Policy Modal */}
      {uploadModal?.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className={`w-full max-w-md rounded-lg shadow-2xl border overflow-hidden flex flex-col ${
              isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#1e1e1e] border-[#383838] text-slate-100'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`px-4 py-3 border-b flex items-center justify-between ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#252525] border-[#333]'
            }`}>
              <div className="flex items-center space-x-2">
                <UploadCloud className="w-4 h-4 text-sky-500" />
                <span className="font-semibold text-sm">
                  {t('local.uploadModalTitle') || 'Закачать на сервер'}
                </span>
              </div>
              <button
                onClick={() => setUploadModal(null)}
                className={`p-1 rounded transition-colors ${
                  isLight ? 'hover:bg-slate-200 text-slate-500' : 'hover:bg-white/10 text-slate-400'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 text-xs">
              {/* Target remote folder input */}
              <div>
                <label className={`block font-medium mb-1.5 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  {t('local.targetFolder') || 'Папка назначения на сервере:'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={uploadModal.targetFolder}
                    onChange={(e) => setUploadModal({ ...uploadModal, targetFolder: e.target.value })}
                    className={`w-full font-mono text-xs px-3 py-2 rounded border focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 ${
                      isLight
                        ? 'bg-slate-50 border-slate-300 text-slate-900 focus:bg-white'
                        : 'bg-[#141414] border-[#444] text-white focus:bg-[#181818]'
                    }`}
                    placeholder="/"
                    autoFocus
                  />
                </div>
              </div>

              {/* Items preview list */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`font-medium ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                    {t('local.selectedItems') || 'Выбрано объектов'}:
                  </span>
                  <span className="font-mono font-semibold text-sky-500">
                    {uploadModal.paths.length}
                  </span>
                </div>
                <div className={`max-h-28 overflow-y-auto rounded border p-2 space-y-1 font-mono text-[11px] ${
                  isLight ? 'bg-slate-50 border-slate-200 text-slate-600' : 'bg-[#141414] border-[#303030] text-slate-400'
                }`}>
                  {uploadModal.paths.slice(0, 6).map((p) => {
                    const name = p.split(/[/\\]/).pop() || p;
                    return (
                      <div key={p} className="truncate flex items-center space-x-1.5">
                        <span className="text-sky-400 shrink-0">•</span>
                        <span className="truncate">{name}</span>
                      </div>
                    );
                  })}
                  {uploadModal.paths.length > 6 && (
                    <div className="text-[10px] text-slate-500 pl-3 italic">
                      +{uploadModal.paths.length - 6} еще...
                    </div>
                  )}
                </div>
              </div>

              {/* Conflict Policy Selector */}
              <div>
                <label className={`block font-medium mb-2 ${isLight ? 'text-slate-700' : 'text-slate-300'}`}>
                  {t('local.conflictPolicyTitle') || 'Если файл уже существует на сервере:'}
                </label>
                <div className="space-y-1.5">
                  {[
                    { id: 'overwrite', label: t('local.conflictOverwrite') || 'Перезаписать существующие (Overwrite)' },
                    { id: 'skip', label: t('local.conflictSkip') || 'Пропустить существующие (Skip)' },
                    { id: 'rename', label: t('local.conflictRename') || 'Сохранить оба (переименовать в "файл (1)")' },
                  ].map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center space-x-2.5 p-2 rounded cursor-pointer border transition-colors ${
                        uploadModal.conflictPolicy === option.id
                          ? isLight
                            ? 'bg-sky-50 border-sky-300 text-sky-950 font-medium'
                            : 'bg-sky-950/40 border-sky-600/50 text-sky-200 font-medium'
                          : isLight
                            ? 'border-slate-200 hover:bg-slate-50 text-slate-700'
                            : 'border-[#2e2e2e] hover:bg-[#252525] text-slate-400'
                      }`}
                    >
                      <input
                        type="radio"
                        name="conflictPolicy"
                        value={option.id}
                        checked={uploadModal.conflictPolicy === option.id}
                        onChange={() => setUploadModal({ ...uploadModal, conflictPolicy: option.id as any })}
                        className="text-sky-600 focus:ring-sky-500"
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`px-4 py-3 border-t flex items-center justify-end space-x-2 ${
              isLight ? 'bg-slate-50 border-slate-200' : 'bg-[#252525] border-[#333]'
            }`}>
              <button
                type="button"
                onClick={() => setUploadModal(null)}
                className={`px-3 py-1.5 rounded transition-colors text-xs ${
                  isLight ? 'text-slate-600 hover:bg-slate-200' : 'text-slate-400 hover:bg-white/10'
                }`}
              >
                {t('sftp.cancel') || 'Отмена'}
              </button>
              <button
                type="button"
                onClick={handleConfirmUpload}
                className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs flex items-center space-x-1.5 shadow-sm transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{t('local.confirmUpload') || 'Закачать'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
