import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../../theme';
import { SkeletonBlock } from '../SkeletonCard';

// ── Helpers ──────────────────────────────────────────────────────────

/** Card wrapper matching the real Card component styling */
function SkeletonCardWrap({ children, style }: { children: React.ReactNode; style?: object }) {
  const { colors, spacing, radius } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          padding: spacing.base,
          borderWidth: 1,
          borderColor: colors.borderLight,
          marginBottom: spacing.base,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// TODAY TAB SKELETON
// ═══════════════════════════════════════════════════════════════════════

export function TodayTabSkeleton() {
  const { spacing, radius } = useTheme();

  return (
    <View style={styles.container}>
      {/* Greeting header */}
      <View style={{ paddingHorizontal: spacing.base, paddingTop: spacing.lg }}>
        <SkeletonBlock width={160} height={14} borderRadius={radius.sm} />
        <SkeletonBlock
          width="70%"
          height={28}
          borderRadius={radius.sm}
          style={{ marginTop: spacing.sm }}
        />
      </View>

      {/* Coaching card */}
      <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.lg }}>
        <SkeletonCardWrap>
          <View style={styles.row}>
            <SkeletonBlock width={28} height={28} borderRadius={radius.md} />
            <SkeletonBlock
              width={140}
              height={12}
              borderRadius={radius.sm}
              style={{ marginLeft: spacing.sm }}
            />
          </View>
          <SkeletonBlock
            width="100%"
            height={14}
            borderRadius={radius.sm}
            style={{ marginTop: spacing.md }}
          />
          <SkeletonBlock
            width="85%"
            height={14}
            borderRadius={radius.sm}
            style={{ marginTop: spacing.sm }}
          />
        </SkeletonCardWrap>
      </View>

      {/* Quick action row */}
      <View style={[styles.row, { paddingHorizontal: spacing.base, marginTop: spacing.sm, gap: spacing.sm }]}>
        <SkeletonBlock width={80} height={36} borderRadius={radius.full} style={{ flex: 1 }} />
        <SkeletonBlock width={80} height={36} borderRadius={radius.full} style={{ flex: 1 }} />
        <SkeletonBlock width={80} height={36} borderRadius={radius.full} style={{ flex: 1 }} />
      </View>

      {/* Stats row — 3 small cards */}
      <View style={[styles.row, { paddingHorizontal: spacing.base, marginTop: spacing.lg, gap: spacing.sm }]}>
        {[0, 1, 2].map((i) => (
          <SkeletonCardWrap key={i} style={{ flex: 1, marginBottom: 0, padding: spacing.md }}>
            <SkeletonBlock width={32} height={24} borderRadius={radius.sm} />
            <SkeletonBlock
              width="60%"
              height={10}
              borderRadius={radius.sm}
              style={{ marginTop: spacing.xs }}
            />
          </SkeletonCardWrap>
        ))}
      </View>

      {/* Workout card */}
      <View style={{ paddingHorizontal: spacing.base, marginTop: spacing.base }}>
        <SkeletonCardWrap>
          <View style={styles.row}>
            <SkeletonBlock width={20} height={20} borderRadius={radius.sm} />
            <SkeletonBlock
              width={120}
              height={14}
              borderRadius={radius.sm}
              style={{ marginLeft: spacing.sm }}
            />
          </View>
          <SkeletonBlock
            width="90%"
            height={12}
            borderRadius={radius.sm}
            style={{ marginTop: spacing.md }}
          />
          <SkeletonBlock
            width="100%"
            height={40}
            borderRadius={radius.md}
            style={{ marginTop: spacing.md }}
          />
        </SkeletonCardWrap>
      </View>

      {/* Nutrition card */}
      <View style={{ paddingHorizontal: spacing.base }}>
        <SkeletonCardWrap>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <SkeletonBlock width={100} height={14} borderRadius={radius.sm} />
            <SkeletonBlock width={60} height={14} borderRadius={radius.sm} />
          </View>
          <View style={[styles.row, { marginTop: spacing.md, gap: spacing.md }]}>
            <SkeletonBlock width={48} height={48} borderRadius={24} />
            <SkeletonBlock width={48} height={48} borderRadius={24} />
            <SkeletonBlock width={48} height={48} borderRadius={24} />
          </View>
        </SkeletonCardWrap>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// WORKOUT TAB SKELETON
// ═══════════════════════════════════════════════════════════════════════

export function WorkoutTabSkeleton() {
  const { spacing, radius } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal: spacing.base }]}>
      {/* Header */}
      <View style={[styles.row, { justifyContent: 'space-between', paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <SkeletonBlock width={120} height={28} borderRadius={radius.sm} />
        <SkeletonBlock width={22} height={22} borderRadius={11} />
      </View>

      {/* Today's workout card */}
      <SkeletonCardWrap>
        <View style={styles.row}>
          <SkeletonBlock width={20} height={20} borderRadius={radius.sm} />
          <SkeletonBlock
            width={130}
            height={14}
            borderRadius={radius.sm}
            style={{ marginLeft: spacing.sm }}
          />
        </View>
        <SkeletonBlock
          width="80%"
          height={12}
          borderRadius={radius.sm}
          style={{ marginTop: spacing.md }}
        />
        {/* Exercise list preview */}
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.row, { marginTop: spacing.sm }]}>
            <SkeletonBlock width={14} height={14} borderRadius={7} />
            <SkeletonBlock
              width={`${70 - i * 10}%`}
              height={12}
              borderRadius={radius.sm}
              style={{ marginLeft: spacing.xs }}
            />
          </View>
        ))}
        <SkeletonBlock
          width="100%"
          height={40}
          borderRadius={radius.md}
          style={{ marginTop: spacing.md }}
        />
      </SkeletonCardWrap>

      {/* Program card */}
      <SkeletonCardWrap>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <SkeletonBlock width={100} height={14} borderRadius={radius.sm} />
          <SkeletonBlock width={60} height={20} borderRadius={radius.sm} />
        </View>
        <SkeletonBlock
          width="100%"
          height={6}
          borderRadius={3}
          style={{ marginTop: spacing.md }}
        />
        <SkeletonBlock
          width="50%"
          height={10}
          borderRadius={radius.sm}
          style={{ marginTop: spacing.sm }}
        />
      </SkeletonCardWrap>

      {/* Milestones row — 3 circular placeholders */}
      <View style={[styles.row, { gap: spacing.md, marginBottom: spacing.base }]}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ alignItems: 'center', flex: 1 }}>
            <SkeletonBlock width={56} height={56} borderRadius={28} />
            <SkeletonBlock
              width={48}
              height={10}
              borderRadius={radius.sm}
              style={{ marginTop: spacing.xs }}
            />
          </View>
        ))}
      </View>

      {/* Weekly volume chart */}
      <SkeletonCardWrap>
        <SkeletonBlock width={120} height={14} borderRadius={radius.sm} />
        <View style={[styles.row, { marginTop: spacing.md, gap: spacing.sm, alignItems: 'flex-end', height: 80 }]}>
          {[40, 60, 30, 70, 50, 20, 55].map((h, i) => (
            <SkeletonBlock key={i} width={0} height={h} borderRadius={radius.sm} style={{ flex: 1 }} />
          ))}
        </View>
      </SkeletonCardWrap>

      {/* Recent workouts list */}
      {[0, 1, 2].map((i) => (
        <SkeletonCardWrap key={i}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <SkeletonBlock width="70%" height={14} borderRadius={radius.sm} />
              <SkeletonBlock
                width="45%"
                height={10}
                borderRadius={radius.sm}
                style={{ marginTop: spacing.xs }}
              />
            </View>
            <SkeletonBlock width={60} height={10} borderRadius={radius.sm} />
          </View>
        </SkeletonCardWrap>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// NUTRITION TAB SKELETON
// ═══════════════════════════════════════════════════════════════════════

export function NutritionTabSkeleton() {
  const { spacing, radius } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal: spacing.base }]}>
      {/* Header */}
      <View style={[styles.row, { justifyContent: 'space-between', paddingTop: spacing.base, paddingBottom: spacing.md }]}>
        <SkeletonBlock width={120} height={28} borderRadius={radius.sm} />
        <View style={[styles.row, { gap: spacing.sm }]}>
          <SkeletonBlock width={22} height={22} borderRadius={11} />
          <SkeletonBlock width={22} height={22} borderRadius={11} />
        </View>
      </View>

      {/* Date selector */}
      <View style={[styles.row, { justifyContent: 'center', gap: spacing.lg, marginBottom: spacing.base }]}>
        <SkeletonBlock width={24} height={24} borderRadius={12} />
        <SkeletonBlock width={120} height={16} borderRadius={radius.sm} />
        <SkeletonBlock width={24} height={24} borderRadius={12} />
      </View>

      {/* Calorie ring + macros card */}
      <SkeletonCardWrap>
        {/* Ring */}
        <View style={{ alignItems: 'center' }}>
          <SkeletonBlock width={160} height={160} borderRadius={80} />
          <SkeletonBlock
            width={100}
            height={12}
            borderRadius={radius.sm}
            style={{ marginTop: spacing.sm }}
          />
        </View>

        {/* Macro bars */}
        <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i}>
              <View style={[styles.row, { justifyContent: 'space-between', marginBottom: spacing.xs }]}>
                <SkeletonBlock width={60} height={12} borderRadius={radius.sm} />
                <SkeletonBlock width={80} height={12} borderRadius={radius.sm} />
              </View>
              <SkeletonBlock width="100%" height={8} borderRadius={4} />
            </View>
          ))}
        </View>
      </SkeletonCardWrap>

      {/* Water tracker card */}
      <SkeletonCardWrap>
        <View style={[styles.row, { justifyContent: 'space-between' }]}>
          <View style={[styles.row, { gap: spacing.sm }]}>
            <SkeletonBlock width={20} height={20} borderRadius={10} />
            <SkeletonBlock width={80} height={14} borderRadius={radius.sm} />
          </View>
          <SkeletonBlock width={80} height={12} borderRadius={radius.sm} />
        </View>
        <View style={{ alignItems: 'center', marginTop: spacing.md }}>
          <SkeletonBlock width={100} height={100} borderRadius={50} />
        </View>
        <View style={[styles.row, { justifyContent: 'center', gap: spacing.md, marginTop: spacing.md }]}>
          <SkeletonBlock width={70} height={32} borderRadius={radius.md} />
          <SkeletonBlock width={70} height={32} borderRadius={radius.md} />
        </View>
      </SkeletonCardWrap>

      {/* Meals list */}
      {[0, 1, 2].map((i) => (
        <SkeletonCardWrap key={i}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <View style={[styles.row, { gap: spacing.sm, flex: 1 }]}>
              <SkeletonBlock width={36} height={36} borderRadius={18} />
              <View style={{ flex: 1 }}>
                <SkeletonBlock width="60%" height={14} borderRadius={radius.sm} />
                <SkeletonBlock
                  width="40%"
                  height={10}
                  borderRadius={radius.sm}
                  style={{ marginTop: spacing.xs }}
                />
              </View>
            </View>
            <SkeletonBlock width={50} height={14} borderRadius={radius.sm} />
          </View>
        </SkeletonCardWrap>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// PROGRESS TAB SKELETON
// ═══════════════════════════════════════════════════════════════════════

export function ProgressTabSkeleton() {
  const { spacing, radius } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal: spacing.base }]}>
      {/* Header */}
      <View style={[styles.row, { justifyContent: 'space-between', paddingTop: spacing.base, paddingBottom: spacing.lg }]}>
        <SkeletonBlock width={120} height={28} borderRadius={radius.sm} />
        <SkeletonBlock width={22} height={22} borderRadius={11} />
      </View>

      {/* Date range selector */}
      <View style={[styles.row, { gap: spacing.sm, marginBottom: spacing.base }]}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonBlock
            key={i}
            width={0}
            height={32}
            borderRadius={radius.md}
            style={{ flex: 1 }}
          />
        ))}
      </View>

      {/* Stats grid — 2×2 */}
      <View style={{ gap: spacing.sm }}>
        <View style={[styles.row, { gap: spacing.sm }]}>
          {[0, 1].map((i) => (
            <SkeletonCardWrap key={i} style={{ flex: 1, marginBottom: 0 }}>
              <SkeletonBlock width="50%" height={10} borderRadius={radius.sm} />
              <SkeletonBlock
                width={64}
                height={24}
                borderRadius={radius.sm}
                style={{ marginTop: spacing.sm }}
              />
              <SkeletonBlock
                width="40%"
                height={10}
                borderRadius={radius.sm}
                style={{ marginTop: spacing.xs }}
              />
            </SkeletonCardWrap>
          ))}
        </View>
        <View style={[styles.row, { gap: spacing.sm, marginBottom: spacing.base }]}>
          {[0, 1].map((i) => (
            <SkeletonCardWrap key={i} style={{ flex: 1, marginBottom: 0 }}>
              <SkeletonBlock width="50%" height={10} borderRadius={radius.sm} />
              <SkeletonBlock
                width={64}
                height={24}
                borderRadius={radius.sm}
                style={{ marginTop: spacing.sm }}
              />
              <SkeletonBlock
                width="40%"
                height={10}
                borderRadius={radius.sm}
                style={{ marginTop: spacing.xs }}
              />
            </SkeletonCardWrap>
          ))}
        </View>
      </View>

      {/* Chart skeleton — wide rectangle */}
      <SkeletonCardWrap>
        <SkeletonBlock width={140} height={14} borderRadius={radius.sm} />
        <SkeletonBlock
          width="100%"
          height={160}
          borderRadius={radius.md}
          style={{ marginTop: spacing.md }}
        />
      </SkeletonCardWrap>

      {/* Achievements row */}
      <SkeletonCardWrap>
        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: spacing.md }]}>
          <SkeletonBlock width={110} height={14} borderRadius={radius.sm} />
          <SkeletonBlock width={60} height={12} borderRadius={radius.sm} />
        </View>
        <View style={[styles.row, { gap: spacing.md }]}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ alignItems: 'center', flex: 1 }}>
              <SkeletonBlock width={44} height={44} borderRadius={22} />
              <SkeletonBlock
                width={36}
                height={8}
                borderRadius={radius.sm}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          ))}
        </View>
      </SkeletonCardWrap>

      {/* Recent PRs list */}
      <SkeletonCardWrap>
        <SkeletonBlock width={100} height={14} borderRadius={radius.sm} style={{ marginBottom: spacing.md }} />
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.row, { justifyContent: 'space-between', marginTop: i > 0 ? spacing.sm : 0 }]}>
            <View style={[styles.row, { gap: spacing.sm, flex: 1 }]}>
              <SkeletonBlock width={32} height={32} borderRadius={radius.sm} />
              <View style={{ flex: 1 }}>
                <SkeletonBlock width="65%" height={12} borderRadius={radius.sm} />
                <SkeletonBlock
                  width="40%"
                  height={10}
                  borderRadius={radius.sm}
                  style={{ marginTop: spacing.xs }}
                />
              </View>
            </View>
            <SkeletonBlock width={50} height={12} borderRadius={radius.sm} />
          </View>
        ))}
      </SkeletonCardWrap>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COMPETE TAB SKELETON
