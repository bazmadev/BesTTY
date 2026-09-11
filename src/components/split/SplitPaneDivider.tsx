import React from 'react';
import { ArrowLeftRight } from 'lucide-react';

export interface SplitPaneDividerProps {
  dividerIndex: number;
  isLight: boolean;
  onStartResize: (dividerIndex: number, e: React.MouseEvent) => void;
  onResetWidths: () => void;
  onSwapPanes?: (indexA: number, indexB: number) => void;
  tooltipSwap?: string;
  tooltipReset?: string;
}

export const SplitPaneDivider: React.FC<SplitPaneDividerProps> = React.memo(({
  dividerIndex,
  isLight,
  onStartResize,
  onResetWidths,
  onSwapPanes,
  tooltipSwap = 'Swap panes',
  tooltipReset = 'Double-click to reset equal widths',
}) => {
  return (
    <div
      onMouseDown={(e) => onStartResize(dividerIndex, e)}
      onDoubleClick={onResetWidths}
      className={`w-1.5 relative cursor-col-resize shrink-0 group transition-colors select-none ${
        isLight
          ? 'bg-[#d8d8d8] hover:bg-sky-500 active:bg-sky-600'
          : 'bg-[#2b2b2b] hover:bg-sky-500 active:bg-sky-600'
      }`}
      title={tooltipReset}
    >
      {/* Visual grab target expansion */}
      <div className="absolute inset-y-0 -left-1 -right-1 z-30 pointer-events-none" />

      {/* Floating Swap Panes Button (Aligned with pane headers) */}
      {onSwapPanes && (
        <button
          type="button"
          onMouseDown={(e) => {
            // Prevent triggering resize drag on the divider
            e.stopPropagation();
          }}
          onDoubleClick={(e) => {
            // Prevent triggering reset widths
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onSwapPanes(dividerIndex, dividerIndex + 1);
          }}
          className={`absolute top-1 left-1/2 -translate-x-1/2 z-40 w-5.5 h-5.5 rounded-md border flex items-center justify-center cursor-pointer shadow-md transition-all hover:scale-110 active:scale-95 ${
            isLight
              ? 'bg-white text-slate-600 hover:text-sky-600 hover:bg-sky-50 border-slate-300 shadow-slate-300/60'
              : 'bg-[#262626] text-slate-300 hover:text-sky-400 hover:bg-[#323232] border-white/20 shadow-black/70'
          }`}
          title={tooltipSwap}
          aria-label={tooltipSwap}
        >
          <ArrowLeftRight className="w-3 h-3" />
        </button>
      )}
    </div>
  );
});
