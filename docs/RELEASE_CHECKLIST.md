# Release Checklist

## Before Beta

- [ ] Supabase project created and migrations run
- [ ] Environment variables set for both apps
- [ ] RevenueCat project set up with product IDs
- [ ] EAS project configured
- [ ] Development build tested on device
- [ ] Demo account working
- [ ] Privacy policy and terms reviewed by lawyer
- [ ] App icons and splash screen designed
- [ ] Push notification certificates configured (APNs + FCM)
- [ ] Health data permissions tested on real devices
- [ ] Edge Functions deployed and tested
- [ ] All screens handle loading, empty, and error states

## Before App Store Submission

- [ ] App Store screenshots prepared (6.7", 6.5", 5.5", iPad)
- [ ] App description written (max 4000 chars)
- [ ] Keywords optimized (max 100 chars)
- [ ] Privacy nutrition labels filled out accurately
- [ ] Health data usage descriptions reviewed and accurate
- [ ] In-app purchases tested with sandbox accounts
- [ ] Push notifications tested on device
- [ ] Deep links tested (`health-coach://` scheme)
- [ ] Performance profiled on older devices (iPhone SE, budget Android)
- [ ] Accessibility basics checked (VoiceOver, TalkBack, dynamic font sizes)
- [ ] Crash-free rate verified (> 99.5%)
- [ ] Dark mode tested on all screens
- [ ] Landscape mode handled (or locked to portrait)
- [ ] App Review Information prepared (demo account, notes for reviewer)
- [ ] Support URL configured
- [ ] Marketing URL configured
- [ ] Age rating questionnaire completed
- [ ] Content rights declarations completed

## Before Google Play Submission

- [ ] Play Store listing prepared (short/full description, screenshots)
- [ ] Health Connect permissions declared in Play Console
- [ ] Data safety section filled out
- [ ] Target API level meets Play Store requirements
- [ ] AAB (Android App Bundle) uploaded
- [ ] Internal testing track tested
- [ ] Content rating questionnaire completed

## Before Public Launch

- [ ] Analytics verified (events flowing to Supabase)
- [ ] Admin portal accessible and showing real data
- [ ] Error monitoring (Sentry) configured for mobile + Edge Functions
- [ ] Support email configured and monitored (support@healthcoach.app)
- [ ] Backup strategy for Supabase (point-in-time recovery enabled)
- [ ] Rate limiting on Edge Functions (AI endpoints)
- [ ] AI cost monitoring alerts set up (OpenAI/Anthropic spend limits)
- [ ] RevenueCat webhook verified (subscription events flowing)
- [ ] Supabase RLS policies reviewed and tested
- [ ] Database indexes optimized for common queries
- [ ] Edge Function cold start times acceptable
- [ ] CDN configured for static assets
- [ ] Custom domain configured (if applicable)
- [ ] GDPR/privacy compliance verified
- [ ] App store optimization (ASO) basics done
- [ ] Social media accounts created
- [ ] Landing page live with App Store/Play Store links
- [ ] Feedback/bug reporting mechanism in-app
- [ ] Version update mechanism tested (OTA updates via EAS Update)

## Post-Launch Monitoring

- [ ] Daily active users (DAU) tracking
- [ ] Crash rate monitoring (< 0.5%)
- [ ] AI response latency monitoring (< 3s p95)
- [ ] Subscription conversion rate tracking
- [ ] User retention metrics (D1, D7, D30)
- [ ] App Store ratings monitoring
- [ ] Support ticket volume tracking
- [ ] Infrastructure cost monitoring
- [ ] Weekly AI cost review
