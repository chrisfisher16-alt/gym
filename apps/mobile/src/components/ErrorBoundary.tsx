// ── Error Boundary ────────────────────────────────────────────────
// Catches React render errors and displays a recovery UI.
// Prevents white-screen crashes in production.

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkColors } from '../theme/colors';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional fallback component */
  fallback?: React.ReactNode;
  /** Called when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to console in development
    if (__DEV__) {
      console.error('ErrorBoundary caught:', error, errorInfo);
    }

    // Report to crash reporting service
    try {
      reportError(error, errorInfo);
    } catch {}

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
        />
      );
    }

    return this.props.children;
  }
}

function ErrorFallback({
  error,
  onRetry,
}: {
  error: Error | null;
  onRetry: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="warning-outline" size={48} color={darkColors.error} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.message}>
          An unexpected error occurred. You can try again or restart the app.
        </Text>

        {__DEV__ && error && (
          <ScrollView style={styles.errorBox} contentContainerStyle={styles.errorBoxContent}>
            <Text style={styles.errorText}>{error.message}</Text>
            {error.stack && (
              <Text style={styles.stackText}>{error.stack.slice(0, 500)}</Text>
            )}
          </ScrollView>
        )}

        <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.7}>
          <Ionicons name="refresh" size={20} color={darkColors.textOnPrimary} />
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Error Reporting ──────────────────────────────────────────────

let _errorReporter: ((error: Error, extra?: Record<string, unknown>) => void) | null = null;

/** Register an external error reporter (e.g. Sentry) */
export function setErrorReporter(reporter: (error: Error, extra?: Record<string, unknown>) => void) {
  _errorReporter = reporter;
}

function reportError(error: Error, errorInfo: React.ErrorInfo) {
  if (_errorReporter) {
    _errorReporter(error, {
      componentStack: errorInfo.componentStack,
      platform: Platform.OS,
    });
  }
}

/** Report a non-fatal error to the crash reporting service */
export function captureException(error: Error, extra?: Record<string, unknown>) {
  if (__DEV__) {
    console.warn('captureException:', error.message, extra);
  }
  if (_errorReporter) {
    _errorReporter(error, extra);
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: darkColors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
    maxWidth: 360,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: darkColors.errorLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: darkColors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: darkColors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorBox: {
    maxHeight: 160,
    width: '100%',
    backgroundColor: darkColors.errorLight,
    borderRadius: 10,
    marginBottom: 24,
  },
  errorBoxContent: {
    padding: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    color: darkColors.error,
    marginBottom: 4,
  },
  stackText: {
    fontSize: 11,
    color: darkColors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkColors.primary,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
    color: darkColors.textOnPrimary,
  },
});
