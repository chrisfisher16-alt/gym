import React, { useMemo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path, G } from 'react-native-svg';
import { useTheme } from '../../theme';
import type { MuscleId } from '../../types/workout';
import { FRONT_BODY_OUTLINE, FRONT_MUSCLES } from '../../data/anatomy-paths-front';
import { BACK_BODY_OUTLINE, BACK_MUSCLES } from '../../data/anatomy-paths-back';
import type { MusclePath } from '../../data/anatomy-paths-front';

// ── Public Types ────────────────────────────────────────────────────

export interface MuscleGroupThumbnailProps {
  /** Primary muscles targeted (human-readable names from exercise data). */
  muscleGroups: string[];
  /** Secondary muscles targeted (lighter highlight). */
  secondaryMuscles?: string[];
  /** Rendered size in px. Default 40. */
  size?: number;
  /** Which body view to show. 'auto' picks based on targeted muscles. */
  variant?: 'front' | 'back' | 'auto';
  style?: StyleProp<ViewStyle>;
}

// ── Muscle Name → MuscleId + View Mapping ───────────────────────────
// Maps human-readable muscle names (from exercise data primaryMuscles /
// secondaryMuscles arrays) to the MuscleId used in SVG path data and
// the body view where that muscle is visible.

interface MuscleMapping {
  view: 'front' | 'back';
  muscleIds: MuscleId[];
}

const MUSCLE_NAME_MAP: Record<string, MuscleMapping> = {
  // ── Chest ──────────────────────────────────────────────────────────
  'pectoralis major':       { view: 'front', muscleIds: ['pectoralis_major'] },
  'upper pectoralis major': { view: 'front', muscleIds: ['pectoralis_major', 'pectoralis_minor'] },
  'lower pectoralis major': { view: 'front', muscleIds: ['pectoralis_major'] },
  'chest':                  { view: 'front', muscleIds: ['pectoralis_major'] },
  'upper chest':            { view: 'front', muscleIds: ['pectoralis_major', 'pectoralis_minor'] },
  'pectorals':              { view: 'front', muscleIds: ['pectoralis_major'] },

  // ── Shoulders ──────────────────────────────────────────────────────
  'shoulders':              { view: 'front', muscleIds: ['deltoid_anterior', 'deltoid_lateral'] },
  'deltoids':               { view: 'front', muscleIds: ['deltoid_anterior', 'deltoid_lateral'] },
  'anterior deltoid':       { view: 'front', muscleIds: ['deltoid_anterior'] },
  'medial deltoid':         { view: 'front', muscleIds: ['deltoid_lateral'] },
  'rear deltoid':           { view: 'back',  muscleIds: ['deltoid_posterior'] },

  // ── Arms ───────────────────────────────────────────────────────────
  'biceps':                 { view: 'front', muscleIds: ['biceps'] },
  'biceps (long head)':     { view: 'front', muscleIds: ['biceps'] },
  'biceps (short head)':    { view: 'front', muscleIds: ['biceps'] },
  'brachialis':             { view: 'front', muscleIds: ['brachialis'] },
  'brachioradialis':        { view: 'front', muscleIds: ['brachioradialis'] },
  'triceps':                { view: 'back',  muscleIds: ['triceps'] },
  'triceps (long head)':    { view: 'back',  muscleIds: ['triceps'] },
  'forearms':               { view: 'front', muscleIds: ['forearms'] },
  'arms':                   { view: 'front', muscleIds: ['biceps', 'forearms'] },

  // ── Back ───────────────────────────────────────────────────────────
  'back':                   { view: 'back',  muscleIds: ['latissimus_dorsi', 'upper_back'] },
  'lats':                   { view: 'back',  muscleIds: ['latissimus_dorsi'] },
  'latissimus dorsi':       { view: 'back',  muscleIds: ['latissimus_dorsi'] },
  'trapezius':              { view: 'back',  muscleIds: ['trapezius'] },
  'traps':                  { view: 'back',  muscleIds: ['trapezius'] },
  'rhomboids':              { view: 'back',  muscleIds: ['rhomboids'] },
  'upper back':             { view: 'back',  muscleIds: ['upper_back'] },
  'erector spinae':         { view: 'back',  muscleIds: ['erector_spinae'] },
  'lower back':             { view: 'back',  muscleIds: ['lower_back'] },
  'rotator cuff':           { view: 'back',  muscleIds: ['rotator_cuff'] },

  // ── Core ───────────────────────────────────────────────────────────
  'core':                   { view: 'front', muscleIds: ['rectus_abdominis', 'obliques'] },
  'abs':                    { view: 'front', muscleIds: ['rectus_abdominis'] },
  'rectus abdominis':       { view: 'front', muscleIds: ['rectus_abdominis'] },
  'obliques':               { view: 'front', muscleIds: ['obliques'] },
  'transverse abdominis':   { view: 'front', muscleIds: ['transverse_abdominis'] },

  // ── Legs ───────────────────────────────────────────────────────────
  'quadriceps':             { view: 'front', muscleIds: ['quadriceps'] },
  'quads':                  { view: 'front', muscleIds: ['quadriceps'] },
  'hamstrings':             { view: 'back',  muscleIds: ['hamstrings'] },
  'glutes':                 { view: 'back',  muscleIds: ['glutes'] },
  'gluteus medius':         { view: 'back',  muscleIds: ['gluteus_medius'] },
  'gluteus minimus':        { view: 'back',  muscleIds: ['gluteus_minimus'] },
  'calves':                 { view: 'back',  muscleIds: ['calves'] },
  'gastrocnemius':          { view: 'back',  muscleIds: ['gastrocnemius'] },
  'soleus':                 { view: 'back',  muscleIds: ['soleus'] },
  'hip flexors':            { view: 'front', muscleIds: ['hip_flexors'] },
  'adductors':              { view: 'front', muscleIds: ['adductors'] },
  'abductors':              { view: 'front', muscleIds: ['abductors'] },
  'piriformis':             { view: 'back',  muscleIds: ['piriformis'] },
  'legs':                   { view: 'front', muscleIds: ['quadriceps', 'adductors'] },
  'hips':                   { view: 'front', muscleIds: ['hip_flexors', 'abductors'] },

  // ── Compound / Broad Categories ────────────────────────────────────
  'full body':              { view: 'front', muscleIds: ['pectoralis_major', 'quadriceps', 'rectus_abdominis'] },
  'diaphragm':              { view: 'front', muscleIds: ['transverse_abdominis'] },
  'neck':                   { view: 'back',  muscleIds: ['trapezius'] },
  'spine':                  { view: 'back',  muscleIds: ['erector_spinae'] },
};

