import { useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConfidenceRing } from '@/charts/ConfidenceRing';
import { GlassCard } from '@/components/GlassCard';
import { Header } from '@/components/Header';
import { PremiumBackground } from '@/components/PremiumBackground';
import { SegmentedTabs } from '@/components/SegmentedTabs';
import { TText } from '@/components/Themed';
import { useFinancialSnapshot } from '@/hooks/useFinancialSnapshot';
import { useAppTheme } from '@/store/useThemeStore';

const insightColors = [
  '#6366F1', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#8B5CF6', // violet
  '#EC4899', // pink
  '#06B6D4', // cyan
];

function getHealthLabel(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Strong', color: '#10B981' };
  if (score >= 60) return { label: 'Moderate', color: '#F59E0B' };
  if (score >= 40) return { label: 'Weak', color: '#F97316' };
  return { label: 'Critical', color: '#EF4444' };
}

export function InsightsScreen() {
  const theme = useAppTheme();
  const { data, isLoading } = useFinancialSnapshot();
  const [activeTab, setActiveTab] = useState(0);

  if (isLoading || !data) {
    return (
      <PremiumBackground>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.royal} />
          <TText className="mt-3 text-xs font-light opacity-50">Generating AI insights…</TText>
        </SafeAreaView>
      </PremiumBackground>
    );
  }

  const healthScore = data.company.confidenceScore;
  const health = getHealthLabel(healthScore);

  // Build health description from available data
  const riskDesc =
    data.riskScore <= 30 ? 'low risk profile with stable financial position' :
    data.riskScore <= 60 ? 'moderate risk profile requiring monitoring' :
    'elevated risk profile requiring immediate attention';

  const healthDescription = `The company demonstrates a ${health.label.toLowerCase()} financial profile with a confidence score of ${healthScore}% and a ${riskDesc}.`;

  // Map insights with cycling colors
  const insightBullets = data.aiInsights.map((text, i) => ({
    color: insightColors[i % insightColors.length],
    text: typeof text === 'string' ? text : String(text),
  }));

  // Build risk/opportunity bullets from patterns
  const detectedPatterns = data.patterns.filter((p) => p.status === 'detected');
  const clearPatterns = data.patterns.filter((p) => p.status === 'clear');

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title="AI Insights" showBack />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          <SegmentedTabs
            tabs={['Summary', 'Risks', 'Opportunities']}
            onChange={setActiveTab}
          />

          {/* Overall Financial Health */}
          <GlassCard>
            <TText className="text-[10px] font-semibold tracking-wider" style={{ color: theme.royal }}>
              Overall Financial Health
            </TText>
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
              <ConfidenceRing value={healthScore} size={86} label="/100" />
              <View style={{ flex: 1, marginLeft: 14 }}>
                <TText className="text-sm font-bold" style={{ color: health.color }}>
                  {health.label}
                </TText>
                <TText className="mt-1 text-[10px] font-light leading-4 opacity-70">
                  {healthDescription}
                </TText>
              </View>
            </View>
          </GlassCard>

          {/* Conditional content based on active tab */}
          {activeTab === 0 && (
            <>
              {/* Key Insights */}
              <GlassCard style={{ marginTop: 8 }}>
                <TText className="text-[10px] font-semibold tracking-wider opacity-80">
                  Key Insights
                </TText>
                {insightBullets.length === 0 ? (
                  <TText className="mt-3 text-[10px] font-light opacity-50 text-center">
                    No AI insights available yet
                  </TText>
                ) : (
                  insightBullets.map((item, index) => (
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
                  ))
                )}
              </GlassCard>
            </>
          )}

          {activeTab === 1 && (
            <GlassCard style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 5,
                    backgroundColor: `${theme.danger}15`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 6,
                  }}
                >
                  <TText className="text-[9px]" style={{ color: theme.danger }}>!</TText>
                </View>
                <TText className="text-[10px] font-semibold tracking-wider" style={{ color: theme.danger }}>
                  RISK FACTORS ({detectedPatterns.length})
                </TText>
              </View>
              {detectedPatterns.length === 0 ? (
                <TText className="text-[10px] font-light opacity-50 py-2 text-center">
                  No risk patterns detected — excellent!
                </TText>
              ) : (
                detectedPatterns.map((p) => (
                  <View
                    key={p.id}
                    style={{
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: `${theme.danger}08`,
                      borderWidth: 0.5,
                      borderColor: `${theme.danger}20`,
                    }}
                  >
                    <TText className="text-xs font-semibold">{p.title}</TText>
                    <TText className="mt-1 text-[10px] font-light opacity-60 leading-4">{p.summary}</TText>
                    <View style={{ flexDirection: 'row', marginTop: 4 }}>
                      <TText className="text-[8px] font-medium opacity-40">Confidence: {p.confidence}%</TText>
                      <TText className="text-[8px] font-medium opacity-40 ml-3">Severity: {p.severity}</TText>
                    </View>
                  </View>
                ))
              )}
            </GlassCard>
          )}

          {activeTab === 2 && (
            <GlassCard style={{ marginTop: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
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
                <TText className="text-[10px] font-semibold tracking-wider" style={{ color: theme.success }}>
                  OPPORTUNITIES ({clearPatterns.length})
                </TText>
              </View>
              {clearPatterns.length === 0 ? (
                <TText className="text-[10px] font-light opacity-50 py-2 text-center">
                  No opportunity patterns identified yet
                </TText>
              ) : (
                clearPatterns.map((p) => (
                  <View
                    key={p.id}
                    style={{
                      marginTop: 6,
                      padding: 10,
                      borderRadius: 8,
                      backgroundColor: `${theme.success}08`,
                      borderWidth: 0.5,
                      borderColor: `${theme.success}20`,
                    }}
                  >
                    <TText className="text-xs font-semibold">{p.title}</TText>
                    <TText className="mt-1 text-[10px] font-light opacity-60 leading-4">{p.summary}</TText>
                    <View style={{ flexDirection: 'row', marginTop: 4 }}>
                      <TText className="text-[8px] font-medium opacity-40">Confidence: {p.confidence}%</TText>
                    </View>
                  </View>
                ))
              )}
            </GlassCard>
          )}

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
              {data.aiInsights[0] || 'Maintain long-term outlook. Focus on improving cash flow efficiency.'}
            </TText>
          </GlassCard>

          {/* Footer */}
          <View style={{ marginTop: 8, paddingHorizontal: 4 }}>
            <TText className="text-[9px] font-light opacity-30 text-center">
              {data.company.name} · FY {data.company.reportYear} · AI-powered analysis
            </TText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
