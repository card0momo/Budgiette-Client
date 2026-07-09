import { useWindowDimensions } from 'react-native';

import { NarrowBreakpoint } from '@/constants/theme';

export function useIsNarrowScreen() {
  const { width } = useWindowDimensions();

  return width < NarrowBreakpoint;
}
