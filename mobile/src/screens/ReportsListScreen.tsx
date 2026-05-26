import { useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';
import { GlassCard } from '@/components/GlassCard';
import { Header } from '@/components/Header';
import { IconGlyph } from '@/components/IconGlyph';
import { PremiumBackground } from '@/components/PremiumBackground';
import { TText } from '@/components/Themed';
import { reportService } from '@/services/reportService';
import { useAppTheme } from '@/store/useThemeStore';
import type { RootStackParamList } from '@/navigation/types';

type NavProp = NativeStackNavigationProp<RootStackParamList>;

export function ReportsListScreen() {
  const theme = useAppTheme();
  const navigation = useNavigation<NavProp>();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: companies, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['companies-list'],
    queryFn: () => reportService.listCompanies(),
    staleTime: 10_000,
  });

  const filteredCompanies = (companies || []).filter((company) => {
    const query = searchQuery.toLowerCase();
    return (
      company.name.toLowerCase().includes(query) ||
      company.sector.toLowerCase().includes(query)
    );
  });

  return (
    <PremiumBackground>
      <SafeAreaView style={{ flex: 1 }}>
        <Header title="Company Profiles" />
        
        {/* Search Input Box */}
        <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: theme.surfaceInset,
              borderRadius: 10,
              borderWidth: 0.5,
              borderColor: theme.borderLight,
              paddingHorizontal: 12,
              height: 40,
            }}
          >
            <IconGlyph name="search" color={theme.textTertiary} size={14} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search companies or sectors..."
              placeholderTextColor={theme.textTertiary}
              style={{
                flex: 1,
                marginLeft: 8,
                color: theme.text,
                fontSize: 12,
                fontWeight: '400',
                paddingVertical: 0,
              }}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <IconGlyph name="warning" color={theme.textTertiary} size={12} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Loading Indicator */}
        {isLoading || isRefetching ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={theme.royal} size="small" />
            <TText className="text-[10px] mt-2 opacity-50">Loading analyzed companies...</TText>
          </View>
        ) : filteredCompanies.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <IconGlyph name="reports" color={theme.textTertiary} size={36} />
            <TText className="text-sm font-bold mt-3 opacity-50">No Profiles Found</TText>
            <TText className="text-[10px] opacity-35 text-center mt-1">
              {searchQuery.length > 0
                ? 'Try adjusting your search terms.'
                : 'Upload financial statements on the home tab to create your first analysis.'}
            </TText>
          </View>
        ) : (
          <FlatList
            data={filteredCompanies}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 92 }}
            refreshing={isRefetching}
            onRefresh={refetch}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  // Direct navigation to Analyzer screens for the selected company
                  navigation.navigate('AnalyzerTabs', { companyId: item.id } as any);
                }}
              >
                <GlassCard compact style={{ marginBottom: 8, flexDirection: 'row', alignItems: 'center' }}>
                  {/* Building Logo Capsule */}
                  <View
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 10,
                      backgroundColor: `${theme.royal}15`,
                      borderWidth: 0.5,
                      borderColor: `${theme.royal}30`,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                    }}
                  >
                    <IconGlyph name="building" color={theme.royal} size={18} />
                  </View>

                  <View style={{ flex: 1 }}>
                    <TText className="text-[12px] font-bold" numberOfLines={1}>
                      {item.name}
                    </TText>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 3 }}>
                      <View
                        style={{
                          backgroundColor: `${theme.gold}15`,
                          paddingHorizontal: 6,
                          paddingVertical: 1.5,
                          borderRadius: 4,
                          marginRight: 8,
                          borderWidth: 0.5,
                          borderColor: `${theme.gold}25`,
                        }}
                      >
                        <TText className="text-[7px] font-bold" style={{ color: theme.gold }}>
                          {item.sector.toUpperCase()}
                        </TText>
                      </View>
                      <TText className="text-[8px] opacity-40">
                        Updated {new Date(item.updated_at).toLocaleDateString()}
                      </TText>
                    </View>
                  </View>

                  <IconGlyph name="chevronRight" color={theme.textTertiary} size={14} />
                </GlassCard>
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </PremiumBackground>
  );
}
