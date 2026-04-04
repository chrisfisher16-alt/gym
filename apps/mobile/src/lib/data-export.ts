// ── Data Export ───────────────────────────────────────────────────
// GDPR-compliant instant data export in JSON or CSV format.
// Exports all user data: workouts, sets, PRs, nutrition, measurements, achievements.

import { Platform, Share, Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase, isSupabaseConfigured } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ExportFormat = 'json' | 'csv';

interface ExportResult {
  success: boolean;
  error?: string;
}

/**
 * Export all user data. Pulls from Supabase if configured, else from AsyncStorage.
 */
export async function exportUserData(format: ExportFormat): Promise<ExportResult> {
  try {
    const data = isSupabaseConfigured
      ? await fetchSupabaseData()
      : await fetchLocalData();

    if (!data) {
      return { success: false, error: 'No data to export' };
    }

    const content = format === 'json'
      ? JSON.stringify(data, null, 2)
      : convertToCSV(data);

    const extension = format === 'json' ? 'json' : 'csv';
    const filename = `formiq-export-${new Date().toISOString().slice(0, 10)}.${extension}`;
    const mimeType = format === 'json' ? 'application/json' : 'text/csv';

    if (Platform.OS === 'web') {
      downloadWeb(content, filename, mimeType);
      return { success: true };
    }

    // Write to temp file and share
    const filePath = `${FileSystem.cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(filePath, content, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await Share.share({
      url: filePath,
      title: `FormIQ Data Export - ${new Date().toLocaleDateString()}`,
    });

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Export failed';
    return { success: false, error: message };
  }
}

async function fetchSupabaseData() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [
    profileRes,
    coachPrefsRes,
    sessionsRes,
    setLogsRes,
    prsRes,
    nutritionDaysRes,
    mealEntriesRes,
    hydrationRes,
    measurementsRes,
    achievementsRes,
    streaksRes,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('coach_preferences').select('*').eq('user_id', user.id).single(),
    supabase.from('workout_sessions').select('*').eq('user_id', user.id).order('started_at', { ascending: false }),
    supabase.from('set_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }),
    supabase.from('personal_records').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }),
    supabase.from('nutrition_day_logs').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('meal_entries').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }),
    supabase.from('hydration_logs').select('*').eq('user_id', user.id).order('logged_at', { ascending: false }),
    supabase.from('body_measurements').select('*').eq('user_id', user.id).order('measured_at', { ascending: false }),
    supabase.from('achievements').select('*').eq('user_id', user.id).order('achieved_at', { ascending: false }),
    supabase.from('user_streaks').select('*').eq('user_id', user.id).single(),
  ]);

  return {
    exported_at: new Date().toISOString(),
    format_version: '1.0',
    user: {
      id: user.id,
      email: user.email,
    },
    profile: profileRes.data,
    coach_preferences: coachPrefsRes.data,
    workout_sessions: sessionsRes.data ?? [],
    set_logs: setLogsRes.data ?? [],
    personal_records: prsRes.data ?? [],
    nutrition_day_logs: nutritionDaysRes.data ?? [],
    meal_entries: mealEntriesRes.data ?? [],
    hydration_logs: hydrationRes.data ?? [],
    body_measurements: measurementsRes.data ?? [],
    achievements: achievementsRes.data ?? [],
    streaks: streaksRes.data,
  };
}

const SAFE_KEY_PREFIXES = [
  '@profile/',
  '@workout/',
  '@nutrition/',
  '@measurements/',
  '@achievements/',
  '@coach/',
  '@health/',
  '@grocery/',
  '@notification/',
  '@theme/',
  '@space/',
];

const SENSITIVE_KEY_PATTERNS = [
  'token', 'key', 'secret', 'session', 'auth', 'password', 'api_key', 'supabase',
];

function isSafeKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (SENSITIVE_KEY_PATTERNS.some((p) => lower.includes(p))) return false;
  return SAFE_KEY_PREFIXES.some((prefix) => key.startsWith(prefix));
}

async function fetchLocalData() {
  const allKeys = await AsyncStorage.getAllKeys();
  const keys = allKeys.filter(isSafeKey);
  const stores: Record<string, unknown> = {};

  for (const key of keys) {
    try {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        try {
          stores[key] = JSON.parse(value);
        } catch {
          stores[key] = value;
        }
      }
    } catch (err) {
      console.warn(`[DataExport] Failed to read key "${key}" — skipped:`, err);
    }
  }

  return {
    exported_at: new Date().toISOString(),
    format_version: '1.0',
    source: 'local_storage',
    data: stores,
  };
}

function convertToCSV(data: Record<string, unknown>): string {
  const sections: string[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (Array.isArray(value) && value.length > 0) {
      const headers = Object.keys(value[0]);
      const rows = value.map((row) =>
        headers.map((h) => {
          const cell = (row as Record<string, unknown>)[h];
          const str = cell === null || cell === undefined ? '' : String(cell);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        }).join(','),
      );
      sections.push(`# ${key}\n${headers.join(',')}\n${rows.join('\n')}`);
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      const entries = Object.entries(value as Record<string, unknown>);
      const rows = entries.map(([k, v]) => `${k},${JSON.stringify(v)}`);
      sections.push(`# ${key}\nkey,value\n${rows.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}

function downloadWeb(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
