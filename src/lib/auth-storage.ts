import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import type { Session } from '@/lib/session';

const TOKEN_KEY = 'budgiette.auth.token';
const USER_ID_KEY = 'budgiette.auth.userId';

const isWeb = Platform.OS === 'web';

async function getItem(key: string): Promise<string | null> {
  if (isWeb) return window.localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    window.localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    window.localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export async function loadStoredSession(): Promise<Session> {
  const [token, userIdRaw] = await Promise.all([getItem(TOKEN_KEY), getItem(USER_ID_KEY)]);
  const userId = userIdRaw ? Number(userIdRaw) : null;
  return { token, userId: Number.isNaN(userId) ? null : userId };
}

export async function saveStoredSession(session: Session): Promise<void> {
  if (session.token) {
    await setItem(TOKEN_KEY, session.token);
  } else {
    await deleteItem(TOKEN_KEY);
  }
  if (session.userId != null) {
    await setItem(USER_ID_KEY, String(session.userId));
  } else {
    await deleteItem(USER_ID_KEY);
  }
}

export async function clearStoredSession(): Promise<void> {
  await Promise.all([deleteItem(TOKEN_KEY), deleteItem(USER_ID_KEY)]);
}
