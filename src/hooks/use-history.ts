import { useState, useCallback } from "react";

export interface HistoryEntry {
  id: string;
  module: string;
  date: string;
  projectName?: string;
  inputs: Record<string, unknown>;
  results: Record<string, unknown>;
}

const STORAGE_KEY = "engineering-gift-history";

function loadEntries(): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function persistEntries(entries: HistoryEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(0, 150)));
}

export function useHistory() {
  const [entries, setEntries] = useState<HistoryEntry[]>(loadEntries);

  const saveEntry = useCallback(
    (entry: Omit<HistoryEntry, "id" | "date">) => {
      const newEntry: HistoryEntry = {
        ...entry,
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
      };
      setEntries((prev) => {
        const next = [newEntry, ...prev];
        persistEntries(next);
        return next;
      });
      return newEntry;
    },
    []
  );

  const removeEntry = useCallback((id: string) => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== id);
      persistEntries(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setEntries([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { entries, saveEntry, removeEntry, clearAll };
}

export function saveToHistory(entry: Omit<HistoryEntry, "id" | "date">) {
  const newEntry: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    date: new Date().toISOString(),
  };
  const existing = loadEntries();
  persistEntries([newEntry, ...existing]);
  return newEntry;
}
