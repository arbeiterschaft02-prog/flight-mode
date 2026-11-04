import { Check, Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { MAX_CHECKLIST_ITEMS, MAX_CHECKLIST_TEXT, type ChecklistItem } from '@/types';
import { normalizeChecklistText } from '@/utils/checklist';
import { cx } from '@/utils/cx';

interface ChecklistEditorProps {
  items: ChecklistItem[];
  onChange(items: ChecklistItem[]): void;
  /** Show checkboxes (during a flight); before take-off items are only listed. */
  checkable?: boolean;
  placeholder?: string;
}

/** The task checklist: add and remove steps, and tick them off in flight. */
export function ChecklistEditor({ items, onChange, checkable = false, placeholder = 'Добавьте пункт и нажмите Enter' }: ChecklistEditorProps) {
  const [value, setValue] = useState('');
  const full = items.length >= MAX_CHECKLIST_ITEMS;

  const add = (e: FormEvent) => {
    e.preventDefault();
    const text = normalizeChecklistText(value);
    if (!text || full) return;
    onChange([...items, { id: crypto.randomUUID(), text, done: false }]);
    setValue('');
  };

  return (
    <div>
      {items.length > 0 && (
        <ul className="mb-2 space-y-0.5">
          {items.map((item) => (
            <li key={item.id} className="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-raised/60">
              {checkable ? (
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.done}
                  aria-label={item.text}
                  onClick={() => onChange(items.map((i) => (i.id === item.id ? { ...i, done: !i.done } : i)))}
                  className={cx(
                    'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border transition-colors',
                    item.done ? 'border-success bg-success text-bg' : 'border-line hover:border-muted'
                  )}
                >
                  {item.done && <Check size={13} strokeWidth={3} />}
                </button>
              ) : (
                <span className="ml-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-faint" />
              )}
              <span
                className={cx(
                  'min-w-0 flex-1 break-words text-left text-[14px]',
                  item.done ? 'text-faint line-through' : 'text-ink'
                )}
              >
                {item.text}
              </span>
              <button
                type="button"
                aria-label={`Удалить пункт: ${item.text}`}
                onClick={() => onChange(items.filter((i) => i.id !== item.id))}
                className="rounded p-1 text-faint opacity-0 transition-opacity hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
              >
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {full ? (
        <p className="px-2 text-[13px] text-faint">В чек-листе максимум {MAX_CHECKLIST_ITEMS} пунктов.</p>
      ) : (
        <form onSubmit={add} className="flex items-center gap-3 px-2">
          <Plus size={16} className="shrink-0 text-faint" />
          <input
            aria-label="Новый пункт чек-листа"
            className="h-9 min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint"
            placeholder={placeholder}
            maxLength={MAX_CHECKLIST_TEXT + 20}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </form>
      )}
    </div>
  );
}
