import { ActivityIndicator, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { GlassCard } from '@/components/GlassCard';
import { Header } from '@/components/Header';
import { PatternMatrixCard } from '@/components/PatternMatrixCard';
import { PremiumBackground } from '@/components/PremiumBackground';
import { TText } from '@/components/Themed';
import { YearSelector } from '@/components/YearSelector';
import { useFinancialSnapshot } from '@/hooks/useFinancialSnapshot';
import { useAppTheme } from '@/store/useThemeStore';

export function PatternsScreen() {
  const { data, isLoading } = useFinancialSnapshot();
  const theme = useAppTheme();

  if (isLoading || !data) {
    return (
      <PremiumBackground>
        <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.royal} />
          <TText className="mt-3 text-xs font-light opacity-50">Scanning for patterns…</TText>
        </SafeAreaView>
      </PremiumBackground>
    );
  }

  const detectedCount = data.patterns.filter((p) => p.status === 'detected').length;
  const clearCount = data.patterns.filter((p) => p.status === 'clear').length;
  const criticalCount = data.patterns.filter((p) => p.severity === 'critical' && p.status === 'detected').length;

  const sortedPatterns = [...data.patterns].sort((a, b) => {
    // Detected first, then by severity
    if (a.status !== b.status) return a.status === 'detected' ? -1 : 1;
    const sevOrder = { critical: 0, medium: 1, low: 2 };
    return (sevOrder[a.severity] || 2) - (sevOrder[b.severity] || 2);
  });

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title="Pattern Detector" showBack />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          <YearSelector years={data.years} activeYear={data.company.reportYear} />

          {/* Summary stats */}
          <GlassCard style={{ marginBottom: 12 }}>
            <TText className="text-[9px] font-semibold tracking-widest opacity-60 uppercase mb-2">
              AI Pattern Analysis
            </TText>
            <View style={{ flexDirection: 'row', justifyContent: 'space-around' }}>
              <View style={{ alignItems: 'center' }}>
                <TText className="text-xl font-bold" style={{ color: theme.danger }}>{detectedCount}</TText>
                <TText className="text-[9px] font-light opacity-50 mt-0.5">Detected</TText>
              </View>
              <View style={{ width: 1, height: 32, backgroundColor: theme.borderLight }} />
              <View style={{ alignItems: 'center' }}>
                <TText className="text-xl font-bold" style={{ color: theme.success }}>{clearCount}</TText>
                <TText className="text-[9px] font-light opacity-50 mt-0.5">Clear</TText>
              </View>
              <View style={{ width: 1, height: 32, backgroundColor: theme.borderLight }} />
              <View style={{ alignItems: 'center' }}>
                <TText className="text-xl font-bold" style={{ color: criticalCount > 0 ? theme.danger : theme.success }}>{criticalCount}</TText>
                <TText className="text-[9px] font-light opacity-50 mt-0.5">Critical</TText>
              </View>
            </View>
          </GlassCard>

          {/* Status indicators */}
          <View
            style={{
              flexDirection: 'row',
              marginBottom: 12,
              paddingHorizontal: 4,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.danger,
                  marginRight: 5,
                }}
              />
              <TText className="text-[10px] font-light opacity-50">
                {detectedCount} Detected
              </TText>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.success,
                  marginRight: 5,
                }}
              />
              <TText className="text-[10px] font-light opacity-50">
                {clearCount} Clear
              </TText>
            </View>
          </View>

          {sortedPatterns.map((pattern) => (
            <PatternMatrixCard key={pattern.id} pattern={pattern} />
          ))}

          {/* Footer */}
          <View style={{ marginTop: 4, paddingHorizontal: 4 }}>
            <TText className="text-[9px] font-light opacity-30 text-center">
              {data.patterns.length} patterns analyzed · {data.company.name} · FY {data.company.reportYear}
            </TText>
          </View>
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
