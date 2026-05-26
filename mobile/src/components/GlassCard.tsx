import { PropsWithChildren } from 'react';
import { View, ViewProps } from 'react-native';
import { useAppTheme } from '@/store/useThemeStore';

type Props = PropsWithChildren<ViewProps & { compact?: boolean; noBorder?: boolean; highlight?: string }>;

export function GlassCard({ children, style, compact, noBorder, highlight, ...props }: Props) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        {
          borderRadius: compact ? 10 : 12,
          padding: compact ? 10 : 12,
          backgroundColor: theme.surfaceCard,
          borderColor: highlight || theme.borderLight,
          borderWidth: noBorder ? 0 : 0.5,
          shadowColor: theme.glow,
          shadowOpacity: theme.mode === 'dark' ? 0.18 : 0.08,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 4 },
          elevation: 2,
        },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}
