import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Header } from '@/components/Header';
import { PatternMatrixCard } from '@/components/PatternMatrixCard';
import { PremiumBackground } from '@/components/PremiumBackground';
import { TText } from '@/components/Themed';
import { YearSelector } from '@/components/YearSelector';
import { useFinancialSnapshot } from '@/hooks/useFinancialSnapshot';
import { useAppTheme } from '@/store/useThemeStore';

export function PatternsScreen() {
  const { data } = useFinancialSnapshot();
  const theme = useAppTheme();

  const detectedCount = data?.patterns.filter((p) => p.status === 'detected').length || 0;
  const clearCount = data?.patterns.filter((p) => p.status === 'clear').length || 0;

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title="Pattern Detector" showBack />
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          <YearSelector years={data?.years || []} />

          {/* Summary stats */}
          <View
            style={{
              flexDirection: 'row',
              marginBottom: 12,
              paddingHorizontal: 4,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginRight: 16,
              }}
            >
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

          {data?.patterns.map((pattern) => (
            <PatternMatrixCard key={pattern.id} pattern={pattern} />
          ))}
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
