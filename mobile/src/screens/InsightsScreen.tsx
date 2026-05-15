import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfidenceRing } from '@/charts/ConfidenceRing';
import { GlassCard } from '@/components/GlassCard';
import { Header } from '@/components/Header';
import { PremiumBackground } from '@/components/PremiumBackground';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TText } from '@/components/Themed';
import { useFinancialSnapshot } from '@/hooks/useFinancialSnapshot';
import { useAppTheme } from '@/store/useThemeStore';

export function InsightsScreen() {
  const theme = useAppTheme();
  const { data } = useFinancialSnapshot();

  const insightBullets = [
    { color: theme.royal, text: 'Revenue growth driven by strong core business performance.' },
    { color: theme.success, text: 'Profitability improving due to better cost management.' },
    { color: theme.warning, text: 'Cash flow quality needs monitoring in next 2 quarters.' },
    { color: theme.textTertiary, text: 'Low risk profile with stable financial position.' },
  ];

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title="AI Insights" showBack />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          <SegmentedTabs tabs={['Summary', 'Outlook', 'Risks', 'Opportunities']} />

          {/* Overall Financial Health */}
          <GlassCard>
            <TText className="text-[10px] font-semibold tracking-wider" style={{ color: theme.royal }}>
              Overall Financial Health
            </TText>
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
              <ConfidenceRing value={84} size={86} label="/100" />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <TText className="text-sm font-bold" style={{ color: theme.success }}>
                  Strong
                </TText>
                <TText className="mt-1 text-[10px] font-light leading-4 opacity-70">
                  The company is financially healthy with strong growth and efficient operations.
                </TText>
              </View>
            </View>
          </GlassCard>

          {/* Key Insights */}
          <GlassCard style={{ marginTop: 8 }}>
            <TText className="text-[10px] font-semibold tracking-wider opacity-80">
              Key Insights
            </TText>
            {insightBullets.map((item, index) => (
              <View
                key={index}
                style={{
                  marginTop: 8,
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  borderRadius: 8,
                  padding: 10,
                  backgroundColor: theme.surfaceInset,
                  borderWidth: 0.5,
                  borderColor: theme.borderLight,
                }}
              >
                <View
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: 3,
                    backgroundColor: item.color,
                    marginTop: 4,
                    marginRight: 8,
                    opacity: 0.8,
                  }}
                />
                <TText className="text-[10px] font-light leading-4 flex-1" style={{ opacity: 0.75 }}>
                  {item.text}
                </TText>
                <TText className="text-sm opacity-30 ml-2">›</TText>
              </View>
            ))}
          </GlassCard>

          {/* AI Recommendation */}
          <GlassCard style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 5,
                  backgroundColor: `${theme.success}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 6,
                }}
              >
                <TText className="text-[9px]" style={{ color: theme.success }}>✓</TText>
              </View>
              <TText className="text-[9px] font-semibold tracking-widest" style={{ color: theme.success }}>
                AI RECOMMENDATION
              </TText>
            </View>
            <TText className="text-[10px] font-light leading-4 opacity-65">
              Maintain long-term outlook. Focus on improving cash flow efficiency.
            </TText>
          </GlassCard>
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
