import React from 'react';
import type { ActiveSet, ActiveExercise } from '../../types/workout';
import { resolveTrackingMode } from '../../lib/tracking-mode-utils';
import { getWeightLabel } from '../../lib/weight-label';
import { useProfileStore } from '../../stores/profile-store';
import { SetRow } from './SetRow';
import { BodyweightSetRow } from './BodyweightSetRow';
import { TimedSetRow } from './TimedSetRow';
import { RepsOnlySetRow } from './RepsOnlySetRow';
import { CardioSetRow } from './CardioSetRow';
import { DistanceWeightSetRow } from './DistanceWeightSetRow';

export interface SetRowFactoryProps {
  set: ActiveSet;
  exercise: ActiveExercise;
  exerciseInstanceId: string;
  setIndex: number;
  previousData?: string;
  onLog: (setId: string, weight: number, reps: number) => void;
  onLogDuration: (setId: string, durationSeconds: number) => void;
  onLogCardio: (setId: string, data: {
    durationSeconds: number;
    distance?: number;
    distanceUnit?: string;
    incline?: number;
    speed?: number;
    speedUnit?: string;
    level?: number;
    calories?: number;
    resistance?: number;
  }) => void;
  onComplete: (setId: string) => void;
  onRemove: (setId: string) => void;
  onRPE: (setId: string, rpe: number) => void;
  onWeightCascade?: (setIndex: number, weight: number, reps: number) => void;
  equipmentType?: string;
}

export function SetRowFactory({
  set,
  exercise,
  exerciseInstanceId,
  setIndex,
  previousData,
  onLog,
  onLogDuration,
  onLogCardio,
  onComplete,
  onRemove,
  onRPE,
  onWeightCascade,
  equipmentType,
}: SetRowFactoryProps) {
  const unitPreference = useProfileStore((s) => s.profile.unitPreference);
  const userUnit = unitPreference === 'metric' ? 'kg' : 'lbs' as const;
  const weightLabel = getWeightLabel(exercise.weightContext, userUnit);
  const trackingMode = resolveTrackingMode(exercise);

  switch (trackingMode) {
    case 'weight_reps':
      return (
        <SetRow
          set={set}
          exerciseInstanceId={exerciseInstanceId}
          setIndex={setIndex}
          previousData={previousData}
          onLog={onLog}
          onComplete={onComplete}
          onRemove={onRemove}
          onRPE={onRPE}
          onWeightCascade={onWeightCascade}
          equipmentType={equipmentType}
          weightLabel={weightLabel}
        />
      );

    case 'bodyweight_reps':
      return (
        <BodyweightSetRow
          set={set}
          exerciseInstanceId={exerciseInstanceId}
          onLog={onLog}
          onComplete={onComplete}
          onRemove={onRemove}
          onRPE={onRPE}
          weightContext={exercise.weightContext}
        />
      );

    case 'duration':
      return (
        <TimedSetRow
          set={set}
          exerciseInstanceId={exerciseInstanceId}
          defaultDuration={exercise.defaultDurationSeconds ?? 60}
          onLogDuration={onLogDuration}
          onComplete={onComplete}
        />
      );

    case 'reps_only':
      return (
        <RepsOnlySetRow
          set={set}
          exerciseInstanceId={exerciseInstanceId}
          onLog={onLog}
          onComplete={onComplete}
          onRemove={onRemove}
        />
      );

    case 'duration_distance':
    case 'duration_level':
      return (
        <CardioSetRow
          set={set}
          exerciseInstanceId={exerciseInstanceId}
          defaultDuration={exercise.defaultDurationSeconds ?? 60}
          secondaryMetrics={exercise.secondaryMetrics}
          onLogCardio={onLogCardio}
          onComplete={onComplete}
        />
      );

    case 'distance_weight': {
      const distanceMetric = exercise.secondaryMetrics?.find((m) => m.type === 'distance');
      return (
        <DistanceWeightSetRow
          set={set}
          exerciseInstanceId={exerciseInstanceId}
          onLog={onLog}
          onComplete={onComplete}
          onRemove={onRemove}
          weightLabel={weightLabel}
          distanceMetric={distanceMetric}
        />
      );
    }

    default:
      return (
        <SetRow
          set={set}
          exerciseInstanceId={exerciseInstanceId}
          setIndex={setIndex}
          previousData={previousData}
          onLog={onLog}
          onComplete={onComplete}
          onRemove={onRemove}
          onRPE={onRPE}
          onWeightCascade={onWeightCascade}
          equipmentType={equipmentType}
        />
      );
  }
}
