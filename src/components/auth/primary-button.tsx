import { Button } from 'react-native-paper';

type PrimaryButtonProps = {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  onPress?: () => void;
};

export function PrimaryButton({ label, loading = false, disabled = false, variant = 'primary', onPress }: PrimaryButtonProps) {
  return (
    <Button
      mode={variant === 'primary' ? 'contained' : 'outlined'}
      loading={loading}
      disabled={disabled || loading}
      onPress={onPress}>
      {label}
    </Button>
  );
}
