import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Loader2, FolderX, UploadCloud, HardDrive, ChevronLeft } from 'lucide-react';
import { api } from '../api';
import type { FileItem, Drive } from '../types';
import { formatBytes, joinPath, parentPath } from '../utils';
import { Breadcrumbs } from './Breadcrumbs';
import { Toolbar } from './Toolbar';
import { FileRow } from './FileRow';
import { PreviewModal } from './PreviewModal';
import { Toasts, type ToastMsg, type ToastKind } from './Toasts';

export function Explorer({ onLogout }: { onLogout: () => void }) {
  const [drives, setDrives] = useState<Drive[]>([]);
  const [root, setRoot] = useState('');
  const [currentPath, setCurrentPath] = useState('');
  const [items, setItems] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewPath, setPreviewPath] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toast = useCallback((text: string, kind: ToastKind = 'success') => {
    setToasts((t) => [...t, { id: Date.now() + Math.random(), kind, text }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const load = useCallback(
    async (r: string, p: string) => {
      setLoading(true);
      setError('');
      setSelected(new Set());
      try {
        const res = await api.list(r, p);
        setItems(res.items);
        setCurrentPath(p);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Load drives on mount, then load the first drive's root
  useEffect(() => {
    api.drives().then((res) => {
      setDrives(res.drives);
      if (res.drives.length > 0) {
        const firstId = res.drives[0].id;
        setRoot(firstId);
        load(firstId, '');
      }
    }).catch(() => {
      setError('Could not load drives');
      setLoading(false);
    });
  }, [load]);

  function navigate(p: string) {
    if (p === currentPath) return;
    load(root, p);
  }

  function switchDrive(driveId: string) {
    if (driveId === root) return;
    setRoot(driveId);
    setSidebarOpen(false);
    load(driveId, '');
  }

  function toggleSelect(name: string) {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  function selectAll() {
    if (selected.size === items.length) setSelected(new Set());
    else setSelected(new Set(items.map((i) => i.name)));
  }

  async function handleUpload(files: File[]) {
    setUploading(true);
    setUploadPct(0);
    try {
      const uploaded = await api.upload(root, currentPath, files, setUploadPct);
      toast(`Uploaded ${uploaded.length} file${uploaded.length === 1 ? '' : 's'}`);
      await load(root, currentPath);
    } catch (e: any) {
      toast(e.message || 'Upload failed', 'error');
    } finally {
      setUploading(false);
      setUploadPct(0);
    }
  }

  async function handleMkdir(name: string) {
    try {
      await api.mkdir(root, currentPath, name);
      toast(`Folder "${name}" created`);
      await load(root, currentPath);
    } catch (e: any) {
      toast(e.message || 'Could not create folder', 'error');
    }
  }

  async function handleRename(name: string, newName: string) {
    const from = joinPath(currentPath, name);
    try {
      await api.rename(root, from, newName);
      toast(`Renamed to "${newName}"`);
      await load(root, currentPath);
    } catch (e: any) {
      toast(e.message || 'Rename failed', 'error');
    }
  }

  async function handleDeleteOne(name: string) {
    const p = joinPath(currentPath, name);
    try {
      await api.delete(root, [p]);
      toast(`Deleted "${name}"`);
      await load(root, currentPath);
    } catch (e: any) {
      toast(e.message || 'Delete failed', 'error');
    }
  }

  async function handleDeleteSelected() {
    const paths = Array.from(selected).map((n) => joinPath(currentPath, n));
    if (!confirm(`Delete ${paths.length} item${paths.length === 1 ? '' : 's'}? This cannot be undone.`))
      return;
    try {
      await api.delete(root, paths);
      toast(`Deleted ${paths.length} item${paths.length === 1 ? '' : 's'}`);
      await load(root, currentPath);
    } catch (e: any) {
      toast(e.message || 'Delete failed', 'error');
    }
  }

  async function handleZip() {
    const paths = Array.from(selected).map((n) => joinPath(currentPath, n));
    try {
      const blob = await api.zip(root, paths);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `download-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast(`Downloaded ${paths.length} item${paths.length === 1 ? '' : 's'} as zip`);
    } catch (e: any) {
      toast(e.message || 'Zip failed', 'error');
    }
  }

  function handleOpen(item: FileItem) {
    if (item.isDir) {
      navigate(joinPath(currentPath, item.name));
    } else if (item.isImage || item.isText) {
      setPreviewPath(joinPath(currentPath, item.name));
    } else {
      window.location.href = api.downloadUrl(root, joinPath(currentPath, item.name));
    }
  }

  function handleBack() {
    navigate(parentPath(currentPath));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleUpload(files);
  }

  const selectedPaths = Array.from(selected).map((n) => joinPath(currentPath, n));
  const activeDrive = drives.find((d) => d.id === root);

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-200 relative overflow-x-hidden"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={onDrop}
    >
      {/* header */}
      <header className="sticky top-0 z-30 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center gap-3 sm:gap-4">
          {/* mobile drive toggle */}
          {drives.length > 1 && (
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="lg:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition shrink-0"
              aria-label="Toggle drives"
            >
              <HardDrive className="w-5 h-5" />
            </button>
          )}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <FolderOpen className="w-5 h-5 text-white" />
            </div>
              <span className="text-base sm:text-lg font-semibold text-white hidden sm:block">
              Private Cloud
            </span>
          </div>
          <div className="flex-1 min-w-0 overflow-hidden">
            <Breadcrumbs
              path={currentPath}
              rootName={activeDrive?.name || 'Home'}
              onNavigate={navigate}
            />
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto flex min-w-0">
        {/* drive sidebar */}
        {drives.length > 1 && (
          <>
            {/* mobile overlay */}
            {sidebarOpen && (
              <div
                className="lg:hidden fixed inset-0 z-20 bg-black/50 backdrop-blur-sm"
                onClick={() => setSidebarOpen(false)}
              />
            )}
            <aside
              className={`${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
              } fixed lg:sticky top-0 lg:top-[57px] left-0 z-30 lg:z-0 h-full lg:h-[calc(100vh-57px)] w-[18rem] max-w-[85vw] bg-slate-900/95 lg:bg-transparent border-r border-slate-800 lg:border-r-0 lg:border-slate-800/50 lg:rounded-r-2xl p-3 shrink-0 transition-transform overflow-y-auto`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Drives
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden text-slate-400 hover:text-white"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
              </div>
              <div className="flex flex-col gap-1">
                {drives.map((d) => {
                  const active = d.id === root;
                  const hasSpace = typeof d.totalSpaceBytes === 'number' && d.totalSpaceBytes > 0;
                  const usagePercent = typeof d.usagePercent === 'number' ? Math.min(Math.max(d.usagePercent, 0), 100) : 0;
                  const remainingBytes = typeof d.freeSpaceBytes === 'number'
                    ? d.freeSpaceBytes
                    : Math.max((d.totalSpaceBytes || 0) - (d.usedSpaceBytes || 0), 0);
                  return (
                    <button
                      key={d.id}
                      onClick={() => switchDrive(d.id)}
                      className={`flex items-start gap-3 px-3 py-3 rounded-xl text-sm transition text-left min-w-0 w-full ${
                        active
                          ? 'bg-sky-500/15 text-sky-200 border border-sky-500/30'
                          : 'text-slate-300 hover:bg-slate-800/70 border border-transparent'
                      }`}
                    >
                      <HardDrive className={`w-4 h-4 shrink-0 ${active ? 'text-sky-400' : 'text-slate-500'}`} />
                      <span className="flex-1 min-w-0 text-left">
                        <span className="block truncate font-medium">{d.name}</span>
                        {hasSpace ? (
                          <span className="mt-1 block text-[11px] leading-4 text-slate-400">
                            {formatBytes(d.usedSpaceBytes || 0)} used · {formatBytes(remainingBytes)} free
                          </span>
                        ) : (
                          <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                            Space info unavailable
                          </span>
                        )}
                        {hasSpace && (
                          <span className="mt-2 block h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <span
                              className={`block h-full rounded-full ${active ? 'bg-sky-400' : 'bg-sky-500/70'}`}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
          </>
        )}

        <main className="flex-1 px-3 sm:px-4 py-4 sm:py-5 min-w-0 w-full">
          {/* toolbar */}
          <div className="mb-4">
            <Toolbar
              currentPath={currentPath}
              selected={selectedPaths}
              onRefresh={() => load(root, currentPath)}
              onMkdir={handleMkdir}
              onUpload={handleUpload}
              onZip={handleZip}
              onDelete={handleDeleteSelected}
              onLogout={onLogout}
              loading={loading}
            />
          </div>

          {/* upload progress */}
          {uploading && (
            <div className="mb-4 bg-sky-500/10 border border-sky-500/20 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between text-sm text-sky-300 mb-2">
                <span>Uploading…</span>
                <span>{Math.round(uploadPct)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-all duration-200"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
            </div>
          )}

          {/* back button when in subfolder */}
          {currentPath !== '' && (
            <button
              onClick={handleBack}
              className="flex items-center gap-2 px-3 py-2 mb-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition text-sm w-full sm:w-auto justify-center sm:justify-start"
            >
              ← Back to parent
            </button>
          )}

          {/* list header (desktop) */}
          {!loading && !error && items.length > 0 && (
            <div className="hidden sm:flex items-center gap-3 px-3 pb-2 mb-1 border-b border-slate-800/60 text-xs text-slate-500 uppercase tracking-wide">
              <button onClick={selectAll} className="hover:text-slate-300 transition">
                {selected.size === items.length && items.length > 0 ? 'Deselect all' : 'Select all'}
              </button>
              <span className="flex-1" />
              <span className="hidden md:block w-20 text-right">Size</span>
              <span className="hidden md:block w-28 text-right">Modified</span>
              <span className="w-[120px]" />
            </div>
          )}

          {/* list */}
          <div className="flex flex-col gap-1.5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <Loader2 className="w-8 h-8 animate-spin mb-3" />
                <p className="text-sm">Loading files…</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <FolderX className="w-10 h-10 mb-3 text-rose-400/70" />
                <p className="text-sm text-rose-400">{error}</p>
                <button
                  onClick={() => load(root, '')}
                  className="mt-3 px-4 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 transition text-sm"
                >
                  Go to drive root
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                <FolderOpen className="w-10 h-10 mb-3 text-slate-600" />
                <p className="text-sm">This folder is empty</p>
                <p className="text-xs text-slate-600 mt-1">
                  Drag files here or use the Upload button to add files.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <FileRow
                  key={item.name}
                  item={item}
                  root={root}
                  currentPath={currentPath}
                  selected={selected.has(item.name)}
                  onToggleSelect={() => toggleSelect(item.name)}
                  onOpen={() => handleOpen(item)}
                  onPreview={() => setPreviewPath(joinPath(currentPath, item.name))}
                  onRename={(newName) => handleRename(item.name, newName)}
                  onDeleteOne={() => handleDeleteOne(item.name)}
                />
              ))
            )}
          </div>
        </main>
      </div>

      {/* drag overlay */}
      {dragOver && (
        <div className="fixed inset-0 z-40 bg-sky-500/10 backdrop-blur-sm border-4 border-dashed border-sky-500/50 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3 text-sky-300">
            <UploadCloud className="w-12 h-12" />
            <p className="text-lg font-medium">Drop files to upload</p>
          </div>
        </div>
      )}

      {previewPath && (
        <PreviewModal root={root} path={previewPath} onClose={() => setPreviewPath(null)} />
      )}

      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
