import { ReactNode } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Modal, Portal, useTheme as usePaperTheme } from 'react-native-paper';

type AppModalProps = {
  visible: boolean;
  onDismiss: () => void;
  /** Taller variant for content-heavy modals (e.g. a full payments list). */
  tall?: boolean;
  children: ReactNode;
};

// Paper's Menu/DatePickerModal etc. render through Paper's own Portal, tied to the
// single PortalHost PaperProvider mounts at the app root. A raw React Native `Modal`
// creates its own separate top-level layer that paints over that PortalHost, so any
// Paper dropdown opened from inside a plain RN Modal renders invisibly behind it.
// Routing every app modal through this Paper Portal+Modal keeps them in the same
// stacking context so nested Menus/date pickers actually show up.
export function AppModal({ visible, onDismiss, tall = false, children }: AppModalProps) {
  const paperTheme = usePaperTheme();

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.container,
          tall && styles.tall,
          { backgroundColor: paperTheme.colors.background, borderColor: paperTheme.colors.outline },
        ]}>
        <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
      </Modal>
    </Portal>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    maxHeight: '85%',
    overflow: 'hidden',
  },
  tall: {
    maxHeight: '94%',
  },
  content: {
    padding: 20,
    gap: 12,
  },
});
