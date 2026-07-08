import Constants from 'expo-constants';

const raw = process.env.EXPO_PUBLIC_API_URL ?? 'https://budgiette.cardomomo.icu/';

export const API_BASE_URL = raw.endsWith('/') ? raw.slice(0, -1) : raw;

export const APP_ENV = {
  apiBaseUrl: API_BASE_URL,
  runtime: Constants.executionEnvironment,
};
