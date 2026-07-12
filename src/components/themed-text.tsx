import { Platform } from 'react-native';
import { Text, useTheme as usePaperTheme, type MD3Theme, type TextProps } from 'react-native-paper';

import { Fonts, ThemeColor } from '@/constants/theme';

export type ThemedTextProps = React.ComponentProps<typeof Text> & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

const TYPE_VARIANT: Record<NonNullable<ThemedTextProps['type']>, TextProps<never>['variant']> = {
  default: 'bodyLarge',
  title: 'displaySmall',
  subtitle: 'headlineSmall',
  small: 'bodyMedium',
  smallBold: 'labelLarge',
  link: 'bodyMedium',
  linkPrimary: 'bodyMedium',
  code: 'bodySmall',
};

function resolveColor(paperTheme: MD3Theme, themeColor: ThemeColor | undefined): string {
  switch (themeColor) {
    case 'text':
      return paperTheme.colors.onBackground;
    case 'textSecondary':
      return paperTheme.colors.onSurfaceVariant;
    case 'tint':
      return paperTheme.colors.primary;
    case 'tintText':
      return paperTheme.colors.onPrimary;
    case 'danger':
      return paperTheme.colors.error;
    case 'background':
      return paperTheme.colors.background;
    case 'backgroundElement':
      return paperTheme.colors.surface;
    case 'backgroundSelected':
      return paperTheme.colors.surfaceVariant;
    case 'heroDeep':
      return paperTheme.colors.primary;
    default:
      return paperTheme.colors.onBackground;
  }
}

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const paperTheme = usePaperTheme();
  const color = themeColor === 'tint' && type === 'linkPrimary' ? paperTheme.colors.primary : resolveColor(paperTheme, themeColor);

  return (
    <Text
      variant={TYPE_VARIANT[type]}
      style={[
        { color },
        (type === 'title' || type === 'subtitle') && { fontWeight: '700' },
        type === 'linkPrimary' && { color: paperTheme.colors.primary },
        type === 'code' && { fontFamily: Fonts.mono, fontWeight: Platform.select({ android: '700' }) ?? '500' },
        style,
      ]}
      {...rest}
    />
  );
}
