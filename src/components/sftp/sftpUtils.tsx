import React from 'react';
import { SFTPFile } from '../../types';
import { Folder, FileCode, FileArchive, FileText } from 'lucide-react';

export const formatSize = (bytes: number): string => {
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

export const getFileIcon = (file: SFTPFile | { isDirectory: boolean; name: string }) => {
  if (file.isDirectory) {
    return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20 shrink-0" />;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (['json', 'yaml', 'yml', 'js', 'ts', 'jsx', 'tsx', 'py', 'sh', 'bash', 'php', 'html', 'css', 'go', 'rs', 'c', 'cpp', 'h'].includes(ext)) {
    return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
  }
  if (['tar', 'gz', 'zip', 'xz', 'bz2', '7z', 'rar', 'tgz'].includes(ext)) {
    return <FileArchive className="w-4 h-4 text-rose-400 shrink-0" />;
  }
  return <FileText className="w-4 h-4 text-slate-400 shrink-0" />;
};
