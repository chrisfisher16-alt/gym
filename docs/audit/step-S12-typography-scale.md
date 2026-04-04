# S12: Typography Scale Gaps

## Defined Scale

```
Token            fontSize  lineHeight  fontWeight
----------------------------------------------
displayLarge     32        40          700
displayMedium    28        36          700
h1               24        32          700
h2               20        28          600
h3               18        24          600
bodyLarge        16        24          400
body             14        20          400
bodySmall        12        16          400
labelLarge       16        24          600
label            14        20          500
labelSmall       12        16          500
caption          11        14          400
```

The scale is well-distributed: consistent 2pt steps from 11-20, 4pt steps from 20-32.

---

## Scale Map with Gaps

```
48 --- [welcome logo "F"] (one-off brand element)
        :
32 --- displayLarge
28 --- displayMedium
24 --- h1
20 --- h2
18 --- h3
16 --- bodyLarge / labelLarge
15 --- GAP (social auth buttons, 2 uses)
14 --- body / label
13 --- GAP (Button sm, CoachFAB label, 2 uses)
12 --- bodySmall / labelSmall
11 --- caption
10 --- GAP (achievement micro-text, 2 uses)
 9 --- GAP (chart labels, ProgressRing, 2 uses)
 7 --- GAP (tiny ring sublabel, 1 use)
```

---

## Gap Analysis

| fontSize | Token? | Occurrences | Files | Action |
|----------|--------|-------------|-------|--------|
| **48** | No | 1 | `welcome.tsx` | One-off brand element. Add `displayHero` token only if reused. |
| **15** | No | 2 | `sign-in.tsx`, `sign-up.tsx` | Social auth button text. Consolidate to `bodyLarge` (16) -- 1pt imperceptible. |
| **13** | No | 2 | `Button.tsx` (sm), `CoachFAB.tsx` | Legitimate gap. Add `labelXS` or `buttonSmall` token. |
| **10** | No | 2 | `AchievementBadge.tsx` | Micro-text for dates/hints. Add `micro` token. |
| **9** | No | 2 | `progress.tsx`, `ProgressRing.tsx` | Chart micro-labels. Cover under `micro` or accept as data-viz exception. |
| **7** | No | 1 | `ProgressRing.tsx` | Conditional tiny ring sublabel. Exception -- too small to tokenize. |

## Tokens Never Used Inline

All 12 tokens are used via the spread pattern `[typography.xxx, { ... }]` somewhere in the codebase. Good adoption.

## Redundant Overrides

`sign-in.tsx:68` and `sign-up.tsx:88` apply `{ ...typography.displayLarge, fontSize: 32, fontWeight: '700' }` -- both `fontSize` and `fontWeight` are already those values in the token. Remove the redundant overrides.

---

## Recommendations

| # | Change | Rationale |
|---|--------|-----------|
| 1 | Add `micro: { fontSize: 10, lineHeight: 14, fontWeight: '400' }` | Covers achievement dates and provides a floor above 9pt |
| 2 | Add `labelXS: { fontSize: 13, lineHeight: 16, fontWeight: '500' }` | Covers Button sm and CoachFAB label |
| 3 | Consolidate `fontSize: 15` -> `bodyLarge` (16) in auth screens | Eliminates gap with imperceptible change |
| 4 | Remove redundant `fontSize: 32, fontWeight: '700'` overrides | Clean up |
| 5 | Accept 9pt and 7pt as data-viz exceptions (ProgressRing only) | Too rare to tokenize |

The core scale (11-32) is solid and requires no structural changes. Only 2 new tokens are needed (`micro`, `labelXS`) to cover 4 gap instances.

*S12 complete.*