// ═══════════════════════════════════════════════════════════════════════

export function CompeteTabSkeleton() {
  const { spacing, radius } = useTheme();

  return (
    <View style={[styles.container, { paddingHorizontal: spacing.base }]}>
      {/* Header */}
      <View style={[styles.row, { justifyContent: 'space-between', paddingTop: spacing.sm, paddingBottom: spacing.md }]}>
        <SkeletonBlock width={120} height={28} borderRadius={radius.sm} />
        <SkeletonBlock width={80} height={32} borderRadius={radius.md} />
      </View>

      {/* Leaderboard card */}
      <SkeletonCardWrap>
        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: spacing.md }]}>
          <SkeletonBlock width={100} height={14} borderRadius={radius.sm} />
          <SkeletonBlock width={80} height={24} borderRadius={radius.md} />
        </View>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.row, { gap: spacing.sm, marginTop: i > 0 ? spacing.sm : 0 }]}>
            <SkeletonBlock width={24} height={24} borderRadius={12} />
            <SkeletonBlock width={32} height={32} borderRadius={16} />
            <SkeletonBlock width="40%" height={12} borderRadius={radius.sm} />
            <View style={{ flex: 1 }} />
            <SkeletonBlock width={50} height={12} borderRadius={radius.sm} />
          </View>
        ))}
      </SkeletonCardWrap>

      {/* Challenges card */}
      <SkeletonCardWrap>
        <SkeletonBlock width={130} height={14} borderRadius={radius.sm} />
        <SkeletonBlock
          width="100%"
          height={60}
          borderRadius={radius.md}
          style={{ marginTop: spacing.md }}
        />
      </SkeletonCardWrap>

      {/* Friends card */}
      <SkeletonCardWrap>
        <SkeletonBlock width={100} height={14} borderRadius={radius.sm} />
        <View style={[styles.row, { gap: spacing.md, marginTop: spacing.md }]}>
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBlock key={i} width={40} height={40} borderRadius={20} />
          ))}
        </View>
      </SkeletonCardWrap>

      {/* Activity feed card */}
      <SkeletonCardWrap>
        <SkeletonBlock width={120} height={14} borderRadius={radius.sm} />
        {[0, 1].map((i) => (
          <View key={i} style={[styles.row, { gap: spacing.sm, marginTop: spacing.md }]}>
            <SkeletonBlock width={36} height={36} borderRadius={18} />
            <View style={{ flex: 1 }}>
              <SkeletonBlock width="70%" height={12} borderRadius={radius.sm} />
              <SkeletonBlock
                width="45%"
                height={10}
                borderRadius={radius.sm}
                style={{ marginTop: spacing.xs }}
              />
            </View>
          </View>
        ))}
      </SkeletonCardWrap>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// COACH TAB SKELETON
