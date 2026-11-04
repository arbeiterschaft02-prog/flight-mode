import { MAX_CHECKLIST_ITEMS, MAX_CHECKLIST_TEXT, type ChecklistItem } from '../types/index.ts';

/** Collapses whitespace and caps the length; returns null for an empty item. */
export function normalizeChecklistText(raw: string): string | null {
  const text = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_CHECKLIST_TEXT).trim();
  return text ? text : null;
}

/**
 * Validates a checklist coming over IPC or from disk: drops malformed and empty
 * items and duplicate ids, and caps the number of items.
 */
export function sanitizeChecklist(raw: unknown): ChecklistItem[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: ChecklistItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, text, done } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !id || id.length > 64 || seen.has(id) || typeof text !== 'string') continue;
    const normalized = normalizeChecklistText(text);
    if (!normalized) continue;
    seen.add(id);
    out.push({ id, text: normalized, done: done === true });
    if (out.length === MAX_CHECKLIST_ITEMS) break;
  }
  return out;
}

export function checklistProgress(items: ChecklistItem[] | undefined): { done: number; total: number } {
  const list = items ?? [];
  return { done: list.filter((i) => i.done).length, total: list.length };
}
