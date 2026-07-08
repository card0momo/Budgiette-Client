import { Link, Redirect } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { AuthShell } from '@/components/auth/auth-shell';
import { PrimaryButton } from '@/components/auth/primary-button';
import { TextField } from '@/components/auth/text-field';
import { ThemedText } from '@/components/themed-text';
import { authErrorMessage, useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

export default function LoginScreen() {
  const { status, login } = useAuth();
  const theme = useTheme();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === 'signedIn') {
    return <Redirect href="/" />;
  }

  async function handleSubmit() {
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await login({ username: username.trim(), password });
    } catch (err) {
      setError(authErrorMessage(err, 'Could not sign in. Check your credentials and try again.'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Sign in to keep tracking your budget, transactions, and MSI plans."
      footer={
        <>
          <ThemedText themeColor="textSecondary">New to Budgiette?</ThemedText>
          <Link href="/register">
            <ThemedText type="linkPrimary" style={{ color: theme.tint }}>
              Create an account
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
        label="Password"
        value={password}
        onChangeText={setPassword}
        placeholder="••••••••"
        secureTextEntry
        autoCapitalize="none"
        textContentType="password"
        autoComplete="password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
      />

      {error ? (
        <ThemedText type="small" style={[styles.error, { color: theme.danger }]}>
          {error}
        </ThemedText>
      ) : null}

      <PrimaryButton label="Sign in" loading={submitting} onPress={handleSubmit} />
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  error: {
    textAlign: 'center',
  },
});
