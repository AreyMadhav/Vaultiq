export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function joinPath(base: string, name: string): string {
  if (base === '') return name;
  return `${base}/${name}`;
}

export function parentPath(p: string): string {
  if (p === '' || !p.includes('/')) return '';
  return p.slice(0, p.lastIndexOf('/'));
}

export function basename(p: string): string {
  if (!p.includes('/')) return p;
  return p.slice(p.lastIndexOf('/') + 1);
}
