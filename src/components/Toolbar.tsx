import { useRef, useState } from 'react';
import {
  Upload,
  FolderPlus,
  Download,
  Trash2,
  LogOut,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { api } from '../api';

export function Toolbar({
  currentPath,
  selected,
  onRefresh,
  onMkdir,
  onUpload,
  onZip,
  onDelete,
  onLogout,
  loading,
}: {
  currentPath: string;
  selected: string[];
  onRefresh: () => void;
  onMkdir: (name: string) => void;
  onUpload: (files: File[]) => void;
  onZip: () => void;
  onDelete: () => void;
  onLogout: () => void;
  loading: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState('');

  function handleUploadClick() {
    fileInput.current?.click();
  }

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length) onUpload(files);
    e.target.value = '';
  }

  function submitFolder(e: React.FormEvent) {
    e.preventDefault();
    if (folderName.trim()) {
      onMkdir(folderName.trim());
      setFolderName('');
      setNewFolder(false);
    }
  }

  const hasSelection = selected.length > 0;

  return (
    <div className="flex items-stretch gap-2 flex-wrap">
      <input
        ref={fileInput}
        type="file"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <button
        onClick={handleUploadClick}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 border border-sky-500/20 transition text-sm font-medium w-full sm:w-auto"
      >
        <Upload className="w-4 h-4" />
        Upload
      </button>

      {newFolder ? (
        <form onSubmit={submitFolder} className="flex items-center gap-2 w-full sm:w-auto">
          <input
            autoFocus
            value={folderName}
            onChange={(e) => setFolderName(e.target.value)}
            onBlur={() => {
              if (!folderName) setNewFolder(false);
            }}
            placeholder="Folder name"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 w-full sm:w-40"
          />
          <button type="submit" className="text-sky-300 hover:text-sky-200 text-sm font-medium">
            Create
          </button>
        </form>
      ) : (
        <button
          onClick={() => setNewFolder(true)}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/70 text-slate-300 hover:bg-slate-700/70 border border-slate-700 transition text-sm font-medium w-full sm:w-auto"
        >
          <FolderPlus className="w-4 h-4" />
          New Folder
        </button>
      )}

      <div className="w-px h-6 bg-slate-700/60 mx-1" />

      {hasSelection && (
        <>
          <button
            onClick={onZip}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 border border-emerald-500/20 transition text-sm font-medium w-full sm:w-auto"
          >
            <Download className="w-4 h-4" />
            Zip {selected.length > 1 ? `${selected.length} items` : 'item'}
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 border border-rose-500/20 transition text-sm font-medium w-full sm:w-auto"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <div className="w-px h-6 bg-slate-700/60 mx-1" />
        </>
      )}

      <button
        onClick={onRefresh}
        disabled={loading}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition text-sm font-medium w-full sm:w-auto"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
      </button>

      <div className="flex-1" />

      <button
        onClick={onLogout}
        className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 transition text-sm font-medium w-full sm:w-auto"
      >
        <LogOut className="w-4 h-4" />
        <span className="hidden sm:inline">Logout</span>
      </button>
    </div>
  );
}
