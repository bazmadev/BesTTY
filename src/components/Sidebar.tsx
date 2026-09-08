import React, { useState, useEffect, useRef } from 'react';
import { 
  Server, FolderTree, Code, Activity, Network, Terminal, Settings, 
  Lock, Unlock, Info, ArrowUp, ArrowDown, RotateCcw, Plus, X, ArrowRight, HardDrive, Heart
} from 'lucide-react';
import { TabItem, TabType, VaultStatus } from '../types';
import { useTranslation } from '../i18n';

type SidebarNavId = 'hosts' | TabType;

interface SidebarProps {
  currentView: 'hosts' | TabType;
  isLight?: boolean;
  onSelectView: (view: 'hosts' | TabType) => void;
  vaultStatus: VaultStatus;
  onToggleVault: () => void;
  onOpenAbout?: (tab?: 'mission' | 'updates' | 'donate') => void;
  connectedSessionCount?: number;
  tabs?: TabItem[];
  activeTabId?: string;
  onSelectTab?: (tabId: string) => void;
  onCloseTab?: (tabId: string) => void;
  onNewConnection?: (type: TabType) => void;
}

// Default order: editor comes after monitor
const DEFAULT_NAV_ORDER: SidebarNavId[] = [
  'hosts',
  'terminal',
  'sftp',
  'local',
  'monitor',
  'editor',
  'tunnels',
  'settings',
];

const STORAGE_KEY_ORDER = 'bestty_sidebar_nav_order';

const loadSavedNavOrder = (): SidebarNavId[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ORDER);
    if (raw) {
      const parsed = JSON.parse(raw) as SidebarNavId[];
      const valid = parsed.filter((id) => DEFAULT_NAV_ORDER.includes(id));
      for (const defId of DEFAULT_NAV_ORDER) {
        if (!valid.includes(defId)) valid.push(defId);
      }
      return valid;
    }
  } catch (e) {}
  return DEFAULT_NAV_ORDER;
};

