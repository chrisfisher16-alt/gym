import { Image } from 'expo-image';
import { getExerciseImages } from './exercise-image-map';

/**
 * Preload exercise images for a set of exercise IDs.
 * Called when a workout starts to cache images for the session.
 */
export async function preloadExerciseImages(exerciseIds: string[]): Promise<void> {
  const urls: string[] = [];

  for (const id of exerciseIds) {
    const images = getExerciseImages(id);
    if (!images) continue;
    urls.push(images.startPosition, images.endPosition);
  }

  if (urls.length === 0) return;

  // Prefetch in batches of 10 to avoid overwhelming the network
  const batchSize = 10;
  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    await Promise.allSettled(batch.map(url => Image.prefetch(url)));
  }
}
