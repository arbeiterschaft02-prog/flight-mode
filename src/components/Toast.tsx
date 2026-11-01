import { AlertTriangle, Info, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { cx } from '@/utils/cx';

export function ToastHost() {
  const toast = useAppStore((s) => s.toast);
  const dismiss = useAppStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(dismiss, toast.tone === 'info' ? 4500 : 9000);
    return () => window.clearTimeout(id);
  }, [toast, dismiss]);

  if (!toast) return null;
  const Icon = toast.tone === 'error' ? XCircle : toast.tone === 'warning' ? AlertTriangle : Info;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-6">
      <div
        key={toast.id}
        role="status"
        className="panel animate-enter pointer-events-auto flex max-w-[560px] items-start gap-3 py-3 pl-4 pr-3 shadow-xl"
      >
        <Icon
          size={18}
          className={cx(
            'mt-0.5 shrink-0',
            toast.tone === 'error' ? 'text-danger' : toast.tone === 'warning' ? 'text-warn' : 'text-accent'
          )}
        />
        <p className="text-[13.5px] leading-relaxed text-ink">{toast.message}</p>
        <button type="button" aria-label="Закрыть" onClick={dismiss} className="rounded-md p-1 text-faint hover:text-ink">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
