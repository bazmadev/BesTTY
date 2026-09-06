import React, { useState, useEffect } from 'react';
import { SFTPFile } from '../types';
import { 
  Folder, File, FileCode, FileText, FileArchive, CornerLeftUp, 
  RotateCw, Plus, Trash2, Edit, Key, Shield, Search, ArrowRight, Download, Upload
} from 'lucide-react';

interface SftpViewProps {
  sessionId: string;
  initialPath?: string;
  onOpenFileInEditor: (filePath: string, fileName: string) => void;
}

export const SftpView: React.FC<SftpViewProps> = ({
  sessionId,
  initialPath = '/',
  onOpenFileInEditor,
}) => {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [inputPath, setInputPath] = useState(initialPath);
  const [files, setFiles] = useState<SFTPFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [renameTarget, setRenameTarget] = useState<SFTPFile | null>(null);
  const [newName, setNewName] = useState('');

  const loadDirectory = async (pathToGo: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await window.api.sftp.list(sessionId, pathToGo);
      setCurrentPath(res.currentPath);
      setInputPath(res.currentPath);
      setFiles(res.files);
    } catch (e: any) {
      setError(e.message || 'Failed to list directory');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDirectory(currentPath);

    // SmarTTY Killer Feature: Listen to OSC 7 directory changes from terminal
    const unsubscribe = window.api?.ssh.onDirectoryChanged((payload) => {
      if (payload.sessionId === sessionId && payload.directory) {
        loadDirectory(payload.directory);
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [sessionId]);

  const handleNavigateUp = () => {
    if (currentPath === '/' || currentPath === '') return;
    const parts = currentPath.split('/').filter(Boolean);
    parts.pop();
    const upPath = '/' + parts.join('/');
    loadDirectory(upPath);
  };

  const handleFileClick = (file: SFTPFile) => {
    if (file.isDirectory) {
      loadDirectory(file.path);
    } else {
      onOpenFileInEditor(file.path, file.name);
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
    } catch (err: any) {
      alert(`Error creating directory: ${err.message}`);
    }
  };

  const handleDelete = async (file: SFTPFile) => {
    if (!confirm(`Are you sure you want to delete "${file.name}"?`)) return;
    try {
      await window.api.sftp.delete(sessionId, file.path, file.isDirectory);
      loadDirectory(currentPath);
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
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
    } catch (err: any) {
      alert(`Rename failed: ${err.message}`);
    }
  };

  const formatSize = (bytes: number) => {
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

  const getFileIcon = (file: SFTPFile) => {
    if (file.isDirectory) return <Folder className="w-4 h-4 text-amber-400 fill-amber-400/20" />;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (['json', 'yaml', 'yml', 'js', 'ts', 'py', 'sh', 'php', 'html', 'css'].includes(ext || '')) {
      return <FileCode className="w-4 h-4 text-sky-400" />;
    }
    if (['tar', 'gz', 'zip', 'xz', 'bz2', '7z'].includes(ext || '')) {
      return <FileArchive className="w-4 h-4 text-rose-400" />;
    }
    return <FileText className="w-4 h-4 text-slate-400" />;
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  // Breadcrumbs
  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] overflow-hidden select-none">
      {/* Navigation and Toolbar */}
      <div className="h-10 bg-[#202020] border-b border-[#2d2d2d] flex items-center justify-between px-3 space-x-2">
        <div className="flex items-center space-x-1">
          <button
            onClick={handleNavigateUp}
            disabled={currentPath === '/'}
            className="p-1.5 rounded hover:bg-white/10 text-slate-300 disabled:opacity-30 transition-colors"
            title="Go to Parent Folder (..)"
          >
            <CornerLeftUp className="w-4 h-4" />
          </button>
          <button
            onClick={() => loadDirectory(currentPath)}
            className="p-1.5 rounded hover:bg-white/10 text-slate-300 transition-colors"
            title="Refresh"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowNewFolder(true)}
            className="p-1.5 rounded hover:bg-white/10 text-slate-300 transition-colors"
            title="Create Folder"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Path Breadcrumbs / Input */}
        <div className="flex-1 flex items-center bg-[#181818] border border-[#333] rounded-md px-2 py-0.5 text-xs font-mono">
          <button
            onClick={() => loadDirectory('/')}
            className="text-sky-400 hover:underline px-1"
          >
            /
          </button>
          {pathParts.map((part, index) => {
            const fullSubPath = '/' + pathParts.slice(0, index + 1).join('/');
            return (
              <React.Fragment key={fullSubPath}>
                <span className="text-slate-600">/</span>
                <button
                  onClick={() => loadDirectory(fullSubPath)}
                  className="text-slate-300 hover:text-white hover:underline px-1 truncate max-w-[120px]"
                >
                  {part}
                </button>
              </React.Fragment>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative w-44">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2 top-2" />
          <input
            type="text"
            placeholder="Filter files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#181818] border border-[#333] rounded px-2 pl-7 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="bg-[#242424] border-b border-[#333] p-3 flex items-center space-x-3">
          <span className="text-xs text-slate-300 font-medium">Folder Name:</span>
          <form onSubmit={handleCreateFolder} className="flex items-center space-x-2 flex-1">
            <input
              type="text"
              autoFocus
              placeholder="new_directory"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              className="bg-[#181818] border border-[#444] rounded px-3 py-1 text-xs text-white font-mono focus:outline-none focus:border-sky-500 flex-1"
            />
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1 rounded"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowNewFolder(false)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Rename Modal */}
      {renameTarget && (
        <div className="bg-[#242424] border-b border-[#333] p-3 flex items-center space-x-3">
          <span className="text-xs text-slate-300 font-medium">Rename "{renameTarget.name}" to:</span>
          <form onSubmit={handleRename} className="flex items-center space-x-2 flex-1">
            <input
              type="text"
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-[#181818] border border-[#444] rounded px-3 py-1 text-xs text-white font-mono focus:outline-none focus:border-sky-500 flex-1"
            />
            <button
              type="submit"
              className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1 rounded"
            >
              Rename
            </button>
            <button
              type="button"
              onClick={() => setRenameTarget(null)}
              className="text-slate-400 hover:text-white text-xs px-2 py-1"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="p-2 bg-red-950/50 border-b border-red-800 text-xs text-red-300 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-white font-bold">✕</button>
        </div>
      )}

      {/* File Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left text-xs font-mono border-collapse">
          <thead className="sticky top-0 bg-[#1d1d1d] border-b border-[#2d2d2d] text-slate-400">
            <tr>
              <th className="py-2 px-3 font-semibold w-8"></th>
              <th className="py-2 px-3 font-semibold">Name</th>
              <th className="py-2 px-3 font-semibold w-24 text-right">Size</th>
              <th className="py-2 px-3 font-semibold w-28 text-center">Permissions</th>
              <th className="py-2 px-3 font-semibold w-40">Modified</th>
              <th className="py-2 px-3 font-semibold w-20 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222222]">
            {filteredFiles.map((file) => (
              <tr
                key={file.path}
                onDoubleClick={() => handleFileClick(file)}
                className="hover:bg-[#232323] cursor-pointer group transition-colors"
              >
                <td className="py-1.5 px-3">{getFileIcon(file)}</td>
                <td className="py-1.5 px-3 font-sans text-slate-200 group-hover:text-white truncate max-w-xs font-medium">
                  {file.name}
                </td>
                <td className="py-1.5 px-3 text-right text-slate-400">
                  {formatSize(file.size)}
                </td>
                <td className="py-1.5 px-3 text-center text-slate-500 font-mono text-[11px]">
                  {file.permissions}
                </td>
                <td className="py-1.5 px-3 text-slate-400 text-[11px]">
                  {file.modifyTime ? new Date(file.modifyTime).toLocaleString() : '-'}
                </td>
                <td className="py-1.5 px-3 text-center">
                  <div className="flex items-center justify-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!file.isDirectory && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFileInEditor(file.path, file.name);
                        }}
                        className="p-1 hover:bg-sky-500/20 text-sky-400 rounded"
                        title="Edit in Monaco"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameTarget(file);
                        setNewName(file.name);
                      }}
                      className="p-1 hover:bg-white/10 text-slate-400 hover:text-white rounded"
                      title="Rename"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(file);
                      }}
                      className="p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded"
                      title="Delete"
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
    </div>
  );
};
