import { useCallback } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/GlassCard';
import { IconGlyph } from '@/components/IconGlyph';
import { PremiumBackground } from '@/components/PremiumBackground';
import { TText } from '@/components/Themed';
import { sampleActivities, sampleThreads } from '@/constants/extractionData';
import { useAppTheme, useThemeStore } from '@/store/useThemeStore';
import type { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function HomeScreen() {
  const theme = useAppTheme();
  const toggleMode = useThemeStore((s) => s.toggleMode);
  const navigation = useNavigation<NavProp>();

  const totalReports = sampleThreads.length;
  const processing = sampleThreads.filter((t) => t.status === 'running').length;
  const completed = sampleThreads.filter((t) => t.status === 'completed').length;
  const issues = sampleThreads.filter((t) => t.status === 'failed').length + sampleThreads.reduce((s, t) => s + t.issues, 0);

  const statusColor = useCallback(
    (status: string) =>
      status === 'success' ? theme.success
      : status === 'processing' ? theme.royal
      : status === 'warning' ? theme.warning
      : theme.danger,
    [theme],
  );

  const statusIcon = useCallback(
    (status: string): 'check' | 'activity' | 'warning' =>
      status === 'success' ? 'check'
      : status === 'processing' ? 'activity'
      : 'warning',
    [],
  );

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        {/* ─── Top Header ─── */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingTop: 4,
            paddingBottom: 6,
          }}
        >
          {/* Logo */}
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                backgroundColor: `${theme.royal}18`,
                borderWidth: 0.5,
                borderColor: `${theme.royal}30`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconGlyph name="shield" color={theme.royal} size={18} />
            </View>
            <View style={{ marginLeft: 8 }}>
              <TText className="text-sm font-bold tracking-wide">
                Fin<TText className="text-sm font-bold" style={{ color: theme.royal }}>Intelligence</TText>
              </TText>
              <TText className="text-[8px] font-medium opacity-40 tracking-wider uppercase">
                AI Financial Analysis Platform
              </TText>
            </View>
          </View>

          {/* Right icons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Pressable
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: `${theme.danger}15`,
                borderWidth: 0.5,
                borderColor: `${theme.danger}25`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconGlyph name="bell" color={theme.danger} size={15} />
              {/* notification dot */}
              <View
                style={{
                  position: 'absolute',
                  top: 5,
                  right: 5,
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: theme.danger,
                }}
              />
            </Pressable>

            <Pressable
              onPress={toggleMode}
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                backgroundColor: `${theme.gold}12`,
                borderWidth: 0.5,
                borderColor: `${theme.gold}25`,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <IconGlyph name="settings" color={theme.gold} size={15} />
            </Pressable>

            {/* Avatar */}
            <View
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                backgroundColor: theme.royal,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: `${theme.royal}50`,
              }}
            >
              <TText className="text-xs font-bold" style={{ color: theme.white }}>
                AK
              </TText>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
          showsVerticalScrollIndicator={false}
        >
          {/* ─── Welcome Section ─── */}
          <View style={{ marginTop: 12, marginBottom: 14 }}>
            <TText className="text-xl font-bold tracking-tight">
              Good Morning, Arjun 👋
            </TText>
            <TText className="text-[11px] font-medium opacity-50 mt-0.5">
              Ready to analyze your financial documents
            </TText>
          </View>

          {/* ─── Primary Action Cards ─── */}
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
            {/* Extraction Card */}
            <Pressable
              onPress={() => navigation.navigate('ProcessingPipeline')}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={
                  theme.mode === 'dark'
                    ? ['#0A1E40', '#0E2A55', '#081B3A']
                    : ['#EBF2FF', '#F4F8FF', '#E8F0FF']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 14,
                  padding: 14,
                  minHeight: 140,
                  borderWidth: 0.5,
                  borderColor: theme.mode === 'dark' ? `${theme.royal}30` : theme.borderLight,
                  shadowColor: theme.royal,
                  shadowOpacity: theme.mode === 'dark' ? 0.25 : 0.08,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: `${theme.royal}20`,
                    borderWidth: 0.5,
                    borderColor: `${theme.royal}35`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <IconGlyph name="upload" color={theme.royal} size={20} />
                </View>
                <TText className="text-base font-bold tracking-tight">Extraction</TText>
                <TText className="text-[9px] font-medium opacity-50 mt-0.5 leading-4">
                  Upload annual reports{'\n'}and extract data
                </TText>
                <View
                  style={{
                    marginTop: 10,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: `${theme.royal}25`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconGlyph name="chevronRight" color={theme.royal} size={14} />
                </View>
              </LinearGradient>
            </Pressable>

            {/* Analyzer Card */}
            <Pressable
              onPress={() => navigation.navigate('AnalyzerTabs')}
              style={{ flex: 1 }}
            >
              <LinearGradient
                colors={
                  theme.mode === 'dark'
                    ? ['#1A1508', '#2A2210', '#1A1508']
                    : ['#FFF8E8', '#FFFDF5', '#FFF6E0']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  borderRadius: 14,
                  padding: 14,
                  minHeight: 140,
                  borderWidth: 0.5,
                  borderColor: theme.mode === 'dark' ? `${theme.gold}25` : `${theme.gold}30`,
                  shadowColor: theme.gold,
                  shadowOpacity: theme.mode === 'dark' ? 0.2 : 0.08,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: `${theme.gold}20`,
                    borderWidth: 0.5,
                    borderColor: `${theme.gold}30`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 10,
                  }}
                >
                  <IconGlyph name="building" color={theme.gold} size={20} />
                </View>
                <TText className="text-base font-bold tracking-tight">
                  Annual Report{'\n'}Analyzer
                </TText>
                <TText className="text-[9px] font-medium opacity-50 mt-0.5 leading-4">
                  Analyze extracted{'\n'}financial intelligence
                </TText>
                <View
                  style={{
                    marginTop: 10,
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: `${theme.gold}20`,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconGlyph name="chevronRight" color={theme.gold} size={14} />
                </View>
              </LinearGradient>
            </Pressable>
          </View>

          {/* ─── Analytics Overview ─── */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <TText className="text-sm font-bold tracking-wide">Analytics Overview</TText>
            <TText className="text-[9px] font-medium opacity-40" style={{ color: theme.royal }}>
              View All
            </TText>
          </View>

          {/* KPI Row 1 */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
            <GlassCard compact style={{ flex: 1 }}>
              <TText className="text-[9px] font-semibold tracking-wider opacity-50 uppercase">
                Total Reports
              </TText>
              <TText className="text-2xl font-extrabold tracking-tight mt-0.5">
                {totalReports}
              </TText>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <TText className="text-[9px] font-semibold" style={{ color: theme.success }}>
                  +12% vs last month
                </TText>
              </View>
            </GlassCard>

            <GlassCard compact style={{ flex: 1 }}>
              <TText className="text-[9px] font-semibold tracking-wider opacity-50 uppercase">
                Processing
              </TText>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <TText className="text-2xl font-extrabold tracking-tight" style={{ color: theme.royal }}>
                  {processing}
                </TText>
              </View>
              <TText className="text-[9px] font-medium opacity-40 mt-0.5">In Progress</TText>
            </GlassCard>
          </View>

          {/* KPI Row 2 */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
            <GlassCard compact style={{ flex: 1 }}>
              <TText className="text-[9px] font-semibold tracking-wider opacity-50 uppercase">
                Completed
              </TText>
              <TText className="text-2xl font-extrabold tracking-tight mt-0.5">
                {completed}
              </TText>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <TText className="text-[9px] font-semibold" style={{ color: theme.success }}>
                  +8% vs last month
                </TText>
              </View>
            </GlassCard>

            <GlassCard compact style={{ flex: 1 }}>
              <TText className="text-[9px] font-semibold tracking-wider opacity-50 uppercase">
                Issues
              </TText>
              <TText className="text-2xl font-extrabold tracking-tight mt-0.5" style={{ color: theme.danger }}>
                {issues}
              </TText>
              <TText className="text-[9px] font-semibold mt-0.5" style={{ color: theme.danger }}>
                Requires Attention
              </TText>
            </GlassCard>
          </View>

          {/* ─── Recent Activity ─── */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <TText className="text-sm font-bold tracking-wide">Recent Activity</TText>
            <TText className="text-[9px] font-medium opacity-40" style={{ color: theme.royal }}>
              View All
            </TText>
          </View>

          {sampleActivities.map((activity) => (
            <GlassCard
              key={activity.id}
              compact
              style={{ marginBottom: 6 }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    backgroundColor: `${statusColor(activity.status)}15`,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: 10,
                  }}
                >
                  <IconGlyph
                    name={statusIcon(activity.status)}
                    color={statusColor(activity.status)}
                    size={14}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <TText className="text-[11px] font-bold" numberOfLines={1}>
                    {activity.title}
                  </TText>
                  <TText
                    className="text-[9px] font-medium mt-0.5"
                    style={{ color: statusColor(activity.status) }}
                    numberOfLines={1}
                  >
                    {activity.description}
                  </TText>
                </View>
                <TText className="text-[9px] font-medium opacity-40 ml-2">
                  {activity.timestamp}
                </TText>
              </View>
            </GlassCard>
          ))}
        </ScrollView>
      </SafeAreaView>
    </PremiumBackground>
  );
}
