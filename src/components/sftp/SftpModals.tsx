import React from 'react';
import { useTranslation } from '../../i18n';
import { SFTPFile } from '../../types';

interface NewFolderPromptProps {
  isLight?: boolean;
  folderName: string;
  onChangeFolderName: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const NewFolderPrompt: React.FC<NewFolderPromptProps> = ({
  isLight = false,
  folderName,
  onChangeFolderName,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`border-b p-3 flex items-center space-x-3 select-none ${
        isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#242424] border-[#333]'
      }`}
    >
      <span className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>{t('sftp.folderName')}</span>
      <form onSubmit={onSubmit} className="flex items-center space-x-2 flex-1">
        <input
          type="text"
          autoFocus
          placeholder="new_directory"
          value={folderName}
          onChange={(e) => onChangeFolderName(e.target.value)}
          className={`border rounded px-3 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 flex-1 ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181818] border-[#444] text-white'
          }`}
        />
        <button
          type="submit"
          className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1 rounded shadow font-medium transition-colors"
        >
          {t('sftp.create')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('sftp.cancel')}
        </button>
      </form>
    </div>
  );
};

interface NewFilePromptProps {
  isLight?: boolean;
  fileName: string;
  onChangeFileName: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const NewFilePrompt: React.FC<NewFilePromptProps> = ({
  isLight = false,
  fileName,
  onChangeFileName,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`border-b p-3 flex items-center space-x-3 select-none ${
        isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#242424] border-[#333]'
      }`}
    >
      <span className={`text-xs font-medium ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
        {t('sftp.createFile') || 'Имя файла'}
      </span>
      <form onSubmit={onSubmit} className="flex items-center space-x-2 flex-1">
        <input
          type="text"
          autoFocus
          placeholder="new_file.txt"
          value={fileName}
          onChange={(e) => onChangeFileName(e.target.value)}
          className={`border rounded px-3 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 flex-1 ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181818] border-[#444] text-white'
          }`}
        />
        <button
          type="submit"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs px-3 py-1 rounded shadow font-medium transition-colors"
        >
          {t('sftp.create')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('sftp.cancel')}
        </button>
      </form>
    </div>
  );
};

interface RenamePromptProps {
  isLight?: boolean;
  target: SFTPFile;
  newName: string;
  onChangeNewName: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export const RenamePrompt: React.FC<RenamePromptProps> = ({
  isLight = false,
  target,
  newName,
  onChangeNewName,
  onSubmit,
  onCancel,
}) => {
  const { t } = useTranslation();

  return (
    <div
      className={`border-b p-3 flex items-center space-x-3 select-none ${
        isLight ? 'bg-slate-100 border-slate-300' : 'bg-[#242424] border-[#333]'
      }`}
    >
      <span className={`text-xs font-medium truncate max-w-xs ${isLight ? 'text-slate-700' : 'text-slate-400'}`}>
        {t('sftp.renamePrompt').replace('{name}', target.name)}
      </span>
      <form onSubmit={onSubmit} className="flex items-center space-x-2 flex-1">
        <input
          type="text"
          autoFocus
          value={newName}
          onChange={(e) => onChangeNewName(e.target.value)}
          className={`border rounded px-3 py-1 text-xs font-mono focus:outline-none focus:border-sky-500 flex-1 ${
            isLight ? 'bg-white border-slate-300 text-slate-900' : 'bg-[#181818] border-[#444] text-white'
          }`}
        />
        <button
          type="submit"
          className="bg-sky-600 hover:bg-sky-500 text-white text-xs px-3 py-1 rounded shadow font-medium transition-colors"
        >
          {t('sftp.rename')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            isLight ? 'text-slate-600 hover:text-slate-900 hover:bg-slate-200' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {t('sftp.cancel')}
        </button>
      </form>
    </div>
  );
};
