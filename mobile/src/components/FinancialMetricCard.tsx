import { View } from 'react-native';
import { MiniBarChart } from '@/charts/MiniBarChart';
import { GlassCard } from '@/components/GlassCard';
import { TText } from '@/components/Themed';
import { FinancialMetric } from '@/types/finance';
import { useAppTheme } from '@/store/useThemeStore';

export function FinancialMetricCard({ metric }: { metric: FinancialMetric }) {
  const theme = useAppTheme();
  return (
    <GlassCard style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, paddingRight: 10 }}>
          <TText className="text-[10px] font-light tracking-wide opacity-60">{metric.label}</TText>
          <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'baseline' }}>
            <TText className="text-2xl font-bold tracking-tight" numberOfLines={1}>
              {metric.value}
            </TText>
            <TText className="ml-2 text-[10px] font-semibold" style={{ color: theme.success }}>
              {metric.change}
            </TText>
          </View>
          <TText className="mt-0.5 text-[9px] font-light opacity-40">{metric.previous}</TText>
        </View>
        <MiniBarChart values={metric.trend} accent={metric.accent} width={80} height={46} />
      </View>
    </GlassCard>
  );
}
