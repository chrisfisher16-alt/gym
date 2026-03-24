# S4: Data Density Assessment

## Per-Tab Density

### Today Tab (644 lines) -- HIGH

**Above fold (3 sections):** Header/greeting, AI daily coaching card, Today's workout card

**Below fold (5 sections):** Nutrition snapshot (3 rings + buttons + supplement pills), Streaks strip (3 stats), AI Insights (2 dismissable tips), Weekly Check-In (conditional), Quick Actions grid

**Action/Passive ratio:** 40% actionable / 60% informational

**Verdict:** Bordering on overwhelming. 8 sections render simultaneously with variable visibility based on state (demo mode, tier, day of week, time of day). Visual hierarchy is strong at top (gradient hero + coaching card + workout CTA) but weakens below as sections compete for attention.

**Collapsible candidates:** Weekly Check-In (already conditional), AI Insights (already dismissable), Streaks strip (could hide when streak=0)

### Workout Tab (595 lines) -- MEDIUM-HIGH

**Above fold (3 sections):** Header + in-progress badge, Upgrade Banner (free tier), Today's Workout card

**Below fold (7 sections):** Active Program Progress bar, Quick Start (Empty + AI), Programs/Exercises nav grid, Weekly Volume chart, Milestones, Inactive programs list, Recent Workouts

**Action/Passive ratio:** 55% actionable / 45% informational

**Verdict:** Well-structured with clear primary action at top. The "Choose a Program" section is only relevant before program selection -- could be hidden or collapsed after.

### Nutrition Tab (816 lines) -- HIGHEST

**Above fold (4 sections):** Header + gear, Upgrade Banner, Date selector, Calorie ring (160px) + 4 macro bars

**Below fold (7+ sections):** Hydration tracker (ring + stats + 3 quick-add buttons + custom modal), Today's Meals list, Supplements section (collapsible), Quick Links grid (4 cards), Log Meal FAB, InNutritionCoach, CoachFAB

**Action/Passive ratio:** 50/50

**Verdict:** The most feature-dense tab. The calorie ring dominates vertically, pushing all other content below fold. Hydration, meals, supplements, and quick links all compete for space. The tab tries to be both a dashboard and a data entry surface simultaneously.

**Competitor comparison:** MacroFactor solves this by using sub-tabs (overview vs. food log). MyFitnessPal uses a diary-style vertical list. FormIQ tries to show everything at once.

### Progress Tab (1,257 lines) -- EXTREME

**Above fold (3 sections):** Header, Date range selector (Week/Month/3M/Year), Stats overview (3 cards)

**Below fold (10+ sections):** Achievements (horizontal scroll), Monthly Volume Comparison, Weekly Volume chart, Workout Frequency chart, Muscle Group Balance bars, Nutrition Adherence dots, Strength Progress (exercise selector + PR history), Best PRs list, Body Measurements, Health Data

**Action/Passive ratio:** 15% actionable / 85% informational

**Verdict:** Critically over-dense. The user must scroll through 10+ chart sections linearly. All sections have equal visual weight, creating a wall of charts with no clear hierarchy below the header.

**Competitor comparison:** Whoop shows 3 key numbers at top, then progressive disclosure (tap to expand -> charts -> AI insights). MacroFactor uses separate sub-tabs for nutrition trends vs. weight trends. FormIQ dumps everything into one scroll.

### Coach Tab (381 lines) -- APPROPRIATE

**Above fold (2 sections):** Header (avatar + status + usage counter), Empty state/message list + suggested prompts

**Below fold (2 sections):** Error banner (conditional), Input area

**Action/Passive ratio:** 70% actionable / 30% informational

**Verdict:** Well-calibrated. Chat interfaces self-regulate density through conversation flow.

---

## Summary Table

| Tab | Lines | Sections | Density | Primary Issue |
|-----|-------|----------|---------|---------------|
| Today | 644 | 8 | High | Sections compete below the fold |
| Workout | 595 | 10 | Medium-High | "Choose a Program" irrelevant after selection |
| Nutrition | 816 | 11+ | Highest | Dashboard + data entry in one scroll |
| Progress | 1,257 | 13+ | Extreme | Wall of charts with no hierarchy |
| Coach | 381 | 5 | Appropriate | -- |

---

## Recommendations

| # | Tab | Change | Impact |
|---|-----|--------|--------|
| 1 | **Progress** | Add sub-tabs (Workout / Nutrition / Body) or collapsible sections | Reduces scroll length by ~70%, adds hierarchy |
| 2 | **Progress** | Adopt Whoop pattern: show 3 key metrics at top, progressive disclosure for charts | Makes data scannable |
| 3 | **Nutrition** | Split into overview (top-level summary) and food log (detailed entry list) via sub-tab or toggle | Reduces cognitive load |
| 4 | **Today** | Limit to 4-5 sections maximum; move Quick Actions to a sheet or long-press on tab icon | Focuses the daily dashboard |
| 5 | **Workout** | Hide "Choose a Program" section when a program is active | Removes irrelevant content |

*S4 complete.*
