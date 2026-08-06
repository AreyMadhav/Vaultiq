import {
  Folder,
  File as FileIcon,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCode,
  FileSpreadsheet,
  FileType,
} from 'lucide-react';
import type { ComponentType } from 'react';

const EXT_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  '.txt': FileText,
  '.md': FileText,
  '.markdown': FileText,
  '.json': FileCode,
  '.js': FileCode,
  '.jsx': FileCode,
  '.ts': FileCode,
  '.tsx': FileCode,
  '.html': FileCode,
  '.htm': FileCode,
  '.css': FileCode,
  '.scss': FileCode,
  '.xml': FileCode,
  '.yaml': FileText,
  '.yml': FileText,
  '.py': FileCode,
  '.rb': FileCode,
  '.go': FileCode,
  '.rs': FileCode,
  '.java': FileCode,
  '.c': FileCode,
  '.cpp': FileCode,
  '.sh': FileCode,
  '.sql': FileCode,
  '.pdf': FileType,
  '.zip': FileArchive,
  '.rar': FileArchive,
  '.7z': FileArchive,
  '.tar': FileArchive,
  '.gz': FileArchive,
  '.bz2': FileArchive,
  '.xlsx': FileSpreadsheet,
  '.xls': FileSpreadsheet,
  '.csv': FileSpreadsheet,
  '.docx': FileType,
  '.doc': FileType,
  '.pptx': FileType,
  '.ppt': FileType,
  '.png': FileImage,
  '.jpg': FileImage,
  '.jpeg': FileImage,
  '.gif': FileImage,
  '.webp': FileImage,
  '.bmp': FileImage,
  '.svg': FileImage,
  '.ico': FileImage,
  '.mp4': FileVideo,
  '.mkv': FileVideo,
  '.avi': FileVideo,
  '.mov': FileVideo,
  '.webm': FileVideo,
  '.mp3': FileAudio,
  '.wav': FileAudio,
  '.flac': FileAudio,
  '.ogg': FileAudio,
  '.m4a': FileAudio,
};

export function getIcon(item: { isDir: boolean; ext: string; isImage: boolean }) {
  if (item.isDir) return Folder;
  if (EXT_ICONS[item.ext]) return EXT_ICONS[item.ext];
  if (item.isImage) return FileImage;
  return FileIcon;
}

export function getIconColor(item: { isDir: boolean; ext: string; isImage: boolean }): string {
  if (item.isDir) return 'text-amber-400';
  const ext = item.ext;
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.ico'].includes(ext))
    return 'text-emerald-400';
  if (['.mp4', '.mkv', '.avi', '.mov', '.webm'].includes(ext)) return 'text-rose-400';
  if (['.mp3', '.wav', '.flac', '.ogg', '.m4a'].includes(ext)) return 'text-fuchsia-400';
  if (['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2'].includes(ext)) return 'text-orange-400';
  if (['.js', '.jsx', '.ts', '.tsx', '.json', '.html', '.css', '.py', '.go', '.rs'].includes(ext))
    return 'text-sky-400';
  if (['.pdf'].includes(ext)) return 'text-red-400';
  if (['.xlsx', '.xls', '.csv'].includes(ext)) return 'text-green-400';
  if (['.docx', '.doc', '.pptx', '.ppt'].includes(ext)) return 'text-blue-300';
  if (['.txt', '.md', '.markdown', '.yaml', '.yml'].includes(ext)) return 'text-slate-300';
  return 'text-slate-400';
}
