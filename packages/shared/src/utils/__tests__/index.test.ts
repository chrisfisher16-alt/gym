import { describe, expect, it } from 'vitest';
import {
  formatWeight,
  formatCalories,
  calculateBMR,
  calculateTDEE,
  calculateMacroTargets,
  isWithinFreeTierLimits,
} from '../index';

describe('formatWeight', () => {
  it('formats kg for metric users', () => {
    expect(formatWeight(75.5, 'metric')).toBe('75.5 kg');
  });

  it('converts to lbs for imperial users', () => {
    expect(formatWeight(100, 'imperial')).toBe('220.5 lbs');
  });

  it('rounds to one decimal place', () => {
    expect(formatWeight(75.567, 'metric')).toBe('75.6 kg');
  });
});

describe('formatCalories', () => {
  it('formats thousands with commas', () => {
    expect(formatCalories(2500)).toBe('2,500 cal');
  });

  it('handles small values', () => {
    expect(formatCalories(150)).toBe('150 cal');
  });
});

describe('calculateBMR', () => {
  it('applies the male Mifflin-St Jeor formula', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
    expect(calculateBMR(80, 180, 30, 'male')).toBe(1780);
  });

  it('applies the female formula by default for non-male genders', () => {
    // 10*65 + 6.25*165 - 5*30 - 161 = 650 + 1031.25 - 150 - 161 = 1370 (rounded)
    expect(calculateBMR(65, 165, 30, 'female')).toBe(1370);
  });
});

describe('calculateTDEE', () => {
  it('multiplies by the activity factor', () => {
    expect(calculateTDEE(1800, 3)).toBe(Math.round(1800 * 1.55));
  });

  it('falls back to moderate activity for unknown levels', () => {
    // 6 isn't in the table, should fall back to 1.55
    expect(calculateTDEE(1800, 6)).toBe(Math.round(1800 * 1.55));
  });
});

describe('calculateMacroTargets', () => {
  it('uses the default 30/40/30 split', () => {
    const result = calculateMacroTargets(2000);
    expect(result.protein_g).toBe(150); // 2000 * 0.3 / 4
    expect(result.carbs_g).toBe(200);   // 2000 * 0.4 / 4
    expect(result.fat_g).toBe(67);      // 2000 * 0.3 / 9 = 66.67 → 67
    expect(result.calories).toBe(2000);
  });

  it('honors a custom macro split', () => {
    const result = calculateMacroTargets(2000, { protein: 0.4, carbs: 0.3, fat: 0.3 });
    expect(result.protein_g).toBe(200); // 2000 * 0.4 / 4
  });
});

describe('isWithinFreeTierLimits', () => {
  it('always returns true for paid tiers regardless of usage', () => {
    const huge = {
      workout_logs_this_month: 9999,
      meal_logs_today: 9999,
      ai_messages_today: 9999,
    };
    expect(isWithinFreeTierLimits('workout_coach', huge)).toBe(true);
    expect(isWithinFreeTierLimits('nutrition_coach', huge)).toBe(true);
    expect(isWithinFreeTierLimits('full_health_coach', huge)).toBe(true);
  });

  it('enforces limits for the free tier', () => {
    const low = { workout_logs_this_month: 1, meal_logs_today: 1, ai_messages_today: 1 };
    const overAi = { workout_logs_this_month: 1, meal_logs_today: 1, ai_messages_today: 9999 };
    expect(isWithinFreeTierLimits('free', low)).toBe(true);
    expect(isWithinFreeTierLimits('free', overAi)).toBe(false);
  });
});
