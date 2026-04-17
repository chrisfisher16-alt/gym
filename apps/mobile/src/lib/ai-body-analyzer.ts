import { supabase, isSupabaseConfigured } from './supabase';

// ── Types ────────────────────────────────────────────────────────────

export interface BodyEstimationParams {
  heightCm: number;
  weightKg: number;
  gender?: string;
  waistCm: number;
}

export interface BodyEstimationResult {
  chestCm: number;
  hipsCm: number;
  leftArmCm: number;
  rightArmCm: number;
  leftThighCm: number;
  rightThighCm: number;
}

interface EdgeBodyEstimateResponse {
  chest_cm: number;
  hips_cm: number;
  left_arm_cm: number;
  right_arm_cm: number;
  left_thigh_cm: number;
  right_thigh_cm: number;
}

// ── Estimation Function ──────────────────────────────────────────────

export async function estimateBodyMeasurements(
  params: BodyEstimationParams,
): Promise<BodyEstimationResult> {
  if (!isSupabaseConfigured) {
    throw new Error('Body measurement estimation is unavailable in preview mode.');
  }

  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error('Please sign in to estimate body measurements.');
  }

  const { data, error } = await supabase.functions.invoke<EdgeBodyEstimateResponse>(
    'ai-body-estimate',
    {
      body: {
        height_cm: params.heightCm,
        weight_kg: params.weightKg,
        waist_cm: params.waistCm,
        gender: params.gender,
      },
    },
  );

  if (error) throw error;
  if (!data) throw new Error('Empty response from body estimation service');

  return {
    chestCm: data.chest_cm,
    hipsCm: data.hips_cm,
    leftArmCm: data.left_arm_cm,
    rightArmCm: data.right_arm_cm,
    leftThighCm: data.left_thigh_cm,
    rightThighCm: data.right_thigh_cm,
  };
}
