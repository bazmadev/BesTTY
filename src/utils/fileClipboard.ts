import { FileClipboardState } from '../types';

let currentClipboard: FileClipboardState | null = null;

export const setFileClipboard = (state: FileClipboardState) => {
  currentClipboard = state;
  window.dispatchEvent(new CustomEvent('bestty_clipboard_change', { detail: state }));
};

export const getFileClipboard = (): FileClipboardState | null => {
  return currentClipboard;
};

export const clearFileClipboard = () => {
  currentClipboard = null;
  window.dispatchEvent(new CustomEvent('bestty_clipboard_change', { detail: null }));
};
