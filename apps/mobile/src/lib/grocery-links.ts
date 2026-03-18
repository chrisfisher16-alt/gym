// ── Grocery Deep Links ───────────────────────────────────────────
// URL builders for ordering grocery items on Amazon Fresh.

import type { GroceryItem, GroceryCategory } from '../stores/grocery-store';

/**
 * Build an Amazon Fresh search URL for a single item.
 * The `i=amazonfresh` parameter scopes results to Amazon Fresh.
 */
export function buildAmazonFreshURL(itemName: string): string {
  const encoded = encodeURIComponent(itemName);
  return `https://www.amazon.com/s?k=${encoded}&i=amazonfresh`;
}

/**
 * Build a single Amazon Fresh search URL that combines multiple item
 * names into one query. Caps at 5 items for usable search results.
 * Falls back to the first item if the combined query would be too long.
 */
export function buildAmazonFreshBatchURL(items: GroceryItem[]): string {
  if (items.length === 0) return 'https://www.amazon.com/alm/category?node=16310101';
  if (items.length === 1) return buildAmazonFreshURL(items[0].name);

  // Amazon search degrades with too many terms — cap at 5 items.
  const capped = items.slice(0, 5);
  const names = capped.map((i) => i.name);
  let query = names[0];
  for (let idx = 1; idx < names.length; idx++) {
    const next = `${query} ${names[idx]}`;
    // Keep URLs under ~2000 chars (practical browser limit)
    if (encodeURIComponent(next).length > 1500) break;
    query = next;
  }
  return buildAmazonFreshURL(query);
}

/**
 * Collect all unchecked items from a list of categories.
 */
export function getUncheckedItems(categories: GroceryCategory[]): GroceryItem[] {
  const items: GroceryItem[] = [];
  for (const cat of categories) {
    for (const item of cat.items) {
      if (!item.checked) items.push(item);
    }
  }
  return items;
}
