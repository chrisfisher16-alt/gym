export function friendlyAuthError(error: { code?: string; message?: string } | string): string {
  const code = typeof error === 'string' ? undefined : error.code;
  const msg = typeof error === 'string' ? error : error.message ?? '';
  if (code === 'invalid_credentials' || msg.includes('Invalid login credentials')) return 'Incorrect email or password.';
  if (code === 'email_not_confirmed' || msg.includes('Email not confirmed')) return 'Please check your email to confirm your account.';
  if (code === 'user_not_found' || msg.includes('User not found')) return 'No account found with this email.';
  if (msg.includes('User already registered')) return 'An account with this email already exists.';
  if (msg.includes('rate limit')) return 'Too many attempts. Please wait a moment.';
  return 'Something went wrong. Please try again.';
}
