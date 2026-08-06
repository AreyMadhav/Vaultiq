import { Home, ChevronRight } from 'lucide-react';

export function Breadcrumbs({
  path,
  rootName,
  onNavigate,
}: {
  path: string;
  rootName: string;
  onNavigate: (p: string) => void;
}) {
  const segments = path ? path.split('/') : [];

  return (
    <nav className="flex items-center gap-1 min-w-0 overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        onClick={() => onNavigate('')}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800/70 transition shrink-0 max-w-[9rem] sm:max-w-none"
      >
        <Home className="w-4 h-4" />
        <span className="text-sm font-medium truncate">{rootName}</span>
      </button>
      {segments.map((seg, i) => {
        const p = segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        return (
          <div key={i} className="flex items-center gap-1 min-w-0">
            <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
            <button
              onClick={() => onNavigate(p)}
              className={`px-2.5 py-1.5 rounded-lg text-sm transition truncate max-w-[200px] ${
                isLast
                  ? 'text-white bg-slate-800/70 font-medium'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              {seg}
            </button>
          </div>
        );
      })}
    </nav>
  );
}
