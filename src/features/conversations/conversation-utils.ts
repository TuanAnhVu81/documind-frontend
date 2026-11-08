import type { Document } from '@/api/types';

export function hiddenDocumentSelections(
  selected: string[],
  ready: Pick<Document, 'id'>[],
): string[] {
  const visible = new Set(ready.map((item) => item.id));
  return selected.filter((id) => !visible.has(id));
}
