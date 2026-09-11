import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, DownloadCloud, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, X } from 'lucide-react';
import { TransferProgressPayload } from '../types';
import { useTranslation } from '../i18n';

interface TransferProgressDrawerProps {
  isLight?: boolean;
}

export const TransferProgressDrawer: React.FC<TransferProgressDrawerProps> = ({ isLight = false }) => {
  const { t } = useTranslation();
  const [transfer, setTransfer] = useState<TransferProgressPayload | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const dismissTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!window.api?.sftp?.onTransferProgress) return;

    const unsubscribe = window.api.sftp.onTransferProgress((payload: TransferProgressPayload) => {
      setTransfer(payload);

      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
        dismissTimerRef.current = null;
      }

      if (payload.status === 'completed') {
        dismissTimerRef.current = setTimeout(() => {
          setTransfer(null);
        }, 4000);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      if (dismissTimerRef.current) {
        clearTimeout(dismissTimerRef.current);
      }
    };
  }, []);

  if (!transfer) return null;

  const isUpload = transfer.type === 'upload';
  const isCompleted = transfer.status === 'completed';
  const isError = transfer.status === 'error';

  const percent = isCompleted
    ? 100
    : transfer.totalBytes > 0
    ? Math.min(100, Math.round((transfer.bytesTransferred / transfer.totalBytes) * 100))
    : transfer.totalFiles > 0
    ? Math.min(100, Math.round((transfer.fileIndex / transfer.totalFiles) * 100))
    : 0;

  const formatBytes = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSec: number): string => {
    if (!bytesPerSec || bytesPerSec === 0) return '';
    return `${formatBytes(bytesPerSec)}/s`;
  };

  return (
    <div
      className={`fixed bottom-8 right-6 z-50 transition-all duration-300 shadow-2xl rounded-xl border backdrop-blur-md ${
        isMinimized ? 'w-72' : 'w-96'
      } ${
        isLight
          ? 'bg-white/95 border-slate-300 text-slate-800 shadow-slate-400/20'
          : 'bg-[#181818]/95 border-[#333333] text-slate-100 shadow-black/50'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-inherit">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              isCompleted
                ? 'bg-emerald-500/10 text-emerald-500'
                : isError
                ? 'bg-rose-500/10 text-rose-500'
                : isUpload
                ? 'bg-sky-500/10 text-sky-500'
                : 'bg-indigo-500/10 text-indigo-500'
            }`}
          >
            {isCompleted ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : isError ? (
              <AlertCircle className="w-4 h-4" />
            ) : isUpload ? (
              <UploadCloud className="w-4 h-4 animate-pulse" />
            ) : (
              <DownloadCloud className="w-4 h-4 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <span className="text-xs font-semibold block truncate">
              {isCompleted
                ? (t('sftp.transferComplete') || 'Передача завершена')
                : isError
                ? (t('sftp.transferError') || 'Ошибка передачи')
                : isUpload
                ? (t('sftp.uploading') || 'Загрузка на сервер...')
                : (t('sftp.downloading') || 'Скачивание на ПК...')}
            </span>
            <span className={`text-[10px] block truncate ${isLight ? 'text-slate-500' : 'text-slate-400'}`}>
              {transfer.totalFiles > 0
                ? `${transfer.fileIndex} / ${transfer.totalFiles} ${t('sftp.filesCount') || 'файлов'} (${percent}%)`
                : '...'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className={`p-1 rounded hover:bg-slate-500/10 transition-colors ${
              isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
            }`}
            title={isMinimized ? 'Развернуть' : 'Свернуть'}
          >
            {isMinimized ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setTransfer(null)}
            className={`p-1 rounded hover:bg-slate-500/10 transition-colors ${
              isLight ? 'text-slate-500 hover:text-slate-800' : 'text-slate-400 hover:text-slate-200'
            }`}
            title="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body when not minimized */}
      {!isMinimized && (
        <div className="p-4 space-y-3 text-xs">
          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-mono">
              <span className={`truncate max-w-[200px] ${isLight ? 'text-slate-600' : 'text-slate-300'}`}>
                {transfer.currentFile || '...'}
              </span>
              <span className="font-semibold">{percent}%</span>
            </div>
            <div className={`h-2 w-full rounded-full overflow-hidden ${isLight ? 'bg-slate-200' : 'bg-slate-800'}`}>
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  isCompleted
                    ? 'bg-emerald-500'
                    : isError
                    ? 'bg-rose-500'
                    : isUpload
                    ? 'bg-gradient-to-r from-sky-500 to-blue-600'
                    : 'bg-gradient-to-r from-indigo-500 to-violet-600'
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>

          {/* Stats Bar */}
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span>
              {formatBytes(transfer.bytesTransferred)}
              {transfer.totalBytes > 0 ? ` / ${formatBytes(transfer.totalBytes)}` : ''}
            </span>
            {transfer.speedBytesPerSec > 0 && !isCompleted && (
              <span className="text-sky-500 font-semibold">{formatSpeed(transfer.speedBytesPerSec)}</span>
            )}
          </div>

          {/* Error display if any */}
          {transfer.error && (
            <div className="p-2 bg-rose-500/10 border border-rose-500/20 rounded text-[11px] text-rose-400 break-words">
              {transfer.error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
