import Constants from 'expo-constants';

const raw = process.env.EXPO_PUBLIC_API_URL ?? 'https://budgietteapi.cardomomo.icu/';

export const API_BASE_URL = raw.endsWith('/') ? raw.slice(0, -1) : raw;
export const DEFAULT_USER_ID = process.env.EXPO_PUBLIC_USER_ID ?? '1';

export const APP_ENV = {
  apiBaseUrl: API_BASE_URL,
  userId: DEFAULT_USER_ID,
  runtime: Constants.executionEnvironment,
};
