import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra as Record<string, string> | undefined;

export const env = {
  apiBaseUrl:
    extra?.apiBaseUrl ||
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    'http://localhost:3000',
  defaultReportId:
    extra?.defaultReportId ||
    process.env.EXPO_PUBLIC_DEFAULT_REPORT_ID ||
    'demo-report',
};
