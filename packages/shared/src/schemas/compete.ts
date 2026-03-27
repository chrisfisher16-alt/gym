import { z } from 'zod';

export const challengeMetricSchema = z.enum(['volume', 'workouts', 'streak', 'prs', 'consistency']);
export const challengeStatusSchema = z.enum(['pending', 'active', 'completed', 'cancelled']);
export const participantStatusSchema = z.enum(['invited', 'accepted', 'declined']);

export const createChallengeSchema = z.object({
  title: z.string().min(1).max(100),
  metric: challengeMetricSchema,
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  participantIds: z.array(z.string().uuid()).min(1).max(20),
});

export const updateParticipantSchema = z.object({
  status: z.enum(['accepted', 'declined']),
});

export type CreateChallengeInput = z.infer<typeof createChallengeSchema>;
export type UpdateParticipantInput = z.infer<typeof updateParticipantSchema>;
