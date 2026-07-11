import { forwardRef } from 'react';
import { StyleSheet, View, type TextInput as RNTextInput } from 'react-native';
import { HelperText, TextInput, type TextInputProps } from 'react-native-paper';

type TextFieldProps = Omit<TextInputProps, 'mode' | 'label' | 'theme'> & {
  label: string;
  error?: string | null;
};

export const TextField = forwardRef<RNTextInput, TextFieldProps>(function TextField(
  { label, error, ...inputProps },
  ref
) {
  return (
    <View style={styles.wrap}>
      <TextInput ref={ref} label={label} mode="outlined" error={!!error} {...inputProps} />
      {error ? (
        <HelperText type="error" visible>
          {error}
        </HelperText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    gap: 0,
  },
});
