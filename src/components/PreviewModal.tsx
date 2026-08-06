import { useEffect, useState } from 'react';
import { X, Download, Loader2, FileWarning } from 'lucide-react';
import { api } from '../api';
import type { PreviewResponse } from '../types';
import { basename } from '../utils';

export function PreviewModal({
  root,
  path,
  onClose,
}: {
  root: string;
  path: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setData(null);
    api
      .preview(root, path)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [root, path]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const name = basename(path);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-slate-900/80">
          <h3 className="text-sm font-medium text-white truncate pr-4">{name}</h3>
          <div className="flex items-center gap-2">
            <a
              href={api.downloadUrl(root, path)}
              download={name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/10 text-sky-300 hover:bg-sky-500/20 border border-sky-500/20 text-sm font-medium transition"
            >
              <Download className="w-4 h-4" />
              Download
            </a>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto p-5 min-h-[300px] flex items-center justify-center">
          {loading ? (
            <Loader2 className="w-8 h-8 text-slate-500 animate-spin" />
          ) : error ? (
            <div className="text-rose-400 flex flex-col items-center gap-2">
              <FileWarning className="w-8 h-8" />
              <p className="text-sm">{error}</p>
            </div>
          ) : data?.type === 'image' ? (
            <img
              src={api.rawUrl(root, path)}
              alt={name}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          ) : data?.type === 'text' ? (
            <div className="w-full">
              <pre className="text-sm text-slate-300 font-mono whitespace-pre-wrap break-words bg-slate-950/60 rounded-xl p-4 border border-slate-800 overflow-auto max-h-[65vh]">
                {data.content}
              </pre>
              {data.truncated && (
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Preview truncated — file is larger than 512 KB. Download to view full content.
                </p>
              )}
            </div>
          ) : (
            <div className="text-slate-500 flex flex-col items-center gap-2 py-10">
              <FileWarning className="w-8 h-8" />
              <p className="text-sm">No preview available for this file type.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
