// ── AI Demo Mode Responses ──────────────────────────────────────────
// Pre-written responses matched by keywords so the coach works without any API key.

interface DemoPattern {
  keywords: string[];
  /** If any keyword appears in the user message, this pattern matches. */
  response: string;
}

const DEMO_PATTERNS: DemoPattern[] = [
  // ── Workout Plans ──────────────────────────────────────────────
  {
    keywords: ['workout plan', 'create a plan', 'training plan', 'weekly plan', 'build a program', 'make me a plan'],
    response: `Here's a solid 4-day training split to get you started:

**Day 1 – Upper Body Push**
• Bench Press – 4×8
• Overhead Press – 3×10
• Incline Dumbbell Press – 3×12
• Lateral Raises – 3×15
• Tricep Pushdowns – 3×12

**Day 2 – Lower Body**
• Barbell Squat – 4×6
• Romanian Deadlift – 3×10
• Leg Press – 3×12
• Walking Lunges – 3×12 each leg
• Calf Raises – 4×15

**Day 3 – Rest or Light Cardio**

**Day 4 – Upper Body Pull**
• Barbell Rows – 4×8
• Pull-Ups – 3×AMRAP
• Seated Cable Rows – 3×12
• Face Pulls – 3×15
• Barbell Curls – 3×12

**Day 5 – Lower Body + Core**
• Deadlift – 4×5
• Front Squat – 3×8
• Leg Curls – 3×12
• Plank – 3×45s
• Hanging Leg Raises – 3×12

Start with weights you can control for all reps. Add 5 lbs to compound lifts each week when you complete all sets. Let me know your experience level and I can adjust this!`,
  },

  // ── What to eat ────────────────────────────────────────────────
  {
    keywords: ['what should i eat', 'meal plan', 'what to eat', 'meal ideas', 'food suggestions', 'eating plan'],
    response: `Here's a sample day of eating for roughly 2,200 calories and 150g protein:

**Breakfast (~500 cal, 35g protein)**
• 3 eggs scrambled with spinach and peppers
• 1 slice whole grain toast
• 1/2 avocado

**Lunch (~600 cal, 45g protein)**
• Grilled chicken breast (6oz)
• Brown rice (1 cup cooked)
• Steamed broccoli (1 cup)
• Olive oil drizzle

**Snack (~300 cal, 30g protein)**
• Protein shake with banana and peanut butter

**Dinner (~600 cal, 40g protein)**
• Salmon fillet (5oz)
• Sweet potato
• Mixed green salad with olive oil dressing

**Evening Snack (~200 cal, 15g protein)**
• Greek yogurt with berries

These are estimates — adjust portions based on your specific targets. Would you like me to focus on any particular dietary preference?`,
  },

  // ── Progress ───────────────────────────────────────────────────
  {
    keywords: ["how's my progress", 'my progress', 'am i improving', 'progress update', 'how am i doing', 'progress report'],
    response: `Great question! Here's what I can see:

**Consistency** — You've been showing up and logging workouts, which is the #1 factor in long-term results. Keep that up!

**What to focus on next:**
1. **Progressive overload** — Try to add a small amount of weight or an extra rep each week to your main lifts
2. **Protein intake** — Aim to hit your protein target at least 5 days per week. This makes the biggest difference for muscle growth and recovery
3. **Recovery** — Make sure you're getting 7-8 hours of sleep. It's when your muscles actually grow

**Tip:** Don't compare week-to-week — compare month-to-month. Real progress is gradual. A 5lb increase on your bench over a month is great progress, even if it doesn't feel dramatic.

Want me to look at any specific lift or metric in detail?`,
  },

  // ── Protein ────────────────────────────────────────────────────
  {
    keywords: ['protein target', 'hit my protein', 'more protein', 'protein intake', 'high protein', 'protein foods', 'enough protein'],
    response: `Here are some high-protein foods to help you hit your target:

**Protein Powerhouses (30g+ per serving):**
• Chicken breast (6oz) — 46g protein
• Greek yogurt (1 cup) — 20g protein
• Whey protein shake — 25-30g protein
• Tuna can (5oz) — 30g protein
• Lean ground turkey (6oz) — 36g protein

**Easy Protein Boosts (+10-15g):**
• Hard-boiled eggs (2) — 12g
• String cheese (2 sticks) — 14g
• Cottage cheese (1/2 cup) — 14g
• Beef jerky (1oz) — 10g
• Edamame (1 cup) — 17g

**Quick Wins:**
1. Add a protein source to every meal and snack
2. Front-load protein at breakfast (most people skip this)
3. Keep protein snacks prepped and accessible
4. A casein shake before bed counts toward your daily total

A simple formula: aim for 0.8-1g per pound of bodyweight. So if you weigh 175 lbs, shoot for 140-175g daily.`,
  },

  // ── Recovery ───────────────────────────────────────────────────
  {
    keywords: ['recovery', 'recovery workout', 'light workout', 'active recovery', 'rest day', 'deload', 'sore', 'soreness'],
    response: `Here's a great recovery day workout (30-40 minutes):

**Active Recovery Session:**
1. **Light walk or cycling** — 10 min (easy pace, conversational)
2. **Foam rolling** — 8 min
   • Quads, hamstrings, glutes, upper back, lats (1 min each)
3. **Dynamic stretching** — 10 min
   • World's greatest stretch — 5 each side
   • Hip 90/90 rotations — 8 each side
   • Cat-cow — 10 reps
   • Thread the needle — 5 each side
4. **Band work** — 8 min
   • Band pull-aparts — 3×15
   • Band dislocates — 2×10
   • Banded walks — 2×15 each direction

**Recovery tips:**
• Sleep 7-9 hours (this is when muscles repair)
• Stay hydrated — aim for half your bodyweight in ounces of water
• Eat adequate protein on rest days too
• Light movement beats sitting on the couch all day

If you're consistently very sore for 3+ days after workouts, you might be doing too much volume. Let me know if you'd like me to adjust your training.`,
  },

  // ── Mix up exercises ───────────────────────────────────────────
  {
    keywords: ['mix up', 'alternative', 'replacement', 'substitute', 'swap', 'different exercise', 'switch up', 'bored'],
    response: `Here are some great exercise swaps to keep things fresh:

**Bench Press alternatives:**
• Dumbbell bench press (more range of motion)
• Floor press (great for lockout strength)
• Push-ups with a weighted vest

**Squat alternatives:**
• Front squat (more quad-focused)
• Goblet squat (great for depth)
• Bulgarian split squat (unilateral strength)

**Deadlift alternatives:**
• Trap bar deadlift (easier on the back)
• Sumo deadlift (different hip mechanics)
• Kettlebell swings (explosive hip hinge)

**Row alternatives:**
• Chest-supported dumbbell rows
• Meadows rows (great lat stretch)
• Seated cable rows with different grips

**General rule:** Keep the movement pattern the same, just change the tool or angle. This gives variety while keeping your program effective.

Want me to suggest specific swaps for your current workout?`,
  },

  // ── Form tips ──────────────────────────────────────────────────
  {
    keywords: ['form', 'form tips', 'technique', 'how to', 'proper form', 'correct form'],
    response: `Here are key form cues for the most common exercises:

**Squat:**
• Feet shoulder-width, toes slightly out
• Brace your core — big breath into your belly
• Push knees out over toes as you descend
• Hip crease should go below knee level
• Drive up through your whole foot

**Bench Press:**
• Shoulder blades pinched together and down
• Slight arch in lower back (natural, not extreme)
• Bar path: slight diagonal, touching mid-chest
• Elbows at ~45° angle, not flared out
• Feet planted firmly on the floor

**Deadlift:**
• Bar over mid-foot, shins touching the bar
• Hinge at the hips, keep the bar close to your body
• Chest up, neutral spine (don't round your back)
• Push the floor away rather than pulling the bar up
• Lock out with glutes, don't hyperextend the back

**Overhead Press:**
• Brace your core tight
• Start with bar at collarbone height
• Press slightly back, moving your head through once the bar clears
• Full lockout overhead, biceps near ears

Which exercise would you like more detailed tips for?`,
  },

  // ── Calorie question ───────────────────────────────────────────
  {
    keywords: ['calorie', 'calories', 'how many calories', 'caloric', 'deficit', 'surplus', 'maintenance', 'tdee'],
    response: `Here's a quick guide to figuring out your calorie needs:

**Step 1: Estimate your maintenance calories**
A good starting point is bodyweight (lbs) × 14-16.
• Sedentary: ×14
• Moderately active (3-4 workouts/week): ×15
• Very active (5+ workouts/week): ×16

**Step 2: Adjust for your goal**
• **Fat loss:** Subtract 300-500 calories from maintenance
• **Maintenance:** Stay at your number
• **Muscle gain:** Add 200-300 calories above maintenance

**Step 3: Set your macros**
• Protein: 0.8-1g per lb bodyweight (most important!)
• Fat: 0.3-0.4g per lb bodyweight
• Carbs: Fill in the remaining calories

**Example for a 180lb person wanting to build muscle:**
• Maintenance: ~2,700 cal
• Surplus: ~3,000 cal
• Protein: 160g (640 cal)
• Fat: 65g (585 cal)
• Carbs: 444g (1,775 cal)

Track for 2 weeks, then adjust based on the scale and mirror. Weight should change by 0.5-1% of bodyweight per week in either direction.

*Note: These are estimates. Individual metabolism varies. Consult a healthcare provider for personalized advice.*`,
  },

  // ── Sleep ──────────────────────────────────────────────────────
  {
    keywords: ['sleep', 'sleeping', 'rest', 'tired', 'fatigue', 'energy'],
    response: `Sleep is arguably the most important recovery tool. Here's how to optimize it:

**How much:** Aim for 7-9 hours. Most people who train hard do best with 8+.

**Sleep hygiene tips:**
1. **Consistent schedule** — Same bed/wake time, even weekends (±30 min)
2. **Cool room** — 65-68°F (18-20°C) is ideal
3. **Dark room** — Blackout curtains or an eye mask
4. **No screens** — Blue light filter or no screens 30-60 min before bed
5. **Caffeine cutoff** — No caffeine after 2 PM (it has a 6-hour half-life)
6. **No heavy meals** — Last big meal 2-3 hours before bed

**For recovery specifically:**
• Poor sleep reduces muscle protein synthesis by up to 18%
• Growth hormone is primarily released during deep sleep
• Even 1 night of bad sleep can reduce next-day workout performance by 10-15%

If you're getting less than 7 hours, improving sleep will do more for your results than any supplement or program change.`,
  },

  // ── Supplements ────────────────────────────────────────────────
  {
    keywords: ['supplement', 'supplements', 'creatine', 'pre-workout', 'protein powder', 'vitamins'],
    response: `Here's an evidence-based supplement tier list:

**Tier 1 — Strong evidence, most people benefit:**
• **Creatine monohydrate** — 5g daily. Proven for strength, muscle mass, and even brain health. Cheap and safe.
• **Protein powder** — Convenient way to hit protein targets. Whey, casein, or plant-based all work.
• **Vitamin D** — 2000-5000 IU daily, especially if you're indoors a lot.

**Tier 2 — Good evidence, situational:**
• **Magnesium** — 200-400mg before bed. Helps sleep and recovery.
• **Omega-3 fish oil** — 1-2g EPA+DHA daily. Anti-inflammatory.
• **Caffeine** — 100-200mg pre-workout. Proven performance enhancer.

**Tier 3 — Some evidence, nice to have:**
• **Ashwagandha** — May help with stress and recovery
• **Zinc** — If deficient (common in athletes)

**Skip these (waste of money for most people):**
• BCAAs (just eat enough protein)
• Testosterone boosters (don't work)
• Fat burners (minor effect at best, usually just caffeine)

Start with Tier 1 before adding anything else. Most of your results come from training, nutrition, and sleep — not supplements.

*Always consult a healthcare provider before starting new supplements.*`,
  },

  // ── Weight loss ────────────────────────────────────────────────
  {
    keywords: ['lose weight', 'weight loss', 'fat loss', 'cut', 'cutting', 'lean', 'shred', 'burn fat'],
    response: `Here's a practical fat loss approach:

**The fundamentals (in order of importance):**
1. **Calorie deficit** — Eat 300-500 calories below maintenance. Aggressive deficits backfire.
2. **Protein high** — 1g per lb bodyweight. This preserves muscle and keeps you full.
3. **Strength training** — Keep lifting! Don't switch to "light weight high reps." Your muscles need a reason to stay.
4. **Sleep** — 7-9 hours. Poor sleep increases hunger hormones by up to 28%.
5. **Steps** — Aim for 8,000-10,000 daily. Low-intensity movement burns significant calories without spiking hunger.

**Practical tips:**
• Weigh yourself daily, track the weekly average (weight fluctuates)
• Aim to lose 0.5-1% of bodyweight per week
• Front-load protein and vegetables in your meals
• Don't eliminate entire food groups
• Diet breaks every 8-12 weeks (eat at maintenance for 1-2 weeks)

**Red flags to watch:**
• Losing more than 1.5% bodyweight per week = too aggressive
• Constantly hungry, irritable, poor sleep = deficit too large
• Strength dropping significantly = reduce deficit or take a break

*Never go below 1,200 calories (women) or 1,500 calories (men) without medical supervision.*`,
  },

  // ── Muscle gain ────────────────────────────────────────────────
  {
    keywords: ['build muscle', 'muscle gain', 'bulk', 'bulking', 'gain weight', 'hypertrophy', 'get bigger', 'mass'],
    response: `Here's how to maximize muscle growth:

**Training:**
• Train each muscle group 2× per week
• 10-20 hard sets per muscle group per week
• Rep ranges: mix of 6-8 (strength), 8-12 (hypertrophy), 12-15 (metabolic stress)
• Progressive overload: add weight, reps, or sets over time
• Train close to failure (1-3 reps in reserve)

**Nutrition:**
• Eat 200-300 calories above maintenance (lean bulk)
• Protein: 0.8-1g per lb bodyweight
• Don't "dirty bulk" — excess fat gain doesn't help muscle growth
• Time some carbs around workouts

**The key lifts for each muscle group:**
• Chest: Bench press, incline press, flyes
• Back: Rows, pull-ups, pulldowns
• Legs: Squat, leg press, Romanian deadlift
• Shoulders: Overhead press, lateral raises
• Arms: Curls and pushdowns (but compounds do most of the work)

**Realistic expectations:**
• Beginners: 1.5-2 lbs muscle/month
• Intermediate: 0.5-1 lb muscle/month
• Advanced: 0.25-0.5 lb muscle/month

Patience and consistency beat everything. Most "hardgainers" just aren't eating enough or training hard enough.`,
  },

  // ── Snack suggestions ─────────────────────────────────────────
  {
    keywords: ['snack', 'healthy snack', 'snack idea', 'quick snack', 'between meals'],
    response: `Here are some great snack options organized by goal:

**High Protein (15g+):**
• Greek yogurt with berries — 20g protein, ~180 cal
• Cottage cheese with pineapple — 14g protein, ~150 cal
• Turkey and cheese roll-ups — 18g protein, ~160 cal
• Hard-boiled eggs (2) + apple — 12g protein, ~200 cal
• Protein bar — 20g protein, ~200 cal

**Quick Energy (pre-workout):**
• Banana with peanut butter — ~250 cal
• Rice cakes with honey — ~150 cal
• Trail mix (small handful) — ~200 cal
• Granola bar — ~180 cal

**Low Calorie (<100 cal):**
• Celery with 1 tbsp almond butter — 95 cal
• Bell pepper slices with hummus (2 tbsp) — 80 cal
• Cucumber slices with everything bagel seasoning — 30 cal
• Air-popped popcorn (2 cups) — 60 cal

**Before Bed:**
• Casein shake — slow-digesting, feeds muscles overnight
• Cottage cheese — natural casein source
• Greek yogurt — similar to casein

Pick snacks that help you hit your macro targets for the day!`,
  },

  // ── Stretching / Warm Up ───────────────────────────────────────
  {
    keywords: ['stretch', 'warm up', 'warmup', 'mobility', 'flexibility', 'foam roll'],
    response: `Here's a solid warm-up and mobility routine:

**Pre-Workout Warm-Up (8-10 min):**
1. **Light cardio** — 3 min (jumping jacks, light jog, or bike)
2. **Leg swings** — 10 each direction, each leg
3. **Hip circles** — 10 each direction
4. **World's greatest stretch** — 5 each side
5. **Band pull-aparts** — 15 reps
6. **Bodyweight squats** — 10 reps
7. **Arm circles** — 10 forward, 10 backward

**Then do 1-2 warm-up sets of your first exercise at 50% and 75% working weight.**

**Post-Workout Stretching (5-10 min):**
• Hold each stretch 30-60 seconds
• Hamstring stretch
• Quad stretch
• Hip flexor stretch
• Chest doorway stretch
• Lat stretch (hang from a bar)

**Mobility work (do on off-days):**
• Foam rolling — 1-2 min per muscle group
• 90/90 hip rotations
• Thoracic spine extensions
• Ankle mobility circles
• Shoulder pass-throughs with a band

Mobility work prevents injuries and actually improves your lifting performance over time.`,
  },

  // ── Bench press specific ───────────────────────────────────────
  {
    keywords: ['bench press', 'bench', 'chest exercise', 'chest workout'],
    response: `Here's everything you need to nail your bench press:

**Setup:**
• Lie with eyes under the bar
• Pinch shoulder blades together and down (think: put them in your back pockets)
• Slight arch in your lower back (natural, not extreme)
• Feet flat on the floor, driven into the ground
• Grip: 1.5× shoulder width is a good starting point

**The lift:**
• Unrack with straight arms, bring bar over mid-chest
• Lower the bar to your mid/lower chest with control (2-3 sec)
• Touch your chest — no bouncing
• Press up and slightly back toward the rack
• Elbows at ~45° angle (not flared out at 90°)

**Common mistakes:**
• Flaring elbows (strains shoulders) → tuck to 45°
• Bouncing off chest → pause briefly at the bottom
• Butt coming off bench → drive feet into the floor
• Uneven press → focus on pressing evenly with both arms

**To increase your bench:**
• Bench 2× per week (one heavy day, one volume day)
• Add paused reps (builds bottom-end strength)
• Strengthen triceps (close-grip bench, dips)
• Don't neglect back work (rows balance your pressing)`,
  },

  // ── Squat specific ─────────────────────────────────────────────
  {
    keywords: ['squat', 'leg day', 'legs', 'quad', 'quads'],
    response: `Here are the key points for a great squat:

**Setup:**
• Bar on upper traps (high bar) or rear delts (low bar)
• Feet shoulder-width or slightly wider
• Toes pointed out 15-30°
• Big breath into your belly, brace your core

**The movement:**
• Initiate by pushing hips back AND bending knees simultaneously
• Push knees out over toes
• Go to at least parallel (hip crease below knee)
• Drive up through your whole foot
• Keep chest up throughout

**Common issues and fixes:**
• "Butt wink" at the bottom → Likely ankle mobility. Try elevating heels or wider stance
• Knees caving in → Actively push them out. Banded squats help train this
• Forward lean → Front squat more to build upright posture
• Can't hit depth → Work on ankle and hip mobility

**Squat day template:**
1. Barbell squat — 4×6 (main lift)
2. Front squat OR leg press — 3×10
3. Walking lunges — 3×12 each
4. Leg extensions — 3×15
5. Calf raises — 4×15

Want me to help you troubleshoot a specific squat issue?`,
  },

  // ── Deadlift specific ──────────────────────────────────────────
  {
    keywords: ['deadlift', 'dead lift', 'hip hinge', 'posterior chain'],
    response: `Deadlift form guide and tips:

**Conventional Deadlift Setup:**
• Feet hip-width apart, bar over mid-foot
• Grip just outside your knees
• Shins touching the bar
• Chest up, shoulders over or slightly in front of the bar
• Neutral spine — no rounding!

**The pull:**
• Take the slack out of the bar before pulling
• Push the floor away (think "leg press the earth")
• Keep the bar dragging along your body
• Hips and shoulders rise at the same rate
• Lock out by squeezing glutes at the top
• Don't hyperextend your back at the top

**Conventional vs. Sumo:**
• Conventional: more back/hamstring focused, narrower stance
• Sumo: more quad/hip focused, wider stance, more upright torso
• Neither is "cheating" — pick what feels natural for your build

**Programming:**
• Deadlift 1-2× per week
• Keep reps at 1-5 for strength, 6-8 for hypertrophy
• Don't train to failure often — form breaks down
• Accessories: Romanian deadlifts, back extensions, barbell rows`,
  },

  // ── Am I eating enough ─────────────────────────────────────────
  {
    keywords: ['eating enough', 'am i eating', 'undereating', 'not eating enough', 'too little'],
    response: `Good question! Here are signs you might not be eating enough:

**Physical signs:**
• Feeling tired and sluggish during workouts
• Strength plateau or decline
• Feeling cold all the time
• Getting sick frequently
• Hair thinning or brittle nails
• Poor sleep quality

**Performance signs:**
• Can't complete your normal workout volume
• Recovery taking longer than usual
• Persistent muscle soreness (3+ days)
• Mental fog, difficulty concentrating

**What to check:**
1. Are you eating at least 1,500 calories (men) or 1,200 calories (women)?
2. Are you getting enough protein (0.7-1g per lb bodyweight)?
3. Are you fueling around workouts (some carbs before/after)?

**If you think you're undereating:**
• Increase by 200-300 calories for 1-2 weeks
• Focus on adding more nutrient-dense foods, not junk
• Track your energy levels and workout performance
• If symptoms persist, see a healthcare provider

*Remember: eating too little is just as counterproductive as eating too much when trying to build muscle or even lose fat sustainably.*`,
  },

  // ── Motivation ─────────────────────────────────────────────────
  {
    keywords: ['motivation', 'motivated', 'discipline', 'consistency', 'give up', 'quit', 'struggling', 'hard'],
    response: `Everyone struggles with motivation sometimes. Here's what actually works:

**The truth about motivation:**
Motivation is temporary. Discipline and habits are what get results. You don't need to feel motivated to show up — you just need to make showing up easy.

**Practical strategies:**
1. **Lower the bar** — On hard days, commit to just 15 minutes. You'll usually end up doing more.
2. **Don't break the chain** — Track your workout days. A visual streak is powerful.
3. **Prepare in advance** — Lay out gym clothes the night before, pack your gym bag, prep meals on Sunday.
4. **Find your "why"** — Write down 3 specific reasons you train. Read them when motivation is low.
5. **Celebrate small wins** — Hit a new PR? Logged all meals today? That deserves recognition.

**Reframe your thinking:**
• "I have to work out" → "I get to work out"
• "I fell off track" → "I get to start again right now"
• "I'm not seeing results" → "I'm building habits that compound over time"

**Remember:** The people with the best physiques aren't more motivated than you — they've just been consistent longer. Every workout you do is a vote for the person you want to become.

You've got this. What's your next workout?`,
  },

  // ── Greetings ──────────────────────────────────────────────────
  {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'good evening', 'whats up', "what's up", 'sup'],
    response: `Hey! 👋 I'm your AI health and fitness coach. I'm here to help with:

• **Workout advice** — Plans, form tips, exercise alternatives
• **Nutrition guidance** — Meal ideas, protein tips, calorie planning
• **Progress analysis** — Reviewing your training and nutrition data
• **Recovery** — Rest day activities, sleep optimization, stretching

What would you like to work on today?`,
  },

  // ── Thank you ──────────────────────────────────────────────────
  {
    keywords: ['thank', 'thanks', 'appreciate', 'helpful', 'awesome', 'great advice'],
    response: `You're welcome! Remember, the best program is the one you actually stick with. Keep putting in the work and the results will follow.

Anything else I can help you with? Whether it's tweaking your workout, planning meals, or just a quick form check — I'm here.`,
  },

  // ── Cardio ─────────────────────────────────────────────────────
  {
    keywords: ['cardio', 'running', 'hiit', 'conditioning', 'endurance', 'aerobic'],
    response: `Here's a balanced approach to cardio that won't kill your gains:

**For general health (everyone should do this):**
• 150 min/week moderate cardio (walking, cycling, swimming)
• That's just ~20 min/day or three 50-min sessions

**For fat loss:**
• Daily walking: 8,000-10,000 steps (most underrated fat loss tool)
• 2-3 HIIT sessions per week (20-25 min each)
• Sample HIIT: 30 sec sprint, 60 sec rest × 8-10 rounds

**For muscle gain (minimize interference):**
• Keep intense cardio separate from leg days (6+ hours apart)
• Low-impact is better: cycling, walking, rowing
• 2-3 sessions of 20-30 min per week is plenty

**HIIT Workout Example:**
1. Jumping jacks — 30 sec
2. Rest — 15 sec
3. Mountain climbers — 30 sec
4. Rest — 15 sec
5. Burpees — 30 sec
6. Rest — 15 sec
7. High knees — 30 sec
8. Rest — 60 sec
Repeat 3-4 rounds.

The best cardio is the one you'll actually do consistently.`,
  },

  // ── Injuries / Pain ────────────────────────────────────────────
  {
    keywords: ['injury', 'pain', 'hurt', 'injured', 'ache', 'sore shoulder', 'sore knee', 'back pain'],
    response: `I'm sorry you're dealing with pain. Here's some general guidance:

**Important:** I can't diagnose injuries or provide medical advice. If you're experiencing sharp pain, persistent pain, or pain that gets worse, please see a healthcare provider or physical therapist.

**General guidelines:**
• **Sharp pain during exercise** → Stop immediately. Don't push through sharp pain.
• **Dull ache/soreness** → Usually okay to train around it with modifications
• **Pain that lasts 3+ days** → See a professional

**What you CAN do:**
• Train other body parts that don't aggravate the issue
• Reduce weight and increase reps on affected movements
• Focus on mobility and flexibility work
• Ice for acute inflammation (first 48 hours), heat for chronic tightness

**Common substitutions for painful movements:**
• Barbell hurts → Try dumbbells (more natural joint movement)
• Overhead pressing hurts shoulder → Try landmine press or high incline
• Squats hurt knees → Try leg press with limited range or box squats

Please consult a qualified healthcare professional for any persistent pain or injury. I want you training safely for the long term!`,
  },

  // ── Water / hydration ──────────────────────────────────────────
  {
    keywords: ['water', 'hydration', 'hydrate', 'drink', 'dehydrated', 'thirsty'],
    response: `Hydration is crucial for performance and recovery:

**How much water:**
• Baseline: Half your bodyweight in ounces (e.g., 180 lbs → 90 oz)
• Add 16-24 oz for each hour of exercise
• More if you sweat heavily or it's hot

**Signs of dehydration:**
• Dark yellow urine (aim for light straw color)
• Headaches and fatigue
• Decreased workout performance
• Muscle cramps

**Tips to drink more:**
1. Carry a water bottle everywhere
2. Drink a full glass when you wake up
3. Drink before you feel thirsty (thirst = already dehydrated)
4. Set hourly reminders if needed
5. Add lemon, cucumber, or electrolytes for flavor

**Around workouts:**
• 16 oz 2 hours before
• 8 oz every 15-20 min during
• 16-24 oz after

For workouts over 60 min or heavy sweating, add electrolytes (sodium, potassium, magnesium).`,
  },
];

