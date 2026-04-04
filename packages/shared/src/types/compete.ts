// Competition & Challenge types

export type ChallengeMetric = 'volume' | 'workouts' | 'streak' | 'prs' | 'consistency';
export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'cancelled';
export type ParticipantStatus = 'invited' | 'accepted' | 'declined';

export interface Challenge {
  id: string;
  creatorId: string;
  title: string;
  metric: ChallengeMetric;
  startsAt: string;
  endsAt: string;
  status: ChallengeStatus;
  createdAt: string;
}

export interface ChallengeParticipant {
  id: string;
  challengeId: string;
  userId: string;
  status: ParticipantStatus;
  score: number;
  joinedAt: string | null;
}

export interface ChallengeWithParticipants extends Challenge {
  participants: (ChallengeParticipant & {
    displayName: string;
    avatarUrl: string | null;
  })[];
}

export interface InviteLink {
  id: string;
  inviterId: string;
  code: string;
  expiresAt: string | null;
  redeemedBy: string | null;
  redeemedAt: string | null;
  createdAt: string;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  score: number;
  rank: number;
}
