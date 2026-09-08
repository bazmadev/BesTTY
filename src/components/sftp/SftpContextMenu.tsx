import React from 'react';
import { useTranslation } from '../../i18n';
import { SFTPFile, FileClipboardState } from '../../types';
import {
  Edit,
  Terminal as TerminalIcon,
  Copy,
  Scissors,
  ClipboardPaste,
  Edit3,
  Trash2,
  FolderPlus,
  FilePlus,
  RotateCw,
} from 'lucide-react';

export interface ContextMenuState {
  x: number;
  y: number;
  file: SFTPFile | null;
}

interface SftpContextMenuProps {
  isLight?: boolean;
  menu: ContextMenuState;
  clipboard: FileClipboardState | null;
  onClose: () => void;
  onOpenFileInEditor?: (path: string, name: string) => void;
  onNavigateToTerminal?: (path: string) => void;
  onCopyFile?: (file: SFTPFile) => void;
  onCutFile?: (file: SFTPFile) => void;
  onPaste?: (targetFolder: string) => void;
  onStartRename?: (file: SFTPFile) => void;
  onDeleteFile?: (file: SFTPFile) => void;
  onNewFolder?: () => void;
  onNewFile?: () => void;
  onRefresh?: () => void;
  currentPath: string;
}

export const SftpContextMenu: React.FC<SftpContextMenuProps> = ({
  isLight = false,
  menu,
  clipboard,
  onClose,
  onOpenFileInEditor,
  onNavigateToTerminal,
  onCopyFile,
  onCutFile,
  onPaste,
  onStartRename,
  onDeleteFile,
  onNewFolder,
  onNewFile,
  onRefresh,
  currentPath,
}) => {
  const { t } = useTranslation();

  const file = menu.file;
  const topPos = Math.min(menu.y, window.innerHeight - 280);
  const leftPos = Math.min(menu.x, window.innerWidth - 200);

  return (
    <div
      className={`fixed z-50 rounded-xl shadow-2xl border py-1.5 text-xs select-none min-w-[170px] animate-in fade-in zoom-in-95 ${
        isLight
          ? 'bg-white border-slate-200 text-slate-800 shadow-slate-400/40'
          : 'bg-[#232323] border-[#383838] text-slate-200 shadow-black/80'
      }`}
      style={{ top: topPos, left: leftPos }}
      onClick={(e) => e.stopPropagation()}
    >
      {file ? (
        <>
          {/* File specific actions */}
          {!file.isDirectory && onOpenFileInEditor && (
            <button
              onClick={() => {
                onOpenFileInEditor(file.path, file.name);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 transition-colors"
            >
              <Edit className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('sftp.editInMonaco')}</span>
            </button>
          )}

          {file.isDirectory && onNavigateToTerminal && (
            <button
              onClick={() => {
                onNavigateToTerminal(file.path);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 transition-colors"
            >
              <TerminalIcon className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('sftp.openInTerminal')}</span>
            </button>
          )}

          {onCopyFile && (
            <button
              onClick={() => {
                onCopyFile(file);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 transition-colors"
            >
              <Copy className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('sftp.copy')}</span>
            </button>
          )}

          {onCutFile && (
            <button
              onClick={() => {
                onCutFile(file);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 transition-colors"
            >
              <Scissors className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('sftp.cut')}</span>
            </button>
          )}

          {onStartRename && (
            <button
              onClick={() => {
                onStartRename(file);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-amber-500/15 hover:text-amber-400 flex items-center space-x-2 transition-colors"
            >
              <Edit3 className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('sftp.rename')}</span>
            </button>
          )}

          {onDeleteFile && (
            <button
              onClick={() => {
                onDeleteFile(file);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-rose-500/15 hover:text-rose-400 flex items-center space-x-2 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>{t('sftp.delete')}</span>
            </button>
          )}
        </>
      ) : (
        <>
          {/* Empty Space actions */}
          {onNewFolder && (
            <button
              onClick={() => {
                onNewFolder();
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('sftp.createFolder')}</span>
            </button>
          )}

          {onNewFile && (
            <button
              onClick={() => {
                onNewFile();
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-emerald-500/15 hover:text-emerald-400 flex items-center space-x-2 transition-colors"
            >
              <FilePlus className="w-3.5 h-3.5 text-emerald-400" />
              <span>{t('sftp.createFile') || 'Создать файл'}</span>
            </button>
          )}

          {clipboard && onPaste && (
            <button
              onClick={() => {
                onPaste(currentPath);
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 transition-colors"
            >
              <ClipboardPaste className="w-3.5 h-3.5 text-sky-400" />
              <span>
                {t('sftp.paste')}{' '}
                <span className="opacity-60 text-[10px]">
                  ({clipboard.files.length})
                </span>
              </span>
            </button>
          )}

          {onRefresh && (
            <button
              onClick={() => {
                onRefresh();
                onClose();
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 transition-colors border-t border-slate-500/20 mt-1 pt-1"
            >
              <RotateCw className="w-3.5 h-3.5 text-slate-400" />
              <span>{t('sftp.refresh')}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
};
