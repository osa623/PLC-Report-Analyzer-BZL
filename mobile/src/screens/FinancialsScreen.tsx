import { useState, useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FinancialMetricCard } from '@/components/FinancialMetricCard';
import { GlassCard } from '@/components/GlassCard';
import { Header } from '@/components/Header';
import { PremiumBackground } from '@/components/PremiumBackground';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TText } from '@/components/Themed';
import { YearSelector } from '@/components/YearSelector';
import { useFinancialSnapshot } from '@/hooks/useFinancialSnapshot';
import { useAppTheme } from '@/store/useThemeStore';

const tabs = ['All', 'Income', 'Balance Sheet', 'Cash Flow'];

const tabKeywordMap: Record<string, string[]> = {
  Income: ['revenue', 'netProfit'],
  'Balance Sheet': ['assets', 'equity'],
  'Cash Flow': ['cashFlow'],
};

export function FinancialsScreen() {
  const theme = useAppTheme();
  const { data, isLoading } = useFinancialSnapshot();
  const [activeTab, setActiveTab] = useState(0);

  const filteredMetrics = useMemo(() => {
    if (!data) return [];
    const tabName = tabs[activeTab];
    if (tabName === 'All') return data.financials;
    const keys = tabKeywordMap[tabName] || [];
    return data.financials.filter((m) => keys.includes(m.key));
  }, [data, activeTab]);

  if (isLoading || !data) {
    return (
      <PremiumBackground>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.royal} />
          <TText className="mt-3 text-xs font-light opacity-50">Loading financials…</TText>
        </SafeAreaView>
      </PremiumBackground>
    );
  }

  // Summary stats
  const totalRevenue = data.financials.find((m) => m.key === 'revenue');
  const totalProfit = data.financials.find((m) => m.key === 'netProfit');

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title="Financial Overview" showBack right="filter" />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          <YearSelector years={data.years} activeYear={data.company.reportYear} />
          <SegmentedTabs tabs={tabs} onChange={setActiveTab} />

          {/* Quick summary bar */}
          <GlassCard style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <TText className="text-[9px] font-medium tracking-wider opacity-50 uppercase">Total Revenue</TText>
                <TText className="text-lg font-bold mt-0.5">{totalRevenue?.value || 'N/A'}</TText>
              </View>
              <View style={{ width: 1, height: 30, backgroundColor: theme.borderLight }} />
              <View style={{ alignItems: 'flex-end' }}>
                <TText className="text-[9px] font-medium tracking-wider opacity-50 uppercase">Net Profit</TText>
                <TText className="text-lg font-bold mt-0.5">{totalProfit?.value || 'N/A'}</TText>
              </View>
            </View>
          </GlassCard>

          {/* Metric cards */}
          {filteredMetrics.length === 0 ? (
            <GlassCard>
              <TText className="text-xs font-light opacity-50 text-center py-4">No metrics available for this category</TText>
            </GlassCard>
          ) : (
            filteredMetrics.map((metric) => (
              <FinancialMetricCard key={metric.key} metric={metric} />
            ))
          )}

          {/* Report year info */}
          <View style={{ marginTop: 6, paddingHorizontal: 4 }}>
            <TText className="text-[9px] font-light opacity-30 text-center">
              {data.company.name} · FY {data.company.reportYear} · {data.financials.length} metrics tracked
            </TText>
          </View>

          {/* CTA Button */}
          <Pressable
            style={{
              marginTop: 10,
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
              Download Full Report →
            </TText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
