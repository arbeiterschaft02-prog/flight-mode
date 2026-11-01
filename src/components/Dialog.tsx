import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  actions: ReactNode;
  onClose(): void;
  icon?: ReactNode;
}

/** Modal dialog. Escape and the backdrop close it; focus moves into it on open. */
export function Dialog({ open, title, children, actions, onClose, icon }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  // Parents (e.g. the live flight deck) re-render often; keep the effect keyed on `open` only.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const target =
      panel.current?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.current?.querySelector<HTMLElement>('button');
    target?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  // Portal to <body>: an animated (transformed) ancestor would otherwise contain the fixed overlay.
  return createPortal(
    <div className="no-drag fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-[rgb(3_7_16/0.55)] backdrop-blur-[2px]" onClick={onClose} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="panel animate-enter relative w-full max-w-[440px] p-6 shadow-2xl"
      >
        {icon && <div className="mb-4">{icon}</div>}
        <h2 id="dialog-title" className="text-lg font-semibold tracking-tight">
          {title}
        </h2>
        <div className="mt-2 text-[14px] leading-relaxed text-muted">{children}</div>
        <div className="mt-6 flex justify-end gap-2">{actions}</div>
      </div>
    </div>,
    document.body
  );
}
