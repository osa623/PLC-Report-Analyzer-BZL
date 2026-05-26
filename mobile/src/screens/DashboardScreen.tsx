import { useState } from 'react';
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

function buildRadarFromRatios(ratios: any[]) {
  const radarKeys = ['roe', 'roa', 'operating_margin', 'net_margin', 'ebitda_margin', 'gross_margin'];
  const radarLabels: Record<string, string> = {
    roe: 'ROE',
    roa: 'ROA',
    operating_margin: 'Operating',
    net_margin: 'Net Margin',
    ebitda_margin: 'EBITDA',
    gross_margin: 'Gross',
  };

  const filtered = radarKeys
    .map((k) => ratios.find((r) => r.key === k))
    .filter(Boolean);

  if (filtered.length < 3) return { labels: undefined, values: undefined };

  const labels: [string, string][] = filtered.map((r: any) => [
    radarLabels[r.key] || r.label,
    r.value,
  ]);

  // Normalize to 0-1 range: percentages / 100, ratios capped at 1
  const values = filtered.map((r: any) => {
    const num = parseFloat(r.value);
    if (isNaN(num)) return 0.5;
    if (r.value.includes('%')) return Math.min(num / 100, 1.2);
    return Math.min(num, 1.2);
  });

  return { labels, values };
}

export function DashboardScreen() {
  const theme = useAppTheme();
  const { data, isLoading, isError } = useFinancialSnapshot();

  if (isLoading || !data) {
    return (
      <PremiumBackground>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.royal} />
          <TText className="mt-3 text-xs font-light opacity-50">Loading financial intelligence…</TText>
        </SafeAreaView>
      </PremiumBackground>
    );
  }

  if (isError) {
    return (
      <PremiumBackground>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <TText className="text-sm font-medium" style={{ color: theme.danger }}>Failed to load data</TText>
          <TText className="mt-1 text-xs font-light opacity-50">Check your connection and try again</TText>
        </SafeAreaView>
      </PremiumBackground>
    );
  }

  const [revenue, profit] = data.financials;
  const radar = buildRadarFromRatios(data.ratios);
  const now = new Date();
  const h = now.getHours();
  const greeting = h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening';
  const timeStr = `${h.toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const riskLevel =
    data.riskScore <= 30 ? 'Low Risk' :
    data.riskScore <= 60 ? 'Medium Risk' : 'High Risk';

  const riskAccent: 'green' | 'gold' | 'red' =
    data.riskScore <= 30 ? 'green' :
    data.riskScore <= 60 ? 'gold' : 'red';

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
            <TText className="text-[10px] font-light tracking-wide opacity-50">{greeting}</TText>
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
              Annual Report {data.company.reportYear} · {data.company.sector}
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
              {revenue && (
                <KpiCapsule
                  label="Revenue"
                  value={revenue.value}
                  change={revenue.change}
                  trend={revenue.trend}
                />
              )}
            </View>
            <View style={{ flex: 1, marginLeft: 4 }}>
              {profit && (
                <KpiCapsule
                  label="Net Profit"
                  value={profit.value}
                  change={profit.change}
                  trend={profit.trend}
                  accent="gold"
                />
              )}
            </View>
          </View>

          {/* Risk Score — full width */}
          <View style={{ marginTop: 8 }}>
            <KpiCapsule
              label="Risk Score"
              value={`${data.riskScore}/100`}
              change={riskLevel}
              trend={[data.riskScore * 0.8, data.riskScore * 0.9, data.riskScore, data.riskScore * 1.05, data.riskScore * 0.95, data.riskScore]}
              accent={riskAccent}
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
              <RadarChart
                size={210}
                labels={radar.labels}
                values={radar.values}
              />
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
              {data.aiInsights[0] || 'Maintain long-term outlook. Focus on improving cash flow efficiency.'}
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