export const Sidebar: React.FC<SidebarProps> = React.memo(({
  currentView,
  isLight = false,
  onSelectView,
  vaultStatus,
  onToggleVault,
  onOpenAbout,
  connectedSessionCount,
  tabs = [],
  activeTabId = '',
  onSelectTab,
  onCloseTab,
  onNewConnection,
}) => {
  const { t } = useTranslation();

  const [navOrder, setNavOrder] = useState<SidebarNavId[]>(loadSavedNavOrder);
  const [draggedId, setDraggedId] = useState<SidebarNavId | null>(null);
  const [dragOverId, setDragOverId] = useState<SidebarNavId | null>(null);
  const [contextMenu, setContextMenu] = useState<{ id: SidebarNavId; x: number; y: number } | null>(null);

  // Hover Popover Flyout State with grace timers
  const [hoveredNavId, setHoveredNavId] = useState<SidebarNavId | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const leaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleItemMouseEnter = (id: SidebarNavId) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredNavId(id);
    }, 140);
  };

  const handleItemMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    leaveTimeoutRef.current = setTimeout(() => {
      setHoveredNavId(null);
    }, 240);
  };

  const handlePopoverMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  const handlePopoverMouseLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      setHoveredNavId(null);
    }, 220);
  };

  // Close context menu on window click
  useEffect(() => {
    const handleWindowClick = () => setContextMenu(null);
    window.addEventListener('click', handleWindowClick);
    return () => window.removeEventListener('click', handleWindowClick);
  }, []);

  const saveOrder = (newOrder: SidebarNavId[]) => {
    setNavOrder(newOrder);
    try {
      localStorage.setItem(STORAGE_KEY_ORDER, JSON.stringify(newOrder));
    } catch (e) {}
  };

  const handleDragStart = (e: React.DragEvent, id: SidebarNavId) => {
    setHoveredNavId(null);
    setDraggedId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, id: SidebarNavId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: SidebarNavId) => {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    const current = [...navOrder];
    const fromIndex = current.indexOf(draggedId);
    const toIndex = current.indexOf(targetId);
    if (fromIndex !== -1 && toIndex !== -1) {
      current.splice(fromIndex, 1);
      current.splice(toIndex, 0, draggedId);
      saveOrder(current);
    }
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  const handleMove = (id: SidebarNavId, direction: 'up' | 'down') => {
    const current = [...navOrder];
    const index = current.indexOf(id);
    if (direction === 'up' && index > 0) {
      const temp = current[index - 1];
      current[index - 1] = current[index];
      current[index] = temp;
      saveOrder(current);
    } else if (direction === 'down' && index < current.length - 1) {
      const temp = current[index + 1];
      current[index + 1] = current[index];
      current[index] = temp;
      saveOrder(current);
    }
    setContextMenu(null);
  };

  const handleResetOrder = () => {
    saveOrder(DEFAULT_NAV_ORDER);
    setContextMenu(null);
  };

  const getNavTabs = (id: SidebarNavId): TabItem[] => {
    if (!tabs || id === 'hosts' || id === 'tunnels' || id === 'settings') return [];
    return tabs.filter((t) => t.type === id);
  };

  // Nav Item metadata dictionary
  const navDefinitions: Record<SidebarNavId, { label: string; icon: React.ReactNode; badge?: number }> = {
    hosts: { label: t('nav.hosts'), icon: <Server className="w-5 h-5" /> },
    terminal: { label: t('nav.terminal'), icon: <Terminal className="w-5 h-5" />, badge: getNavTabs('terminal').length },
    sftp: { label: t('nav.sftp'), icon: <FolderTree className="w-5 h-5" />, badge: getNavTabs('sftp').length },
    local: { label: t('nav.local') || 'Локальные файлы', icon: <HardDrive className="w-5 h-5 text-emerald-400" /> },
    monitor: { label: t('nav.monitor'), icon: <Activity className="w-5 h-5" />, badge: getNavTabs('monitor').length },
    editor: { label: t('nav.editor'), icon: <Code className="w-5 h-5" />, badge: getNavTabs('editor').length },
    tunnels: { label: t('nav.tunnels'), icon: <Network className="w-5 h-5" /> },
    settings: { label: t('nav.settings'), icon: <Settings className="w-5 h-5" /> },
  };

  return (
    <div className={`w-14 border-r flex flex-col items-center py-3 justify-between select-none z-40 transition-colors relative ${
      isLight ? 'bg-[#eaeaea] border-[#dcdcdc]' : 'bg-[#181818] border-[#2d2d2d]'
    }`}>
      {/* Navigation Buttons */}
      <div className="flex flex-col items-center space-y-2 w-full">
        {navOrder.map((id) => {
          const item = navDefinitions[id];
          if (!item) return null;
          const isActive = currentView === id;
          const isOver = dragOverId === id;
          const isDragging = draggedId === id;
          const typeTabs = getNavTabs(id);
          const hasTabs = typeTabs.length > 0;
          const isFlyoutOpen = hoveredNavId === id && !isDragging && hasTabs;

          return (
            <div
              key={id}
              draggable
              onDragStart={(e) => handleDragStart(e, id)}
              onDragOver={(e) => handleDragOver(e, id)}
              onDrop={(e) => handleDrop(e, id)}
              onDragEnd={handleDragEnd}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ id, x: e.clientX, y: e.clientY });
              }}
              onMouseEnter={() => handleItemMouseEnter(id)}
              onMouseLeave={handleItemMouseLeave}
              className="relative w-full flex justify-center cursor-grab active:cursor-grabbing"
            >
              {/* Drop target indicator */}
              {isOver && !isDragging && (
                <div className="absolute -top-1 left-2 right-2 h-0.5 bg-sky-500 rounded-full z-50 animate-pulse shadow-sm" />
              )}

              <button
                onClick={() => {
                  setHoveredNavId(null);
                  onSelectView(id);
                }}
                className={`relative group w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  isDragging ? 'opacity-40' : ''
                } ${
                  isActive
                    ? isLight
                      ? 'bg-sky-500/20 text-sky-700 border border-sky-400/50 shadow-sm'
                      : 'bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-lg'
                    : isLight
                      ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-300/60'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-[#262626]'
                }`}
                title={!hasTabs ? item.label : undefined}
              >
                {item.icon}

                {/* Indicator bar for active item */}
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-0.5 bg-sky-500 rounded-r" />
                )}

                {/* Badge for active sessions (shown when 2 or more) */}
                {item.badge !== undefined && item.badge >= 2 && (
                  <span className={`absolute -top-1 -right-1 min-w-[17px] h-[17px] px-1 bg-sky-500 text-white font-mono text-[9px] font-bold rounded-full flex items-center justify-center shadow-md ring-2 ${
                    isLight ? 'ring-[#eaeaea]' : 'ring-[#181818]'
                  }`}>
                    {item.badge}
                  </span>
                )}

                {/* Simple tooltip on hover (only when no flyout menu) */}
                {!hasTabs && (
                  <span className={`absolute left-14 text-xs px-2.5 py-1.5 rounded-md shadow-xl border whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 ${
                    isLight ? 'bg-white text-slate-800 border-slate-200 shadow-md' : 'bg-[#2b2b2b] text-slate-100 border-white/10'
                  }`}>
                    {item.label}
                  </span>
                )}
              </button>

              {/* Hover Popover Flyout for Multi-Session Navigation */}
              {isFlyoutOpen && (
                <div
                  onMouseEnter={handlePopoverMouseEnter}
                  onMouseLeave={handlePopoverMouseLeave}
                  className={`absolute left-[52px] -top-1 w-72 rounded-2xl shadow-2xl border z-50 py-2.5 px-2 flex flex-col text-xs select-none animate-in fade-in zoom-in-95 duration-150 ${
                    isLight
                      ? 'bg-white/95 backdrop-blur-md border-slate-200 text-slate-800 shadow-slate-300/60'
                      : 'bg-[#212121]/95 backdrop-blur-md border-[#383838] text-slate-100 shadow-black/80'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Flyout Header */}
                  <div className="flex items-center justify-between px-2 pb-2 border-b border-slate-500/15">
                    <div className="flex items-center space-x-2 truncate">
                      <span className="text-sky-400">{item.icon}</span>
                      <span className="font-semibold text-xs">{item.label}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400 text-[10px] font-mono font-bold">
                        {typeTabs.length}
                      </span>
                    </div>
                    {(id === 'terminal' || id === 'sftp' || id === 'monitor') && onNewConnection && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredNavId(null);
                          onNewConnection(id as TabType);
                        }}
                        className={`p-1 rounded-md transition-colors ${
                          isLight ? 'text-slate-600 hover:text-sky-600 hover:bg-sky-50' : 'text-slate-400 hover:text-sky-400 hover:bg-sky-500/10'
                        }`}
                        title={t('sidebar.newConnection')}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Open Tabs List */}
                  <div className="py-1.5 max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                    {typeTabs.map((tab) => {
                      const isTabActive = currentView === id && tab.id === activeTabId;
                      return (
                        <div
                          key={tab.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTab?.(tab.id);
                            setHoveredNavId(null);
                          }}
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${
                            isTabActive
                              ? isLight
                                ? 'bg-sky-50 text-sky-800 border border-sky-200 font-medium'
                                : 'bg-sky-500/15 text-sky-300 border border-sky-500/30 font-medium'
                              : isLight
                                ? 'hover:bg-slate-100 text-slate-700'
                                : 'hover:bg-[#2e2e2e] text-slate-300 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2 truncate flex-1 mr-2">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                isTabActive ? 'bg-sky-500 ring-2 ring-sky-500/30' : 'bg-transparent'
                              }`}
                            />
                            <span className="truncate text-[11px] font-mono" title={tab.filePath || tab.title}>
                              {tab.title}
                            </span>
                            {tab.isModified && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved" />
                            )}
                          </div>

                          {/* Quick Close Button */}
                          {onCloseTab && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCloseTab(tab.id);
                                if (typeTabs.length <= 1) {
                                  setHoveredNavId(null);
                                }
                              }}
                              className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all shrink-0 ${
                                isLight ? 'text-slate-600 hover:text-rose-600 hover:bg-rose-50' : 'hover:bg-rose-500/20 text-slate-400 hover:text-rose-400'
                              }`}
                              title={t('sidebar.closeTab')}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Flyout Footer Action */}
                  <div className="pt-1.5 border-t border-slate-500/15">
                    {id === 'editor' ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectView('editor');
                          setHoveredNavId(null);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 transition-colors"
                      >
                        <span className="flex items-center space-x-1.5">
                          <Code className="w-3.5 h-3.5" />
                          <span>{t('sidebar.openSnippets')}</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : onNewConnection ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setHoveredNavId(null);
                          onNewConnection(id as TabType);
                        }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium rounded-lg text-sky-400 hover:bg-sky-500/10 hover:text-sky-300 transition-colors"
                      >
                        <span className="flex items-center space-x-1.5">
                          <Plus className="w-3.5 h-3.5" />
                          <span>{t('sidebar.newConnection')}</span>
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Context Menu for Tab Ordering */}
      {contextMenu && (
        <div
          className={`fixed z-50 border rounded-lg shadow-2xl py-1 text-xs select-none min-w-[180px] ${
            isLight ? 'bg-white border-slate-300 text-slate-800' : 'bg-[#252525] border-[#3d3d3d] text-slate-200'
          }`}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            disabled={navOrder.indexOf(contextMenu.id) === 0}
            onClick={() => handleMove(contextMenu.id, 'up')}
            className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowUp className="w-3.5 h-3.5" />
            <span>{t('sidebar.moveUp')}</span>
          </button>
          <button
            disabled={navOrder.indexOf(contextMenu.id) === navOrder.length - 1}
            onClick={() => handleMove(contextMenu.id, 'down')}
            className="w-full text-left px-3 py-1.5 hover:bg-sky-500/15 hover:text-sky-400 flex items-center space-x-2 disabled:opacity-30 disabled:pointer-events-none"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>{t('sidebar.moveDown')}</span>
          </button>
          <div className="h-px bg-slate-500/20 my-1" />
          <button
            onClick={handleResetOrder}
            className={`w-full text-left px-3 py-1.5 flex items-center space-x-2 transition-colors ${
              isLight ? 'hover:bg-rose-50 text-slate-600 hover:text-rose-600' : 'hover:bg-rose-500/15 text-slate-400 hover:text-rose-400'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('sidebar.resetOrder')}</span>
          </button>
        </div>
      )}

      {/* Bottom Area: Vault Status & About */}
      <div className="flex flex-col items-center space-y-2 w-full">
        {/* Vault Status Indicator & Lock Button */}
        <button
          onClick={onToggleVault}
          className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            vaultStatus.isUnlocked
              ? 'text-emerald-500 hover:bg-emerald-500/10'
              : 'text-amber-500 hover:bg-amber-500/10'
          }`}
          title={vaultStatus.isUnlocked ? t('nav.vaultUnlocked') : t('nav.vaultLocked')}
        >
          {vaultStatus.isUnlocked ? (
            <Unlock className="w-5 h-5" />
          ) : (
            <Lock className="w-5 h-5" />
          )}

          <span className={`absolute left-14 text-xs px-2.5 py-1.5 rounded-md shadow-xl border whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 ${
            isLight ? 'bg-white text-slate-800 border-slate-200 shadow-md' : 'bg-[#2b2b2b] text-slate-100 border-white/10'
          }`}>
            {vaultStatus.isUnlocked ? t('nav.vaultUnlocked') : t('nav.vaultLocked')}
          </span>
        </button>

        {/* Support / Donate Heart Button */}
        {onOpenAbout && (
          <button
            onClick={() => onOpenAbout('donate')}
            className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              isLight
                ? 'text-rose-500 hover:text-rose-600 hover:bg-rose-50'
                : 'text-rose-400 hover:text-rose-300 hover:bg-rose-500/10'
            }`}
            title={t('about.tabDonate')}
          >
            <Heart className="w-5 h-5 fill-rose-500/20" />

            <span className={`absolute left-14 text-xs px-2.5 py-1.5 rounded-md shadow-xl border whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 ${
              isLight ? 'bg-white text-slate-800 border-slate-200 shadow-md' : 'bg-[#2b2b2b] text-slate-100 border-white/10'
            }`}>
              {t('about.tabDonate')}
            </span>
          </button>
        )}

        {/* About BesTTY Button */}
        {onOpenAbout && (
          <button
            onClick={() => onOpenAbout('mission')}
            className={`group relative w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
              isLight
                ? 'text-slate-600 hover:text-sky-600 hover:bg-slate-300/60'
                : 'text-slate-400 hover:text-sky-400 hover:bg-[#262626]'
            }`}
            title={t('about.title')}
          >
            <Info className="w-5 h-5" />

            <span className={`absolute left-14 text-xs px-2.5 py-1.5 rounded-md shadow-xl border whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity z-50 ${
              isLight ? 'bg-white text-slate-800 border-slate-200 shadow-md' : 'bg-[#2b2b2b] text-slate-100 border-white/10'
            }`}>
              {t('about.title')}
            </span>
          </button>
        )}
      </div>
    </div>
  );
});
