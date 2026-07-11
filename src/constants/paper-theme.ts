import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import { Colors } from '@/constants/theme';

export const PaperLightTheme: MD3Theme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: Colors.light.tint,
    onPrimary: Colors.light.tintText,
    primaryContainer: Colors.light.backgroundSelected,
    onPrimaryContainer: Colors.light.text,
    secondary: Colors.light.tint,
    onSecondary: Colors.light.tintText,
    // SegmentedButtons (used app-wide for tab-like single-select controls) reads its
    // checked state from secondaryContainer/onSecondaryContainer, not primary — without
    // this override it falls back to MD3's default purple instead of the app's tint.
    secondaryContainer: Colors.light.tint,
    onSecondaryContainer: Colors.light.tintText,
    background: Colors.light.background,
    onBackground: Colors.light.text,
    surface: Colors.light.backgroundElement,
    onSurface: Colors.light.text,
    surfaceVariant: Colors.light.backgroundSelected,
    onSurfaceVariant: Colors.light.textSecondary,
    outline: Colors.light.backgroundSelected,
    outlineVariant: Colors.light.backgroundSelected,
    error: Colors.light.danger,
    onError: '#FFFFFF',
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: Colors.light.background,
      level1: Colors.light.backgroundElement,
      level2: Colors.light.backgroundElement,
      level3: Colors.light.backgroundSelected,
    },
  },
};

export const PaperDarkTheme: MD3Theme = {
  ...MD3DarkTheme,
  colors: {
    ...MD3DarkTheme.colors,
    primary: Colors.dark.tint,
    onPrimary: Colors.dark.tintText,
    primaryContainer: Colors.dark.backgroundSelected,
    onPrimaryContainer: Colors.dark.text,
    secondary: Colors.dark.tint,
    onSecondary: Colors.dark.tintText,
    secondaryContainer: Colors.dark.tint,
    onSecondaryContainer: Colors.dark.tintText,
    background: Colors.dark.background,
    onBackground: Colors.dark.text,
    surface: Colors.dark.backgroundElement,
    onSurface: Colors.dark.text,
    surfaceVariant: Colors.dark.backgroundSelected,
    onSurfaceVariant: Colors.dark.textSecondary,
    outline: Colors.dark.backgroundSelected,
    outlineVariant: Colors.dark.backgroundSelected,
    error: Colors.dark.danger,
    onError: '#101A24',
    elevation: {
      ...MD3DarkTheme.colors.elevation,
      level0: Colors.dark.background,
      level1: Colors.dark.backgroundElement,
      level2: Colors.dark.backgroundElement,
      level3: Colors.dark.backgroundSelected,
    },
  },
};
