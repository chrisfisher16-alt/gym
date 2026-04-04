# S9: Tab Bar Assessment

## Current Configuration

| Position | Label | Icon | Route |
|----------|-------|------|-------|
| 1 (left) | Today | `today-outline` | `index` |
| 2 | Workout | `barbell-outline` | `workout` |
| 3 (center) | Nutrition | `nutrition-outline` | `nutrition` |
| 4 | Coach | `chatbubble-ellipses-outline` | `coach` |
| 5 (right) | Progress | `trending-up-outline` | `progress` |

**Visual specs:** Height 56px, bottom padding 4px, font size 11px weight 500, top border 1px `borderLight`. Active color: `colors.primary` (cyan). Inactive: `colors.tabBarInactive`.

---

## Analysis

### Tab Count: 5

At the upper limit of Apple HIG recommendation (3-5). Functional but leaves no room for growth without restructuring.

### Icon Distinctiveness

All icons have different silhouettes -- calendar, barbell, apple, chat bubble, trend line. The weakest is `trending-up-outline` which is generic for "Progress." Consider a trophy or chart icon instead.

### Label Clarity

"Today", "Workout", "Nutrition", "Coach" are all clear. "Progress" is somewhat ambiguous (progress toward what?) but acceptable in context.

### Tab Order

Current order optimized for: Daily dashboard (leftmost = default landing) -> Action (workout, nutrition) -> Support (coach, progress).

**Usage frequency estimate:**
1. Nutrition -- used 3-5x daily for meal logging
2. Workout -- used 1x daily on training days
3. Today -- checked 1-2x daily
4. Progress -- checked weekly
5. Coach -- episodic

**Potential reorder:** Today -> Nutrition -> Workout -> Progress -> Coach. This places the most frequently accessed tabs (Nutrition, Workout) in positions 2-3 where thumb reach is easiest. However, the current order follows a logical day-flow (plan -> train -> eat -> review -> reflect) which is arguably more intuitive.

### Missing Features

| Feature | Status | Impact |
|---------|--------|--------|
| Badge/notification indicators | None on any tab | Users miss: active workout in progress, unread coach responses, pending weekly check-in |
| Re-tap to scroll top | Not implemented | Standard iOS pattern missing |
| Haptic on tab switch | None | Low impact but adds polish |
| Long-press menu | None | Could expose quick actions per tab |

### Merge/Separate Candidates

**Coach -> FAB overlay:** The `CoachFAB` component already exists on Today, Workout, and Nutrition tabs. The Coach tab is just a chat screen. Converting Coach from a tab to a full-screen overlay (triggered by FAB from any tab) would free a tab slot and make AI coaching contextually accessible everywhere.

**Today + Progress merge:** Today already shows streaks, workout summary, and nutrition snapshot. Progress analytics could become a sub-view or section within Today, with a "View Detailed Progress" drill-down. This would reduce to 4 tabs.

### Competitor Comparison

| App | Tabs | Notable Differences |
|-----|------|-------------------|
| Hevy | 5 | Center tab is "Start Workout" (primary action) |
| Strong | 3 | Minimal: Exercises / History / Profile |
| MacroFactor | 4 | Dashboard / Log / Trends / More |
| MyFitnessPal | 5 | Center is "+" FAB (primary action) |
| Whoop | 4-5 | Overview / Coaching / Strain / Recovery |

FormIQ is the only app without a Profile/Settings tab -- settings is accessed via the Today tab header avatar. This is non-standard but acceptable if users can find it.

FormIQ is also the only app placing AI chat as a dedicated tab rather than an overlay or "More" menu item.

---

## Recommendations

| # | Change | Rationale |
|---|--------|-----------|
| 1 | Add badge indicators (active workout on Workout tab, pending check-in on Today) | Standard UX pattern, improves awareness |
| 2 | Implement scroll-to-top on tab re-tap | Expected iOS behavior |
| 3 | Consider converting Coach from tab to full-screen overlay via FAB | Frees a tab slot, makes AI contextual everywhere |
| 4 | If Coach becomes overlay, add Settings/Profile as the 5th tab | Resolves discoverability of settings |

*S9 complete.*
