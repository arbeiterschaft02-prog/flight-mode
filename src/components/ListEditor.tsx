import { Plus, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Button } from './Button';

interface ListEditorProps {
  items: string[];
  onChange(items: string[]): void;
  /** Returns the normalised value, or null if the input is invalid. */
  normalize(input: string): string | null;
  placeholder: string;
  invalidMessage: string;
  emptyMessage: string;
  disabled?: boolean;
}

/** Add/remove editor for the website and application block lists. */
export function ListEditor({ items, onChange, normalize, placeholder, invalidMessage, emptyMessage, disabled }: ListEditorProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    const normalized = normalize(value);
    if (!normalized) {
      setError(invalidMessage);
      return;
    }
    if (items.some((i) => i.toLowerCase() === normalized.toLowerCase())) {
      setError(`${normalized} уже есть в списке.`);
      return;
    }
    onChange([...items, normalized]);
    setValue('');
    setError(null);
  };

  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <input
          className="input h-10 py-0 text-sm"
          placeholder={placeholder}
          value={value}
          disabled={disabled}
          onChange={(e) => {
            setValue(e.target.value);
            setError(null);
          }}
        />
        <Button type="submit" size="md" icon={<Plus size={16} />} disabled={disabled || !value.trim()}>
          Добавить
        </Button>
      </form>
      {error && <p className="mt-2 text-[13px] text-danger">{error}</p>}
      {items.length === 0 ? (
        <p className="mt-3 text-[13px] text-faint">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {items.map((item) => (
            <li key={item} className="flex items-center gap-1 rounded-lg bg-raised py-1 pl-2.5 pr-1 text-[13px] text-ink">
              {item}
              <button
                type="button"
                aria-label={`Удалить ${item}`}
                disabled={disabled}
                className="rounded p-0.5 text-faint hover:bg-line/60 hover:text-ink disabled:opacity-40"
                onClick={() => onChange(items.filter((i) => i !== item))}
              >
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
