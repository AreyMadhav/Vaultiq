export interface FileItem {
  name: string;
  isDir: boolean;
  size: number;
  mtime: number;
  ext: string;
  isText: boolean;
  isImage: boolean;
  // optional fields provided for encrypted files
  isEncrypted?: boolean;
  originalName?: string;
  originalExt?: string;
}

export interface ListResponse {
  root: string;
  path: string;
  items: FileItem[];
}

export interface PreviewResponse {
  type: 'text' | 'image' | 'none';
  content?: string;
  truncated?: boolean;
}

export interface Drive {
  id: string;
  name: string;
  totalSpaceBytes?: number;
  usedSpaceBytes?: number;
  freeSpaceBytes?: number;
  usagePercent?: number;
}