// ═══════════════════════════════════════════════════════════════════════

export function CoachTabSkeleton() {
  const { spacing, radius } = useTheme();

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View
        style={[
          styles.row,
          {
            justifyContent: 'space-between',
            paddingHorizontal: spacing.base,
            paddingTop: spacing.base,
            paddingBottom: spacing.md,
          },
        ]}
      >
        <View style={[styles.row, { gap: spacing.sm }]}>
          <SkeletonBlock width={36} height={36} borderRadius={18} />
          <View>
            <SkeletonBlock width={80} height={14} borderRadius={radius.sm} />
            <SkeletonBlock
              width={50}
              height={10}
              borderRadius={radius.sm}
              style={{ marginTop: spacing.xs }}
            />
          </View>
        </View>
        <View style={[styles.row, { gap: spacing.sm }]}>
          <SkeletonBlock width={22} height={22} borderRadius={11} />
          <SkeletonBlock width={26} height={26} borderRadius={13} />
        </View>
      </View>

      {/* Message bubbles */}
      <View style={{ flex: 1, paddingHorizontal: spacing.base, paddingTop: spacing.lg, gap: spacing.lg }}>
        {/* Assistant message (left-aligned) */}
        <View style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
          <SkeletonBlock width={220} height={60} borderRadius={radius.lg} />
        </View>

        {/* User message (right-aligned) */}
        <View style={{ alignSelf: 'flex-end', maxWidth: '70%' }}>
          <SkeletonBlock width={160} height={44} borderRadius={radius.lg} />
        </View>

        {/* Assistant message */}
        <View style={{ alignSelf: 'flex-start', maxWidth: '80%' }}>
          <SkeletonBlock width={260} height={80} borderRadius={radius.lg} />
        </View>
      </View>

      {/* Input bar */}
      <View
        style={[
          styles.row,
          {
            paddingHorizontal: spacing.base,
            paddingVertical: spacing.md,
            gap: spacing.sm,
          },
        ]}
      >
        <SkeletonBlock width={40} height={40} borderRadius={20} />
        <SkeletonBlock width={0} height={40} borderRadius={radius.lg} style={{ flex: 1 }} />
        <SkeletonBlock width={40} height={40} borderRadius={20} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
