import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex items-end justify-between gap-6">
      <div>
        {eyebrow && <p className="label mb-2">{eyebrow}</p>}
        <h1 className="text-[28px] font-semibold leading-tight tracking-tight">{title}</h1>
        {description && <p className="mt-1.5 text-[14px] text-muted">{description}</p>}
      </div>
      {actions}
    </header>
  );
}
