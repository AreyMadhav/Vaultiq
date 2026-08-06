import type { ListResponse, PreviewResponse, Drive } from './types';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {
      // ignore
    }
    throw new Error(msg);
  }
  return res.json();
}

export const api = {
  checkAuth: () => request<{ authenticated: boolean }>('/api/auth/check'),

  login: (username: string, password: string) =>
    request<{ ok: boolean }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
  // Request access (creates a pending registration that must be approved by admin)
  requestAccess: (username: string, password: string) =>
    request<{ ok: boolean; message?: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request<{ ok: boolean }>('/api/auth/logout', { method: 'POST' }),

  drives: () => request<{ drives: Drive[] }>('/api/drives'),

  list: (root: string, path: string) =>
    request<ListResponse>(`/api/list?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`),

  stat: (root: string, path: string) =>
    request<{ name: string; isDir: boolean; size: number; mtime: number }>(
      `/api/stat?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`
    ),

  preview: (root: string, path: string) =>
    request<PreviewResponse>(`/api/preview?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`),

  mkdir: (root: string, path: string, name: string) =>
    request<{ ok: boolean }>('/api/mkdir', {
      method: 'POST',
      body: JSON.stringify({ root, path, name }),
    }),

  delete: (root: string, paths: string[]) =>
    request<{ ok: boolean }>('/api/delete', {
      method: 'POST',
      body: JSON.stringify({ root, paths }),
    }),

  rename: (root: string, from: string, to: string) =>
    request<{ ok: boolean }>('/api/rename', {
      method: 'POST',
      body: JSON.stringify({ root, from, to }),
    }),

  zip: (root: string, paths: string[]) =>
    fetch('/api/zip', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root, paths }),
    }).then((res) => {
      if (!res.ok) throw new Error('Zip failed');
      return res.blob();
    }),

  downloadUrl: (root: string, path: string) =>
    `/api/download?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`,
  rawUrl: (root: string, path: string) =>
    `/api/raw?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`,

  upload: (root: string, path: string, files: File[], onProgress?: (pct: number) => void) =>
    new Promise<string[]>((resolve, reject) => {
      const form = new FormData();
      form.append('root', root);
      form.append('path', path);
      for (const f of files) form.append('files', f);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.withCredentials = true;
      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress((e.loaded / e.total) * 100);
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const body = JSON.parse(xhr.responseText);
            resolve(body.uploaded || []);
          } catch {
            resolve([]);
          }
        } else {
          reject(new Error(`Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(form);
    }),
};
