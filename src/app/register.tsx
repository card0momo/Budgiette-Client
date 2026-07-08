import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { PrimaryButton } from '@/components/auth/primary-button';
import { TextField } from '@/components/auth/text-field';
import { ThemedText } from '@/components/themed-text';
import { authErrorMessage, useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

export default function RegisterScreen() {
  const { status, register } = useAuth();
  const theme = useTheme();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'signedIn') {
    return <Redirect href="/" />;
  }

  function validate(): string | null {
    if (username.trim().length < 3) return 'Username must be at least 3 characters.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  }

  async function handleSubmit() {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await register({
        username: username.trim(),
        password,
        email: email.trim() ? email.trim() : null,
        full_name: fullName.trim(),
      });
    } catch (err) {
      setError(authErrorMessage(err, 'Could not create your account. Please try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Set up Budgiette to track transactions, budgets, and MSI plans."
      footer={
        <>
          <ThemedText themeColor="textSecondary">Already have an account?</ThemedText>
          <Link href="/login">
            <ThemedText type="linkPrimary" style={{ color: theme.tint }}>
              Sign in
            </ThemedText>
          </Link>
        </>
      }>
      <TextField
        label="Username"
        value={username}
        onChangeText={setUsername}
        placeholder="jane.doe"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="username"
        autoComplete="username"
        returnKeyType="next"
      />
      <TextField
        label="Full name (optional)"
        value={fullName}
        onChangeText={setFullName}
        placeholder="Jane Doe"
        textContentType="name"
        autoComplete="name"
        returnKeyType="next"
      />
      <TextField
        label="Email (optional)"
        value={email}
        onChangeText={setEmail}
        placeholder="jane@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="next"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        autoComplete="password-new"
        returnKeyType="next"
      />
      <TextField
        label="Confirm password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Repeat your password"
        secureTextEntry
        autoCapitalize="none"
        textContentType="newPassword"
        autoComplete="password-new"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />

      {error ? (
        <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      ) : null}

      <PrimaryButton label="Create account" loading={submitting} onPress={handleSubmit} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  error: {
    textAlign: 'center',
  },
});
