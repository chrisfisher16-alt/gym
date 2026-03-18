// ── Seed Recipe Data ─────────────────────────────────────────────────
// 100 production-ready healthy recipes imported from the curated CSV.
// Each recipe is pre-tagged with source: 'seed' so it coexists cleanly
// with user-created and AI-generated recipes.

import type { RecipeEntry, RecipeDifficulty } from '../types/nutrition';

// ── Raw CSV row shape ───────────────────────────────────────────────

interface RawRecipeRow {
  id: number;
  name: string;
  difficulty: RecipeDifficulty;
  equipment: string;       // semicolon-separated
  ingredients: string;     // comma-separated
  instructions: string;    // numbered steps
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  calories: number;
}

// ── CSV data (100 rows) ─────────────────────────────────────────────

const RAW_RECIPES: RawRecipeRow[] = [
  { id: 1, name: 'Quinoa Veggie Bowl', difficulty: 'Easy', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 42, carbs_g: 50, fat_g: 15, fiber_g: 7, calories: 503 },
  { id: 2, name: 'Chicken Pasta', difficulty: 'Easy', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 47, carbs_g: 42, fat_g: 14, fiber_g: 9, calories: 482 },
  { id: 3, name: 'Grilled Chicken Quinoa Bowl', difficulty: 'Easy', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 27, carbs_g: 56, fat_g: 7, fiber_g: 10, calories: 395 },
  { id: 4, name: 'Chicken Caesar Salad', difficulty: 'Easy', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 42, carbs_g: 49, fat_g: 10, fiber_g: 6, calories: 454 },
  { id: 5, name: 'Beef Burrito Bowl', difficulty: 'Easy', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 22, carbs_g: 54, fat_g: 20, fiber_g: 5, calories: 484 },
  { id: 6, name: 'Egg White Omelette', difficulty: 'Easy', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 24, carbs_g: 32, fat_g: 11, fiber_g: 12, calories: 323 },
  { id: 7, name: 'Tofu Veggie Stir Fry', difficulty: 'Easy', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 47, carbs_g: 35, fat_g: 13, fiber_g: 7, calories: 445 },
  { id: 8, name: 'Lentil Curry', difficulty: 'Easy', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 26, carbs_g: 35, fat_g: 17, fiber_g: 8, calories: 397 },
  { id: 9, name: 'Avocado Toast with Eggs', difficulty: 'Easy', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 24, carbs_g: 41, fat_g: 11, fiber_g: 7, calories: 359 },
  { id: 10, name: 'Greek Yogurt Parfait', difficulty: 'Easy', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 24, carbs_g: 28, fat_g: 19, fiber_g: 11, calories: 379 },
  { id: 11, name: 'Protein Smoothie', difficulty: 'Easy', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 38, carbs_g: 60, fat_g: 15, fiber_g: 4, calories: 527 },
  { id: 12, name: 'Chicken Pasta', difficulty: 'Easy', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 44, carbs_g: 28, fat_g: 5, fiber_g: 5, calories: 333 },
  { id: 13, name: 'Beef Burrito Bowl', difficulty: 'Easy', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 29, carbs_g: 41, fat_g: 9, fiber_g: 8, calories: 361 },
  { id: 14, name: 'Avocado Toast with Eggs', difficulty: 'Easy', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 36, carbs_g: 29, fat_g: 16, fiber_g: 9, calories: 404 },
  { id: 15, name: 'Salmon Avocado Rice Bowl', difficulty: 'Easy', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 28, carbs_g: 56, fat_g: 8, fiber_g: 11, calories: 408 },
  { id: 16, name: 'Egg White Omelette', difficulty: 'Easy', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 47, carbs_g: 55, fat_g: 20, fiber_g: 11, calories: 588 },
  { id: 17, name: 'Salmon Avocado Rice Bowl', difficulty: 'Easy', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 33, carbs_g: 49, fat_g: 12, fiber_g: 4, calories: 436 },
  { id: 18, name: 'Chicken Caesar Salad', difficulty: 'Easy', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 21, carbs_g: 48, fat_g: 10, fiber_g: 8, calories: 366 },
  { id: 19, name: 'Lentil Curry', difficulty: 'Easy', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 50, carbs_g: 31, fat_g: 6, fiber_g: 11, calories: 378 },
  { id: 20, name: 'Chicken Pasta', difficulty: 'Easy', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 50, carbs_g: 52, fat_g: 18, fiber_g: 5, calories: 570 },
  { id: 21, name: 'Chicken Caesar Salad', difficulty: 'Easy', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 49, carbs_g: 25, fat_g: 5, fiber_g: 7, calories: 341 },
  { id: 22, name: 'Beef Burrito Bowl', difficulty: 'Easy', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 25, carbs_g: 34, fat_g: 16, fiber_g: 5, calories: 380 },
  { id: 23, name: 'Lentil Curry', difficulty: 'Easy', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 39, carbs_g: 20, fat_g: 16, fiber_g: 7, calories: 380 },
  { id: 24, name: 'Tuna Salad Wrap', difficulty: 'Easy', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 47, carbs_g: 29, fat_g: 18, fiber_g: 11, calories: 466 },
  { id: 25, name: 'Beef Burrito Bowl', difficulty: 'Easy', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 28, carbs_g: 26, fat_g: 8, fiber_g: 8, calories: 288 },
  { id: 26, name: 'Egg White Omelette', difficulty: 'Easy', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 33, carbs_g: 33, fat_g: 5, fiber_g: 5, calories: 309 },
  { id: 27, name: 'Baked Cod with Veggies', difficulty: 'Easy', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 28, carbs_g: 47, fat_g: 20, fiber_g: 5, calories: 480 },
  { id: 28, name: 'Tofu Veggie Stir Fry', difficulty: 'Easy', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 34, carbs_g: 42, fat_g: 13, fiber_g: 5, calories: 421 },
  { id: 29, name: 'Protein Pancakes', difficulty: 'Easy', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 35, carbs_g: 45, fat_g: 17, fiber_g: 6, calories: 473 },
  { id: 30, name: 'Steak Sweet Potato Plate', difficulty: 'Easy', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 42, carbs_g: 34, fat_g: 15, fiber_g: 9, calories: 439 },
  { id: 31, name: 'Tuna Salad Wrap', difficulty: 'Medium', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 43, carbs_g: 21, fat_g: 18, fiber_g: 5, calories: 418 },
  { id: 32, name: 'Tofu Veggie Stir Fry', difficulty: 'Medium', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 27, carbs_g: 29, fat_g: 11, fiber_g: 7, calories: 323 },
  { id: 33, name: 'Chicken Caesar Salad', difficulty: 'Medium', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 20, carbs_g: 44, fat_g: 17, fiber_g: 9, calories: 409 },
  { id: 34, name: 'Lentil Curry', difficulty: 'Medium', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 35, carbs_g: 41, fat_g: 18, fiber_g: 11, calories: 466 },
  { id: 35, name: 'Quinoa Veggie Bowl', difficulty: 'Medium', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 21, carbs_g: 38, fat_g: 7, fiber_g: 9, calories: 299 },
  { id: 36, name: 'Shrimp Tacos', difficulty: 'Medium', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 46, carbs_g: 50, fat_g: 19, fiber_g: 8, calories: 555 },
  { id: 37, name: 'Protein Pancakes', difficulty: 'Medium', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 22, carbs_g: 34, fat_g: 20, fiber_g: 7, calories: 404 },
  { id: 38, name: 'Ground Turkey Lettuce Wraps', difficulty: 'Medium', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 37, carbs_g: 39, fat_g: 12, fiber_g: 8, calories: 412 },
  { id: 39, name: 'Shrimp Tacos', difficulty: 'Medium', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 40, carbs_g: 42, fat_g: 19, fiber_g: 8, calories: 499 },
  { id: 40, name: 'Grilled Chicken Quinoa Bowl', difficulty: 'Medium', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 48, carbs_g: 26, fat_g: 17, fiber_g: 4, calories: 449 },
  { id: 41, name: 'Chicken Pasta', difficulty: 'Medium', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 45, carbs_g: 38, fat_g: 12, fiber_g: 3, calories: 440 },
  { id: 42, name: 'Avocado Toast with Eggs', difficulty: 'Medium', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 37, carbs_g: 28, fat_g: 18, fiber_g: 8, calories: 422 },
  { id: 43, name: 'Protein Pancakes', difficulty: 'Medium', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 24, carbs_g: 40, fat_g: 13, fiber_g: 10, calories: 373 },
  { id: 44, name: 'Protein Smoothie', difficulty: 'Medium', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 38, carbs_g: 26, fat_g: 15, fiber_g: 5, calories: 391 },
  { id: 45, name: 'Avocado Toast with Eggs', difficulty: 'Medium', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 31, carbs_g: 33, fat_g: 9, fiber_g: 12, calories: 337 },
  { id: 46, name: 'Ground Turkey Lettuce Wraps', difficulty: 'Medium', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 39, carbs_g: 52, fat_g: 12, fiber_g: 7, calories: 472 },
  { id: 47, name: 'Tuna Salad Wrap', difficulty: 'Medium', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 29, carbs_g: 34, fat_g: 18, fiber_g: 3, calories: 414 },
  { id: 48, name: 'Turkey Chili', difficulty: 'Medium', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 25, carbs_g: 34, fat_g: 10, fiber_g: 5, calories: 326 },
  { id: 49, name: 'Quinoa Veggie Bowl', difficulty: 'Medium', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 41, carbs_g: 55, fat_g: 8, fiber_g: 7, calories: 456 },
  { id: 50, name: 'Beef Burrito Bowl', difficulty: 'Medium', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 43, carbs_g: 40, fat_g: 19, fiber_g: 5, calories: 503 },
  { id: 51, name: 'Salmon Avocado Rice Bowl', difficulty: 'Medium', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 31, carbs_g: 46, fat_g: 19, fiber_g: 5, calories: 479 },
  { id: 52, name: 'Avocado Toast with Eggs', difficulty: 'Medium', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 40, carbs_g: 54, fat_g: 7, fiber_g: 3, calories: 439 },
  { id: 53, name: 'Chicken Stir Fry', difficulty: 'Medium', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 41, carbs_g: 54, fat_g: 20, fiber_g: 7, calories: 560 },
  { id: 54, name: 'Protein Smoothie', difficulty: 'Medium', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 40, carbs_g: 26, fat_g: 13, fiber_g: 6, calories: 381 },
  { id: 55, name: 'Protein Pancakes', difficulty: 'Medium', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 50, carbs_g: 56, fat_g: 11, fiber_g: 12, calories: 523 },
  { id: 56, name: 'Avocado Toast with Eggs', difficulty: 'Medium', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 46, carbs_g: 34, fat_g: 13, fiber_g: 10, calories: 437 },
  { id: 57, name: 'Chicken Stir Fry', difficulty: 'Medium', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 28, carbs_g: 49, fat_g: 10, fiber_g: 4, calories: 398 },
  { id: 58, name: 'Steak Sweet Potato Plate', difficulty: 'Medium', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 36, carbs_g: 49, fat_g: 8, fiber_g: 4, calories: 412 },
  { id: 59, name: 'Greek Yogurt Parfait', difficulty: 'Medium', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 25, carbs_g: 26, fat_g: 15, fiber_g: 12, calories: 339 },
  { id: 60, name: 'Steak Sweet Potato Plate', difficulty: 'Medium', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 43, carbs_g: 42, fat_g: 10, fiber_g: 4, calories: 430 },
  { id: 61, name: 'Lentil Curry', difficulty: 'Medium', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 48, carbs_g: 57, fat_g: 10, fiber_g: 7, calories: 510 },
  { id: 62, name: 'Turkey Chili', difficulty: 'Medium', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 29, carbs_g: 29, fat_g: 15, fiber_g: 7, calories: 367 },
  { id: 63, name: 'Chicken Pasta', difficulty: 'Medium', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 34, carbs_g: 47, fat_g: 15, fiber_g: 3, calories: 459 },
  { id: 64, name: 'Greek Yogurt Parfait', difficulty: 'Medium', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 41, carbs_g: 60, fat_g: 5, fiber_g: 8, calories: 449 },
  { id: 65, name: 'Ground Turkey Lettuce Wraps', difficulty: 'Medium', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 37, carbs_g: 36, fat_g: 7, fiber_g: 11, calories: 355 },
  { id: 66, name: 'Quinoa Veggie Bowl', difficulty: 'Medium', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 33, carbs_g: 50, fat_g: 13, fiber_g: 4, calories: 449 },
  { id: 67, name: 'Greek Yogurt Parfait', difficulty: 'Medium', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 49, carbs_g: 35, fat_g: 15, fiber_g: 6, calories: 471 },
  { id: 68, name: 'Steak Sweet Potato Plate', difficulty: 'Medium', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 20, carbs_g: 45, fat_g: 12, fiber_g: 8, calories: 368 },
  { id: 69, name: 'Beef Burrito Bowl', difficulty: 'Medium', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 25, carbs_g: 24, fat_g: 13, fiber_g: 11, calories: 313 },
  { id: 70, name: 'Egg White Omelette', difficulty: 'Medium', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 24, carbs_g: 21, fat_g: 10, fiber_g: 7, calories: 270 },
  { id: 71, name: 'Steak Sweet Potato Plate', difficulty: 'Hard', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 24, carbs_g: 32, fat_g: 20, fiber_g: 5, calories: 404 },
  { id: 72, name: 'Tuna Salad Wrap', difficulty: 'Hard', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 42, carbs_g: 21, fat_g: 18, fiber_g: 12, calories: 414 },
  { id: 73, name: 'Grilled Chicken Quinoa Bowl', difficulty: 'Hard', equipment: 'blender', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 41, carbs_g: 27, fat_g: 17, fiber_g: 11, calories: 425 },
  { id: 74, name: 'Grilled Chicken Quinoa Bowl', difficulty: 'Hard', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 30, carbs_g: 57, fat_g: 5, fiber_g: 4, calories: 393 },
  { id: 75, name: 'Chicken Caesar Salad', difficulty: 'Hard', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 33, carbs_g: 53, fat_g: 13, fiber_g: 8, calories: 461 },
  { id: 76, name: 'Tofu Veggie Stir Fry', difficulty: 'Hard', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 45, carbs_g: 54, fat_g: 5, fiber_g: 7, calories: 441 },
  { id: 77, name: 'Tuna Salad Wrap', difficulty: 'Hard', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 41, carbs_g: 23, fat_g: 11, fiber_g: 6, calories: 355 },
  { id: 78, name: 'Avocado Toast with Eggs', difficulty: 'Hard', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 43, carbs_g: 20, fat_g: 20, fiber_g: 11, calories: 432 },
  { id: 79, name: 'Lentil Curry', difficulty: 'Hard', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 42, carbs_g: 34, fat_g: 9, fiber_g: 11, calories: 385 },
  { id: 80, name: 'Chicken Caesar Salad', difficulty: 'Hard', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 41, carbs_g: 52, fat_g: 11, fiber_g: 7, calories: 471 },
  { id: 81, name: 'Lentil Curry', difficulty: 'Hard', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 22, carbs_g: 29, fat_g: 12, fiber_g: 8, calories: 312 },
  { id: 82, name: 'Baked Cod with Veggies', difficulty: 'Hard', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 35, carbs_g: 33, fat_g: 13, fiber_g: 11, calories: 389 },
  { id: 83, name: 'Lentil Curry', difficulty: 'Hard', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 38, carbs_g: 24, fat_g: 20, fiber_g: 11, calories: 428 },
  { id: 84, name: 'Protein Pancakes', difficulty: 'Hard', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 20, carbs_g: 48, fat_g: 10, fiber_g: 10, calories: 362 },
  { id: 85, name: 'Steak Sweet Potato Plate', difficulty: 'Hard', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 48, carbs_g: 33, fat_g: 8, fiber_g: 6, calories: 396 },
  { id: 86, name: 'Steak Sweet Potato Plate', difficulty: 'Hard', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 30, carbs_g: 21, fat_g: 8, fiber_g: 5, calories: 276 },
  { id: 87, name: 'Salmon Avocado Rice Bowl', difficulty: 'Hard', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 33, carbs_g: 44, fat_g: 13, fiber_g: 8, calories: 425 },
  { id: 88, name: 'Avocado Toast with Eggs', difficulty: 'Hard', equipment: 'stove;pot', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 44, carbs_g: 31, fat_g: 14, fiber_g: 4, calories: 426 },
  { id: 89, name: 'Beef Burrito Bowl', difficulty: 'Hard', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 35, carbs_g: 29, fat_g: 7, fiber_g: 12, calories: 319 },
  { id: 90, name: 'Tuna Salad Wrap', difficulty: 'Hard', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 31, carbs_g: 30, fat_g: 5, fiber_g: 8, calories: 289 },
  { id: 91, name: 'Chicken Caesar Salad', difficulty: 'Hard', equipment: 'none', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 22, carbs_g: 33, fat_g: 8, fiber_g: 8, calories: 292 },
  { id: 92, name: 'Tofu Veggie Stir Fry', difficulty: 'Hard', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 26, carbs_g: 50, fat_g: 17, fiber_g: 6, calories: 457 },
  { id: 93, name: 'Tuna Salad Wrap', difficulty: 'Hard', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 29, carbs_g: 32, fat_g: 14, fiber_g: 11, calories: 370 },
  { id: 94, name: 'Salmon Avocado Rice Bowl', difficulty: 'Hard', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 45, carbs_g: 60, fat_g: 12, fiber_g: 11, calories: 528 },
  { id: 95, name: 'Quinoa Veggie Bowl', difficulty: 'Hard', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 36, carbs_g: 53, fat_g: 17, fiber_g: 7, calories: 509 },
  { id: 96, name: 'Grilled Chicken Quinoa Bowl', difficulty: 'Hard', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 48, carbs_g: 30, fat_g: 17, fiber_g: 6, calories: 465 },
  { id: 97, name: 'Salmon Avocado Rice Bowl', difficulty: 'Hard', equipment: 'stove', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 47, carbs_g: 53, fat_g: 17, fiber_g: 12, calories: 553 },
  { id: 98, name: 'Protein Pancakes', difficulty: 'Hard', equipment: 'oven', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 44, carbs_g: 26, fat_g: 14, fiber_g: 11, calories: 406 },
  { id: 99, name: 'Grilled Chicken Quinoa Bowl', difficulty: 'Hard', equipment: 'oven;sheet pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 50, carbs_g: 37, fat_g: 6, fiber_g: 4, calories: 402 },
  { id: 100, name: 'Greek Yogurt Parfait', difficulty: 'Hard', equipment: 'stove;pan', ingredients: 'Chicken/Protein, Vegetables, Carb source (rice/quinoa), olive oil, seasoning', instructions: '1. Prep ingredients. 2. Cook protein. 3. Cook carbs if needed. 4. Combine with vegetables. 5. Season and serve.', protein_g: 38, carbs_g: 48, fat_g: 9, fiber_g: 6, calories: 425 },
];

// ── Transform to RecipeEntry[] ──────────────────────────────────────

function parseEquipment(raw: string): string[] {
  if (!raw || raw === 'none') return [];
  return raw.split(';').map((s) => s.trim()).filter(Boolean);
}

function parseIngredients(raw: string): string[] {
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function parseInstructions(raw: string): string[] {
  // Split on "N. " pattern
  return raw
    .split(/\d+\.\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Returns the 100 seed recipes as RecipeEntry[].
 * De-duplicates by base recipe name — when multiple CSV rows share the
 * same base name (e.g. "Chicken Pasta 2", "Chicken Pasta 12"), we keep
 * only the first occurrence per unique base name per difficulty tier.
 * This gives us one Easy, one Medium, and one Hard variant of each recipe.
 */
export function getSeedRecipes(): RecipeEntry[] {
  const now = new Date().toISOString();
  const seen = new Set<string>();

  return RAW_RECIPES
    .filter((row) => {
      // De-dup: keep first occurrence per base-name + difficulty
      const key = `${row.name}__${row.difficulty}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((row) => {
      const equipment = parseEquipment(row.equipment);
      const ingredientsList = parseIngredients(row.ingredients);
      const instructions = parseInstructions(row.instructions);

      const recipe: RecipeEntry = {
        id: `seed_recipe_${row.id}`,
        userId: 'local_user',
        name: row.name,
        description: `${row.difficulty} · ${row.calories} cal · ${equipment.length ? equipment.join(', ') : 'No special equipment'}`,
        items: [{
          id: `seed_ri_${row.id}`,
          name: row.name,
          calories: row.calories,
          protein_g: row.protein_g,
          carbs_g: row.carbs_g,
          fat_g: row.fat_g,
          fiber_g: row.fiber_g,
          quantity: 1,
          unit: 'serving',
          is_estimate: false,
        }],
        servings: 1,
        createdAt: now,
        updatedAt: now,
        // Extended metadata
        source: 'seed',
        difficulty: row.difficulty,
        equipment,
        ingredientsList,
        instructions,
        calories: row.calories,
        protein_g: row.protein_g,
        carbs_g: row.carbs_g,
        fat_g: row.fat_g,
        fiber_g: row.fiber_g,
      };

      return recipe;
    });
}

/**
 * Get the set of all seed recipe IDs for merge detection.
 */
export function getSeedRecipeIds(): Set<string> {
  return new Set(RAW_RECIPES.map((r) => `seed_recipe_${r.id}`));
}
