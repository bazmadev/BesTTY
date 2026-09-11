import React, { useState, useEffect, useRef } from 'react';
import { 
  SFTPFile, DirectorySyncConfig, STORAGE_KEY_DIR_SYNC, FolderClickMode, 
  STORAGE_KEY_FOLDER_CLICK_MODE, FileClipboardState, EVENT_DIR_SYNC_CHANGED, EVENT_SFTP_REFRESHED 
} from '../types';
import { useTranslation } from '../i18n';
import { sanitizeRemotePath, parseSmartRemotePath } from '../utils/pathUtils';
import { setFileClipboard, getFileClipboard, clearFileClipboard } from '../utils/fileClipboard';
import { 
  Folder, File, CornerLeftUp, 
  RotateCw, Plus, Trash2, Edit, Key, Shield, Search, ArrowRight, Download, Upload, Terminal as TerminalIcon,
  ArrowLeftRight, MousePointerClick, Copy, Scissors, ClipboardPaste, Check, AlertCircle, Edit3, FilePlus,
  DownloadCloud, X, Clipboard
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
  hasTerminalPane?: boolean;
}

export const SftpView: React.FC<SftpViewProps> = React.memo(({
  sessionId,
  isLight = false,
  initialPath = '/',
  folderClickMode = 'double',
  onOpenFileInEditor,
  onNavigateToTerminal,
  hasTerminalPane = false,
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
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [inputPath, setInputPath] = useState(initialPath);
  const [files, setFiles] = useState<SFTPFile[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [lastSelectedPath, setLastSelectedPath] = useState<string | null>(null);
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
    if (currentPath) {
      try {
        sessionStorage.setItem(`bestty_sftp_path_${sessionId}`, currentPath);
        sessionStorage.setItem('bestty_last_sftp_path', currentPath);
        window.dispatchEvent(new CustomEvent('bestty_sftp_path_changed', {
          detail: { sessionId, path: currentPath }
        }));
      } catch {}
    }
  }, [currentPath, sessionId]);

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

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const [isPathCopied, setIsPathCopied] = useState(false);
  const [isPathPasted, setIsPathPasted] = useState(false);
  const [showGoToPathModal, setShowGoToPathModal] = useState(false);
  const [manualPathInput, setManualPathInput] = useState('');

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

  const handlePasteCurrentPath = async () => {
    try {
      let text = '';
      if (window.api?.clipboard?.readText) {
        text = await window.api.clipboard.readText();
      } else if (navigator.clipboard?.readText) {
        text = await navigator.clipboard.readText();
      }
      const parsed = parseSmartRemotePath(text, currentPath);
      if (parsed) {
        navigateToFolder(parsed);
        setIsPathPasted(true);
        setTimeout(() => setIsPathPasted(false), 2000);
        return;
      }
    } catch (err) {
      console.warn('Paste path failed:', err);
    }
    // If clipboard is empty or could not be parsed, open the Go To Path dialog
    setManualPathInput(currentPath);
    setShowGoToPathModal(true);
  };

  const handleGoToPathSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const parsed = parseSmartRemotePath(manualPathInput, currentPath);
    if (parsed) {
      navigateToFolder(parsed);
      setShowGoToPathModal(false);
      setIsPathPasted(true);
      setTimeout(() => setIsPathPasted(false), 2000);
    }
  };

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
    setSelectedPaths(new Set());
    setLastSelectedPath(null);
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
    setSelectedPaths(new Set());
    setLastSelectedPath(null);
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

    if (!confirm(confirmMsg)) return;

    try {
      setIsLoading(true);
      if (targets.length === 1) {
        const f = files.find((item) => item.path === targets[0]);
        await window.api.sftp.delete(sessionId, targets[0], !!f?.isDirectory);
      } else {
        await window.api.sftp.deleteBatch(sessionId, targets);
      }
      setSelectedPaths(new Set());
      setLastSelectedPath(null);
      await loadDirectory(currentPath, true);
      showToast(t('sftp.delete') + (count > 1 ? ` (${count})` : ''), 'info');
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
    } catch (err: any) {
      setError(`Delete failed: ${err.message}`);
    } finally {
      setIsLoading(false);
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
      source: 'remote',
      sessionId,
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
      source: 'remote',
      sessionId,
      files: paths,
    });
    showToast(t('sftp.cutToast') + (paths.length > 1 ? ` (${paths.length})` : ''), 'info');
  };

  const handleDownloadSelected = async () => {
    const pathsToDownload = Array.from(selectedPaths);
    if (pathsToDownload.length === 0) return;

    try {
      const destDir = await window.api.dialog?.selectFolder();
      if (!destDir) return;

      setIsLoading(true);
      const items = pathsToDownload.map((p) => {
        const f = files.find((x) => x.path === p);
        const name = f?.name || p.split('/').pop() || 'file';
        const separator = destDir.includes('/') ? '/' : '\\';
        const dest = destDir.endsWith(separator) ? `${destDir}${name}` : `${destDir}${separator}${name}`;
        return { remotePath: p, localDest: dest };
      });

      await window.api.sftp.downloadBatch(sessionId, items);
      showToast(t('sftp.downloadSuccess') || 'Скачивание успешно завершено', 'success');
    } catch (err: any) {
      setError(`Download error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaste = async (targetFolder: string = currentPath) => {
    const cb = getFileClipboard();
    if (!cb || cb.files.length === 0) return;

    try {
      setIsLoading(true);
      if (cb.source === 'local') {
        const batch = cb.files.map((src) => {
          const fileName = src.split(/[\\/]/).pop() || 'file';
          const dest = targetFolder.endsWith('/')
            ? `${targetFolder}${fileName}`
            : `${targetFolder}/${fileName}`;
          return { localPath: src, remoteDest: dest };
        });

        await window.api.sftp.uploadBatch(sessionId, batch);
        if (cb.action === 'cut') {
          try {
            await window.api.local.deleteBatch(cb.files);
          } catch {}
          clearFileClipboard();
        }
      } else if (cb.source === 'remote' && cb.sessionId === sessionId) {
        for (const src of cb.files) {
          let fileName = src.split(/[\\/]/).pop() || 'file';
          let dest = targetFolder.endsWith('/')
            ? `${targetFolder}${fileName}`
            : `${targetFolder}/${fileName}`;

          if (cb.action === 'copy' && src === dest) {
            const extIndex = fileName.lastIndexOf('.');
            const namePart = extIndex > 0 ? fileName.slice(0, extIndex) : fileName;
            const extPart = extIndex > 0 ? fileName.slice(extIndex) : '';

            let candidate = `${namePart} - Copy${extPart}`;
            let counter = 2;
            const existingNames = new Set(files.map((f) => f.name));
            while (existingNames.has(candidate)) {
              candidate = `${namePart} - Copy (${counter})${extPart}`;
              counter++;
            }
            fileName = candidate;
            dest = targetFolder.endsWith('/')
              ? `${targetFolder}${fileName}`
              : `${targetFolder}/${fileName}`;
          }

          if (cb.action === 'copy') {
            await window.api.sftp.copyFile(sessionId, src, dest);
          } else {
            await window.api.sftp.rename(sessionId, src, dest);
          }
        }
        if (cb.action === 'cut') {
          clearFileClipboard();
        }
      }

      showToast(t('sftp.paste') + ' ' + (t('editor.savedSuccess') || 'успешно'), 'success');
      await loadDirectory(currentPath, true);
      window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
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
          return { path: p, name: f?.name || p.split('/').pop() || 'file', isDirectory: !!f?.isDirectory };
        })
      : [{ path: file.path, name: file.name, isDirectory: file.isDirectory }];

    e.dataTransfer.setData('application/x-bestty-sftp', JSON.stringify({
      sessionId,
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

    // 1. Files from external OS (Windows Explorer)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      try {
        setIsLoading(true);
        const batch: Array<{ localPath: string; remoteDest: string }> = [];
        for (const file of Array.from(e.dataTransfer.files)) {
          let localPath = (file as any).path;
          if (!localPath && window.api?.getPathForFile) {
            localPath = window.api.getPathForFile(file);
          }
          if (!localPath) continue;
          const fileName = file.name || localPath.split(/[\\/]/).pop();
          const remoteDest = targetDir.endsWith('/')
            ? `${targetDir}${fileName}`
            : `${targetDir}/${fileName}`;
          batch.push({ localPath, remoteDest });
        }

        if (batch.length > 0) {
          await window.api.sftp.uploadBatch(sessionId, batch);
          showToast(t('sftp.uploadSuccess'), 'success');
          loadDirectory(currentPath);
        }
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
        const payload = JSON.parse(localData);
        const itemsToUpload = payload.items || (payload.path ? [{ path: payload.path, name: payload.name }] : []);
        if (itemsToUpload.length > 0) {
          setIsLoading(true);
          const batch = itemsToUpload.map((it: any) => ({
            localPath: it.path,
            remoteDest: targetDir.endsWith('/')
              ? `${targetDir}${it.name || it.path.split(/[\\/]/).pop()}`
              : `${targetDir}/${it.name || it.path.split(/[\\/]/).pop()}`
          }));
          await window.api.sftp.uploadBatch(sessionId, batch);
          showToast(t('sftp.uploadSuccess'), 'success');
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
        const payload = JSON.parse(remoteData);
        const itemsToCopy = payload.items || (payload.path ? [{ path: payload.path, name: payload.name }] : []);
        if (payload.sessionId === sessionId) {
          setIsLoading(true);
          for (const item of itemsToCopy) {
            const remoteDest = targetDir.endsWith('/')
              ? `${targetDir}${item.name}`
              : `${targetDir}/${item.name}`;
            if (item.path !== remoteDest) {
              await window.api.sftp.copyFile(sessionId, item.path, remoteDest);
            }
          }
          showToast(t('sftp.copiedToast'), 'success');
          await loadDirectory(currentPath, true);
          window.dispatchEvent(new CustomEvent(EVENT_SFTP_REFRESHED));
        }
      } catch (err: any) {
        setError(`Copy error: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    }
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
      } else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'l' || e.key.toLowerCase() === 'g')) {
        e.preventDefault();
        setManualPathInput(currentPath);
        setShowGoToPathModal(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredFiles, selectedPaths, currentPath]);

  // Breadcrumbs
  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div
      ref={containerRef}
      className={`flex-1 flex flex-col w-full h-full overflow-hidden select-none ${
        isLight ? 'bg-[#f8f8f8] text-slate-800' : 'bg-[#181818] text-slate-100'
      }`}
    >
      {/* Navigation and Actions Toolbar */}
      <div className={`h-10 border-b flex items-center justify-between px-2.5 space-x-2 shrink-0 ${
        isLight ? 'bg-white border-slate-200' : 'bg-[#202020] border-[#2d2d2d]'
      }`}>
        {/* Left Actions */}
        <div className="flex items-center space-x-1 shrink-0">
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
            className={`px-2 py-1 rounded flex items-center space-x-1 text-xs transition-colors border shadow-sm ${
              isLight 
                ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700' 
                : 'bg-[#262626] border-[#383838] hover:bg-[#303030] text-slate-200'
            }`}
            title={t('sftp.createFolder')}
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            {!isCompact && <span className="font-medium text-[11px]">{t('sftp.createFolder')}</span>}
          </button>
          <button
            onClick={() => {
              setNewFileName('');
              setShowNewFile(true);
            }}
            className={`px-2 py-1 rounded flex items-center space-x-1 text-xs transition-colors border shadow-sm ${
              isLight 
                ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-700' 
                : 'bg-[#262626] border-[#383838] hover:bg-[#303030] text-slate-200'
            }`}
            title={t('sftp.createFile') || 'Создать файл'}
          >
            <FilePlus className="w-3.5 h-3.5 text-emerald-400" />
            {!isCompact && <span className="font-medium text-[11px]">{t('sftp.createFile') || 'Файл'}</span>}
          </button>
        </div>

        {/* Right Actions & Search */}
        <div className="flex items-center space-x-1.5 shrink-0">
          {/* Go to Directory in Active Terminal Button */}
          <button
            onClick={() => onNavigateToTerminal?.(currentPath, true)}
            className={`px-2 py-1 rounded text-xs font-medium flex items-center space-x-1 border transition-colors shadow-sm ${
              isLight
                ? 'bg-sky-50 border-sky-300 text-sky-700 hover:bg-sky-100'
                : 'bg-sky-500/15 border-sky-500/30 text-sky-400 hover:bg-sky-500/25'
            }`}
            title={t('sftp.openInTerminalTip')}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            {!isCompact && <span className="font-mono text-[11px]">{t('sftp.openInTerminal')}</span>}
          </button>

          {/* Directory Sync Popover Button in SFTP (Only when an active terminal pane is adjacent in split view) */}
          {hasTerminalPane && (
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
                {!isCompact && (
                  <span className="font-mono text-[11px]">
                    {syncConfig.terminalToBrowser && syncConfig.browserToTerminal
                      ? '↔ Sync'
                      : syncConfig.terminalToBrowser
                        ? '→ SFTP'
                        : syncConfig.browserToTerminal
                          ? '← Term'
                          : 'Sync'}
                  </span>
                )}
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
          )}

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

          {/* Search input with adaptive width */}
          <div className={`relative transition-all duration-150 ${
            isVeryCompact ? 'w-24' : isCompact ? 'w-32' : 'w-44'
          }`}>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2 pointer-events-none" />
            <input
              type="text"
              placeholder={isVeryCompact ? '...' : t('sftp.filterFiles')}
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
              onClick={handleDownloadSelected}
              className="px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium flex items-center space-x-1 transition-colors shadow-sm whitespace-nowrap text-xs shrink-0"
              title={`${t('sftp.download') || 'Скачать на ПК'} (${selectedPaths.size})`}
            >
              <DownloadCloud className="w-3.5 h-3.5 shrink-0" />
              {!isCompact && <span>{t('sftp.download') || 'Скачать'}</span>}
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
              <th className="py-2 px-3 font-semibold w-28 text-center">{t('sftp.permissions')}</th>
              <th className="py-2 px-3 font-semibold w-40">{t('sftp.modified')}</th>
              <th className="py-2 px-3 font-semibold w-32 text-center">{t('sftp.actions')}</th>
            </tr>
          </thead>
          <tbody className={isLight ? 'divide-y divide-slate-200' : 'divide-y divide-[#222222]'}>
            {/* Full-width "Up one level" (..) row */}
            {currentPath !== '/' && (
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
                <td colSpan={6} className="py-2 px-3 font-semibold font-mono text-xs text-sky-400">
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
                  } else {
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
                <td className={`py-1.5 px-3 text-center font-mono text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {file.permissions}
                </td>
                <td className={`py-1.5 px-3 text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                  {file.modifyTime ? new Date(file.modifyTime).toLocaleString() : '-'}
                </td>
                <td className="py-1.5 px-3 text-center">
                  {/* Quick Action Buttons on Hover */}
                  <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedPaths(new Set([file.path]));
                        setLastSelectedPath(file.path);
                        handleDownloadSelected();
                      }}
                      className={`p-1 rounded transition-colors ${
                        isLight ? 'hover:bg-emerald-50 text-slate-600 hover:text-emerald-600' : 'hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400'
                      }`}
                      title={t('sftp.download') || 'Скачать на ПК'}
                    >
                      <DownloadCloud className="w-3.5 h-3.5" />
                    </button>
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

      {/* Bottom Status & Breadcrumbs Bar */}
      <div className={`h-8 border-t flex items-center justify-between px-3 text-xs shrink-0 select-none ${
        isLight ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-[#1c1c1c] border-[#292929] text-slate-300'
      }`}>
        {/* Breadcrumb segments */}
        <div 
          onDoubleClick={() => {
            setManualPathInput(currentPath);
            setShowGoToPathModal(true);
          }}
          className="flex items-center space-x-1 font-mono text-[11px] overflow-x-auto no-scrollbar flex-1 min-w-0 mr-2 py-0.5 cursor-pointer"
          title={`${currentPath} (двойной клик для ввода пути)`}
        >
          <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0 mr-0.5" />
          <button
            onClick={() => navigateToFolder('/')}
            className="text-sky-500 hover:underline px-1 font-bold shrink-0"
            title="Root (/)"
          >
            /
          </button>
          {pathParts.map((part, index) => {
            const fullSubPath = '/' + pathParts.slice(0, index + 1).join('/');
            const isLast = index === pathParts.length - 1;
            return (
              <React.Fragment key={fullSubPath}>
                <span className="text-slate-400 shrink-0">/</span>
                <button
                  onClick={() => navigateToFolder(fullSubPath)}
                  className={`hover:underline px-1 truncate max-w-[140px] shrink-0 ${
                    isLast
                      ? isLight ? 'text-sky-700 font-semibold' : 'text-sky-400 font-semibold'
                      : isLight ? 'text-slate-700 hover:text-sky-600' : 'text-slate-300 hover:text-white'
                  }`}
                  title={fullSubPath}
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Right Info & Actions: Paste / Copy Path + Total Count */}
        <div className="flex items-center space-x-1 shrink-0 text-[11px]">
          {/* Paste Path & Navigate Button */}
          <button
            onClick={handlePasteCurrentPath}
            className={`p-1 rounded transition-colors ${
              isPathPasted
                ? 'text-emerald-400 bg-emerald-500/10'
                : isLight
                  ? 'hover:bg-slate-200 text-slate-500 hover:text-sky-600'
                  : 'hover:bg-white/10 text-slate-400 hover:text-sky-400'
            }`}
            title={isPathPasted ? (t('sftp.pathPasted') || 'Переход выполнен!') : (t('sftp.pastePath') || 'Вставить путь и перейти (Ctrl+L)')}
          >
            {isPathPasted ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <ClipboardPaste className="w-3.5 h-3.5" />}
          </button>

          {/* Copy Path Button */}
          <button
            onClick={handleCopyCurrentPath}
            className={`p-1 rounded transition-colors ${
              isPathCopied
                ? 'text-emerald-400 bg-emerald-500/10'
                : isLight
                  ? 'hover:bg-slate-200 text-slate-500'
                  : 'hover:bg-white/10 text-slate-400'
            }`}
            title={isPathCopied ? (t('sftp.copiedToast') || 'Скопировано!') : (t('terminal.copyPath') || 'Копировать путь')}
          >
            {isPathCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Clipboard className="w-3.5 h-3.5" />}
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
        <SftpContextMenu
          isLight={isLight}
          menu={contextMenu}
          clipboard={clipboard}
          selectedCount={selectedPaths.size}
          onClose={() => setContextMenu(null)}
          onOpenFileInEditor={onOpenFileInEditor}
          onNavigateToTerminal={onNavigateToTerminal}
          onDownload={handleDownloadSelected}
          onCopyFile={() => handleCopy()}
          onCutFile={() => handleCut()}
          onPaste={handlePaste}
          onStartRename={(file) => {
            setRenameTarget(file);
            setNewName(file.name);
          }}
          onDeleteFile={() => handleDelete()}
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

      {/* Go To Path Modal (Smart Remote Path) */}
      {showGoToPathModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleGoToPathSubmit}
            className={`w-96 max-w-full rounded-2xl shadow-2xl border p-4 flex flex-col space-y-3 ${
              isLight ? 'bg-white border-slate-200 text-slate-800' : 'bg-[#222] border-[#383838] text-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sky-400 font-semibold text-sm">
                <ClipboardPaste className="w-4 h-4" />
                <span>{t('sftp.goToPath') || 'Перейти по пути'}</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGoToPathModal(false)}
                className={`p-1 rounded-lg transition-colors ${
                  isLight ? 'hover:bg-slate-200 text-slate-400 hover:text-slate-700' : 'hover:bg-white/10 text-slate-400 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className={`text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              {t('sftp.enterPathPrompt') || 'Укажите или вставьте путь (поддерживает cd, кавычки, диски):'}
            </p>

            <div className="flex items-center space-x-1.5">
              <input
                type="text"
                placeholder="/var/www/html"
                value={manualPathInput}
                onChange={(e) => setManualPathInput(e.target.value)}
                className={`flex-1 px-3 py-1.5 text-xs rounded-lg border outline-none font-mono focus:border-sky-500 ${
                  isLight ? 'bg-slate-50 border-slate-300 text-slate-900' : 'bg-[#181818] border-[#333] text-white'
                }`}
                autoFocus
              />
              <button
                type="button"
                onClick={async () => {
                  try {
                    let text = '';
                    if (window.api?.clipboard?.readText) {
                      text = await window.api.clipboard.readText();
                    } else if (navigator.clipboard?.readText) {
                      text = await navigator.clipboard.readText();
                    }
                    const parsed = parseSmartRemotePath(text, currentPath);
                    if (parsed) setManualPathInput(parsed);
                    else if (text) setManualPathInput(text.trim());
                  } catch {}
                }}
                className={`px-2 py-1.5 text-xs rounded-lg border flex items-center space-x-1 transition-colors ${
                  isLight
                    ? 'bg-slate-100 hover:bg-slate-200 border-slate-300 text-slate-700'
                    : 'bg-[#2a2a2a] hover:bg-[#333] border-[#444] text-slate-300'
                }`}
                title={t('terminal.paste') || 'Вставить'}
              >
                <ClipboardPaste className="w-3.5 h-3.5 text-sky-400" />
              </button>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setShowGoToPathModal(false)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  isLight ? 'hover:bg-slate-100 text-slate-600' : 'hover:bg-[#282828] text-slate-300'
                }`}
              >
                {t('sftp.cancel') || 'Отмена'}
              </button>
              <button
                type="submit"
                disabled={!manualPathInput.trim()}
                className="px-3.5 py-1.5 text-xs bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg shadow-sm transition-colors disabled:opacity-40"
              >
                {t('sftp.goToPathBtn') || 'Перейти'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
});
