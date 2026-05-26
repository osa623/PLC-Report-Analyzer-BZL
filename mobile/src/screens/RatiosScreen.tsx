import { useState, useMemo } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { Header } from '@/components/Header';
import { MetricRow } from '@/components/MetricRow';
import { PremiumBackground } from '@/components/PremiumBackground';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TText } from '@/components/Themed';
import { YearSelector } from '@/components/YearSelector';
import { useFinancialSnapshot } from '@/hooks/useFinancialSnapshot';
import { useAppTheme } from '@/store/useThemeStore';

const categoryTabs = ['All', 'Profitability', 'Liquidity', 'Solvency', 'Efficiency'];

function getThresholdStatus(key: string, value: string): 'good' | 'warning' | 'danger' | 'neutral' {
  const num = parseFloat(value);
  if (isNaN(num)) return 'neutral';

  const thresholds: Record<string, { good: number; warn: number }> = {
    roe: { good: 15, warn: 8 },
    roa: { good: 5, warn: 2 },
    net_margin: { good: 10, warn: 5 },
    current_ratio: { good: 1.5, warn: 1.0 },
    quick_ratio: { good: 1.0, warn: 0.5 },
    debt_to_equity: { good: 1.0, warn: 2.0 },
  };

  const t = thresholds[key];
  if (!t) return 'neutral';

  // For debt_to_equity, lower is better
  if (key === 'debt_to_equity') {
    if (num <= t.good) return 'good';
    if (num <= t.warn) return 'warning';
    return 'danger';
  }

  if (num >= t.good) return 'good';
  if (num >= t.warn) return 'warning';
  return 'danger';
}

export function RatiosScreen() {
  const theme = useAppTheme();
  const { data, isLoading } = useFinancialSnapshot();
  const [activeTab, setActiveTab] = useState(0);

  const filteredRatios = useMemo(() => {
    if (!data) return [];
    const category = categoryTabs[activeTab];
    if (category === 'All') return data.ratios;
    return data.ratios.filter((r) => r.category === category);
  }, [data, activeTab]);

  if (isLoading || !data) {
    return (
      <PremiumBackground>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.royal} />
          <TText className="mt-3 text-xs font-light opacity-50">Calculating ratios…</TText>
        </SafeAreaView>
      </PremiumBackground>
    );
  }

  const goodCount = data.ratios.filter((r) => getThresholdStatus(r.key, r.value) === 'good').length;
  const warnCount = data.ratios.filter((r) => getThresholdStatus(r.key, r.value) === 'warning').length;
  const dangerCount = data.ratios.filter((r) => getThresholdStatus(r.key, r.value) === 'danger').length;

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title="Key Ratios & Metrics" showBack right="filter" />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          <YearSelector years={data.years} activeYear={data.company.reportYear} />

          {/* Health summary */}
          <View style={{ flexDirection: 'row', marginBottom: 12, paddingHorizontal: 2 }}>
            {[
              { label: 'Healthy', count: goodCount, color: theme.success },
              { label: 'Watch', count: warnCount, color: theme.warning },
              { label: 'Alert', count: dangerCount, color: theme.danger },
            ].map((item) => (
              <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 14 }}>
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: item.color,
                    marginRight: 5,
                  }}
                />
                <TText className="text-[10px] font-medium opacity-60">
                  {item.count} {item.label}
                </TText>
              </View>
            ))}
          </View>

          <SegmentedTabs tabs={categoryTabs} onChange={setActiveTab} />

          {/* Ratio rows with threshold indicators */}
          {filteredRatios.length === 0 ? (
            <GlassCard>
              <TText className="text-xs font-light opacity-50 text-center py-4">No ratios in this category</TText>
            </GlassCard>
          ) : (
            filteredRatios.map((ratio) => {
              const status = getThresholdStatus(ratio.key, ratio.value);
              const borderColor =
                status === 'good' ? theme.success :
                status === 'warning' ? theme.warning :
                status === 'danger' ? theme.danger :
                'transparent';

              return (
                <View
                  key={ratio.key}
                  style={{
                    borderLeftWidth: status !== 'neutral' ? 2.5 : 0,
                    borderLeftColor: borderColor,
                    borderRadius: 8,
                    marginBottom: 2,
                  }}
                >
                  <MetricRow ratio={ratio} />
                </View>
              );
            })
          )}

          {/* Footer */}
          <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
            <TText className="text-[9px] font-light opacity-30 text-center">
              {data.ratios.length} ratios · FY {data.company.reportYear} · {data.company.name}
            </TText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
