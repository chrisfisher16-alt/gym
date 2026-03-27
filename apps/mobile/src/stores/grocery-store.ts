import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Types ────────────────────────────────────────────────────────

export interface GroceryItem {
  name: string;
  quantity: string;
  checked: boolean;
  estimatedCost?: number;
}

export interface GroceryCategory {
  name: string;
  items: GroceryItem[];
}

export interface GroceryList {
  id: string;
  categories: GroceryCategory[];
  createdAt: string;
  daysPlanned: number;
  totalEstimatedCost?: number;
}

// ── Storage Key ──────────────────────────────────────────────────

const STORAGE_KEY = '@grocery/current';

// ── State ────────────────────────────────────────────────────────

interface GroceryState {
  currentList: GroceryList | null;
  isLoading: boolean;
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  setList: (list: GroceryList) => void;
  toggleItem: (categoryIndex: number, itemIndex: number) => void;
  clearList: () => void;
  persist: () => Promise<void>;
  /**
   * Merge a set of items into the current list under a named category.
   * If no list exists, creates a minimal one. Persists automatically.
   */
  mergeRecipeItems: (categoryName: string, items: GroceryItem[]) => void;
}

// ── Store ────────────────────────────────────────────────────────

export const useGroceryStore = create<GroceryState>((set, get) => ({
  currentList: null,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({ currentList: JSON.parse(stored), isInitialized: true });
      } else {
        set({ isInitialized: true });
      }
    } catch (e) {
      console.warn('Failed to load grocery list:', e);
      set({ isInitialized: true });
    }
  },

  setList: (list: GroceryList) => {
    set({ currentList: list });
    get().persist();
  },

  toggleItem: (categoryIndex: number, itemIndex: number) => {
    const { currentList } = get();
    if (!currentList) return;

    const updated = {
      ...currentList,
      categories: currentList.categories.map((cat, ci) =>
        ci === categoryIndex
          ? {
              ...cat,
              items: cat.items.map((item, ii) =>
                ii === itemIndex ? { ...item, checked: !item.checked } : item,
              ),
            }
          : cat,
      ),
    };
    set({ currentList: updated });
    get().persist();
  },

  clearList: () => {
    set({ currentList: null });
    AsyncStorage.removeItem(STORAGE_KEY).catch((e) => console.warn('[GroceryStore] clear storage failed:', e));
  },

  mergeRecipeItems: (categoryName: string, items: GroceryItem[]) => {
    const { currentList } = get();
    let updated: GroceryList;
    if (!currentList) {
      updated = {
        id: `grocery_${Date.now()}`,
        categories: [{ name: categoryName, items }],
        createdAt: new Date().toISOString(),
        daysPlanned: 1,
      };
    } else {
      const existingIdx = currentList.categories.findIndex(
        (c) => c.name === categoryName,
      );
      const categories = existingIdx >= 0
        ? currentList.categories.map((c, i) =>
            i === existingIdx
              ? { ...c, items: [...c.items, ...items] }
              : c,
          )
        : [...currentList.categories, { name: categoryName, items }];
      updated = { ...currentList, categories };
    }
    set({ currentList: updated });
    get().persist();
  },

  persist: async () => {
    try {
      const { currentList } = get();
      if (currentList) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(currentList));
      }
    } catch (e) {
      console.warn('Failed to persist grocery list:', e);
    }
  },
}));
