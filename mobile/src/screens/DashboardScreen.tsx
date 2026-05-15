import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfidenceRing } from '@/charts/ConfidenceRing';
import { RadarChart } from '@/charts/RadarChart';
import { GlassCard } from '@/components/GlassCard';
import { Header } from '@/components/Header';
import { KpiCapsule } from '@/components/KpiCapsule';
import { PremiumBackground } from '@/components/PremiumBackground';
import { TText } from '@/components/Themed';
import { TimelineRail } from '@/components/TimelineRail';
import { useFinancialSnapshot } from '@/hooks/useFinancialSnapshot';
import { useAppTheme } from '@/store/useThemeStore';

export function DashboardScreen() {
  const theme = useAppTheme();
  const { data, isLoading } = useFinancialSnapshot();

  if (isLoading || !data) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={theme.royal} />
      </SafeAreaView>
    );
  }

  const [revenue, profit] = data.financials;
  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} AM`;

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <Header />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          {/* Greeting & Company */}
          <View style={{ marginBottom: 10 }}>
            <TText className="text-[10px] font-light tracking-wide opacity-50">Good Morning</TText>
            <View style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
              <TText className="flex-1 text-xl font-bold tracking-tight" numberOfLines={1}>
                {data.company.name}
              </TText>
              <View
                style={{
                  height: 7,
                  width: 7,
                  borderRadius: 4,
                  backgroundColor: theme.success,
                  marginLeft: 8,
                  shadowColor: theme.success,
                  shadowOpacity: 0.6,
                  shadowRadius: 4,
                }}
              />
            </View>
            <TText className="mt-0.5 text-[10px] font-light opacity-40">
              Annual Report {data.company.reportYear}
            </TText>
          </View>

          {/* AI Confidence Score Card */}
          <GlassCard>
            <TText className="text-[9px] font-semibold tracking-widest opacity-60 uppercase">
              AI Confidence Score
            </TText>
            <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center' }}>
              <ConfidenceRing value={data.company.confidenceScore} size={100} />
              <View
                style={{
                  marginLeft: 12,
                  flex: 1,
                  borderLeftWidth: 0.5,
                  paddingLeft: 12,
                  borderColor: theme.borderLight,
                }}
              >
                {Object.entries(data.company.reliability).map(([key, value]) => (
                  <View
                    key={key}
                    style={{
                      marginBottom: 7,
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: 2,
                          backgroundColor: theme.royal,
                          marginRight: 6,
                          opacity: 0.6,
                        }}
                      />
                      <TText className="capitalize text-[10px] font-light opacity-60">
                        {key}
                      </TText>
                    </View>
                    <TText className="text-[10px] font-semibold">{value}%</TText>
                  </View>
                ))}
                <TText className="text-[8px] font-light opacity-30 mt-1">
                  Last updated: Today, {timeStr}
                </TText>
              </View>
            </View>
          </GlassCard>

          {/* KPI Row: Revenue + Net Profit */}
          <View style={{ marginTop: 8, flexDirection: 'row' }}>
            <View style={{ flex: 1, marginRight: 4 }}>
              <KpiCapsule
                label="Revenue"
                value={revenue.value}
                change={revenue.change}
                trend={revenue.trend}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 4 }}>
              <KpiCapsule
                label="Net Profit"
                value={profit.value}
                change={profit.change}
                trend={profit.trend}
              />
            </View>
          </View>

          {/* Risk Score — full width */}
          <View style={{ marginTop: 8 }}>
            <KpiCapsule
              label="Risk Score"
              value={`${data.riskScore}/100`}
              change="Low Risk"
              trend={[12, 30, 36, 24, 22, 34]}
              accent="gold"
            />
          </View>

          {/* Profitability Radar */}
          <GlassCard style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <TText className="text-[9px] font-semibold tracking-widest opacity-60 uppercase">
                Profitability Radar
              </TText>
              <TText className="text-[9px] font-light opacity-30">vs Industry</TText>
            </View>
            <View style={{ alignItems: 'center', marginTop: 2 }}>
              <RadarChart size={210} />
            </View>
          </GlassCard>

          {/* AI Recommendation */}
          <GlassCard style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  backgroundColor: `${theme.success}15`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 6,
                }}
              >
                <TText className="text-[10px]" style={{ color: theme.success }}>✓</TText>
              </View>
              <TText className="text-[9px] font-semibold tracking-widest" style={{ color: theme.success }}>
                AI RECOMMENDATION
              </TText>
            </View>
            <TText className="text-[10px] font-light leading-4 opacity-70">
              Maintain long-term outlook. Focus on improving cash flow efficiency.
            </TText>
          </GlassCard>

          {/* View Full Statements CTA */}
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
              View Full Financial Statements →
            </TText>
          </Pressable>

          {/* Timeline */}
          <TimelineRail years={data.years} activeYear={data.company.reportYear} />
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
