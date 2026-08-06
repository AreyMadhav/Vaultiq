import { useState } from 'react';
import { Download, Eye, Pencil, Trash2, Check, X } from 'lucide-react';
import type { FileItem } from '../types';
import { getIcon, getIconColor } from '../icons';
import { formatBytes, formatDate, joinPath } from '../utils';
import { api } from '../api';

export function FileRow({
  item,
  root,
  currentPath,
  selected,
  onToggleSelect,
  onOpen,
  onPreview,
  onRename,
  onDeleteOne,
}: {
  item: FileItem;
  root: string;
  currentPath: string;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onPreview: () => void;
  onRename: (newName: string) => void;
  onDeleteOne: () => void;
}) {
  const Icon = getIcon(item);
  const iconColor = getIconColor(item);
  const fullPath = joinPath(currentPath, item.name);
  const displayName = (item as any).originalName || item.name;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(item.name);
  const [confirmDel, setConfirmDel] = useState(false);

  function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim() && name !== item.name) onRename(name.trim());
    setRenaming(false);
  }

  return (
    <div
      className={`group flex flex-col sm:flex-row sm:items-center gap-3 px-3 py-3 rounded-xl border transition cursor-default min-w-0 ${
        selected
          ? 'bg-sky-500/10 border-sky-500/30'
          : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/60 hover:border-slate-700'
      }`}
    >
      {/* checkbox */}
      <button
        onClick={onToggleSelect}
        className={`w-5 h-5 rounded-md border flex items-center justify-center transition shrink-0 ${
          selected
            ? 'bg-sky-500 border-sky-500'
            : 'border-slate-600 hover:border-slate-400'
        }`}
        aria-label="Select"
      >
        {selected && <Check className="w-3.5 h-3.5 text-white" />}
      </button>

      {/* icon + name */}
      <div className="flex items-center gap-3 min-w-0 flex-1 w-full">
        <Icon className={`w-5 h-5 shrink-0 ${iconColor}`} />
        {renaming ? (
          <form onSubmit={submitRename} className="flex items-center gap-1 min-w-0 flex-1 w-full">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setRenaming(false);
                  setName(item.name);
                }
              }}
              className="bg-slate-800 border border-sky-500 rounded-lg px-2 py-1 text-sm text-white focus:outline-none min-w-0 w-full max-w-full sm:max-w-[260px]"
            />
          </form>
        ) : (
            <button
            onClick={onOpen}
            onDoubleClick={onOpen}
            className="text-sm text-slate-200 hover:text-white truncate text-left min-w-0 flex-1 max-w-full sm:max-w-[400px]"
            title={displayName}
          >
            {displayName}
          </button>
        )}
      </div>

      {/* meta */}
      <div className="flex sm:hidden items-center gap-4 text-[11px] text-slate-500 shrink-0 w-full pl-8">
        <span className="tabular-nums">
          {item.isDir ? '—' : formatBytes(item.size)}
        </span>
        <span className="truncate">{formatDate(item.mtime)}</span>
      </div>
      <div className="hidden md:flex items-center gap-6 text-xs text-slate-500 shrink-0">
        <span className="w-20 text-right tabular-nums">
          {item.isDir ? '—' : formatBytes(item.size)}
        </span>
        <span className="w-28 text-right">{formatDate(item.mtime)}</span>
      </div>

      {/* actions */}
      <div className="flex items-center gap-1 shrink-0 flex-wrap sm:flex-nowrap w-full sm:w-auto justify-end sm:justify-start pl-8 sm:pl-0">
        {confirmDel ? (
          <>
            <button
              onClick={onDeleteOne}
              className="px-3 py-2 rounded-md bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-xs font-medium touch-manipulation"
            >
              Confirm
            </button>
            <button
              onClick={() => setConfirmDel(false)}
              className="p-2 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 touch-manipulation"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            {!item.isDir && item.isImage && (
              <button
                onClick={onPreview}
                title="Preview"
                className="p-2 rounded-md text-slate-400 hover:text-emerald-300 hover:bg-slate-700/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition touch-manipulation"
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            {!item.isDir && (
              <a
                href={api.downloadUrl(root, fullPath)}
                download={displayName}
                title="Download"
                className="p-2 rounded-md text-slate-400 hover:text-sky-300 hover:bg-slate-700/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition touch-manipulation"
              >
                <Download className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={() => setRenaming(true)}
              title="Rename"
              className="p-2 rounded-md text-slate-400 hover:text-amber-300 hover:bg-slate-700/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition touch-manipulation"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setConfirmDel(true)}
              title="Delete"
              className="p-2 rounded-md text-slate-400 hover:text-rose-300 hover:bg-slate-700/60 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition touch-manipulation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
