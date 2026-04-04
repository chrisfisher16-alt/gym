'use widget';

import { Text, HStack, VStack, Spacer, ProgressView } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, padding, monospacedDigit } from '@expo/ui/swift-ui/modifiers';
import type { LiveActivityLayout } from 'expo-widgets';
import type { LiveActivityEnvironment } from 'expo-widgets/build/Widgets.types';

export interface WorkoutActivityProps {
  exerciseName: string;
  setProgress: string;
  exerciseProgress: string;
  targetWeight: number;
  targetReps: number;
  unit: string;
  isResting: boolean;
  restSecondsRemaining: number;
  elapsedMinutes: number;
}

export default function WorkoutLiveActivity(
  props: WorkoutActivityProps,
  _env: LiveActivityEnvironment,
): LiveActivityLayout {
  const {
    exerciseName,
    setProgress,
    exerciseProgress,
    targetWeight,
    targetReps,
    unit,
    isResting,
    restSecondsRemaining,
    elapsedMinutes,
  } = props;

  const restMinutes = Math.floor(restSecondsRemaining / 60);
  const restSeconds = restSecondsRemaining % 60;
  const restTimeStr = `${restMinutes}:${restSeconds.toString().padStart(2, '0')}`;

  const loadStr =
    targetWeight > 0 ? `${targetWeight} ${unit} × ${targetReps}` : `${targetReps} reps`;

  return {
    // ── Lock Screen / Notification Center banner ───────────────────
    banner: (
      <VStack spacing={8} modifiers={[padding({ all: 16 })]}>
        <HStack spacing={4}>
          <Text modifiers={[font({ weight: 'semibold', size: 16 }), foregroundStyle('#FFFFFF')]}>
            {isResting ? '⏱️ Rest' : '🏋️ ' + exerciseName}
          </Text>
          <Spacer />
          <Text
            modifiers={[
              font({ size: 13 }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            ]}
          >
            {elapsedMinutes} min
          </Text>
        </HStack>

        {isResting ? (
          <HStack spacing={4}>
            <Text modifiers={[font({ weight: 'bold', size: 28 }), monospacedDigit()]}>
              {restTimeStr}
            </Text>
            <Spacer />
            <VStack alignment="trailing" spacing={2}>
              <Text
                modifiers={[
                  font({ size: 13 }),
                  foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
                ]}
              >
                Next: {exerciseName}
              </Text>
              <Text modifiers={[font({ size: 13 }), foregroundStyle('#0891B2')]}>{loadStr}</Text>
            </VStack>
          </HStack>
        ) : (
          <HStack spacing={4}>
            <Text modifiers={[font({ weight: 'medium', size: 15 }), foregroundStyle('#0891B2')]}>
              {loadStr}
            </Text>
            <Spacer />
            <Text modifiers={[font({ size: 13 }), foregroundStyle('#FFFFFF')]}>{setProgress}</Text>
          </HStack>
        )}

        <HStack spacing={4}>
          <Text
            modifiers={[
              font({ size: 12 }),
              foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
            ]}
          >
            {exerciseProgress} exercises
          </Text>
          <Spacer />
        </HStack>
      </VStack>
    ),

    // ── Dynamic Island: Compact ────────────────────────────────────
    compactLeading: (
      <Text modifiers={[font({ weight: 'semibold', size: 14 })]}>
        {isResting ? '⏱️' : '🏋️'}
      </Text>
    ),

    compactTrailing: (
      <Text modifiers={[font({ size: 13 }), monospacedDigit()]}>
        {isResting ? restTimeStr : setProgress}
      </Text>
    ),

    // ── Dynamic Island: Minimal ────────────────────────────────────
    minimal: (
      <Text modifiers={[font({ size: 13 })]}>
        {isResting ? '⏱️' : '🏋️'}
      </Text>
    ),

    // ── Dynamic Island: Expanded ───────────────────────────────────
    expandedLeading: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ weight: 'semibold', size: 15 })]}>
          {isResting ? 'Rest' : exerciseName}
        </Text>
        <Text
          modifiers={[
            font({ size: 12 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
          ]}
        >
          {exerciseProgress} exercises
        </Text>
      </VStack>
    ),

    expandedTrailing: (
      <VStack alignment="trailing" spacing={2}>
        <Text modifiers={[font({ weight: 'medium', size: 15 }), monospacedDigit()]}>
          {isResting ? restTimeStr : setProgress}
        </Text>
        <Text
          modifiers={[
            font({ size: 12 }),
            foregroundStyle({ type: 'hierarchical', style: 'secondary' }),
          ]}
        >
          {elapsedMinutes} min
        </Text>
      </VStack>
    ),

    expandedBottom: isResting ? (
      <HStack spacing={4} modifiers={[padding({ top: 4 })]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#0891B2')]}>
          Next: {exerciseName} · {loadStr}
        </Text>
      </HStack>
    ) : (
      <HStack spacing={4} modifiers={[padding({ top: 4 })]}>
        <Text modifiers={[font({ size: 13 }), foregroundStyle('#0891B2')]}>{loadStr}</Text>
      </HStack>
    ),
  };
}
