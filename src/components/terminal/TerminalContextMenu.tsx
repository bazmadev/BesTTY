import React from 'react';
import { useTranslation } from '../../i18n';
import {
  ClipboardPaste,
  Copy,
  CheckSquare,
  Broom,
  RotateCcw,
  CopyPlus,
  FolderTree,
  Activity,
} from 'lucide-react';

export interface TerminalContextMenuProps {
  x: number;
  y: number;
  isLight?: boolean;
  hasSelection: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onReset: () => void;
  onDuplicate?: () => void;
  onToggleSftp?: () => void;
  onToggleMonitor?: () => void;
  showSftpSidebar?: boolean;
  showMonitorSidebar?: boolean;
  onClose: () => void;
}

export const TerminalContextMenu: React.FC<TerminalContextMenuProps> = ({
  x,
  y,
  isLight = false,
  hasSelection,
  onCopy,
  onPaste,
  onSelectAll,
  onClear,
  onReset,
  onDuplicate,
  onToggleSftp,
  onToggleMonitor,
  showSftpSidebar,
  showMonitorSidebar,
  onClose,
}) => {
  const { t } = useTranslation();

  const topPos = Math.max(8, Math.min(y, window.innerHeight - 290));
  const leftPos = Math.max(8, Math.min(x, window.innerWidth - 220));

  return (
    <div
      className={`fixed z-50 rounded-xl shadow-2xl border py-1.5 text-xs select-none min-w-[190px] animate-in fade-in zoom-in-95 duration-100 ${
        isLight
          ? 'bg-white border-slate-200 text-slate-800 shadow-slate-400/40'
          : 'bg-[#232323] border-[#383838] text-slate-200 shadow-black/80'
      }`}
      style={{ top: topPos, left: leftPos }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Paste Action */}
      <button
        onClick={() => {
          onPaste();
          onClose();
        }}
        className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
          isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-slate-200'
        }`}
      >
        <span className="flex items-center space-x-2">
          <ClipboardPaste className="w-3.5 h-3.5 text-sky-500" />
          <span>{t('terminal.contextPaste') || 'Вставить'}</span>
        </span>
        <span className={`text-[10px] ml-3 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Ctrl+V</span>
      </button>

      {/* Copy Action */}
      <button
        disabled={!hasSelection}
        onClick={() => {
          if (hasSelection) {
            onCopy();
            onClose();
          }
        }}
        className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${
          !hasSelection
            ? 'opacity-40 cursor-not-allowed'
            : isLight
            ? 'hover:bg-slate-100 text-slate-800 cursor-pointer'
            : 'hover:bg-white/10 text-slate-200 cursor-pointer'
        }`}
      >
        <span className="flex items-center space-x-2">
          <Copy className="w-3.5 h-3.5 text-emerald-500" />
          <span>{t('terminal.contextCopy') || 'Копировать'}</span>
        </span>
        <span className={`text-[10px] ml-3 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Ctrl+C</span>
      </button>

      {/* Select All */}
      <button
        onClick={() => {
          onSelectAll();
          onClose();
        }}
        className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
          isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-slate-200'
        }`}
      >
        <span className="flex items-center space-x-2">
          <CheckSquare className="w-3.5 h-3.5 text-indigo-400" />
          <span>{t('terminal.contextSelectAll') || 'Выделить всё'}</span>
        </span>
        <span className={`text-[10px] ml-3 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Ctrl+Shift+A</span>
      </button>

      <div className={`h-px my-1 ${isLight ? 'bg-slate-200' : 'bg-[#353535]'}`} />

      {/* Clear Screen */}
      <button
        onClick={() => {
          onClear();
          onClose();
        }}
        className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
          isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-slate-200'
        }`}
      >
        <span className="flex items-center space-x-2">
          <Broom className="w-3.5 h-3.5 text-amber-500" />
          <span>{t('terminal.contextClear') || 'Очистить экран'}</span>
        </span>
        <span className={`text-[10px] ml-3 ${isLight ? 'text-slate-400' : 'text-slate-500'}`}>Ctrl+L</span>
      </button>

      {/* Reset Terminal */}
      <button
        onClick={() => {
          onReset();
          onClose();
        }}
        className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
          isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-slate-200'
        }`}
      >
        <span className="flex items-center space-x-2">
          <RotateCcw className="w-3.5 h-3.5 text-rose-400" />
          <span>{t('terminal.contextReset') || 'Сбросить терминал'}</span>
        </span>
      </button>

      {(onDuplicate || onToggleSftp || onToggleMonitor) && (
        <div className={`h-px my-1 ${isLight ? 'bg-slate-200' : 'bg-[#353535]'}`} />
      )}

      {/* Duplicate Session */}
      {onDuplicate && (
        <button
          onClick={() => {
            onDuplicate();
            onClose();
          }}
          className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
            isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-slate-200'
          }`}
        >
          <span className="flex items-center space-x-2">
            <CopyPlus className="w-3.5 h-3.5 text-sky-400" />
            <span>{t('terminal.duplicateSession') || 'Дублировать сессию'}</span>
          </span>
        </button>
      )}

      {/* Toggle SFTP Sidebar */}
      {onToggleSftp && (
        <button
          onClick={() => {
            onToggleSftp();
            onClose();
          }}
          className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
            isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-slate-200'
          }`}
        >
          <span className="flex items-center space-x-2">
            <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
            <span>
              {showSftpSidebar
                ? (t('terminal.closeSidebar') || 'Закрыть панель SFTP')
                : (t('terminal.sftpFiles') || 'Файлы SFTP')}
            </span>
          </span>
        </button>
      )}

      {/* Toggle Mini-Monitor */}
      {onToggleMonitor && (
        <button
          onClick={() => {
            onToggleMonitor();
            onClose();
          }}
          className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors cursor-pointer ${
            isLight ? 'hover:bg-slate-100 text-slate-800' : 'hover:bg-white/10 text-slate-200'
          }`}
        >
          <span className="flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-purple-400" />
            <span>
              {showMonitorSidebar
                ? (t('terminal.closeSidebar') || 'Закрыть мониторинг')
                : (t('terminal.miniMonitor') || 'Мини-монитор')}
            </span>
          </span>
        </button>
      )}
    </div>
  );
};
