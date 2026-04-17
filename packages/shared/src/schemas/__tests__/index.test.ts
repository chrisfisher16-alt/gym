import { describe, expect, it } from 'vitest';
import {
  profileSchema,
  goalsSchema,
  loginSchema,
  signupSchema,
  mealItemSchema,
  setLogSchema,
} from '../index';

describe('profileSchema', () => {
  it('accepts a minimal valid profile', () => {
    const parsed = profileSchema.parse({ display_name: 'Jess' });
    expect(parsed.display_name).toBe('Jess');
    expect(parsed.unit_preference).toBe('imperial'); // default
  });

  it('rejects an empty display_name', () => {
    expect(() => profileSchema.parse({ display_name: '' })).toThrow();
  });

  it('rejects out-of-range height', () => {
    expect(() =>
      profileSchema.parse({ display_name: 'A', height_cm: 500 }),
    ).toThrow();
  });

  it('rejects a malformed date of birth', () => {
    expect(() =>
      profileSchema.parse({ display_name: 'A', date_of_birth: '01/01/1990' }),
    ).toThrow();
  });
});

describe('loginSchema', () => {
  it('accepts well-formed credentials', () => {
    expect(loginSchema.parse({ email: 'a@b.co', password: 'password1' })).toEqual({
      email: 'a@b.co',
      password: 'password1',
    });
  });

  it('rejects an invalid email', () => {
    expect(() => loginSchema.parse({ email: 'nope', password: 'password1' })).toThrow();
  });

  it('requires a password of at least 8 characters', () => {
    expect(() => loginSchema.parse({ email: 'a@b.co', password: 'short' })).toThrow();
  });
});

describe('signupSchema', () => {
  it('requires a display name in addition to credentials', () => {
    expect(() =>
      signupSchema.parse({ email: 'a@b.co', password: 'password1' }),
    ).toThrow();
  });
});

describe('goalsSchema', () => {
  it('accepts a primary goal with no target', () => {
    expect(goalsSchema.parse({ goal_type: 'weight_loss' })).toEqual({
      goal_type: 'weight_loss',
    });
  });

  it('rejects unknown goal types', () => {
    expect(() =>
      goalsSchema.parse({ goal_type: 'learn_piano' }),
    ).toThrow();
  });
});

describe('mealItemSchema', () => {
  it('accepts a valid item with macros', () => {
    const item = mealItemSchema.parse({
      name: 'Chicken Breast',
      serving_size: '150g',
      servings: 1,
      calories: 248,
      protein_g: 46,
      carbs_g: 0,
      fat_g: 5.4,
    });
    expect(item.calories).toBe(248);
    expect(item.fiber_g).toBe(0); // default
  });

  it('rejects negative macros', () => {
    expect(() =>
      mealItemSchema.parse({
        name: 'X',
        serving_size: '1 serving',
        servings: 1,
        calories: -10,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
      }),
    ).toThrow();
  });
});

describe('setLogSchema', () => {
  const uuid = '11111111-2222-3333-4444-555555555555';

  it('accepts a valid working set', () => {
    const set = setLogSchema.parse({
      exercise_id: uuid,
      set_number: 1,
      set_type: 'working',
      weight_kg: 100,
      reps: 8,
    });
    expect(set.set_type).toBe('working');
    expect(set.is_pr).toBe(false); // default
  });

  it('rejects an RPE out of range', () => {
    expect(() =>
      setLogSchema.parse({
        exercise_id: uuid,
        set_number: 1,
        set_type: 'working',
        rpe: 15,
      }),
    ).toThrow();
  });

  it('rejects a non-UUID exercise_id', () => {
    expect(() =>
      setLogSchema.parse({
        exercise_id: 'not-a-uuid',
        set_number: 1,
      }),
    ).toThrow();
  });
});
