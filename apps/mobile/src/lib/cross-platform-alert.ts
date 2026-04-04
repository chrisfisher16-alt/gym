import { Alert, AlertButton, Platform } from 'react-native';

/**
 * Cross-platform wrapper around Alert.alert that uses window.confirm/alert on web
 * where React Native's Alert.alert is a no-op.
 *
 * For confirmation dialogs (with buttons), it uses window.confirm() on web.
 * For informational alerts (no buttons or single OK), it uses window.alert() on web.
 *
 * The "destructive" or "default" styled button is treated as the confirm action on web.
 * The "cancel" styled button is treated as the dismiss action on web.
 */
export function crossPlatformAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
): void {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  // Web fallback
  const displayMessage = message ? `${title}\n\n${message}` : title;

  if (!buttons || buttons.length === 0 || buttons.length === 1) {
    // Simple informational alert
    window.alert(displayMessage);
    buttons?.[0]?.onPress?.();
    return;
  }

  // Confirmation dialog: find the action button (non-cancel) and cancel button
  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const actionButton = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];

  if (window.confirm(displayMessage)) {
    actionButton?.onPress?.();
  } else {
    cancelButton?.onPress?.();
  }
}
