import React, { useState } from 'react';
import { Snippet } from '../types';
import { BookmarkCheck, Play, Plus, Trash2, Edit2, Search, X, Terminal } from 'lucide-react';

interface SnippetsViewProps {
  snippets: Snippet[];
  onRunSnippet: (command: string) => void;
  onSaveSnippet: (snippet: Snippet) => void;
  onDeleteSnippet: (id: string) => void;
  hasActiveSession: boolean;
}

export const SnippetsView: React.FC<SnippetsViewProps> = ({
  snippets,
  onRunSnippet,
  onSaveSnippet,
  onDeleteSnippet,
  hasActiveSession,
}) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [command, setCommand] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [editId, setEditId] = useState<string | null>(null);

  const filtered = snippets.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.command.toLowerCase().includes(q) ||
      (s.category && s.category.toLowerCase().includes(q))
    );
  });

  const handleOpenAdd = () => {
    setEditId(null);
    setName('');
    setCommand('');
    setCategory('General');
    setDescription('');
    setShowModal(true);
  };

  const handleOpenEdit = (s: Snippet) => {
    setEditId(s.id);
    setName(s.name);
    setCommand(s.command);
    setCategory(s.category || 'General');
    setDescription(s.description || '');
    setShowModal(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !command.trim()) return;

    onSaveSnippet({
      id: editId || crypto.randomUUID(),
      name: name.trim(),
      command: command.trim(),
      category: category.trim() || 'General',
      description: description.trim() || undefined,
    });

    setShowModal(false);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#181818] p-6 overflow-y-auto select-none">
      <div className="max-w-4xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white flex items-center space-x-2">
              <BookmarkCheck className="w-6 h-6 text-amber-400" />
              <span>Command Snippets & Scripts</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Store frequently used Linux shell commands and run them in your active terminal with one click.
            </p>
          </div>

          <button
            onClick={handleOpenAdd}
            className="flex items-center space-x-2 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold px-4 py-2 rounded-lg shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Snippet</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search snippets by title, command or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-[#202020] border border-[#333] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Snippets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((snippet) => (
            <div
              key={snippet.id}
              className="bg-[#202020] border border-[#303030] rounded-xl p-4 flex flex-col justify-between shadow-sm"
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <h4 className="text-sm font-semibold text-white">{snippet.name}</h4>
                  <span className="text-[10px] bg-[#181818] text-amber-300 font-medium px-2 py-0.5 rounded border border-[#333]">
                    {snippet.category || 'General'}
                  </span>
                </div>

                {snippet.description && (
                  <p className="text-xs text-slate-400 mb-2">{snippet.description}</p>
                )}

                <div className="bg-[#181818] border border-[#2d2d2d] rounded-md p-2 text-xs font-mono text-emerald-400 mb-3 break-all select-text">
                  $ {snippet.command}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#2a2a2a]">
                <button
                  onClick={() => onRunSnippet(snippet.command)}
                  disabled={!hasActiveSession}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white text-xs font-semibold shadow transition-all"
                  title={hasActiveSession ? 'Execute in active terminal' : 'Connect to a server first'}
                >
                  <Terminal className="w-3.5 h-3.5" />
                  <span>Run in Terminal</span>
                </button>

                <div className="flex items-center space-x-1">
                  <button
                    onClick={() => handleOpenEdit(snippet)}
                    className="p-1.5 rounded hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteSnippet(snippet.id)}
                    className="p-1.5 rounded hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#202020] border border-[#383838] w-full max-w-md rounded-xl shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#303030] pb-3">
                <h3 className="text-sm font-semibold text-white">
                  {editId ? 'Edit Snippet' : 'New Command Snippet'}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Snippet Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Restart Nginx"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="General, Docker, System, Database..."
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Command</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="systemctl restart nginx"
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Description (optional)</label>
                  <input
                    type="text"
                    placeholder="Safely reloads configuration and restarts workers"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full bg-[#272727] border border-[#3d3d3d] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#303030]">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3 py-1.5 rounded text-xs text-slate-300 hover:bg-white/10"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow"
                  >
                    Save Snippet
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
