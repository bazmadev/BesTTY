import React, { useState, useEffect, useRef } from 'react';
import '../utils/monacoSetup';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { Save, ShieldAlert, GitCompare, Check, AlertCircle, RefreshCw, X } from 'lucide-react';
import { useTranslation } from '../i18n';

interface MonacoEditorViewProps {
  sessionId: string;
  filePath: string;
  fileName: string;
  isLight?: boolean;
  onClose?: () => void;
  onModifiedChange?: (isModified: boolean) => void;
}

export const MonacoEditorView: React.FC<MonacoEditorViewProps> = ({
  sessionId,
  filePath,
  fileName,
  isLight = false,
  onClose,
  onModifiedChange,
}) => {
  const { t } = useTranslation();
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [isDiffMode, setIsDiffMode] = useState<boolean>(false);
  const [isDirty, setIsDirty] = useState<boolean>(false);

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

  const editorRef = useRef<any>(null);

  const handleSave = async (useSudo: boolean = false) => {
    // Read the most up-to-date value from the editor instance if available
    const activeVal = editorRef.current?.getValue?.() ?? content;
    setIsSaving(true);
    setSaveMessage(null);
    try {
      if (useSudo) {
        await window.api.sftp.sudoWriteFile(sessionId, filePath, activeVal);
      } else {
        await window.api.sftp.writeFile(sessionId, filePath, activeVal);
      }
      setOriginalContent(activeVal);
      setContent(activeVal);
      setIsDirty(false);
      onModifiedChange?.(false);
      setSaveMessage({ text: t('editor.savedSuccess'), type: 'success' });
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

  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;

  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    editor.addAction({
      id: 'bestty-save-file',
      label: 'Save File',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
      run: () => {
        handleSaveRef.current(false);
      },
    });
  };

  const handleDiffEditorDidMount = (editor: any, monaco: any) => {
    const modifiedEditor = editor.getModifiedEditor?.();
    if (modifiedEditor) {
      modifiedEditor.addAction({
        id: 'bestty-save-diff-file',
        label: 'Save File',
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        run: () => {
          handleSaveRef.current(false);
        },
      });
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveRef.current(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden select-none ${
      isLight ? 'bg-white text-slate-800' : 'bg-[#1e1e1e] text-slate-100'
    }`}>
      {/* Editor Header */}
      <div className={`h-10 border-b flex items-center justify-between px-4 text-xs ${
        isLight ? 'bg-[#f4f4f4] border-[#e0e0e0]' : 'bg-[#252525] border-[#333]'
      }`}>
        <div className="flex items-center space-x-2 truncate">
          <span className="font-semibold font-mono">{fileName}</span>
          <span className="text-slate-400 font-mono text-[11px] truncate max-w-sm">
            ({filePath})
          </span>
          {isDirty && (
            <span className="w-2 h-2 rounded-full bg-amber-500" title={t('editor.unsaved')} />
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          {saveMessage && (
            <div
              className={`flex items-center space-x-1 text-xs px-2 py-0.5 rounded ${
                saveMessage.type === 'success'
                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300'
                  : 'bg-rose-500/20 text-rose-600 dark:text-rose-300'
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
                : isLight ? 'bg-slate-200 text-slate-700 hover:bg-slate-300' : 'bg-[#333] text-slate-300 hover:bg-[#444] hover:text-white'
            }`}
            title="Toggle Diff View"
          >
            <GitCompare className="w-3.5 h-3.5" />
            <span>{t('editor.diff')}</span>
          </button>

          {/* Sudo Save Button */}
          <button
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-500/15 border border-amber-500/40 text-amber-600 dark:text-amber-300 hover:bg-amber-600 hover:text-white text-xs transition-colors"
            title={t('editor.saveElevatedTip')}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>{t('editor.sudoSave')}</span>
          </button>

          {/* Standard Save Button */}
          <button
            onClick={() => handleSave(false)}
            disabled={isSaving || !isDirty}
            className="flex items-center space-x-1.5 px-3 py-1 rounded bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-xs shadow transition-colors"
            title="Save (Ctrl+S)"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? t('editor.saving') : t('editor.save')}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-500/10"
              title={t('editor.closeFile')}
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
            <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
            <span className="text-xs">{t('editor.loading')}</span>
          </div>
        ) : saveMessage?.type === 'error' && !content ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-3 p-6 text-center">
            <AlertCircle className="w-10 h-10 text-rose-500" />
            <div className="text-xs font-semibold text-rose-400 max-w-md">{saveMessage.text}</div>
            <button
              onClick={loadFile}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded text-xs font-semibold flex items-center space-x-1.5 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{t('sftp.refresh')}</span>
            </button>
          </div>
        ) : isDiffMode ? (
          <DiffEditor
            original={originalContent}
            modified={content}
            language={getLanguage(fileName)}
            theme={isLight ? 'vs' : 'vs-dark'}
            onMount={handleDiffEditorDidMount}
            loading={
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                <span className="text-xs">{t('editor.loading')}</span>
              </div>
            }
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
            theme={isLight ? 'vs' : 'vs-dark'}
            onMount={handleEditorDidMount}
            onChange={handleEditorChange}
            loading={
              <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin text-sky-500" />
                <span className="text-xs">{t('editor.loading')}</span>
              </div>
            }
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
