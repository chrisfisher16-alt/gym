/**
 * Network-aware utilities for wrapping Supabase calls with error handling.
 */

/**
 * Wrap a Supabase call with error handling that returns a friendly message
 * instead of crashing.
 */
export async function safeSupabaseCall<T>(
  operation: () => Promise<{ data: T | null; error: { message?: string; code?: string } | null }>,
  fallbackMessage: string = 'Something went wrong. Please try again.',
): Promise<{ data: T | null; error: string | null }> {
  try {
    const result = await operation();
    if (result.error) {
      console.error('Supabase error:', result.error);
      if (
        result.error.message?.includes('fetch') ||
        result.error.message?.includes('network') ||
        result.error.message?.includes('Failed to fetch') ||
        result.error.code === 'PGRST301'
      ) {
        return { data: null, error: 'No internet connection. Your data is saved locally.' };
      }
      return { data: null, error: fallbackMessage };
    }
    return { data: result.data, error: null };
  } catch (err: unknown) {
    console.error('Network error:', err);
    const message = err instanceof Error ? err.message : '';
    if (
      message.includes('Network') ||
      message.includes('fetch') ||
      message.includes('timeout')
    ) {
      return { data: null, error: 'No internet connection. Your data is saved locally.' };
    }
    return { data: null, error: fallbackMessage };
  }
}

/**
 * Retry a function with exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, baseDelayMs * Math.pow(2, attempt)));
      }
    }
  }
  throw lastError;
}
