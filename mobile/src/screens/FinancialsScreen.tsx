import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FinancialMetricCard } from '@/components/FinancialMetricCard';
import { Header } from '@/components/Header';
import { PremiumBackground } from '@/components/PremiumBackground';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TText } from '@/components/Themed';
import { YearSelector } from '@/components/YearSelector';
import { useFinancialSnapshot } from '@/hooks/useFinancialSnapshot';
import { useAppTheme } from '@/store/useThemeStore';

const tabs = ['Summary', 'Income Statement', 'Balance Sheet'];

export function FinancialsScreen() {
  const theme = useAppTheme();
  const { data } = useFinancialSnapshot();

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title="Financial Overview" showBack right="filter" />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          <YearSelector years={data?.years || []} />
          <SegmentedTabs tabs={tabs} />

          {data?.financials.map((metric) => (
            <FinancialMetricCard key={metric.key} metric={metric} />
          ))}

          {/* CTA Button */}
          <Pressable
            style={{
              marginTop: 4,
              borderRadius: 10,
              paddingVertical: 12,
              backgroundColor: theme.royal,
              alignItems: 'center',
              shadowColor: theme.royal,
              shadowOpacity: 0.3,
              shadowRadius: 12,
              shadowOffset: { width: 0, height: 4 },
            }}
          >
            <TText className="text-xs font-semibold" style={{ color: theme.white }}>
              View Full Financial Statements →
            </TText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
