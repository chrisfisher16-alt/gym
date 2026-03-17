import type { FoodDatabaseItem } from '../types/nutrition';

// ── Food Database ──────────────────────────────────────────────────
// ~90 common foods with macro data per standard serving

export const FOOD_DATABASE: FoodDatabaseItem[] = [
  // ── Proteins ───────────────────────────────────────────────────
  { id: 'p01', name: 'Chicken Breast', category: 'protein', servingSize: 150, servingUnit: 'g', calories: 248, protein_g: 46, carbs_g: 0, fat_g: 5.4, fiber_g: 0, aliases: ['chicken', 'grilled chicken'] },
  { id: 'p02', name: 'Salmon Fillet', category: 'protein', servingSize: 150, servingUnit: 'g', calories: 312, protein_g: 34, carbs_g: 0, fat_g: 18.5, fiber_g: 0, aliases: ['salmon', 'grilled salmon'] },
  { id: 'p03', name: 'Eggs', category: 'protein', servingSize: 1, servingUnit: 'large', calories: 72, protein_g: 6, carbs_g: 0.4, fat_g: 5, fiber_g: 0, aliases: ['egg', 'fried egg', 'boiled egg', 'scrambled eggs', 'scrambled egg'] },
  { id: 'p04', name: 'Ground Beef (85% lean)', category: 'protein', servingSize: 113, servingUnit: 'g', calories: 243, protein_g: 21, carbs_g: 0, fat_g: 17, fiber_g: 0, aliases: ['ground beef', 'beef'] },
  { id: 'p05', name: 'Tofu (firm)', category: 'protein', servingSize: 126, servingUnit: 'g', calories: 88, protein_g: 10, carbs_g: 2, fat_g: 5, fiber_g: 0.5, aliases: ['tofu'] },
  { id: 'p06', name: 'Greek Yogurt (plain)', category: 'protein', servingSize: 170, servingUnit: 'g', calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0.7, fiber_g: 0, aliases: ['greek yogurt', 'yogurt'] },
  { id: 'p07', name: 'Whey Protein Scoop', category: 'protein', servingSize: 30, servingUnit: 'g', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, fiber_g: 0, aliases: ['whey protein', 'protein powder', 'protein shake', 'shake'] },
  { id: 'p08', name: 'Turkey Breast', category: 'protein', servingSize: 113, servingUnit: 'g', calories: 153, protein_g: 34, carbs_g: 0, fat_g: 1, fiber_g: 0, aliases: ['turkey'] },
  { id: 'p09', name: 'Shrimp', category: 'protein', servingSize: 100, servingUnit: 'g', calories: 99, protein_g: 24, carbs_g: 0.2, fat_g: 0.3, fiber_g: 0, aliases: ['shrimp', 'prawns'] },
  { id: 'p10', name: 'Tuna (canned)', category: 'protein', servingSize: 85, servingUnit: 'g', calories: 100, protein_g: 22, carbs_g: 0, fat_g: 1, fiber_g: 0, aliases: ['tuna', 'canned tuna'] },
  { id: 'p11', name: 'Cottage Cheese', category: 'protein', servingSize: 113, servingUnit: 'g', calories: 98, protein_g: 11, carbs_g: 3.5, fat_g: 4.3, fiber_g: 0, aliases: ['cottage cheese'] },
  { id: 'p12', name: 'Steak (sirloin)', category: 'protein', servingSize: 170, servingUnit: 'g', calories: 366, protein_g: 46, carbs_g: 0, fat_g: 19, fiber_g: 0, aliases: ['steak', 'sirloin'] },

  // ── Carbs / Grains ─────────────────────────────────────────────
  { id: 'c01', name: 'White Rice (cooked)', category: 'carbs', servingSize: 158, servingUnit: 'g', calories: 206, protein_g: 4.3, carbs_g: 45, fat_g: 0.4, fiber_g: 0.6, aliases: ['rice', 'white rice'] },
  { id: 'c02', name: 'Brown Rice (cooked)', category: 'carbs', servingSize: 195, servingUnit: 'g', calories: 216, protein_g: 5, carbs_g: 45, fat_g: 1.8, fiber_g: 3.5, aliases: ['brown rice'] },
  { id: 'c03', name: 'Bread (white, 1 slice)', category: 'carbs', servingSize: 1, servingUnit: 'slice', calories: 79, protein_g: 2.7, carbs_g: 15, fat_g: 1, fiber_g: 0.6, aliases: ['bread', 'white bread', 'toast'] },
  { id: 'c04', name: 'Bread (whole wheat, 1 slice)', category: 'carbs', servingSize: 1, servingUnit: 'slice', calories: 81, protein_g: 4, carbs_g: 14, fat_g: 1.1, fiber_g: 1.9, aliases: ['whole wheat bread', 'wheat bread', 'wheat toast'] },
  { id: 'c05', name: 'Oats (dry)', category: 'carbs', servingSize: 40, servingUnit: 'g', calories: 152, protein_g: 5.3, carbs_g: 27, fat_g: 2.7, fiber_g: 4, aliases: ['oats', 'oatmeal', 'porridge'] },
  { id: 'c06', name: 'Pasta (cooked)', category: 'carbs', servingSize: 140, servingUnit: 'g', calories: 220, protein_g: 8.1, carbs_g: 43, fat_g: 1.3, fiber_g: 2.5, aliases: ['pasta', 'spaghetti', 'noodles', 'penne'] },
  { id: 'c07', name: 'Potato', category: 'carbs', servingSize: 150, servingUnit: 'g', calories: 116, protein_g: 3.1, carbs_g: 26, fat_g: 0.1, fiber_g: 2.1, aliases: ['potato', 'baked potato', 'potatoes'] },
  { id: 'c08', name: 'Sweet Potato', category: 'carbs', servingSize: 150, servingUnit: 'g', calories: 129, protein_g: 2.4, carbs_g: 30, fat_g: 0.1, fiber_g: 4.5, aliases: ['sweet potato', 'sweet potatoes'] },
  { id: 'c09', name: 'Quinoa (cooked)', category: 'carbs', servingSize: 185, servingUnit: 'g', calories: 222, protein_g: 8.1, carbs_g: 39, fat_g: 3.6, fiber_g: 5.2, aliases: ['quinoa'] },
  { id: 'c10', name: 'Tortilla (flour)', category: 'carbs', servingSize: 1, servingUnit: 'medium', calories: 140, protein_g: 3.6, carbs_g: 24, fat_g: 3.5, fiber_g: 1, aliases: ['tortilla', 'wrap'] },
  { id: 'c11', name: 'Bagel', category: 'carbs', servingSize: 1, servingUnit: 'medium', calories: 270, protein_g: 10, carbs_g: 53, fat_g: 1.5, fiber_g: 2, aliases: ['bagel'] },
  { id: 'c12', name: 'Granola', category: 'carbs', servingSize: 55, servingUnit: 'g', calories: 260, protein_g: 6, carbs_g: 38, fat_g: 10, fiber_g: 3.5, aliases: ['granola'] },

  // ── Fats ───────────────────────────────────────────────────────
  { id: 'f01', name: 'Olive Oil', category: 'fats', servingSize: 1, servingUnit: 'tbsp', calories: 119, protein_g: 0, carbs_g: 0, fat_g: 13.5, fiber_g: 0, aliases: ['olive oil'] },
  { id: 'f02', name: 'Butter', category: 'fats', servingSize: 1, servingUnit: 'tbsp', calories: 102, protein_g: 0.1, carbs_g: 0, fat_g: 11.5, fiber_g: 0, aliases: ['butter'] },
  { id: 'f03', name: 'Avocado', category: 'fats', servingSize: 0.5, servingUnit: 'medium', calories: 120, protein_g: 1.5, carbs_g: 6, fat_g: 11, fiber_g: 5, aliases: ['avocado', 'avo'] },
  { id: 'f04', name: 'Almonds', category: 'fats', servingSize: 28, servingUnit: 'g', calories: 164, protein_g: 6, carbs_g: 6, fat_g: 14, fiber_g: 3.5, aliases: ['almonds'] },
  { id: 'f05', name: 'Peanut Butter', category: 'fats', servingSize: 2, servingUnit: 'tbsp', calories: 188, protein_g: 7, carbs_g: 7, fat_g: 16, fiber_g: 1.6, aliases: ['peanut butter', 'pb'] },
  { id: 'f06', name: 'Walnuts', category: 'fats', servingSize: 28, servingUnit: 'g', calories: 185, protein_g: 4.3, carbs_g: 3.9, fat_g: 18.5, fiber_g: 1.9, aliases: ['walnuts'] },
  { id: 'f07', name: 'Coconut Oil', category: 'fats', servingSize: 1, servingUnit: 'tbsp', calories: 121, protein_g: 0, carbs_g: 0, fat_g: 13.5, fiber_g: 0, aliases: ['coconut oil'] },
  { id: 'f08', name: 'Cheese (cheddar)', category: 'fats', servingSize: 28, servingUnit: 'g', calories: 113, protein_g: 7, carbs_g: 0.4, fat_g: 9.3, fiber_g: 0, aliases: ['cheese', 'cheddar'] },
  { id: 'f09', name: 'Cream Cheese', category: 'fats', servingSize: 28, servingUnit: 'g', calories: 99, protein_g: 1.7, carbs_g: 1.6, fat_g: 9.8, fiber_g: 0, aliases: ['cream cheese'] },

  // ── Fruits ─────────────────────────────────────────────────────
  { id: 'fr01', name: 'Banana', category: 'fruit', servingSize: 1, servingUnit: 'medium', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, fiber_g: 3.1, aliases: ['banana'] },
  { id: 'fr02', name: 'Apple', category: 'fruit', servingSize: 1, servingUnit: 'medium', calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, fiber_g: 4.4, aliases: ['apple'] },
  { id: 'fr03', name: 'Blueberries', category: 'fruit', servingSize: 148, servingUnit: 'g', calories: 84, protein_g: 1.1, carbs_g: 21, fat_g: 0.5, fiber_g: 3.6, aliases: ['blueberries'] },
  { id: 'fr04', name: 'Strawberries', category: 'fruit', servingSize: 152, servingUnit: 'g', calories: 49, protein_g: 1, carbs_g: 12, fat_g: 0.5, fiber_g: 3, aliases: ['strawberries'] },
  { id: 'fr05', name: 'Orange', category: 'fruit', servingSize: 1, servingUnit: 'medium', calories: 62, protein_g: 1.2, carbs_g: 15, fat_g: 0.2, fiber_g: 3.1, aliases: ['orange'] },
  { id: 'fr06', name: 'Grapes', category: 'fruit', servingSize: 151, servingUnit: 'g', calories: 104, protein_g: 1.1, carbs_g: 27, fat_g: 0.2, fiber_g: 1.4, aliases: ['grapes'] },
  { id: 'fr07', name: 'Mango', category: 'fruit', servingSize: 165, servingUnit: 'g', calories: 99, protein_g: 1.4, carbs_g: 25, fat_g: 0.6, fiber_g: 2.6, aliases: ['mango'] },

  // ── Vegetables ─────────────────────────────────────────────────
  { id: 'v01', name: 'Broccoli', category: 'vegetable', servingSize: 91, servingUnit: 'g', calories: 31, protein_g: 2.6, carbs_g: 6, fat_g: 0.3, fiber_g: 2.4, aliases: ['broccoli'] },
  { id: 'v02', name: 'Spinach (raw)', category: 'vegetable', servingSize: 30, servingUnit: 'g', calories: 7, protein_g: 0.9, carbs_g: 1.1, fat_g: 0.1, fiber_g: 0.7, aliases: ['spinach'] },
  { id: 'v03', name: 'Mixed Salad', category: 'vegetable', servingSize: 85, servingUnit: 'g', calories: 15, protein_g: 1.3, carbs_g: 2.4, fat_g: 0.2, fiber_g: 1.8, aliases: ['salad', 'mixed salad', 'green salad', 'side salad'] },
  { id: 'v04', name: 'Carrots', category: 'vegetable', servingSize: 61, servingUnit: 'g', calories: 25, protein_g: 0.6, carbs_g: 6, fat_g: 0.1, fiber_g: 1.7, aliases: ['carrots', 'carrot'] },
  { id: 'v05', name: 'Bell Pepper', category: 'vegetable', servingSize: 119, servingUnit: 'g', calories: 31, protein_g: 1, carbs_g: 6, fat_g: 0.3, fiber_g: 2.1, aliases: ['bell pepper', 'pepper'] },
  { id: 'v06', name: 'Tomato', category: 'vegetable', servingSize: 123, servingUnit: 'g', calories: 22, protein_g: 1.1, carbs_g: 4.8, fat_g: 0.2, fiber_g: 1.5, aliases: ['tomato', 'tomatoes'] },
  { id: 'v07', name: 'Cucumber', category: 'vegetable', servingSize: 52, servingUnit: 'g', calories: 8, protein_g: 0.3, carbs_g: 1.9, fat_g: 0.1, fiber_g: 0.3, aliases: ['cucumber'] },
  { id: 'v08', name: 'Green Beans', category: 'vegetable', servingSize: 125, servingUnit: 'g', calories: 34, protein_g: 2, carbs_g: 7.8, fat_g: 0.1, fiber_g: 3.7, aliases: ['green beans'] },

  // ── Dairy ──────────────────────────────────────────────────────
  { id: 'd01', name: 'Whole Milk', category: 'dairy', servingSize: 1, servingUnit: 'cup', calories: 149, protein_g: 8, carbs_g: 12, fat_g: 8, fiber_g: 0, aliases: ['milk', 'whole milk'] },
  { id: 'd02', name: 'Skim Milk', category: 'dairy', servingSize: 1, servingUnit: 'cup', calories: 83, protein_g: 8.3, carbs_g: 12, fat_g: 0.2, fiber_g: 0, aliases: ['skim milk'] },
  { id: 'd03', name: 'Almond Milk', category: 'dairy', servingSize: 1, servingUnit: 'cup', calories: 39, protein_g: 1.5, carbs_g: 3.4, fat_g: 2.5, fiber_g: 0.5, aliases: ['almond milk'] },
  { id: 'd04', name: 'Mozzarella', category: 'dairy', servingSize: 28, servingUnit: 'g', calories: 85, protein_g: 6.3, carbs_g: 0.7, fat_g: 6.3, fiber_g: 0, aliases: ['mozzarella'] },

  // ── Beverages ──────────────────────────────────────────────────
  { id: 'b01', name: 'Coffee (black)', category: 'beverage', servingSize: 1, servingUnit: 'cup', calories: 2, protein_g: 0.3, carbs_g: 0, fat_g: 0, fiber_g: 0, aliases: ['coffee', 'black coffee'] },
  { id: 'b02', name: 'Coffee with Milk', category: 'beverage', servingSize: 1, servingUnit: 'cup', calories: 30, protein_g: 1.5, carbs_g: 2.5, fat_g: 1.5, fiber_g: 0, aliases: ['coffee with milk', 'latte', 'cafe latte'] },
  { id: 'b03', name: 'Orange Juice', category: 'beverage', servingSize: 1, servingUnit: 'cup', calories: 112, protein_g: 1.7, carbs_g: 26, fat_g: 0.5, fiber_g: 0.5, aliases: ['orange juice', 'oj', 'juice'] },
  { id: 'b04', name: 'Green Tea', category: 'beverage', servingSize: 1, servingUnit: 'cup', calories: 2, protein_g: 0.5, carbs_g: 0, fat_g: 0, fiber_g: 0, aliases: ['green tea', 'tea'] },
  { id: 'b05', name: 'Soda', category: 'beverage', servingSize: 1, servingUnit: 'can', calories: 140, protein_g: 0, carbs_g: 39, fat_g: 0, fiber_g: 0, aliases: ['soda', 'coke', 'cola', 'pepsi'] },
  { id: 'b06', name: 'Smoothie (fruit)', category: 'beverage', servingSize: 1, servingUnit: 'cup', calories: 150, protein_g: 2, carbs_g: 35, fat_g: 0.5, fiber_g: 3, aliases: ['smoothie', 'fruit smoothie'] },

  // ── Common Meals / Combos ──────────────────────────────────────
  { id: 'm01', name: 'Pizza Slice (cheese)', category: 'meal', servingSize: 1, servingUnit: 'slice', calories: 272, protein_g: 12, carbs_g: 34, fat_g: 10, fiber_g: 2.3, aliases: ['pizza', 'pizza slice', 'cheese pizza'] },
  { id: 'm02', name: 'Hamburger', category: 'meal', servingSize: 1, servingUnit: 'burger', calories: 354, protein_g: 20, carbs_g: 29, fat_g: 17, fiber_g: 1.3, aliases: ['hamburger', 'burger', 'cheeseburger'] },
  { id: 'm03', name: 'Sandwich (turkey)', category: 'meal', servingSize: 1, servingUnit: 'sandwich', calories: 320, protein_g: 22, carbs_g: 34, fat_g: 10, fiber_g: 2, aliases: ['sandwich', 'turkey sandwich'] },
  { id: 'm04', name: 'Caesar Salad', category: 'meal', servingSize: 1, servingUnit: 'bowl', calories: 220, protein_g: 8, carbs_g: 10, fat_g: 16, fiber_g: 2.5, aliases: ['caesar salad'] },
  { id: 'm05', name: 'Burrito', category: 'meal', servingSize: 1, servingUnit: 'burrito', calories: 450, protein_g: 22, carbs_g: 50, fat_g: 18, fiber_g: 6, aliases: ['burrito'] },
  { id: 'm06', name: 'Sushi Roll (6 pieces)', category: 'meal', servingSize: 6, servingUnit: 'pieces', calories: 250, protein_g: 9, carbs_g: 38, fat_g: 7, fiber_g: 1, aliases: ['sushi', 'sushi roll', 'california roll'] },
  { id: 'm07', name: 'Chicken Caesar Wrap', category: 'meal', servingSize: 1, servingUnit: 'wrap', calories: 380, protein_g: 28, carbs_g: 30, fat_g: 16, fiber_g: 2, aliases: ['chicken wrap', 'caesar wrap'] },
  { id: 'm08', name: 'Tacos (2 beef)', category: 'meal', servingSize: 2, servingUnit: 'tacos', calories: 340, protein_g: 18, carbs_g: 28, fat_g: 16, fiber_g: 3, aliases: ['tacos', 'taco'] },
  { id: 'm09', name: 'Fried Rice', category: 'meal', servingSize: 1, servingUnit: 'cup', calories: 238, protein_g: 5.5, carbs_g: 35, fat_g: 8.5, fiber_g: 1.2, aliases: ['fried rice'] },
  { id: 'm10', name: 'Grilled Chicken Salad', category: 'meal', servingSize: 1, servingUnit: 'bowl', calories: 300, protein_g: 32, carbs_g: 12, fat_g: 14, fiber_g: 4, aliases: ['chicken salad'] },
  { id: 'm11', name: 'Pancakes (3 stack)', category: 'meal', servingSize: 3, servingUnit: 'pancakes', calories: 350, protein_g: 9, carbs_g: 56, fat_g: 10, fiber_g: 1.5, aliases: ['pancakes', 'pancake'] },
  { id: 'm12', name: 'French Fries (medium)', category: 'meal', servingSize: 1, servingUnit: 'serving', calories: 365, protein_g: 4, carbs_g: 48, fat_g: 17, fiber_g: 4, aliases: ['french fries', 'fries'] },
  { id: 'm13', name: 'Chicken Nuggets (6pc)', category: 'meal', servingSize: 6, servingUnit: 'pieces', calories: 280, protein_g: 14, carbs_g: 18, fat_g: 17, fiber_g: 1, aliases: ['chicken nuggets', 'nuggets'] },
  { id: 'm14', name: 'Mac and Cheese', category: 'meal', servingSize: 1, servingUnit: 'cup', calories: 310, protein_g: 11, carbs_g: 38, fat_g: 13, fiber_g: 1.5, aliases: ['mac and cheese', 'macaroni'] },
  { id: 'm15', name: 'Overnight Oats', category: 'meal', servingSize: 1, servingUnit: 'cup', calories: 310, protein_g: 12, carbs_g: 44, fat_g: 9, fiber_g: 5, aliases: ['overnight oats'] },

  // ── Snacks ─────────────────────────────────────────────────────
  { id: 's01', name: 'Protein Bar', category: 'snack', servingSize: 1, servingUnit: 'bar', calories: 210, protein_g: 20, carbs_g: 22, fat_g: 7, fiber_g: 3, aliases: ['protein bar'] },
  { id: 's02', name: 'Granola Bar', category: 'snack', servingSize: 1, servingUnit: 'bar', calories: 190, protein_g: 3, carbs_g: 29, fat_g: 7, fiber_g: 2, aliases: ['granola bar'] },
  { id: 's03', name: 'Trail Mix', category: 'snack', servingSize: 40, servingUnit: 'g', calories: 200, protein_g: 5, carbs_g: 18, fat_g: 13, fiber_g: 2, aliases: ['trail mix'] },
  { id: 's04', name: 'Dark Chocolate', category: 'snack', servingSize: 28, servingUnit: 'g', calories: 155, protein_g: 1.4, carbs_g: 17, fat_g: 9, fiber_g: 2, aliases: ['chocolate', 'dark chocolate'] },
  { id: 's05', name: 'Rice Cake', category: 'snack', servingSize: 1, servingUnit: 'cake', calories: 35, protein_g: 0.7, carbs_g: 7.3, fat_g: 0.3, fiber_g: 0.4, aliases: ['rice cake', 'rice cakes'] },
  { id: 's06', name: 'Hummus', category: 'snack', servingSize: 2, servingUnit: 'tbsp', calories: 70, protein_g: 2, carbs_g: 6, fat_g: 5, fiber_g: 1, aliases: ['hummus'] },
  { id: 's07', name: 'Chips (potato)', category: 'snack', servingSize: 28, servingUnit: 'g', calories: 152, protein_g: 2, carbs_g: 15, fat_g: 10, fiber_g: 1, aliases: ['chips', 'potato chips'] },
  { id: 's08', name: 'Popcorn (air-popped)', category: 'snack', servingSize: 28, servingUnit: 'g', calories: 110, protein_g: 3.2, carbs_g: 22, fat_g: 1.3, fiber_g: 4, aliases: ['popcorn'] },

  // ── Condiments / Extras ────────────────────────────────────────
  { id: 'x01', name: 'Honey', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 64, protein_g: 0.1, carbs_g: 17, fat_g: 0, fiber_g: 0, aliases: ['honey'] },
  { id: 'x02', name: 'Maple Syrup', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 52, protein_g: 0, carbs_g: 13, fat_g: 0, fiber_g: 0, aliases: ['maple syrup', 'syrup'] },
  { id: 'x03', name: 'Salad Dressing (ranch)', category: 'condiment', servingSize: 2, servingUnit: 'tbsp', calories: 129, protein_g: 0.4, carbs_g: 1.8, fat_g: 13, fiber_g: 0, aliases: ['ranch', 'ranch dressing', 'dressing'] },
  { id: 'x04', name: 'Soy Sauce', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 9, protein_g: 0.9, carbs_g: 1, fat_g: 0, fiber_g: 0, aliases: ['soy sauce'] },
  { id: 'x05', name: 'Mayonnaise', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 94, protein_g: 0.1, carbs_g: 0, fat_g: 10, fiber_g: 0, aliases: ['mayo', 'mayonnaise'] },
  { id: 'x06', name: 'Ketchup', category: 'condiment', servingSize: 1, servingUnit: 'tbsp', calories: 20, protein_g: 0.2, carbs_g: 5, fat_g: 0, fiber_g: 0, aliases: ['ketchup'] },

  // ── Legumes ────────────────────────────────────────────────────
  { id: 'l01', name: 'Black Beans (cooked)', category: 'legume', servingSize: 172, servingUnit: 'g', calories: 227, protein_g: 15, carbs_g: 41, fat_g: 0.9, fiber_g: 15, aliases: ['black beans', 'beans'] },
  { id: 'l02', name: 'Lentils (cooked)', category: 'legume', servingSize: 198, servingUnit: 'g', calories: 230, protein_g: 18, carbs_g: 40, fat_g: 0.8, fiber_g: 16, aliases: ['lentils'] },
  { id: 'l03', name: 'Chickpeas (cooked)', category: 'legume', servingSize: 164, servingUnit: 'g', calories: 269, protein_g: 15, carbs_g: 45, fat_g: 4.2, fiber_g: 12, aliases: ['chickpeas'] },
];

// ── Search Function ────────────────────────────────────────────────

export function searchFoods(query: string): FoodDatabaseItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  return FOOD_DATABASE.filter((food) => {
    if (food.name.toLowerCase().includes(q)) return true;
    if (food.aliases?.some((alias) => alias.toLowerCase().includes(q))) return true;
    return false;
  }).sort((a, b) => {
    // Exact name match first
    const aExact = a.name.toLowerCase() === q || a.aliases?.some((al) => al.toLowerCase() === q);
    const bExact = b.name.toLowerCase() === q || b.aliases?.some((al) => al.toLowerCase() === q);
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;
    // Then starts-with
    const aStarts = a.name.toLowerCase().startsWith(q) || a.aliases?.some((al) => al.toLowerCase().startsWith(q));
    const bStarts = b.name.toLowerCase().startsWith(q) || b.aliases?.some((al) => al.toLowerCase().startsWith(q));
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return 0;
  });
}

export function getFoodById(id: string): FoodDatabaseItem | undefined {
  return FOOD_DATABASE.find((food) => food.id === id);
}
