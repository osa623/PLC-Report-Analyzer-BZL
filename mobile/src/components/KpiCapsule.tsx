import { View } from 'react-native';
import { GlassCard } from '@/components/GlassCard';
import { TText } from '@/components/Themed';
import { Sparkline } from '@/charts/Sparkline';
import { useAppTheme } from '@/store/useThemeStore';

type Props = {
  label: string;
  value: string;
  change: string;
  trend: number[];
  accent?: 'blue' | 'gold' | 'green' | 'red';
};

export function KpiCapsule({ label, value, change, trend, accent = 'blue' }: Props) {
  const theme = useAppTheme();
  const color = accent === 'gold' ? theme.gold : accent === 'red' ? theme.danger : accent === 'green' ? theme.success : theme.royal;

  return (
    <GlassCard compact style={{ flex: 1, minHeight: 82 }}>
      <TText className="text-[9px] font-medium tracking-wider opacity-50 uppercase" numberOfLines={1}>
        {label}
      </TText>
      <TText className="mt-1 text-xl font-bold tracking-tight" numberOfLines={1}>
        {value}
      </TText>
      <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <TText
          className="text-[10px] font-semibold"
          numberOfLines={1}
          style={{ color: accent === 'red' ? theme.danger : theme.success }}
        >
          {change}
        </TText>
        <Sparkline values={trend} color={color} width={56} height={20} />
      </View>
    </GlassCard>
  );
}
