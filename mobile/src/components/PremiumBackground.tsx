import { PropsWithChildren } from 'react';
import { View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppTheme } from '@/store/useThemeStore';

export function PremiumBackground({ children }: PropsWithChildren) {
  const theme = useAppTheme();
  const colors: readonly [string, string, string] =
    theme.mode === 'dark'
      ? ['#020711', '#050F22', '#020711']
      : ['#F7FAFF', '#FFFFFF', '#F5F9FF'];

  return (
    <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }}>
      {/* Top-right radial glow */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -140,
          right: -100,
          height: 300,
          width: 300,
          borderRadius: 150,
          backgroundColor: theme.mode === 'dark' ? 'rgba(43,111,255,0.10)' : 'rgba(43,111,255,0.05)',
        }}
      />
      {/* Mid-left gold glow */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 380,
          left: -150,
          height: 260,
          width: 260,
          borderRadius: 130,
          backgroundColor: theme.mode === 'dark' ? 'rgba(212,175,55,0.05)' : 'rgba(212,175,55,0.06)',
        }}
      />
      {/* Bottom-right subtle accent */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -80,
          right: -60,
          height: 200,
          width: 200,
          borderRadius: 100,
          backgroundColor: theme.mode === 'dark' ? 'rgba(43,111,255,0.04)' : 'rgba(43,111,255,0.03)',
        }}
      />
      {children}
    </LinearGradient>
  );
}
