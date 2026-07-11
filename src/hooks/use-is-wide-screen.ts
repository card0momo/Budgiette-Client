import { useWindowDimensions } from 'react-native';

import { WideColumnBreakpoint } from '@/constants/theme';

export function useIsWideScreen() {
  const { width } = useWindowDimensions();

  return width >= WideColumnBreakpoint;
}
