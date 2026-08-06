import { useEffect } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';

export type ToastKind = 'success' | 'error';
export interface ToastMsg {
  id: number;
  kind: ToastKind;
  text: string;
}

export function Toasts({
  toasts,
  onDismiss,
}: {
  toasts: ToastMsg[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastMsg; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const Icon = toast.kind === 'success' ? CheckCircle2 : AlertCircle;
  const color = toast.kind === 'success' ? 'text-emerald-400' : 'text-rose-400';

  return (
    <div className="flex items-start gap-3 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 shadow-2xl animate-[slideIn_0.2s_ease-out]">
      <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${color}`} />
      <p className="text-sm text-slate-200 flex-1">{toast.text}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-slate-500 hover:text-white transition shrink-0"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
