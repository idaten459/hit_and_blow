export type DraftValue = number | null;

export function createEmptyDraft(length: number): DraftValue[] {
  return Array.from({ length }, () => null);
}

export function hasAnyDraftValue(values: DraftValue[]): boolean {
  return values.some((value) => value !== null);
}

export function isDraftComplete(values: DraftValue[]): values is number[] {
  return values.every((value) => value !== null);
}

export function findNextSlotIndex(values: DraftValue[], currentIndex: number): number {
  for (let index = currentIndex + 1; index < values.length; index += 1) {
    if (values[index] === null) {
      return index;
    }
  }

  const firstEmptyIndex = values.findIndex((value) => value === null);
  return firstEmptyIndex === -1 ? currentIndex : firstEmptyIndex;
}

export function toGuessValues(values: DraftValue[]): number[] {
  if (!isDraftComplete(values)) {
    throw new Error("Draft is not complete.");
  }

  return [...values];
}
