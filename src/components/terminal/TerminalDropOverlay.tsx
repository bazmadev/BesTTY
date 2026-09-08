import React from 'react';
import { Upload } from 'lucide-react';

interface TerminalDropOverlayProps {
  isDragOver: boolean;
  currentDirectory: string;
  defaultPath?: string;
  titleText: string;
  hintText: string;
}

export const TerminalDropOverlay: React.FC<TerminalDropOverlayProps> = React.memo(({
  isDragOver,
  currentDirectory,
  defaultPath,
  titleText,
  hintText,
}) => {
  if (!isDragOver) return null;

  return (
    <div className="absolute inset-0 z-50 bg-sky-950/80 backdrop-blur-sm border-2 border-dashed border-sky-400 rounded-lg flex flex-col items-center justify-center p-6 text-white select-none pointer-events-none animate-in fade-in duration-150">
      <div className="w-14 h-14 rounded-2xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center mb-3 shadow-lg shadow-sky-500/20">
        <Upload className="w-7 h-7 text-sky-400 animate-bounce" />
      </div>
      <div className="font-semibold text-base mb-1">
        {titleText}
      </div>
      <div className="text-xs text-sky-200 font-mono bg-black/40 px-3 py-1 rounded-md border border-sky-500/30 max-w-md truncate">
        {currentDirectory || defaultPath || '~'}
      </div>
      <div className="text-[11px] text-slate-300 mt-2">
        {hintText}
      </div>
    </div>
  );
});
