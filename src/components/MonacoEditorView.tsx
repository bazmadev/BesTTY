import React, { useState, useEffect, useRef } from 'react';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { Save, ShieldAlert, GitCompare, Check, AlertCircle, RefreshCw, X } from 'lucide-react';

interface MonacoEditorViewProps {
  sessionId: string;
  filePath: string;
  fileName: string;
  onClose?: () => void;
  onModifiedChange?: (isModified: boolean) => void;
}

export const MonacoEditorView: React.FC<MonacoEditorViewProps> = ({
  sessionId,
  filePath,
  fileName,
  onClose,
  onModifiedChange,
}) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isDiffMode, setIsDiffMode] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

  // Determine Monaco Language from file extension
  const getLanguage = (name: string): string => {
    const ext = name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'json':
        return 'json';
      case 'yaml':
      case 'yml':
        return 'yaml';
      case 'sh':
      case 'bash':
      case 'zsh':
        return 'shell';
      case 'py':
        return 'python';
      case 'js':
      case 'mjs':
      case 'cjs':
        return 'javascript';
      case 'ts':
        return 'typescript';
      case 'html':
        return 'html';
      case 'css':
        return 'css';
      case 'sql':
        return 'sql';
      case 'md':
        return 'markdown';
      case 'xml':
      case 'svg':
        return 'xml';
      case 'conf':
      case 'cnf':
      case 'ini':
        return 'ini';
      case 'dockerfile':
        return 'dockerfile';
      default:
        if (name.toLowerCase() === 'dockerfile') return 'dockerfile';
        if (name.toLowerCase().includes('nginx')) return 'ini';
        return 'plaintext';
    }
  };

  const loadFile = async () => {
    setIsLoading(true);
    try {
      const data = await window.api.sftp.readFile(sessionId, filePath);
      setContent(data);
      setOriginalContent(data);
      setIsDirty(false);
      onModifiedChange?.(false);
    } catch (e: any) {
      setSaveMessage({ text: `Failed to load file: ${e.message}`, type: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFile();
  }, [sessionId, filePath]);

  const handleEditorChange = (value: string | undefined) => {
    const newVal = value || '';
    setContent(newVal);
    const modified = newVal !== originalContent;
    setIsDirty(modified);
    onModifiedChange?.(modified);
  };

  const handleSave = async (useSudo: boolean = false) => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      if (useSudo) {
        await window.api.sftp.sudoWriteFile(sessionId, filePath, content);
      } else {
        await window.api.sftp.writeFile(sessionId, filePath, content);
      }
      setOriginalContent(content);
      setIsDirty(false);
      onModifiedChange?.(false);
      setSaveMessage({ text: 'Saved successfully!', type: 'success' });
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err: any) {
      setSaveMessage({
        text: `Save error: ${err.message}. If protected, try "Sudo Save".`,
        type: 'error',
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [content, sessionId, filePath]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#1e1e1e] overflow-hidden select-none">
      {/* Editor Header */}
      <div className="h-10 bg-[#252525] border-b border-[#333] flex items-center justify-between px-4 text-xs">
        <div className="flex items-center space-x-2 truncate">
          <span className="font-semibold text-white font-mono">{fileName}</span>
          <span className="text-slate-500 font-mono text-[11px] truncate max-w-sm">
            ({filePath})
          </span>
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-amber-400" title="Unsaved changes" />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {saveMessage && (
            <div
              className={`flex items-center space-x-1 text-xs px-2 py-0.5 rounded ${
                saveMessage.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : 'bg-rose-500/20 text-rose-300'
              }`}
            >
              {saveMessage.type === 'success' ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <AlertCircle className="w-3.5 h-3.5" />
              )}
              <span>{saveMessage.text}</span>
            </div>
          )}

          {/* Toggle Diff Mode */}
          <button
            onClick={() => setIsDiffMode(!isDiffMode)}
            className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs transition-colors ${
              isDiffMode
                ? 'bg-sky-600 text-white'
                : 'bg-[#333] text-slate-300 hover:bg-[#444] hover:text-white'
            }`}
            title="Toggle Diff View"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>Diff</span>
          </button>

          {/* Sudo Save Button */}
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-600/20 border border-amber-500/40 text-amber-300 hover:bg-amber-600 hover:text-white text-xs transition-colors"
            title="Save with elevated sudo privileges (sudo tee)"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Sudo Save</span>
          </button>

          {/* Standard Save Button */}
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving || !isDirty}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-xs shadow-md transition-colors"
            title="Save (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-white/10"
              title="Close File"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 w-full h-full relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin text-sky-400" />
            <span className="text-xs">Loading file from remote server...</span>
          </div>
        ) : isDiffMode ? (
          <DiffEditor
            original={originalContent}
            modified={content}
            language={getLanguage(fileName)}
            theme="vs-dark"
            options={{
              readOnly: false,
              automaticLayout: true,
              fontSize: 14,
              minimap: { enabled: false },
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={getLanguage(fileName)}
            value={content}
            theme="vs-dark"
            onChange={handleEditorChange}
            options={{
              automaticLayout: true,
              fontSize: 14,
              fontFamily: 'Cascadia Code, Consolas, monospace',
              fontLigatures: true,
              tabSize: 2,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              lineNumbers: 'on',
              folding: true,
            }}
          />
        )}
      </div>
    </div>
  );
};
