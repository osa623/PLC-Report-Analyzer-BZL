import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Platform, View } from 'react-native';
import { IconGlyph } from '@/components/IconGlyph';
import type { IconName } from '@/components/IconGlyph';

// Screens — Main tabs (Extraction module home)
import { HomeScreen } from '@/screens/HomeScreen';
// Screens — Analyzer tabs (original financial analysis)
import { DashboardScreen } from '@/screens/DashboardScreen';
import { FinancialsScreen } from '@/screens/FinancialsScreen';
import { RatiosScreen } from '@/screens/RatiosScreen';
import { PatternsScreen } from '@/screens/PatternsScreen';
import { InsightsScreen } from '@/screens/InsightsScreen';
// Screens — Extraction stack screens
import { ProcessingPipelineScreen } from '@/screens/ProcessingPipelineScreen';
import { DocumentProcessingScreen } from '@/screens/DocumentProcessingScreen';

import type { RootTabParamList, RootStackParamList } from '@/navigation/types';
import { useAppTheme } from '@/store/useThemeStore';

const MainTab = createBottomTabNavigator<RootTabParamList>();
const AnalyzerTab = createBottomTabNavigator<RootTabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// ─── Shared tab-bar styling factory ───
function useTabBarConfig() {
  const theme = useAppTheme();
  return {
    headerShown: false as const,
    tabBarActiveTintColor: theme.gold,
    tabBarInactiveTintColor: theme.textTertiary,
    tabBarLabelStyle: {
      fontSize: 9,
      fontWeight: '600' as const,
      marginTop: 0,
      letterSpacing: 0.3,
    },
    tabBarStyle: {
      position: 'absolute' as const,
      left: 12,
      right: 12,
      bottom: Platform.OS === 'ios' ? 10 : 8,
      height: 58,
      borderRadius: 18,
      borderWidth: 0.5,
      borderColor: theme.borderLight,
      backgroundColor: theme.nav,
      shadowColor: theme.glow,
      shadowOpacity: 0.25,
      shadowRadius: 14,
      elevation: 10,
      paddingBottom: Platform.OS === 'ios' ? 0 : 4,
    },
    tabBarBackground: () => (
      <View style={{ flex: 1, borderRadius: 18, overflow: 'hidden' }}>
        <BlurView
          intensity={22}
          tint={theme.mode === 'dark' ? 'dark' : 'light'}
          style={{ flex: 1 }}
        />
      </View>
    ),
  };
}

// ─── Main Tabs (Extraction Module Home) ───
function MainTabNavigator() {
  const theme = useAppTheme();
  const config = useTabBarConfig();

  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        ...config,
        tabBarIcon: ({ color }) => {
          const iconSize = 20;
          const icons: Record<string, IconName> = {
            Home: 'home',
            Reports: 'reports',
            Analytics: 'analytics',
            Alerts: 'alerts',
            More: 'more',
          };
          return <IconGlyph name={icons[route.name] || 'home'} color={color} size={iconSize} />;
        },
      })}
    >
      <MainTab.Screen name="Home" component={HomeScreen} />
      <MainTab.Screen name="Reports" component={HomeScreen} />
      <MainTab.Screen name="Analytics" component={HomeScreen} />
      <MainTab.Screen name="Alerts" component={HomeScreen} />
      <MainTab.Screen name="More" component={HomeScreen} />
    </MainTab.Navigator>
  );
}

// ─── Analyzer Tabs (Original financial analysis flow) ───
function AnalyzerTabNavigator() {
  const theme = useAppTheme();
  const config = useTabBarConfig();

  return (
    <AnalyzerTab.Navigator
      screenOptions={({ route }) => ({
        ...config,
        tabBarIcon: ({ color }) => {
          const iconSize = 20;
          const icon: IconName =
            route.name === 'Dashboard' ? 'dashboard' :
            route.name === 'Financials' ? 'financials' :
            route.name === 'Ratios' ? 'ratios' :
            route.name === 'Patterns' ? 'patterns' :
            'insights';
          return <IconGlyph name={icon} color={color} size={iconSize} />;
        },
      })}
    >
      <AnalyzerTab.Screen name="Dashboard" component={DashboardScreen} />
      <AnalyzerTab.Screen name="Financials" component={FinancialsScreen} />
      <AnalyzerTab.Screen name="Ratios" component={RatiosScreen} />
      <AnalyzerTab.Screen name="Patterns" component={PatternsScreen} />
      <AnalyzerTab.Screen name="Insights" component={InsightsScreen} />
    </AnalyzerTab.Navigator>
  );
}

// ─── Root Stack Navigator ───
export function AppNavigator() {
  const theme = useAppTheme();
  const navTheme = theme.mode === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      theme={{
        ...navTheme,
        colors: {
          ...navTheme.colors,
          background: theme.background,
          card: theme.surface,
          text: theme.text,
          border: theme.border,
          primary: theme.royal,
        },
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabNavigator} />
        <Stack.Screen name="AnalyzerTabs" component={AnalyzerTabNavigator} />
        <Stack.Screen name="ProcessingPipeline" component={ProcessingPipelineScreen} />
        <Stack.Screen name="DocumentProcessing" component={DocumentProcessingScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