// ── Helpers ─────────────────────────────────────────────────────────

function lookupMuscle(name: string): MuscleMapping | undefined {
  return MUSCLE_NAME_MAP[name.toLowerCase()];
}

/** Resolves an array of muscle name strings into a Set of MuscleIds and a front/back vote tally. */
function resolveMuscles(names: string[]): { muscleIds: Set<MuscleId>; frontCount: number; backCount: number } {
  const muscleIds = new Set<MuscleId>();
  let frontCount = 0;
  let backCount = 0;

  for (const name of names) {
    const mapping = lookupMuscle(name);
    if (!mapping) continue;
    for (const id of mapping.muscleIds) {
      muscleIds.add(id);
    }
    if (mapping.view === 'front') frontCount++;
    else backCount++;
  }

  return { muscleIds, frontCount, backCount };
}

function chooseView(
  variant: 'front' | 'back' | 'auto',
  primaryResult: { frontCount: number; backCount: number },
  secondaryResult: { frontCount: number; backCount: number },
): 'front' | 'back' {
  if (variant !== 'auto') return variant;
  const totalFront = primaryResult.frontCount + secondaryResult.frontCount;
  const totalBack = primaryResult.backCount + secondaryResult.backCount;
  // Bias toward front when tied (front is more recognizable at small sizes)
  return totalBack > totalFront ? 'back' : 'front';
}

// ── Component ───────────────────────────────────────────────────────

function MuscleGroupThumbnailInner({
  muscleGroups,
  secondaryMuscles = [],
  size = 40,
  variant = 'auto',
  style,
}: MuscleGroupThumbnailProps) {
  const { colors } = useTheme();

  const { view, primaryIds, secondaryIds } = useMemo(() => {
    const primaryResult = resolveMuscles(muscleGroups);
    const secondaryResult = resolveMuscles(secondaryMuscles);
    const resolvedView = chooseView(variant, primaryResult, secondaryResult);

    return {
      view: resolvedView,
      primaryIds: primaryResult.muscleIds,
      secondaryIds: secondaryResult.muscleIds,
    };
  }, [muscleGroups, secondaryMuscles, variant]);

  const bodyOutline = view === 'front' ? FRONT_BODY_OUTLINE : BACK_BODY_OUTLINE;
  const muscles = view === 'front' ? FRONT_MUSCLES : BACK_MUSCLES;

  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 200 400"
      style={style as undefined}
    >
      {/* Body silhouette outline */}
      <Path
        d={bodyOutline}
        fill={colors.anatomyDefault}
        fillOpacity={0.35}
        stroke={colors.anatomyOutline}
        strokeWidth={1.5}
        strokeOpacity={0.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Muscle fills */}
      {muscles.map((muscle: MusclePath) => {
        const id = muscle.id as MuscleId;
        const isPrimary = primaryIds.has(id);
        const isSecondary = !isPrimary && secondaryIds.has(id);
        const isHighlighted = isPrimary || isSecondary;

        if (!isHighlighted) return null;

        return (
          <G key={muscle.id}>
            <Path
              d={muscle.d}
              fill={colors.primary}
              fillOpacity={isPrimary ? 0.85 : 0.3}
              stroke={colors.anatomyOutline}
              strokeWidth={isPrimary ? 0.8 : 0.4}
              strokeLinejoin="round"
              strokeOpacity={isPrimary ? 0.6 : 0.25}
            />
          </G>
        );
      })}
    </Svg>
  );
}

export const MuscleGroupThumbnail = React.memo(MuscleGroupThumbnailInner);
