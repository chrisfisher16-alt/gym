/**
 * Sound effects for FormIQ.
 *
 * Uses expo-audio. Sounds are loaded lazily on first play and cached for
 * subsequent calls. On web or when audio playback fails, errors are silently
 * swallowed so the rest of the app is unaffected.
 */
import { Platform } from 'react-native';

let player: import('expo-audio').AudioPlayer | null = null;
let audioConfigured = false;

async function ensurePlayer() {
  if (player) return player;
  try {
    const { createAudioPlayer, setAudioModeAsync } = await import('expo-audio');
    if (!audioConfigured) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      audioConfigured = true;
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    player = createAudioPlayer(require('../../assets/sounds/timer-done.wav'));
    return player;
  } catch {
    return null;
  }
}

/**
 * Play the rest-timer completion chime (double beep).
 * Safe to call anywhere — silently no-ops on failure or web.
 */
export async function playTimerComplete(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const p = await ensurePlayer();
    if (!p) return;

    p.seekTo(0);
    p.play();
  } catch {
    // Audio playback not available — no-op
  }
}
