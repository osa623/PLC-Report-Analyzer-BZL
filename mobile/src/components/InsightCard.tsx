import { View } from 'react-native';
import { GlassCard } from '@/components/GlassCard';
import { IconGlyph } from '@/components/IconGlyph';
import { TText } from '@/components/Themed';
import { useAppTheme } from '@/store/useThemeStore';

export function InsightCard({ text, label = 'AI INSIGHT' }: { text: string; label?: string }) {
  const theme = useAppTheme();
  return (
    <GlassCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 6,
            backgroundColor: `${theme.gold}18`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconGlyph name="spark" color={theme.gold} size={12} />
        </View>
        <TText className="ml-2 text-[9px] font-semibold tracking-widest" style={{ color: theme.royal }}>
          {label}
        </TText>
      </View>
      <TText className="text-xs font-light leading-5 opacity-80">{text}</TText>
    </GlassCard>
  );
}