/**
 * Match a user message to a demo response using keyword matching.
 * Returns the best match (most keyword hits), or a generic fallback.
 */
export function getDemoResponse(userMessage: string): string {
  const lower = userMessage.toLowerCase();

  let bestMatch: DemoPattern | null = null;
  let bestScore = 0;

  for (const pattern of DEMO_PATTERNS) {
    let score = 0;
    for (const keyword of pattern.keywords) {
      if (lower.includes(keyword.toLowerCase())) {
        score += keyword.length; // Longer keyword matches = more specific
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = pattern;
    }
  }

  if (bestMatch && bestScore > 0) {
    return bestMatch.response;
  }

  return FALLBACK_RESPONSE;
}

const FALLBACK_RESPONSE = `That's a great question! Here's what I'd suggest:

**For workout-related questions**, I can help with:
• Creating workout plans tailored to your goals
• Exercise alternatives and form tips
• Progressive overload strategies
• Recovery and deload advice

**For nutrition questions**, try asking about:
• Meal planning and food suggestions
• Hitting your protein or calorie targets
• Pre/post workout nutrition
• Healthy snack ideas

**For general health**, I can discuss:
• Sleep optimization
• Supplement guidance
• Cardio programming
• Staying consistent

Try asking something specific like "Create a workout plan for me" or "How can I hit my protein target?" and I'll give you detailed, actionable advice!

*Note: I'm running in demo mode with pre-written responses. Go to Settings → AI Settings to connect a real AI provider for personalized coaching.*`;

/**
 * Get a concise contextual response for in-workout or in-nutrition quick prompts.
 */
export function getDemoContextualResponse(prompt: string, context?: string): string {
  // For in-workout exercise-specific prompts
  if (context === 'workout') {
    if (prompt.toLowerCase().includes('replacement') || prompt.toLowerCase().includes('substitute') || prompt.toLowerCase().includes('alternative')) {
      return `Try one of these alternatives:
• Dumbbell variation of the same movement
• Machine equivalent (if available)
• A similar movement pattern with different equipment

For example, if you're doing barbell bench press, try dumbbell bench press or machine chest press. Same muscles, different stimulus!`;
    }
    if (prompt.toLowerCase().includes('form') || prompt.toLowerCase().includes('technique') || prompt.toLowerCase().includes('tips')) {
      return `Key form cues:
• Control the eccentric (lowering) phase — 2-3 seconds
• Full range of motion
• Don't rush between reps
• Breathe: exhale on exertion, inhale on the eccentric
• If you can't control the weight, it's too heavy`;
    }
    if (prompt.toLowerCase().includes('mix up') || prompt.toLowerCase().includes('remaining')) {
      return `To keep things fresh for the remaining exercises, try:
• Swap grip width (close grip vs wide grip)
• Change tempo (slow eccentrics, pause reps)
• Add a drop set on the last set
• Swap the exercise order

Small changes create new stimulus without changing your whole program!`;
    }
  }

  if (context === 'nutrition') {
    if (prompt.toLowerCase().includes('protein')) {
      return `Quick protein boosters: Greek yogurt (20g), protein shake (25g), chicken breast (46g per 6oz), cottage cheese (14g per 1/2 cup), hard-boiled eggs (6g each). Add one of these to your next meal!`;
    }
    if (prompt.toLowerCase().includes('snack')) {
      return `Healthy snack ideas: apple with peanut butter (~200 cal, 7g protein), Greek yogurt with berries (~180 cal, 20g protein), or a handful of almonds (~160 cal, 6g protein).`;
    }
    if (prompt.toLowerCase().includes('enough') || prompt.toLowerCase().includes('on track')) {
      return `Check your calorie and protein totals for today. If you're within 100 calories of your target and within 20g of your protein goal, you're doing great! Focus on getting a protein-rich meal for your remaining meals today.`;
    }
  }

  // Fall through to general keyword matching
  return getDemoResponse(prompt);
}
