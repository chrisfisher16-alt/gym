# S5: Rest Timer UX

> **Note:** The rest timer was deeply analyzed in Step 5 (Focus View, Rest Timer, Summary). This step provides a focused technical reference and cross-references the primary findings.

## Current Implementation

### Architecture

Full-screen modal overlay (`RestTimerOverlay` in `active.tsx:1408-1517`) that renders over the entire active workout screen when `isRestTimerActive` is true.

### Configuration

| Setting | Value | Source |
|---------|-------|--------|
| Default rest | `activeSession.defaultRestSeconds` (fallback 90s) | Session-level |
| Per-exercise override | `exercise.restSeconds` | Per-exercise, configurable via inline editor |
| Overlay presets | `[60, 90, 120, 180]` seconds | `workout.ts:234` |
| Inline editor presets | `[30, 60, 90, 120, 180]` seconds | `active.tsx:942` |
| Mid-countdown adjust | +15s / -15s buttons | Lines 1449-1463 |
| Custom input | Text field in overlay | Any duration in seconds |

### Behavior

- **Auto-starts** after every set completion in both list and focus views
- **No opt-out** -- no setting to disable auto-start
- **Superset handling inconsistency:** List view starts timer after every non-superset set. Focus view starts only after a full superset round completes.
- **At t=0:** Warning haptic (double-pulse), overlay stays visible showing `0:00`, user must tap "Skip Rest" to dismiss
- **No sound** -- haptic only, missed if phone is on a bench
- **No auto-dismiss** -- timer remains at 0:00 blocking the screen indefinitely

### Key Issues (from Step 5)

1. **Full-screen blocking overlay** -- the highest-impact single change identified in the entire audit. Users cannot view or edit next set data during 60-90s of rest.
2. **No visual countdown** -- plain text number, no arc/ring, no color shift, no urgency as timer approaches zero.
3. **No auto-dismiss** -- timer stays at 0:00 until explicitly dismissed.
4. **No sound notification** -- only haptic feedback.
5. **Superset rest logic differs** between list and focus view.

### Recommended Redesign (from Step 5)

Replace the full-screen overlay with a non-blocking compact timer bar at the top or bottom of the workout screen. Timer visible while the user can scroll, edit weights, and review upcoming sets. Expand to full-screen on tap if desired. Add a circular countdown ring with color shift (green -> yellow -> red) and pulsing animation in the final 5 seconds.

*See Step 5 (`docs/audit/step-05-focus-view-rest-timer-summary.md`) for the complete analysis and wireframe recommendations.*

*S5 complete.*
