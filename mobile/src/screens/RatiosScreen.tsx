import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/MetricRow';
import { PremiumBackground } from '@/components/PremiumBackground';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { YearSelector } from '@/components/YearSelector';
import { useFinancialSnapshot } from '@/hooks/useFinancialSnapshot';

const categoryTabs = ['Profitability', 'Liquidity', 'Solvency', 'Efficiency'];

export function RatiosScreen() {
  const { data } = useFinancialSnapshot();

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title="Key Ratios & Metrics" showBack right="filter" />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          <YearSelector years={data?.years || []} />
          <SegmentedTabs tabs={categoryTabs} />
          {data?.ratios.map((ratio) => (
            <MetricRow key={ratio.key} ratio={ratio} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
