import type { ServiceItem } from '../types.ts';

export interface RunSheetInsertionResult {
  schedule: ServiceItem[];
  selectedItemId: string;
  insertedIndex: number;
  insertedItem: ServiceItem;
}

export const insertGeneratedHymnIntoRunSheet = (
  schedule: ServiceItem[],
  item: ServiceItem,
  options: {
    afterItemId?: string | null;
    replaceItemId?: string | null;
  } = {},
): RunSheetInsertionResult => {
  const replaceItemId = options.replaceItemId || null;
  if (replaceItemId) {
    const replaceIndex = schedule.findIndex((entry) => entry.id === replaceItemId);
    if (replaceIndex >= 0) {
      const next = [...schedule];
      next.splice(replaceIndex, 1, item);
      return {
        schedule: next,
        selectedItemId: item.id,
        insertedIndex: replaceIndex,
        insertedItem: item,
      };
    }
  }

  const afterItemId = options.afterItemId || null;
  const afterIndex = afterItemId ? schedule.findIndex((entry) => entry.id === afterItemId) : -1;
  const insertIndex = afterIndex >= 0 ? afterIndex + 1 : schedule.length;
  const next = [...schedule];
  next.splice(insertIndex, 0, item);

  return {
    schedule: next,
    selectedItemId: item.id,
    insertedIndex: insertIndex,
    insertedItem: item,
  };
};
