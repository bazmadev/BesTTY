import React, { useState, useRef, useEffect } from 'react';
import { 
  Folder, ChevronRight, CornerLeftUp, FolderTree, ArrowLeftRight, Check, Clipboard, RotateCw 
} from 'lucide-react';
import { SFTPFile, DirectorySyncConfig } from '../../types';
import { sanitizeRemotePath } from '../../utils/pathUtils';

interface TerminalBreadcrumbsProps {
  sessionId: string;
  currentDirectory: string;
  isLight: boolean;
  syncConfig: DirectorySyncConfig;
  onUpdateSyncConfig: (next: DirectorySyncConfig) => void;
  onNavigateBreadcrumb: (path: string) => void;
  onNavigateUp: () => void;
  onOpenInSftp: () => void;
  onCopyPath: () => void;
  isPathCopied: boolean;
  t: (key: string) => string;
}

export const TerminalBreadcrumbs: React.FC<TerminalBreadcrumbsProps> = React.memo(({
  sessionId,
  currentDirectory,
  isLight,
  syncConfig,
  onUpdateSyncConfig,
  onNavigateBreadcrumb,
  onNavigateUp,
  onOpenInSftp,
  onCopyPath,
  isPathCopied,
  t,
}) => {
  const [showSyncPopover, setShowSyncPopover] = useState(false);
  const syncPopoverRef = useRef<HTMLDivElement>(null);

  // Subfolder Hover Peek State
  const [breadcrumbSubmenu, setBreadcrumbSubmenu] = useState<{
    path: string;
    folderName: string;
    anchorRect: { top: number; left: number; bottom: number; right: number; width: number };
    isLoading: boolean;
    subfolders: SFTPFile[];
    error?: string | null;
  } | null>(null);

  const hoverTimerRef = useRef<any>(null);
  const closeTimerRef = useRef<any>(null);
  const subfolderCacheRef = useRef<Record<string, SFTPFile[]>>({});

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

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

  const handleSegmentMouseEnter = (segmentPath: string, folderName: string, event: React.MouseEvent<HTMLElement>) => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }

    const targetElement = event.currentTarget;
    const rect = targetElement.getBoundingClientRect();
    const anchorRect = {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      right: rect.right,
      width: rect.width,
    };

    const cleanPath = sanitizeRemotePath(segmentPath);

    const cached = subfolderCacheRef.current[cleanPath];
    if (cached) {
      setBreadcrumbSubmenu({
        path: cleanPath,
        folderName,
        anchorRect,
        isLoading: false,
        subfolders: cached,
      });
      return;
    }

    hoverTimerRef.current = setTimeout(async () => {
      setBreadcrumbSubmenu({
        path: cleanPath,
        folderName,
        anchorRect,
        isLoading: true,
        subfolders: [],
      });

      try {
        const res = await window.api?.sftp.list(sessionId, cleanPath);
        const foldersOnly = (res?.files || [])
          .filter((f) => f.isDirectory)
          .sort((a, b) => a.name.localeCompare(b.name));

        subfolderCacheRef.current[cleanPath] = foldersOnly;
        setBreadcrumbSubmenu((prev) => {
          if (prev && prev.path === cleanPath) {
            return { ...prev, isLoading: false, subfolders: foldersOnly };
          }
          return prev;
        });
      } catch (err: any) {
        setBreadcrumbSubmenu((prev) => {
          if (prev && prev.path === cleanPath) {
            return { ...prev, isLoading: false, error: err?.message || 'Error loading folders' };
          }
          return prev;
        });
      }
    }, 650);
  };

  const handleSegmentMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    closeTimerRef.current = setTimeout(() => {
      setBreadcrumbSubmenu(null);
    }, 300);
  };

  const handleSubmenuMouseEnter = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleSubmenuMouseLeave = () => {
    closeTimerRef.current = setTimeout(() => {
      setBreadcrumbSubmenu(null);
    }, 300);
  };

  return (
    <div
      className={`h-8 border-t flex items-center justify-between px-3 text-xs select-none z-20 flex-shrink-0 ${
        isLight ? 'bg-[#f0f0f0] border-[#e0e0e0] text-slate-700' : 'bg-[#1e1e1e] border-[#2c2c2c] text-slate-300'
      }`}
    >
      {/* Left: Breadcrumbs Navigation */}
      <div className="flex items-center space-x-1 overflow-x-auto no-scrollbar py-1 mr-2 min-w-0">
        <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mr-1" />

        {/* Root '/' */}
        <button
          onClick={() => {
            setBreadcrumbSubmenu(null);
            onNavigateBreadcrumb('/');
          }}
          onMouseEnter={(e) => handleSegmentMouseEnter('/', '/', e)}
          onMouseLeave={handleSegmentMouseLeave}
          className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors ${
            currentDirectory === '/'
              ? 'font-bold text-sky-400 bg-sky-500/10'
              : isLight
                ? 'hover:bg-slate-300/60 text-slate-700'
                : 'hover:bg-white/10 text-slate-400 hover:text-slate-100'
          }`}
          title="cd /"
        >
          /
        </button>

        {/* Path segments */}
        {currentDirectory
          .split('/')
          .filter(Boolean)
          .map((segment, idx, arr) => {
            const segmentPath = '/' + arr.slice(0, idx + 1).join('/');
            const isLast = idx === arr.length - 1;

            return (
              <React.Fragment key={segmentPath}>
                <ChevronRight className="w-3 h-3 text-slate-500 flex-shrink-0 opacity-60" />
                <button
                  onClick={() => {
                    setBreadcrumbSubmenu(null);
                    onNavigateBreadcrumb(segmentPath);
                  }}
                  onMouseEnter={(e) => handleSegmentMouseEnter(segmentPath, segment, e)}
                  onMouseLeave={handleSegmentMouseLeave}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono transition-colors truncate max-w-[140px] ${
                    isLast
                      ? 'font-bold text-sky-400 bg-sky-500/10'
                      : isLight
                        ? 'hover:bg-slate-300/60 text-slate-700'
                        : 'hover:bg-white/10 text-slate-400 hover:text-slate-100'
                  }`}
                  title={`cd ${segmentPath}`}
                >
                  {segment}
                </button>
              </React.Fragment>
            );
          })}
      </div>

      {/* Right: Path utilities & Sync settings */}
      <div className="flex items-center space-x-1 flex-shrink-0">
        {/* Copy Path */}
        <button
          onClick={onCopyPath}
          className={`p-1 rounded text-[11px] transition-colors flex items-center space-x-1 ${
            isPathCopied
              ? 'text-emerald-400 bg-emerald-500/10'
              : isLight
                ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                : 'text-slate-400 hover:text-slate-100 hover:bg-white/10'
          }`}
          title={isPathCopied ? t('terminal.pathCopied') : t('terminal.copyPath')}
        >
          {isPathCopied ? <Check className="w-3 h-3" /> : <Clipboard className="w-3 h-3" />}
        </button>

        {/* Up One Level (cd ..) */}
        <button
          onClick={onNavigateUp}
          disabled={currentDirectory === '/'}
          className={`p-1 rounded text-[11px] transition-colors disabled:opacity-30 ${
            isLight
              ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
              : 'text-slate-400 hover:text-slate-100 hover:bg-white/10'
          }`}
          title={t('terminal.upOneLevel')}
        >
          <CornerLeftUp className="w-3 h-3" />
        </button>

        {/* Open in SFTP Browser (Manual Navigation) */}
        <button
          onClick={onOpenInSftp}
          className={`p-1 rounded text-[11px] transition-colors ${
            isLight
              ? 'text-slate-600 hover:text-sky-600 hover:bg-slate-200'
              : 'text-slate-400 hover:text-sky-400 hover:bg-white/10'
          }`}
          title={t('terminal.openInSftp')}
        >
          <FolderTree className="w-3 h-3" />
        </button>

        <div className="h-3 w-px bg-slate-500/20 mx-0.5" />

        {/* Directory Sync Popover Button */}
        <div className="relative" ref={syncPopoverRef}>
          <button
            onClick={() => setShowSyncPopover(!showSyncPopover)}
            className={`flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-all ${
              syncConfig.terminalToBrowser || syncConfig.browserToTerminal
                ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30'
                : isLight
                  ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                  : 'text-slate-400 hover:bg-white/10'
            }`}
            title={t('terminal.syncSettings')}
          >
            <ArrowLeftRight className="w-3 h-3" />
            <span className="hidden md:inline text-[10px]">
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
              className={`absolute bottom-full right-0 mb-1.5 w-72 rounded-xl border shadow-2xl p-3 z-50 text-xs ${
                isLight
                  ? 'bg-white border-slate-300 text-slate-800'
                  : 'bg-[#222222] border-[#3a3a3a] text-slate-100'
              }`}
            >
              <div className="font-semibold mb-2 flex items-center space-x-1.5 text-sky-400">
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>{t('terminal.syncSettings')}</span>
              </div>
              <div className="space-y-2 text-[11px]">
                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncConfig.terminalToBrowser}
                    onChange={(e) =>
                      onUpdateSyncConfig({
                        ...syncConfig,
                        terminalToBrowser: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-slate-600 text-sky-500 focus:ring-sky-500 focus:ring-offset-0 bg-transparent"
                  />
                  <div>
                    <div className="font-medium">{t('terminal.syncTermToBrowser')}</div>
                    <div className={`text-[10px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {t('terminal.syncTermToBrowserDesc')}
                    </div>
                  </div>
                </label>

                <label className="flex items-start space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncConfig.browserToTerminal}
                    onChange={(e) =>
                      onUpdateSyncConfig({
                        ...syncConfig,
                        browserToTerminal: e.target.checked,
                      })
                    }
                    className="mt-0.5 rounded border-slate-600 text-sky-500 focus:ring-sky-500 focus:ring-offset-0 bg-transparent"
                  />
                  <div>
                    <div className="font-medium">{t('terminal.syncBrowserToTerm')}</div>
                    <div className={`text-[10px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
                      {t('terminal.syncBrowserToTermDesc')}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating Hover Subfolders Menu */}
      {breadcrumbSubmenu && (
        <div
          onMouseEnter={handleSubmenuMouseEnter}
          onMouseLeave={handleSubmenuMouseLeave}
          style={{
            position: 'fixed',
            left: `${Math.max(12, Math.min(window.innerWidth - 240, breadcrumbSubmenu.anchorRect.left - 10))}px`,
            bottom: `${window.innerHeight - breadcrumbSubmenu.anchorRect.top + 6}px`,
          }}
          className={`z-50 w-56 max-h-60 overflow-y-auto rounded-xl border shadow-2xl p-1.5 text-xs select-none backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-150 ${
            isLight
              ? 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-400/40'
              : 'bg-[#222222]/95 border-[#3d3d3d] text-slate-100 shadow-black/80'
          }`}
        >
          <div
            className={`px-2 py-1 mb-1 border-b text-[10px] font-semibold uppercase tracking-wider flex items-center justify-between ${
              isLight ? 'border-slate-200 text-slate-600' : 'border-[#2c2c2c] text-slate-400'
            }`}
          >
            <div className="flex items-center space-x-1 truncate mr-1">
              <Folder className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="truncate">{breadcrumbSubmenu.folderName}</span>
            </div>
            <span className={`text-[9px] lowercase font-normal ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
              {t('terminal.nestedFolders') || 'папки'}
            </span>
          </div>

          {breadcrumbSubmenu.isLoading ? (
            <div className={`py-4 text-center flex items-center justify-center space-x-1.5 text-[11px] ${isLight ? 'text-slate-600' : 'text-slate-400'}`}>
              <RotateCw className="w-3.5 h-3.5 animate-spin text-sky-400" />
              <span>{t('sftp.loading') || 'Загрузка...'}</span>
            </div>
          ) : breadcrumbSubmenu.error ? (
            <div className="p-2 text-center text-rose-400 text-[10px]">
              {breadcrumbSubmenu.error}
            </div>
          ) : breadcrumbSubmenu.subfolders.length === 0 ? (
            <div className={`py-3 text-center text-[11px] italic ${isLight ? 'text-slate-600' : 'text-slate-500'}`}>
              {t('terminal.noSubfolders') || 'Нет вложенных папок'}
            </div>
          ) : (
            <div className="space-y-0.5">
              {breadcrumbSubmenu.subfolders.map((folder) => (
                <button
                  key={folder.path}
                  onClick={() => {
                    setBreadcrumbSubmenu(null);
                    onNavigateBreadcrumb(folder.path);
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg flex items-center space-x-2 transition-colors group ${
                    isLight
                      ? 'hover:bg-sky-500/10 hover:text-sky-800'
                      : 'hover:bg-white/10 hover:text-sky-300'
                  }`}
                  title={`cd ${folder.path}`}
                >
                  <Folder className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 group-hover:scale-105 transition-transform" />
                  <span className="truncate font-mono text-[11px] flex-1">{folder.name}</span>
                  <ChevronRight className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
